/**
 * @jest-environment node
 */

import { SubscriptionManager } from '../../app/services/realtime/SubscriptionManager'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

import { Novu } from '@novu/api'

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
    // Use test defaults for unit tests
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
      const originalKey = process.env.NOVU_SECRET_KEY
      delete process.env.NOVU_SECRET_KEY
      
      expect(() => {
        new SubscriptionManager({
          enterpriseId: 'test-enterprise'
        })
      }).toThrow('NOVU_SECRET_KEY environment variable is required')
      
      // Restore the original key
      if (originalKey) {
        process.env.NOVU_SECRET_KEY = originalKey
      }
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
    it('should be unhealthy when inactive', () => {
      // Unit test - service starts inactive
      expect(subscriptionManager.isHealthy()).toBe(false)
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
      const addToQueueMethod = (subscriptionManager as any).addToQueue.bind(subscriptionManager)
      addToQueueMethod(mockNotification)
      
      const metrics = subscriptionManager.getMetrics()
      
      expect(metrics.queueLength).toBe(1)
      expect(metrics.activeProcessing).toBe(0)
      expect(metrics.oldestQueueItem).toBeInstanceOf(Date)
      
      // Health check depends on both queue size AND whether service is active
      // The metrics.isHealthy reflects the current state based on queue and activity
      const currentMetrics = subscriptionManager.getMetrics()
      
      // With 1 item in queue and service not active, it should be unhealthy
      // (because isActive is false by default until subscription is established)
      expect(currentMetrics.isHealthy).toBe(false)
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
    it('should initialize in inactive state', () => {
      const status = subscriptionManager.getStatus()
      expect(status.isActive).toBe(false)
      expect(status.queueLength).toBe(0)
      expect(status.activeProcessing).toBe(0)
      expect(status.isShuttingDown).toBe(false)
    })

    it('should set shutting down flag on stop', async () => {
      await subscriptionManager.stop()
      
      const stoppedStatus = subscriptionManager.getStatus()
      expect(stoppedStatus.isActive).toBe(false)
      expect(stoppedStatus.isShuttingDown).toBe(true)
    })
  })
})

