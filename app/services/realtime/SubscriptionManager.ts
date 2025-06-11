import { supabase } from '@/lib/supabase/client'
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { NotificationService } from '../database/NotificationService'
import { WorkflowService } from '../database/WorkflowService'
import { Novu } from '@novu/node'
import type { Database } from '@/lib/supabase/types'

type NotificationInsert = Database['public']['Tables']['ent_notification']['Insert']
type NotificationRow = Database['public']['Tables']['ent_notification']['Row']

export interface SubscriptionConfig {
  enterpriseId: string
  onNotification?: (notification: NotificationRow) => Promise<void>
  onError?: (error: Error) => void
  queueConfig?: {
    maxConcurrent?: number
    retryAttempts?: number
    retryDelay?: number
  }
}

interface QueueItem {
  notification: NotificationRow
  attempts: number
}

export class SubscriptionManager {
  private channel: RealtimeChannel | null = null
  private config: SubscriptionConfig
  private isActive: boolean = false
  private processingQueue: QueueItem[] = []
  private activeProcessing: number = 0
  private novu: Novu

  constructor(config: SubscriptionConfig) {
    this.config = {
      queueConfig: {
        maxConcurrent: 5,
        retryAttempts: 3,
        retryDelay: 1000,
        ...config.queueConfig,
      },
      ...config,
    }
    
    this.novu = new Novu(process.env.NOVU_SECRET_KEY!)
  }

  /**
   * Start listening to notification inserts
   */
  async start(): Promise<void> {
    if (this.isActive) {
      console.warn('SubscriptionManager is already active')
      return
    }

    try {
      this.channel = supabase
        .channel(`notifications-${this.config.enterpriseId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
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
            console.log('SubscriptionManager: Successfully subscribed to notifications')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('SubscriptionManager: Channel error')
            this.handleError(new Error('Subscription channel error'))
          } else if (status === 'TIMED_OUT') {
            console.error('SubscriptionManager: Subscription timed out')
            this.handleError(new Error('Subscription timed out'))
          }
        })
    } catch (error) {
      console.error('SubscriptionManager: Failed to start subscription', error)
      this.handleError(error as Error)
    }
  }

  /**
   * Stop listening to notifications
   */
  async stop(): Promise<void> {
    if (this.channel) {
      await supabase.removeChannel(this.channel)
      this.channel = null
    }
    this.isActive = false
    console.log('SubscriptionManager: Stopped')
  }

  /**
   * Handle notification insert event
   */
  private async handleNotificationInsert(
    payload: RealtimePostgresChangesPayload<NotificationRow>
  ): Promise<void> {
    if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
      console.error('SubscriptionManager: Invalid payload received')
      return
    }

    const notificationId = payload.new.id as string

    try {
      // Fetch the complete notification data
      const notification = await NotificationService.getNotification(
        notificationId,
        this.config.enterpriseId
      )

      if (!notification) {
        console.error(`SubscriptionManager: Notification ${notificationId} not found`)
        return
      }

      // Add to processing queue
      this.addToQueue(notification)
      
      // Process queue
      await this.processQueue()
    } catch (error) {
      console.error(`SubscriptionManager: Error handling notification ${notificationId}`, error)
      this.handleError(error as Error)
    }
  }

  /**
   * Add notification to processing queue
   */
  private addToQueue(notification: NotificationRow): void {
    this.processingQueue.push({
      notification,
      attempts: 0,
    })
  }

  /**
   * Process notifications in queue
   */
  private async processQueue(): Promise<void> {
    const maxConcurrent = this.config.queueConfig?.maxConcurrent || 5

    while (
      this.processingQueue.length > 0 &&
      this.activeProcessing < maxConcurrent
    ) {
      const item = this.processingQueue.shift()
      if (!item) break

      this.activeProcessing++
      
      // Process asynchronously without blocking
      this.processNotification(item)
        .catch((error) => {
          console.error('SubscriptionManager: Error processing notification', error)
        })
        .finally(() => {
          this.activeProcessing--
          // Try to process more items
          this.processQueue().catch(console.error)
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
      await NotificationService.updateNotificationStatus(
        notification.id,
        notification.enterprise_id,
        'PROCESSING'
      )

      // Get workflow configuration
      const workflow = await WorkflowService.getWorkflowByKey(
        notification.workflow_key,
        notification.enterprise_id
      )

      if (!workflow) {
        throw new Error(`Workflow ${notification.workflow_key} not found`)
      }

      // Trigger Novu workflow
      const result = await this.novu.trigger(notification.workflow_key, {
        to: {
          subscriberId: notification.subscriber_id,
        },
        payload: notification.payload,
      })

      // Update status to SENT with transaction ID
      await NotificationService.updateNotificationStatus(
        notification.id,
        notification.enterprise_id,
        'SENT',
        undefined,
        result.data?.transactionId
      )

      // Call custom handler if provided
      if (this.config.onNotification) {
        await this.config.onNotification(notification)
      }
    } catch (error) {
      item.attempts++
      
      if (item.attempts < maxAttempts) {
        // Retry after delay
        const retryDelay = this.config.queueConfig?.retryDelay || 1000
        setTimeout(() => {
          this.processingQueue.push(item)
          this.processQueue().catch(console.error)
        }, retryDelay * item.attempts)
      } else {
        // Max attempts reached, mark as failed
        await NotificationService.updateNotificationStatus(
          notification.id,
          notification.enterprise_id,
          'FAILED',
          error instanceof Error ? error.message : 'Unknown error'
        )
        
        this.handleError(error as Error)
      }
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    if (this.config.onError) {
      this.config.onError(error)
    } else {
      console.error('SubscriptionManager: Unhandled error', error)
    }
  }

  /**
   * Get subscription status
   */
  getStatus(): {
    isActive: boolean
    queueLength: number
    activeProcessing: number
  } {
    return {
      isActive: this.isActive,
      queueLength: this.processingQueue.length,
      activeProcessing: this.activeProcessing,
    }
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(
    limit: number = 100
  ): Promise<{ processed: number; failed: number }> {
    const failedNotifications = await NotificationService.getNotifications(
      this.config.enterpriseId,
      {
        status: 'FAILED',
        limit,
      }
    )

    let processed = 0
    let failed = 0

    for (const notification of failedNotifications) {
      try {
        // Reset to pending and add to queue
        await NotificationService.updateNotificationStatus(
          notification.id,
          notification.enterprise_id,
          'PENDING'
        )
        
        this.addToQueue({
          ...notification,
          status: 'PENDING',
        })
        
        processed++
      } catch (error) {
        console.error(`Failed to retry notification ${notification.id}`, error)
        failed++
      }
    }

    // Process the queue
    await this.processQueue()

    return { processed, failed }
  }

  /**
   * Clear the processing queue
   */
  clearQueue(): void {
    this.processingQueue = []
  }
}