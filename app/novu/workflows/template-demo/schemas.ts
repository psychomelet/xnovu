import { z } from 'zod';

// Schema for template-aware workflow
export const templateDemoPayloadSchema = z.object({
  enterpriseId: z.string(),
  recipientId: z.string(),
  templateKey: z.string().optional(),
  buildingId: z.string(),
  buildingName: z.string(),
  alertType: z.enum(['MAINTENANCE', 'SECURITY', 'EMERGENCY', 'GENERAL']),
  alertMessage: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  scheduledFor: z.string().optional(),
  customData: z.record(z.any()).optional(),
});

export const templateDemoControlSchema = z.object({
  useCustomTemplate: z.boolean().default(false),
  customTemplateKey: z.string().optional(),
  fallbackSubject: z.string().default('Building Alert'),
  fallbackBody: z.string().default('You have received a building notification.'),
});