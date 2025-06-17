import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import { logger } from '@/app/services/logger'

type NotificationRow = Database['notify']['Tables']['ent_notification']['Row']

export interface PollingOptions {
  batchSize?: number
  includeProcessed?: boolean
}

export class NotificationPollingService {
  private lastPollTimestamp: Date | null = null

  constructor(
    private supabase: SupabaseClient<Database>,
    private defaultBatchSize: number = 100
  ) {}

  /**
   * Poll for new or updated notifications based on updated_at timestamp
   * This supports the outbox pattern for reliable notification processing
   */
  async pollNotifications(options: PollingOptions = {}): Promise<NotificationRow[]> {
    const {
      batchSize = this.defaultBatchSize,
      includeProcessed = false
    } = options

    try {
      // Use the last poll timestamp or default to 24 hours ago for initial poll
      const sinceTimestamp = this.lastPollTimestamp || new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      let query = this.supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .gt('updated_at', sinceTimestamp.toISOString())
        .order('updated_at', { ascending: true })
        .limit(batchSize)


      // Optionally exclude already processed notifications
      if (!includeProcessed) {
        query = query.in('notification_status', ['PENDING', 'FAILED'])
      }

      const { data, error } = await query

      if (error) {
        logger.error('Failed to poll notifications', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        throw error
      }

      // Update last poll timestamp to the most recent notification's updated_at
      if (data && data.length > 0) {
        const mostRecentTimestamp = data[data.length - 1].updated_at
        this.lastPollTimestamp = new Date(mostRecentTimestamp)
        
        logger.info('Polled notifications successfully', {
          count: data.length,
          lastTimestamp: mostRecentTimestamp
        })
      }

      return data || []
    } catch (error) {
      logger.error('Error polling notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        lastPollTimestamp: this.lastPollTimestamp?.toISOString()
      })
      throw error
    }
  }

  /**
   * Poll for notifications that need retry (failed status)
   */
  async pollFailedNotifications(options: PollingOptions = {}): Promise<NotificationRow[]> {
    const {
      batchSize = this.defaultBatchSize
    } = options

    try {
      let query = this.supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('notification_status', 'FAILED')
        .order('updated_at', { ascending: true })
        .limit(batchSize)


      const { data, error } = await query

      if (error) {
        logger.error('Failed to poll failed notifications', {
          error: error.message
        })
        throw error
      }

      logger.info('Polled failed notifications', {
        count: data?.length || 0
      })

      return data || []
    } catch (error) {
      logger.error('Error polling failed notifications', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Poll for scheduled notifications that are due
   */
  async pollScheduledNotifications(options: PollingOptions = {}): Promise<NotificationRow[]> {
    const {
      batchSize = this.defaultBatchSize
    } = options

    try {
      const now = new Date().toISOString()
      
      let query = this.supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('notification_status', 'PENDING')
        .not('scheduled_for', 'is', null)
        .lte('scheduled_for', now)
        .order('scheduled_for', { ascending: true })
        .limit(batchSize)


      const { data, error } = await query

      if (error) {
        logger.error('Failed to poll scheduled notifications', {
          error: error.message
        })
        throw error
      }

      logger.info('Polled scheduled notifications', {
        count: data?.length || 0,
        currentTime: now
      })

      return data || []
    } catch (error) {
      logger.error('Error polling scheduled notifications', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Update notification status after processing
   */
  async updateNotificationStatus(
    notificationId: number,
    status: Database['shared_types']['Enums']['notification_status'],
    errorDetails?: any
  ): Promise<void> {
    try {
      const updateData: any = {
        notification_status: status,
        updated_at: new Date().toISOString()
      }

      if (status === 'SENT') {
        updateData.processed_at = new Date().toISOString()
      }

      if (status === 'FAILED' && errorDetails) {
        updateData.error_details = errorDetails
      }

      const { error } = await this.supabase
        .schema('notify')
        .from('ent_notification')
        .update(updateData)
        .eq('id', notificationId)

      if (error) {
        logger.error('Failed to update notification status', {
          notificationId,
          status,
          error: error.message
        })
        throw error
      }

      logger.info('Updated notification status', {
        notificationId,
        status
      })
    } catch (error) {
      logger.error('Error updating notification status', {
        notificationId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Reset polling timestamp (useful for reprocessing)
   */
  resetPollTimestamp(timestamp?: Date): void {
    this.lastPollTimestamp = timestamp || null
    logger.info('Reset poll timestamp', {
      timestamp: this.lastPollTimestamp?.toISOString() || 'null'
    })
  }

  /**
   * Get current polling state
   */
  getPollingState() {
    return {
      lastPollTimestamp: this.lastPollTimestamp?.toISOString() || null,
      isInitialized: this.lastPollTimestamp !== null
    }
  }
}