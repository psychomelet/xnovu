import { workflowRegistry } from './WorkflowRegistry';
import { getAllWorkflows } from '../../novu/workflow-loader';
import { logger } from '@/app/services/logger';

export class WorkflowLoader {
  private static initialized = false;

  /**
   * Initialize the workflow system
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing XNovu Workflow System...');

    try {
      // 1. Initialize static workflows from filesystem
      await workflowRegistry.initializeStaticWorkflows();

      // 2. Auto-register all workflows from the generated loader
      const allWorkflows = getAllWorkflows();
      for (const workflow of allWorkflows) {
        if (workflow && workflow.id) {
          workflowRegistry.registerStaticWorkflow(workflow.id, workflow);
          logger.debug(`Registered workflow: ${workflow.id}`);
        }
      }

      // 3. Load dynamic workflows for all enterprises (this would be done on-demand in production)
      // For now we'll skip this as it requires enterprise context

      const stats = workflowRegistry.getStats();
      logger.info('Workflow system initialized', { total: stats.total, static: stats.static, dynamic: stats.dynamic });

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize workflow system', error as Error);
      throw error;
    }
  }

  /**
   * Get all workflows for Novu serve
   */
  static async getAllWorkflows(enterpriseId?: string): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const workflows: any[] = [];

    if (enterpriseId) {
      // Get workflows for specific enterprise
      const enterpriseWorkflows = workflowRegistry.getEnterpriseWorkflows(enterpriseId);
      workflows.push(...enterpriseWorkflows.map(w => w.instance));
    } else {
      // Get all static workflows (for general bridge endpoint)
      const staticWorkflowKeys = workflowRegistry.getStaticWorkflowKeys();
      for (const key of staticWorkflowKeys) {
        const workflow = workflowRegistry.getWorkflow(key);
        if (workflow?.instance) {
          workflows.push(workflow.instance);
        }
      }
    }

    return workflows;
  }

  /**
   * Load workflows for a specific enterprise
   */
  static async loadEnterpriseWorkflows(enterpriseId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await workflowRegistry.loadEnterpriseWorkflows(enterpriseId);
  }

  /**
   * Get workflow by key
   */
  static getWorkflow(workflowKey: string, enterpriseId?: string): any {
    const workflow = workflowRegistry.getWorkflow(workflowKey, enterpriseId);
    return workflow?.instance || null;
  }

  /**
   * Check if workflow exists
   */
  static hasWorkflow(workflowKey: string, enterpriseId?: string): boolean {
    return workflowRegistry.hasWorkflow(workflowKey, enterpriseId);
  }

  /**
   * Get workflow registry stats
   */
  static getStats() {
    return workflowRegistry.getStats();
  }

  /**
   * Reload workflows for an enterprise
   */
  static async reloadEnterpriseWorkflows(enterpriseId: string): Promise<void> {
    await workflowRegistry.reloadEnterpriseWorkflows(enterpriseId);
  }
}

export const workflowLoader = WorkflowLoader;