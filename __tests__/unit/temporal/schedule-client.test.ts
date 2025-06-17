import { ScheduleClient, ScheduleHandle } from '@temporalio/client'
import * as scheduleClient from '@/lib/temporal/client/schedule-client'
import { getTemporalConnection } from '@/lib/temporal/client'
import { logger } from '@/app/services/logger'
import type { NotificationRule } from '@/types/rule-engine'

const {
  getScheduleId,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  listSchedules,
  getSchedule,
} = scheduleClient

jest.mock('@/lib/temporal/client')
jest.mock('@/app/services/logger')

describe('Schedule Client', () => {
  let mockScheduleClient: jest.Mocked<ScheduleClient>
  let mockScheduleHandle: jest.Mocked<ScheduleHandle>
  
  const mockRule: NotificationRule = {
    id: 123,
    name: 'Test Rule',
    enterprise_id: 'ent-123',
    business_id: 'biz-456',
    notification_workflow_id: 789,
    trigger_type: 'CRON',
    trigger_config: {
      cron: '0 9 * * MON',
      timezone: 'America/New_York'
    },
    rule_payload: { test: 'data' },
    publish_status: 'PUBLISH',
    deactivated: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    description: null,
    repr: null,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockScheduleHandle = {
      update: jest.fn(),
      describe: jest.fn(),
      delete: jest.fn(),
      pause: jest.fn(),
      unpause: jest.fn(),
      trigger: jest.fn(),
      backfill: jest.fn(),
    } as unknown as jest.Mocked<ScheduleHandle>
    
    mockScheduleClient = {
      create: jest.fn(),
      getHandle: jest.fn().mockReturnValue(mockScheduleHandle),
      list: jest.fn(),
    } as unknown as jest.Mocked<ScheduleClient>
    
    ;(getTemporalConnection as jest.Mock).mockResolvedValue({})
    
    // Mock the entire schedule-client module
    jest.spyOn(scheduleClient, 'getScheduleClient').mockResolvedValue(mockScheduleClient)
  })

  describe('getScheduleId', () => {
    it('should generate correct schedule ID', () => {
      const scheduleId = getScheduleId(mockRule)
      expect(scheduleId).toBe('rule-123-ent-123')
    })

    it('should handle null enterprise_id', () => {
      const ruleWithNullEnterprise = { ...mockRule, enterprise_id: null }
      const scheduleId = getScheduleId(ruleWithNullEnterprise)
      expect(scheduleId).toBe('rule-123-null')
    })
  })

  describe('createSchedule', () => {
    it('should create a schedule with correct configuration', async () => {
      mockScheduleClient.create.mockResolvedValue(mockScheduleHandle)
      
      const result = await createSchedule(mockRule)
      
      expect(mockScheduleClient.create).toHaveBeenCalledWith({
        scheduleId: 'rule-123-ent-123',
        spec: {
          cronExpressions: ['0 9 * * MON'],
          timezone: 'America/New_York',
        },
        action: {
          type: 'startWorkflow',
          workflowType: 'ruleScheduledWorkflow',
          taskQueue: 'notifications',
          args: [{
            ruleId: 123,
            enterpriseId: 'ent-123',
            businessId: 'biz-456',
            workflowId: 789,
            rulePayload: { test: 'data' },
          }],
        },
        memo: {
          ruleId: 123,
          enterpriseId: 'ent-123',
          ruleName: 'Test Rule',
        },
        state: {
          paused: false,
          note: 'Notification rule: Test Rule',
        },
      })
      
      expect(result).toBe(mockScheduleHandle)
    })

    it('should pause schedule if rule is deactivated', async () => {
      const deactivatedRule = { ...mockRule, deactivated: true }
      mockScheduleClient.create.mockResolvedValue(mockScheduleHandle)
      
      await createSchedule(deactivatedRule)
      
      expect(mockScheduleClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          state: {
            paused: true,
            note: 'Notification rule: Test Rule',
          },
        })
      )
    })

    it('should use UTC timezone if not specified', async () => {
      const ruleWithoutTimezone = {
        ...mockRule,
        trigger_config: { cron: '0 9 * * MON' }
      }
      mockScheduleClient.create.mockResolvedValue(mockScheduleHandle)
      
      await createSchedule(ruleWithoutTimezone)
      
      expect(mockScheduleClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: {
            cronExpressions: ['0 9 * * MON'],
            timezone: 'UTC',
          },
        })
      )
    })

    it('should throw error if trigger_config is invalid', async () => {
      const invalidRule = { ...mockRule, trigger_config: null }
      
      await expect(createSchedule(invalidRule)).rejects.toThrow(
        'Invalid trigger config for rule 123'
      )
    })
  })

  describe('updateSchedule', () => {
    it('should update existing schedule', async () => {
      mockScheduleHandle.update.mockResolvedValue(undefined)
      
      await updateSchedule(mockRule)
      
      expect(mockScheduleClient.getHandle).toHaveBeenCalledWith('rule-123-ent-123')
      expect(mockScheduleHandle.update).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should create new schedule if not found', async () => {
      const notFoundError = new Error('Schedule not found')
      ;(notFoundError as any).code = 5 // NOT_FOUND
      mockScheduleHandle.update.mockRejectedValue(notFoundError)
      mockScheduleClient.create.mockResolvedValue(mockScheduleHandle)
      
      await updateSchedule(mockRule)
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Schedule not found, creating new one',
        { scheduleId: 'rule-123-ent-123' }
      )
      expect(mockScheduleClient.create).toHaveBeenCalled()
    })

    it('should throw error for other failures', async () => {
      const otherError = new Error('Network error')
      mockScheduleHandle.update.mockRejectedValue(otherError)
      
      await expect(updateSchedule(mockRule)).rejects.toThrow('Network error')
    })
  })

  describe('deleteSchedule', () => {
    it('should delete existing schedule', async () => {
      mockScheduleHandle.delete.mockResolvedValue(undefined)
      
      await deleteSchedule(mockRule)
      
      expect(mockScheduleClient.getHandle).toHaveBeenCalledWith('rule-123-ent-123')
      expect(mockScheduleHandle.delete).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(
        'Deleting Temporal schedule',
        { scheduleId: 'rule-123-ent-123', ruleId: 123 }
      )
    })

    it('should not throw if schedule not found', async () => {
      const notFoundError = new Error('Schedule not found')
      ;(notFoundError as any).code = 5 // NOT_FOUND
      mockScheduleHandle.delete.mockRejectedValue(notFoundError)
      
      await deleteSchedule(mockRule)
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Schedule not found, already deleted',
        { scheduleId: 'rule-123-ent-123' }
      )
    })

    it('should throw error for other failures', async () => {
      const otherError = new Error('Permission denied')
      mockScheduleHandle.delete.mockRejectedValue(otherError)
      
      await expect(deleteSchedule(mockRule)).rejects.toThrow('Permission denied')
    })
  })

  describe('listSchedules', () => {
    it('should list all schedules with descriptions', async () => {
      const mockScheduleSummary1 = { scheduleId: 'rule-1-ent-1' }
      const mockScheduleSummary2 = { scheduleId: 'rule-2-ent-2' }
      const mockDescription1 = { schedule: { spec: {} } }
      const mockDescription2 = { schedule: { spec: {} } }
      
      const mockAsyncIterator = {
        async *[Symbol.asyncIterator]() {
          yield mockScheduleSummary1
          yield mockScheduleSummary2
        }
      }
      
      mockScheduleClient.list.mockReturnValue(mockAsyncIterator as any)
      mockScheduleClient.getHandle.mockImplementation((id) => {
        const handle = { ...mockScheduleHandle }
        if (id === 'rule-1-ent-1') {
          handle.describe.mockResolvedValue(mockDescription1 as any)
        } else {
          handle.describe.mockResolvedValue(mockDescription2 as any)
        }
        return handle
      })
      
      const result = await listSchedules()
      
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'rule-1-ent-1',
        description: mockDescription1,
      })
      expect(result[1]).toEqual({
        id: 'rule-2-ent-2',
        description: mockDescription2,
      })
    })

    it('should handle description errors gracefully', async () => {
      const mockScheduleSummary = { scheduleId: 'rule-1-ent-1' }
      
      const mockAsyncIterator = {
        async *[Symbol.asyncIterator]() {
          yield mockScheduleSummary
        }
      }
      
      mockScheduleClient.list.mockReturnValue(mockAsyncIterator as any)
      mockScheduleHandle.describe.mockRejectedValue(new Error('Description failed'))
      
      const result = await listSchedules()
      
      expect(result).toHaveLength(0)
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to describe schedule',
        {
          scheduleId: 'rule-1-ent-1',
          error: 'Description failed',
        }
      )
    })
  })

  describe('getSchedule', () => {
    it('should get schedule description', async () => {
      const mockDescription = { schedule: { spec: {} } }
      mockScheduleHandle.describe.mockResolvedValue(mockDescription as any)
      
      const result = await getSchedule('rule-123-ent-123')
      
      expect(mockScheduleClient.getHandle).toHaveBeenCalledWith('rule-123-ent-123')
      expect(result).toBe(mockDescription)
    })

    it('should return null if schedule not found', async () => {
      const notFoundError = new Error('Schedule not found')
      ;(notFoundError as any).code = 5 // NOT_FOUND
      mockScheduleHandle.describe.mockRejectedValue(notFoundError)
      
      const result = await getSchedule('rule-123-ent-123')
      
      expect(result).toBeNull()
    })

    it('should throw error for other failures', async () => {
      const otherError = new Error('Network error')
      mockScheduleHandle.describe.mockRejectedValue(otherError)
      
      await expect(getSchedule('rule-123-ent-123')).rejects.toThrow('Network error')
    })
  })
})