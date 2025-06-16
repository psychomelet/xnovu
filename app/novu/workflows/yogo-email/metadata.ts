import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { yogoEmailPayloadSchema, yogoEmailControlSchema } from './schemas';

export const yogoEmailMetadata = createWorkflowMetadata({
  workflow_key: 'yogo-email',
  name: 'Yogo Email',
  description: 'Email notification workflow for Yogo platform with in-app support',
  workflow_type: 'STATIC',
  default_channels: ['EMAIL', 'IN_APP'],
  payload_schema: zodToJsonSchema(yogoEmailPayloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(yogoEmailControlSchema) as Record<string, any>,
});