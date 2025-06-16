import { z } from 'zod'

export const payloadSchema = z.object({
  title: z.string().describe('Title of the notification'),
  message: z.string().describe('Main message content'),
  category: z.string().optional().describe('Notification category (e.g., info, warning, error)'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  actionUrl: z.string().url().optional().describe('URL to navigate when notification is clicked'),
  customData: z.record(z.any()).optional().describe('Additional custom data'),
})

export const controlSchema = z.object({
  showAvatar: z.boolean().default(true).describe('Display avatar in the notification'),
  avatarUrl: z.string().url().optional().describe('URL for the avatar image'),
  primaryActionLabel: z.string().optional().default('View Details').describe('Label for primary action button'),
  secondaryActionLabel: z.string().optional().describe('Label for secondary action button'),
  enableRedirect: z.boolean().default(true).describe('Enable click-through redirect'),
})