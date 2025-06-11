import { DynamicWorkflowFactory } from '../app/services/workflow/DynamicWorkflowFactory';
import type { WorkflowConfig } from '../app/services/database/WorkflowService';

// Mock dependencies
const mockNotificationService = {
  updateNotificationStatus: jest.fn()
};

const mockTemplateRenderer = {
  renderTemplate: jest.fn()
};

const mockGetTemplateRenderer = jest.fn(() => mockTemplateRenderer);

// Mock workflow function from @novu/framework
const mockWorkflowFunction = jest.fn();
const mockWorkflow = jest.fn((key, stepFunction, options) => {
  mockWorkflowFunction(key, stepFunction, options);
  return { key, stepFunction, options };
});

jest.mock('@novu/framework', () => ({
  workflow: mockWorkflow
}));

jest.mock('../app/services/database/NotificationService', () => ({
  notificationService: mockNotificationService
}));

jest.mock('../app/services/template/TemplateRenderer', () => ({
  getTemplateRenderer: mockGetTemplateRenderer
}));

describe('DynamicWorkflowFactory', () => {
  const mockEnterpriseId = 'test-enterprise-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDynamicWorkflow', () => {
    it('should create workflow with EMAIL channel', () => {
      const config: WorkflowConfig = {
        workflow_key: 'test-email-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123,
        name: 'Test Email Workflow',
        description: 'Test workflow for email'
      };

      const result = DynamicWorkflowFactory.createDynamicWorkflow(config, mockEnterpriseId);

      expect(mockWorkflow).toHaveBeenCalledWith(
        'test-email-workflow',
        expect.any(Function),
        expect.objectContaining({
          name: 'Test Email Workflow',
          description: 'Test workflow for email',
          tags: ['dynamic']
        })
      );
      expect(result).toBeDefined();
    });

    it('should create workflow with multiple channels', () => {
      const config: WorkflowConfig = {
        workflow_key: 'multi-channel-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL', 'IN_APP', 'SMS', 'PUSH'],
        emailTemplateId: 123,
        inAppTemplateId: 124,
        smsTemplateId: 125,
        pushTemplateId: 126,
        tags: ['multi-channel', 'important']
      };

      const result = DynamicWorkflowFactory.createDynamicWorkflow(config, mockEnterpriseId);

      expect(mockWorkflow).toHaveBeenCalledWith(
        'multi-channel-workflow',
        expect.any(Function),
        expect.objectContaining({
          tags: ['multi-channel', 'important']
        })
      );
      expect(result).toBeDefined();
    });

    it('should handle workflow execution with notification status updates', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'status-tracking-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      // Mock template rendering
      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        subject: 'Test Subject',
        body: 'Test Body Content'
      });

      // Create workflow
      DynamicWorkflowFactory.createDynamicWorkflow(config, mockEnterpriseId);

      // Get the step function that was passed to workflow()
      const stepFunction = mockWorkflow.mock.calls[0][1];

      // Mock step object
      const mockStep = {
        email: jest.fn().mockResolvedValue({ success: true })
      };

      // Mock payload
      const payload = {
        notificationId: 456,
        data: { message: 'Test message' }
      };

      // Execute the workflow step function
      await stepFunction({ step: mockStep, payload });

      // Verify status updates
      expect(mockNotificationService.updateNotificationStatus).toHaveBeenCalledWith(
        456,
        'PROCESSING',
        mockEnterpriseId
      );

      expect(mockNotificationService.updateNotificationStatus).toHaveBeenCalledWith(
        456,
        'SENT',
        mockEnterpriseId
      );

      // Verify template rendering
      expect(mockTemplateRenderer.renderTemplate).toHaveBeenCalledWith(
        '123',
        mockEnterpriseId,
        { message: 'Test message' }
      );

      // Verify email step execution
      expect(mockStep.email).toHaveBeenCalledWith(
        'dynamic-email',
        expect.any(Function)
      );
    });

    it('should handle workflow execution errors and update status to FAILED', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'error-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      // Mock template rendering to throw error
      mockTemplateRenderer.renderTemplate.mockRejectedValue(
        new Error('Template not found')
      );

      // Create workflow
      DynamicWorkflowFactory.createDynamicWorkflow(config, mockEnterpriseId);

      // Get the step function
      const stepFunction = mockWorkflow.mock.calls[0][1];

      // Mock step object
      const mockStep = {
        email: jest.fn()
      };

      const payload = {
        notificationId: 789,
        data: {}
      };

      // Execute workflow and expect it to throw
      await expect(stepFunction({ step: mockStep, payload })).rejects.toThrow('Template not found');

      // Verify FAILED status update
      expect(mockNotificationService.updateNotificationStatus).toHaveBeenCalledWith(
        789,
        'FAILED',
        mockEnterpriseId,
        'Template not found'
      );
    });

    it('should handle string notificationId by parsing to number', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'string-id-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        subject: 'Test',
        body: 'Test'
      });

      DynamicWorkflowFactory.createDynamicWorkflow(config, mockEnterpriseId);
      const stepFunction = mockWorkflow.mock.calls[0][1];

      const mockStep = {
        email: jest.fn().mockResolvedValue({})
      };

      const payload = {
        notificationId: '123', // String instead of number
        data: {}
      };

      await stepFunction({ step: mockStep, payload });

      // Verify that string ID was parsed to number
      expect(mockNotificationService.updateNotificationStatus).toHaveBeenCalledWith(
        123, // Should be parsed to number
        'PROCESSING',
        mockEnterpriseId
      );
    });

    it('should execute IN_APP channel correctly', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'in-app-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['IN_APP'],
        inAppTemplateId: 124
      };

      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        subject: 'In-App Subject',
        body: 'In-App Body'
      });

      DynamicWorkflowFactory.createDynamicWorkflow(config, mockEnterpriseId);
      const stepFunction = mockWorkflow.mock.calls[0][1];

      const mockStep = {
        inApp: jest.fn().mockImplementation(async (stepId, stepFunc) => {
          const result = await stepFunc();
          return result;
        })
      };

      const payload = {
        data: { message: 'Test in-app message' }
      };

      await stepFunction({ step: mockStep, payload });

      expect(mockStep.inApp).toHaveBeenCalledWith(
        'dynamic-in-app',
        expect.any(Function)
      );

      // Get the step function and execute it to verify the return value
      const inAppStepFunc = mockStep.inApp.mock.calls[0][1];
      const inAppResult = await inAppStepFunc();

      expect(inAppResult).toEqual({
        subject: 'In-App Subject',
        body: 'In-App Body',
        data: { message: 'Test in-app message' }
      });
    });

    it('should execute SMS channel correctly', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'sms-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['SMS'],
        smsTemplateId: 125
      };

      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        body: 'SMS message content'
      });

      DynamicWorkflowFactory.createDynamicWorkflow(config, mockEnterpriseId);
      const stepFunction = mockWorkflow.mock.calls[0][1];

      const mockStep = {
        sms: jest.fn().mockImplementation(async (stepId, stepFunc) => {
          return await stepFunc();
        })
      };

      const payload = { data: {} };

      await stepFunction({ step: mockStep, payload });

      expect(mockStep.sms).toHaveBeenCalledWith(
        'dynamic-sms',
        expect.any(Function)
      );

      // Verify SMS step result
      const smsStepFunc = mockStep.sms.mock.calls[0][1];
      const smsResult = await smsStepFunc();

      expect(smsResult).toEqual({
        body: 'SMS message content'
      });
    });

    it('should execute PUSH channel correctly', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'push-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['PUSH'],
        pushTemplateId: 126
      };

      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        subject: 'Push Title',
        body: 'Push notification body'
      });

      DynamicWorkflowFactory.createDynamicWorkflow(config, mockEnterpriseId);
      const stepFunction = mockWorkflow.mock.calls[0][1];

      const mockStep = {
        push: jest.fn().mockImplementation(async (stepId, stepFunc) => {
          return await stepFunc();
        })
      };

      const payload = { data: {} };

      await stepFunction({ step: mockStep, payload });

      expect(mockStep.push).toHaveBeenCalledWith(
        'dynamic-push',
        expect.any(Function)
      );

      // Verify PUSH step result
      const pushStepFunc = mockStep.push.mock.calls[0][1];
      const pushResult = await pushStepFunc();

      expect(pushResult).toEqual({
        title: 'Push Title',
        body: 'Push notification body'
      });
    });

    it('should skip channels without template IDs', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'incomplete-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL', 'SMS'],
        emailTemplateId: 123
        // Missing smsTemplateId
      };

      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        subject: 'Email Subject',
        body: 'Email Body'
      });

      DynamicWorkflowFactory.createDynamicWorkflow(config, mockEnterpriseId);
      const stepFunction = mockWorkflow.mock.calls[0][1];

      const mockStep = {
        email: jest.fn().mockResolvedValue({}),
        sms: jest.fn().mockResolvedValue({})
      };

      const payload = { data: {} };

      await stepFunction({ step: mockStep, payload });

      // Email should be executed
      expect(mockStep.email).toHaveBeenCalled();
      
      // SMS should be skipped (no smsTemplateId)
      expect(mockStep.sms).not.toHaveBeenCalled();
    });
  });

  describe('validateWorkflowConfig', () => {
    it('should validate complete workflow config', () => {
      const config: WorkflowConfig = {
        workflow_key: 'valid-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL', 'IN_APP'],
        emailTemplateId: 123,
        inAppTemplateId: 124
      };

      const result = DynamicWorkflowFactory.validateWorkflowConfig(config);
      expect(result).toBe(true);
    });

    it('should reject config without workflow_key', () => {
      const config: WorkflowConfig = {
        workflow_key: '',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      const result = DynamicWorkflowFactory.validateWorkflowConfig(config);
      expect(result).toBe(false);
    });

    it('should reject config without channels', () => {
      const config: WorkflowConfig = {
        workflow_key: 'no-channels',
        workflow_type: 'DYNAMIC',
        channels: []
      };

      const result = DynamicWorkflowFactory.validateWorkflowConfig(config);
      expect(result).toBe(false);
    });

    it('should reject config with EMAIL channel but no emailTemplateId', () => {
      const config: WorkflowConfig = {
        workflow_key: 'missing-email-template',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
        // Missing emailTemplateId
      };

      const result = DynamicWorkflowFactory.validateWorkflowConfig(config);
      expect(result).toBe(false);
    });

    it('should reject config with unknown channel', () => {
      const config: WorkflowConfig = {
        workflow_key: 'unknown-channel',
        workflow_type: 'DYNAMIC',
        channels: ['UNKNOWN_CHANNEL' as any]
      };

      const result = DynamicWorkflowFactory.validateWorkflowConfig(config);
      expect(result).toBe(false);
    });

    it('should handle INAPP channel alias', () => {
      const config: WorkflowConfig = {
        workflow_key: 'inapp-alias',
        workflow_type: 'DYNAMIC',
        channels: ['INAPP'],
        inAppTemplateId: 123
      };

      const result = DynamicWorkflowFactory.validateWorkflowConfig(config);
      expect(result).toBe(true);
    });
  });

  describe('createDefaultPayloadSchema', () => {
    it('should create default Zod schema with building-specific fields', () => {
      const schema = DynamicWorkflowFactory.createDefaultPayloadSchema();
      
      // Test the schema accepts valid payloads
      const validPayload = {
        notificationId: '123',
        data: { message: 'test' },
        subscriberId: 'user-456',
        enterprise_id: 'enterprise-789',
        buildingId: 'building-123',
        campusId: 'campus-456',
        priority: 'high' as const,
        category: 'security' as const
      };

      const result = schema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should allow minimal payload', () => {
      const schema = DynamicWorkflowFactory.createDefaultPayloadSchema();
      
      const minimalPayload = {};
      const result = schema.safeParse(minimalPayload);
      expect(result.success).toBe(true);
    });

    it('should validate priority enum', () => {
      const schema = DynamicWorkflowFactory.createDefaultPayloadSchema();
      
      const invalidPayload = {
        priority: 'invalid-priority'
      };

      const result = schema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should validate category enum', () => {
      const schema = DynamicWorkflowFactory.createDefaultPayloadSchema();
      
      const invalidPayload = {
        category: 'invalid-category'
      };

      const result = schema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });
});