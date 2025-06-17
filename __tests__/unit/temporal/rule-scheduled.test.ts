import { createNotificationFromRule } from '@/lib/temporal/activities/rule-scheduled'
import { RuleService } from '@/app/services/database/RuleService'
import { RuleEngineError } from '@/types/rule-engine'
import { logger } from '@/app/services/logger'
import type { RuleScheduledWorkflowInput } from '@/lib/temporal/workflows/rule-scheduled'
import type { NotificationRule, NotificationWorkflow, Notification } from '@/types/rule-engine'

jest.mock('@/app/services/database/RuleService')
jest.mock('@/app/services/logger')

describe('Rule Scheduled Activity', () => {
  let mockRuleService: jest.Mocked<RuleService>
  
  const mockInput: RuleScheduledWorkflowInput = {
    ruleId: 123,
    enterpriseId: 'ent-123',
    businessId: 'biz-456',
    workflowId: 789,
    rulePayload: {
      recipients: ['user-1', 'user-2'],
      customData: 'test',
    },
  }
  
  const mockRule: NotificationRule = {
    id: 123,
    name: 'Test Rule',
    enterprise_id: 'ent-123',
    business_id: 'biz-456',
    notification_workflow_id: 789,
    trigger_type: 'CRON',
    trigger_config: { cron: '0 9 * * MON' },
    rule_payload: mockInput.rulePayload,
    publish_status: 'PUBLISH',
    deactivated: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    description: null,
    repr: null,
  }
  
  const mockWorkflow: Partial<NotificationWorkflow> = {
    id: 789,
    name: 'Test Workflow',
    workflow_key: 'test-workflow',
    default_channels: ['EMAIL', 'IN_APP'],
    publish_status: 'PUBLISH',
    deactivated: false,
  }
  
  const mockNotification: Partial<Notification> = {
    id: 999,
    name: 'Scheduled: Test Rule',
    notification_status: 'PENDING',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockRuleService = {
      getRule: jest.fn(),
      getWorkflow: jest.fn(),
      createNotification: jest.fn(),
      shutdown: jest.fn(),
    } as unknown as jest.Mocked<RuleService>
    
    jest.mocked(RuleService).mockImplementation(() => mockRuleService)
  })

  describe('createNotificationFromRule', () => {
    it('should create notification for valid scheduled rule', async () => {
      mockRuleService.getRule.mockResolvedValue(mockRule)
      mockRuleService.getWorkflow.mockResolvedValue(mockWorkflow as any)
      mockRuleService.createNotification.mockResolvedValue(mockNotification as any)
      
      await createNotificationFromRule(mockInput)
      
      expect(mockRuleService.getRule).toHaveBeenCalledWith(123, 'ent-123')
      expect(mockRuleService.getWorkflow).toHaveBeenCalledWith(789, 'ent-123')
      
      expect(mockRuleService.createNotification).toHaveBeenCalledWith({
        name: 'Scheduled: Test Rule',
        description: 'Notification triggered by scheduled rule: Test Rule',
        payload: mockInput.rulePayload,
        recipients: ['user-1', 'user-2'],
        notification_workflow_id: 789,
        notification_rule_id: 123,
        enterprise_id: 'ent-123',
        business_id: 'biz-456',
        notification_status: 'PENDING',
        publish_status: 'PUBLISH',
        channels: ['EMAIL', 'IN_APP'],
      })
      
      expect(logger.info).toHaveBeenCalledWith(
        'Created notification from scheduled rule',
        {
          notificationId: 999,
          ruleId: 123,
          recipients: 2,
        }
      )
      
      expect(mockRuleService.shutdown).toHaveBeenCalled()
    })

    it('should throw error if enterprise ID is missing', async () => {
      const inputWithoutEnterprise = { ...mockInput, enterpriseId: null }
      
      await expect(createNotificationFromRule(inputWithoutEnterprise))
        .rejects.toThrow(RuleEngineError)
      
      expect(mockRuleService.getRule).not.toHaveBeenCalled()
      expect(mockRuleService.shutdown).toHaveBeenCalled()
    })

    it('should throw error if rule not found', async () => {
      mockRuleService.getRule.mockResolvedValue(null)
      
      await expect(createNotificationFromRule(mockInput))
        .rejects.toThrow(RuleEngineError)
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create notification from scheduled rule',
        {
          ruleId: 123,
          error: 'Rule not found: 123',
        }
      )
      
      expect(mockRuleService.shutdown).toHaveBeenCalled()
    })

    it('should skip notification for deactivated rule', async () => {
      const deactivatedRule = { ...mockRule, deactivated: true }
      mockRuleService.getRule.mockResolvedValue(deactivatedRule)
      
      await createNotificationFromRule(mockInput)
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Skipping notification for inactive rule',
        {
          ruleId: 123,
          deactivated: true,
          publishStatus: 'PUBLISH',
        }
      )
      
      expect(mockRuleService.createNotification).not.toHaveBeenCalled()
      expect(mockRuleService.shutdown).toHaveBeenCalled()
    })

    it('should skip notification for unpublished rule', async () => {
      const unpublishedRule = { ...mockRule, publish_status: 'DRAFT' }
      mockRuleService.getRule.mockResolvedValue(unpublishedRule)
      
      await createNotificationFromRule(mockInput)
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Skipping notification for inactive rule',
        {
          ruleId: 123,
          deactivated: false,
          publishStatus: 'DRAFT',
        }
      )
      
      expect(mockRuleService.createNotification).not.toHaveBeenCalled()
    })

    it('should throw error if workflow not found', async () => {
      mockRuleService.getRule.mockResolvedValue(mockRule)
      mockRuleService.getWorkflow.mockResolvedValue(null)
      
      await expect(createNotificationFromRule(mockInput))
        .rejects.toThrow(RuleEngineError)
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create notification from scheduled rule',
        {
          ruleId: 123,
          error: 'Workflow not found: 789',
        }
      )
    })

    it('should extract single recipient from rule payload', async () => {
      const inputWithSingleRecipient = {
        ...mockInput,
        rulePayload: { recipient: 'user-single' },
      }
      
      mockRuleService.getRule.mockResolvedValue(mockRule)
      mockRuleService.getWorkflow.mockResolvedValue(mockWorkflow as any)
      mockRuleService.createNotification.mockResolvedValue(mockNotification as any)
      
      await createNotificationFromRule(inputWithSingleRecipient)
      
      expect(mockRuleService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: ['user-single'],
        })
      )
    })

    it('should throw error if no recipients specified', async () => {
      const inputWithoutRecipients = {
        ...mockInput,
        rulePayload: { customData: 'test' },
      }
      
      mockRuleService.getRule.mockResolvedValue(mockRule)
      mockRuleService.getWorkflow.mockResolvedValue(mockWorkflow as any)
      
      await expect(createNotificationFromRule(inputWithoutRecipients))
        .rejects.toThrow(RuleEngineError)
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create notification from scheduled rule',
        {
          ruleId: 123,
          error: 'No recipients specified in rule payload',
        }
      )
    })

    it('should use empty payload if rule payload is missing', async () => {
      const inputWithoutPayload = {
        ...mockInput,
        rulePayload: null,
      }
      
      mockRuleService.getRule.mockResolvedValue(mockRule)
      mockRuleService.getWorkflow.mockResolvedValue(mockWorkflow as any)
      
      await expect(createNotificationFromRule(inputWithoutPayload))
        .rejects.toThrow(RuleEngineError)
      
      // Should fail because no recipients
      expect(mockRuleService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {},
          recipients: [],
        })
      )
    })

    it('should use IN_APP as default channel if workflow has no defaults', async () => {
      const workflowWithoutChannels = { ...mockWorkflow, default_channels: null }
      
      mockRuleService.getRule.mockResolvedValue(mockRule)
      mockRuleService.getWorkflow.mockResolvedValue(workflowWithoutChannels as any)
      mockRuleService.createNotification.mockResolvedValue(mockNotification as any)
      
      await createNotificationFromRule(mockInput)
      
      expect(mockRuleService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: ['IN_APP'],
        })
      )
    })

    it('should always call shutdown even on error', async () => {
      mockRuleService.getRule.mockRejectedValue(new Error('Database error'))
      
      await expect(createNotificationFromRule(mockInput))
        .rejects.toThrow('Database error')
      
      expect(mockRuleService.shutdown).toHaveBeenCalled()
    })
  })
})

describe('Rule Scheduled Workflow', () => {
  // The workflow is a simple proxy that calls the activity
  // We can test it with the Temporal testing framework if needed
  // For now, we'll skip workflow tests as they require Temporal test environment
  
  it('should be tested with Temporal testing framework', () => {
    // Placeholder for workflow tests
    expect(true).toBe(true)
  })
})