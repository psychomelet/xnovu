import { z } from 'zod'

export const payloadSchema = z.object({
  // Inspection basic information
  inspectionType: z.enum(['routine', 'compliance', 'follow_up', 'emergency', 'annual', 'quarterly', 'monthly']).describe('Type of fire inspection'),
  inspectionTitle: z.string().describe('Title or name of the inspection'),
  inspectionPurpose: z.string().describe('Purpose and objectives of the inspection'),
  
  // Scheduling information
  scheduledDate: z.string().describe('Scheduled date for the inspection (ISO format)'),
  scheduledTime: z.string().describe('Scheduled time for the inspection (HH:MM format)'),
  estimatedDuration: z.string().describe('Estimated duration (e.g., "2 hours", "Half day")'),
  deadlineDate: z.string().optional().describe('Deadline for completion (ISO format)'),
  
  // Location details
  buildingName: z.string().describe('Name of the building to be inspected'),
  floorsToInspect: z.array(z.string()).describe('List of floors to inspect (e.g., ["1F", "2F", "B1"])'),
  zonesToInspect: z.array(z.string()).optional().describe('Specific zones or areas to inspect'),
  inspectionAreas: z.array(z.string()).describe('Specific areas or systems to inspect'),
  
  // Personnel information
  recipientRole: z.enum(['inspector', 'building_manager', 'maintenance_team', 'fire_warden', 'compliance_officer', 'facility_staff']).describe('Target recipient role'),
  recipientName: z.string().optional().describe('Recipient name for personalization'),
  
  // Inspector details
  inspectorName: z.string().describe('Name of the assigned inspector'),
  inspectorPhone: z.string().describe('Inspector phone number'),
  inspectorEmail: z.string().email().describe('Inspector email address'),
  inspectorOrganization: z.string().describe('Inspector organization (internal/external)'),
  inspectorCertification: z.string().optional().describe('Inspector certification details'),
  
  // Inspection details
  checklistItems: z.array(z.string()).describe('List of items to be inspected'),
  requiredDocuments: z.array(z.string()).optional().describe('Documents required for inspection'),
  preparationTasks: z.array(z.string()).optional().describe('Tasks to complete before inspection'),
  accessRequirements: z.string().optional().describe('Special access or permission requirements'),
  
  // Notification context
  notificationType: z.enum(['assignment', 'reminder', 'overdue', 'completion', 'results', 'follow_up_required']).describe('Type of notification being sent'),
  reminderAdvanceTime: z.string().optional().describe('How far in advance for reminder (e.g., "2 days", "1 week")'),
  
  // Results and findings (for completion/results notifications)
  inspectionResults: z.object({
    completed: z.boolean(),
    completionDate: z.string().optional(),
    overallStatus: z.enum(['passed', 'passed_with_notes', 'failed', 'pending_review']).optional(),
    criticalIssues: z.array(z.string()).optional(),
    minorIssues: z.array(z.string()).optional(),
    recommendationsCount: z.number().optional(),
    followUpRequired: z.boolean().optional(),
    followUpDeadline: z.string().optional(),
    complianceStatus: z.enum(['compliant', 'non_compliant', 'partially_compliant']).optional(),
    certificateIssued: z.boolean().optional()
  }).optional().describe('Inspection results data (for completion/results notifications)'),
  
  // Compliance and regulatory
  regulatoryStandard: z.string().optional().describe('Regulatory standard being assessed'),
  complianceDeadline: z.string().optional().describe('Regulatory compliance deadline (ISO format)'),
  certificateType: z.string().optional().describe('Type of certificate/approval required'),
  
  // Additional context
  inspectionId: z.string().describe('Unique inspection identifier'),
  previousInspectionDate: z.string().optional().describe('Date of previous inspection (ISO format)'),
  nextInspectionDue: z.string().optional().describe('Due date for next inspection (ISO format)'),
  parentInspectionId: z.string().optional().describe('Parent inspection ID for follow-ups'),
  
  // Documents and resources
  checklistUrl: z.string().url().optional().describe('URL to inspection checklist'),
  procedureDocumentUrl: z.string().url().optional().describe('URL to inspection procedures'),
  reportTemplateUrl: z.string().url().optional().describe('URL to inspection report template'),
  buildingPlansUrl: z.string().url().optional().describe('URL to building plans/layouts'),
  
  // Multi-language support
  language: z.enum(['en', 'zh']).default('en').describe('Notification language'),
  
  // Custom data for integration
  customData: z.record(z.any()).optional().describe('Additional custom data for integrations'),
})

