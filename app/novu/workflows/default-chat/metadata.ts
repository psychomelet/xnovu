import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, controlSchema } from './schemas';

export const defaultchatMetadata = createWorkflowMetadata({
  workflow_key: 'default-chat',
  name: 'Default Chat',
  description: 'Default chat template supporting Slack, Teams, Discord, and generic webhooks',
  workflow_type: 'DYNAMIC',
  default_channels: ['CHAT'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(controlSchema) as Record<string, any>,
  // Optional fields:
  // template_overrides: {},
  // typ_notification_category_id: 1,
  // business_id: 'business-123',
  // enterprise_id: 'enterprise-123',
});