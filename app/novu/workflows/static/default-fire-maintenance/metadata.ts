import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, controlSchema } from './schemas';

export const defaultfiremaintenanceMetadata = createWorkflowMetadata({
  workflow_key: 'default-fire-maintenance',
  name: 'Fire Equipment Maintenance',
  description: 'Fire equipment maintenance workflow handling scheduled maintenance, fault alerts, emergency repairs, and completion tracking with technician coordination and parts management.',
  i18n: {
    zh: {
      name: '消防设备维护',
      description: '消防设备维护工作流，处理计划维护、故障警报、紧急维修和完成跟踪，配备技术员协调和零件管理。'
    }
  },
  workflow_type: 'STATIC',
  default_channels: ['EMAIL', 'IN_APP', 'SMS', 'PUSH'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(controlSchema) as Record<string, any>,
});