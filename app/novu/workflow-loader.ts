/**
 * Auto-generated workflow loader
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

// Import all static workflows
import { defaultChatWorkflow } from "./workflows/static/default-chat/workflow";
import { defaultEmailWorkflow } from "./workflows/static/default-email/workflow";
import { defaultInAppWorkflow } from "./workflows/static/default-in-app/workflow";
import { defaultMultiChannelWorkflow } from "./workflows/static/default-multi-channel/workflow";
import { defaultPushWorkflow } from "./workflows/static/default-push/workflow";
import { defaultSmsWorkflow } from "./workflows/static/default-sms/workflow";

// Array of all workflow instances
export const workflows = [
  defaultChatWorkflow,
  defaultEmailWorkflow,
  defaultInAppWorkflow,
  defaultMultiChannelWorkflow,
  defaultPushWorkflow,
  defaultSmsWorkflow,
];

// Get all workflow instances
export function getAllWorkflows() {
  return workflows;
}

// Get workflow by ID
export function getWorkflowById(workflowId: string) {
  return workflows.find(workflow => workflow.id === workflowId);
}
