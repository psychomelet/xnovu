import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, controlSchema } from './schemas';

export const defaultfireassessmentMetadata = createWorkflowMetadata({
  workflow_key: 'default-fire-assessment',
  name: 'Fire Safety Assessment',
  description: 'Fire safety assessment workflow for risk assessments, compliance audits, safety evaluations, and performance reviews with results tracking.',
  i18n: {
    zh: {
      name: '消防安全评估',
      description: '消防安全评估工作流，用于风险评估、合规审计、安全评价和绩效审查，配备结果跟踪。'
    }
  },
  workflow_type: 'STATIC',
  default_channels: ['EMAIL', 'IN_APP'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(controlSchema) as Record<string, any>,
});