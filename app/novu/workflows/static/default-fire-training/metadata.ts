import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, controlSchema } from './schemas';

export const defaultfiretrainingMetadata = createWorkflowMetadata({
  workflow_key: 'default-fire-training',
  name: 'Fire Safety Training',
  description: 'Fire safety training workflow for announcements, enrollment, reminders, and completion certificates with instructor coordination and compliance tracking.',
  i18n: {
    zh: {
      name: '消防安全培训',
      description: '消防安全培训工作流，用于公告、报名、提醒和完成证书，配备讲师协调和合规跟踪。'
    }
  },
  workflow_type: 'STATIC',
  default_channels: ['EMAIL', 'IN_APP', 'PUSH'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(controlSchema) as Record<string, any>,
});