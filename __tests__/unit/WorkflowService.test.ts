import { WorkflowService } from '../../app/services/database/WorkflowService';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/supabase/database.types';
import { randomUUID } from 'crypto';

// Types
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type SupabaseClient = ReturnType<typeof createClient<Database>>;

describe('WorkflowService Unit Tests with Real Database', () => {
  let service: WorkflowService;
  let supabase: SupabaseClient;
  const testEnterpriseId = randomUUID();
  const createdWorkflowIds: number[] = [];

  // Check if we have real credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
  const hasRealCredentials = supabaseUrl && 
    supabaseServiceKey && 
    supabaseUrl.includes('supabase.co') && 
    supabaseServiceKey.length > 50;

  beforeAll(async () => {
    if (!hasRealCredentials) {
      throw new Error('Real Supabase credentials required for WorkflowService unit tests. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-workflow-service-unit' } }
    });
    
    service = new WorkflowService();
  });

  beforeEach(async () => {
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

  describe('getWorkflow', () => {
    it('should retrieve workflow by ID', async () => {
      const testWorkflow = await createTestWorkflow({
        name: 'Test Workflow Unit',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP'],
        template_overrides: { emailTemplateId: 123 }
      });

      const result = await service.getWorkflow(testWorkflow.id, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(testWorkflow.id);
      expect(result!.name).toBe('Test Workflow Unit');
      expect(result!.workflow_type).toBe('DYNAMIC');
      expect(result!.default_channels).toEqual(['EMAIL', 'IN_APP']);
      expect(result!.enterprise_id).toBe(testEnterpriseId);
    });

    it('should return null when workflow not found', async () => {
      const result = await service.getWorkflow(999999, testEnterpriseId);
      expect(result).toBeNull();
    });

    it('should return null when workflow belongs to different enterprise', async () => {
      const testWorkflow = await createTestWorkflow({
        enterprise_id: 'other-enterprise-id'
      });

      const result = await service.getWorkflow(testWorkflow.id, testEnterpriseId);
      expect(result).toBeNull();

      // Clean up additional workflow
      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('id', testWorkflow.id);
    });
  });

  describe('getWorkflowByKey', () => {
    it('should retrieve workflow by key', async () => {
      const uniqueKey = `building-alert-${Date.now()}`;
      const testWorkflow = await createTestWorkflow({
        name: 'Building Alert',
        workflow_key: uniqueKey,
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP', 'SMS'],
        template_overrides: { 
          emailTemplateId: 123,
          inAppTemplateId: 124,
          smsTemplateId: 125
        }
      });

      const result = await service.getWorkflowByKey(uniqueKey, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result!.workflow_key).toBe(uniqueKey);
      expect(result!.name).toBe('Building Alert');
      expect(result!.enterprise_id).toBe(testEnterpriseId);
    });

    it('should return null when workflow key not found', async () => {
      const result = await service.getWorkflowByKey('non-existent-key', testEnterpriseId);
      expect(result).toBeNull();
    });
  });

  describe('createWorkflow', () => {
    it('should create new workflow successfully', async () => {
      const insertData: WorkflowInsert = {
        name: 'New Workflow Unit Test',
        workflow_key: `new-workflow-${Date.now()}`,
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP'],
        template_overrides: { emailTemplateId: 456 },
        enterprise_id: testEnterpriseId
      };

      const result = await service.createWorkflow(insertData);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Workflow Unit Test');
      expect(result.workflow_key).toBe(insertData.workflow_key);
      expect(result.workflow_type).toBe('DYNAMIC');
      expect(result.default_channels).toEqual(['EMAIL', 'IN_APP']);
      expect(result.enterprise_id).toBe(testEnterpriseId);
      expect(result.publish_status).toBe('DRAFT'); // Default status
      
      // Track for cleanup
      createdWorkflowIds.push(result.id);
    });

    it('should handle creation errors for duplicate workflow key', async () => {
      const uniqueKey = `duplicate-key-${Date.now()}`;
      
      // Create first workflow
      await createTestWorkflow({
        workflow_key: uniqueKey
      });

      const duplicateData: WorkflowInsert = {
        name: 'Duplicate Workflow',
        workflow_key: uniqueKey, // Same key
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        enterprise_id: testEnterpriseId
      };

      await expect(
        service.createWorkflow(duplicateData)
      ).rejects.toThrow();
    });
  });

  describe('updateWorkflow', () => {
    it('should update workflow successfully', async () => {
      const testWorkflow = await createTestWorkflow();
      
      const updateData = {
        template_overrides: { emailTemplateId: 999, inAppTemplateId: 1000 },
        description: 'Updated description'
      };

      const result = await service.updateWorkflow(testWorkflow.id, updateData, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result.template_overrides).toEqual({ emailTemplateId: 999, inAppTemplateId: 1000 });
      expect(result.description).toBe('Updated description');
    });

    it('should handle update errors for non-existent workflow', async () => {
      const updateData = { description: 'Updated' };

      await expect(
        service.updateWorkflow(999999, updateData, testEnterpriseId)
      ).rejects.toThrow();
    });
  });

  describe('publishWorkflow', () => {
    it('should publish workflow', async () => {
      const testWorkflow = await createTestWorkflow({
        publish_status: 'DRAFT'
      });

      const result = await service.publishWorkflow(testWorkflow.id, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result.publish_status).toBe('PUBLISH');
    });
  });

  describe('unpublishWorkflow', () => {
    it('should unpublish workflow', async () => {
      const testWorkflow = await createTestWorkflow({
        publish_status: 'PUBLISH'
      });

      const result = await service.unpublishWorkflow(testWorkflow.id, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result.publish_status).toBe('DRAFT');
    });
  });

  describe('deactivateWorkflow', () => {
    it('should deactivate workflow', async () => {
      const testWorkflow = await createTestWorkflow({
        deactivated: false
      });

      const result = await service.deactivateWorkflow(testWorkflow.id, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result.deactivated).toBe(true);
    });
  });

  describe('parseWorkflowConfig', () => {
    it('should parse workflow row to config object', async () => {
      const testWorkflow = await createTestWorkflow({
        name: 'Test Workflow Parse',
        workflow_key: 'test-workflow-parse',
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
        description: 'Test workflow description',
        tags: ['test', 'building']
      });

      const result = await service.parseWorkflowConfig(testWorkflow);

      expect(result).toEqual({
        workflow_key: 'test-workflow-parse',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL', 'IN_APP', 'SMS'],
        emailTemplateId: 123,
        inAppTemplateId: 124,
        smsTemplateId: 125,
        payloadSchema: {
          message: { type: 'string', required: true },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        name: 'Test Workflow Parse',
        description: 'Test workflow description',
        tags: ['test', 'building']
      });
    });

    it('should handle workflow with minimal configuration', async () => {
      const testWorkflow = await createTestWorkflow({
        name: 'Minimal Workflow',
        workflow_key: 'minimal-workflow',
        workflow_type: 'STATIC',
        default_channels: ['EMAIL'],
        template_overrides: null,
        payload_schema: null,
        description: null,
        tags: null
      });

      const result = await service.parseWorkflowConfig(testWorkflow);

      expect(result).toEqual({
        workflow_key: 'minimal-workflow',
        workflow_type: 'STATIC',
        channels: ['EMAIL'],
        name: 'Minimal Workflow'
      });
    });
  });
});
