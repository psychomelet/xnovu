/**
 * Auto-generated workflow metadata aggregator
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

import type { WorkflowMetadata } from './types/metadata';

// Import all metadata
import { defaultchatMetadata } from "./workflows/default-chat/metadata";
import { defaultemailMetadata } from "./workflows/default-email/metadata";
import { defaultinappMetadata } from "./workflows/default-in-app/metadata";
import { defaultmultichannelMetadata } from "./workflows/default-multi-channel/metadata";
import { defaultpushMetadata } from "./workflows/default-push/metadata";
import { defaultsmsMetadata } from "./workflows/default-sms/metadata";
import { templateDemoMetadata } from "./workflows/template-demo/metadata";
import { welcomeOnboardingEmailMetadata } from "./workflows/welcome-onboarding-email/metadata";
import { yogoEmailMetadata } from "./workflows/yogo-email/metadata";

// Export all metadata as array
export const allWorkflowMetadata: WorkflowMetadata[] = [
  defaultchatMetadata,
  defaultemailMetadata,
  defaultinappMetadata,
  defaultmultichannelMetadata,
  defaultpushMetadata,
  defaultsmsMetadata,
  templateDemoMetadata,
  welcomeOnboardingEmailMetadata,
  yogoEmailMetadata,
];

// Export metadata as map for easy lookup
export const workflowMetadataMap: Record<string, WorkflowMetadata> = {
  [defaultchatMetadata.workflow_key]: defaultchatMetadata,
  [defaultemailMetadata.workflow_key]: defaultemailMetadata,
  [defaultinappMetadata.workflow_key]: defaultinappMetadata,
  [defaultmultichannelMetadata.workflow_key]: defaultmultichannelMetadata,
  [defaultpushMetadata.workflow_key]: defaultpushMetadata,
  [defaultsmsMetadata.workflow_key]: defaultsmsMetadata,
  [templateDemoMetadata.workflow_key]: templateDemoMetadata,
  [welcomeOnboardingEmailMetadata.workflow_key]: welcomeOnboardingEmailMetadata,
  [yogoEmailMetadata.workflow_key]: yogoEmailMetadata,
};
