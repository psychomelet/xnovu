/**
 * Unit tests for WorkerManager (enterprise ID removal changes)
 */

import { WorkerManager } from '@/worker/services/WorkerManager'
import type { WorkerConfig } from '@/worker/types/worker'
import { temporalService } from '@/lib/temporal/service'
import { getTemporalClient } from '@/lib/temporal/client'

// Mock the temporal service and client
jest.mock('@/lib/temporal/service', () => ({
  temporalService: {
    initialize: jest.fn(),
    start: jest.fn(),
    shutdown: jest.fn()
  }
}))

jest.mock('@/lib/temporal/client', () => ({
  getTemporalClient: jest.fn()
}))

// Mock the orchestration workflow
jest.mock('@/lib/temporal/workflows/orchestration', () => ({
  notificationOrchestrationWorkflow: jest.fn()
}))

describe('WorkerManager', () => {
  let workerManager: WorkerManager
  let mockConfig: WorkerConfig
  let mockTemporalClient: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockConfig = {
      healthPort: 3001,
      workerManager: null as any // Will be set after creation
    }

    // Setup mock temporal client
    mockTemporalClient = {
      start: jest.fn().mockResolvedValue({
        workflowId: 'mock-workflow-id',
        firstExecutionRunId: 'mock-run-id'
      }),
      getHandle: jest.fn().mockReturnValue({
        describe: jest.fn().mockResolvedValue({
          status: { name: 'RUNNING' },
          historyLength: 5
        }),
        cancel: jest.fn()
      })
    }

    ;(getTemporalClient as jest.Mock).mockResolvedValue(mockTemporalClient)
    ;(temporalService.initialize as jest.Mock).mockResolvedValue(undefined)
    ;(temporalService.start as jest.Mock).mockResolvedValue(undefined)
    ;(temporalService.shutdown as jest.Mock).mockResolvedValue(undefined)

    workerManager = new WorkerManager(mockConfig)
    mockConfig.workerManager = workerManager
  })

  describe('initialization', () => {
    it('should initialize without enterprise IDs', () => {
      expect(workerManager).toBeDefined()
      expect(workerManager.isRunning()).toBe(false)
    })

    it('should provide health port', () => {
      expect(workerManager.getHealthPort()).toBe(3001)
    })

    it('should initialize with null polling workflow ID', () => {
      expect(workerManager.getPollingWorkflowId()).toBeNull()
    })
  })

  describe('start', () => {
    it('should start services and create single polling workflow', async () => {
      await workerManager.start()

      // Verify temporal service was initialized and started
      expect(temporalService.initialize).toHaveBeenCalled()
      expect(temporalService.start).toHaveBeenCalled()

      // Verify orchestration workflow was started
      expect(mockTemporalClient.start).toHaveBeenCalledWith(
        expect.any(Function), // notificationOrchestrationWorkflow
        expect.objectContaining({
          workflowId: expect.stringMatching(/^orchestration-\d+$/),
          taskQueue: expect.any(String)
        })
      )

      expect(workerManager.isRunning()).toBe(true)
    })

    it('should start single polling workflow for all enterprises', async () => {
      await workerManager.start()

      // Should have one polling workflow ID set
      const pollingWorkflowId = workerManager.getPollingWorkflowId()
      expect(pollingWorkflowId).toMatch(/^notification-polling-all-\d+$/)
    })

    it('should handle service start errors gracefully', async () => {
      const error = new Error('Temporal service failed to start')
      ;(temporalService.start as jest.Mock).mockRejectedValue(error)

      await expect(workerManager.start()).rejects.toThrow('Temporal service failed to start')
      expect(workerManager.isRunning()).toBe(false)
    })
  })

  describe('getHealthStatus', () => {
    beforeEach(async () => {
      await workerManager.start()
    })

    it('should return health status with single polling workflow', async () => {
      const healthStatus = await workerManager.getHealthStatus()

      expect(healthStatus).toEqual({
        status: 'healthy',
        uptime: expect.any(Number),
        components: {
          temporal: { status: 'healthy' },
          subscriptions: {
            total: 1, // Single polling workflow
            active: 1,
            failed: 0,
            reconnecting: 0
          }
        }
      })
    })

    it('should include correct polling workflow count regardless of enterprises', async () => {
      const healthStatus = await workerManager.getHealthStatus()

      // Should always report 1 polling workflow (for all enterprises)
      expect(healthStatus.components.subscriptions.total).toBe(1)
      expect(healthStatus.components.subscriptions.active).toBe(1)
    })

    it('should handle temporal client errors in health check', async () => {
      // Mock temporal client to throw error
      ;(getTemporalClient as jest.Mock).mockRejectedValue(new Error('Connection failed'))

      const healthStatus = await workerManager.getHealthStatus()

      expect(healthStatus.status).toBe('degraded')
      expect(healthStatus.components.subscriptions.failed).toBe(1)
    })
  })

  describe('shutdown', () => {
    beforeEach(async () => {
      await workerManager.start()
    })

    it('should shutdown gracefully and cancel polling workflow', async () => {
      const pollingWorkflowId = workerManager.getPollingWorkflowId()
      expect(pollingWorkflowId).not.toBeNull()

      await workerManager.shutdown()

      expect(temporalService.shutdown).toHaveBeenCalled()
      expect(workerManager.isRunning()).toBe(false)
    })

    it('should handle shutdown errors gracefully', async () => {
      ;(temporalService.shutdown as jest.Mock).mockRejectedValue(new Error('Shutdown failed'))

      // Should not throw even if temporal shutdown fails
      await expect(workerManager.shutdown()).resolves.toBeUndefined()
      expect(workerManager.isRunning()).toBe(false)
    })

    it('should be idempotent when called multiple times', async () => {
      await workerManager.shutdown()
      await workerManager.shutdown() // Second call should not cause issues

      expect(temporalService.shutdown).toHaveBeenCalledTimes(1)
    })
  })

  describe('enterprise ID independence', () => {
    it('should not require enterprise ID configuration', () => {
      // Should work without any enterprise-specific configuration
      expect(() => new WorkerManager(mockConfig)).not.toThrow()
    })

    it('should always create exactly one polling workflow', async () => {
      await workerManager.start()

      const pollingWorkflowId = workerManager.getPollingWorkflowId()
      expect(pollingWorkflowId).not.toBeNull()
      expect(pollingWorkflowId).toMatch(/^notification-polling-all-\d+$/)

      // Verify only one workflow start call for polling
      const pollingCalls = mockTemporalClient.start.mock.calls.filter(call => 
        call[1]?.workflowId?.includes('notification-polling-all')
      )
      expect(pollingCalls).toHaveLength(1)
    })

    it('should process all enterprises automatically', async () => {
      await workerManager.start()
      
      // The polling workflow should be configured to process all enterprises
      // This is verified by the workflow ID pattern and the fact that no
      // enterprise-specific parameters are passed
      const pollingWorkflowCall = mockTemporalClient.start.mock.calls.find(call => 
        call[1]?.workflowId?.includes('notification-polling-all')
      )
      
      expect(pollingWorkflowCall).toBeDefined()
      // Workflow should be started without enterprise-specific arguments
      expect(pollingWorkflowCall[1].args).toEqual([{}])
    })
  })
})