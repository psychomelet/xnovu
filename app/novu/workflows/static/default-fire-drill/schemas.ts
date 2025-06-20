import { z } from 'zod'

export const payloadSchema = z.object({
  // Drill basic information
  drillType: z.enum(['scheduled', 'unannounced', 'mandatory', 'training']).describe('Type of fire drill'),
  drillName: z.string().describe('Name or title of the fire drill'),
  drillPurpose: z.string().describe('Purpose or objective of the drill'),
  
  // Scheduling information
  scheduledDate: z.string().describe('Scheduled date for the drill (ISO format)'),
  scheduledTime: z.string().describe('Scheduled time for the drill (HH:MM format)'),
  estimatedDuration: z.string().describe('Estimated duration (e.g., "30 minutes", "1 hour")'),
  
  // Location details
  buildingName: z.string().describe('Name of the building where drill will occur'),
  floorsCovered: z.array(z.string()).describe('List of floors participating (e.g., ["1F", "2F", "B1"])'),
  zonesCovered: z.array(z.string()).optional().describe('Specific zones or areas involved'),
  assemblyPoints: z.array(z.string()).describe('List of designated assembly points'),
  
  // Personnel information
  recipientRole: z.enum(['all_occupants', 'fire_wardens', 'department_heads', 'security_team', 'management', 'drill_coordinators']).describe('Target recipient role'),
  recipientName: z.string().optional().describe('Recipient name for personalization'),
  totalParticipants: z.number().optional().describe('Expected number of participants'),
  
  // Drill details
  drillInstructions: z.string().describe('Detailed drill instructions and procedures'),
  drillCoordinator: z.string().describe('Name of the drill coordinator'),
  coordinatorPhone: z.string().describe('Drill coordinator phone number'),
  coordinatorEmail: z.string().email().describe('Drill coordinator email'),
  
  // Safety and procedures
  specialInstructions: z.string().optional().describe('Any special instructions or considerations'),
  weatherBackupPlan: z.string().optional().describe('Backup plan in case of weather issues'),
  accessibilityNotes: z.string().optional().describe('Notes for participants with accessibility needs'),
  
  // Notification context
  notificationType: z.enum(['advance_notice', 'reminder', 'day_of', 'results', 'cancellation']).describe('Type of notification being sent'),
  advanceNoticeTime: z.string().optional().describe('How far in advance (e.g., "3 days", "1 week")'),
  
  // Results and follow-up (for results notifications)
  drillResults: z.object({
    completed: z.boolean(),
    completionTime: z.string().optional(),
    participantCount: z.number().optional(),
    evacuationTime: z.string().optional(),
    issuesIdentified: z.array(z.string()).optional(),
    overallRating: z.enum(['excellent', 'good', 'fair', 'needs_improvement']).optional(),
    recommendations: z.string().optional()
  }).optional().describe('Drill results data (for results notifications)'),
  
  // Additional context
  drillId: z.string().describe('Unique drill identifier'),
  previousDrillDate: z.string().optional().describe('Date of previous drill (ISO format)'),
  nextDrillDate: z.string().optional().describe('Tentative date of next drill (ISO format)'),
  regulatoryCompliance: z.string().optional().describe('Regulatory requirement being fulfilled'),
  
  // Documents and resources
  drillMapUrl: z.string().url().optional().describe('URL to drill evacuation map'),
  procedureDocumentUrl: z.string().url().optional().describe('URL to detailed procedure document'),
  feedbackFormUrl: z.string().url().optional().describe('URL to post-drill feedback form'),
  
  // Multi-language support
  language: z.enum(['en', 'zh']).default('en').describe('Notification language'),
  
  // Custom data for integration
  customData: z.record(z.any()).optional().describe('Additional custom data for integrations'),
})

export const controlSchema = z.object({
  // Channel configuration by notification type
  enableEmail: z.boolean().default(true).describe('Send email notification'),
  enableInApp: z.boolean().default(true).describe('Send in-app notification'),
  enableSMS: z.boolean().default(false).describe('Send SMS for drill reminders'),
  enablePush: z.boolean().default(true).describe('Send push notification'),
  enableChat: z.boolean().default(false).describe('Send to chat/Teams channels'),
  
  // Channel priority by notification type
  advanceNoticeChannels: z.array(z.enum(['email', 'inapp', 'push'])).default(['email', 'inapp']).describe('Channels for advance notices'),
  reminderChannels: z.array(z.enum(['email', 'inapp', 'sms', 'push'])).default(['email', 'sms', 'push']).describe('Channels for reminders'),
  dayOfChannels: z.array(z.enum(['email', 'inapp', 'sms', 'push', 'chat'])).default(['sms', 'push', 'inapp']).describe('Channels for day-of notifications'),
  resultsChannels: z.array(z.enum(['email', 'inapp'])).default(['email', 'inapp']).describe('Channels for results'),
  
  // Timing configuration
  reminderAdvanceHours: z.number().min(1).max(168).default(24).describe('Hours before drill to send reminder'),
  dayOfAdvanceMinutes: z.number().min(5).max(120).default(30).describe('Minutes before drill for final notice'),
  
  // Styling and branding
  brandColor: z.string().default('#FF6F00').describe('Brand color for drill notifications (orange theme)'),
  logoUrl: z.string().url().optional().describe('Organization logo URL'),
  organizationName: z.string().default('Building Management').describe('Organization name'),
  
  // Template configuration
  includeEvacuationMap: z.boolean().default(true).describe('Include evacuation map in notifications'),
  includeCoordinatorContact: z.boolean().default(true).describe('Include drill coordinator contact info'),
  includeFeedbackForm: z.boolean().default(false).describe('Include feedback form link (for results)'),
  includeComplianceInfo: z.boolean().default(true).describe('Include regulatory compliance information'),
  
  // Drill-specific settings
  requireParticipationConfirmation: z.boolean().default(false).describe('Require participants to confirm attendance'),
  confirmationUrl: z.string().url().optional().describe('URL for participation confirmation'),
  allowOptOut: z.boolean().default(false).describe('Allow participants to opt out'),
  optOutUrl: z.string().url().optional().describe('URL for opt-out requests'),
  
  // Follow-up configuration
  enableResultsNotification: z.boolean().default(true).describe('Send drill results to participants'),
  enableImprovementTracking: z.boolean().default(true).describe('Track improvements from previous drills'),
  
  // Accessibility and inclusion
  provideAccessibilityInfo: z.boolean().default(true).describe('Include accessibility information'),
  supportLanguages: z.array(z.enum(['en', 'zh'])).default(['en']).describe('Languages to support'),
  
  // Language and localization
  dateTimeFormat: z.string().default('YYYY-MM-DD HH:mm').describe('Date time display format'),
  timezone: z.string().default('Asia/Shanghai').describe('Timezone for time display'),
  
  // Template style
  templateStyle: z.enum(['formal', 'friendly', 'urgent']).default('formal').describe('Tone and style of notifications'),
  includeImages: z.boolean().default(true).describe('Include evacuation procedure images'),
})