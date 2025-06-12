/**
 * Dynamic Workflow Integration Tests with Real Database
 * 
 * These tests verify that the Dynamic Workflow system components
 * are properly integrated and can work together with real Supabase connections.
 */

import { DynamicWorkflowFactory } from '../app/services/workflow/DynamicWorkflowFactory';
import { WorkflowService } from '../app/services/database/WorkflowService';
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
  workflow: jest.fn((key, stepFunction, options) => ({
    workflowId: key,
    stepFunction,
    options,
    trigger: jest.fn().mockResolvedValue({ success: true, transactionId: 'test-txn' })
  }))
}));

// Mock template renderer with real-like behavior
jest.mock('../app/services/template/TemplateRenderer', () => ({
  getTemplateRenderer: () => ({
    renderTemplate: jest.fn()
  })
}));

describe('Dynamic Workflow Integration Tests with Real Database', () => {
  let supabase: SupabaseClient;
  let workflowService: WorkflowService;
  let notificationService: NotificationService;
  const testEnterpriseId = randomUUID();
  const testUserId = randomUUID();
  const createdNotificationIds: number[] = [];
  const createdWorkflowIds: number[] = [];
  
  // Get mock functions
  const mockWorkflow = jest.mocked(require('@novu/framework').workflow);
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
      throw new Error('Real Supabase credentials required for Dynamic Workflow Integration tests. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-dynamic-workflow-integration' } }
    });
    
    workflowService = new WorkflowService();
    notificationService = new NotificationService();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup default template rendering response
    mockRenderTemplate.mockResolvedValue({
      subject: 'Test Subject',
      body: 'Test Body Content'
    });
    
    // Setup template renderer mock
    const mockGetTemplateRenderer = jest.mocked(require('../app/services/template/TemplateRenderer').getTemplateRenderer);
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

  describe('End-to-End Workflow Creation and Execution', () => {
    it('should create workflow from database configuration and execute with real notification tracking', async () => {
      // Create workflow configuration in database
      const workflowData = await createTestWorkflow({
        name: 'Building Alert Integration',
        workflow_key: 'building-alert-integration',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 123 },
        description: 'Integration test workflow'
      });

      // Parse configuration from database
      const config = await workflowService.parseWorkflowConfig(workflowData);

      // Create dynamic workflow using factory
      const workflow = DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);

      expect(workflow).toBeDefined();
      expect(workflow.workflowId).toBe('building-alert-integration');
      expect(workflow.options.name).toBe('Building Alert Integration');
      expect(workflow.options.description).toBe('Integration test workflow');

      // Create real notification in database
      const notification = await createTestNotification({
        name: 'Integration Test Notification',
        notification_workflow_id: workflowData.id,
        notification_status: 'PENDING'
      });

      // Execute workflow step function
      const stepFunction = mockWorkflow.mock.calls[0][1];
      const mockStep = {
        email: jest.fn().mockResolvedValue({ success: true })
      };

      await stepFunction({
        step: mockStep,
        payload: {
          notificationId: notification.id,
          data: { message: 'Building HVAC failure detected' }
        }
      });

      // Verify notification status was updated in database
      const updatedNotification = await notificationService.getNotification(notification.id, testEnterpriseId);
      expect(updatedNotification).toBeDefined();
      expect(['PROCESSING', 'SENT']).toContain(updatedNotification!.notification_status);
    });

    it('should handle multi-channel workflow configuration from database', async () => {
      // Create multi-channel workflow in database
      const workflowData = await createTestWorkflow({
        name: 'Multi-Channel Alert',
        workflow_key: 'multi-channel-alert',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP', 'SMS'],
        template_overrides: {
          emailTemplateId: 123,
          inAppTemplateId: 124,
          smsTemplateId: 125
        }
      });

      // Parse and create workflow
      const config = await workflowService.parseWorkflowConfig(workflowData);
      const workflow = DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);

      expect(workflow).toBeDefined();
      expect(workflow.workflowId).toBe('multi-channel-alert');

      // Verify all channels are configured
      expect(config.channels).toEqual(['EMAIL', 'IN_APP', 'SMS']);
      expect(config.emailTemplateId).toBe(123);
      expect(config.inAppTemplateId).toBe(124);
      expect(config.smsTemplateId).toBe(125);
    });
  });

  describe('Database-Driven Workflow Validation', () => {
    it('should validate workflow configuration correctly', async () => {
      // Create valid workflow configuration
      const validConfig: WorkflowConfig = {
        workflow_key: 'valid-integration-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL', 'IN_APP'],
        emailTemplateId: 123,
        inAppTemplateId: 124
      };

      // Create invalid configuration (missing required template)
      const invalidConfig: WorkflowConfig = {
        workflow_key: 'invalid-integration-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        // Missing emailTemplateId
      };

      expect(DynamicWorkflowFactory.validateWorkflowConfig(validConfig)).toBe(true);
      expect(DynamicWorkflowFactory.validateWorkflowConfig(invalidConfig)).toBe(false);
    });

    it('should create default payload schema with building-specific fields', () => {
      const schema = DynamicWorkflowFactory.createDefaultPayloadSchema();

      // Test valid building-specific payload
      const buildingPayload = {
        buildingId: 'building-123',
        campusId: 'campus-456',
        priority: 'critical' as const,
        category: 'emergency' as const,
        data: {
          floor: 3,
          zone: 'A',
          deviceId: 'hvac-001',
          message: 'HVAC system failure detected'
        }
      };

      const result = schema.safeParse(buildingPayload);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.buildingId).toBe('building-123');
        expect(result.data.priority).toBe('critical');
        expect(result.data.category).toBe('emergency');
      }
    });
  });

  describe('Real Database Workflow Lifecycle', () => {
    it('should handle complete workflow lifecycle from creation to execution', async () => {
      // 1. Create workflow in database
      const workflowData = await createTestWorkflow({
        name: 'Lifecycle Test Workflow',
        workflow_key: 'lifecycle-test-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 456 },
        publish_status: 'DRAFT'
      });

      // 2. Publish workflow
      const publishedWorkflow = await workflowService.publishWorkflow(workflowData.id, testEnterpriseId);
      expect(publishedWorkflow.publish_status).toBe('PUBLISH');

      // 3. Parse configuration and create dynamic workflow
      const config = await workflowService.parseWorkflowConfig(publishedWorkflow);
      const workflow = DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);

      // 4. Create notification for this workflow
      const notification = await createTestNotification({
        name: 'Lifecycle Test Notification',
        notification_workflow_id: publishedWorkflow.id,
        notification_status: 'PENDING'
      });

      // 5. Execute workflow
      const stepFunction = mockWorkflow.mock.calls[0][1];
      const mockStep = {
        email: jest.fn().mockResolvedValue({ success: true })
      };

      await stepFunction({
        step: mockStep,
        payload: {
          notificationId: notification.id,
          data: { message: 'Lifecycle test message' }
        }
      });

      // 6. Verify notification was processed
      const finalNotification = await notificationService.getNotification(notification.id, testEnterpriseId);
      expect(finalNotification).toBeDefined();
      expect(['PROCESSING', 'SENT']).toContain(finalNotification!.notification_status);

      // 7. Unpublish workflow
      const unpublishedWorkflow = await workflowService.unpublishWorkflow(publishedWorkflow.id, testEnterpriseId);
      expect(unpublishedWorkflow.publish_status).toBe('DRAFT');
    });

    it('should handle workflow configuration errors gracefully', async () => {
      // Create workflow with problematic configuration
      const problematicWorkflow = await createTestWorkflow({
        name: 'Problematic Workflow',
        workflow_key: 'problematic-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: null, // This might cause issues
        publish_status: 'PUBLISH'
      });

      // Parsing should handle null template_overrides gracefully
      const config = await workflowService.parseWorkflowConfig(problematicWorkflow);
      expect(config).toBeDefined();
      expect(config.workflow_key).toBe('problematic-workflow');
      expect(config.channels).toEqual(['EMAIL']);
      // Should not have template IDs since template_overrides is null
      expect(config.emailTemplateId).toBeUndefined();

      // Validation should fail due to missing email template
      expect(DynamicWorkflowFactory.validateWorkflowConfig(config)).toBe(false);
    });
  });

  describe('Enterprise Isolation in Integration Scenarios', () => {
    it('should maintain enterprise isolation throughout workflow execution', async () => {
      const otherEnterpriseId = `other-enterprise-${Date.now()}`;

      // Create workflows for different enterprises
      const testEnterpriseWorkflow = await createTestWorkflow({
        name: 'Test Enterprise Workflow',
        workflow_key: 'test-enterprise-workflow',
        enterprise_id: testEnterpriseId,
        publish_status: 'PUBLISH'
      });

      const otherEnterpriseWorkflow = await createTestWorkflow({
        name: 'Other Enterprise Workflow',
        workflow_key: 'other-enterprise-workflow',
        enterprise_id: otherEnterpriseId,
        publish_status: 'PUBLISH'
      });

      // Create notifications for different enterprises
      const testEnterpriseNotification = await createTestNotification({
        name: 'Test Enterprise Notification',
        notification_workflow_id: testEnterpriseWorkflow.id,
        enterprise_id: testEnterpriseId
      });

      const otherEnterpriseNotification = await createTestNotification({
        name: 'Other Enterprise Notification',
        notification_workflow_id: otherEnterpriseWorkflow.id,
        enterprise_id: otherEnterpriseId
      });

      // Verify enterprise isolation in workflow retrieval
      const testWorkflow = await workflowService.getWorkflow(testEnterpriseWorkflow.id, testEnterpriseId);
      const otherWorkflowFromTestEnterprise = await workflowService.getWorkflow(otherEnterpriseWorkflow.id, testEnterpriseId);

      expect(testWorkflow).toBeDefined();
      expect(otherWorkflowFromTestEnterprise).toBeNull(); // Should not access other enterprise's workflow

      // Verify enterprise isolation in notification retrieval
      const testNotification = await notificationService.getNotification(testEnterpriseNotification.id, testEnterpriseId);
      const otherNotificationFromTestEnterprise = await notificationService.getNotification(otherEnterpriseNotification.id, testEnterpriseId);

      expect(testNotification).toBeDefined();
      expect(otherNotificationFromTestEnterprise).toBeNull(); // Should not access other enterprise's notification

      // Clean up additional data
      await supabase
        .schema('notify')
        .from('ent_notification')
        .delete()
        .eq('id', otherEnterpriseNotification.id);

      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('id', otherEnterpriseWorkflow.id);
    });
  });

  describe('Error Handling in Integration Scenarios', () => {
    it('should handle template rendering errors and update notification status in database', async () => {
      // Create workflow and notification
      const workflowData = await createTestWorkflow({
        name: 'Error Test Workflow',
        workflow_key: 'error-test-workflow',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 999 } // Non-existent template
      });

      const notification = await createTestNotification({
        name: 'Error Test Notification',
        notification_workflow_id: workflowData.id,
        notification_status: 'PENDING'
      });

      // Mock template rendering to fail
      mockRenderTemplate.mockRejectedValue(new Error('Template not found'));

      // Create and execute workflow
      const config = await workflowService.parseWorkflowConfig(workflowData);
      const workflow = DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);

      const stepFunction = mockWorkflow.mock.calls[0][1];
      const mockStep = {
        email: jest.fn()
      };

      // Execute workflow - should fail
      await expect(stepFunction({
        step: mockStep,
        payload: {
          notificationId: notification.id,
          data: { message: 'Test message' }
        }
      })).rejects.toThrow('Template not found');

      // Verify notification status was updated to FAILED in database
      const failedNotification = await notificationService.getNotification(notification.id, testEnterpriseId);
      expect(failedNotification).toBeDefined();
      expect(failedNotification!.notification_status).toBe('FAILED');
      expect(failedNotification!.error_details).toBe('Template not found');
    });

    it('should handle database constraint violations gracefully', async () => {
      // Try to create notification with invalid workflow ID
      const invalidNotificationData: NotificationInsert = {
        name: 'Invalid Notification',
        payload: { message: 'Test' },
        recipients: [testUserId],
        notification_workflow_id: 999999, // Non-existent workflow
        enterprise_id: testEnterpriseId
      };

      // Should throw due to foreign key constraint
      await expect(
        notificationService.createNotification(invalidNotificationData)
      ).rejects.toThrow();
    });
  });

  describe('Performance and Scalability Integration', () => {
    it('should handle multiple concurrent workflow executions', async () => {
      // Create workflow and multiple notifications
      const workflowData = await createTestWorkflow({
        name: 'Concurrent Test Workflow',
        workflow_key: 'concurrent-test-workflow',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 123 }
      });

      const notifications = await Promise.all([
        createTestNotification({
          name: 'Concurrent Notification 1',
          notification_workflow_id: workflowData.id
        }),
        createTestNotification({
          name: 'Concurrent Notification 2',
          notification_workflow_id: workflowData.id
        }),
        createTestNotification({
          name: 'Concurrent Notification 3',
          notification_workflow_id: workflowData.id
        })
      ]);

      // Create workflow and execute for all notifications concurrently
      const config = await workflowService.parseWorkflowConfig(workflowData);
      const workflow = DynamicWorkflowFactory.createDynamicWorkflow(config, testEnterpriseId);

      const stepFunction = mockWorkflow.mock.calls[0][1];
      const mockStep = {
        email: jest.fn().mockResolvedValue({ success: true })
      };

      // Execute all workflows concurrently
      const executions = notifications.map(notification =>
        stepFunction({
          step: mockStep,
          payload: {
            notificationId: notification.id,
            data: { message: `Concurrent message ${notification.id}` }
          }
        })
      );

      await Promise.all(executions);

      // Verify all notifications were processed
      const updatedNotifications = await Promise.all(
        notifications.map(n => notificationService.getNotification(n.id, testEnterpriseId))
      );

      updatedNotifications.forEach(notification => {
        expect(notification).toBeDefined();
        expect(['PROCESSING', 'SENT']).toContain(notification!.notification_status);
      });

      // Verify all email steps were called
      expect(mockStep.email).toHaveBeenCalledTimes(3);
    });
  });
});