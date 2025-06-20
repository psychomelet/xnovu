import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, controlSchema } from './schemas';

export const defaultfiredrillMetadata = createWorkflowMetadata({
  workflow_key: 'default-fire-drill',
  name: 'Fire Drill Notification',
  description: 'Comprehensive fire drill notification workflow handling scheduled drills, reminders, day-of notifications, and results. Supports advance notices, reminders, same-day alerts, result reporting, and cancellations with professional templates and building-specific context.',
  i18n: {
    zh: {
      name: '消防演练通知',
      description: '全面的消防演练通知工作流，处理计划演练、提醒、当日通知和结果。支持提前通知、提醒、当日警报、结果报告和取消，配备专业模板和建筑特定上下文。'
    }
  },
  workflow_type: 'STATIC',
  default_channels: ['EMAIL', 'IN_APP', 'SMS', 'PUSH', 'CHAT'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(controlSchema) as Record<string, any>,
  template_overrides: {
    sms: {
      body: 'Fire drill reminder/alert with building, time, and assembly point (160 char limit)'
    },
    push: {
      title: 'Fire drill notification with type and building info',
      body: 'Date, time, participation requirements, and location details'
    },
    email: {
      subject: 'Professional fire drill notification with complete details',
      body: 'Comprehensive drill information including instructions, safety guidelines, coordinator contacts, evacuation maps, compliance info, and results (if applicable)'
    },
    inApp: {
      title: 'Fire drill dashboard notification',
      body: 'Key drill details with date, time, duration, and participation status'
    },
    chat: {
      body: 'Team coordination message with all drill details, maps, and contact information'
    }
  },
  // Optional metadata for categorization
  // typ_notification_category_id: 2, // Fire Drill category
  // business_id: 'fire-drill-system',
  // enterprise_id: 'building-management',
});