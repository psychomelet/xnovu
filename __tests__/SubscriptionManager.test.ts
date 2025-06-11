/**
 * @jest-environment node
 */

import { SubscriptionManager } from '../app/services/realtime/SubscriptionManager'
import { supabase } from '../lib/supabase/client'
import { Novu } from '@novu/api'

// Using real cloud services - no mocks
// This test creates temporary test data in your Supabase instance

const TEST_ENTERPRISE_ID = 'test-enterprise-' + Date.now()
const TEST_WORKFLOW_KEY = 'test-workflow-' + Date.now()

describe('SubscriptionManager', () => {
  let subscriptionManager: SubscriptionManager
  let testWorkflowId: number
  let testNotificationId: number
  
  beforeAll(async () => {
    // Create test workflow in Supabase
    const { data: workflow, error: workflowError } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .insert({
        workflow_key: TEST_WORKFLOW_KEY,
        workflow_name: 'Test Workflow',
        enterprise_id: TEST_ENTERPRISE_ID,
        workflow_type: 'STATIC',
        deactivated: false
      })
      .select()
      .single()

    if (workflowError) {
      console.error('Failed to create test workflow:', workflowError)
      throw workflowError
    }

    testWorkflowId = workflow.id
  })

  afterAll(async () => {
    // Clean up test data
    if (testNotificationId) {
      await supabase
        .schema('notify')
        .from('ent_notification')
        .delete()
        .eq('id', testNotificationId)
    }

    if (testWorkflowId) {
      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('id', testWorkflowId)
    }
  })
  
  beforeEach(() => {
    // Set up environment variables are already loaded from .env.local
    subscriptionManager = new SubscriptionManager({
      enterpriseId: TEST_ENTERPRISE_ID
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
          enterpriseId: TEST_ENTERPRISE_ID
        })
      }).toThrow('NOVU_SECRET_KEY environment variable is required')
      
      process.env.NOVU_SECRET_KEY = originalKey
    })

    it('should initialize with default config', () => {
      const manager = new SubscriptionManager({
        enterpriseId: TEST_ENTERPRISE_ID
      })
      
      const status = manager.getStatus()
      expect(status.isActive).toBe(false)
      expect(status.queueLength).toBe(0)
      expect(status.activeProcessing).toBe(0)
    })

    it('should accept custom queue config', () => {
      const manager = new SubscriptionManager({
        enterpriseId: TEST_ENTERPRISE_ID,
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
    const mockNotification = {
      id: 1,
      name: 'test-notification',
      enterprise_id: TEST_ENTERPRISE_ID,
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

    it('should add notifications to queue', () => {
      const addToQueueMethod = (subscriptionManager as any).addToQueue.bind(subscriptionManager)
      
      addToQueueMethod(mockNotification)
      
      const status = subscriptionManager.getStatus()
      expect(status.queueLength).toBe(1)
    })

    it('should respect queue size limits', () => {
      const manager = new SubscriptionManager({
        enterpriseId: TEST_ENTERPRISE_ID,
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
        enterpriseId: TEST_ENTERPRISE_ID,
        queueConfig: { maxQueueSize: 10 }
      })
      
      const addToQueueMethod = (manager as any).addToQueue.bind(manager)
      
      const mockNotification = {
        id: 1,
        name: 'test-notification',
        enterprise_id: TEST_ENTERPRISE_ID,
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
      
      const mockNotification = {
        id: 1,
        name: 'test-notification',
        enterprise_id: TEST_ENTERPRISE_ID,
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
        enterpriseId: TEST_ENTERPRISE_ID,
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

// Integration test with real Supabase
describe('SubscriptionManager Integration with Cloud Services', () => {
  it('should handle notification insert event from Supabase', async () => {
    process.env.NOVU_SECRET_KEY = process.env.NOVU_SECRET_KEY || 'test-key'
    
    let notificationReceived = false
    
    const manager = new SubscriptionManager({
      enterpriseId: TEST_ENTERPRISE_ID,
      onNotification: async (notification) => {
        notificationReceived = true
        expect(notification.name).toBe('Integration Test Notification')
      }
    })
    
    await manager.start()
    
    // Create a notification in Supabase to trigger the subscription
    const { data: notification, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .insert({
        name: 'Integration Test Notification',
        enterprise_id: TEST_ENTERPRISE_ID,
        notification_workflow_id: testWorkflowId,
        recipients: ['12345678-1234-5234-9234-123456789012'],
        payload: { test: true },
        notification_status: 'PENDING',
        channels: ['EMAIL']
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to create test notification:', error)
      throw error
    }
    
    testNotificationId = notification.id
    
    // Wait a bit for the realtime subscription to process
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    await manager.stop()
    
    // Clean up
    await supabase
      .schema('notify')
      .from('ent_notification')
      .delete()
      .eq('id', testNotificationId)
  })
})