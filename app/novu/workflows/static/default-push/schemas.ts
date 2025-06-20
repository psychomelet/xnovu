import { z } from 'zod'

export const payloadSchema = z.object({
  title: z.string().describe('Push notification title'),
  message: z.string().describe('Push notification body content'),
  imageUrl: z.string().url().optional().describe('URL for notification image'),
  iconUrl: z.string().url().optional().describe('URL for notification icon'),
  actionUrl: z.string().url().optional().describe('URL to open when notification is clicked'),
  badge: z.number().optional().describe('Badge count for app icon'),
  sound: z.string().optional().describe('Custom sound file name'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  category: z.string().optional().describe('Notification category for grouping'),
  customData: z.record(z.any()).optional().describe('Additional data payload'),
})

export const controlSchema = z.object({
  enableVibration: z.boolean().default(true).describe('Enable vibration for the notification'),
  ttl: z.number().default(86400).describe('Time to live in seconds (default 24 hours)'),
  requireInteraction: z.boolean().default(false).describe('Require user interaction to dismiss'),
  silent: z.boolean().default(false).describe('Deliver notification silently'),
  tag: z.string().optional().describe('Tag for replacing existing notifications'),
  defaultIcon: z.string().url().optional().describe('Default icon URL if not provided in payload'),
  clickAction: z.enum(['open_app', 'open_url', 'custom']).default('open_app').describe('Action when notification is clicked'),
})