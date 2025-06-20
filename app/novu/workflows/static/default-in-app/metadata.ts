import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, controlSchema } from './schemas';

export const defaultinappMetadata = createWorkflowMetadata({
  workflow_key: 'default-in-app',
  name: 'Default In App',
  description: 'Default in-app notification template with configurable options',
  workflow_type: 'STATIC',
  default_channels: ['IN_APP'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(controlSchema) as Record<string, any>,
  // Optional fields:
  // template_overrides: {},
  // typ_notification_category_id: 1,
  // business_id: 'business-123',
  // enterprise_id: 'enterprise-123',
});