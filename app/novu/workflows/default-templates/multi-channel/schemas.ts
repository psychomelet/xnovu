import { z } from 'zod'

export const payloadSchema = z.object({
  // Common fields
  title: z.string().describe('Notification title'),
  message: z.string().describe('Main message content'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  category: z.string().optional().describe('Notification category'),
  
  // Channel-specific overrides
  emailSubject: z.string().optional().describe('Override subject for email'),
  emailMessage: z.string().optional().describe('Override message for email (HTML supported)'),
  smsMessage: z.string().max(160).optional().describe('Override message for SMS'),
  pushTitle: z.string().optional().describe('Override title for push'),
  pushMessage: z.string().optional().describe('Override message for push'),
  chatMessage: z.string().optional().describe('Override message for chat'),
  
  // URLs and media
  actionUrl: z.string().url().optional().describe('Primary action URL'),
  imageUrl: z.string().url().optional().describe('Image URL for rich notifications'),
  iconUrl: z.string().url().optional().describe('Icon URL for notifications'),
  
  // Recipients
  recipientName: z.string().optional().describe('Recipient name for personalization'),
  recipientPhone: z.string().optional().describe('Phone number for SMS'),
  recipientEmail: z.string().email().optional().describe('Email address override'),
  
  // Additional data
  customData: z.record(z.any()).optional().describe('Additional data for all channels'),
})

export const controlSchema = z.object({
  // Channel selection
  enableEmail: z.boolean().default(true).describe('Send via email'),
  enableInApp: z.boolean().default(true).describe('Send via in-app notification'),
  enableSms: z.boolean().default(false).describe('Send via SMS'),
  enablePush: z.boolean().default(true).describe('Send via push notification'),
  enableChat: z.boolean().default(false).describe('Send via chat'),
  
  // Channel priority and delays
  channelPriority: z.array(z.enum(['email', 'inApp', 'sms', 'push', 'chat']))
    .default(['inApp', 'push', 'email', 'sms', 'chat'])
    .describe('Order of channel execution'),
  delayBetweenChannels: z.number().default(0).describe('Delay in seconds between channels'),
  
  // Global settings
  companyName: z.string().default('XNovu').describe('Company name for branding'),
  primaryColor: z.string().default('#0066cc').describe('Primary brand color'),
  
  // Email settings
  emailTemplate: z.enum(['default', 'minimal', 'branded']).default('default'),
  
  // Push settings
  pushTtl: z.number().default(86400).describe('Push TTL in seconds'),
  
  // Chat settings
  chatPlatform: z.enum(['slack', 'teams', 'discord', 'webhook']).default('slack'),
  chatWebhookUrl: z.string().url().optional().describe('Chat webhook URL'),
  
  // Digest settings
  enableDigest: z.boolean().default(false).describe('Enable digest for batching'),
  digestKey: z.string().optional().describe('Key for grouping digest notifications'),
  digestWindow: z.number().default(300).describe('Digest window in seconds'),
})