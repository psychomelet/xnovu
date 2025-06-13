import { Context } from '@temporalio/activity'
import type { NotificationData } from './supabase'

// In-memory metrics storage (in production, use proper metrics service)
const metrics = {
  notifications: {
    processed: 0,
    failed: 0,
    byType: new Map<string, number>(),
    byEnterprise: new Map<string, number>()
  },
  workflows: {
    triggered: 0,
    failed: 0,
    byKey: new Map<string, number>()
  },
  performance: {
    processingTimes: [] as number[],
    avgProcessingTime: 0
  }
}

// Record notification metrics
export async function recordNotificationMetrics(
  notification: NotificationData,
  success: boolean,
  processingTime?: number
): Promise<void> {
  Context.current().heartbeat()
  
  if (success) {
    metrics.notifications.processed++
  } else {
    metrics.notifications.failed++
  }

  // Track by enterprise
  const enterpriseCount = metrics.notifications.byEnterprise.get(notification.enterpriseId) || 0
  metrics.notifications.byEnterprise.set(notification.enterpriseId, enterpriseCount + 1)

  // Track processing time
  if (processingTime !== undefined) {
    metrics.performance.processingTimes.push(processingTime)
    
    // Keep only last 1000 entries
    if (metrics.performance.processingTimes.length > 1000) {
      metrics.performance.processingTimes.shift()
    }
    
    // Calculate average
    const sum = metrics.performance.processingTimes.reduce((a, b) => a + b, 0)
    metrics.performance.avgProcessingTime = sum / metrics.performance.processingTimes.length
  }
}

// Record workflow metrics
export async function recordWorkflowMetrics(
  workflowKey: string,
  success: boolean
): Promise<void> {
  Context.current().heartbeat()
  
  if (success) {
    metrics.workflows.triggered++
  } else {
    metrics.workflows.failed++
  }

  const count = metrics.workflows.byKey.get(workflowKey) || 0
  metrics.workflows.byKey.set(workflowKey, count + 1)
}

// Get current metrics
export async function getMetrics(): Promise<any> {
  Context.current().heartbeat()
  
  return {
    notifications: {
      processed: metrics.notifications.processed,
      failed: metrics.notifications.failed,
      byType: Object.fromEntries(metrics.notifications.byType),
      byEnterprise: Object.fromEntries(metrics.notifications.byEnterprise)
    },
    workflows: {
      triggered: metrics.workflows.triggered,
      failed: metrics.workflows.failed,
      byKey: Object.fromEntries(metrics.workflows.byKey)
    },
    performance: {
      avgProcessingTime: Math.round(metrics.performance.avgProcessingTime),
      samples: metrics.performance.processingTimes.length
    }
  }
}

// Reset metrics (for testing)
export async function resetMetrics(): Promise<void> {
  Context.current().heartbeat()
  
  metrics.notifications.processed = 0
  metrics.notifications.failed = 0
  metrics.notifications.byType.clear()
  metrics.notifications.byEnterprise.clear()
  
  metrics.workflows.triggered = 0
  metrics.workflows.failed = 0
  metrics.workflows.byKey.clear()
  
  metrics.performance.processingTimes = []
  metrics.performance.avgProcessingTime = 0
}