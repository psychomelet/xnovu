import { supabase } from '@/lib/supabase/client'
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { Novu } from '@novu/node'
import type { Database } from '@/lib/supabase/database.types'

type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert']
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row']

export interface SubscriptionConfig {
  enterpriseId: string
  onNotification?: (notification: NotificationRow) => Promise<void>
  onError?: (error: Error) => void
  queueConfig?: {
    maxConcurrent?: number
    retryAttempts?: number
    retryDelay?: number
    maxQueueSize?: number
  }
}

interface QueueItem {
  notification: NotificationRow
  attempts: number
  addedAt: Date
}

// Structured logging interface
interface LogContext {
  component: string
  enterpriseId: string
  notificationId?: number
  workflowId?: number
  attempt?: number
  error?: string
  remainingQueue?: number
  activeProcessing?: number
  queueSize?: number
  maxQueueSize?: number
  transactionId?: string
  maxAttempts?: number
  retryDelay?: number
  attempts?: number
  payload?: string
  processed?: number
  failed?: number
  clearedCount?: number
}

export class SubscriptionManager {
  private channel: RealtimeChannel | null = null
  private config: SubscriptionConfig
  private isActive: boolean = false
  private processingQueue: QueueItem[] = []
  private activeProcessing: number = 0
  private novu: Novu
  private isShuttingDown: boolean = false
  private queueWorkerRunning: boolean = false

  constructor(config: SubscriptionConfig) {
    // Validate required environment variables
    const novuSecretKey = process.env.NOVU_SECRET_KEY
    if (!novuSecretKey) {
      throw new Error('NOVU_SECRET_KEY environment variable is required')
    }

    this.config = {
      queueConfig: {
        maxConcurrent: 5,
        retryAttempts: 3,
        retryDelay: 1000,
        maxQueueSize: 1000,
        ...config.queueConfig,
      },
      ...config,
    }
    
    this.novu = new Novu(novuSecretKey)
  }

