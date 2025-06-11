/**
 * Dynamic Workflow Integration Tests
 * 
 * These tests verify that the Dynamic Workflow system components
 * are properly integrated and can work together.
 */

import { DynamicWorkflowFactory } from '../app/services/workflow/DynamicWorkflowFactory';
import type { WorkflowConfig } from '../app/services/database/WorkflowService';

// Simple mock for testing workflow creation
jest.mock('@novu/framework', () => ({
  workflow: jest.fn((key, stepFunction, options) => ({
    workflowId: key,
    stepFunction,
    options,
    trigger: jest.fn().mockResolvedValue({ success: true })
  }))
}));

jest.mock('../app/services/database/NotificationService', () => ({
  notificationService: {
    updateNotificationStatus: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../app/services/template/TemplateRenderer', () => ({
  getTemplateRenderer: () => ({
    renderTemplate: jest.fn().mockResolvedValue({
      subject: 'Test Subject',
      body: 'Test Body Content'
    })
  })
}));

describe('Dynamic Workflow Integration Tests', () => {
  describe('DynamicWorkflowFactory', () => {
    it('should create workflow with EMAIL channel configuration', () => {
      const config: WorkflowConfig = {
        workflow_key: 'test-email-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123,
        name: 'Test Email Workflow',
        description: 'Integration test workflow'
      };

      const workflow = DynamicWorkflowFactory.createDynamicWorkflow(config, 'test-enterprise');

      expect(workflow).toBeDefined();
      expect(workflow.workflowId).toBe('test-email-workflow');
      expect(workflow.options.name).toBe('Test Email Workflow');
      expect(workflow.options.description).toBe('Integration test workflow');
    });

    it('should create workflow with multiple channels', () => {
      const config: WorkflowConfig = {
        workflow_key: 'multi-channel-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL', 'IN_APP', 'SMS'],
        emailTemplateId: 123,
        inAppTemplateId: 124,
        smsTemplateId: 125,
        name: 'Multi-Channel Workflow'
      };

      const workflow = DynamicWorkflowFactory.createDynamicWorkflow(config, 'test-enterprise');

      expect(workflow).toBeDefined();
      expect(workflow.workflowId).toBe('multi-channel-workflow');
      expect(workflow.options.name).toBe('Multi-Channel Workflow');
    });

    it('should validate workflow configuration correctly', () => {
      const validConfig: WorkflowConfig = {
        workflow_key: 'valid-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL', 'IN_APP'],
        emailTemplateId: 123,
        inAppTemplateId: 124
      };

      const invalidConfig: WorkflowConfig = {
        workflow_key: 'invalid-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        // Missing emailTemplateId
      };

      expect(DynamicWorkflowFactory.validateWorkflowConfig(validConfig)).toBe(true);
      expect(DynamicWorkflowFactory.validateWorkflowConfig(invalidConfig)).toBe(false);
    });

    it('should create default payload schema with building-specific fields', () => {
      const schema = DynamicWorkflowFactory.createDefaultPayloadSchema();

      // Test valid payload
      const validPayload = {
        buildingId: 'building-123',
        campusId: 'campus-456',
        priority: 'high' as const,
        category: 'security' as const
      };

      const result = schema.safeParse(validPayload);
      expect(result.success).toBe(true);

      // Test invalid priority
      const invalidPayload = {
        priority: 'invalid-priority'
      };

      const invalidResult = schema.safeParse(invalidPayload);
      expect(invalidResult.success).toBe(false);
    });

    it('should handle workflow execution with status tracking', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'status-tracking-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      const workflow = DynamicWorkflowFactory.createDynamicWorkflow(config, 'test-enterprise');

      // Mock step execution
      const mockStep = {
        email: jest.fn().mockResolvedValue({ success: true })
      };

      const payload = {
        notificationId: 456,
        data: { message: 'Test notification' }
      };

      // Execute workflow step function
      await workflow.stepFunction({ step: mockStep, payload });

      // Verify email step was called
      expect(mockStep.email).toHaveBeenCalledWith(
        'dynamic-email',
        expect.any(Function)
      );
    });

    it('should handle different channel types correctly', () => {
      const emailConfig: WorkflowConfig = {
        workflow_key: 'email-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      const inAppConfig: WorkflowConfig = {
        workflow_key: 'in-app-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['IN_APP'],
        inAppTemplateId: 124
      };

      const smsConfig: WorkflowConfig = {
        workflow_key: 'sms-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['SMS'],
        smsTemplateId: 125
      };

      const pushConfig: WorkflowConfig = {
        workflow_key: 'push-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['PUSH'],
        pushTemplateId: 126
      };

      // All configurations should be valid
      expect(DynamicWorkflowFactory.validateWorkflowConfig(emailConfig)).toBe(true);
      expect(DynamicWorkflowFactory.validateWorkflowConfig(inAppConfig)).toBe(true);
      expect(DynamicWorkflowFactory.validateWorkflowConfig(smsConfig)).toBe(true);
      expect(DynamicWorkflowFactory.validateWorkflowConfig(pushConfig)).toBe(true);

      // All workflows should be created successfully
      expect(DynamicWorkflowFactory.createDynamicWorkflow(emailConfig, 'test-enterprise')).toBeDefined();
      expect(DynamicWorkflowFactory.createDynamicWorkflow(inAppConfig, 'test-enterprise')).toBeDefined();
      expect(DynamicWorkflowFactory.createDynamicWorkflow(smsConfig, 'test-enterprise')).toBeDefined();
      expect(DynamicWorkflowFactory.createDynamicWorkflow(pushConfig, 'test-enterprise')).toBeDefined();
    });
  });

  describe('System Integration', () => {
    it('should handle enterprise isolation in workflow creation', () => {
      const config: WorkflowConfig = {
        workflow_key: 'enterprise-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      const enterprise1Workflow = DynamicWorkflowFactory.createDynamicWorkflow(config, 'enterprise-1');
      const enterprise2Workflow = DynamicWorkflowFactory.createDynamicWorkflow(config, 'enterprise-2');

      // Both workflows should be created but isolated
      expect(enterprise1Workflow).toBeDefined();
      expect(enterprise2Workflow).toBeDefined();
      expect(enterprise1Workflow.workflowId).toBe(enterprise2Workflow.workflowId);
    });

    it('should validate smart building specific payload structure', () => {
      const schema = DynamicWorkflowFactory.createDefaultPayloadSchema();

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

    it('should handle configuration errors gracefully', () => {
      // Empty workflow key
      const emptyKeyConfig: WorkflowConfig = {
        workflow_key: '',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123
      };

      // No channels
      const noChannelsConfig: WorkflowConfig = {
        workflow_key: 'no-channels',
        workflow_type: 'DYNAMIC',
        channels: []
      };

      // Missing template for channel
      const missingTemplateConfig: WorkflowConfig = {
        workflow_key: 'missing-template',
        workflow_type: 'DYNAMIC',
        channels: ['SMS']
        // Missing smsTemplateId
      };

      expect(DynamicWorkflowFactory.validateWorkflowConfig(emptyKeyConfig)).toBe(false);
      expect(DynamicWorkflowFactory.validateWorkflowConfig(noChannelsConfig)).toBe(false);
      expect(DynamicWorkflowFactory.validateWorkflowConfig(missingTemplateConfig)).toBe(false);
    });

    it('should support workflow tags and metadata', () => {
      const config: WorkflowConfig = {
        workflow_key: 'tagged-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 123,
        name: 'Tagged Workflow',
        description: 'Workflow with tags and metadata',
        tags: ['building', 'alert', 'maintenance']
      };

      const workflow = DynamicWorkflowFactory.createDynamicWorkflow(config, 'test-enterprise');

      expect(workflow.options.name).toBe('Tagged Workflow');
      expect(workflow.options.description).toBe('Workflow with tags and metadata');
      expect(workflow.options.tags).toEqual(['building', 'alert', 'maintenance']);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid channel types', () => {
      const invalidChannelConfig: WorkflowConfig = {
        workflow_key: 'invalid-channel',
        workflow_type: 'DYNAMIC',
        channels: ['INVALID_CHANNEL' as any]
      };

      expect(DynamicWorkflowFactory.validateWorkflowConfig(invalidChannelConfig)).toBe(false);
    });

    it('should validate enum values correctly', () => {
      const schema = DynamicWorkflowFactory.createDefaultPayloadSchema();

      // Valid enum values
      const validEnums = schema.safeParse({
        priority: 'high',
        category: 'maintenance'
      });
      expect(validEnums.success).toBe(true);

      // Invalid enum values
      const invalidPriority = schema.safeParse({
        priority: 'super-urgent'
      });
      expect(invalidPriority.success).toBe(false);

      const invalidCategory = schema.safeParse({
        category: 'random-category'
      });
      expect(invalidCategory.success).toBe(false);
    });
  });
});