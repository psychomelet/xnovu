import { getTemporalClient } from './client'
import { createWorker } from './worker'
import { Worker } from '@temporalio/worker'
import { logger } from '@/app/services/logger'

export class TemporalService {
  private worker: Worker | null = null
  private isRunning = false

  constructor() {}

  async initialize(): Promise<void> {
    logger.temporal('Initializing Temporal service...')
    
    try {
      // Create the Temporal worker
      this.worker = await createWorker()
      
      // Start the worker in the background
      this.worker.run().catch(error => {
        logger.error('Worker stopped unexpectedly', error as Error)
        this.isRunning = false
      })
      
      this.isRunning = true
      
      logger.temporal('Temporal service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize Temporal service', error as Error)
      throw error
    }
  }

  async shutdown(): Promise<void> {
    logger.temporal('Shutting down Temporal service...')
    
    try {
      if (this.worker) {
        await this.worker.shutdown()
        this.worker = null
      }
      
      this.isRunning = false
      logger.temporal('Temporal service shut down successfully')
    } catch (error) {
      logger.error('Error shutting down Temporal service', error as Error)
      throw error
    }
  }

  async getHealth(): Promise<{
    status: 'healthy' | 'unhealthy' | 'disabled'
    details?: any
  }> {
    try {
      if (!this.isRunning || !this.worker) {
        return { status: 'unhealthy', details: { reason: 'Worker not running' } }
      }

      // Check if we can connect to Temporal
      const client = await getTemporalClient()
      const namespaceInfo = await client.workflowService.describeNamespace({
        namespace: process.env.TEMPORAL_NAMESPACE || 'default'
      })

      return {
        status: 'healthy',
        details: {
          namespace: namespaceInfo.namespaceInfo?.name,
          worker: {
            running: this.isRunning,
            taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'xnovu-notification-processing'
          }
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  async getMetrics(): Promise<any> {
    try {
      const client = await getTemporalClient()
      
      // Get workflow execution count
      const listResult = await client.workflowService.listWorkflowExecutions({
        namespace: process.env.TEMPORAL_NAMESPACE || 'default',
        pageSize: 1,
        query: 'WorkflowType="masterOrchestrationWorkflow"'
      })

      return {
        temporal: {
          enabled: true,
          workflows: {
            orchestration: listResult.executions.length > 0 ? 'running' : 'not_started',
            taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'xnovu-notification-processing'
          }
        }
      }
    } catch (error) {
      logger.error('Error getting Temporal metrics', error as Error)
      return null
    }
  }

  isEnabled(): boolean {
    return true // Always enabled now
  }
}

// Export singleton instance
export const temporalService = new TemporalService()