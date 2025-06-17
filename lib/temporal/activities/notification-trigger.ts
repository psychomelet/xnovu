import { Context } from '@temporalio/activity'
import { triggerNotificationById as triggerNotificationByIdSync, type TriggerResult } from '@/lib/notifications/trigger'

export interface TriggerNotificationParams {
  notificationId: number
}

export async function triggerNotificationByIdActivity(
  params: TriggerNotificationParams
): Promise<TriggerResult> {
  const { notificationId } = params
  
  // Send heartbeats for long-running activities
  Context.current().heartbeat()
  
  try {
    console.log(`[Temporal Activity] Triggering notification ${notificationId}`)
    
    // Call the synchronous trigger function
    const result = await triggerNotificationByIdSync(notificationId)
    
    console.log(`[Temporal Activity] Notification ${notificationId} trigger result:`, {
      success: result.success,
      status: result.status,
      transactionId: result.novuTransactionId
    })
    
    return result
  } catch (error) {
    console.error(`[Temporal Activity] Error triggering notification ${notificationId}:`, error)
    throw error
  }
}

export async function triggerMultipleNotificationsByIdActivity(
  notificationIds: number[]
): Promise<TriggerResult[]> {
  const results: TriggerResult[] = []
  
  for (const notificationId of notificationIds) {
    Context.current().heartbeat()
    
    try {
      const result = await triggerNotificationByIdSync(notificationId)
      results.push(result)
    } catch (error) {
      results.push({
        success: false,
        notificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
  
  return results
}