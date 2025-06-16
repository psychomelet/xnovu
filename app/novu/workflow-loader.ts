/**
 * Auto-generated workflow loader
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

// Import all workflows
import { defaultChatWorkflow } from "./workflows/default-chat/workflow";
import { defaultEmailWorkflow } from "./workflows/default-email/workflow";
import { defaultInAppWorkflow } from "./workflows/default-in-app/workflow";
import { defaultMultiChannelWorkflow } from "./workflows/default-multi-channel/workflow";
import { defaultPushWorkflow } from "./workflows/default-push/workflow";
import { defaultSmsWorkflow } from "./workflows/default-sms/workflow";
import { templateDemoWorkflow } from "./workflows/template-demo/workflow";
import { welcomeOnboardingEmail } from "./workflows/welcome-onboarding-email/workflow";
import { yogoEmail } from "./workflows/yogo-email/workflow";

// Array of all workflow instances
export const workflows = [
  defaultChatWorkflow,
  defaultEmailWorkflow,
  defaultInAppWorkflow,
  defaultMultiChannelWorkflow,
  defaultPushWorkflow,
  defaultSmsWorkflow,
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
