import { z } from 'zod'

export const payloadSchema = z.object({
  trainingType: z.enum(['fire_safety_basics', 'evacuation_procedures', 'fire_warden_training', 'equipment_operation', 'emergency_response', 'compliance_training']).describe('Type of fire safety training'),
  trainingTitle: z.string().describe('Title of the training session'),
  trainingDescription: z.string().describe('Detailed description of training content'),
  
  // Scheduling information
  scheduledDate: z.string().describe('Scheduled date for training (ISO format)'),
  scheduledTime: z.string().describe('Scheduled time for training (HH:MM format)'),
  duration: z.string().describe('Training duration (e.g., "2 hours", "Half day")'),
  
  // Location details
  buildingName: z.string().describe('Training venue building'),
  roomNumber: z.string().optional().describe('Room number or area'),
  locationDescription: z.string().describe('Detailed location description'),
  
  // Personnel information
  recipientRole: z.enum(['all_staff', 'fire_wardens', 'new_employees', 'department_heads', 'security_team', 'maintenance_staff']).describe('Target recipient role'),
  recipientName: z.string().optional().describe('Recipient name for personalization'),
  
  // Instructor details
  instructorName: z.string().describe('Name of training instructor'),
  instructorPhone: z.string().describe('Instructor phone number'),
  instructorEmail: z.string().email().describe('Instructor email address'),
  instructorOrganization: z.string().describe('Instructor organization'),
  
  // Training details
  trainingObjectives: z.array(z.string()).describe('Learning objectives'),
  requiredMaterials: z.array(z.string()).optional().describe('Materials participants should bring'),
  prerequisites: z.string().optional().describe('Prerequisites for attending'),
  maxParticipants: z.number().optional().describe('Maximum number of participants'),
  
  // Notification context
  notificationType: z.enum(['announcement', 'reminder', 'enrollment_open', 'enrollment_closing', 'completion', 'certificate_ready']).describe('Type of notification'),
  
  // Training completion information
  completionDetails: z.object({
    completedDate: z.string(),
    participantCount: z.number(),
    passRate: z.number().optional(),
    certificatesIssued: z.number().optional(),
    feedback: z.string().optional(),
    nextTrainingDate: z.string().optional()
  }).optional().describe('Training completion details'),
  
  // Compliance and certification
  certificationType: z.string().optional().describe('Type of certificate issued'),
  validityPeriod: z.string().optional().describe('Certificate validity period'),
  complianceRequirement: z.string().optional().describe('Regulatory compliance requirement'),
  
  // Additional context
  trainingId: z.string().describe('Unique training session identifier'),
  courseCode: z.string().optional().describe('Training course code'),
  
  // Documents and resources
  trainingMaterialsUrl: z.string().url().optional().describe('URL to training materials'),
  enrollmentUrl: z.string().url().optional().describe('URL for enrollment'),
  certificateUrl: z.string().url().optional().describe('URL to download certificate'),
  
  // Multi-language support
  language: z.enum(['en', 'zh']).default('en').describe('Notification language'),
  
  // Custom data for integration
  customData: z.record(z.any()).optional().describe('Additional custom data for integrations'),
})

export const controlSchema = z.object({
  // Channel configuration
  enableEmail: z.boolean().default(true).describe('Send email notification'),
  enableInApp: z.boolean().default(true).describe('Send in-app notification'),
  enableSMS: z.boolean().default(false).describe('Send SMS for reminders'),
  enablePush: z.boolean().default(true).describe('Send push notification'),
  
  // Styling and branding
  brandColor: z.string().default('#1976D2').describe('Brand color for training notifications (blue theme)'),
  logoUrl: z.string().url().optional().describe('Organization logo URL'),
  organizationName: z.string().default('Fire Safety Training').describe('Organization name'),
  
  // Template configuration
  includeObjectives: z.boolean().default(true).describe('Include training objectives'),
  includeInstructorContact: z.boolean().default(true).describe('Include instructor contact information'),
  includeMaterials: z.boolean().default(true).describe('Include required materials list'),
  includeComplianceInfo: z.boolean().default(true).describe('Include compliance information'),
  
  // Enrollment settings
  enableEnrollment: z.boolean().default(true).describe('Enable enrollment functionality'),
  enrollmentDeadline: z.string().optional().describe('Enrollment deadline'),
  waitlistEnabled: z.boolean().default(false).describe('Enable waitlist for full sessions'),
  
  // Certification settings
  enableCertification: z.boolean().default(true).describe('Enable certificate generation'),
  certificateTemplateUrl: z.string().url().optional().describe('URL to certificate template'),
  
  // Language and localization
  dateTimeFormat: z.string().default('YYYY-MM-DD HH:mm').describe('Date time display format'),
  timezone: z.string().default('Asia/Shanghai').describe('Timezone for time display'),
})