import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, controlSchema } from './schemas';

export const defaultfiretrainingMetadata = createWorkflowMetadata({
  workflow_key: 'default-fire-training',
  name: 'Fire Safety Training',
  description: 'Fire safety training workflow for announcements, enrollment, reminders, and completion certificates with instructor coordination and compliance tracking.',
  workflow_type: 'STATIC',
  default_channels: ['EMAIL', 'IN_APP', 'PUSH'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(controlSchema) as Record<string, any>,
});