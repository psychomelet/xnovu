import { zodToJsonSchema } from 'zod-to-json-schema'
import { payloadSchema, controlSchema } from './schemas'
import type { Database } from '../../../../../lib/supabase/database.types'

type WorkflowMetadata = Omit<
  Database['notify']['Tables']['ent_notification_workflow']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'enterprise_id' | 'business_id' | 'repr'
>

export const metadata: WorkflowMetadata = {
  workflow_key: 'default-dynamic-multi',
  name: 'Dynamic Multi-Channel Workflow',
  description: 'Highly flexible dynamic workflow that allows complete configuration of channels, templates, and content through parameters. Supports database templates, inline content, variable templating, and channel-specific overrides.',
  workflow_type: 'DYNAMIC',
  default_channels: ['EMAIL', 'IN_APP', 'SMS', 'PUSH', 'CHAT'],
  payload_schema: zodToJsonSchema(payloadSchema, {
    name: 'DynamicMultiPayload',
    target: 'jsonSchema7'
  }) as any,
  control_schema: zodToJsonSchema(controlSchema, {
    name: 'DynamicMultiControls', 
    target: 'jsonSchema7'
  }) as any,
  template_overrides: {
    email: {
      description: 'Fully configurable email channel with template selection and inline content support',
      features: [
        'Database template integration',
        'Inline content support',
        'Variable templating with Liquid syntax',
        'Multiple template styles (default, minimal, branded)',
        'Header/footer customization',
        'Company branding integration'
      ]
    },
    inApp: {
      description: 'Configurable in-app notifications with rich content and actions',
      features: [
        'Custom avatar support',
        'Click-through redirects',
        'Rich data payload',
        'Variable templating',
        'Template override support'
      ]
    },
    sms: {
      description: 'SMS notifications with length management and templating',
      features: [
        'Automatic length truncation',
        'Company name inclusion',
        'Variable templating',
        'Phone number validation'
      ]
    },
    push: {
      description: 'Push notifications with platform-specific settings',
      features: [
        'Android TTL and priority settings',
        'Rich data payload',
        'Variable templating',
        'Custom notification icons'
      ]
    },
    chat: {
      description: 'Chat/webhook notifications with platform detection',
      features: [
        'Multi-platform support (Slack, Teams, Discord, webhook)',
        'Markdown formatting',
        'Custom webhook URLs',
        'Variable templating'
      ]
    }
  },
  publish_status: 'PUBLISH',
  deactivated: false
}

export default metadata