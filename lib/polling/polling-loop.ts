import { logger } from '@/app/services/logger'
import { Connection, WorkflowClient } from '@temporalio/client'
import { pollNotifications, pollFailedNotifications, pollScheduledNotifications, updatePollingNotificationStatus } from './notification-polling'
import { Database } from '@/lib/supabase/database.types'

type NotificationRow = Database['notify']['Tables']['ent_notification']['Row']

export interface PollingLoopConfig {
  pollIntervalMs: number
  failedPollIntervalMs: number
  scheduledPollIntervalMs: number
  batchSize: number
  temporal: {
    address: string
    namespace: string
    taskQueue: string
  }
}

export class NotificationPollingLoop {
  private isRunning = false
  private pollInterval: NodeJS.Timeout | null = null
  private failedPollInterval: NodeJS.Timeout | null = null
  private scheduledPollInterval: NodeJS.Timeout | null = null
  private temporalClient: WorkflowClient | null = null

  constructor(private config: PollingLoopConfig) {}

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Polling loop is already running')
      return
    }

    logger.info('Starting notification polling loop', {
      config: this.config
    })

    // Connect to Temporal
    const connection = await Connection.connect({
      address: this.config.temporal.address,
      tls: this.config.temporal.address.includes(':443') || this.config.temporal.address.startsWith('https://') ? {} : false,
    })

    this.temporalClient = new WorkflowClient({
      connection,
      namespace: this.config.temporal.namespace,
    })

    this.isRunning = true

    // Start polling loops
    this.startNewNotificationPolling()
    this.startFailedNotificationPolling()
    this.startScheduledNotificationPolling()
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    logger.info('Stopping notification polling loop')

    this.isRunning = false

    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    if (this.failedPollInterval) {
      clearInterval(this.failedPollInterval)
      this.failedPollInterval = null
    }

    if (this.scheduledPollInterval) {
      clearInterval(this.scheduledPollInterval)
      this.scheduledPollInterval = null
    }

    this.temporalClient = null
  }

  private startNewNotificationPolling(): void {
    const poll = async () => {
      if (!this.isRunning) return

      try {
        const notifications = await pollNotifications({
          batchSize: this.config.batchSize
        })

        if (notifications.length > 0) {
          logger.info('Found new notifications to process', {
            count: notifications.length
          })

          await this.triggerNotificationWorkflows(notifications)
        }
      } catch (error) {
        logger.error('Error in new notification polling', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Initial poll
    poll()

    // Schedule regular polls
    this.pollInterval = setInterval(poll, this.config.pollIntervalMs)
  }

  private startFailedNotificationPolling(): void {
    const poll = async () => {
      if (!this.isRunning) return

      try {
        const notifications = await pollFailedNotifications({
          batchSize: this.config.batchSize
        })

        if (notifications.length > 0) {
          logger.info('Found failed notifications to retry', {
            count: notifications.length
          })

          await this.triggerNotificationWorkflows(notifications)
        }
      } catch (error) {
        logger.error('Error in failed notification polling', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Initial poll after a delay
    setTimeout(poll, 30000) // Wait 30 seconds before first failed poll

    // Schedule regular polls
    this.failedPollInterval = setInterval(poll, this.config.failedPollIntervalMs)
  }

  private startScheduledNotificationPolling(): void {
    const poll = async () => {
      if (!this.isRunning) return

      try {
        const notifications = await pollScheduledNotifications({
          batchSize: this.config.batchSize
        })

        if (notifications.length > 0) {
          logger.info('Found scheduled notifications to process', {
            count: notifications.length
          })

          await this.triggerNotificationWorkflows(notifications)
        }
      } catch (error) {
        logger.error('Error in scheduled notification polling', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Initial poll
    poll()

    // Schedule regular polls
    this.scheduledPollInterval = setInterval(poll, this.config.scheduledPollIntervalMs)
  }

  private async triggerNotificationWorkflows(notifications: NotificationRow[]): Promise<void> {
    if (!this.temporalClient) {
      logger.error('Temporal client not initialized')
      return
    }

    const promises = notifications.map(async (notification) => {
      try {
        await this.temporalClient!.start('notificationTriggerWorkflow', {
          taskQueue: this.config.temporal.taskQueue,
          workflowId: `notification-${notification.id}`,
          args: [{ notificationId: notification.id }],
        })

        logger.info('Started workflow for notification', {
          notificationId: notification.id
        })

        // Update notification status to PROCESSING to prevent re-polling
        await updatePollingNotificationStatus(notification.id, 'PROCESSING')
      } catch (error) {
        logger.error('Failed to start workflow for notification', {
          notificationId: notification.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })

    await Promise.all(promises)
  }

  /**
   * Check if the polling loop is currently running
   */
  public getIsRunning(): boolean {
    return this.isRunning
  }
}