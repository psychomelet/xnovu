import { WorkflowRegistry } from '../../app/services/workflow/WorkflowRegistry';
import { WorkflowService } from '../../app/services/database/WorkflowService';
import { DynamicWorkflowFactory } from '../../app/services/workflow/DynamicWorkflowFactory';
import { WorkflowDiscovery } from '../../app/services/workflow/WorkflowDiscovery';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/supabase/database.types';
import type { WorkflowConfig } from '../../app/services/database/WorkflowService';
import { randomUUID } from 'crypto';

// Types
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type SupabaseClient = ReturnType<typeof createClient<Database>>;

// Mock DynamicWorkflowFactory with enhanced functionality for testing
jest.mock('../../app/services/workflow/DynamicWorkflowFactory', () => ({
  DynamicWorkflowFactory: {
    createDynamicWorkflow: jest.fn(),
    validateWorkflowConfig: jest.fn()
  }
}));

// Mock WorkflowDiscovery 
jest.mock('../../app/services/workflow/WorkflowDiscovery', () => ({
  WorkflowDiscovery: {
    discoverStaticWorkflows: jest.fn()
  }
}));

describe('WorkflowRegistry Integration Tests with Real Database', () => {
  let registry: WorkflowRegistry;
  let workflowService: WorkflowService;
  let supabase: SupabaseClient;
  const testEnterpriseId = randomUUID();
  const createdWorkflowIds: number[] = [];
  
  // Get mock functions
  const mockCreateDynamicWorkflow = jest.mocked(require('../../app/services/workflow/DynamicWorkflowFactory').DynamicWorkflowFactory.createDynamicWorkflow);
  const mockValidateWorkflowConfig = jest.mocked(require('../../app/services/workflow/DynamicWorkflowFactory').DynamicWorkflowFactory.validateWorkflowConfig);
  const mockDiscoverStaticWorkflows = jest.mocked(require('../../app/services/workflow/WorkflowDiscovery').WorkflowDiscovery.discoverStaticWorkflows);

  // Check if we have real credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
  const hasRealCredentials = supabaseUrl && 
    supabaseServiceKey && 
    supabaseUrl.includes('supabase.co') && 
    supabaseServiceKey.length > 50;

  beforeAll(async () => {
    if (!hasRealCredentials) {
      throw new Error('Real Supabase credentials required for WorkflowRegistry integration tests. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-workflow-registry-integration' } }
    });
    
    workflowService = new WorkflowService();
    registry = new WorkflowRegistry();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockValidateWorkflowConfig.mockReturnValue(true);
    mockDiscoverStaticWorkflows.mockResolvedValue(new Map());
    
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

      // Mock factory to return workflow instances
      const mockInstances = [
        { key: 'building-alert-integration' },
        { key: 'maintenance-alert-integration' }
      ];

      mockCreateDynamicWorkflow
        .mockReturnValueOnce(mockInstances[0])
        .mockReturnValueOnce(mockInstances[1]);

      await registry.loadEnterpriseWorkflows(testEnterpriseId);

      // Verify factory was called for published workflows only
      expect(mockCreateDynamicWorkflow).toHaveBeenCalledTimes(2);

      // Verify workflows were registered
      const workflow1Registered = registry.getWorkflow('building-alert-integration', testEnterpriseId);
      const workflow2Registered = registry.getWorkflow('maintenance-alert-integration', testEnterpriseId);

      expect(workflow1Registered?.instance).toEqual(mockInstances[0]);
      expect(workflow2Registered?.instance).toEqual(mockInstances[1]);

      // Verify draft workflow was not registered
      const draftWorkflow = registry.getWorkflow('draft-workflow-integration', testEnterpriseId);
      expect(draftWorkflow).toBeNull();
    });

    it('should handle errors during individual workflow parsing', async () => {
      // Create workflows with valid and invalid configurations
      const validWorkflow = await createTestWorkflow({
        name: 'Valid Workflow Integration',
        workflow_key: 'valid-workflow-integration',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 123 },
        publish_status: 'PUBLISH'
      });

      const invalidWorkflow = await createTestWorkflow({
        name: 'Invalid Workflow Integration',
        workflow_key: 'invalid-workflow-integration',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: null, // This might cause parsing issues
        publish_status: 'PUBLISH'
      });

      // Mock factory to succeed for valid, fail for invalid
      mockCreateDynamicWorkflow
        .mockReturnValueOnce({ key: 'valid-workflow-integration' })
        .mockImplementationOnce(() => {
          throw new Error('Invalid configuration');
        });

      // Should not throw, but should log error and continue
      await expect(registry.loadEnterpriseWorkflows(testEnterpriseId)).resolves.not.toThrow();

      // Valid workflow should be registered
      const validWorkflowRegistered = registry.getWorkflow('valid-workflow-integration', testEnterpriseId);
      expect(validWorkflowRegistered).toBeDefined();

      // Invalid workflow should not be registered
      const invalidWorkflowRegistered = registry.getWorkflow('invalid-workflow-integration', testEnterpriseId);
      expect(invalidWorkflowRegistered).toBeNull();
    });
  });

  describe('reloadEnterpriseWorkflows with Real Database', () => {
    it('should clear existing enterprise workflows before reloading from database', async () => {
      // Register initial workflow manually
      const initialConfig: WorkflowConfig = {
        workflow_key: 'initial-workflow-integration',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      const initialWorkflow = { key: 'initial-workflow-integration' };
      mockCreateDynamicWorkflow.mockReturnValue(initialWorkflow);

      registry.registerDynamicWorkflow('initial-workflow-integration', initialConfig, testEnterpriseId);

      // Verify it exists
      expect(registry.getWorkflow('initial-workflow-integration', testEnterpriseId)).toBeDefined();

      // Create new workflow in database
      const newWorkflow = await createTestWorkflow({
        name: 'New Workflow Integration',
        workflow_key: 'new-workflow-integration',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 999 },
        publish_status: 'PUBLISH'
      });

      // Mock factory for new workflow
      const newWorkflowInstance = { key: 'new-workflow-integration' };
      mockCreateDynamicWorkflow.mockReturnValue(newWorkflowInstance);

      // Reload
      await registry.reloadEnterpriseWorkflows(testEnterpriseId);

      // Initial workflow should be gone (not in database)
      expect(registry.getWorkflow('initial-workflow-integration', testEnterpriseId)).toBeNull();

      // New workflow from database should exist
      expect(registry.getWorkflow('new-workflow-integration', testEnterpriseId)).toBeDefined();
    });
  });

  describe('Enterprise Isolation in Registry', () => {
    it('should handle enterprise isolation in workflow loading', async () => {
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

      // Mock factory responses
      mockCreateDynamicWorkflow
        .mockReturnValueOnce({ key: 'test-enterprise-workflow' })
        .mockReturnValueOnce({ key: 'other-enterprise-workflow' });

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

      // Create dynamic workflow in database
      await createTestWorkflow({
        name: 'Dynamic Common Workflow',
        workflow_key: 'common-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        publish_status: 'PUBLISH'
      });

      // Mock dynamic workflow creation
      const dynamicWorkflow = { key: 'common-workflow', type: 'dynamic' };
      mockCreateDynamicWorkflow.mockReturnValue(dynamicWorkflow);

      // Load dynamic workflows
      await registry.loadEnterpriseWorkflows(testEnterpriseId);

      // Should get dynamic workflow when enterprise ID provided
      const resultWithEnterprise = registry.getWorkflow('common-workflow', testEnterpriseId);
      expect(resultWithEnterprise?.instance).toEqual(dynamicWorkflow);
      expect(resultWithEnterprise?.type).toBe('DYNAMIC');

      // Should get static workflow when no enterprise ID provided
      const resultWithoutEnterprise = registry.getWorkflow('common-workflow');
      expect(resultWithoutEnterprise?.instance).toEqual(staticWorkflow);
      expect(resultWithoutEnterprise?.type).toBe('STATIC');
    });
  });
});
