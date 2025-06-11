/**
 * @jest-environment node
 */

import { SubscriptionManager } from '../app/services/realtime/SubscriptionManager'

// Mock Supabase
jest.mock('../lib/supabase/client', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn((callback) => {
          callback('SUBSCRIBED')
          return Promise.resolve()
        })
      }))
    })),
    removeChannel: jest.fn(),
    schema: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ 
                  data: mockWorkflow, 
                  error: null 
                }))
              }))
            }))
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: mockNotification, error: null })),
            is: jest.fn(() => Promise.resolve({ data: mockNotification, error: null }))
          }))
        }))
      }))
    }))
  }
}))

// Mock Novu
jest.mock('@novu/api', () => ({
  Novu: jest.fn(() => ({
    trigger: jest.fn(() => Promise.resolve({
      transactionId: 'test-transaction-id'
    }))
  }))
}))

const mockNotification = {
  id: 1,
  name: 'test-notification',
  enterprise_id: 'test-enterprise',
  notification_workflow_id: 1,
  recipients: ['12345678-1234-5234-9234-123456789012'],
  payload: { message: 'test' },
  notification_status: 'PENDING' as const,
  channels: ['EMAIL' as const],
  overrides: null,
  tags: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

const mockWorkflow = {
  id: 1,
  workflow_key: 'test-workflow',
  enterprise_id: 'test-enterprise',
  deactivated: false
}

describe('SubscriptionManager', () => {
  let subscriptionManager: SubscriptionManager
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up environment variables
    process.env.NOVU_SECRET_KEY = 'test-secret-key'
    
    subscriptionManager = new SubscriptionManager({
      enterpriseId: 'test-enterprise'
    })
  })

  afterEach(async () => {
    if (subscriptionManager) {
      await subscriptionManager.stop()
    }
  })

  describe('Constructor', () => {
    it('should throw error when NOVU_SECRET_KEY is missing', () => {
      delete process.env.NOVU_SECRET_KEY
      
      expect(() => {
        new SubscriptionManager({
          enterpriseId: 'test-enterprise'
        })
      }).toThrow('NOVU_SECRET_KEY environment variable is required')
    })

    it('should initialize with default config', () => {
      const manager = new SubscriptionManager({
        enterpriseId: 'test-enterprise'
      })
      
      const status = manager.getStatus()
      expect(status.isActive).toBe(false)
      expect(status.queueLength).toBe(0)
      expect(status.activeProcessing).toBe(0)
    })

    it('should accept custom queue config', () => {
      const manager = new SubscriptionManager({
        enterpriseId: 'test-enterprise',
        queueConfig: {
          maxConcurrent: 10,
          retryAttempts: 5,
          retryDelay: 2000,
          maxQueueSize: 500
        }
      })
      
      expect(manager).toBeDefined()
    })
  })

  describe('Recipient Validation', () => {
    it('should validate UUID format correctly', async () => {
      const validUUIDs = [
        '12345678-1234-5234-9234-123456789012',
        'a1b2c3d4-e5f6-5234-9901-abcdef123456'
      ]
      
      // Use reflection to access private method for testing
      const validateMethod = (subscriptionManager as any).validateAndConvertRecipients.bind(subscriptionManager)
      
      expect(() => {
        validateMethod(validUUIDs)
      }).not.toThrow()
    })

    it('should reject invalid UUID formats', () => {
      const invalidUUIDs = [
        'invalid-uuid',
        '12345678-1234-1234-1234',
        'not-a-uuid-at-all'
      ]
      
      const validateMethod = (subscriptionManager as any).validateAndConvertRecipients.bind(subscriptionManager)
      
      invalidUUIDs.forEach(invalidUUID => {
        expect(() => {
          validateMethod([invalidUUID])
        }).toThrow(/Invalid UUID format/)
      })
    })

    it('should reject non-string recipients', () => {
      const validateMethod = (subscriptionManager as any).validateAndConvertRecipients.bind(subscriptionManager)
      
      expect(() => {
        validateMethod([123, null, undefined])
      }).toThrow(/Invalid recipient type/)
    })
  })

  describe('Queue Management', () => {
    it('should add notifications to queue', () => {
      const addToQueueMethod = (subscriptionManager as any).addToQueue.bind(subscriptionManager)
      
      addToQueueMethod(mockNotification)
      
      const status = subscriptionManager.getStatus()
      expect(status.queueLength).toBe(1)
    })

    it('should respect queue size limits', () => {
      const manager = new SubscriptionManager({
        enterpriseId: 'test-enterprise',
        queueConfig: { maxQueueSize: 2 }
      })
      
      const addToQueueMethod = (manager as any).addToQueue.bind(manager)
      
      // Add notifications up to the limit
      addToQueueMethod(mockNotification)
      addToQueueMethod(mockNotification)
      addToQueueMethod(mockNotification) // This should be dropped
      
      const status = manager.getStatus()
      expect(status.queueLength).toBe(2) // Should not exceed limit
    })

    it('should clear queue when requested', () => {
      const addToQueueMethod = (subscriptionManager as any).addToQueue.bind(subscriptionManager)
      
      addToQueueMethod(mockNotification)
      addToQueueMethod(mockNotification)
      
      expect(subscriptionManager.getStatus().queueLength).toBe(2)
      
      subscriptionManager.clearQueue()
      
      expect(subscriptionManager.getStatus().queueLength).toBe(0)
    })
  })

  describe('Health Checks', () => {
    it('should be healthy with normal queue when active', async () => {
      await subscriptionManager.start()
      expect(subscriptionManager.isHealthy()).toBe(true)
      await subscriptionManager.stop()
    })

    it('should be unhealthy with full queue', () => {
      const manager = new SubscriptionManager({
        enterpriseId: 'test-enterprise',
        queueConfig: { maxQueueSize: 10 }
      })
      
      const addToQueueMethod = (manager as any).addToQueue.bind(manager)
      
      // Fill queue to 90% (9 out of 10)
      for (let i = 0; i < 9; i++) {
        addToQueueMethod(mockNotification)
      }
      
      expect(manager.isHealthy()).toBe(false)
    })
  })

  describe('Metrics', () => {
    it('should provide accurate metrics', async () => {
      await subscriptionManager.start()
      
      const addToQueueMethod = (subscriptionManager as any).addToQueue.bind(subscriptionManager)
      
      addToQueueMethod(mockNotification)
      
      const metrics = subscriptionManager.getMetrics()
      
      expect(metrics.queueLength).toBe(1)
      expect(metrics.activeProcessing).toBe(0)
      expect(metrics.isHealthy).toBe(true)
      expect(metrics.oldestQueueItem).toBeInstanceOf(Date)
      
      await subscriptionManager.stop()
    })

    it('should handle empty queue metrics', () => {
      const metrics = subscriptionManager.getMetrics()
      
      expect(metrics.queueLength).toBe(0)
      expect(metrics.activeProcessing).toBe(0)
      expect(metrics.oldestQueueItem).toBeUndefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle custom error callbacks', () => {
      const mockErrorHandler = jest.fn()
      
      const manager = new SubscriptionManager({
        enterpriseId: 'test-enterprise',
        onError: mockErrorHandler
      })
      
      const error = new Error('Test error')
      const handleErrorMethod = (manager as any).handleError.bind(manager)
      
      handleErrorMethod(error)
      
      expect(mockErrorHandler).toHaveBeenCalledWith(error)
    })

    it('should use default error handling when no callback provided', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const error = new Error('Test error')
      const handleErrorMethod = (subscriptionManager as any).handleError.bind(subscriptionManager)
      
      handleErrorMethod(error)
      
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  describe('Lifecycle Management', () => {
    it('should start and stop cleanly', async () => {
      await subscriptionManager.start()
      
      const status = subscriptionManager.getStatus()
      expect(status.isActive).toBe(true)
      
      await subscriptionManager.stop()
      
      const stoppedStatus = subscriptionManager.getStatus()
      expect(stoppedStatus.isActive).toBe(false)
      expect(stoppedStatus.isShuttingDown).toBe(true)
    })

    it('should handle multiple start calls gracefully', async () => {
      const logSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      await subscriptionManager.start()
      await subscriptionManager.start() // Second call should warn
      
      expect(logSpy).toHaveBeenCalled()
      
      logSpy.mockRestore()
    })
  })
})

// Integration-style test for basic flow
describe('SubscriptionManager Integration', () => {
  it('should handle notification processing flow', async () => {
    process.env.NOVU_SECRET_KEY = 'test-secret-key'
    
    const mockOnNotification = jest.fn()
    
    const manager = new SubscriptionManager({
      enterpriseId: 'test-enterprise',
      onNotification: mockOnNotification
    })
    
    // No need to override mock here as it's already set up globally
    
    // Add notification to queue and process
    const addToQueueMethod = (manager as any).addToQueue.bind(manager)
    addToQueueMethod(mockNotification)
    
    // Process the notification
    const queueItem = {
      notification: mockNotification,
      attempts: 0,
      addedAt: new Date()
    }
    
    const processMethod = (manager as any).processNotification.bind(manager)
    
    await expect(processMethod(queueItem)).resolves.not.toThrow()
    
    await manager.stop()
  })
})