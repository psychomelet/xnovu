import { z } from 'zod'

export const payloadSchema = z.object({
  assessmentType: z.enum(['risk_assessment', 'compliance_audit', 'safety_evaluation', 'vulnerability_analysis', 'performance_review']).describe('Type of fire safety assessment'),
  assessmentTitle: z.string().describe('Title of the assessment'),
  assessmentDescription: z.string().describe('Detailed description of assessment scope'),
  
  // Scheduling information
  scheduledDate: z.string().describe('Scheduled date for assessment (ISO format)'),
  scheduledTime: z.string().describe('Scheduled time for assessment (HH:MM format)'),
  estimatedDuration: z.string().describe('Estimated duration (e.g., "1 week", "3 days")'),
  deadlineDate: z.string().optional().describe('Assessment completion deadline (ISO format)'),
  
  // Location details
  buildingName: z.string().describe('Building being assessed'),
  areasToAssess: z.array(z.string()).describe('Areas or systems to be assessed'),
  
  // Personnel information
  recipientRole: z.enum(['assessor', 'building_manager', 'compliance_officer', 'fire_safety_manager', 'executive_team']).describe('Target recipient role'),
  recipientName: z.string().optional().describe('Recipient name for personalization'),
  
  // Assessor details
  assessorName: z.string().describe('Name of lead assessor'),
  assessorPhone: z.string().describe('Assessor phone number'),
  assessorEmail: z.string().email().describe('Assessor email address'),
  assessorOrganization: z.string().describe('Assessor organization'),
  
  // Assessment details
  assessmentCriteria: z.array(z.string()).describe('Assessment criteria and standards'),
  requiredDocuments: z.array(z.string()).optional().describe('Documents required for assessment'),
  
  // Notification context
  notificationType: z.enum(['assignment', 'reminder', 'completion', 'results', 'follow_up_required']).describe('Type of notification'),
  
  // Assessment results
  assessmentResults: z.object({
    completedDate: z.string(),
    overallScore: z.number().optional(),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    complianceStatus: z.enum(['compliant', 'non_compliant', 'partially_compliant']).optional(),
    criticalFindings: z.array(z.string()).optional(),
    recommendationsCount: z.number().optional(),
    followUpRequired: z.boolean().optional(),
    followUpDeadline: z.string().optional()
  }).optional().describe('Assessment results (for completion/results notifications)'),
  
  // Compliance and regulatory
  regulatoryFramework: z.string().optional().describe('Regulatory framework being assessed against'),
  complianceDeadline: z.string().optional().describe('Regulatory compliance deadline'),
  
  // Additional context
  assessmentId: z.string().describe('Unique assessment identifier'),
  previousAssessmentDate: z.string().optional().describe('Date of previous assessment'),
  nextAssessmentDue: z.string().optional().describe('Due date for next assessment'),
  
  // Documents and resources
  assessmentPlanUrl: z.string().url().optional().describe('URL to assessment plan'),
  reportTemplateUrl: z.string().url().optional().describe('URL to assessment report template'),
  
  // Multi-language support
  language: z.enum(['en', 'zh']).default('en').describe('Notification language'),
  
  // Custom data
  customData: z.record(z.any()).optional().describe('Additional custom data'),
})

export const controlSchema = z.object({
  // Channel configuration
  enableEmail: z.boolean().default(true).describe('Send email notification'),
  enableInApp: z.boolean().default(true).describe('Send in-app notification'),
  
  // Styling and branding
  brandColor: z.string().default('#4CAF50').describe('Brand color for assessment notifications (green theme)'),
  logoUrl: z.string().url().optional().describe('Organization logo URL'),
  organizationName: z.string().default('Fire Safety Assessment').describe('Organization name'),
  
  // Template configuration
  includeAssessorContact: z.boolean().default(true).describe('Include assessor contact information'),
  includeCriteria: z.boolean().default(true).describe('Include assessment criteria'),
  includeComplianceInfo: z.boolean().default(true).describe('Include compliance information'),
  
  // Language and localization
  dateTimeFormat: z.string().default('YYYY-MM-DD HH:mm').describe('Date time display format'),
  timezone: z.string().default('Asia/Shanghai').describe('Timezone for time display'),
})