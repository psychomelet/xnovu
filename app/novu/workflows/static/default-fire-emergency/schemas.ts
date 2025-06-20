import { z } from 'zod'

export const payloadSchema = z.object({
  // Core emergency information
  emergencyType: z.enum(['fire', 'smoke_detected', 'gas_leak', 'explosion', 'evacuation']).describe('Type of fire emergency'),
  severity: z.enum(['critical', 'high', 'medium']).describe('Emergency severity level'),
  buildingName: z.string().describe('Name of the affected building'),
  floorNumber: z.string().optional().describe('Floor number (e.g., "3F", "B1")'),
  zoneId: z.string().optional().describe('Zone or area identifier'),
  locationDescription: z.string().describe('Detailed location description'),
  
  // Personnel and recipients
  recipientRole: z.enum(['all_occupants', 'fire_wardens', 'security_team', 'management', 'emergency_responders']).describe('Target recipient role'),
  recipientName: z.string().optional().describe('Recipient name for personalization'),
  
  // Emergency details
  alertMessage: z.string().describe('Main emergency alert message'),
  evacuationInstructions: z.string().describe('Specific evacuation instructions'),
  assemblyPoint: z.string().describe('Emergency assembly point location'),
  emergencyContactName: z.string().describe('Emergency contact person name'),
  emergencyContactPhone: z.string().describe('Emergency contact phone number'),
  
  // Additional context
  detectedAt: z.string().describe('Time when emergency was detected (ISO format)'),
  reportedBy: z.string().optional().describe('Person or system that reported the emergency'),
  additionalInstructions: z.string().optional().describe('Additional safety instructions'),
  buildingMapUrl: z.string().url().optional().describe('URL to building evacuation map'),
  
  // System information
  alertId: z.string().describe('Unique alert identifier for tracking'),
  systemSource: z.string().default('Fire Safety System').describe('Source system that triggered the alert'),
  
  // Multi-language support
  language: z.enum(['en', 'zh']).default('en').describe('Notification language'),
  
  // Custom data for integration
  customData: z.record(z.any()).optional().describe('Additional custom data for integrations'),
})

export const controlSchema = z.object({
  // Channel configuration
  enableSMS: z.boolean().default(true).describe('Send SMS for immediate alert'),
  enablePush: z.boolean().default(true).describe('Send push notification'),
  enableEmail: z.boolean().default(true).describe('Send detailed email'),
  enableInApp: z.boolean().default(true).describe('Send in-app notification'),
  enableChat: z.boolean().default(false).describe('Send to chat/Teams channels'),
  
  // Urgency settings
  smsUrgencyPrefix: z.string().default('🚨 FIRE EMERGENCY').describe('SMS urgency prefix'),
  pushUrgencyLevel: z.enum(['normal', 'high', 'critical']).default('critical').describe('Push notification urgency level'),
  emailPriority: z.enum(['normal', 'high', 'urgent']).default('urgent').describe('Email priority level'),
  
  // Styling and branding
  brandColor: z.string().default('#D32F2F').describe('Brand color for emergency notifications (red theme)'),
  logoUrl: z.string().url().optional().describe('Organization logo URL'),
  organizationName: z.string().default('Building Management').describe('Organization name'),
  
  // Template configuration
  includeEvacuationMap: z.boolean().default(true).describe('Include evacuation map in email'),
  includeEmergencyContacts: z.boolean().default(true).describe('Include emergency contact list'),
  includeBuildingInfo: z.boolean().default(true).describe('Include building-specific information'),
  
  // Acknowledgment settings
  requireAcknowledgment: z.boolean().default(false).describe('Require recipient acknowledgment'),
  acknowledgmentUrl: z.string().url().optional().describe('URL for acknowledgment system'),
  
  // Follow-up configuration
  enableFollowUp: z.boolean().default(false).describe('Enable automatic follow-up notifications'),
  followUpIntervalMinutes: z.number().min(1).max(30).default(5).describe('Follow-up interval in minutes'),
  
  // Language and localization
  dateTimeFormat: z.string().default('YYYY-MM-DD HH:mm:ss').describe('Date time display format'),
  timezone: z.string().default('Asia/Shanghai').describe('Timezone for time display'),
})