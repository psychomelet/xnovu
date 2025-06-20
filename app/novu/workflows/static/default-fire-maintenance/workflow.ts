import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { FireMaintenancePayload, FireMaintenanceControls, MaintenanceTypeConfig, EquipmentTypeConfig, LocalizedMaintenanceContent } from './types'
import { renderFireMaintenanceEmail } from '../../../emails/workflows'

const maintenanceTypeConfig: MaintenanceTypeConfig = {
  preventive: { icon: '🔧', urgency: 'medium', description: 'Scheduled preventive maintenance' },
  corrective: { icon: '🔩', urgency: 'high', description: 'Corrective maintenance for identified issues' },
  emergency: { icon: '🚨', urgency: 'critical', description: 'Emergency repair for system failure' },
  inspection: { icon: '🔍', urgency: 'medium', description: 'Equipment inspection and testing' },
  testing: { icon: '⚙️', urgency: 'medium', description: 'System functionality testing' },
  replacement: { icon: '🔄', urgency: 'high', description: 'Equipment replacement or upgrade' }
}

const equipmentTypeConfig: EquipmentTypeConfig = {
  fire_alarm: { icon: '🚨', critical: true, description: 'Fire alarm system components' },
  sprinkler_system: { icon: '💧', critical: true, description: 'Sprinkler system components' },
  fire_extinguisher: { icon: '🧨', critical: true, description: 'Portable fire extinguishers' },
  emergency_lighting: { icon: '💡', critical: false, description: 'Emergency lighting systems' },
  smoke_detector: { icon: '💨', critical: true, description: 'Smoke detection devices' },
  fire_door: { icon: '🚪', critical: false, description: 'Fire-rated doors and hardware' },
  fire_pump: { icon: '⛽', critical: true, description: 'Fire pump systems' },
  suppression_system: { icon: '🧨', critical: true, description: 'Fire suppression systems' }
}

const localizedContent: LocalizedMaintenanceContent = {
  en: {
    technician: 'Technician', scheduled: 'Scheduled', urgency: 'Urgency', duration: 'Duration',
    equipment: 'Equipment', location: 'Location', description: 'Description', requiredParts: 'Required Parts',
    requiredTools: 'Required Tools', safetyPrecautions: 'Safety Precautions', faultDetails: 'Fault Details',
    systemStatus: 'System Status', workPerformed: 'Work Performed', partsUsed: 'Parts Used',
    testResults: 'Test Results', nextMaintenance: 'Next Maintenance', lastMaintenance: 'Last Maintenance',
    manufacturer: 'Manufacturer', model: 'Model', serialNumber: 'Serial Number', warrantyExpiry: 'Warranty Expiry',
    confirmWork: 'Confirm Work Order', reschedule: 'Reschedule', viewProcedure: 'View Procedure',
    orderParts: 'Order Parts', contactTechnician: 'Contact Technician'
  },
  zh: {
    technician: '技术员', scheduled: '计划时间', urgency: '紧急程度', duration: '持续时间',
    equipment: '设备', location: '位置', description: '描述', requiredParts: '所需零件',
    requiredTools: '所需工具', safetyPrecautions: '安全预防措施', faultDetails: '故障详情',
    systemStatus: '系统状态', workPerformed: '已完成工作', partsUsed: '使用零件',
    testResults: '测试结果', nextMaintenance: '下次维护', lastMaintenance: '上次维护',
    manufacturer: '制造商', model: '型号', serialNumber: '序列号', warrantyExpiry: '保修期限',
    confirmWork: '确认工作单', reschedule: '重新安排', viewProcedure: '查看程序',
    orderParts: '订购零件', contactTechnician: '联系技术员'
  }
}

