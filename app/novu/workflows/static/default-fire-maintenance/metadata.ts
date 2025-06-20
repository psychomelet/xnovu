import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, controlSchema } from './schemas';

export const defaultfiremaintenanceMetadata = createWorkflowMetadata({
  workflow_key: 'default-fire-maintenance',
  name: 'Fire Equipment Maintenance',
  description: 'Fire equipment maintenance workflow handling scheduled maintenance, fault alerts, emergency repairs, and completion tracking with technician coordination and parts management.',
  workflow_type: 'STATIC',
  default_channels: ['EMAIL', 'IN_APP', 'SMS', 'PUSH'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(controlSchema) as Record<string, any>,
});