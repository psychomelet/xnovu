import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, emailControlSchema } from './schemas';

export const welcomeOnboardingEmailMetadata = createWorkflowMetadata({
  workflow_key: 'welcome-onboarding-email',
  name: 'Welcome Onboarding Email',
  description: 'Welcome email workflow for new user onboarding with customizable components',
  workflow_type: 'STATIC',
  default_channels: ['EMAIL', 'IN_APP'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(emailControlSchema) as Record<string, any>,
});