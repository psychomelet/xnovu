import { workflowService, type WorkflowConfig } from '../database/WorkflowService';
import { DynamicWorkflowFactory } from './DynamicWorkflowFactory';
import { WorkflowDiscovery } from './WorkflowDiscovery';

export interface RegisteredWorkflow {
  id: string;
  type: 'STATIC' | 'DYNAMIC';
  instance: any; // Novu workflow instance
  config?: WorkflowConfig;
  enterpriseId?: string;
}

export class WorkflowRegistry {
  private static instance: WorkflowRegistry;
  private workflows = new Map<string, RegisteredWorkflow>();
  private staticWorkflows = new Map<string, any>(); // workflow_key -> workflow instance
  private enterpriseWorkflows = new Map<string, Map<string, RegisteredWorkflow>>(); // enterpriseId -> workflows

  static getInstance(): WorkflowRegistry {
    if (!WorkflowRegistry.instance) {
      WorkflowRegistry.instance = new WorkflowRegistry();
    }
    return WorkflowRegistry.instance;
  }

  /**
   * Register a static workflow (from code)
   */
  registerStaticWorkflow(workflowKey: string, workflowInstance: any): void {
    this.staticWorkflows.set(workflowKey, workflowInstance);
    
    const registeredWorkflow: RegisteredWorkflow = {
      id: workflowKey,
      type: 'STATIC',
      instance: workflowInstance
    };

    this.workflows.set(workflowKey, registeredWorkflow);
    console.log(`Registered static workflow: ${workflowKey}`);
  }

  /**
   * Register a dynamic workflow for a specific enterprise
   */
  registerDynamicWorkflow(
    workflowKey: string, 
    config: WorkflowConfig, 
    enterpriseId: string
  ): void {
    // Validate config before creating workflow
    if (!DynamicWorkflowFactory.validateWorkflowConfig(config)) {
      throw new Error(`Invalid workflow configuration for ${workflowKey}`);
    }

    // Create dynamic workflow instance
    const workflowInstance = DynamicWorkflowFactory.createDynamicWorkflow(config, enterpriseId);

    const registeredWorkflow: RegisteredWorkflow = {
      id: `${enterpriseId}:${workflowKey}`,
      type: 'DYNAMIC',
      instance: workflowInstance,
      config,
      enterpriseId
    };

    // Store in main registry
    this.workflows.set(registeredWorkflow.id, registeredWorkflow);

    // Store in enterprise-specific registry
    if (!this.enterpriseWorkflows.has(enterpriseId)) {
      this.enterpriseWorkflows.set(enterpriseId, new Map());
    }
    this.enterpriseWorkflows.get(enterpriseId)!.set(workflowKey, registeredWorkflow);

    console.log(`Registered dynamic workflow: ${workflowKey} for enterprise: ${enterpriseId}`);
  }

  /**
   * Load and register all dynamic workflows for an enterprise
   */
  async loadEnterpriseWorkflows(enterpriseId: string): Promise<void> {
    try {
      const dynamicWorkflows = await workflowService.getDynamicWorkflows(enterpriseId);

      for (const workflowRow of dynamicWorkflows) {
        try {
          const config = await workflowService.parseWorkflowConfig(workflowRow);
          this.registerDynamicWorkflow(config.workflow_key, config, enterpriseId);
        } catch (error) {
          console.error(`Failed to register dynamic workflow ${workflowRow.workflow_key} for enterprise ${enterpriseId}:`, error);
        }
      }

      console.log(`Loaded ${dynamicWorkflows.length} dynamic workflows for enterprise: ${enterpriseId}`);
    } catch (error) {
      console.error(`Failed to load workflows for enterprise ${enterpriseId}:`, error);
      throw error;
    }
  }

  /**
   * Initialize registry by loading static workflows from filesystem
   */
  async initializeStaticWorkflows(): Promise<void> {
    try {
      const staticWorkflows = await WorkflowDiscovery.discoverStaticWorkflows();
      
      for (const [workflowKey, workflowInstance] of staticWorkflows.entries()) {
        this.registerStaticWorkflow(workflowKey, workflowInstance);
      }

      console.log(`Initialized ${staticWorkflows.size} static workflows`);
    } catch (error) {
      console.error('Failed to initialize static workflows:', error);
      throw error;
    }
  }

