import { 
  proxyActivities, 
  startChild, 
  sleep,
  defineSignal,
  setHandler
} from '@temporalio/workflow'
import type * as activities from '../activities'
import { notificationProcessingWorkflow } from './notification-processing'
import type { NotificationRule, Notification } from '@/types/rule-engine'

// Create activity proxies
const {
  fetchActiveCronRules,
  fetchScheduledNotifications,
  updateNotificationStatus
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '5m',
    maximumAttempts: 10,
  },
})

export interface CronConfig {
  interval?: string
  timezone?: string
}

export interface ScheduledConfig {
  checkInterval?: string
  batchSize?: number
}

// Signal to refresh cron rules
export const refreshCronRulesSignal = defineSignal('refreshCronRules')

// Cron scheduling workflow that replaces CronManager
export async function cronSchedulingWorkflow(
  config: CronConfig
): Promise<void> {
  const interval = config.interval || '1m'
  let cronRules: NotificationRule[] = []
  let shouldRefresh = true

  // Set up signal handler for rule refresh
  setHandler(refreshCronRulesSignal, () => {
    shouldRefresh = true
  })

  // Track last execution time for each rule
  const lastExecutionMap = new Map<number, number>()

  while (true) {
    try {
      // Refresh rules if needed
      if (shouldRefresh) {
        cronRules = await fetchActiveCronRules()
        shouldRefresh = false
        console.log(`Loaded ${cronRules.length} active cron rules`)
      }

      const now = Date.now()

      // Check each rule
      for (const rule of cronRules) {
        if (await shouldExecuteRule(rule, lastExecutionMap.get(rule.id), now)) {
          // Execute the rule by creating a notification
          await startChild(executeCronRuleWorkflow, {
            workflowId: `cron-rule-${rule.id}-${now}`,
            args: [rule],
          })

          lastExecutionMap.set(rule.id, now)
        }
      }

      await sleep(interval)

    } catch (error) {
      console.error('Error in cron scheduling:', error)
      await sleep('1m') // Back off on error
    }
  }
}

// Execute a single cron rule
export async function executeCronRuleWorkflow(
  rule: NotificationRule
): Promise<void> {
  try {
    // Create notification from rule config
    const ruleConfig = rule as any // Type casting for flexible rule structure
    const notification = {
      id: 0, // Will be assigned by database
      enterpriseId: rule.enterprise_id || '',
      workflowId: rule.notification_workflow_id,
      payload: ruleConfig.payload || {},
      recipients: ruleConfig.recipients || [],
      overrides: ruleConfig.overrides || {},
      status: 'pending',
      createdAt: new Date().toISOString()
    }

    // Process the notification
    await startChild(notificationProcessingWorkflow, {
      workflowId: `cron-notification-${rule.id}-${Date.now()}`,
      args: [notification],
    })

  } catch (error) {
    console.error(`Failed to execute cron rule ${rule.id}:`, error)
    throw error
  }
}

// Scheduled notification workflow that replaces ScheduledNotificationManager
export async function scheduledNotificationWorkflow(
  config: ScheduledConfig
): Promise<void> {
  const checkInterval = config.checkInterval || '1m'
  const batchSize = config.batchSize || 100

  while (true) {
    try {
      // Fetch notifications that are due
      const scheduledNotifications = await fetchScheduledNotifications(batchSize)

      if (scheduledNotifications.length > 0) {
        console.log(`Processing ${scheduledNotifications.length} scheduled notifications`)

        // Process each scheduled notification
        const childPromises = scheduledNotifications.map(notification =>
          startChild(processScheduledNotificationWorkflow, {
            workflowId: `scheduled-notification-${notification.id}-${Date.now()}`,
            args: [notification],
          })
        )

        // Wait for all to complete
        await Promise.allSettled(childPromises)
      }

      await sleep(checkInterval)

    } catch (error) {
      console.error('Error in scheduled notification processing:', error)
      await sleep('1m') // Back off on error
    }
  }
}

// Process a single scheduled notification
export async function processScheduledNotificationWorkflow(
  notification: Notification
): Promise<void> {
  try {
    // Update status to processing
    await updateNotificationStatus(notification.id, 'PROCESSING')

    // Convert to NotificationData format
    const notificationData = {
      id: notification.id,
      enterpriseId: notification.enterprise_id || '',
      workflowId: notification.notification_workflow_id || 0,
      payload: notification.payload,
      recipients: notification.recipients || [],
      overrides: notification.overrides || {},
      status: notification.notification_status || 'PENDING',
      createdAt: notification.created_at
    }

    // Process the notification
    const result = await notificationProcessingWorkflow(notificationData)

    if (result.status === 'failed') {
      await updateNotificationStatus(notification.id, 'FAILED', result.reason)
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await updateNotificationStatus(notification.id, 'FAILED', errorMessage)
    throw error
  }
}

// One-time scheduled notification workflow
export async function oneTimeScheduledNotificationWorkflow(
  config: {
    notificationId: number
    scheduledFor: number // Timestamp
  }
): Promise<void> {
  const delay = config.scheduledFor - Date.now()
  
  if (delay > 0) {
    await sleep(delay)
  }

  // Fetch and process the notification
  await startChild(processScheduledNotificationWorkflow, {
    workflowId: `one-time-scheduled-${config.notificationId}`,
    args: [{ id: config.notificationId } as any], // Will be fetched in the child workflow
  })
}

// Helper function to determine if a cron rule should execute
async function shouldExecuteRule(
  rule: NotificationRule,
  lastExecution: number | undefined,
  now: number
): Promise<boolean> {
  if (!rule.trigger_config || typeof rule.trigger_config !== 'object') {
    return false
  }

  const config = rule.trigger_config as any
  
  // For cron rules, we need to parse the cron expression
  // In a real implementation, you'd use a cron parser library
  // For now, we'll use a simple interval-based approach
  
  if (!lastExecution) {
    return true // First execution
  }

  // Check if enough time has passed (simplified for demo)
  const interval = parseInterval(config.cron)
  return now - lastExecution >= interval
}

// Parse a simplified cron expression to milliseconds
function parseInterval(cron: string): number {
  // Simplified parsing - in production use a proper cron parser
  if (cron.includes('* * * * *')) return 60 * 1000 // Every minute
  if (cron.includes('*/5 * * * *')) return 5 * 60 * 1000 // Every 5 minutes
  if (cron.includes('0 * * * *')) return 60 * 60 * 1000 // Every hour
  if (cron.includes('0 0 * * *')) return 24 * 60 * 60 * 1000 // Daily
  
  return 60 * 60 * 1000 // Default to hourly
}