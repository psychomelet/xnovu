import { proxyActivities } from '@temporalio/workflow'
import type * as activities from '../activities'
import type { TriggerResult } from '@/lib/notifications/trigger'

// Create activity proxies with proper timeouts
const {
  triggerNotificationByIdActivity,
  triggerMultipleNotificationsByIdActivity
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5m',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    maximumAttempts: 3,
  },
})

export interface TriggerNotificationWorkflowParams {
  notificationId: number
}

export interface TriggerMultipleNotificationsWorkflowParams {
  notificationIds: number[]
}

/**
 * Workflow to trigger a single notification by ID asynchronously
 */
export async function triggerNotificationWorkflow(
  params: TriggerNotificationWorkflowParams
): Promise<TriggerResult> {
  return await triggerNotificationByIdActivity(params)
}

/**
 * Workflow to trigger multiple notifications by IDs asynchronously
 */
export async function triggerMultipleNotificationsWorkflow(
  params: TriggerMultipleNotificationsWorkflowParams
): Promise<TriggerResult[]> {
  return await triggerMultipleNotificationsByIdActivity(params.notificationIds)
}