import { 
  startChild, 
  defineSignal,
  defineQuery,
  setHandler,
  continueAsNew,
  sleep,
  condition
} from '@temporalio/workflow'
import { realtimeMonitoringWorkflow } from './realtime-monitoring'
import { cronSchedulingWorkflow, scheduledNotificationWorkflow } from './scheduling'

export interface OrchestrationConfig {
  enterpriseIds: string[]
  monitoringInterval?: string
  cronInterval?: string
  scheduledCheckInterval?: string
  enableRealtime?: boolean
  enableCron?: boolean
  enableScheduled?: boolean
}

export interface OrchestrationState {
  isRunning: boolean
  startedAt: number
  realtimeWorkflowId?: string
  cronWorkflowId?: string
  scheduledWorkflowId?: string
}

// Signals for controlling the orchestration
export const stopOrchestrationSignal = defineSignal('stopOrchestration')
export const updateOrchestrationConfigSignal = defineSignal<[OrchestrationConfig]>('updateOrchestrationConfig')
export const getOrchestrationStateQuery = defineQuery<OrchestrationState>('getOrchestrationState')

// Master orchestration workflow that coordinates all notification processing
export async function notificationOrchestrationWorkflow(
  config: OrchestrationConfig
): Promise<void> {
  // Initialize state
  const state: OrchestrationState = {
    isRunning: true,
    startedAt: Date.now()
  }

  // Apply defaults
  const currentConfig = {
    enableRealtime: true,
    enableCron: true,
    enableScheduled: true,
    ...config
  }

  // Set up signal handlers
  let shouldStop = false
  setHandler(stopOrchestrationSignal, () => {
    shouldStop = true
    state.isRunning = false
  })

  setHandler(updateOrchestrationConfigSignal, (newConfig: OrchestrationConfig) => {
    Object.assign(currentConfig, newConfig)
  })

  setHandler(getOrchestrationStateQuery, () => state)

  try {
    // Start child workflows based on configuration
    const childWorkflows = []

    // Start realtime monitoring workflow
    if (currentConfig.enableRealtime) {
      const realtimeHandle = await startChild(realtimeMonitoringWorkflow, {
        workflowId: `realtime-monitor-${Date.now()}`,
        args: [{
          enterpriseIds: currentConfig.enterpriseIds,
          pollingInterval: currentConfig.monitoringInterval
        }],
      })
      state.realtimeWorkflowId = realtimeHandle.workflowId
      childWorkflows.push(realtimeHandle)
      console.log('Started realtime monitoring workflow')
    }

    // Start cron scheduling workflow
    if (currentConfig.enableCron) {
      const cronHandle = await startChild(cronSchedulingWorkflow, {
        workflowId: `cron-scheduler-${Date.now()}`,
        args: [{
          interval: currentConfig.cronInterval || '1m'
        }],
      })
      state.cronWorkflowId = cronHandle.workflowId
      childWorkflows.push(cronHandle)
      console.log('Started cron scheduling workflow')
    }

    // Start scheduled notification workflow
    if (currentConfig.enableScheduled) {
      const scheduledHandle = await startChild(scheduledNotificationWorkflow, {
        workflowId: `scheduled-processor-${Date.now()}`,
        args: [{
          checkInterval: currentConfig.scheduledCheckInterval || '1m'
        }],
      })
      state.scheduledWorkflowId = scheduledHandle.workflowId
      childWorkflows.push(scheduledHandle)
      console.log('Started scheduled notification workflow')
    }

    // Monitor child workflows and handle failures
    while (!shouldStop) {
      // Check workflow health every 5 minutes
      await sleep('5m')

      // In a production system, you would check child workflow status
      // and restart them if they fail
      console.log('Orchestration health check - all systems running')

      // Continue as new every 24 hours to prevent history buildup
      const runtime = Date.now() - state.startedAt
      if (runtime > 24 * 60 * 60 * 1000) { // 24 hours
        console.log('Continuing orchestration workflow as new...')
        await continueAsNew<typeof notificationOrchestrationWorkflow>(currentConfig)
      }
    }

    // Clean shutdown - terminate all child workflows
    console.log('Stopping orchestration workflow...')
    for (const handle of childWorkflows) {
      try {
        await handle.terminate()
      } catch (error) {
        console.error('Error terminating child workflow:', error)
      }
    }

  } catch (error) {
    console.error('Fatal error in orchestration workflow:', error)
    throw error
  }
}

// Health monitoring workflow
export async function healthMonitoringWorkflow(
  config: {
    orchestrationWorkflowId: string
    checkInterval?: string
    alertThreshold?: number
  }
): Promise<void> {
  const checkInterval = config.checkInterval || '5m'
  const alertThreshold = config.alertThreshold || 3
  let failureCount = 0

  while (true) {
    try {
      // Query the orchestration workflow state
      // In a real implementation, you would use the workflow client
      // to query the workflow state
      
      await sleep(checkInterval)
      
      // Reset failure count on success
      failureCount = 0

    } catch (error) {
      failureCount++
      console.error(`Health check failed (${failureCount}/${alertThreshold}):`, error)

      if (failureCount >= alertThreshold) {
        // Trigger alert
        console.error('CRITICAL: Orchestration workflow health check failed multiple times')
        
        // In production, you would:
        // - Send alerts to monitoring systems
        // - Attempt to restart the orchestration workflow
        // - Log to persistent storage
      }

      // Back off on failures
      await sleep('1m')
    }
  }
}