import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, controlSchema } from './schemas';

export const defaultsmsMetadata = createWorkflowMetadata({
  workflow_key: 'default-sms',
  name: 'Default Sms',
  description: 'Default SMS template with character limit awareness and urgency support',
  workflow_type: 'STATIC',
  default_channels: ['SMS'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(controlSchema) as Record<string, any>,
  // Optional fields:
  // template_overrides: {},
  // typ_notification_category_id: 1,
  // business_id: 'business-123',
  // enterprise_id: 'enterprise-123',
});