  /**
   * Get a workflow by key (checks static first, then enterprise-specific)
   */
  getWorkflow(workflowKey: string, enterpriseId?: string): RegisteredWorkflow | null {
    // First check static workflows
    if (this.workflows.has(workflowKey)) {
      return this.workflows.get(workflowKey)!;
    }

    // Then check enterprise-specific workflows
    if (enterpriseId) {
      const enterpriseWorkflowMap = this.enterpriseWorkflows.get(enterpriseId);
      if (enterpriseWorkflowMap?.has(workflowKey)) {
        return enterpriseWorkflowMap.get(workflowKey)!;
      }

      // Also check with enterprise prefix
      const prefixedKey = `${enterpriseId}:${workflowKey}`;
      if (this.workflows.has(prefixedKey)) {
        return this.workflows.get(prefixedKey)!;
      }
    }

    return null;
  }

  /**
   * Get all workflows for an enterprise
   */
  getEnterpriseWorkflows(enterpriseId: string): RegisteredWorkflow[] {
    const workflows: RegisteredWorkflow[] = [];

    // Add static workflows
    for (const workflow of this.workflows.values()) {
      if (workflow.type === 'STATIC') {
        workflows.push(workflow);
      }
    }

    // Add enterprise-specific dynamic workflows
    const enterpriseWorkflowMap = this.enterpriseWorkflows.get(enterpriseId);
    if (enterpriseWorkflowMap) {
      workflows.push(...enterpriseWorkflowMap.values());
    }

    return workflows;
  }

  /**
   * Get all registered workflow keys
   */
  getAllWorkflowKeys(): string[] {
    return Array.from(this.workflows.keys());
  }

  /**
   * Get all static workflow keys
   */
  getStaticWorkflowKeys(): string[] {
    return Array.from(this.staticWorkflows.keys());
  }

  /**
   * Get all dynamic workflow keys for an enterprise
   */
  getDynamicWorkflowKeys(enterpriseId: string): string[] {
    const enterpriseWorkflowMap = this.enterpriseWorkflows.get(enterpriseId);
    return enterpriseWorkflowMap ? Array.from(enterpriseWorkflowMap.keys()) : [];
  }

  /**
   * Reload dynamic workflows for an enterprise
   */
  async reloadEnterpriseWorkflows(enterpriseId: string): Promise<void> {
    // Clear existing enterprise workflows
    this.enterpriseWorkflows.delete(enterpriseId);
    
    // Remove enterprise workflows from main registry
    for (const [key, workflow] of this.workflows.entries()) {
      if (workflow.enterpriseId === enterpriseId) {
        this.workflows.delete(key);
      }
    }

    // Reload workflows
    await this.loadEnterpriseWorkflows(enterpriseId);
  }

  /**
   * Unregister a workflow
   */
  unregisterWorkflow(workflowKey: string, enterpriseId?: string): boolean {
    let removed = false;

    // Remove from main registry
    if (this.workflows.has(workflowKey)) {
      this.workflows.delete(workflowKey);
      removed = true;
    }

    // Remove from enterprise registry if specified
    if (enterpriseId) {
      const enterpriseWorkflowMap = this.enterpriseWorkflows.get(enterpriseId);
      if (enterpriseWorkflowMap?.has(workflowKey)) {
        enterpriseWorkflowMap.delete(workflowKey);
        removed = true;
      }

      // Also try with prefixed key
      const prefixedKey = `${enterpriseId}:${workflowKey}`;
      if (this.workflows.has(prefixedKey)) {
        this.workflows.delete(prefixedKey);
        removed = true;
      }
    }

    if (removed) {
      console.log(`Unregistered workflow: ${workflowKey}${enterpriseId ? ` for enterprise: ${enterpriseId}` : ''}`);
    }

    return removed;
  }

  /**
   * Check if a workflow is registered
   */
  hasWorkflow(workflowKey: string, enterpriseId?: string): boolean {
    return this.getWorkflow(workflowKey, enterpriseId) !== null;
  }

  /**
   * Get workflow statistics
   */
  getStats() {
    const totalWorkflows = this.workflows.size;
    const staticCount = Array.from(this.workflows.values()).filter(w => w.type === 'STATIC').length;
    const dynamicCount = totalWorkflows - staticCount;
    const enterpriseCount = this.enterpriseWorkflows.size;

    return {
      total: totalWorkflows,
      static: staticCount,
      dynamic: dynamicCount,
      enterprises: enterpriseCount
    };
  }
}

// Export singleton instance
export const workflowRegistry = WorkflowRegistry.getInstance();