/**
 * @jest-environment node
 */

import { SubscriptionManager } from '@/app/services/realtime/SubscriptionManager'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { randomUUID } from 'crypto'

type NotificationRow = Database['notify']['Tables']['ent_notification']['Row']
type SupabaseClient = ReturnType<typeof createClient<Database>>

describe('SubscriptionManager Integration Tests with Real Services', () => {
  let supabase: SupabaseClient
  const testEnterpriseId = randomUUID()
  const createdNotificationIds: number[] = []
  const createdWorkflowIds: number[] = []

  // Check if we have real credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const novuSecretKey = process.env.NOVU_SECRET_KEY || ''
  
  const hasRealCredentials = supabaseUrl && 
    supabaseServiceKey && 
    novuSecretKey &&
    supabaseUrl.includes('supabase.co') && 
    supabaseServiceKey.length > 50 &&
    novuSecretKey.length > 20 &&
    !novuSecretKey.includes('test-secret-key')

  beforeAll(async () => {
    if (!hasRealCredentials) {
      throw new Error('Real Supabase and Novu credentials required for SubscriptionManager Integration tests. Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and NOVU_SECRET_KEY')
    }

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-subscription-manager-integration' } }
    })
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    
    // Clean up any existing test data
    await cleanupTestData()
  })

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData()
  })

  async function cleanupTestData() {
    if (!hasRealCredentials) return
    
    try {
      // Delete test notifications
      if (createdNotificationIds.length > 0) {
        await supabase
          .schema('notify')
          .from('ent_notification')
          .delete()
          .in('id', createdNotificationIds)
        createdNotificationIds.length = 0
      }

      // Delete test workflows
      if (createdWorkflowIds.length > 0) {
        await supabase
          .schema('notify')
          .from('ent_notification_workflow')
          .delete()
          .in('id', createdWorkflowIds)
        createdWorkflowIds.length = 0
      }
      
      // Delete by exact enterprise ID
      await supabase
        .schema('notify')
        .from('ent_notification')
        .delete()
        .eq('enterprise_id', testEnterpriseId)

      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('enterprise_id', testEnterpriseId)
    } catch (error) {
      console.warn('Cleanup warning:', error)
    }
  }

  const mockNotification: NotificationRow = {
    id: 1,
    name: 'test-notification',
    enterprise_id: testEnterpriseId,
    notification_workflow_id: 1,
    recipients: ['12345678-1234-5234-9234-123456789012'],
    payload: { message: 'test' },
    notification_status: 'PENDING',
    channels: ['EMAIL'],
    overrides: null,
    tags: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    processed_at: null,
    transaction_id: null,
    error_details: null
  }

  async function createTestWorkflow() {
    const workflow = {
      name: `Test Subscription Workflow ${Date.now()}-${Math.random().toString(36).substring(7)}`,
      workflow_key: `test-subscription-workflow-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      workflow_type: 'DYNAMIC' as const,
      default_channels: ['EMAIL'] as const,
      enterprise_id: testEnterpriseId,
      publish_status: 'PUBLISH' as const,
      deactivated: false
    }

    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .insert(workflow)
      .select()
      .single()

    if (error) throw error
    if (data) createdWorkflowIds.push(data.id)
    return data!
  }

  async function createTestNotification(workflowId: number) {
    const notification = {
      name: `Test Subscription Notification ${Date.now()}-${Math.random().toString(36).substring(7)}`,
      payload: { message: 'Test subscription message', buildingId: 'building-123' },
      recipients: ['12345678-1234-5234-9234-123456789012'],
      notification_workflow_id: workflowId,
      enterprise_id: testEnterpriseId,
      notification_status: 'PENDING' as const,
      channels: ['EMAIL'] as const
    }

    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .insert(notification)
      .select()
      .single()

    if (error) throw error
    if (data) createdNotificationIds.push(data.id)
    return data!
  }

  it('should handle subscription manager lifecycle with real Supabase connection', async () => {
    const mockOnNotification = jest.fn()

    const manager = new SubscriptionManager({
      enterpriseId: testEnterpriseId,
      onNotification: mockOnNotification,
      queueConfig: {
        maxConcurrent: 2,
        retryAttempts: 2,
        retryDelay: 500,
        maxQueueSize: 100
      }
    })

    // Test initial state
    const initialStatus = manager.getStatus()
    expect(initialStatus.isActive).toBe(false)
    expect(initialStatus.queueLength).toBe(0)
    expect(initialStatus.activeProcessing).toBe(0)
    expect(initialStatus.isShuttingDown).toBe(false)

    // Start the manager with real APIs
    await manager.start()

    // Wait for subscription to establish
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Verify it's active
    const activeStatus = manager.getStatus()
    expect(activeStatus.isActive).toBe(true)
    expect(activeStatus.queueLength).toBe(0)
    expect(manager.isHealthy()).toBe(true)

    // Test queue functionality by directly adding to queue
    const testNotification: NotificationRow = {
      ...mockNotification,
      id: 999, // Use a test ID that won't conflict
      enterprise_id: testEnterpriseId
    }
    
    const addToQueueMethod = (manager as any).addToQueue.bind(manager)
    addToQueueMethod(testNotification)

    const queueStatus = manager.getStatus()
    expect(queueStatus.queueLength).toBe(1)

    // Test metrics
    const metrics = manager.getMetrics()
    expect(metrics.queueLength).toBe(1)
    expect(metrics.isHealthy).toBe(true)
    expect(metrics.oldestQueueItem).toBeInstanceOf(Date)

    // Clear queue to avoid processing issues during stop
    manager.clearQueue()
    
    const clearedStatus = manager.getStatus()
    expect(clearedStatus.queueLength).toBe(0)

    await manager.stop()

    const stoppedStatus = manager.getStatus()
    expect(stoppedStatus.isActive).toBe(false)
    expect(stoppedStatus.isShuttingDown).toBe(true)
  }, 20000)

  it('should handle real notification workflow processing with database integration', async () => {
    // Create a real workflow first
    const testWorkflow = await createTestWorkflow()
    
    // Create a real notification
    const testNotification = await createTestNotification(testWorkflow.id)

    const processedNotifications: NotificationRow[] = []
    const manager = new SubscriptionManager({
      enterpriseId: testEnterpriseId,
      onNotification: async (notification) => {
        processedNotifications.push(notification)
      },
      queueConfig: {
        maxConcurrent: 1,
        retryAttempts: 1,
        retryDelay: 100
      }
    })

    await manager.start()
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Test queue functionality with real database objects
    const addToQueueMethod = (manager as any).addToQueue.bind(manager)
    addToQueueMethod(testNotification)

    // Allow time for processing
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Verify notification was processed
    const updatedNotification = await supabase
      .schema('notify')
      .from('ent_notification')
      .select('*')
      .eq('id', testNotification.id)
      .eq('enterprise_id', testEnterpriseId)
      .single()

    expect(updatedNotification.data).toBeDefined()
    // Note: Status might be PROCESSING or FAILED due to Novu API call, but it should not be PENDING
    expect(updatedNotification.data!.notification_status).not.toBe('PENDING')

    await manager.stop()
  }, 25000)

  it('should handle error scenarios and retry logic with real services', async () => {
    const errors: Error[] = []
    const manager = new SubscriptionManager({
      enterpriseId: testEnterpriseId,
      onError: (error) => {
        errors.push(error)
      },
      queueConfig: {
        maxConcurrent: 1,
        retryAttempts: 2,
        retryDelay: 100
      }
    })

    await manager.start()
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Create notification with invalid workflow ID to trigger error
    const invalidNotification: NotificationRow = {
      ...mockNotification,
      id: 998,
      enterprise_id: testEnterpriseId,
      notification_workflow_id: 99999, // Non-existent workflow
      recipients: ['12345678-1234-5234-9234-123456789012'] // Valid UUID
    }

    const addToQueueMethod = (manager as any).addToQueue.bind(manager)
    addToQueueMethod(invalidNotification)

    // Allow time for processing and retries
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Should have processed the error
    expect(errors.length).toBeGreaterThan(0)

    await manager.stop()
  }, 15000)

  it('should handle failed notification retry functionality', async () => {
    // Create a workflow for testing
    const testWorkflow = await createTestWorkflow()
    
    // Create a failed notification in database
    const failedNotification = {
      name: `Failed Notification ${Date.now()}`,
      payload: { message: 'Failed notification test' },
      recipients: ['12345678-1234-5234-9234-123456789012'],
      notification_workflow_id: testWorkflow.id,
      enterprise_id: testEnterpriseId,
      notification_status: 'FAILED' as const,
      channels: ['EMAIL'] as const,
      error_details: { message: 'Test failure', attempts: 3 }
    }

    const { data: createdFailedNotification, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .insert(failedNotification)
      .select()
      .single()

    if (error) throw error
    createdNotificationIds.push(createdFailedNotification.id)

    const manager = new SubscriptionManager({
      enterpriseId: testEnterpriseId,
      queueConfig: {
        maxConcurrent: 1,
        retryAttempts: 1
      }
    })

    await manager.start()
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Test retry functionality
    const retryResult = await manager.retryFailedNotifications(10)
    
    expect(retryResult.processed).toBeGreaterThanOrEqual(0)
    expect(retryResult.failed).toBeGreaterThanOrEqual(0)
    expect(retryResult.processed + retryResult.failed).toBeGreaterThan(0)

    await manager.stop()
  }, 15000)
})