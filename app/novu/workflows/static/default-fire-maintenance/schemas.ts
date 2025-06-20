import { z } from 'zod'

export const payloadSchema = z.object({
  // Equipment basic information
  maintenanceType: z.enum(['preventive', 'corrective', 'emergency', 'inspection', 'testing', 'replacement']).describe('Type of maintenance activity'),
  equipmentName: z.string().describe('Name of the fire safety equipment'),
  equipmentType: z.enum(['fire_alarm', 'sprinkler_system', 'fire_extinguisher', 'emergency_lighting', 'smoke_detector', 'fire_door', 'fire_pump', 'suppression_system']).describe('Type of fire safety equipment'),
  equipmentId: z.string().describe('Unique equipment identifier'),
  
  // Location details
  buildingName: z.string().describe('Name of the building where equipment is located'),
  floorNumber: z.string().optional().describe('Floor number (e.g., "3F", "B1")'),
  zoneId: z.string().optional().describe('Zone or area identifier'),
  locationDescription: z.string().describe('Detailed location description'),
  
  // Scheduling information
  scheduledDate: z.string().describe('Scheduled date for maintenance (ISO format)'),
  scheduledTime: z.string().describe('Scheduled time for maintenance (HH:MM format)'),
  estimatedDuration: z.string().describe('Estimated duration (e.g., "2 hours", "Half day")'),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']).describe('Maintenance urgency level'),
  
  // Personnel information
  recipientRole: z.enum(['maintenance_tech', 'facility_manager', 'fire_safety_officer', 'building_manager', 'vendor_technician']).describe('Target recipient role'),
  recipientName: z.string().optional().describe('Recipient name for personalization'),
  
  // Technician details
  technicianName: z.string().describe('Name of assigned maintenance technician'),
  technicianPhone: z.string().describe('Technician phone number'),
  technicianEmail: z.string().email().describe('Technician email address'),
  technicianCompany: z.string().describe('Technician company (internal/vendor)'),
  
  // Maintenance details
  maintenanceDescription: z.string().describe('Description of maintenance work to be performed'),
  requiredParts: z.array(z.string()).optional().describe('Parts required for maintenance'),
  requiredTools: z.array(z.string()).optional().describe('Tools required for maintenance'),
  safetyPrecautions: z.array(z.string()).optional().describe('Safety precautions to follow'),
  
  // Notification context
  notificationType: z.enum(['scheduled', 'reminder', 'fault_detected', 'overdue', 'completion', 'parts_needed', 'delay']).describe('Type of notification being sent'),
  
  // Fault information (for fault notifications)
  faultDetails: z.object({
    faultCode: z.string().optional(),
    faultDescription: z.string(),
    detectedAt: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    systemStatus: z.enum(['operational', 'degraded', 'offline', 'failed']),
    impactDescription: z.string().optional()
  }).optional().describe('Fault details (for fault notifications)'),
  
  // Completion information (for completion notifications)
  completionDetails: z.object({
    completedAt: z.string(),
    workPerformed: z.string(),
    partsUsed: z.array(z.string()).optional(),
    testResults: z.string().optional(),
    nextMaintenanceDate: z.string().optional(),
    warrantyInfo: z.string().optional(),
    notes: z.string().optional()
  }).optional().describe('Completion details (for completion notifications)'),
  
  // Equipment specifications
  manufacturer: z.string().optional().describe('Equipment manufacturer'),
  model: z.string().optional().describe('Equipment model number'),
  serialNumber: z.string().optional().describe('Equipment serial number'),
  installationDate: z.string().optional().describe('Equipment installation date (ISO format)'),
  warrantyExpiry: z.string().optional().describe('Warranty expiry date (ISO format)'),
  
  // Compliance and documentation
  lastMaintenanceDate: z.string().optional().describe('Date of last maintenance (ISO format)'),
  nextMaintenanceDate: z.string().optional().describe('Date of next scheduled maintenance (ISO format)'),
  complianceStandard: z.string().optional().describe('Compliance standard (e.g., NFPA, local codes)'),
  maintenanceLogUrl: z.string().url().optional().describe('URL to maintenance log/history'),
  
  // Additional context
  maintenanceId: z.string().describe('Unique maintenance request identifier'),
  workOrderNumber: z.string().optional().describe('Work order number'),
  
  // Documents and resources
  procedureDocumentUrl: z.string().url().optional().describe('URL to maintenance procedure document'),
  schematicUrl: z.string().url().optional().describe('URL to equipment schematic/manual'),
  videoGuideUrl: z.string().url().optional().describe('URL to video maintenance guide'),
  
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
  
  // Channel priority by urgency and notification type
  criticalFaultChannels: z.array(z.enum(['email', 'inapp', 'sms', 'push', 'chat'])).default(['email', 'sms', 'push', 'inapp']).describe('Channels for critical fault alerts'),
  scheduledMaintenanceChannels: z.array(z.enum(['email', 'inapp', 'push'])).default(['email', 'inapp']).describe('Channels for scheduled maintenance'),
  reminderChannels: z.array(z.enum(['email', 'inapp', 'push'])).default(['email', 'push']).describe('Channels for maintenance reminders'),
  completionChannels: z.array(z.enum(['email', 'inapp'])).default(['email', 'inapp']).describe('Channels for completion notifications'),
  
  // Urgency settings
  criticalAlertPrefix: z.string().default('🚨 CRITICAL').describe('Prefix for critical alerts'),
  highUrgencyPrefix: z.string().default('⚠️ URGENT').describe('Prefix for high urgency'),
  normalPrefix: z.string().default('🔧 MAINTENANCE').describe('Prefix for normal maintenance'),
  
  // Styling and branding
  brandColor: z.string().default('#FF6F00').describe('Brand color for maintenance notifications (orange theme)'),
  logoUrl: z.string().url().optional().describe('Organization logo URL'),
  organizationName: z.string().default('Facility Maintenance').describe('Organization name'),
  
  // Template configuration
  includeEquipmentDetails: z.boolean().default(true).describe('Include equipment specifications'),
  includeTechnicianContact: z.boolean().default(true).describe('Include technician contact information'),
  includeSafetyPrecautions: z.boolean().default(true).describe('Include safety precautions'),
  includeMaintenanceHistory: z.boolean().default(false).describe('Include maintenance history link'),
  includeProcedureDocuments: z.boolean().default(true).describe('Include procedure documents'),
  
  // Maintenance workflow settings
  requireWorkOrderConfirmation: z.boolean().default(false).describe('Require work order confirmation'),
  confirmationUrl: z.string().url().optional().describe('URL for work order confirmation'),
  enableRescheduling: z.boolean().default(true).describe('Allow maintenance rescheduling'),
  rescheduleUrl: z.string().url().optional().describe('URL for rescheduling requests'),
  
  // Parts and inventory management
  enablePartsTracking: z.boolean().default(true).describe('Track parts usage and inventory'),
  partsInventoryUrl: z.string().url().optional().describe('URL to parts inventory system'),
  enableVendorNotification: z.boolean().default(false).describe('Notify vendors for parts orders'),
  
  // Compliance and documentation
  trackCompliance: z.boolean().default(true).describe('Track compliance with maintenance schedules'),
  generateMaintenanceReport: z.boolean().default(true).describe('Generate maintenance completion reports'),
  reportTemplateUrl: z.string().url().optional().describe('URL to maintenance report template'),
  
  // Emergency response settings
  emergencyEscalationEnabled: z.boolean().default(true).describe('Enable emergency escalation for critical faults'),
  escalationDelayMinutes: z.number().min(5).max(60).default(15).describe('Minutes before escalation for critical issues'),
  emergencyContactList: z.array(z.string()).optional().describe('Emergency contact phone numbers'),
  
  // Language and localization
  dateTimeFormat: z.string().default('YYYY-MM-DD HH:mm').describe('Date time display format'),
  timezone: z.string().default('Asia/Shanghai').describe('Timezone for time display'),
  
  // Template style and tone
  templateTone: z.enum(['technical', 'professional', 'urgent']).default('technical').describe('Tone of notifications'),
  includeImages: z.boolean().default(true).describe('Include equipment images and diagrams'),
  detailLevel: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed').describe('Level of technical detail'),
})