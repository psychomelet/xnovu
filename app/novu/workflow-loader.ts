/**
 * Auto-generated workflow loader
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

// Import all workflows
import { templateDemoWorkflow } from "./workflows/template-demo/workflow";
import { welcomeOnboardingEmail } from "./workflows/welcome-onboarding-email/workflow";
import { yogoEmail } from "./workflows/yogo-email/workflow";

// Array of all workflow instances
export const workflows = [
  templateDemoWorkflow,
  welcomeOnboardingEmail,
  yogoEmail,
];

// Get all workflow instances
export function getAllWorkflows() {
  return workflows;
}

// Get workflow by ID
export function getWorkflowById(workflowId: string) {
  return workflows.find(workflow => workflow.id === workflowId);
}
