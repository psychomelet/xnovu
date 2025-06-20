import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
import { payloadSchema, controlSchema } from './schemas';

export const defaultfireemergencyMetadata = createWorkflowMetadata({
  workflow_key: 'default-fire-emergency',
  name: 'Fire Emergency Alert',
  description: 'Critical fire emergency alert workflow with multi-channel notifications for immediate response. Handles fire alarms, smoke detection, gas leaks, explosions, and evacuation orders with professional templates and building-specific context.',
  i18n: {
    zh: {
      name: '消防紧急警报',
      description: '危急消防紧急警报工作流，提供多渠道通知以便立即响应。处理火灾警报、烟雾检测、气体泄漏、爆炸和疏散命令，配备专业模板和建筑特定上下文。'
    }
  },
  workflow_type: 'STATIC',
  default_channels: ['SMS', 'PUSH', 'EMAIL', 'IN_APP', 'CHAT'],
  payload_schema: zodToJsonSchema(payloadSchema) as Record<string, any>,
  control_schema: zodToJsonSchema(controlSchema) as Record<string, any>,
  template_overrides: {
    sms: {
      body: 'Emergency alert with location and evacuation instructions (160 char limit)'
    },
    push: {
      title: 'Fire emergency with building and severity info',
      body: 'Location, evacuation point, and emergency contact'
    },
    email: {
      subject: 'Professional fire emergency alert with full details',
      body: 'Comprehensive emergency information with evacuation procedures, safety reminders, building maps, and emergency contacts'
    },
    inApp: {
      title: 'Persistent emergency dashboard alert',
      body: 'Key emergency details with tracking information'
    },
    chat: {
      body: 'Team coordination message with all critical details and links'
    }
  },
  // Optional metadata for categorization
  // typ_notification_category_id: 1, // Fire Safety category
  // business_id: 'fire-safety-system',
  // enterprise_id: 'building-management',
});