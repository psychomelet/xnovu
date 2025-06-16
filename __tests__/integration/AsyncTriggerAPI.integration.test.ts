/**
 * Integration tests for Async Trigger API
 * Tests the /api/trigger-async endpoint with real services
 */

// Mock the NotificationClient to avoid starting real Temporal workflows in tests
jest.mock('@/lib/temporal/client/notification-client', () => ({
  notificationClient: {
    asyncTriggerNotificationById: jest.fn(),
    asyncTriggerMultipleNotifications: jest.fn(),
    getWorkflowStatus: jest.fn(),
    getWorkflowResult: jest.fn()
  }
}))

// Mock the sync trigger function
jest.mock('@/lib/notifications/trigger', () => ({
  triggerNotificationById: jest.fn()
}))

import { POST, GET } from '@/app/api/trigger-async/route'
import { notificationClient } from '@/lib/temporal/client/notification-client'
import { triggerNotificationById } from '@/lib/notifications/trigger'

// Helper function to create mock NextRequest
function createMockRequest(body: any, searchParams?: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/trigger-async')
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }
  
  return {
    json: jest.fn().mockResolvedValue(body),
    url: url.toString()
  } as any
}

describe('/api/trigger-async Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST - Async Trigger', () => {
    it('should trigger single notification asynchronously', async () => {
      // Mock successful async trigger
      ;(notificationClient.asyncTriggerNotificationById as jest.Mock).mockResolvedValue({
        workflowId: 'trigger-notification-123-uuid',
        runId: 'run-id-456'
      })

      const req = createMockRequest({
        notificationId: 123,
        async: true
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        async: true,
        workflowId: 'trigger-notification-123-uuid',
        runId: 'run-id-456',
        message: 'Notification 123 queued for async processing'
      })

      expect(notificationClient.asyncTriggerNotificationById).toHaveBeenCalledWith(123)
    })

    it('should trigger single notification synchronously when async=false', async () => {
      // Mock successful sync trigger
      ;(triggerNotificationById as jest.Mock).mockResolvedValue({
        success: true,
        notificationId: 123,
        status: 'SENT',
        novuTransactionId: 'novu-tx-789'
      })

      const req = createMockRequest({
        notificationId: 123,
        async: false
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        async: false,
        success: true,
        notificationId: 123,
        status: 'SENT',
        novuTransactionId: 'novu-tx-789'
      })

      expect(triggerNotificationById).toHaveBeenCalledWith(123)
    })

    it('should trigger multiple notifications asynchronously', async () => {
      // Mock successful batch async trigger
      ;(notificationClient.asyncTriggerMultipleNotifications as jest.Mock).mockResolvedValue({
        workflowId: 'trigger-multiple-notifications-uuid',
        runId: 'batch-run-id-789'
      })

      const req = createMockRequest({
        notificationIds: [123, 456, 789],
        async: true
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        async: true,
        workflowId: 'trigger-multiple-notifications-uuid',
        runId: 'batch-run-id-789',
        message: '3 notifications queued for async processing'
      })

      expect(notificationClient.asyncTriggerMultipleNotifications).toHaveBeenCalledWith([123, 456, 789])
    })

    it('should trigger multiple notifications synchronously when async=false', async () => {
      // Mock successful sync triggers
      ;(triggerNotificationById as jest.Mock)
        .mockResolvedValueOnce({ success: true, notificationId: 123, status: 'SENT' })
        .mockResolvedValueOnce({ success: true, notificationId: 456, status: 'SENT' })
        .mockResolvedValueOnce({ success: false, notificationId: 789, status: 'FAILED', error: 'Test error' })

      const req = createMockRequest({
        notificationIds: [123, 456, 789],
        async: false
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: false, // 2 out of 3 succeeded
        async: false,
        totalCount: 3,
        successCount: 2,
        results: [
          { success: true, notificationId: 123, status: 'SENT' },
          { success: true, notificationId: 456, status: 'SENT' },
          { success: false, notificationId: 789, status: 'FAILED', error: 'Test error' }
        ]
      })
    })

    it('should return 400 when neither notificationId nor notificationIds provided', async () => {
      const req = createMockRequest({})

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({
        error: 'Either notificationId or notificationIds is required'
      })
    })

    it('should handle async trigger errors', async () => {
      // Mock async trigger failure
      ;(notificationClient.asyncTriggerNotificationById as jest.Mock).mockRejectedValue(
        new Error('Temporal workflow start failed')
      )

      const req = createMockRequest({
        notificationId: 123,
        async: true
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({
        error: 'Temporal workflow start failed'
      })
    })

    it('should handle sync trigger errors', async () => {
      // Mock sync trigger failure
      ;(triggerNotificationById as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      )

      const req = createMockRequest({
        notificationId: 123,
        async: false
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({
        error: 'Database connection failed'
      })
    })
  })

  describe('GET - Workflow Status', () => {
    it('should return workflow status for running workflow', async () => {
      // Mock running workflow status
      ;(notificationClient.getWorkflowStatus as jest.Mock).mockResolvedValue({
        status: 'RUNNING',
        historyLength: 5,
        isRunning: true
      })

      const req = createMockRequest({}, { workflowId: 'test-workflow-123' })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        workflowId: 'test-workflow-123',
        status: 'RUNNING',
        historyLength: 5,
        isRunning: true,
        result: null
      })

      expect(notificationClient.getWorkflowStatus).toHaveBeenCalledWith('test-workflow-123')
    })

    it('should return workflow status and result for completed workflow', async () => {
      // Mock completed workflow status and result
      ;(notificationClient.getWorkflowStatus as jest.Mock).mockResolvedValue({
        status: 'COMPLETED',
        historyLength: 10,
        isRunning: false
      })

      ;(notificationClient.getWorkflowResult as jest.Mock).mockResolvedValue({
        success: true,
        notificationId: 123,
        status: 'SENT',
        novuTransactionId: 'novu-tx-456'
      })

      const req = createMockRequest({}, { workflowId: 'completed-workflow-456' })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        workflowId: 'completed-workflow-456',
        status: 'COMPLETED',
        historyLength: 10,
        isRunning: false,
        result: {
          success: true,
          notificationId: 123,
          status: 'SENT',
          novuTransactionId: 'novu-tx-456'
        }
      })
    })

    it('should return 400 when workflowId is missing', async () => {
      const req = createMockRequest({}, {})

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({
        error: 'workflowId is required'
      })
    })

    it('should handle workflow status check errors', async () => {
      // Mock status check failure
      ;(notificationClient.getWorkflowStatus as jest.Mock).mockRejectedValue(
        new Error('Workflow not found')
      )

      const req = createMockRequest({}, { workflowId: 'nonexistent-workflow' })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({
        error: 'Workflow not found'
      })
    })
  })
})