import { proxyActivities, sleep, defineSignal, setHandler, condition } from '@temporalio/workflow'
import type * as activities from '../activities/notification-polling'

const { 
  pollNotifications,
  pollFailedNotifications, 
  pollScheduledNotifications,
  updatePollingNotificationStatus,
  resetPollingTimestamp,
  getPollingState
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    maximumAttempts: 3
  }
})

export interface NotificationPollingConfig {
  enterpriseId?: string
  pollInterval: number // milliseconds
  batchSize?: number
  includeProcessed?: boolean
  processFailedNotifications?: boolean
  processScheduledNotifications?: boolean
}

// Signals for workflow control
export const pauseSignal = defineSignal('pause')
export const resumeSignal = defineSignal('resume')
export const resetTimestampSignal = defineSignal<[string?]>('resetTimestamp')
export const updateConfigSignal = defineSignal<[Partial<NotificationPollingConfig>]>('updateConfig')

export async function notificationPollingWorkflow(config: NotificationPollingConfig): Promise<void> {
  let isPaused = false
  let currentConfig = { ...config }
  
  // Set up signal handlers
  setHandler(pauseSignal, () => {
    isPaused = true
    console.log('Notification polling paused')
  })

  setHandler(resumeSignal, () => {
    isPaused = false
    console.log('Notification polling resumed')
  })

  setHandler(resetTimestampSignal, (timestamp?: string) => {
    resetPollingTimestamp(timestamp).catch(err => 
      console.error('Failed to reset timestamp', { error: err })
    )
  })

  setHandler(updateConfigSignal, (updates: Partial<NotificationPollingConfig>) => {
    currentConfig = { ...currentConfig, ...updates }
    console.log('Notification polling config updated', { config: currentConfig })
  })

  console.log('Starting notification polling workflow', { config: currentConfig })

  while (true) {
    if (isPaused) {
      await condition(() => !isPaused)
      continue
    }

    try {
      // Poll for new/updated notifications
      const notifications = await pollNotifications({
        enterpriseId: currentConfig.enterpriseId,
        batchSize: currentConfig.batchSize,
        includeProcessed: currentConfig.includeProcessed
      })

      console.log('Polled notifications', { 
        count: notifications.length,
        enterpriseId: currentConfig.enterpriseId 
      })

      // Process each notification
      for (const notification of notifications) {
        try {
          // Here you would trigger the notification workflow
          // For now, we'll just mark it as processed
          // In a real implementation, you'd use a child workflow or activity
          // to trigger the actual notification processing
          
          await updatePollingNotificationStatus(notification.id, 'PROCESSING')
          
          // TODO: Trigger actual notification processing
          // Example: await executeChild(processNotificationWorkflow, { args: [notification] })
          
          // For now, simulate processing
          await updatePollingNotificationStatus(notification.id, 'SENT')
          
        } catch (error) {
          console.error('Failed to process notification', {
            notificationId: notification.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          
          await updatePollingNotificationStatus(
            notification.id, 
            'FAILED',
            { error: error instanceof Error ? error.message : 'Unknown error' }
          )
        }
      }

      // Poll for failed notifications if enabled
      if (currentConfig.processFailedNotifications) {
        const failedNotifications = await pollFailedNotifications({
          enterpriseId: currentConfig.enterpriseId,
          batchSize: currentConfig.batchSize
        })

        console.log('Polled failed notifications', { count: failedNotifications.length })

        // Process failed notifications (retry logic)
        for (const notification of failedNotifications) {
          try {
            await updatePollingNotificationStatus(notification.id, 'PROCESSING')
            
            // TODO: Retry notification processing
            
            await updatePollingNotificationStatus(notification.id, 'SENT')
          } catch (error) {
            console.error('Failed to retry notification', {
              notificationId: notification.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }
      }

      // Poll for scheduled notifications if enabled
      if (currentConfig.processScheduledNotifications) {
        const scheduledNotifications = await pollScheduledNotifications({
          enterpriseId: currentConfig.enterpriseId,
          batchSize: currentConfig.batchSize
        })

        console.log('Polled scheduled notifications', { count: scheduledNotifications.length })

        // Process scheduled notifications
        for (const notification of scheduledNotifications) {
          try {
            await updatePollingNotificationStatus(notification.id, 'PROCESSING')
            
            // TODO: Process scheduled notification
            
            await updatePollingNotificationStatus(notification.id, 'SENT')
          } catch (error) {
            console.error('Failed to process scheduled notification', {
              notificationId: notification.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
            
            await updatePollingNotificationStatus(
              notification.id,
              'FAILED',
              { error: error instanceof Error ? error.message : 'Unknown error' }
            )
          }
        }
      }

    } catch (error) {
      console.error('Polling cycle failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        config: currentConfig
      })
    }

    // Wait for the configured interval before next poll
    await sleep(currentConfig.pollInterval)
  }
}

/**
 * Query handler to get current polling state
 */
export async function getPollingStateQuery(): Promise<{
  lastPollTimestamp: string | null
  isInitialized: boolean
}> {
  return await getPollingState()
}