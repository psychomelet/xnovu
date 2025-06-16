import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { templateDemoPayloadSchema, templateDemoControlSchema } from './schemas';

export const templateDemoMetadata = createWorkflowMetadata({
  workflow_key: 'template-demo-workflow',
  name: 'Template Demo Workflow',
  description: 'Demonstrates template rendering with xnovu_render syntax for building alerts',
  workflow_type: 'DYNAMIC',
  default_channels: ['EMAIL', 'IN_APP', 'SMS'],
  payload_schema: zodToJsonSchema(templateDemoPayloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(templateDemoControlSchema) as Record<string, any>,
});