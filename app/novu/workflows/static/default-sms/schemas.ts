import { z } from 'zod'

export const payloadSchema = z.object({
  message: z.string().max(160).describe('SMS message content (max 160 characters)'),
  recipientPhone: z.string().optional().describe('Override recipient phone number'),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  includeLink: z.boolean().optional().default(false).describe('Include a link in the message'),
  linkUrl: z.string().url().optional().describe('URL to include if includeLink is true'),
  customData: z.record(z.any()).optional().describe('Additional template variables'),
})

export const controlSchema = z.object({
  messagePrefix: z.string().optional().describe('Prefix to add before the message'),
  messageSuffix: z.string().optional().describe('Suffix to add after the message'),
  includeUnsubscribe: z.boolean().default(false).describe('Include unsubscribe instructions'),
  shortenUrls: z.boolean().default(true).describe('Automatically shorten URLs to save characters'),
  senderName: z.string().default('XNovu').describe('Sender identification'),
})