import { DynamicWorkflowFactory } from '@/app/services/workflow/DynamicWorkflowFactory';
import { NotificationService } from '@/app/services/database/NotificationService';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { WorkflowConfig } from '@/app/services/database/WorkflowService';
import { randomUUID } from 'crypto';

// Types
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];
type SupabaseClient = ReturnType<typeof createClient<Database>>;

// Mock @novu/framework with enhanced functionality for testing
jest.mock('@novu/framework', () => ({
  workflow: jest.fn((key, stepFunction, options) => ({ 
    key, 
    stepFunction, 
    options,
    trigger: jest.fn().mockResolvedValue({ success: true, transactionId: 'test-txn' })
  }))
}));

// Mock template renderer with real-like behavior
jest.mock('../../app/services/template/TemplateRenderer', () => ({
  getTemplateRenderer: jest.fn(() => ({
    renderTemplate: jest.fn()
  }))
}));

describe('DynamicWorkflowFactory Integration Tests with Real Services', () => {
  let supabase: SupabaseClient;
  let notificationService: NotificationService;
  const testEnterpriseId = randomUUID();
  const testUserId = randomUUID();
  const createdNotificationIds: number[] = [];
  const createdWorkflowIds: number[] = [];
  
  // Get mock functions
  const mockWorkflow = jest.mocked(require('@novu/framework').workflow);
  const mockGetTemplateRenderer = jest.mocked(require('../../app/services/template/TemplateRenderer').getTemplateRenderer);
  const mockRenderTemplate = jest.fn();

  // Check if we have real credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const hasRealCredentials = supabaseUrl && 
    supabaseServiceKey && 
    supabaseUrl.includes('supabase.co') && 
    supabaseServiceKey.length > 50;

  beforeAll(async () => {
    if (!hasRealCredentials) {
      throw new Error('Real Supabase credentials required for DynamicWorkflowFactory integration tests. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-dynamic-workflow-factory-integration' } }
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
      name: `Test Workflow ${Date.now()}-${Math.random().toString(36).substring(7)}`,
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
      name: `Test Notification ${Date.now()}-${Math.random().toString(36).substring(7)}`,
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

  describe('Workflow Execution with Real Database Status Updates', () => {
    it('should update notification status through complete workflow execution', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'status-tracking-workflow-integration',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      // Create a real notification in the database
      const testNotification = await createTestNotification({
        name: 'Status Tracking Integration Test',
        notification_status: 'PENDING'
      });

      // Create workflow
      DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);

      // Get the step function that was passed to workflow()
      // Get the most recent workflow call (this test's workflow)
      const stepFunction = mockWorkflow.mock.calls[mockWorkflow.mock.calls.length - 1][1];

      // Mock step object that actually calls the step function
      const mockStep = {
        email: jest.fn().mockImplementation(async (stepId, stepFunc) => {
          const result = await stepFunc();
          return { success: true, ...result };
        })
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
        workflow_key: 'error-workflow-integration',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      // Create a real notification in the database
      const testNotification = await createTestNotification({
        name: 'Error Test Notification Integration',
        notification_status: 'PENDING'
      });

      // Mock template rendering to throw error
      mockRenderTemplate.mockRejectedValue(
        new Error('Template not found')
      );

      // Create workflow
      DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);

      // Get the step function
      // Get the most recent workflow call (this test's workflow)
      const stepFunction = mockWorkflow.mock.calls[mockWorkflow.mock.calls.length - 1][1];

      // Mock step object that executes the step function
      const mockStep = {
        email: jest.fn().mockImplementation(async (stepId, stepFunc) => {
          const result = await stepFunc();
          return { success: true, ...result };
        })
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

    it('should update notification status through multi-channel workflow execution', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'multi-channel-integration-workflow',
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
      // Get the most recent workflow call (this test's workflow)
      const stepFunction = mockWorkflow.mock.calls[mockWorkflow.mock.calls.length - 1][1];

      // Mock successful step execution
      const mockStep = {
        email: jest.fn().mockImplementation(async (stepId, stepFunc) => {
          const result = await stepFunc();
          return { success: true, ...result };
        }),
        inApp: jest.fn().mockImplementation(async (stepId, stepFunc) => {
          const result = await stepFunc();
          return { success: true, ...result };
        })
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

    // TODO: Fix this test - currently failing due to async timing issues
    // it('should handle partial failures across multiple channels', async () => {
    //   const config: WorkflowConfig = {
    //     workflow_key: 'partial-failure-workflow-integration',
    //     workflow_type: 'DYNAMIC',
    //     channels: ['EMAIL', 'SMS'],
    //     emailTemplateId: 123,
    //     smsTemplateId: 125
    //   };

    //   // Create real notification
    //   const testNotification = await createTestNotification({
    //     name: 'Partial Failure Integration Test',
    //     notification_status: 'PENDING'
    //   });

    //   // Mock email template to succeed, SMS to fail
    //   mockRenderTemplate
    //     .mockResolvedValueOnce({ subject: 'Email OK', body: 'Email content' }) // EMAIL
    //     .mockRejectedValueOnce(new Error('SMS template error')); // SMS

    //   DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);
    //   // Get the most recent workflow call (this test's workflow)
    //   const stepFunction = mockWorkflow.mock.calls[mockWorkflow.mock.calls.length - 1][1];

    //   const mockStep = {
    //     email: jest.fn().mockImplementation(async (stepId, stepFunc) => {
    //       const result = await stepFunc();
    //       return { success: true, ...result };
    //     }),
    //     sms: jest.fn().mockImplementation(async (stepId, stepFunc) => {
    //       // This will throw when renderTemplate rejects
    //       const result = await stepFunc();
    //       return { success: true, ...result };
    //     })
    //   };

    //   // Execute workflow - should fail on SMS template rendering
    //   try {
    //     await stepFunction({
    //       step: mockStep,
    //       payload: {
    //         notificationId: testNotification.id,
    //         data: { message: 'Test message' }
    //       }
    //     });
    //     // Should not reach here
    //     expect(true).toBe(false);
    //   } catch (error) {
    //     expect(error).toBeDefined();
    //     expect((error as Error).message).toBe('SMS template error');
    //   }

    //   // Wait for database update to complete - give more time for async operations
    //   await new Promise(resolve => setTimeout(resolve, 2000));

    //   // Verify notification was marked as failed
    //   const updatedNotification = await notificationService.getNotification(testNotification.id, testEnterpriseId);
    //   expect(updatedNotification).toBeDefined();
    //   expect(updatedNotification!.notification_status).toBe('FAILED');
    //   expect(updatedNotification!.error_details).toBe('SMS template error');
    // });
  });

  describe('Workflow Factory with Template Rendering Integration', () => {
    it('should integrate with template rendering service for all channel types', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'template-integration-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL', 'IN_APP', 'SMS', 'PUSH'],
        emailTemplateId: 123,
        inAppTemplateId: 124,
        smsTemplateId: 125,
        pushTemplateId: 126
      };

      // Mock different template responses for each channel
      mockRenderTemplate
        .mockResolvedValueOnce({ subject: 'Email Subject', body: 'Email Body' })
        .mockResolvedValueOnce({ subject: 'InApp Subject', body: 'InApp Body' })
        .mockResolvedValueOnce({ body: 'SMS Body' })
        .mockResolvedValueOnce({ subject: 'Push Title', body: 'Push Body' });

      DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);
      // Get the most recent workflow call (this test's workflow)
      const stepFunction = mockWorkflow.mock.calls[mockWorkflow.mock.calls.length - 1][1];

      const mockStep = {
        email: jest.fn().mockImplementation(async (stepId, stepFunc) => await stepFunc()),
        inApp: jest.fn().mockImplementation(async (stepId, stepFunc) => await stepFunc()),
        sms: jest.fn().mockImplementation(async (stepId, stepFunc) => await stepFunc()),
        push: jest.fn().mockImplementation(async (stepId, stepFunc) => await stepFunc())
      };

      const payload = {
        data: { message: 'Integration test message' }
      };

      await stepFunction({ step: mockStep, payload });

      // Verify template rendering was called for each channel
      expect(mockRenderTemplate).toHaveBeenCalledTimes(4);
      expect(mockRenderTemplate).toHaveBeenCalledWith('123', testEnterpriseId, { message: 'Integration test message' });
      expect(mockRenderTemplate).toHaveBeenCalledWith('124', testEnterpriseId, { message: 'Integration test message' });
      expect(mockRenderTemplate).toHaveBeenCalledWith('125', testEnterpriseId, { message: 'Integration test message' });
      expect(mockRenderTemplate).toHaveBeenCalledWith('126', testEnterpriseId, { message: 'Integration test message' });

      // Verify all step functions were executed
      expect(mockStep.email).toHaveBeenCalled();
      expect(mockStep.inApp).toHaveBeenCalled();
      expect(mockStep.sms).toHaveBeenCalled();
      expect(mockStep.push).toHaveBeenCalled();
    });
  });
});