export const controlSchema = z.object({
  // Channel configuration by notification type
  enableEmail: z.boolean().default(true).describe('Send email notification'),
  enableInApp: z.boolean().default(true).describe('Send in-app notification'),
  enableSMS: z.boolean().default(false).describe('Send SMS for urgent notifications'),
  enablePush: z.boolean().default(true).describe('Send push notification'),
  enableChat: z.boolean().default(false).describe('Send to chat/Teams channels'),
  
  // Channel priority by notification type
  assignmentChannels: z.array(z.enum(['email', 'inapp', 'push'])).default(['email', 'inapp']).describe('Channels for assignments'),
  reminderChannels: z.array(z.enum(['email', 'inapp', 'sms', 'push'])).default(['email', 'push']).describe('Channels for reminders'),
  overdueChannels: z.array(z.enum(['email', 'inapp', 'sms', 'push'])).default(['email', 'sms', 'push']).describe('Channels for overdue notices'),
  completionChannels: z.array(z.enum(['email', 'inapp'])).default(['email', 'inapp']).describe('Channels for completion notifications'),
  resultsChannels: z.array(z.enum(['email', 'inapp'])).default(['email', 'inapp']).describe('Channels for results'),
  
  // Urgency and priority settings
  overdueUrgencyLevel: z.enum(['medium', 'high', 'critical']).default('high').describe('Urgency level for overdue notifications'),
  criticalIssueUrgency: z.enum(['high', 'critical']).default('critical').describe('Urgency when critical issues found'),
  
  // Styling and branding
  brandColor: z.string().default('#2E7D32').describe('Brand color for inspection notifications (green theme)'),
  logoUrl: z.string().url().optional().describe('Organization logo URL'),
  organizationName: z.string().default('Fire Safety Department').describe('Organization name'),
  
  // Template configuration
  includeChecklist: z.boolean().default(true).describe('Include inspection checklist in notifications'),
  includeInspectorContact: z.boolean().default(true).describe('Include inspector contact information'),
  includeBuildingPlans: z.boolean().default(false).describe('Include building plans reference'),
  includeComplianceInfo: z.boolean().default(true).describe('Include regulatory compliance information'),
  includePreparationTasks: z.boolean().default(true).describe('Include preparation tasks for inspections'),
  
  // Inspection workflow settings
  requirePreInspectionConfirmation: z.boolean().default(false).describe('Require confirmation before inspection'),
  confirmationUrl: z.string().url().optional().describe('URL for inspection confirmation'),
  enableRescheduling: z.boolean().default(true).describe('Allow inspection rescheduling'),
  rescheduleUrl: z.string().url().optional().describe('URL for rescheduling requests'),
  
  // Results and follow-up configuration
  autoGenerateReport: z.boolean().default(true).describe('Automatically generate inspection report'),
  reportGenerationUrl: z.string().url().optional().describe('URL for report generation system'),
  enableFollowUpTracking: z.boolean().default(true).describe('Track follow-up actions'),
  followUpReminderDays: z.number().min(1).max(30).default(7).describe('Days before follow-up reminder'),
  
  // Compliance and certification
  trackComplianceStatus: z.boolean().default(true).describe('Track compliance status'),
  certificateGenerationEnabled: z.boolean().default(false).describe('Enable certificate generation'),
  certificateTemplateUrl: z.string().url().optional().describe('URL to certificate template'),
  
  // Access and security
  requireSecurityClearance: z.boolean().default(false).describe('Inspection requires security clearance'),
  accessInstructions: z.string().optional().describe('Special access instructions'),
  
  // Language and localization
  dateTimeFormat: z.string().default('YYYY-MM-DD HH:mm').describe('Date time display format'),
  timezone: z.string().default('Asia/Shanghai').describe('Timezone for time display'),
  
  // Template style and tone
  templateTone: z.enum(['formal', 'professional', 'collaborative']).default('professional').describe('Tone of notifications'),
  includeImages: z.boolean().default(true).describe('Include inspection procedure images'),
  detailLevel: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed').describe('Level of detail in notifications'),
})