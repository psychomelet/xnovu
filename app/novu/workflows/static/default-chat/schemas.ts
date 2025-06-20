import { z } from 'zod'

export const payloadSchema = z.object({
  message: z.string().describe('Main message content'),
  title: z.string().optional().describe('Message title or header'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  channel: z.string().optional().describe('Specific channel or room to post to'),
  webhookUrl: z.string().url().optional().describe('Override webhook URL for specific integrations'),
  attachments: z.array(z.object({
    title: z.string().optional(),
    text: z.string().optional(),
    imageUrl: z.string().url().optional(),
    color: z.string().optional(),
    fields: z.array(z.object({
      title: z.string(),
      value: z.string(),
      short: z.boolean().optional()
    })).optional()
  })).optional().describe('Rich message attachments'),
  mentions: z.array(z.string()).optional().describe('User IDs or names to mention'),
  customData: z.record(z.any()).optional().describe('Platform-specific data'),
})

export const controlSchema = z.object({
  platform: z.enum(['slack', 'teams', 'discord', 'webhook']).default('slack').describe('Chat platform to use'),
  formatStyle: z.enum(['plain', 'markdown', 'rich']).default('markdown').describe('Message formatting style'),
  showTimestamp: z.boolean().default(true).describe('Include timestamp in message'),
  threadId: z.string().optional().describe('Thread or conversation ID to reply to'),
  iconEmoji: z.string().optional().default(':bell:').describe('Icon emoji for the message'),
  botName: z.string().default('XNovu Bot').describe('Name of the bot sending the message'),
  botAvatar: z.string().url().optional().describe('Avatar URL for the bot'),
})