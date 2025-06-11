import { WorkflowRegistry } from '../app/services/workflow/WorkflowRegistry';
import type { WorkflowConfig } from '../app/services/database/WorkflowService';

// Mock WorkflowService
jest.mock('../app/services/database/WorkflowService', () => ({
  WorkflowService: jest.fn().mockImplementation(() => ({
    getDynamicWorkflows: jest.fn(),
    parseWorkflowConfig: jest.fn()
  })),
  workflowService: {
    getDynamicWorkflows: jest.fn(),
    parseWorkflowConfig: jest.fn()
  }
}));

jest.mock('../app/services/workflow/DynamicWorkflowFactory', () => ({
  DynamicWorkflowFactory: {
    createDynamicWorkflow: jest.fn(),
    validateWorkflowConfig: jest.fn().mockReturnValue(true)
  }
}));

jest.mock('../app/services/workflow/WorkflowDiscovery', () => ({
  WorkflowDiscovery: {
    discoverStaticWorkflows: jest.fn()
  }
}));

describe('WorkflowRegistry', () => {
  let registry: WorkflowRegistry;
  let mockDynamicWorkflowFactory: any;
  let mockWorkflowDiscovery: any;
  let mockWorkflowService: any;
  const mockEnterpriseId = 'test-enterprise-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockDynamicWorkflowFactory = require('../app/services/workflow/DynamicWorkflowFactory').DynamicWorkflowFactory;
    mockWorkflowDiscovery = require('../app/services/workflow/WorkflowDiscovery').WorkflowDiscovery;
    mockWorkflowService = require('../app/services/database/WorkflowService').workflowService;
    
    // Reset all mock functions before each test
    mockDynamicWorkflowFactory.createDynamicWorkflow.mockReset();
    mockDynamicWorkflowFactory.validateWorkflowConfig.mockReset().mockReturnValue(true);
    mockWorkflowService.getDynamicWorkflows.mockReset();
    mockWorkflowService.parseWorkflowConfig.mockReset();
    
    registry = new WorkflowRegistry();
  });

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
      mockDynamicWorkflowFactory.createDynamicWorkflow.mockReturnValue(mockWorkflow);

      registry.registerDynamicWorkflow('building-alert', config, mockEnterpriseId);

      expect(mockDynamicWorkflowFactory.createDynamicWorkflow).toHaveBeenCalledWith(
        config,
        mockEnterpriseId
      );

      const registered = registry.getWorkflow('building-alert', mockEnterpriseId);
      expect(registered).toEqual({
        id: `${mockEnterpriseId}:building-alert`,
        type: 'DYNAMIC',
        instance: mockWorkflow,
        config,
        enterpriseId: mockEnterpriseId
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

      mockDynamicWorkflowFactory.createDynamicWorkflow
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

  describe('loadEnterpriseWorkflows', () => {
    it('should load all dynamic workflows for enterprise', async () => {
      const mockWorkflows = [
        {
          id: 1,
          name: 'Building Alert',
          workflow_key: 'building-alert',
          workflow_type: 'DYNAMIC' as const,
          default_channels: ['EMAIL'],
          template_overrides: { emailTemplateId: 123 },
          enterprise_id: mockEnterpriseId,
          publish_status: 'PUBLISH' as const,
          deactivated: false,
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          payload_schema: null,
          description: null,
          tags: null
        },
        {
          id: 2,
          name: 'Maintenance Alert',
          workflow_key: 'maintenance-alert',
          workflow_type: 'DYNAMIC' as const,
          default_channels: ['EMAIL', 'IN_APP'],
          template_overrides: { emailTemplateId: 124, inAppTemplateId: 125 },
          enterprise_id: mockEnterpriseId,
          publish_status: 'PUBLISH' as const,
          deactivated: false,
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          payload_schema: null,
          description: null,
          tags: null
        }
      ];

      const mockConfigs = [
        {
          workflow_key: 'building-alert',
          workflow_type: 'DYNAMIC' as const,
          channels: ['EMAIL'],
          emailTemplateId: 123
        },
        {
          workflow_key: 'maintenance-alert',
          workflow_type: 'DYNAMIC' as const,
          channels: ['EMAIL', 'IN_APP'],
          emailTemplateId: 124,
          inAppTemplateId: 125
        }
      ];

      mockWorkflowService.getDynamicWorkflows.mockResolvedValue(mockWorkflows);
      mockWorkflowService.parseWorkflowConfig
        .mockResolvedValueOnce(mockConfigs[0])
        .mockResolvedValueOnce(mockConfigs[1]);

      const mockInstances = [
        { key: 'building-alert' },
        { key: 'maintenance-alert' }
      ];

      mockDynamicWorkflowFactory.createDynamicWorkflow
        .mockReturnValueOnce(mockInstances[0])
        .mockReturnValueOnce(mockInstances[1]);

      await registry.loadEnterpriseWorkflows(mockEnterpriseId);

      expect(mockWorkflowService.getDynamicWorkflows).toHaveBeenCalledWith(mockEnterpriseId);
      expect(mockWorkflowService.parseWorkflowConfig).toHaveBeenCalledTimes(2);
      expect(mockDynamicWorkflowFactory.createDynamicWorkflow).toHaveBeenCalledTimes(2);

      // Verify workflows were registered
      const workflow1 = registry.getWorkflow('building-alert', mockEnterpriseId);
      const workflow2 = registry.getWorkflow('maintenance-alert', mockEnterpriseId);

      expect(workflow1?.instance).toEqual(mockInstances[0]);
      expect(workflow2?.instance).toEqual(mockInstances[1]);
    });

    it('should handle errors during workflow loading', async () => {
      mockWorkflowService.getDynamicWorkflows.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        registry.loadEnterpriseWorkflows(mockEnterpriseId)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle errors during individual workflow parsing', async () => {
      const mockWorkflows = [
        {
          id: 1,
          workflow_key: 'valid-workflow',
          workflow_type: 'DYNAMIC' as const,
          default_channels: ['EMAIL'],
          enterprise_id: mockEnterpriseId,
          template_overrides: { emailTemplateId: 123 },
          publish_status: 'PUBLISH' as const,
          deactivated: false,
          name: 'Valid',
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          payload_schema: null,
          description: null,
          tags: null
        },
        {
          id: 2,
          workflow_key: 'invalid-workflow',
          workflow_type: 'DYNAMIC' as const,
          default_channels: ['EMAIL'],
          enterprise_id: mockEnterpriseId,
          template_overrides: null, // Invalid config
          publish_status: 'PUBLISH' as const,
          deactivated: false,
          name: 'Invalid',
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          payload_schema: null,
          description: null,
          tags: null
        }
      ];

      mockWorkflowService.getDynamicWorkflows.mockResolvedValue(mockWorkflows);
      mockWorkflowService.parseWorkflowConfig
        .mockResolvedValueOnce({
          workflow_key: 'valid-workflow',
          workflow_type: 'DYNAMIC' as const,
          channels: ['EMAIL'],
          emailTemplateId: 123
        })
        .mockRejectedValueOnce(new Error('Invalid configuration'));

      mockDynamicWorkflowFactory.createDynamicWorkflow.mockReturnValue({
        key: 'valid-workflow'
      });

      // Should not throw, but should log error and continue
      await registry.loadEnterpriseWorkflows(mockEnterpriseId);

      // Valid workflow should be registered
      const validWorkflow = registry.getWorkflow('valid-workflow', mockEnterpriseId);
      expect(validWorkflow).toBeDefined();

      // Invalid workflow should not be registered
      const invalidWorkflow = registry.getWorkflow('invalid-workflow', mockEnterpriseId);
      expect(invalidWorkflow).toBeNull();
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
      mockDynamicWorkflowFactory.createDynamicWorkflow.mockReturnValue(mockWorkflow);

      registry.registerDynamicWorkflow('dynamic-workflow', config, mockEnterpriseId);

      const result = registry.getWorkflow('dynamic-workflow', mockEnterpriseId);
      expect(result?.instance).toEqual(mockWorkflow);
      expect(result?.type).toBe('DYNAMIC');
      expect(result?.enterpriseId).toBe(mockEnterpriseId);
    });

    it('should prefer dynamic workflow over static when enterprise ID provided', () => {
      const staticWorkflow = { key: 'workflow', type: 'static' };
      const dynamicWorkflow = { key: 'workflow', type: 'dynamic' };

      const config: WorkflowConfig = {
        workflow_key: 'workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      mockDynamicWorkflowFactory.createDynamicWorkflow.mockReturnValue(dynamicWorkflow);

      registry.registerStaticWorkflow('workflow', staticWorkflow);
      registry.registerDynamicWorkflow('workflow', config, mockEnterpriseId);

      const result = registry.getWorkflow('workflow', mockEnterpriseId);
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
      const result = registry.getWorkflow('non-existent-workflow', mockEnterpriseId);
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

      mockDynamicWorkflowFactory.createDynamicWorkflow.mockReturnValue(dynamicWorkflow);

      registry.registerStaticWorkflow('static-1', staticWorkflow);
      registry.registerDynamicWorkflow('dynamic-1', config, mockEnterpriseId);

      const workflows = registry.getEnterpriseWorkflows(mockEnterpriseId);

      expect(workflows).toHaveLength(2);
      expect(workflows.find(w => w.id === 'static-1')).toBeDefined();
      expect(workflows.find(w => w.id === `${mockEnterpriseId}:dynamic-1`)).toBeDefined();
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

  describe('reloadEnterpriseWorkflows', () => {
    it('should clear existing enterprise workflows before reloading', async () => {
      const config: WorkflowConfig = {
        workflow_key: 'old-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL']
      };

      const oldWorkflow = { key: 'old-workflow' };
      mockDynamicWorkflowFactory.createDynamicWorkflow.mockReturnValue(oldWorkflow);

      // Register initial workflow
      registry.registerDynamicWorkflow('old-workflow', config, mockEnterpriseId);

      // Verify it exists
      expect(registry.getWorkflow('old-workflow', mockEnterpriseId)).toBeDefined();

      // Mock new workflows from database
      const newWorkflows = [
        {
          id: 1,
          workflow_key: 'new-workflow',
          workflow_type: 'DYNAMIC' as const,
          default_channels: ['EMAIL'],
          enterprise_id: mockEnterpriseId,
          template_overrides: { emailTemplateId: 999 },
          publish_status: 'PUBLISH' as const,
          deactivated: false,
          name: 'New Workflow',
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          payload_schema: null,
          description: null,
          tags: null
        }
      ];

      const newConfig: WorkflowConfig = {
        workflow_key: 'new-workflow',
        workflow_type: 'DYNAMIC',
        channels: ['EMAIL'],
        emailTemplateId: 999
      };

      const newWorkflow = { key: 'new-workflow' };

      mockWorkflowService.getDynamicWorkflows.mockResolvedValue(newWorkflows);
      mockWorkflowService.parseWorkflowConfig.mockResolvedValue(newConfig);
      mockDynamicWorkflowFactory.createDynamicWorkflow.mockReturnValue(newWorkflow);

      // Reload
      await registry.reloadEnterpriseWorkflows(mockEnterpriseId);

      // Old workflow should be gone
      expect(registry.getWorkflow('old-workflow', mockEnterpriseId)).toBeNull();

      // New workflow should exist
      expect(registry.getWorkflow('new-workflow', mockEnterpriseId)).toBeDefined();
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
      mockDynamicWorkflowFactory.createDynamicWorkflow.mockReturnValue(mockWorkflow);

      registry.registerDynamicWorkflow('test-dynamic', config, mockEnterpriseId);
      expect(registry.getWorkflow('test-dynamic', mockEnterpriseId)).toBeDefined();

      const result = registry.unregisterWorkflow('test-dynamic', mockEnterpriseId);
      expect(result).toBe(true);
      expect(registry.getWorkflow('test-dynamic', mockEnterpriseId)).toBeNull();
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
      mockDynamicWorkflowFactory.createDynamicWorkflow.mockReturnValue(mockWorkflow);

      registry.registerDynamicWorkflow('test', config, mockEnterpriseId);

      expect(registry.hasWorkflow('test', mockEnterpriseId)).toBe(true);
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

      mockDynamicWorkflowFactory.createDynamicWorkflow
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

      mockWorkflowDiscovery.discoverStaticWorkflows.mockResolvedValue(mockStaticWorkflows);

      await registry.initializeStaticWorkflows();

      expect(mockWorkflowDiscovery.discoverStaticWorkflows).toHaveBeenCalled();
      expect(registry.getWorkflow('user-signup')).toBeDefined();
      expect(registry.getWorkflow('password-reset')).toBeDefined();
    });

    it('should handle errors during static workflow discovery', async () => {
      mockWorkflowDiscovery.discoverStaticWorkflows.mockRejectedValue(
        new Error('Discovery failed')
      );

      // Should not throw, but should log error
      await expect(registry.initializeStaticWorkflows()).rejects.toThrow();
    });
  });
});