/**
 * Auto-generated workflow loader
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

// Import all workflows
import { defaultDynamicMultiWorkflow } from "./workflows/dynamic/default-dynamic-multi/workflow";
import { defaultChatWorkflow } from "./workflows/static/default-chat/workflow";
import { defaultEmailWorkflow } from "./workflows/static/default-email/workflow";
import { defaultFireAssessmentWorkflow } from "./workflows/static/default-fire-assessment/workflow";
import { defaultFireDrillWorkflow } from "./workflows/static/default-fire-drill/workflow";
import { defaultFireEmergencyWorkflow } from "./workflows/static/default-fire-emergency/workflow";
import { defaultFireInspectionWorkflow } from "./workflows/static/default-fire-inspection/workflow";
import { defaultFireMaintenanceWorkflow } from "./workflows/static/default-fire-maintenance/workflow";
import { defaultFireTrainingWorkflow } from "./workflows/static/default-fire-training/workflow";
import { defaultInAppWorkflow } from "./workflows/static/default-in-app/workflow";
import { defaultMultiChannelWorkflow } from "./workflows/static/default-multi-channel/workflow";
import { defaultPushWorkflow } from "./workflows/static/default-push/workflow";
import { defaultSmsWorkflow } from "./workflows/static/default-sms/workflow";

// Workflow keys for easy reference
export const WORKFLOW_KEYS = {
  dynamicMulti: 'default-dynamic-multi',
  chat: 'default-chat',
  email: 'default-email',
  fireAssessment: 'default-fire-assessment',
  fireDrill: 'default-fire-drill',
  fireEmergency: 'default-fire-emergency',
  fireInspection: 'default-fire-inspection',
  fireMaintenance: 'default-fire-maintenance',
  fireTraining: 'default-fire-training',
  inApp: 'default-in-app',
  multiChannel: 'default-multi-channel',
  push: 'default-push',
  sms: 'default-sms',
} as const;

// Array of all workflow instances
export const workflows = [
  defaultDynamicMultiWorkflow,
  defaultChatWorkflow,
  defaultEmailWorkflow,
  defaultFireAssessmentWorkflow,
  defaultFireDrillWorkflow,
  defaultFireEmergencyWorkflow,
  defaultFireInspectionWorkflow,
  defaultFireMaintenanceWorkflow,
  defaultFireTrainingWorkflow,
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
