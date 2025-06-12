import { 
  proxyActivities, 
  startChild, 
  sleep, 
  defineSignal, 
  setHandler,
  condition
} from '@temporalio/workflow'
import type * as activities from '../activities'
import { notificationProcessingWorkflow } from './notification-processing'

// Create activity proxies
const {
  pollSupabaseNotifications,
  recordNotificationError
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '5m',
    maximumAttempts: 10,
  },
})

export interface RealtimeConfig {
  enterpriseIds: string[]
  pollingInterval?: string
  batchSize?: number
}

export interface RealtimeMonitoringState {
  isRunning: boolean
  lastProcessedTimestamp: number
  processedCount: number
  errorCount: number
}

// Define signals for controlling the workflow
export const pauseSignal = defineSignal('pause')
export const resumeSignal = defineSignal('resume')
export const updateConfigSignal = defineSignal<[RealtimeConfig]>('updateConfig')

// Realtime monitoring workflow that replaces EnhancedSubscriptionManager
export async function realtimeMonitoringWorkflow(
  config: RealtimeConfig
): Promise<void> {
  let state: RealtimeMonitoringState = {
    isRunning: true,
    lastProcessedTimestamp: Date.now(),
    processedCount: 0,
    errorCount: 0
  }

  let currentConfig = {
    ...config,
    pollingInterval: config.pollingInterval || '30s',
    batchSize: config.batchSize || 100
  }

  // Set up signal handlers
  setHandler(pauseSignal, () => {
    state.isRunning = false
  })

  setHandler(resumeSignal, () => {
    state.isRunning = true
  })

  setHandler(updateConfigSignal, (newConfig: RealtimeConfig) => {
    currentConfig = {
      ...currentConfig,
      ...newConfig
    }
  })

  // Main monitoring loop
  while (true) {
    // Wait if paused
    await condition(() => state.isRunning)

    try {
      // Poll for new notifications
      const notifications = await pollSupabaseNotifications({
        enterpriseIds: currentConfig.enterpriseIds,
        since: state.lastProcessedTimestamp,
        limit: currentConfig.batchSize
      })

      if (notifications.length > 0) {
        console.log(`Processing ${notifications.length} new notifications`)

        // Process notifications in parallel using child workflows
        const childPromises = notifications.map(notification =>
          startChild(notificationProcessingWorkflow, {
            workflowId: `process-notification-${notification.id}-${Date.now()}`,
            args: [notification],
          })
        )

        // Wait for all child workflows to complete
        const results = await Promise.allSettled(childPromises)

        // Count successes and failures
        for (const result of results) {
          if (result.status === 'fulfilled') {
            state.processedCount++
          } else {
            state.errorCount++
            console.error('Failed to process notification:', result.reason)
          }
        }

        // Update timestamp to the latest notification
        const latestTimestamp = Math.max(
          ...notifications.map(n => new Date(n.createdAt).getTime())
        )
        state.lastProcessedTimestamp = latestTimestamp
      }

      // Sleep before next poll
      await sleep(currentConfig.pollingInterval)

    } catch (error) {
      state.errorCount++
      console.error('Error in realtime monitoring:', error)
      
      // Exponential backoff on errors
      await sleep('1m')
    }
  }
}

// Enhanced monitoring workflow with health checks
export async function enhancedRealtimeMonitoringWorkflow(
  config: RealtimeConfig & { healthCheckInterval?: string }
): Promise<void> {
  const healthCheckInterval = config.healthCheckInterval || '5m'
  let lastHealthCheck = Date.now()
  
  // Start the main monitoring workflow as a child
  const monitoringHandle = await startChild(realtimeMonitoringWorkflow, {
    workflowId: `realtime-monitor-${Date.now()}`,
    args: [config],
  })

  // Health check loop
  while (true) {
    await sleep(healthCheckInterval)
    
    const now = Date.now()
    const timeSinceLastCheck = now - lastHealthCheck
    
    // If no activity for too long, restart the monitoring
    if (timeSinceLastCheck > 10 * 60 * 1000) { // 10 minutes
      console.warn('Realtime monitoring appears stuck, restarting...')
      
      // Cancel the current monitoring workflow
      await monitoringHandle.signal(pauseSignal)
      
      // Start a new one
      await startChild(realtimeMonitoringWorkflow, {
        workflowId: `realtime-monitor-restart-${Date.now()}`,
        args: [config],
      })
    }
    
    lastHealthCheck = now
  }
}