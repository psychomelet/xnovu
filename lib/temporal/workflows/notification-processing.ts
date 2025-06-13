import { proxyActivities, sleep } from '@temporalio/workflow'
import type * as activities from '../activities'
import type { NotificationData, WorkflowConfig } from '../activities/supabase'

// Create activity proxies with proper timeouts
const {
  fetchWorkflowConfig,
  fetchTemplates,
  renderTemplates,
  triggerNovuWorkflow,
  triggerStaticWorkflow,
  recordNotificationProcessed,
  recordNotificationError,
  recordNotificationMetrics,
  recordWorkflowMetrics,
  validateWorkflow
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '5m',
    maximumAttempts: 10,
  },
})

export interface ProcessingResult {
  status: 'completed' | 'failed' | 'invalid'
  reason?: string
  processedAt?: number
  transactionId?: string
}

// Main notification processing workflow
export async function notificationProcessingWorkflow(
  notification: NotificationData
): Promise<ProcessingResult> {
  const startTime = Date.now()
  
  try {
    // Validate notification
    if (!notification.workflowId || !notification.enterpriseId) {
      await recordNotificationError(
        notification.id,
        'Invalid notification: missing required fields'
      )
      return {
        status: 'invalid',
        reason: 'Missing workflowId or enterpriseId'
      }
    }

    // Fetch workflow configuration
    const workflowConfig = await fetchWorkflowConfig(notification.workflowId)
    
    // Validate workflow exists
    const isValid = await validateWorkflow(
      workflowConfig.key,
      notification.enterpriseId
    )
    
    if (!isValid) {
      await recordNotificationError(
        notification.id,
        `Workflow not found: ${workflowConfig.key}`
      )
      return {
        status: 'invalid',
        reason: `Workflow not found: ${workflowConfig.key}`
      }
    }

    let result
    
    // Process based on workflow type
    if (workflowConfig.type === 'dynamic') {
      // Fetch and render templates for dynamic workflows
      const templates = await fetchTemplates(workflowConfig.id)
      
      if (templates.length === 0) {
        await recordNotificationError(
          notification.id,
          'No active templates found for dynamic workflow'
        )
        return {
          status: 'failed',
          reason: 'No active templates found'
        }
      }
      
      const rendered = await renderTemplates(templates, notification)
      result = await triggerNovuWorkflow(rendered)
    } else {
      // Trigger static workflow directly
      result = await triggerStaticWorkflow(workflowConfig.key, notification)
    }

    // Check if trigger was successful
    if (!result.success) {
      await recordNotificationError(
        notification.id,
        result.error || 'Failed to trigger workflow'
      )
      
      await recordWorkflowMetrics(workflowConfig.key, false)
      
      return {
        status: 'failed',
        reason: result.error || 'Failed to trigger workflow'
      }
    }

    // Record successful processing
    await recordNotificationProcessed(notification.id)
    
    const processingTime = Date.now() - startTime
    await recordNotificationMetrics(notification, true, processingTime)
    await recordWorkflowMetrics(workflowConfig.key, true)
    
    return {
      status: 'completed',
      processedAt: Date.now(),
      transactionId: result.transactionId
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await recordNotificationError(notification.id, errorMessage)
    await recordNotificationMetrics(notification, false)
    
    throw error // Re-throw to let Temporal handle retries
  }
}

// Batch notification processing workflow
export async function batchNotificationProcessingWorkflow(
  notifications: NotificationData[]
): Promise<ProcessingResult[]> {
  const results: ProcessingResult[] = []
  
  // Process notifications in parallel batches
  const batchSize = 10
  for (let i = 0; i < notifications.length; i += batchSize) {
    const batch = notifications.slice(i, i + batchSize)
    
    const batchResults = await Promise.all(
      batch.map(notification => 
        notificationProcessingWorkflow(notification).catch(error => ({
          status: 'failed' as const,
          reason: error.message
        }))
      )
    )
    
    results.push(...batchResults)
    
    // Add small delay between batches to prevent overwhelming the system
    if (i + batchSize < notifications.length) {
      await sleep('100ms')
    }
  }
  
  return results
}