import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, controlSchema } from './schemas';

export const defaultfireassessmentMetadata = createWorkflowMetadata({
  workflow_key: 'default-fire-assessment',
  name: 'Fire Safety Assessment',
  description: 'Fire safety assessment workflow for risk assessments, compliance audits, safety evaluations, and performance reviews with results tracking.',
  workflow_type: 'STATIC',
  default_channels: ['EMAIL', 'IN_APP'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(controlSchema) as Record<string, any>,
});