import { z } from 'zod'

const channelConfigSchema = z.object({
  enabled: z.boolean().default(false).describe('Whether this channel is enabled'),
  templateId: z.string().optional().describe('Database template ID to use'),
  customContent: z.object({
    subject: z.string().optional().describe('Custom subject line (for email/push)'),
    body: z.string().describe('Custom body content')
  }).optional().describe('Inline template content (alternative to templateId)'),
  variables: z.record(z.any()).optional().describe('Channel-specific template variables'),
  overrides: z.record(z.any()).optional().describe('Channel-specific overrides (styling, behavior, etc.)')
}).refine(data => !data.enabled || data.templateId || data.customContent, {
  message: "Either templateId or customContent must be provided when channel is enabled"
})

export const payloadSchema = z.object({
  channels: z.object({
    email: channelConfigSchema.optional().describe('Email channel configuration'),
    inApp: channelConfigSchema.optional().describe('In-app notification configuration'),
    sms: channelConfigSchema.optional().describe('SMS channel configuration'),
    push: channelConfigSchema.optional().describe('Push notification configuration'),
    chat: channelConfigSchema.optional().describe('Chat/webhook notification configuration')
  }).describe('Channel configurations - each channel can be independently configured'),
  
  globalVariables: z.record(z.any()).optional().describe('Variables shared across all enabled channels'),
  
  recipientConfig: z.object({
    recipientName: z.string().optional().describe('Recipient name for personalization'),
    recipientPhone: z.string().optional().describe('Phone number for SMS channel'),
    recipientEmail: z.string().email().optional().describe('Email address override'),
    customData: z.record(z.any()).optional().describe('Additional recipient-specific data')
  }).optional().describe('Recipient-specific configuration'),
  
  notificationId: z.union([z.string(), z.number()]).optional().describe('Notification ID for status tracking')
})

export const controlSchema = z.object({
  companyName: z.string().default('XNovu').describe('Company name for branding'),
  primaryColor: z.string().default('#0066cc').describe('Primary brand color'),
  
  emailSettings: z.object({
    templateStyle: z.enum(['default', 'minimal', 'branded']).default('default').describe('Email template style'),
    showHeader: z.boolean().default(true).describe('Show header in email'),
    showFooter: z.boolean().default(true).describe('Show footer in email'),
    headerLogoUrl: z.string().url().optional().describe('Header logo URL'),
    unsubscribeUrl: z.string().url().optional().describe('Unsubscribe URL')
  }).optional().describe('Email-specific control settings'),
  
  inAppSettings: z.object({
    showAvatar: z.boolean().default(true).describe('Show avatar in in-app notification'),
    avatarUrl: z.string().url().optional().describe('Avatar image URL'),
    enableRedirect: z.boolean().default(true).describe('Enable click-through redirect')
  }).optional().describe('In-app notification control settings'),
  
  pushSettings: z.object({
    ttl: z.number().default(3600).describe('Time to live in seconds'),
    priority: z.enum(['normal', 'high']).default('normal').describe('Push notification priority')
  }).optional().describe('Push notification control settings'),
  
  smsSettings: z.object({
    maxLength: z.number().default(160).describe('Maximum SMS length'),
    includeCompanyName: z.boolean().default(true).describe('Include company name in SMS')
  }).optional().describe('SMS control settings'),
  
  chatSettings: z.object({
    platform: z.enum(['slack', 'teams', 'discord', 'webhook']).default('slack').describe('Chat platform type'),
    webhookUrl: z.string().url().optional().describe('Webhook URL for chat notifications'),
    enableMarkdown: z.boolean().default(true).describe('Enable markdown formatting in chat')
  }).optional().describe('Chat notification control settings'),
  
  debugging: z.object({
    logTemplateRendering: z.boolean().default(false).describe('Log template rendering process'),
    validateVariables: z.boolean().default(true).describe('Validate template variables')
  }).optional().describe('Debugging and development settings')
})