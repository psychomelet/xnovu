/**
 * Auto-generated workflow metadata aggregator
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

import type { WorkflowMetadata } from './types/metadata';

// Import all metadata
import { defaultchatMetadata } from "./workflows/static/default-chat/metadata";
import { defaultemailMetadata } from "./workflows/static/default-email/metadata";
import { defaultfireassessmentMetadata } from "./workflows/static/default-fire-assessment/metadata";
import { defaultfiredrillMetadata } from "./workflows/static/default-fire-drill/metadata";
import { defaultfireemergencyMetadata } from "./workflows/static/default-fire-emergency/metadata";
import { defaultfireinspectionMetadata } from "./workflows/static/default-fire-inspection/metadata";
import { defaultfiremaintenanceMetadata } from "./workflows/static/default-fire-maintenance/metadata";
import { defaultfiretrainingMetadata } from "./workflows/static/default-fire-training/metadata";
import { defaultinappMetadata } from "./workflows/static/default-in-app/metadata";
import { defaultmultichannelMetadata } from "./workflows/static/default-multi-channel/metadata";
import { defaultpushMetadata } from "./workflows/static/default-push/metadata";
import { defaultsmsMetadata } from "./workflows/static/default-sms/metadata";

// Export all metadata as array
export const allWorkflowMetadata: WorkflowMetadata[] = [
  defaultchatMetadata,
  defaultemailMetadata,
  defaultfireassessmentMetadata,
  defaultfiredrillMetadata,
  defaultfireemergencyMetadata,
  defaultfireinspectionMetadata,
  defaultfiremaintenanceMetadata,
  defaultfiretrainingMetadata,
  defaultinappMetadata,
  defaultmultichannelMetadata,
  defaultpushMetadata,
  defaultsmsMetadata,
];

// Export metadata as map for easy lookup
export const workflowMetadataMap: Record<string, WorkflowMetadata> = {
  [defaultchatMetadata.workflow_key]: defaultchatMetadata,
  [defaultemailMetadata.workflow_key]: defaultemailMetadata,
  [defaultfireassessmentMetadata.workflow_key]: defaultfireassessmentMetadata,
  [defaultfiredrillMetadata.workflow_key]: defaultfiredrillMetadata,
  [defaultfireemergencyMetadata.workflow_key]: defaultfireemergencyMetadata,
  [defaultfireinspectionMetadata.workflow_key]: defaultfireinspectionMetadata,
  [defaultfiremaintenanceMetadata.workflow_key]: defaultfiremaintenanceMetadata,
  [defaultfiretrainingMetadata.workflow_key]: defaultfiretrainingMetadata,
  [defaultinappMetadata.workflow_key]: defaultinappMetadata,
  [defaultmultichannelMetadata.workflow_key]: defaultmultichannelMetadata,
  [defaultpushMetadata.workflow_key]: defaultpushMetadata,
  [defaultsmsMetadata.workflow_key]: defaultsmsMetadata,
};
