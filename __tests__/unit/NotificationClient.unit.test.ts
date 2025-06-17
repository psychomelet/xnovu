/**
 * Unit tests for NotificationClient async functionality
 */

import { NotificationClient } from '@/lib/temporal/client/notification-client'
import { getTemporalClient } from '@/lib/temporal/client'

// Mock the temporal client
jest.mock('@/lib/temporal/client', () => ({
  getTemporalClient: jest.fn()
}))

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234')
}))

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    schema: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { scheduled_for: null },
              error: null
            }))
          }))
        }))
      }))
    }))
  }))
}))

describe('NotificationClient', () => {
  let client: NotificationClient
  let mockTemporalClient: any
  let mockWorkflowHandle: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup mock workflow handle
    mockWorkflowHandle = {
      workflowId: 'trigger-notification-123-mock-uuid-1234',
      firstExecutionRunId: 'run-id-123',
      result: jest.fn(),
      describe: jest.fn(),
      cancel: jest.fn()
    }

    // Setup mock temporal client
    mockTemporalClient = {
      start: jest.fn().mockResolvedValue(mockWorkflowHandle),
      getHandle: jest.fn().mockReturnValue(mockWorkflowHandle)
    }

    ;(getTemporalClient as jest.Mock).mockResolvedValue(mockTemporalClient)
    
    client = new NotificationClient()
  })

  describe('asyncTriggerNotificationById', () => {
    it('should start a notification trigger workflow with default parameters', async () => {
      const notificationId = 123
      
      const result = await client.asyncTriggerNotificationById(notificationId)
      
      expect(mockTemporalClient.start).toHaveBeenCalledWith(
        expect.any(Function), // triggerNotificationWorkflow function
        {
          args: [{ notificationId }],
          taskQueue: expect.any(String),
          workflowId: 'trigger-notification-123-mock-uuid-1234'
        }
      )
      
      expect(result).toEqual({
        workflowId: 'trigger-notification-123-mock-uuid-1234',
        runId: 'run-id-123'
      })
    })

    it('should use custom workflow ID when provided', async () => {
      const notificationId = 456
      const customWorkflowId = 'custom-workflow-id'
      
      // Update mock to return the custom workflow ID
      mockWorkflowHandle.workflowId = customWorkflowId
      
      const result = await client.asyncTriggerNotificationById(notificationId, {
        workflowId: customWorkflowId
      })
      
      expect(mockTemporalClient.start).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          workflowId: customWorkflowId
        })
      )
      
      expect(result.workflowId).toBe(customWorkflowId)
    })

    it('should use custom task queue when provided', async () => {
      const notificationId = 789
      const customTaskQueue = 'custom-task-queue'
      
      await client.asyncTriggerNotificationById(notificationId, {
        taskQueue: customTaskQueue
      })
      
      expect(mockTemporalClient.start).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          taskQueue: customTaskQueue
        })
      )
    })
  })

  describe('asyncTriggerMultipleNotifications', () => {
    it('should start a multiple notification trigger workflow', async () => {
      const notificationIds = [123, 456, 789]
      
      mockWorkflowHandle.workflowId = 'trigger-multiple-notifications-mock-uuid-1234'
      
      const result = await client.asyncTriggerMultipleNotifications(notificationIds)
      
      expect(mockTemporalClient.start).toHaveBeenCalledWith(
        expect.any(Function), // triggerMultipleNotificationsWorkflow function
        {
          args: [{ notificationIds }],
          taskQueue: expect.any(String),
          workflowId: 'trigger-multiple-notifications-mock-uuid-1234'
        }
      )
      
      expect(result).toEqual({
        workflowId: 'trigger-multiple-notifications-mock-uuid-1234',
        runId: 'run-id-123'
      })
    })
  })

  describe('getWorkflowResult', () => {
    it('should return workflow result', async () => {
      const workflowId = 'test-workflow-id'
      const mockResult = {
        success: true,
        notificationId: 123,
        status: 'SENT',
        novuTransactionId: 'novu-tx-123'
      }
      
      mockWorkflowHandle.result.mockResolvedValue(mockResult)
      
      const result = await client.getWorkflowResult(workflowId)
      
      expect(mockTemporalClient.getHandle).toHaveBeenCalledWith(workflowId)
      expect(mockWorkflowHandle.result).toHaveBeenCalled()
      expect(result).toEqual(mockResult)
    })

    it('should handle workflow result errors', async () => {
      const workflowId = 'failing-workflow-id'
      const error = new Error('Workflow failed')
      
      mockWorkflowHandle.result.mockRejectedValue(error)
      
      await expect(client.getWorkflowResult(workflowId)).rejects.toThrow('Workflow failed')
    })
  })

  describe('getWorkflowStatus', () => {
    it('should return workflow status for running workflow', async () => {
      const workflowId = 'running-workflow-id'
      const mockDescription = {
        status: { name: 'RUNNING' },
        historyLength: 5
      }
      
      mockWorkflowHandle.describe.mockResolvedValue(mockDescription)
      
      const result = await client.getWorkflowStatus(workflowId)
      
      expect(mockTemporalClient.getHandle).toHaveBeenCalledWith(workflowId)
      expect(mockWorkflowHandle.describe).toHaveBeenCalled()
      expect(result).toEqual({
        status: 'RUNNING',
        historyLength: 5,
        isRunning: true
      })
    })

    it('should return workflow status for completed workflow', async () => {
      const workflowId = 'completed-workflow-id'
      const mockDescription = {
        status: { name: 'COMPLETED' },
        historyLength: 10
      }
      
      mockWorkflowHandle.describe.mockResolvedValue(mockDescription)
      
      const result = await client.getWorkflowStatus(workflowId)
      
      expect(result).toEqual({
        status: 'COMPLETED',
        historyLength: 10,
        isRunning: false
      })
    })

    it('should handle status check errors', async () => {
      const workflowId = 'error-workflow-id'
      const error = new Error('Status check failed')
      
      mockWorkflowHandle.describe.mockRejectedValue(error)
      
      await expect(client.getWorkflowStatus(workflowId)).rejects.toThrow('Failed to get workflow status')
    })
  })

  describe('cancelWorkflow', () => {
    it('should cancel a workflow', async () => {
      const workflowId = 'workflow-to-cancel'
      
      await client.cancelWorkflow(workflowId)
      
      expect(mockTemporalClient.getHandle).toHaveBeenCalledWith(workflowId)
      expect(mockWorkflowHandle.cancel).toHaveBeenCalled()
    })

    it('should handle cancellation errors', async () => {
      const workflowId = 'uncancellable-workflow'
      const error = new Error('Cannot cancel workflow')
      
      mockWorkflowHandle.cancel.mockRejectedValue(error)
      
      await expect(client.cancelWorkflow(workflowId)).rejects.toThrow('Cannot cancel workflow')
    })
  })
})