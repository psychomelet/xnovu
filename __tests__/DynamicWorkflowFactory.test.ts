import { DynamicWorkflowFactory } from '../app/services/workflow/DynamicWorkflowFactory';
import { NotificationService } from '../app/services/database/NotificationService';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/supabase/database.types';
import type { WorkflowConfig } from '../app/services/database/WorkflowService';
import { randomUUID } from 'crypto';

// Types
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];
type SupabaseClient = ReturnType<typeof createClient<Database>>;

// Mock @novu/framework with enhanced functionality for testing
jest.mock('@novu/framework', () => ({
  workflow: jest.fn((key, stepFunction, options) => {
    return { 
      key, 
      stepFunction, 
      options,
      trigger: jest.fn().mockResolvedValue({ success: true, transactionId: 'test-txn' })
    };
  })
}));

// Mock template renderer with real-like behavior
jest.mock('../app/services/template/TemplateRenderer', () => ({
  getTemplateRenderer: jest.fn(() => ({
    renderTemplate: jest.fn()
  }))
}));

describe('DynamicWorkflowFactory with Real Services', () => {
  let supabase: SupabaseClient;
  let notificationService: NotificationService;
  const testEnterpriseId = randomUUID();
  const testUserId = randomUUID();
  const createdNotificationIds: number[] = [];
  const createdWorkflowIds: number[] = [];
  
  // Get mock functions
  const mockWorkflow = jest.mocked(require('@novu/framework').workflow);
  const mockGetTemplateRenderer = jest.mocked(require('../app/services/template/TemplateRenderer').getTemplateRenderer);
  const mockRenderTemplate = jest.fn();

  // Check if we have real credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
  const hasRealCredentials = supabaseUrl && 
    supabaseServiceKey && 
    supabaseUrl.includes('supabase.co') && 
    supabaseServiceKey.length > 50;

  beforeAll(async () => {
    if (!hasRealCredentials) {
      throw new Error('Real Supabase credentials required for DynamicWorkflowFactory tests. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-dynamic-workflow-factory' } }
    });
    
    notificationService = new NotificationService();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup template renderer mock
    mockRenderTemplate.mockResolvedValue({
      subject: 'Test Subject',
      body: 'Test Body Content'
    });
    mockGetTemplateRenderer.mockReturnValue({
      renderTemplate: mockRenderTemplate
    });
    
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
  });

  async function cleanupTestData() {
    if (!hasRealCredentials) return;
    
    try {
      // Delete test notifications
      if (createdNotificationIds.length > 0) {
        await supabase
          .schema('notify')
          .from('ent_notification')
          .delete()
          .in('id', createdNotificationIds);
        createdNotificationIds.length = 0;
      }

      // Delete test workflows
      if (createdWorkflowIds.length > 0) {
        await supabase
          .schema('notify')
          .from('ent_notification_workflow')
          .delete()
          .in('id', createdWorkflowIds);
        createdWorkflowIds.length = 0;
      }
      
      // Delete by exact enterprise ID
      await supabase
        .schema('notify')
        .from('ent_notification')
        .delete()
        .eq('enterprise_id', testEnterpriseId);

      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('enterprise_id', testEnterpriseId);
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }

  async function createTestWorkflow(overrides: Partial<WorkflowInsert> = {}): Promise<WorkflowRow> {
    const defaultWorkflow: WorkflowInsert = {
      name: 'Test Workflow',
      workflow_key: `test-workflow-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      workflow_type: 'DYNAMIC',
      default_channels: ['EMAIL'],
      enterprise_id: testEnterpriseId,
      ...overrides
    };

    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .insert(defaultWorkflow)
      .select()
      .single();

    if (error) throw error;
    if (data) createdWorkflowIds.push(data.id);
    return data!;
  }

  async function createTestNotification(overrides: Partial<NotificationInsert> = {}): Promise<NotificationRow> {
    // Create a workflow first if not provided
    let workflowId = overrides.notification_workflow_id;
    if (!workflowId) {
      const workflow = await createTestWorkflow();
      workflowId = workflow.id;
    }

    const defaultNotification: NotificationInsert = {
      name: 'Test Notification',
      payload: { message: 'Test message' },
      recipients: [testUserId],
      notification_workflow_id: workflowId,
      enterprise_id: testEnterpriseId,
      ...overrides
    };

    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .insert(defaultNotification)
      .select()
      .single();

    if (error) throw error;
    if (data) createdNotificationIds.push(data.id);
    return data!;
  }

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

      const result = DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);

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

      const result = DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);

      expect(mockWorkflow).toHaveBeenCalledWith(
        'multi-channel-workflow',
        expect.any(Function),
        expect.objectContaining({
          tags: ['multi-channel', 'important']
        })
      );
      expect(result).toBeDefined();
    });

    it('should handle workflow execution with real notification status updates', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'status-tracking-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      // Create a real notification in the database
      const testNotification = await createTestNotification({
        name: 'Status Tracking Test',
        notification_status: 'PENDING'
      });

      // Create workflow
      DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);

      // Get the step function that was passed to workflow()
      const stepFunction = mockWorkflow.mock.calls[0][1];

      // Mock step object
      const mockStep = {
        email: jest.fn().mockResolvedValue({ success: true })
      };

      // Mock payload
      const payload = {
        notificationId: testNotification.id,
        data: { message: 'Test message' }
      };

      // Execute the workflow step function
      await stepFunction({ step: mockStep, payload });

      // Verify template rendering was called
      expect(mockRenderTemplate).toHaveBeenCalledWith(
        '123',
        testEnterpriseId,
        { message: 'Test message' }
      );

      // Verify email step execution
      expect(mockStep.email).toHaveBeenCalledWith(
        'dynamic-email',
        expect.any(Function)
      );

      // Verify notification status was updated in database
      const updatedNotification = await notificationService.getNotification(testNotification.id, testEnterpriseId);
      expect(updatedNotification).toBeDefined();
      // The notification should have been processed (status updated to PROCESSING and then SENT)
      expect(['PROCESSING', 'SENT']).toContain(updatedNotification!.notification_status);
    });

    it('should handle workflow execution errors and update status to FAILED in database', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'error-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      // Create a real notification in the database
      const testNotification = await createTestNotification({
        name: 'Error Test Notification',
        notification_status: 'PENDING'
      });

      // Mock template rendering to throw error
      mockRenderTemplate.mockRejectedValue(
        new Error('Template not found')
      );

      // Create workflow
      DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);

      // Get the step function
      const stepFunction = mockWorkflow.mock.calls[0][1];

      // Mock step object
      const mockStep = {
        email: jest.fn()
      };

      const payload = {
        notificationId: testNotification.id,
        data: {}
      };

      // Execute workflow and expect it to throw
      await expect(stepFunction({ step: mockStep, payload })).rejects.toThrow('Template not found');

      // Verify notification status was updated to FAILED in database
      const updatedNotification = await notificationService.getNotification(testNotification.id, testEnterpriseId);
      expect(updatedNotification).toBeDefined();
      expect(updatedNotification!.notification_status).toBe('FAILED');
      expect(updatedNotification!.error_details).toBe('Template not found');
    });

    it('should handle string notificationId by parsing to number', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'string-id-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      // Create a real notification in the database
      const testNotification = await createTestNotification({
        name: 'String ID Test',
        notification_status: 'PENDING'
      });

      DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);
      const stepFunction = mockWorkflow.mock.calls[0][1];

      const mockStep = {
        email: jest.fn().mockResolvedValue({})
      };

      const payload = {
        notificationId: testNotification.id.toString(), // String instead of number
        data: {}
      };

      await stepFunction({ step: mockStep, payload });

      // Verify notification was updated (proves string ID was parsed correctly)
      const updatedNotification = await notificationService.getNotification(testNotification.id, testEnterpriseId);
      expect(updatedNotification).toBeDefined();
      expect(['PROCESSING', 'SENT']).toContain(updatedNotification!.notification_status);
    });

    it('should execute IN_APP channel correctly', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'in-app-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['IN_APP'],
        inAppTemplateId: 124
      };

      mockRenderTemplate.mockResolvedValue({
        subject: 'In-App Subject',
        body: 'In-App Body'
      });

      DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);
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

      mockRenderTemplate.mockResolvedValue({
        body: 'SMS message content'
      });

      DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);
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

      mockRenderTemplate.mockResolvedValue({
        subject: 'Push Title',
        body: 'Push notification body'
      });

      DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);
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

      mockRenderTemplate.mockResolvedValue({
        subject: 'Email Subject',
        body: 'Email Body'
      });

      DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);
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
        enterprise_id: testEnterpriseId,
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

  // Integration tests with real database operations
  describe('Real Database Integration', () => {
    it('should update notification status through complete workflow execution', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'full-integration-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL', 'IN_APP'],
        emailTemplateId: 123,
        inAppTemplateId: 124
      };

      // Create real notifications in database
      const emailNotification = await createTestNotification({
        name: 'Email Integration Test',
        notification_status: 'PENDING'
      });

      const inAppNotification = await createTestNotification({
        name: 'In-App Integration Test', 
        notification_status: 'PENDING'
      });

      // Create workflow
      DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);
      const stepFunction = mockWorkflow.mock.calls[0][1];

      // Mock successful step execution
      const mockStep = {
        email: jest.fn().mockResolvedValue({ success: true }),
        inApp: jest.fn().mockResolvedValue({ success: true })
      };

      // Execute workflow for email notification
      await stepFunction({ 
        step: mockStep, 
        payload: { 
          notificationId: emailNotification.id,
          data: { message: 'Email test' }
        }
      });

      // Execute workflow for in-app notification  
      await stepFunction({
        step: mockStep,
        payload: {
          notificationId: inAppNotification.id,
          data: { message: 'In-app test' }
        }
      });

      // Verify both notifications were processed in database
      const updatedEmailNotification = await notificationService.getNotification(emailNotification.id, testEnterpriseId);
      const updatedInAppNotification = await notificationService.getNotification(inAppNotification.id, testEnterpriseId);

      expect(updatedEmailNotification).toBeDefined();
      expect(['PROCESSING', 'SENT']).toContain(updatedEmailNotification!.notification_status);

      expect(updatedInAppNotification).toBeDefined();
      expect(['PROCESSING', 'SENT']).toContain(updatedInAppNotification!.notification_status);

      // Verify both email and in-app steps were called
      expect(mockStep.email).toHaveBeenCalled();
      expect(mockStep.inApp).toHaveBeenCalled();
    });

    it('should handle partial failures across multiple channels', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'partial-failure-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL', 'SMS'],
        emailTemplateId: 123,
        smsTemplateId: 125
      };

      // Create real notification
      const testNotification = await createTestNotification({
        name: 'Partial Failure Test',
        notification_status: 'PENDING'
      });

      // Mock email template to succeed, SMS to fail
      mockRenderTemplate
        .mockResolvedValueOnce({ subject: 'Email OK', body: 'Email content' }) // EMAIL
        .mockRejectedValueOnce(new Error('SMS template error')); // SMS

      DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);
      const stepFunction = mockWorkflow.mock.calls[0][1];

      const mockStep = {
        email: jest.fn().mockResolvedValue({ success: true }),
        sms: jest.fn().mockResolvedValue({ success: true })
      };

      // Execute workflow - should fail on SMS template rendering
      await expect(stepFunction({
        step: mockStep,
        payload: {
          notificationId: testNotification.id,
          data: { message: 'Test message' }
        }
      })).rejects.toThrow('SMS template error');

      // Verify notification was marked as failed
      const updatedNotification = await notificationService.getNotification(testNotification.id, testEnterpriseId);
      expect(updatedNotification).toBeDefined();
      expect(updatedNotification!.notification_status).toBe('FAILED');
      expect(updatedNotification!.error_details).toBe('SMS template error');
    });
  });
});