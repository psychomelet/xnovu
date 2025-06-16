/**
 * Auto-generated workflow loader
 * Generated at: 2025-06-16T06:10:00.844Z
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

// Import all workflows
import * as templatedemoModule from "./workflows/template-demo";
import * as welcomeonboardingemailModule from "./workflows/welcome-onboarding-email";
import * as yogoemailModule from "./workflows/yogo-email";

// Map of all workflow modules
export const workflowModules = {
  "template-demo": templatedemoModule,
  "welcome-onboarding-email": welcomeonboardingemailModule,
  "yogo-email": yogoemailModule,
};

// Get all workflow instances
export function getAllWorkflows() {
  const workflows: any[] = [];
  
  Object.values(workflowModules).forEach(workflowModule => {
    // Find workflow instances in the module
    Object.values(workflowModule).forEach(exported => {
      if (exported && typeof exported === 'object' && 'workflowId' in exported) {
        workflows.push(exported);
      }
    });
  });
  
  return workflows;
}

// Get workflow by ID
export function getWorkflowById(workflowId: string) {
  for (const workflowModule of Object.values(workflowModules)) {
    for (const exported of Object.values(workflowModule)) {
      if (exported && typeof exported === 'object' && 'workflowId' in exported && exported.workflowId === workflowId) {
        return exported;
      }
    }
  }
  return null;
}