  /**
   * Structured logging method
   */
  private log(level: 'info' | 'warn' | 'error', message: string, context: Partial<LogContext> = {}) {
    const logData = {
      level,
      message,
      timestamp: new Date().toISOString(),
      component: 'SubscriptionManager',
      enterpriseId: this.config.enterpriseId,
      ...context,
    }
    
    // In production, this would use a proper logging library like Winston
    if (level === 'error') {
      console.error(JSON.stringify(logData))
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logData))
    } else {
      console.log(JSON.stringify(logData))
    }
  }

  /**
   * Validate and convert UUID string to proper format for Novu
   */
  private validateAndConvertRecipients(recipients: string[]): string[] {
    return recipients.map(recipient => {
      if (typeof recipient !== 'string') {
        throw new Error(`Invalid recipient type: expected string, got ${typeof recipient}`)
      }
      
      // Basic UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(recipient)) {
        throw new Error(`Invalid UUID format for recipient: ${recipient}`)
      }
      
      return recipient
    })
  }

  /**
   * Start listening to notification inserts
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.log('warn', 'SubscriptionManager is already active')
      return
    }

    try {
      this.channel = supabase
        .channel(`notifications-${this.config.enterpriseId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'notify',
            table: 'ent_notification',
            filter: `enterprise_id=eq.${this.config.enterpriseId}`,
          },
          async (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
            await this.handleNotificationInsert(payload)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.isActive = true
            this.startQueueWorker()
            this.log('info', 'Successfully subscribed to notifications')
          } else if (status === 'CHANNEL_ERROR') {
            this.log('error', 'Subscription channel error')
            this.handleError(new Error('Subscription channel error'))
          } else if (status === 'TIMED_OUT') {
            this.log('error', 'Subscription timed out')
            this.handleError(new Error('Subscription timed out'))
          }
        })
    } catch (error) {
      this.log('error', 'Failed to start subscription', { error: (error as Error).message })
      this.handleError(error as Error)
    }
  }

  /**
   * Stop listening to notifications and cleanup resources
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true
    
    if (this.channel) {
      await supabase.removeChannel(this.channel)
      this.channel = null
    }
    
    // Wait for active processing to complete (with timeout)
    const shutdownTimeout = 30000 // 30 seconds
    const startTime = Date.now()
    
    while (this.activeProcessing > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    this.isActive = false
    this.queueWorkerRunning = false
    this.log('info', 'SubscriptionManager stopped', { 
      remainingQueue: this.processingQueue.length,
      activeProcessing: this.activeProcessing 
    })
  }

  /**
   * Handle notification insert event
   */
  private async handleNotificationInsert(
    payload: RealtimePostgresChangesPayload<NotificationRow>
  ): Promise<void> {
    if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
      this.log('error', 'Invalid payload received', { payload: JSON.stringify(payload) })
      return
    }

    const notificationId = payload.new.id as number

    try {
      // Fetch the complete notification data
      const { data: notification, error } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('id', notificationId)
        .eq('enterprise_id', this.config.enterpriseId)
        .single()

      if (error) {
        throw error
      }

      if (!notification) {
        this.log('error', 'Notification not found', { notificationId })
        return
      }

      // Add to processing queue with size limit
      this.addToQueue(notification)
      
    } catch (error) {
      this.log('error', 'Error handling notification insert', { 
        notificationId, 
        error: (error as Error).message 
      })
      this.handleError(error as Error)
    }
  }

  /**
   * Add notification to processing queue with size limits
   */
  private addToQueue(notification: NotificationRow): void {
    const maxQueueSize = this.config.queueConfig?.maxQueueSize || 1000
    
    if (this.processingQueue.length >= maxQueueSize) {
      this.log('error', 'Queue size limit reached, dropping notification', {
        notificationId: notification.id,
        queueSize: this.processingQueue.length,
        maxQueueSize
      })
      return
    }

    this.processingQueue.push({
      notification,
      attempts: 0,
      addedAt: new Date(),
    })

    this.log('info', 'Notification added to queue', {
      notificationId: notification.id,
      queueSize: this.processingQueue.length
    })
  }

  /**
   * Start the queue worker loop (non-recursive)
   */
  private startQueueWorker(): void {
    if (this.queueWorkerRunning) {
      return
    }

    this.queueWorkerRunning = true
    
    // Use setImmediate to avoid blocking and prevent recursion
    const processLoop = () => {
      if (this.isShuttingDown || !this.queueWorkerRunning) {
        return
      }

      this.processQueueBatch()
        .catch(error => {
          this.log('error', 'Error in queue worker', { error: error.message })
        })
        .finally(() => {
          if (this.queueWorkerRunning) {
            // Schedule next iteration with a small delay to prevent tight loop
            setTimeout(processLoop, 100)
          }
        })
    }

    setImmediate(processLoop)
  }

  /**
   * Process a batch of notifications from the queue
   */
  private async processQueueBatch(): Promise<void> {
    const maxConcurrent = this.config.queueConfig?.maxConcurrent || 5

    while (
      this.processingQueue.length > 0 &&
      this.activeProcessing < maxConcurrent &&
      !this.isShuttingDown
    ) {
      const item = this.processingQueue.shift()
      if (!item) break

      this.activeProcessing++
      
      // Process asynchronously without blocking
      this.processNotification(item)
        .catch((error) => {
          this.log('error', 'Error processing notification', { 
            notificationId: item.notification.id,
            error: error.message 
          })
        })
        .finally(() => {
          this.activeProcessing--
        })
    }
  }

  /**
   * Process a single notification
   */
  private async processNotification(item: QueueItem): Promise<void> {
    const { notification } = item
    const maxAttempts = this.config.queueConfig?.retryAttempts || 3

    try {
      // Update status to PROCESSING
      await supabase
        .schema('notify')
        .from('ent_notification')
        .update({ 
          notification_status: 'PROCESSING',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id)
        .eq('enterprise_id', notification.enterprise_id)

      // Get workflow configuration
      const { data: workflow, error: workflowError } = await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .select('*')
        .eq('id', notification.notification_workflow_id)
        .eq('enterprise_id', notification.enterprise_id)
        .eq('deactivated', false)
        .single()

      if (workflowError) {
        throw workflowError
      }

      if (!workflow) {
        throw new Error(`Workflow ${notification.notification_workflow_id} not found`)
      }

      // Validate and convert recipients
      const validatedRecipients = this.validateAndConvertRecipients(notification.recipients)

      // Trigger Novu workflow with proper type safety
      const result = await this.novu.trigger(workflow.workflow_key, {
        to: validatedRecipients.map(id => ({ subscriberId: id })),
        payload: notification.payload as any,
        overrides: notification.overrides as any || {},
        ...(notification.tags && { tags: notification.tags })
      })

      // Update status to SENT with transaction ID
      await supabase
        .schema('notify')
        .from('ent_notification')
        .update({
          notification_status: 'SENT',
          transaction_id: result.data?.transactionId,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id)
        .eq('enterprise_id', notification.enterprise_id)

      this.log('info', 'Notification processed successfully', {
        notificationId: notification.id,
        workflowId: workflow.id,
        transactionId: result.data?.transactionId
      })

      // Call custom handler if provided
      if (this.config.onNotification) {
        await this.config.onNotification(notification)
      }
    } catch (error) {
      await this.handleProcessingError(item, error as Error, maxAttempts)
    }
  }

  /**
   * Handle processing errors with retry logic
   */
  private async handleProcessingError(item: QueueItem, error: Error, maxAttempts: number): Promise<void> {
    item.attempts++
    
    this.log('error', 'Notification processing failed', {
      notificationId: item.notification.id,
      attempt: item.attempts,
      maxAttempts,
      error: error.message
    })
    
    if (item.attempts < maxAttempts) {
      // Calculate exponential backoff with jitter
      const baseDelay = this.config.queueConfig?.retryDelay || 1000
      const exponentialDelay = baseDelay * Math.pow(2, item.attempts - 1)
      const jitter = Math.random() * 0.1 * exponentialDelay
      const retryDelay = exponentialDelay + jitter

      // Schedule retry
      setTimeout(() => {
        if (!this.isShuttingDown) {
          this.processingQueue.push(item)
          this.log('info', 'Notification scheduled for retry', {
            notificationId: item.notification.id,
            attempt: item.attempts,
            retryDelay: Math.round(retryDelay)
          })
        }
      }, retryDelay)
    } else {
      // Max attempts reached, mark as failed
      await supabase
        .schema('notify')
        .from('ent_notification')
        .update({
          notification_status: 'FAILED',
          error_details: { 
            message: error.message,
            attempts: item.attempts,
            lastAttempt: new Date().toISOString()
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', item.notification.id)
        .eq('enterprise_id', item.notification.enterprise_id)
      
      this.log('error', 'Notification marked as failed after max attempts', {
        notificationId: item.notification.id,
        attempts: item.attempts
      })
      
      this.handleError(error)
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    if (this.config.onError) {
      this.config.onError(error)
    } else {
      this.log('error', 'Unhandled error', { error: error.message })
    }
  }

  /**
   * Get subscription status
   */
  getStatus(): {
    isActive: boolean
    queueLength: number
    activeProcessing: number
    isShuttingDown: boolean
  } {
    return {
      isActive: this.isActive,
      queueLength: this.processingQueue.length,
      activeProcessing: this.activeProcessing,
      isShuttingDown: this.isShuttingDown,
    }
  }

  /**
   * Health check method
   */
  isHealthy(): boolean {
    const status = this.getStatus()
    const maxQueueSize = this.config.queueConfig?.maxQueueSize || 1000
    
    // Consider unhealthy if queue is more than 80% full
    if (status.queueLength > maxQueueSize * 0.8) {
      return false
    }
    
    // Check if subscription is active when it should be
    if (!status.isActive && !status.isShuttingDown) {
      return false
    }
    
    return true
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(
    limit: number = 100
  ): Promise<{ processed: number; failed: number }> {
    const { data: failedNotifications } = await supabase
      .schema('notify')
      .from('ent_notification')
      .select('*')
      .eq('enterprise_id', this.config.enterpriseId)
      .eq('notification_status', 'FAILED')
      .limit(limit)
      .order('created_at', { ascending: false })

    let processed = 0
    let failed = 0

    for (const notification of failedNotifications || []) {
      try {
        // Reset to pending and add to queue
        await supabase
          .schema('notify')
          .from('ent_notification')
          .update({
            notification_status: 'PENDING',
            error_details: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', notification.id)
          .eq('enterprise_id', notification.enterprise_id)
        
        this.addToQueue({
          ...notification,
          notification_status: 'PENDING',
        })
        
        processed++
      } catch (error) {
        this.log('error', 'Failed to retry notification', {
          notificationId: notification.id,
          error: (error as Error).message
        })
        failed++
      }
    }

    this.log('info', 'Failed notifications retry completed', { processed, failed })
    return { processed, failed }
  }

  /**
   * Clear the processing queue
   */
  clearQueue(): void {
    const clearedCount = this.processingQueue.length
    this.processingQueue = []
    this.log('info', 'Processing queue cleared', { clearedCount })
  }

  /**
   * Get queue metrics for monitoring
   */
  getMetrics(): {
    queueLength: number
    activeProcessing: number
    isHealthy: boolean
    oldestQueueItem?: Date
  } {
    const oldestItem = this.processingQueue.length > 0 ? 
      Math.min(...this.processingQueue.map(item => item.addedAt.getTime())) : undefined

    return {
      queueLength: this.processingQueue.length,
      activeProcessing: this.activeProcessing,
      isHealthy: this.isHealthy(),
      oldestQueueItem: oldestItem ? new Date(oldestItem) : undefined,
    }
  }
}