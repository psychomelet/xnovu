import { WorkflowService } from '../app/services/database/WorkflowService';
import type { Database } from '../lib/supabase/database.types';

// Types
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];

// Mock Supabase client
jest.mock('../lib/supabase/client', () => {
  const mock = {
    schema: jest.fn(() => mock),
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    insert: jest.fn(() => mock),
    update: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    single: jest.fn(),
    limit: jest.fn(() => mock),
    order: jest.fn(() => mock)
  };
  return {
    supabase: mock
  };
});

describe('WorkflowService', () => {
  let service: WorkflowService;
  let mockSupabase: any;
  const mockEnterpriseId = 'test-enterprise-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = require('../lib/supabase/client').supabase;
    service = new WorkflowService();
  });

  describe('getWorkflow', () => {
    it('should retrieve workflow by ID', async () => {
      const mockWorkflow: WorkflowRow = {
        id: 1,
        name: 'Test Workflow',
        workflow_key: 'test-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP'],
        template_overrides: { emailTemplateId: 123 },
        payload_schema: { message: { type: 'string' } },
        enterprise_id: mockEnterpriseId,
        publish_status: 'PUBLISH',
        deactivated: false,
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        description: 'Test description',
        tags: ['test']
      };

      mockSupabase.single.mockResolvedValue({
        data: mockWorkflow,
        error: null
      });

      const result = await service.getWorkflow(1, mockEnterpriseId);

      expect(mockSupabase.schema).toHaveBeenCalledWith('notify');
      expect(mockSupabase.from).toHaveBeenCalledWith('ent_notification_workflow');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 1);
      expect(mockSupabase.eq).toHaveBeenCalledWith('enterprise_id', mockEnterpriseId);
      expect(result).toEqual(mockWorkflow);
    });

    it('should return null when workflow not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const result = await service.getWorkflow(999, mockEnterpriseId);
      expect(result).toBeNull();
    });
  });

  describe('getWorkflowByKey', () => {
    it('should retrieve workflow by key', async () => {
      const mockWorkflow: WorkflowRow = {
        id: 1,
        name: 'Building Alert',
        workflow_key: 'building-alert',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP', 'SMS'],
        template_overrides: { 
          emailTemplateId: 123,
          inAppTemplateId: 124,
          smsTemplateId: 125
        },
        payload_schema: null,
        enterprise_id: mockEnterpriseId,
        publish_status: 'PUBLISH',
        deactivated: false,
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        description: null,
        tags: null
      };

      mockSupabase.single.mockResolvedValue({
        data: mockWorkflow,
        error: null
      });

      const result = await service.getWorkflowByKey('building-alert', mockEnterpriseId);

      expect(mockSupabase.eq).toHaveBeenCalledWith('workflow_key', 'building-alert');
      expect(mockSupabase.eq).toHaveBeenCalledWith('enterprise_id', mockEnterpriseId);
      expect(result).toEqual(mockWorkflow);
    });
  });

  describe('getAllWorkflows', () => {
    it('should retrieve all active workflows for enterprise', async () => {
      const mockWorkflows: WorkflowRow[] = [
        {
          id: 1,
          name: 'Workflow 1',
          workflow_key: 'workflow-1',
          workflow_type: 'DYNAMIC',
          default_channels: ['EMAIL'],
          template_overrides: {},
          payload_schema: null,
          enterprise_id: mockEnterpriseId,
          publish_status: 'PUBLISH',
          deactivated: false,
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          description: null,
          tags: null
        },
        {
          id: 2,
          name: 'Workflow 2',
          workflow_key: 'workflow-2',
          workflow_type: 'STATIC',
          default_channels: ['IN_APP'],
          template_overrides: {},
          payload_schema: null,
          enterprise_id: mockEnterpriseId,
          publish_status: 'PUBLISH',
          deactivated: false,
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          description: null,
          tags: null
        }
      ];

      // Mock the order method to return the expected data
      mockSupabase.order.mockResolvedValue({
        data: mockWorkflows,
        error: null
      });

      const result = await service.getAllWorkflows(mockEnterpriseId);

      expect(result).toEqual(mockWorkflows);
    });
  });

  describe('getPublishedWorkflows', () => {
    it('should retrieve only published workflows', async () => {
      const mockWorkflows: WorkflowRow[] = [
        {
          id: 1,
          name: 'Published Workflow',
          workflow_key: 'published-workflow',
          workflow_type: 'DYNAMIC',
          default_channels: ['EMAIL'],
          template_overrides: {},
          payload_schema: null,
          enterprise_id: mockEnterpriseId,
          publish_status: 'PUBLISH',
          deactivated: false,
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          description: null,
          tags: null
        }
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockWorkflows,
        error: null
      });

      const result = await service.getPublishedWorkflows(mockEnterpriseId);

      expect(mockSupabase.eq).toHaveBeenCalledWith('enterprise_id', mockEnterpriseId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('deactivated', false);
      expect(mockSupabase.eq).toHaveBeenCalledWith('publish_status', 'PUBLISH');
      expect(result).toEqual(mockWorkflows);
    });
  });

  describe('getDynamicWorkflows', () => {
    it('should retrieve only dynamic workflows', async () => {
      const mockWorkflows: WorkflowRow[] = [
        {
          id: 1,
          name: 'Dynamic Workflow',
          workflow_key: 'dynamic-workflow',
          workflow_type: 'DYNAMIC',
          default_channels: ['EMAIL', 'IN_APP'],
          template_overrides: {},
          payload_schema: null,
          enterprise_id: mockEnterpriseId,
          publish_status: 'PUBLISH',
          deactivated: false,
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          description: null,
          tags: null
        }
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockWorkflows,
        error: null
      });

      const result = await service.getDynamicWorkflows(mockEnterpriseId);

      expect(mockSupabase.eq).toHaveBeenCalledWith('enterprise_id', mockEnterpriseId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('deactivated', false);
      expect(mockSupabase.eq).toHaveBeenCalledWith('workflow_type', 'DYNAMIC');
      expect(result).toEqual(mockWorkflows);
    });
  });

  describe('getStaticWorkflows', () => {
    it('should retrieve only static workflows', async () => {
      const mockWorkflows: WorkflowRow[] = [
        {
          id: 1,
          name: 'Static Workflow',
          workflow_key: 'static-workflow',
          workflow_type: 'STATIC',
          default_channels: ['EMAIL'],
          template_overrides: {},
          payload_schema: null,
          enterprise_id: mockEnterpriseId,
          publish_status: 'PUBLISH',
          deactivated: false,
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          description: null,
          tags: null
        }
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockWorkflows,
        error: null
      });

      const result = await service.getStaticWorkflows(mockEnterpriseId);

      expect(mockSupabase.eq).toHaveBeenCalledWith('workflow_type', 'STATIC');
      expect(result).toEqual(mockWorkflows);
    });
  });

  describe('createWorkflow', () => {
    it('should create new workflow successfully', async () => {
      const insertData: WorkflowInsert = {
        name: 'New Workflow',
        workflow_key: 'new-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP'],
        template_overrides: { emailTemplateId: 456 },
        enterprise_id: mockEnterpriseId
      };

      const createdWorkflow: WorkflowRow = {
        id: 3,
        ...insertData,
        payload_schema: null,
        publish_status: 'DRAFT',
        deactivated: false,
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        description: null,
        tags: null
      };

      mockSupabase.single.mockResolvedValue({
        data: createdWorkflow,
        error: null
      });

      const result = await service.createWorkflow(insertData);

      expect(mockSupabase.schema).toHaveBeenCalledWith('notify');
      expect(mockSupabase.from).toHaveBeenCalledWith('ent_notification_workflow');
      expect(mockSupabase.insert).toHaveBeenCalledWith(insertData);
      expect(result).toEqual(createdWorkflow);
    });

    it('should handle creation errors', async () => {
      const insertData: WorkflowInsert = {
        name: 'Invalid Workflow',
        workflow_key: '', // Invalid empty key
        workflow_type: 'DYNAMIC',
        default_channels: [],
        enterprise_id: mockEnterpriseId
      };

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Validation error: workflow_key cannot be empty')
      });

      await expect(
        service.createWorkflow(insertData)
      ).rejects.toThrow('Failed to create workflow: Validation error: workflow_key cannot be empty');
    });
  });

  describe('updateWorkflow', () => {
    it('should update workflow successfully', async () => {
      const updateData = {
        template_overrides: { emailTemplateId: 999, inAppTemplateId: 1000 },
        description: 'Updated description'
      };

      const updatedWorkflow: WorkflowRow = {
        id: 1,
        name: 'Updated Workflow',
        workflow_key: 'test-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP'],
        template_overrides: { emailTemplateId: 999, inAppTemplateId: 1000 },
        payload_schema: null,
        enterprise_id: mockEnterpriseId,
        publish_status: 'PUBLISH',
        deactivated: false,
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        description: 'Updated description',
        tags: null
      };

      mockSupabase.single.mockResolvedValue({
        data: updatedWorkflow,
        error: null
      });

      const result = await service.updateWorkflow(1, updateData, mockEnterpriseId);

      expect(mockSupabase.update).toHaveBeenCalledWith(updateData);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 1);
      expect(mockSupabase.eq).toHaveBeenCalledWith('enterprise_id', mockEnterpriseId);
      expect(result).toEqual(updatedWorkflow);
    });
  });

  describe('publishWorkflow', () => {
    it('should publish workflow', async () => {
      const publishedWorkflow: WorkflowRow = {
        id: 1,
        name: 'Published Workflow',
        workflow_key: 'test-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: {},
        payload_schema: null,
        enterprise_id: mockEnterpriseId,
        publish_status: 'PUBLISH',
        deactivated: false,
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        description: null,
        tags: null
      };

      mockSupabase.single.mockResolvedValue({
        data: publishedWorkflow,
        error: null
      });

      const result = await service.publishWorkflow(1, mockEnterpriseId);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        publish_status: 'PUBLISH'
      });
      expect(result).toEqual(publishedWorkflow);
    });
  });

  describe('unpublishWorkflow', () => {
    it('should unpublish workflow', async () => {
      const unpublishedWorkflow: WorkflowRow = {
        id: 1,
        name: 'Unpublished Workflow',
        workflow_key: 'test-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: {},
        payload_schema: null,
        enterprise_id: mockEnterpriseId,
        publish_status: 'DRAFT',
        deactivated: false,
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        description: null,
        tags: null
      };

      mockSupabase.single.mockResolvedValue({
        data: unpublishedWorkflow,
        error: null
      });

      const result = await service.unpublishWorkflow(1, mockEnterpriseId);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        publish_status: 'DRAFT'
      });
      expect(result).toEqual(unpublishedWorkflow);
    });
  });

  describe('deactivateWorkflow', () => {
    it('should deactivate workflow', async () => {
      const deactivatedWorkflow: WorkflowRow = {
        id: 1,
        name: 'Deactivated Workflow',
        workflow_key: 'test-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: {},
        payload_schema: null,
        enterprise_id: mockEnterpriseId,
        publish_status: 'PUBLISH',
        deactivated: true,
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        description: null,
        tags: null
      };

      mockSupabase.single.mockResolvedValue({
        data: deactivatedWorkflow,
        error: null
      });

      const result = await service.deactivateWorkflow(1, mockEnterpriseId);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        deactivated: true
      });
      expect(result).toEqual(deactivatedWorkflow);
    });
  });

  describe('parseWorkflowConfig', () => {
    it('should parse workflow row to config object', async () => {
      const workflowRow: WorkflowRow = {
        id: 1,
        name: 'Test Workflow',
        workflow_key: 'test-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP', 'SMS'],
        template_overrides: {
          emailTemplateId: 123,
          inAppTemplateId: 124,
          smsTemplateId: 125
        },
        payload_schema: {
          message: { type: 'string', required: true },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        enterprise_id: mockEnterpriseId,
        publish_status: 'PUBLISH',
        deactivated: false,
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        description: 'Test workflow description',
        tags: ['test', 'building']
      };

      const result = await service.parseWorkflowConfig(workflowRow);

      expect(result).toEqual({
        workflow_key: 'test-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL', 'IN_APP', 'SMS'],
        emailTemplateId: 123,
        inAppTemplateId: 124,
        smsTemplateId: 125,
        payloadSchema: {
          message: { type: 'string', required: true },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        name: 'Test Workflow',
        description: 'Test workflow description',
        tags: ['test', 'building']
      });
    });

    it('should handle workflow with minimal configuration', async () => {
      const workflowRow: WorkflowRow = {
        id: 1,
        name: 'Minimal Workflow',
        workflow_key: 'minimal-workflow',
        workflow_type: 'STATIC',
        default_channels: ['EMAIL'],
        template_overrides: null,
        payload_schema: null,
        enterprise_id: mockEnterpriseId,
        publish_status: 'PUBLISH',
        deactivated: false,
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        description: null,
        tags: null
      };

      const result = await service.parseWorkflowConfig(workflowRow);

      expect(result).toEqual({
        workflow_key: 'minimal-workflow',
        workflow_type: 'STATIC',
        channels: ['EMAIL'],
        name: 'Minimal Workflow'
      });
    });
  });

  // Additional integration tests for enterprise isolation
  describe('Enterprise Isolation', () => {
    it('should maintain enterprise isolation for workflow access', async () => {
      // Create workflows for different enterprises with same key
      const sameKey = `shared-workflow-${Date.now()}`;
      const otherEnterpriseId = `other-enterprise-${Date.now()}`;
      
      const workflow1 = await createTestWorkflow({
        workflow_key: sameKey,
        enterprise_id: testEnterpriseId
      });
      
      const workflow2 = await createTestWorkflow({
        workflow_key: sameKey,
        enterprise_id: otherEnterpriseId
      });

      // Each enterprise should only see their own workflow
      const enterprise1Workflow = await service.getWorkflowByKey(sameKey, testEnterpriseId);
      const enterprise2Workflow = await service.getWorkflowByKey(sameKey, otherEnterpriseId);

      expect(enterprise1Workflow).toBeDefined();
      expect(enterprise2Workflow).toBeDefined();
      expect(enterprise1Workflow!.id).toBe(workflow1.id);
      expect(enterprise2Workflow!.id).toBe(workflow2.id);
      expect(enterprise1Workflow!.id).not.toBe(enterprise2Workflow!.id);
      
      // Clean up additional workflow
      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('id', workflow2.id);
    });

    it('should isolate getAllWorkflows by enterprise', async () => {
      const otherEnterpriseId = `other-enterprise-${Date.now()}`;
      
      // Create workflows for test enterprise
      await createTestWorkflow({
        workflow_key: `test-workflow-1-${Date.now()}`,
        enterprise_id: testEnterpriseId
      });
      
      await createTestWorkflow({
        workflow_key: `test-workflow-2-${Date.now()}`,
        enterprise_id: testEnterpriseId
      });
      
      // Create workflow for other enterprise
      const otherWorkflow = await createTestWorkflow({
        workflow_key: `other-workflow-${Date.now()}`,
        enterprise_id: otherEnterpriseId
      });

      const testEnterpriseWorkflows = await service.getAllWorkflows(testEnterpriseId);
      const otherEnterpriseWorkflows = await service.getAllWorkflows(otherEnterpriseId);

      // Verify test enterprise sees at least 2 workflows (the ones we just created)
      expect(testEnterpriseWorkflows.length).toBeGreaterThanOrEqual(2);
      expect(testEnterpriseWorkflows.every(w => w.enterprise_id === testEnterpriseId)).toBe(true);

      // Verify other enterprise sees exactly 1 workflow
      expect(otherEnterpriseWorkflows.length).toBe(1);
      expect(otherEnterpriseWorkflows[0].enterprise_id).toBe(otherEnterpriseId);

      // Verify no cross-contamination
      const testEnterpriseIds = testEnterpriseWorkflows.map(w => w.id);
      const otherEnterpriseIds = otherEnterpriseWorkflows.map(w => w.id);
      const intersection = testEnterpriseIds.filter(id => otherEnterpriseIds.includes(id));
      expect(intersection).toEqual([]);
      
      // Clean up additional workflow
      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('id', otherWorkflow.id);
    });
  });
});