import { promises as fs } from 'fs';
import * as path from 'path';

export interface DiscoveredWorkflow {
  workflowKey: string;
  filePath: string;
  directory: string;
  exports: any;
}

export class WorkflowDiscovery {
  private static get WORKFLOWS_DIR(): string {
    return path.join(process.cwd(), 'app/novu/workflows');
  }

  /**
   * Discover all static workflows from the filesystem
   */
  static async discoverStaticWorkflows(): Promise<Map<string, any>> {
    const workflows = new Map<string, any>();

    try {
      const workflowDirs = await this.getWorkflowDirectories();

      for (const workflowDir of workflowDirs) {
        try {
          const workflow = await this.loadWorkflowFromDirectory(workflowDir);
          if (workflow) {
            workflows.set(workflow.workflowKey, workflow.exports);
            console.log(`Discovered static workflow: ${workflow.workflowKey} from ${workflow.directory}`);
          }
        } catch (error) {
          console.warn(`Failed to load workflow from ${workflowDir}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to discover static workflows:', error);
      throw error;
    }

    return workflows;
  }

  /**
   * Get all workflow directories
   */
  private static async getWorkflowDirectories(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.WORKFLOWS_DIR, { withFileTypes: true });
      
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(this.WORKFLOWS_DIR, entry.name))
        .filter(dir => !path.basename(dir).startsWith('.')) // Ignore hidden directories
        .filter(dir => !path.basename(dir).startsWith('_')); // Ignore private directories
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.warn(`Workflows directory not found: ${this.WORKFLOWS_DIR}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Load a workflow from a specific directory
   */
  private static async loadWorkflowFromDirectory(workflowDir: string): Promise<DiscoveredWorkflow | null> {
    const indexPath = path.join(workflowDir, 'index.ts');
    const workflowPath = path.join(workflowDir, 'workflow.ts');

    // Check if index.ts exists (required)
    if (!(await this.fileExists(indexPath))) {
      console.warn(`No index.ts found in ${workflowDir}, skipping`);
      return null;
    }

    try {
      // For now, we'll use directory-based workflow key extraction
      // Dynamic imports cause issues in Next.js build, so we'll skip module validation
      const workflowKey = this.convertToKebabCase(path.basename(workflowDir));
      
      if (!workflowKey) {
        console.warn(`Could not determine workflow key for ${workflowDir}, skipping`);
        return null;
      }

      // Return placeholder for now - actual workflow loading will happen at runtime
      return {
        workflowKey,
        filePath: indexPath,
        directory: workflowDir,
        exports: null // Will be loaded dynamically at runtime
      };
    } catch (error) {
      console.error(`Failed to process workflow from ${workflowDir}:`, error);
      return null;
    }
  }

  /**
   * Extract workflow key from directory name or module exports
   */
  private static extractWorkflowKey(workflowDir: string, workflowModule: any): string | null {
    // Try to get workflow key from module exports
    if (workflowModule.WORKFLOW_KEY) {
      return workflowModule.WORKFLOW_KEY;
    }

    // Try to get from exported workflow instance
    const exportedWorkflows = Object.values(workflowModule).filter(
      (value: any) => value && typeof value === 'object' && value.workflowId
    );

    if (exportedWorkflows.length > 0) {
      return (exportedWorkflows[0] as any).workflowId;
    }

    // Fall back to directory name converted to kebab-case
    const dirName = path.basename(workflowDir);
    return this.convertToKebabCase(dirName);
  }

  /**
   * Check if a module exports a valid workflow
   */
  private static isValidWorkflowModule(workflowModule: any): boolean {
    // Check if module has any workflow exports
    const values = Object.values(workflowModule);
    
    return values.some((value: any) => {
      // Check for Novu workflow signature
      return value && 
             typeof value === 'object' && 
             (value.workflowId || value.trigger || value.steps);
    });
  }

  /**
   * Convert string to kebab-case
   */
  private static convertToKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * Check if a file exists
   */
  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get workflow metadata from a directory
   */
  static async getWorkflowMetadata(workflowDir: string): Promise<{
    hasIndex: boolean;
    hasWorkflow: boolean;
    hasSchemas: boolean;
    hasTypes: boolean;
    files: string[];
  }> {
    const files = await fs.readdir(workflowDir);
    
    return {
      hasIndex: files.includes('index.ts'),
      hasWorkflow: files.includes('workflow.ts'),
      hasSchemas: files.includes('schemas.ts'),
      hasTypes: files.includes('types.ts'),
      files
    };
  }

  /**
   * Validate workflow directory structure
   */
  static async validateWorkflowDirectory(workflowDir: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const metadata = await this.getWorkflowMetadata(workflowDir);

      // Required files
      if (!metadata.hasIndex) {
        errors.push('Missing required index.ts file');
      }

      // Recommended files
      if (!metadata.hasWorkflow) {
        warnings.push('Missing workflow.ts file');
      }

      if (!metadata.hasSchemas) {
        warnings.push('Missing schemas.ts file');
      }

      if (!metadata.hasTypes) {
        warnings.push('Missing types.ts file');
      }

      // Check for valid workflow export
      if (metadata.hasIndex) {
        try {
          const indexPath = path.join(workflowDir, 'index.ts');
          const workflowModule = await import(indexPath);
          
          if (!this.isValidWorkflowModule(workflowModule)) {
            errors.push('index.ts does not export a valid workflow');
          }
        } catch (error) {
          errors.push(`Failed to import index.ts: ${error}`);
        }
      }

    } catch (error) {
      errors.push(`Failed to validate directory: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get list of all workflow directories with their validation status
   */
  static async getAllWorkflowsStatus(): Promise<{
    directory: string;
    workflowKey: string | null;
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }[]> {
    const results: {
      directory: string;
      workflowKey: string | null;
      isValid: boolean;
      errors: string[];
      warnings: string[];
    }[] = [];

    try {
      const workflowDirs = await this.getWorkflowDirectories();

      for (const workflowDir of workflowDirs) {
        const validation = await this.validateWorkflowDirectory(workflowDir);
        
        let workflowKey: string | null = null;
        if (validation.isValid) {
          try {
            const workflow = await this.loadWorkflowFromDirectory(workflowDir);
            workflowKey = workflow?.workflowKey || null;
          } catch {
            // Ignore errors, workflowKey will remain null
          }
        }

        results.push({
          directory: path.basename(workflowDir),
          workflowKey,
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings
        });
      }
    } catch (error) {
      console.error('Failed to get workflows status:', error);
    }

    return results;
  }
}