import { getTemporalClient } from './client'
import { startWorker } from './worker'
import { Worker } from '@temporalio/worker'

export interface TemporalServiceConfig {
  enterpriseIds: string[]
}

export class TemporalService {
  private config: TemporalServiceConfig
  private worker: Worker | null = null
  private isRunning = false

  constructor(config?: Partial<TemporalServiceConfig>) {
    this.config = {
      enterpriseIds: process.env.ENTERPRISE_IDS?.split(',') || [],
      ...config
    }
  }

  async initialize(): Promise<void> {
    console.log('Initializing Temporal service...')
    
    try {
      // Start the Temporal worker
      this.worker = await startWorker()
      this.isRunning = true
      
      console.log('✅ Temporal service initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize Temporal service:', error)
      throw error
    }
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Temporal service...')
    
    try {
      if (this.worker) {
        await this.worker.shutdown()
        this.worker = null
      }
      
      this.isRunning = false
      console.log('✅ Temporal service shut down successfully')
    } catch (error) {
      console.error('❌ Error shutting down Temporal service:', error)
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
      console.error('Error getting Temporal metrics:', error)
      return null
    }
  }

  isEnabled(): boolean {
    return true // Always enabled now
  }

  getConfig(): TemporalServiceConfig {
    return { ...this.config }
  }
}

// Export singleton instance
export const temporalService = new TemporalService()