import { z } from 'zod'

export const payloadSchema = z.object({
  subject: z.string().describe('Email subject line'),
  recipientName: z.string().optional().describe('Recipient name for personalization'),
  title: z.string().describe('Main title in email body'),
  message: z.string().describe('Main message content'),
  ctaText: z.string().optional().describe('Call-to-action button text'),
  ctaUrl: z.string().url().optional().describe('Call-to-action button URL'),
  footer: z.string().optional().describe('Footer text'),
  customData: z.record(z.any()).optional().describe('Additional template variables'),
})

export const controlSchema = z.object({
  templateStyle: z.enum(['default', 'minimal', 'branded']).default('default').describe('Email template style'),
  showHeader: z.boolean().default(true).describe('Show header with logo'),
  showFooter: z.boolean().default(true).describe('Show footer with unsubscribe link'),
  primaryColor: z.string().default('#0066cc').describe('Primary color for buttons and links'),
  headerLogoUrl: z.string().url().optional().describe('URL for header logo'),
  companyName: z.string().default('XNovu').describe('Company name for footer'),
  unsubscribeUrl: z.string().url().optional().describe('Custom unsubscribe URL'),
})