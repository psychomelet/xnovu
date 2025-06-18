/**
 * Integration tests for Async Trigger API
 * Tests the /api/trigger-async endpoint with real services
 */

import { POST, GET } from '@/app/api/trigger-async/route'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { randomUUID } from 'crypto'
import { getTestEnterpriseId } from '../setup/test-data'
import { 
  createTestSupabaseClient,
  setupTestWorkflowWithRule,
  waitForCondition,
  WORKFLOW_KEYS
} from '../helpers/supabase-test-helpers'

// Types
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row']
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert']

describe('/api/trigger-async Integration Tests', () => {
  let supabase: ReturnType<typeof createTestSupabaseClient>
  let testEnterpriseId: string
  const createdNotificationIds: number[] = []

  // Check for real credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  
  const hasRealCredentials = supabaseUrl && 
    supabaseServiceKey && 
    supabaseUrl.includes('supabase.co') && 
    supabaseServiceKey.length > 50

  beforeAll(async () => {
    if (!hasRealCredentials) {
      throw new Error('Real Supabase credentials required for integration tests. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    }

    testEnterpriseId = getTestEnterpriseId()
    supabase = createTestSupabaseClient()
  })

  afterAll(async () => {
    // Cleanup handled by global teardown
    createdNotificationIds.length = 0
  })

  async function createTestNotification(
    workflowId: number, 
    overrides?: Partial<NotificationInsert>
  ): Promise<NotificationRow> {
    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .insert({
        name: `Test Notification ${Date.now()}`,
        payload: { test: true, timestamp: new Date().toISOString() },
        recipients: [randomUUID()],
        notification_workflow_id: workflowId,
        enterprise_id: testEnterpriseId,
        notification_status: 'PENDING',
        publish_status: 'PUBLISH',
        ...overrides,
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create test notification: ${error?.message}`)
    }

    createdNotificationIds.push(data.id)
    return data
  }

  describe('POST - Async Trigger', () => {
    it('should trigger single notification asynchronously', async () => {
      // Get existing workflow and create a test notification
      const { workflow } = await setupTestWorkflowWithRule(supabase, WORKFLOW_KEYS.email)
      const notification = await createTestNotification(workflow.id)

      const req = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notification.id,
          async: true
        })
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.async).toBe(true)
      expect(data.workflowId).toBeDefined()
      expect(data.runId).toBeDefined()
      expect(data.message).toContain(`Notification ${notification.id} queued for async processing`)
    })

    it('should trigger single notification synchronously when async=false', async () => {
      // Get existing workflow and create a test notification
      const { workflow } = await setupTestWorkflowWithRule(supabase, WORKFLOW_KEYS.email)
      const notification = await createTestNotification(workflow.id)

      const req = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notification.id,
          async: false
        })
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.async).toBe(false)
      expect(data.success).toBeDefined()
      expect(data.notificationId).toBe(notification.id)
      // Don't assert exact status/transaction ID as they depend on real Novu integration
    })

    it('should trigger multiple notifications asynchronously', async () => {
      // Get existing workflow and create multiple test notifications
      const { workflow } = await setupTestWorkflowWithRule(supabase, WORKFLOW_KEYS.email)
      const notification1 = await createTestNotification(workflow.id)
      const notification2 = await createTestNotification(workflow.id)
      const notification3 = await createTestNotification(workflow.id)
      
      const notificationIds = [notification1.id, notification2.id, notification3.id]

      const req = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationIds,
          async: true
        })
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.async).toBe(true)
      expect(data.workflowId).toBeDefined()
      expect(data.runId).toBeDefined()
      expect(data.message).toContain('3 notifications queued for async processing')
    })

    it('should trigger multiple notifications synchronously when async=false', async () => {
      // Get existing workflow and create multiple test notifications
      const { workflow } = await setupTestWorkflowWithRule(supabase, WORKFLOW_KEYS.email)
      const notification1 = await createTestNotification(workflow.id)
      const notification2 = await createTestNotification(workflow.id)
      const notification3 = await createTestNotification(workflow.id)
      
      const notificationIds = [notification1.id, notification2.id, notification3.id]

      const req = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationIds,
          async: false
        })
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.async).toBe(false)
      expect(data.totalCount).toBe(3)
      expect(data.successCount).toBeGreaterThanOrEqual(0)
      expect(data.results).toHaveLength(3)
      expect(Array.isArray(data.results)).toBe(true)
    })

    it('should return 400 when neither notificationId nor notificationIds provided', async () => {
      const req = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Either notificationId or notificationIds is required')
    })

    it('should handle non-existent notification gracefully', async () => {
      const req = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: 999999, // Non-existent ID
          async: false
        })
      })

      const response = await POST(req)
      const data = await response.json()

      // Should handle gracefully - API may return 200 with error or proper error status
      expect([200, 400, 404, 500]).toContain(response.status)
      if (response.status === 200) {
        // If 200, should contain success: false or similar indication of failure
        expect(data.success === false || data.error).toBeTruthy()
      } else {
        expect(data.error).toBeDefined()
      }
    })
  })

  describe('GET - Workflow Status', () => {
    it('should return 400 when workflowId is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/trigger-async')

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('workflowId is required')
    })

    it('should handle workflow status check for non-existent workflow', async () => {
      const req = new NextRequest('http://localhost:3000/api/trigger-async?workflowId=trigger-notification-nonexistent-workflow-999')

      const response = await GET(req)
      const data = await response.json()

      // Should handle gracefully - workflow not found
      expect([404, 500]).toContain(response.status)
      expect(data.error).toBeDefined()
    })

    it('should check workflow status for valid workflow ID', async () => {
      // First create a real async workflow to get a valid workflowId
      const { workflow } = await setupTestWorkflowWithRule(supabase, WORKFLOW_KEYS.email)
      const notification = await createTestNotification(workflow.id)

      // Trigger async workflow first
      const triggerReq = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notification.id,
          async: true
        })
      })

      const triggerResponse = await POST(triggerReq)
      const triggerData = await triggerResponse.json()
      
      expect(triggerResponse.status).toBe(200)
      expect(triggerData.workflowId).toBeDefined()

      // Now check the status of the triggered workflow
      const statusReq = new NextRequest(`http://localhost:3000/api/trigger-async?workflowId=${triggerData.workflowId}`)

      const statusResponse = await GET(statusReq)
      const statusData = await statusResponse.json()

      expect(statusResponse.status).toBe(200)
      expect(statusData.workflowId).toBe(triggerData.workflowId)
      expect(statusData.status).toBeDefined()
      expect(typeof statusData.isRunning).toBe('boolean')
    })
  })
})