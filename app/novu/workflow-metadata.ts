/**
 * Auto-generated workflow metadata aggregator
 * Generated at: 2025-06-16T06:10:00.845Z
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

import type { WorkflowMetadata } from './types/metadata';

// Import all metadata
import { templateDemoMetadata } from "./workflows/template-demo/metadata";
import { welcomeOnboardingEmailMetadata } from "./workflows/welcome-onboarding-email/metadata";
import { yogoEmailMetadata } from "./workflows/yogo-email/metadata";

// Export all metadata as array
export const allWorkflowMetadata: WorkflowMetadata[] = [
  templateDemoMetadata,
  welcomeOnboardingEmailMetadata,
  yogoEmailMetadata,
];

// Export metadata as map for easy lookup
export const workflowMetadataMap: Record<string, WorkflowMetadata> = {
  [templateDemoMetadata.workflow_key]: templateDemoMetadata,
  [welcomeOnboardingEmailMetadata.workflow_key]: welcomeOnboardingEmailMetadata,
  [yogoEmailMetadata.workflow_key]: yogoEmailMetadata,
};
