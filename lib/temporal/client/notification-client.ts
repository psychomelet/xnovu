import { v4 as uuidv4 } from 'uuid'
import { getTemporalClient } from './index'
import { notificationTriggerWorkflow, triggerMultipleNotificationsWorkflow } from '../workflows'
import type { TriggerResult } from '@/lib/notifications/trigger'

export interface AsyncTriggerOptions {
  workflowId?: string
  taskQueue?: string
}

export class NotificationClient {
  private taskQueue: string

  constructor(taskQueue?: string) {
    this.taskQueue = taskQueue || process.env.TEMPORAL_TASK_QUEUE || 'xnovu-notifications'
  }

  /**
   * Trigger a notification asynchronously using Temporal workflow
   */
  async asyncTriggerNotificationById(
    notificationId: number,
    options?: AsyncTriggerOptions
  ): Promise<{ workflowId: string; runId: string }> {
    const client = await getTemporalClient()
    
    const workflowId = options?.workflowId || `trigger-notification-${notificationId}-${uuidv4()}`
    const taskQueue = options?.taskQueue || this.taskQueue

    const handle = await client.start(notificationTriggerWorkflow, {
      args: [{ notificationId }],
      taskQueue,
      workflowId,
    })

    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
    }
  }

  /**
   * Trigger multiple notifications asynchronously using Temporal workflow
   */
  async asyncTriggerMultipleNotifications(
    notificationIds: number[],
    options?: AsyncTriggerOptions
  ): Promise<{ workflowId: string; runId: string }> {
    const client = await getTemporalClient()
    
    const workflowId = options?.workflowId || `trigger-multiple-notifications-${uuidv4()}`
    const taskQueue = options?.taskQueue || this.taskQueue

    const handle = await client.start(triggerMultipleNotificationsWorkflow, {
      args: [{ notificationIds }],
      taskQueue,
      workflowId,
    })

    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
    }
  }

  /**
   * Get the result of a notification trigger workflow
   */
  async getWorkflowResult<T = TriggerResult | TriggerResult[]>(
    workflowId: string
  ): Promise<T> {
    const client = await getTemporalClient()
    const handle = client.getHandle(workflowId)
    return await handle.result()
  }

  /**
   * Query the status of a notification trigger workflow
   */
  async getWorkflowStatus(workflowId: string): Promise<{
    status: string
    historyLength: number
    isRunning: boolean
  }> {
    const client = await getTemporalClient()
    const handle = client.getHandle(workflowId)
    
    try {
      const description = await handle.describe()
      return {
        status: description.status.name,
        historyLength: description.historyLength,
        isRunning: description.status.name === 'RUNNING'
      }
    } catch (error) {
      throw new Error(`Failed to get workflow status: ${error}`)
    }
  }

  /**
   * Cancel a notification trigger workflow
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    const client = await getTemporalClient()
    const handle = client.getHandle(workflowId)
    await handle.cancel()
  }
}

// Export a default instance
export const notificationClient = new NotificationClient()