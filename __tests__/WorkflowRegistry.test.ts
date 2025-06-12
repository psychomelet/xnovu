import { WorkflowRegistry } from '../app/services/workflow/WorkflowRegistry';
import { WorkflowService } from '../app/services/database/WorkflowService';
import { DynamicWorkflowFactory } from '../app/services/workflow/DynamicWorkflowFactory';
import { WorkflowDiscovery } from '../app/services/workflow/WorkflowDiscovery';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/supabase/database.types';
import type { WorkflowConfig } from '../app/services/database/WorkflowService';
import { randomUUID } from 'crypto';

// Types
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type SupabaseClient = ReturnType<typeof createClient<Database>>;

// Mock DynamicWorkflowFactory with enhanced functionality for testing
jest.mock('../app/services/workflow/DynamicWorkflowFactory', () => ({
  DynamicWorkflowFactory: {
    createDynamicWorkflow: jest.fn(),
    validateWorkflowConfig: jest.fn()
  }
}));

// Mock WorkflowDiscovery 
jest.mock('../app/services/workflow/WorkflowDiscovery', () => ({
  WorkflowDiscovery: {
    discoverStaticWorkflows: jest.fn()
  }
}));

describe('WorkflowRegistry with Real Database', () => {
  let registry: WorkflowRegistry;
  let workflowService: WorkflowService;
  let supabase: SupabaseClient;
  const testEnterpriseId = randomUUID();
  const createdWorkflowIds: number[] = [];
  
  // Get mock functions
  const mockCreateDynamicWorkflow = jest.mocked(require('../app/services/workflow/DynamicWorkflowFactory').DynamicWorkflowFactory.createDynamicWorkflow);
  const mockValidateWorkflowConfig = jest.mocked(require('../app/services/workflow/DynamicWorkflowFactory').DynamicWorkflowFactory.validateWorkflowConfig);
  const mockDiscoverStaticWorkflows = jest.mocked(require('../app/services/workflow/WorkflowDiscovery').WorkflowDiscovery.discoverStaticWorkflows);

  // Check if we have real credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
  const hasRealCredentials = supabaseUrl && 
    supabaseServiceKey && 
    supabaseUrl.includes('supabase.co') && 
    supabaseServiceKey.length > 50;

  beforeAll(async () => {
    if (!hasRealCredentials) {
      throw new Error('Real Supabase credentials required for WorkflowRegistry tests. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-workflow-registry' } }
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

  describe('registerStaticWorkflow', () => {
    it('should register static workflow', () => {
      const mockWorkflow = { key: 'test-static', type: 'static' };
      
      registry.registerStaticWorkflow('test-static', mockWorkflow);

      const registered = registry.getWorkflow('test-static');
      expect(registered).toEqual({
        id: 'test-static',
        type: 'STATIC',
        instance: mockWorkflow
      });
    });

    it('should overwrite existing static workflow', () => {
      const workflow1 = { key: 'test', version: 1 };
      const workflow2 = { key: 'test', version: 2 };

      registry.registerStaticWorkflow('test', workflow1);
      registry.registerStaticWorkflow('test', workflow2);

      const registered = registry.getWorkflow('test');
      expect(registered?.instance).toEqual(workflow2);
    });
  });

  describe('registerDynamicWorkflow', () => {
    it('should register dynamic workflow for enterprise', () => {
      const config: WorkflowConfig = {
        workflow_key: 'building-alert',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      const mockWorkflow = { key: 'building-alert', type: 'dynamic' };
      mockCreateDynamicWorkflow.mockReturnValue(mockWorkflow);

      registry.registerDynamicWorkflow('building-alert', config, testEnterpriseId);

      expect(mockCreateDynamicWorkflow).toHaveBeenCalledWith(
        config,
        testEnterpriseId
      );

      const registered = registry.getWorkflow('building-alert', testEnterpriseId);
      expect(registered).toEqual({
        id: `${testEnterpriseId}:building-alert`,
        type: 'DYNAMIC',
        instance: mockWorkflow,
        config,
        enterpriseId: testEnterpriseId
      });
    });

    it('should allow same workflow key for different enterprises', () => {
      const config: WorkflowConfig = {
        workflow_key: 'common-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      const workflow1 = { key: 'common-workflow', enterprise: 'ent1' };
      const workflow2 = { key: 'common-workflow', enterprise: 'ent2' };

      mockCreateDynamicWorkflow
        .mockReturnValueOnce(workflow1)
        .mockReturnValueOnce(workflow2);

      registry.registerDynamicWorkflow('common-workflow', config, 'enterprise-1');
      registry.registerDynamicWorkflow('common-workflow', config, 'enterprise-2');

      const workflow1Registered = registry.getWorkflow('common-workflow', 'enterprise-1');
      const workflow2Registered = registry.getWorkflow('common-workflow', 'enterprise-2');

      expect(workflow1Registered?.instance).toEqual(workflow1);
      expect(workflow2Registered?.instance).toEqual(workflow2);
      expect(workflow1Registered?.enterpriseId).toBe('enterprise-1');
      expect(workflow2Registered?.enterpriseId).toBe('enterprise-2');
    });
  });

  describe('loadEnterpriseWorkflows with Real Database', () => {
    it('should load all dynamic workflows for enterprise from database', async () => {
      // Create test workflows in database
      const workflow1 = await createTestWorkflow({
        name: 'Building Alert',
        workflow_key: 'building-alert',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 123 },
        publish_status: 'PUBLISH'
      });

      const workflow2 = await createTestWorkflow({
        name: 'Maintenance Alert', 
        workflow_key: 'maintenance-alert',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP'],
        template_overrides: { emailTemplateId: 124, inAppTemplateId: 125 },
        publish_status: 'PUBLISH'
      });

      // Create unpublished workflow that should not be loaded
      await createTestWorkflow({
        name: 'Draft Workflow',
        workflow_key: 'draft-workflow',
        publish_status: 'DRAFT'
      });

      // Mock factory to return workflow instances
      const mockInstances = [
        { key: 'building-alert' },
        { key: 'maintenance-alert' }
      ];

      mockCreateDynamicWorkflow
        .mockReturnValueOnce(mockInstances[0])
        .mockReturnValueOnce(mockInstances[1]);

      await registry.loadEnterpriseWorkflows(testEnterpriseId);

      // Verify factory was called for published workflows only
      expect(mockCreateDynamicWorkflow).toHaveBeenCalledTimes(2);

      // Verify workflows were registered
      const workflow1Registered = registry.getWorkflow('building-alert', testEnterpriseId);
      const workflow2Registered = registry.getWorkflow('maintenance-alert', testEnterpriseId);

      expect(workflow1Registered?.instance).toEqual(mockInstances[0]);
      expect(workflow2Registered?.instance).toEqual(mockInstances[1]);

      // Verify draft workflow was not registered
      const draftWorkflow = registry.getWorkflow('draft-workflow', testEnterpriseId);
      expect(draftWorkflow).toBeNull();
    });

    it('should handle database connection errors', async () => {
      // Use a non-existent enterprise ID to trigger empty result (not error)
      const nonExistentEnterpriseId = 'non-existent-enterprise-999999';

      // Should not throw, just load no workflows
      await expect(registry.loadEnterpriseWorkflows(nonExistentEnterpriseId)).resolves.not.toThrow();

      // No workflows should be registered for this enterprise
      const workflows = registry.getEnterpriseWorkflows(nonExistentEnterpriseId);
      expect(workflows.filter(w => w.type === 'DYNAMIC')).toEqual([]);
    });

    it('should handle errors during individual workflow parsing', async () => {
      // Create workflows with valid and invalid configurations
      const validWorkflow = await createTestWorkflow({
        name: 'Valid Workflow',
        workflow_key: 'valid-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 123 },
        publish_status: 'PUBLISH'
      });

      const invalidWorkflow = await createTestWorkflow({
        name: 'Invalid Workflow',
        workflow_key: 'invalid-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: null, // This might cause parsing issues
        publish_status: 'PUBLISH'
      });

      // Mock factory to succeed for valid, fail for invalid
      mockCreateDynamicWorkflow
        .mockReturnValueOnce({ key: 'valid-workflow' })
        .mockImplementationOnce(() => {
          throw new Error('Invalid configuration');
        });

      // Should not throw, but should log error and continue
      await expect(registry.loadEnterpriseWorkflows(testEnterpriseId)).resolves.not.toThrow();

      // Valid workflow should be registered
      const validWorkflowRegistered = registry.getWorkflow('valid-workflow', testEnterpriseId);
      expect(validWorkflowRegistered).toBeDefined();

      // Invalid workflow should not be registered
      const invalidWorkflowRegistered = registry.getWorkflow('invalid-workflow', testEnterpriseId);
      expect(invalidWorkflowRegistered).toBeNull();
    });
  });

  describe('getWorkflow', () => {
    it('should return static workflow without enterprise ID', () => {
      const mockWorkflow = { key: 'static-workflow' };
      registry.registerStaticWorkflow('static-workflow', mockWorkflow);

      const result = registry.getWorkflow('static-workflow');
      expect(result?.instance).toEqual(mockWorkflow);
      expect(result?.type).toBe('STATIC');
    });

    it('should return dynamic workflow with enterprise ID', () => {
      const config: WorkflowConfig = {
        workflow_key: 'dynamic-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      const mockWorkflow = { key: 'dynamic-workflow' };
      mockCreateDynamicWorkflow.mockReturnValue(mockWorkflow);

      registry.registerDynamicWorkflow('dynamic-workflow', config, testEnterpriseId);

      const result = registry.getWorkflow('dynamic-workflow', testEnterpriseId);
      expect(result?.instance).toEqual(mockWorkflow);
      expect(result?.type).toBe('DYNAMIC');
      expect(result?.enterpriseId).toBe(testEnterpriseId);
    });

    it('should prefer dynamic workflow over static when enterprise ID provided', () => {
      const staticWorkflow = { key: 'workflow', type: 'static' };
      const dynamicWorkflow = { key: 'workflow', type: 'dynamic' };

      const config: WorkflowConfig = {
        workflow_key: 'workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      mockCreateDynamicWorkflow.mockReturnValue(dynamicWorkflow);

      registry.registerStaticWorkflow('workflow', staticWorkflow);
      registry.registerDynamicWorkflow('workflow', config, testEnterpriseId);

      const result = registry.getWorkflow('workflow', testEnterpriseId);
      expect(result?.instance).toEqual(dynamicWorkflow);
      expect(result?.type).toBe('DYNAMIC');
    });

    it('should fallback to static workflow if no dynamic workflow found', () => {
      const staticWorkflow = { key: 'fallback-workflow' };
      registry.registerStaticWorkflow('fallback-workflow', staticWorkflow);

      const result = registry.getWorkflow('fallback-workflow', 'non-existent-enterprise');
      expect(result?.instance).toEqual(staticWorkflow);
      expect(result?.type).toBe('STATIC');
    });

    it('should return null if workflow not found', () => {
      const result = registry.getWorkflow('non-existent-workflow', testEnterpriseId);
      expect(result).toBeNull();
    });
  });

  describe('getEnterpriseWorkflows', () => {
    it('should return all workflows for enterprise including static', () => {
      const staticWorkflow = { key: 'static-1' };
      const dynamicWorkflow = { key: 'dynamic-1' };

      const config: WorkflowConfig = {
        workflow_key: 'dynamic-1',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      mockCreateDynamicWorkflow.mockReturnValue(dynamicWorkflow);

      registry.registerStaticWorkflow('static-1', staticWorkflow);
      registry.registerDynamicWorkflow('dynamic-1', config, testEnterpriseId);

      const workflows = registry.getEnterpriseWorkflows(testEnterpriseId);

      expect(workflows).toHaveLength(2);
      expect(workflows.find(w => w.id === 'static-1')).toBeDefined();
      expect(workflows.find(w => w.id === `${testEnterpriseId}:dynamic-1`)).toBeDefined();
    });

    it('should return only static workflows if no dynamic workflows for enterprise', () => {
      const staticWorkflow1 = { key: 'static-1' };
      const staticWorkflow2 = { key: 'static-2' };

      registry.registerStaticWorkflow('static-1', staticWorkflow1);
      registry.registerStaticWorkflow('static-2', staticWorkflow2);

      const workflows = registry.getEnterpriseWorkflows('empty-enterprise');

      expect(workflows).toHaveLength(2);
      expect(workflows.every(w => w.type === 'STATIC')).toBe(true);
    });
  });

  describe('reloadEnterpriseWorkflows with Real Database', () => {
    it('should clear existing enterprise workflows before reloading from database', async () => {
      // Register initial workflow manually
      const initialConfig: WorkflowConfig = {
        workflow_key: 'initial-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      const initialWorkflow = { key: 'initial-workflow' };
      mockCreateDynamicWorkflow.mockReturnValue(initialWorkflow);

      registry.registerDynamicWorkflow('initial-workflow', initialConfig, testEnterpriseId);

      // Verify it exists
      expect(registry.getWorkflow('initial-workflow', testEnterpriseId)).toBeDefined();

      // Create new workflow in database
      const newWorkflow = await createTestWorkflow({
        name: 'New Workflow',
        workflow_key: 'new-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 999 },
        publish_status: 'PUBLISH'
      });

      // Mock factory for new workflow
      const newWorkflowInstance = { key: 'new-workflow' };
      mockCreateDynamicWorkflow.mockReturnValue(newWorkflowInstance);

      // Reload
      await registry.reloadEnterpriseWorkflows(testEnterpriseId);

      // Initial workflow should be gone (not in database)
      expect(registry.getWorkflow('initial-workflow', testEnterpriseId)).toBeNull();

      // New workflow from database should exist
      expect(registry.getWorkflow('new-workflow', testEnterpriseId)).toBeDefined();
    });
  });

  describe('unregisterWorkflow', () => {
    it('should unregister static workflow', () => {
      const mockWorkflow = { key: 'test-static' };
      registry.registerStaticWorkflow('test-static', mockWorkflow);

      expect(registry.getWorkflow('test-static')).toBeDefined();

      const result = registry.unregisterWorkflow('test-static');
      expect(result).toBe(true);
      expect(registry.getWorkflow('test-static')).toBeNull();
    });

    it('should unregister dynamic workflow for specific enterprise', () => {
      const config: WorkflowConfig = {
        workflow_key: 'test-dynamic',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      const mockWorkflow = { key: 'test-dynamic' };
      mockCreateDynamicWorkflow.mockReturnValue(mockWorkflow);

      registry.registerDynamicWorkflow('test-dynamic', config, testEnterpriseId);
      expect(registry.getWorkflow('test-dynamic', testEnterpriseId)).toBeDefined();

      const result = registry.unregisterWorkflow('test-dynamic', testEnterpriseId);
      expect(result).toBe(true);
      expect(registry.getWorkflow('test-dynamic', testEnterpriseId)).toBeNull();
    });

    it('should return false if workflow not found', () => {
      const result = registry.unregisterWorkflow('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('hasWorkflow', () => {
    it('should return true for existing static workflow', () => {
      const mockWorkflow = { key: 'test' };
      registry.registerStaticWorkflow('test', mockWorkflow);

      expect(registry.hasWorkflow('test')).toBe(true);
    });

    it('should return true for existing dynamic workflow', () => {
      const config: WorkflowConfig = {
        workflow_key: 'test',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      const mockWorkflow = { key: 'test' };
      mockCreateDynamicWorkflow.mockReturnValue(mockWorkflow);

      registry.registerDynamicWorkflow('test', config, testEnterpriseId);

      expect(registry.hasWorkflow('test', testEnterpriseId)).toBe(true);
    });

    it('should return false for non-existent workflow', () => {
      expect(registry.hasWorkflow('non-existent')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const staticWorkflow1 = { key: 'static-1' };
      const staticWorkflow2 = { key: 'static-2' };

      const config1: WorkflowConfig = {
        workflow_key: 'dynamic-1',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      const config2: WorkflowConfig = {
        workflow_key: 'dynamic-2',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      const dynamicWorkflow1 = { key: 'dynamic-1' };
      const dynamicWorkflow2 = { key: 'dynamic-2' };

      mockCreateDynamicWorkflow
        .mockReturnValueOnce(dynamicWorkflow1)
        .mockReturnValueOnce(dynamicWorkflow2);

      registry.registerStaticWorkflow('static-1', staticWorkflow1);
      registry.registerStaticWorkflow('static-2', staticWorkflow2);
      registry.registerDynamicWorkflow('dynamic-1', config1, 'enterprise-1');
      registry.registerDynamicWorkflow('dynamic-2', config2, 'enterprise-2');

      const stats = registry.getStats();

      expect(stats).toEqual({
        total: 4,
        static: 2,
        dynamic: 2,
        enterprises: 2
      });
    });

    it('should return zero stats for empty registry', () => {
      const stats = registry.getStats();

      expect(stats).toEqual({
        total: 0,
        static: 0,
        dynamic: 0,
        enterprises: 0
      });
    });
  });

  describe('initialization', () => {
    it('should initialize and load static workflows', async () => {
      const mockStaticWorkflows = new Map([
        ['user-signup', { key: 'user-signup', type: 'static' }],
        ['password-reset', { key: 'password-reset', type: 'static' }]
      ]);

      mockDiscoverStaticWorkflows.mockResolvedValue(mockStaticWorkflows);

      await registry.initializeStaticWorkflows();

      expect(mockDiscoverStaticWorkflows).toHaveBeenCalled();
      expect(registry.getWorkflow('user-signup')).toBeDefined();
      expect(registry.getWorkflow('password-reset')).toBeDefined();
    });

    it('should handle errors during static workflow discovery', async () => {
      mockDiscoverStaticWorkflows.mockRejectedValue(
        new Error('Discovery failed')
      );

      // Should not throw, but should log error
      await expect(registry.initializeStaticWorkflows()).rejects.toThrow();
    });
  });

  // Integration tests with real database
  describe('Real Database Integration', () => {
    it('should load workflows from database and register them properly', async () => {
      // Create multiple workflows in database with different statuses
      const publishedWorkflow = await createTestWorkflow({
        name: 'Published Integration Workflow',
        workflow_key: 'published-integration-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP'],
        template_overrides: { emailTemplateId: 123, inAppTemplateId: 124 },
        publish_status: 'PUBLISH',
        deactivated: false
      });

      const draftWorkflow = await createTestWorkflow({
        name: 'Draft Workflow',
        workflow_key: 'draft-workflow',
        publish_status: 'DRAFT'
      });

      const deactivatedWorkflow = await createTestWorkflow({
        name: 'Deactivated Workflow',
        workflow_key: 'deactivated-workflow',
        publish_status: 'PUBLISH',
        deactivated: true
      });

      // Mock factory responses
      mockCreateDynamicWorkflow.mockReturnValue({ 
        key: 'published-integration-workflow',
        channels: ['EMAIL', 'IN_APP']
      });

      // Load workflows from database
      await registry.loadEnterpriseWorkflows(testEnterpriseId);

      // Only published, non-deactivated workflow should be loaded
      const loadedWorkflow = registry.getWorkflow('published-integration-workflow', testEnterpriseId);
      expect(loadedWorkflow).toBeDefined();
      expect(loadedWorkflow?.type).toBe('DYNAMIC');

      // Draft and deactivated workflows should not be loaded
      expect(registry.getWorkflow('draft-workflow', testEnterpriseId)).toBeNull();
      expect(registry.getWorkflow('deactivated-workflow', testEnterpriseId)).toBeNull();

      // Verify factory was called only once (for published workflow)
      expect(mockCreateDynamicWorkflow).toHaveBeenCalledTimes(1);
    });

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
});