export const defaultFireMaintenanceWorkflow = workflow(
  'default-fire-maintenance',
  async ({ step, payload }) => {
    const maintenanceConfig = maintenanceTypeConfig[payload.maintenanceType]
    const equipmentConfig = equipmentTypeConfig[payload.equipmentType]
    const content = localizedContent[payload.language]
    
    const formattedDate = new Date(payload.scheduledDate).toLocaleDateString(
      payload.language === 'zh' ? 'zh-CN' : 'en-US',
      { timeZone: 'Asia/Shanghai' }
    )
    
    // Email step - Primary maintenance notification
    await step.email(
      'send-maintenance-email',
      async (controls: FireMaintenanceControls) => {
        const isUrgent = payload.urgencyLevel === 'critical' || payload.urgencyLevel === 'high'
        const urgencyPrefix = payload.urgencyLevel === 'critical' ? controls.criticalAlertPrefix : 
                             payload.urgencyLevel === 'high' ? controls.highUrgencyPrefix : controls.normalPrefix
        
        const subject = payload.language === 'zh'
          ? `${urgencyPrefix} ${equipmentConfig.icon} 消防设备维护: ${payload.equipmentName} - ${payload.buildingName}`
          : `${urgencyPrefix} ${equipmentConfig.icon} ${payload.equipmentType.replace('_', ' ').toUpperCase()} Maintenance: ${payload.equipmentName} - ${payload.buildingName}`
        
        // Prepare location details
        const locationDetails: Record<string, string> = {
          'Equipment': `${payload.equipmentName} (${payload.equipmentType})`,
          'Location': `${payload.buildingName} - ${payload.locationDescription}`,
          'Scheduled': `${formattedDate} ${payload.scheduledTime}`,
          'Duration': payload.estimatedDuration,
          'Urgency': payload.urgencyLevel.toUpperCase()
        }

        // Prepare backup systems info
        const backupSystems: Record<string, string> = {}
        if (payload.faultDetails) {
          backupSystems['System Status'] = payload.faultDetails.systemStatus
          backupSystems['Detected At'] = new Date(payload.faultDetails.detectedAt).toLocaleString(
            payload.language === 'zh' ? 'zh-CN' : 'en-US'
          )
        }

        const body = await renderFireMaintenanceEmail({
          subject,
          recipientName: payload.recipientName,
          organizationName: controls.organizationName,
          logoUrl: controls.logoUrl,
          primaryColor: controls.brandColor,
          maintenanceTitle: payload.language === 'zh' ? '消防设备维护' : 'Fire Equipment Maintenance',
          maintenanceMessage: payload.maintenanceDescription,
          maintenanceType: maintenanceConfig.description,
          scheduledDate: formattedDate,
          estimatedDuration: payload.estimatedDuration,
          technician: payload.technicianName,
          technicianContact: payload.technicianPhone,
          equipmentList: [payload.equipmentName],
          affectedAreas: [payload.locationDescription],
          safetyNotes: payload.safetyPrecautions,
          accessRequirements: payload.requiredTools,
          locationDetails,
          temporaryProcedures: payload.requiredParts,
          backupSystems: Object.keys(backupSystems).length > 0 ? backupSystems : undefined,
          scheduleUrl: undefined,
          workOrderUrl: undefined,
          footerNote: payload.language === 'zh' 
            ? '此为自动生成的消防设备维护通知' 
            : 'This is an automated fire equipment maintenance notification'
        })

        return {
          subject,
          body
        }
      },
      { controlSchema }
    )

    // SMS for critical issues
    await step.sms(
      'send-maintenance-sms',
      async (controls: FireMaintenanceControls) => {
        const urgencyText = payload.urgencyLevel === 'critical' 
          ? (payload.language === 'zh' ? '🚨 严重' : '🚨 CRITICAL')
          : (payload.language === 'zh' ? '⚠️ 紧急' : '⚠️ URGENT')
        
        const smsBody = payload.language === 'zh'
          ? `${urgencyText} 消防设备维护\n${payload.equipmentName} - ${payload.buildingName}\n${payload.maintenanceDescription}\n技术员: ${payload.technicianName} ${payload.technicianPhone}`
          : `${urgencyText} Fire Equipment Maintenance\n${payload.equipmentName} - ${payload.buildingName}\n${payload.maintenanceDescription}\nTech: ${payload.technicianName} ${payload.technicianPhone}`
        
        return {
          body: smsBody.substring(0, 160)
        }
      },
      { 
        controlSchema,
        skip: () => !(payload.urgencyLevel === 'critical' || payload.notificationType === 'fault_detected')
      }
    )

    // In-app notification
    await step.inApp(
      'send-maintenance-inapp',
      async () => {
        const subject = payload.language === 'zh'
          ? `消防设备维护: ${payload.equipmentName}`
          : `Fire Equipment Maintenance: ${payload.equipmentName}`
          
        const body = payload.language === 'zh'
          ? `${maintenanceConfig.description}计划于${formattedDate} ${payload.scheduledTime}在${payload.buildingName}进行${payload.equipmentName}维护。技术员: ${payload.technicianName}`
          : `${payload.maintenanceType} maintenance scheduled for ${payload.equipmentName} at ${payload.buildingName} on ${formattedDate} ${payload.scheduledTime}. Technician: ${payload.technicianName}`
        
        return {
          subject,
          body
        }
      },
      { controlSchema }
    )
  },
  {
    payloadSchema,
    tags: ['fire-safety', 'maintenance', 'equipment', 'multi-channel'],
    description: 'Fire equipment maintenance workflow for scheduling, fault alerts, and completion tracking'
  }
)