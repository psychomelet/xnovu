import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { FireMaintenancePayload, FireMaintenanceControls, MaintenanceTypeConfig, EquipmentTypeConfig, LocalizedMaintenanceContent } from './types'

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
        
        return {
          subject,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: ${controls.brandColor};">${urgencyPrefix} ${payload.language === 'zh' ? '消防设备维护' : 'Fire Equipment Maintenance'}</h2>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>${payload.language === 'zh' ? '设备详情' : 'Equipment Details'}</h3>
                <p><strong>${content.equipment}:</strong> ${payload.equipmentName} (${payload.equipmentType})</p>
                <p><strong>${content.location}:</strong> ${payload.buildingName} - ${payload.locationDescription}</p>
                <p><strong>${content.scheduled}:</strong> ${formattedDate} ${payload.scheduledTime}</p>
                <p><strong>${content.duration}:</strong> ${payload.estimatedDuration}</p>
                <p><strong>${content.urgency}:</strong> ${payload.urgencyLevel.toUpperCase()}</p>
              </div>
              
              <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>${payload.language === 'zh' ? '维护详情' : 'Maintenance Details'}</h3>
                <p><strong>${payload.language === 'zh' ? '类型' : 'Type'}:</strong> ${maintenanceConfig.icon} ${maintenanceConfig.description}</p>
                <p><strong>${content.description}:</strong> ${payload.maintenanceDescription}</p>
                ${payload.requiredParts ? `<p><strong>${content.requiredParts}:</strong> ${payload.requiredParts.join(', ')}</p>` : ''}
                ${payload.requiredTools ? `<p><strong>${content.requiredTools}:</strong> ${payload.requiredTools.join(', ')}</p>` : ''}
                ${payload.safetyPrecautions ? `<p><strong>${content.safetyPrecautions}:</strong> ${payload.safetyPrecautions.join(', ')}</p>` : ''}
              </div>
              
              <div style="background: #f3e5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>${content.technician} ${payload.language === 'zh' ? '联系方式' : 'Contact'}</h3>
                <p><strong>${payload.language === 'zh' ? '姓名' : 'Name'}:</strong> ${payload.technicianName}</p>
                <p><strong>${payload.language === 'zh' ? '公司' : 'Company'}:</strong> ${payload.technicianCompany}</p>
                <p><strong>${payload.language === 'zh' ? '电话' : 'Phone'}:</strong> <a href="tel:${payload.technicianPhone}">${payload.technicianPhone}</a></p>
                <p><strong>${payload.language === 'zh' ? '邮箱' : 'Email'}:</strong> <a href="mailto:${payload.technicianEmail}">${payload.technicianEmail}</a></p>
              </div>
              
              ${payload.faultDetails ? `
                <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0;">
                  <h3 style="color: #d32f2f;">${content.faultDetails}</h3>
                  <p><strong>${content.description}:</strong> ${payload.faultDetails.faultDescription}</p>
                  <p><strong>${payload.language === 'zh' ? '严重程度' : 'Severity'}:</strong> ${payload.faultDetails.severity.toUpperCase()}</p>
                  <p><strong>${content.systemStatus}:</strong> ${payload.faultDetails.systemStatus}</p>
                  <p><strong>${payload.language === 'zh' ? '检测时间' : 'Detected'}:</strong> ${new Date(payload.faultDetails.detectedAt).toLocaleString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>
                </div>
              ` : ''}
              
              ${payload.completionDetails ? `
                <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
                  <h3 style="color: #388e3c;">${payload.language === 'zh' ? '完成详情' : 'Completion Details'}</h3>
                  <p><strong>${payload.language === 'zh' ? '完成时间' : 'Completed At'}:</strong> ${new Date(payload.completionDetails.completedAt).toLocaleString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>
                  <p><strong>${content.workPerformed}:</strong> ${payload.completionDetails.workPerformed}</p>
                  ${payload.completionDetails.partsUsed ? `<p><strong>${content.partsUsed}:</strong> ${payload.completionDetails.partsUsed.join(', ')}</p>` : ''}
                  ${payload.completionDetails.testResults ? `<p><strong>${content.testResults}:</strong> ${payload.completionDetails.testResults}</p>` : ''}
                  ${payload.completionDetails.nextMaintenanceDate ? `<p><strong>${content.nextMaintenance}:</strong> ${new Date(payload.completionDetails.nextMaintenanceDate).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>` : ''}
                </div>
              ` : ''}
              
              <p style="margin-top: 30px; font-size: 12px; color: #666;">
                ${payload.language === 'zh' ? '维护编号' : 'Maintenance ID'}: ${payload.maintenanceId}<br>
                ${payload.language === 'zh' ? '设备编号' : 'Equipment ID'}: ${payload.equipmentId}
              </p>
            </div>
          `
        }
      },
      { controlSchema }
    )

    // SMS for critical issues
    if (payload.urgencyLevel === 'critical' || payload.notificationType === 'fault_detected') {
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
        { controlSchema }
      )
    }

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