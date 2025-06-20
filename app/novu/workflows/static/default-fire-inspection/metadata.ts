import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, controlSchema } from './schemas';

export const defaultfireinspectionMetadata = createWorkflowMetadata({
  workflow_key: 'default-fire-inspection',
  name: 'Fire Inspection Management',
  description: 'Comprehensive fire inspection workflow handling assignments, reminders, overdue notices, completion notifications, and results. Supports routine, compliance, follow-up, emergency, annual, quarterly, and monthly inspections with professional templates, compliance tracking, and multi-language support.',
  i18n: {
    zh: {
      name: '消防检查管理',
      description: '全面的消防检查工作流，处理分配、提醒、逾期通知、完成通知和结果。支持例行、合规、跟进、紧急、年度、季度和月度检查，配备专业模板、合规跟踪和多语言支持。'
    }
  },
  workflow_type: 'STATIC',
  default_channels: ['EMAIL', 'IN_APP', 'SMS', 'PUSH', 'CHAT'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(controlSchema) as Record<string, any>,
  template_overrides: {
    sms: {
      body: 'Fire inspection alert/reminder with building, date, and inspector contact (160 char limit)'
    },
    push: {
      title: 'Fire inspection notification with type and building info',
      body: 'Date, time, inspector details, and inspection areas'
    },
    email: {
      subject: 'Professional fire inspection notification with complete details',
      body: 'Comprehensive inspection information including purpose, checklist, preparation tasks, inspector contacts, compliance info, results (if applicable), and action buttons'
    },
    inApp: {
      title: 'Fire inspection dashboard notification',
      body: 'Key inspection details with date, time, duration, and areas to inspect'
    },
    chat: {
      body: 'Team coordination message with all inspection details, checklists, and contact information'
    }
  },
  // Optional metadata for categorization
  // typ_notification_category_id: 3, // Fire Inspection category
  // business_id: 'fire-inspection-system',
  // enterprise_id: 'building-management',
});