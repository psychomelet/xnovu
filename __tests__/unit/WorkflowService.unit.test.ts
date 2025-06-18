import { WorkflowService } from '@/app/services/database/WorkflowService';
import type { Database } from '@/lib/supabase/database.types';
import { v4 as uuidv4 } from 'uuid';
import { getTestEnterpriseId } from '../setup/test-data';

// Types
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];

// Check for required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
}

describe('WorkflowService Unit Tests', () => {
  let service: WorkflowService;
  const testEnterpriseId = getTestEnterpriseId(); // Use shared test enterprise ID
  let testWorkflowId: number | null = null;
  let testWorkflowKey: string;

  beforeAll(() => {
    service = new WorkflowService();
    testWorkflowKey = 'test-workflow-' + Date.now();
  });

  afterAll(async () => {
    // Clean up test data
    if (testWorkflowId) {
      try {
        await service.deactivateWorkflow(testWorkflowId, testEnterpriseId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createTestWorkflowInsert(overrides: Partial<WorkflowInsert> = {}): WorkflowInsert {
    return {
      name: 'Test Workflow Unit',
      workflow_key: testWorkflowKey + '-' + Math.random().toString(36).substring(7),
      workflow_type: 'DYNAMIC',
      default_channels: ['EMAIL'],
      enterprise_id: testEnterpriseId,
      publish_status: 'DRAFT',
      deactivated: false,
      ...overrides
    } as WorkflowInsert;
  }

  describe('createWorkflow', () => {
    it('should create new workflow successfully', async () => {
      const insertData = createTestWorkflowInsert({
        name: 'New Workflow Unit Test',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP'],
        template_overrides: { emailTemplateId: 456 }
      });

      const result = await service.createWorkflow(insertData);
      testWorkflowId = result.id;

      expect(result).toBeDefined();
      expect(result.name).toBe('New Workflow Unit Test');
      expect(result.workflow_key).toBe(insertData.workflow_key);
      expect(result.workflow_type).toBe('DYNAMIC');
      expect(result.default_channels).toEqual(['EMAIL', 'IN_APP']);
      expect(result.enterprise_id).toBe(testEnterpriseId);
      expect(result.publish_status).toBe('DRAFT');
    });

    it('should handle creation errors for duplicate workflow key', async () => {
      // First create a workflow
      const firstInsert = createTestWorkflowInsert({ 
        name: 'First Workflow',
        workflow_key: 'duplicate-test-key-' + Date.now()
      });
      const firstResult = await service.createWorkflow(firstInsert);

      // Try to create another with the same key
      const duplicateData = createTestWorkflowInsert({
        name: 'Duplicate Workflow',
        workflow_key: firstResult.workflow_key // Use the same key
      });

      await expect(
        service.createWorkflow(duplicateData)
      ).rejects.toThrow('Failed to create workflow');

      // Clean up
      await service.deactivateWorkflow(firstResult.id, testEnterpriseId);
    });
  });

  describe('getWorkflow', () => {
    let createdWorkflowId: number;

    beforeAll(async () => {
      // Create a workflow for testing retrieval
      const insertData = createTestWorkflowInsert({
        name: 'Test Retrieval Workflow',
        template_overrides: { emailTemplateId: 123 }
      });
      const created = await service.createWorkflow(insertData);
      createdWorkflowId = created.id;
    });

    afterAll(async () => {
      // Clean up
      try {
        await service.deactivateWorkflow(createdWorkflowId, testEnterpriseId);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should retrieve workflow by ID', async () => {
      const result = await service.getWorkflow(createdWorkflowId, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(createdWorkflowId);
      expect(result!.name).toBe('Test Retrieval Workflow');
      expect(result!.workflow_type).toBe('DYNAMIC');
      expect(result!.default_channels).toEqual(['EMAIL']);
      expect(result!.enterprise_id).toBe(testEnterpriseId);
    });

    it('should return null when workflow not found', async () => {
      const result = await service.getWorkflow(999999, testEnterpriseId);
      expect(result).toBeNull();
    });

    it('should return null when workflow belongs to different enterprise', async () => {
      const differentEnterpriseId = uuidv4(); // Use a valid UUID for different enterprise
      const result = await service.getWorkflow(createdWorkflowId, differentEnterpriseId);
      expect(result).toBeNull();
    });
  });

  describe('getWorkflowByKey', () => {
    let createdWorkflow: WorkflowRow;

    beforeAll(async () => {
      // Create a workflow for testing key-based retrieval
      const uniqueKey = 'building-alert-' + Date.now();
      const insertData = createTestWorkflowInsert({
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
      createdWorkflow = await service.createWorkflow(insertData);
    });

    afterAll(async () => {
      // Clean up
      try {
        await service.deactivateWorkflow(createdWorkflow.id, testEnterpriseId);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should retrieve workflow by key', async () => {
      const result = await service.getWorkflowByKey(createdWorkflow.workflow_key, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result!.workflow_key).toBe(createdWorkflow.workflow_key);
      expect(result!.name).toBe('Building Alert');
      expect(result!.enterprise_id).toBe(testEnterpriseId);
      expect(result!.default_channels).toEqual(['EMAIL', 'IN_APP', 'SMS']);
    });

    it('should return null when workflow key not found', async () => {
      const result = await service.getWorkflowByKey('non-existent-key', testEnterpriseId);
      expect(result).toBeNull();
    });
  });


  describe('updateWorkflow', () => {
    let workflowToUpdate: WorkflowRow;

    beforeAll(async () => {
      // Create a workflow for testing updates
      const insertData = createTestWorkflowInsert({
        name: 'Workflow for Updates',
        description: 'Original description'
      });
      workflowToUpdate = await service.createWorkflow(insertData);
    });

    afterAll(async () => {
      // Clean up
      try {
        await service.deactivateWorkflow(workflowToUpdate.id, testEnterpriseId);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should update workflow successfully', async () => {
      const updateData = {
        template_overrides: { emailTemplateId: 999, inAppTemplateId: 1000 },
        description: 'Updated description'
      };

      const result = await service.updateWorkflow(workflowToUpdate.id, updateData, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result.template_overrides).toEqual({ emailTemplateId: 999, inAppTemplateId: 1000 });
      expect(result.description).toBe('Updated description');
    });

    it('should handle update errors for non-existent workflow', async () => {
      const updateData = { description: 'Updated' };

      await expect(
        service.updateWorkflow(999999, updateData, testEnterpriseId)
      ).rejects.toThrow('Failed to update workflow');
    });
  });

  describe('publishWorkflow', () => {
    let workflowToPublish: WorkflowRow;

    beforeAll(async () => {
      // Create a workflow for testing publishing
      const insertData = createTestWorkflowInsert({
        name: 'Workflow for Publishing'
      });
      workflowToPublish = await service.createWorkflow(insertData);
    });

    afterAll(async () => {
      // Clean up
      try {
        await service.deactivateWorkflow(workflowToPublish.id, testEnterpriseId);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should publish workflow', async () => {
      const result = await service.publishWorkflow(workflowToPublish.id, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result.publish_status).toBe('PUBLISH');
    });
  });

  describe('unpublishWorkflow', () => {
    let workflowToUnpublish: WorkflowRow;

    beforeAll(async () => {
      // Create and publish a workflow for testing unpublishing
      const insertData = createTestWorkflowInsert({
        name: 'Workflow for Unpublishing'
      });
      const created = await service.createWorkflow(insertData);
      workflowToUnpublish = await service.publishWorkflow(created.id, testEnterpriseId);
    });

    afterAll(async () => {
      // Clean up
      try {
        await service.deactivateWorkflow(workflowToUnpublish.id, testEnterpriseId);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should unpublish workflow', async () => {
      const result = await service.unpublishWorkflow(workflowToUnpublish.id, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result.publish_status).toBe('DRAFT');
    });
  });

  describe('deactivateWorkflow', () => {
    let workflowToDeactivate: WorkflowRow;

    beforeAll(async () => {
      // Create a workflow for testing deactivation
      const insertData = createTestWorkflowInsert({
        name: 'Workflow for Deactivation'
      });
      workflowToDeactivate = await service.createWorkflow(insertData);
    });

    it('should deactivate workflow', async () => {
      const result = await service.deactivateWorkflow(workflowToDeactivate.id, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result.deactivated).toBe(true);
    });
  });

  describe('parseWorkflowConfig', () => {
    let testWorkflowFull: WorkflowRow;
    let testWorkflowMinimal: WorkflowRow;

    beforeAll(async () => {
      // Create workflows for testing config parsing
      const fullInsert = createTestWorkflowInsert({
        name: 'Test Workflow Parse',
        workflow_key: 'test-workflow-parse-' + Date.now(),
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP', 'SMS'],
        template_overrides: {
          emailTemplateId: 123,
          inAppTemplateId: 124,
          smsTemplateId: 125,
          tags: ['test', 'building']
        },
        payload_schema: {
          message: { type: 'string', required: true },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        description: 'Test workflow description'
      });
      testWorkflowFull = await service.createWorkflow(fullInsert);

      const minimalInsert = createTestWorkflowInsert({
        name: 'Minimal Workflow',
        workflow_key: 'minimal-workflow-' + Date.now(),
        workflow_type: 'STATIC',
        default_channels: ['EMAIL']
      });
      testWorkflowMinimal = await service.createWorkflow(minimalInsert);
    });

    afterAll(async () => {
      // Clean up
      try {
        await service.deactivateWorkflow(testWorkflowFull.id, testEnterpriseId);
        await service.deactivateWorkflow(testWorkflowMinimal.id, testEnterpriseId);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should parse workflow row to config object', async () => {
      const result = await service.parseWorkflowConfig(testWorkflowFull);

      expect(result).toEqual({
        workflow_key: testWorkflowFull.workflow_key,
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
      const result = await service.parseWorkflowConfig(testWorkflowMinimal);

      expect(result).toEqual({
        workflow_key: testWorkflowMinimal.workflow_key,
        workflow_type: 'STATIC',
        channels: ['EMAIL'],
        name: 'Minimal Workflow'
      });
    });
  });
});
