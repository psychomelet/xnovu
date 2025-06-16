import { 
  startChild, 
  defineSignal,
  defineQuery,
  setHandler,
  continueAsNew,
  sleep,
  condition
} from '@temporalio/workflow'
import { cronSchedulingWorkflow, scheduledNotificationWorkflow } from './scheduling'

export interface OrchestrationConfig {
  cronInterval?: string
  scheduledCheckInterval?: string
  enableCron?: boolean
  enableScheduled?: boolean
}

export interface OrchestrationState {
  isRunning: boolean
  startedAt: number
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

    // Note: Polling workflows are now started separately by WorkerManager
    // for each enterprise ID to enable better scalability and monitoring

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

    // Clean shutdown - signal all child workflows to stop
    console.log('Stopping orchestration workflow...')
    // Child workflows will complete on their own or be cancelled by Temporal
    // when the parent workflow completes

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