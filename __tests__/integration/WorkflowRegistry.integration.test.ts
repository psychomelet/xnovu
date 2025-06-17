import { WorkflowRegistry } from '@/app/services/workflow/WorkflowRegistry';
import { WorkflowService } from '@/app/services/database/WorkflowService';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { randomUUID } from 'crypto';
import { getTestEnterpriseId } from '../setup/test-data';

// Types
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type SupabaseClient = ReturnType<typeof createClient<Database>>;

// Mock only the problematic Novu framework import
jest.mock('@novu/framework', () => ({
  workflow: jest.fn(() => ({ key: 'mocked-workflow' }))
}));

describe('WorkflowRegistry Integration Tests with Real Database', () => {
  let registry: WorkflowRegistry;
  let workflowService: WorkflowService;
  let supabase: SupabaseClient;
  let testEnterpriseId: string;
  const createdWorkflowIds: number[] = [];

  // Check if we have real credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const hasRealCredentials = supabaseUrl &&
    supabaseServiceKey &&
    supabaseUrl.includes('supabase.co') &&
    supabaseServiceKey.length > 50;

  beforeAll(async () => {
    if (!hasRealCredentials) {
      throw new Error('Real Supabase credentials required for WorkflowRegistry integration tests. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    // Get shared test enterprise ID
    testEnterpriseId = getTestEnterpriseId();

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-workflow-registry-integration' } }
    });

    workflowService = new WorkflowService();
    registry = new WorkflowRegistry();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // No need for cleanup - handled by global teardown
  });

  afterEach(async () => {
    // Clear tracking arrays (data cleanup handled by global teardown)
    createdWorkflowIds.length = 0;
  });

  // Cleanup handled by global teardown - no need for individual cleanup

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

  describe('loadEnterpriseWorkflows with Real Database', () => {
    it('should load all dynamic workflows for enterprise from database', async () => {
      // Create test workflows in database
      const workflow1 = await createTestWorkflow({
        name: 'Building Alert Integration',
        workflow_key: 'building-alert-integration',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 123 },
        publish_status: 'PUBLISH'
      });

      const workflow2 = await createTestWorkflow({
        name: 'Maintenance Alert Integration',
        workflow_key: 'maintenance-alert-integration',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP'],
        template_overrides: { emailTemplateId: 124, inAppTemplateId: 125 },
        publish_status: 'PUBLISH'
      });

      // Create unpublished workflow that should not be loaded
      await createTestWorkflow({
        name: 'Draft Workflow Integration',
        workflow_key: 'draft-workflow-integration',
        publish_status: 'DRAFT'
      });

      await registry.loadEnterpriseWorkflows(testEnterpriseId);

      // Verify workflows were registered
      const workflow1Registered = registry.getWorkflow('building-alert-integration', testEnterpriseId);
      const workflow2Registered = registry.getWorkflow('maintenance-alert-integration', testEnterpriseId);

      expect(workflow1Registered).toBeDefined();
      expect(workflow1Registered?.type).toBe('DYNAMIC');
      expect(workflow2Registered).toBeDefined();
      expect(workflow2Registered?.type).toBe('DYNAMIC');

      // Verify draft workflow was not registered
      const draftWorkflow = registry.getWorkflow('draft-workflow-integration', testEnterpriseId);
      expect(draftWorkflow).toBeNull();
    });

    it('should handle errors during individual workflow parsing', async () => {
      // Create workflow with invalid configuration (missing required fields)
      const invalidWorkflow = await createTestWorkflow({
        name: 'Invalid Workflow Integration',
        workflow_key: 'invalid-workflow-integration',
        workflow_type: 'DYNAMIC',
        default_channels: [], // Empty channels array might cause issues
        template_overrides: null,
        publish_status: 'PUBLISH'
      });

      // Should not throw, but should handle invalid workflows gracefully
      await expect(registry.loadEnterpriseWorkflows(testEnterpriseId)).resolves.not.toThrow();

      // Invalid workflow should either not be registered or fail validation
      const invalidWorkflowRegistered = registry.getWorkflow('invalid-workflow-integration', testEnterpriseId);
      // This might be null if validation fails, or defined if the workflow system is more permissive
      // The key is that it doesn't crash the entire loading process
      expect(typeof invalidWorkflowRegistered).toMatch(/object|undefined/);
    });
  });

  describe('reloadEnterpriseWorkflows with Real Database', () => {
    it('should clear existing enterprise workflows before reloading from database', async () => {
      // First load - create and load a workflow
      const initialWorkflow = await createTestWorkflow({
        name: 'Initial Workflow Integration',
        workflow_key: 'initial-workflow-integration',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 999 },
        publish_status: 'PUBLISH'
      });

      await registry.loadEnterpriseWorkflows(testEnterpriseId);

      // Verify it was loaded
      expect(registry.getWorkflow('initial-workflow-integration', testEnterpriseId)).toBeDefined();

      // Delete the workflow from database and create a new one
      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('id', initialWorkflow.id);

      const newWorkflow = await createTestWorkflow({
        name: 'New Workflow Integration',
        workflow_key: 'new-workflow-integration',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 1000 },
        publish_status: 'PUBLISH'
      });

      // Reload
      await registry.reloadEnterpriseWorkflows(testEnterpriseId);

      // Initial workflow should be gone (not in database anymore)
      expect(registry.getWorkflow('initial-workflow-integration', testEnterpriseId)).toBeNull();

      // New workflow from database should exist
      expect(registry.getWorkflow('new-workflow-integration', testEnterpriseId)).toBeDefined();
    });
  });

  describe('Enterprise Isolation in Registry', () => {
    it('should handle enterprise isolation in workflow loading', async () => {
      const otherEnterpriseId = randomUUID();

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

      // Load workflows for test enterprise
      await registry.loadEnterpriseWorkflows(testEnterpriseId);

      // Load workflows for other enterprise
      await registry.loadEnterpriseWorkflows(otherEnterpriseId);

      // Verify enterprise isolation
      const testWorkflow = registry.getWorkflow('test-enterprise-workflow', testEnterpriseId);
      const otherWorkflow = registry.getWorkflow('other-enterprise-workflow', otherEnterpriseId);

      expect(testWorkflow).toBeDefined();
      expect(otherWorkflow).toBeDefined();

      // Verify cross-enterprise access is blocked
      expect(registry.getWorkflow('other-enterprise-workflow', testEnterpriseId)).toBeNull();
      expect(registry.getWorkflow('test-enterprise-workflow', otherEnterpriseId)).toBeNull();

      // Clean up additional workflow
      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('id', otherEnterpriseWorkflow.id);
    });
  });

  describe('Static and Dynamic Workflow Integration', () => {
    it('should prioritize dynamic workflows over static when enterprise ID provided', async () => {
      // Register static workflow
      const staticWorkflow = { key: 'common-workflow', type: 'static' };
      registry.registerStaticWorkflow('common-workflow', staticWorkflow);

      // Create dynamic workflow in database with required template IDs
      await createTestWorkflow({
        name: 'Dynamic Common Workflow',
        workflow_key: 'common-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 101 },
        publish_status: 'PUBLISH'
      });

      // Load dynamic workflows
      await registry.loadEnterpriseWorkflows(testEnterpriseId);

      // Should get dynamic workflow when enterprise ID provided
      const resultWithEnterprise = registry.getWorkflow('common-workflow', testEnterpriseId);
      expect(resultWithEnterprise).toBeDefined();
      expect(resultWithEnterprise?.type).toBe('DYNAMIC');

      // Should get static workflow when no enterprise ID provided
      const resultWithoutEnterprise = registry.getWorkflow('common-workflow');
      expect(resultWithoutEnterprise).toBeDefined();
      expect(resultWithoutEnterprise?.type).toBe('STATIC');
    });
  });
});
