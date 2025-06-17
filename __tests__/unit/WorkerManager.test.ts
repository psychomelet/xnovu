/**
 * Unit tests for WorkerManager (simplified temporal architecture)
 */

import { WorkerManager } from '@/worker/services/WorkerManager'
import type { WorkerConfig } from '@/worker/types/worker'
import { NotificationPollingLoop } from '@/lib/polling/polling-loop'

// Mock HealthMonitor
jest.mock('@/worker/services/HealthMonitor', () => ({
  HealthMonitor: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined)
  }))
}))

// Mock NotificationPollingLoop
jest.mock('@/lib/polling/polling-loop', () => ({
  NotificationPollingLoop: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    isRunning: jest.fn().mockReturnValue(true)
  }))
}))

describe('WorkerManager', () => {
  let workerManager: WorkerManager
  let mockConfig: WorkerConfig
  let mockPollingLoop: any

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()

    mockConfig = {
      healthPort: 3001,
      workerManager: null as any // Will be set after creation
    }

    // Setup mock polling loop
    mockPollingLoop = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      getIsRunning: jest.fn().mockReturnValue(true)
    }

    ;(NotificationPollingLoop as jest.Mock).mockImplementation(() => mockPollingLoop)

    workerManager = new WorkerManager(mockConfig)
    mockConfig.workerManager = workerManager
  })

  afterEach(async () => {
    // Ensure proper cleanup after each test
    if (workerManager && workerManager.isRunning()) {
      await workerManager.shutdown()
    }
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(workerManager).toBeDefined()
      expect(workerManager.isRunning()).toBe(false)
    })

    it('should provide health port', () => {
      expect(workerManager.getHealthPort()).toBe(3001)
    })

    it('should initialize with polling loop stopped', () => {
      expect(workerManager.getPollingLoopStatus()).toBe(false)
    })
  })

  describe('start', () => {
    it('should start services and polling loop', async () => {
      await workerManager.start()

      // Verify polling loop was created and started
      expect(NotificationPollingLoop).toHaveBeenCalledWith(expect.objectContaining({
        pollIntervalMs: expect.any(Number),
        failedPollIntervalMs: expect.any(Number),
        scheduledPollIntervalMs: expect.any(Number),
        batchSize: expect.any(Number),
        temporal: expect.objectContaining({
          address: expect.any(String),
          namespace: expect.any(String),
          taskQueue: expect.any(String)
        })
      }))
      expect(mockPollingLoop.start).toHaveBeenCalled()

      expect(workerManager.isRunning()).toBe(true)
    })

    it('should start polling loop for all enterprises', async () => {
      await workerManager.start()

      // Should have polling loop running
      expect(workerManager.getPollingLoopStatus()).toBe(true)
    })

    it('should handle service start errors gracefully', async () => {
      const error = new Error('Polling loop failed to start')
      mockPollingLoop.start.mockRejectedValue(error)

      await expect(workerManager.start()).rejects.toThrow('Polling loop failed to start')
      expect(workerManager.isRunning()).toBe(false)
    })
  })

  describe('getHealthStatus', () => {
    beforeEach(async () => {
      await workerManager.start()
    })

    it('should return health status with polling loop', async () => {
      const healthStatus = await workerManager.getHealthStatus()

      expect(healthStatus).toEqual({
        status: 'healthy',
        uptime: expect.any(Number),
        components: {
          subscriptions: {
            total: 1, // Single polling loop
            active: 1,
            failed: 0,
            reconnecting: 0
          },
          ruleEngine: 'healthy',
          temporal: 'healthy'
        },
        temporal_status: {
          status: 'healthy',
          pollingLoop: 'RUNNING'
        }
      })
    })

    it('should include correct polling loop status', async () => {
      const healthStatus = await workerManager.getHealthStatus()

      // Should always report 1 polling loop (for all enterprises)
      expect(healthStatus.components.subscriptions.total).toBe(1)
      expect(healthStatus.components.subscriptions.active).toBe(1)
    })

    it('should handle polling loop errors in health check', async () => {
      // Mock polling loop to be stopped
      mockPollingLoop.getIsRunning.mockReturnValue(false)

      const healthStatus = await workerManager.getHealthStatus()

      expect(healthStatus.status).toBe('degraded')
      expect(healthStatus.components.subscriptions.failed).toBe(1)
    })
  })

  describe('shutdown', () => {
    beforeEach(async () => {
      await workerManager.start()
    })

    it('should shutdown gracefully and stop polling loop', async () => {
      expect(workerManager.getPollingLoopStatus()).toBe(true)

      await workerManager.shutdown()

      expect(mockPollingLoop.stop).toHaveBeenCalled()
      expect(workerManager.isRunning()).toBe(false)
    })

    it('should handle shutdown errors gracefully', async () => {
      mockPollingLoop.stop.mockRejectedValue(new Error('Stop failed'))

      // Should not throw even if polling loop stop fails
      await expect(workerManager.shutdown()).resolves.toBeUndefined()
      expect(workerManager.isRunning()).toBe(false)
    })

    it('should be idempotent when called multiple times', async () => {
      await workerManager.shutdown()
      await workerManager.shutdown() // Second call should not cause issues

      expect(mockPollingLoop.stop).toHaveBeenCalledTimes(1)
    })
  })

  describe('simplified architecture', () => {
    it('should not require complex configuration', () => {
      // Should work with minimal configuration
      expect(() => new WorkerManager(mockConfig)).not.toThrow()
    })

    it('should always create exactly one polling loop', async () => {
      await workerManager.start()

      expect(workerManager.getPollingLoopStatus()).toBe(true)

      // Verify only one polling loop instance was created
      expect(NotificationPollingLoop).toHaveBeenCalledTimes(1)
    })

    it('should process all enterprises automatically', async () => {
      await workerManager.start()
      
      // The polling loop should be configured to process all enterprises
      expect(NotificationPollingLoop).toHaveBeenCalledWith(expect.objectContaining({
        pollIntervalMs: expect.any(Number),
        failedPollIntervalMs: expect.any(Number),
        scheduledPollIntervalMs: expect.any(Number),
        batchSize: expect.any(Number),
        temporal: expect.objectContaining({
          address: expect.any(String),
          namespace: expect.any(String),
          taskQueue: expect.any(String)
        })
      }))
    })
  })
})