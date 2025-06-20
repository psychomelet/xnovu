/**
 * Auto-generated workflow loader
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

// Import all workflows
import { defaultChatWorkflow } from "./workflows/static/default-chat/workflow";
import { defaultEmailWorkflow } from "./workflows/static/default-email/workflow";
import { defaultInAppWorkflow } from "./workflows/static/default-in-app/workflow";
import { defaultMultiChannelWorkflow } from "./workflows/static/default-multi-channel/workflow";
import { defaultPushWorkflow } from "./workflows/static/default-push/workflow";
import { defaultSmsWorkflow } from "./workflows/static/default-sms/workflow";

// Workflow keys for easy reference
export const WORKFLOW_KEYS = {
  chat: 'default-chat',
  email: 'default-email',
  inApp: 'default-in-app',
  multiChannel: 'default-multi-channel',
  push: 'default-push',
  sms: 'default-sms',
} as const;

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
