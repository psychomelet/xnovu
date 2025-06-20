import { z } from 'zod'
import { payloadSchema, controlSchema } from './schemas'

export type FireMaintenancePayload = z.infer<typeof payloadSchema>
export type FireMaintenanceControls = z.infer<typeof controlSchema>

export interface MaintenanceTypeConfig {
  preventive: { icon: '🔧', urgency: 'medium', description: 'Scheduled preventive maintenance' }
  corrective: { icon: '🔩', urgency: 'high', description: 'Corrective maintenance for identified issues' }
  emergency: { icon: '🚨', urgency: 'critical', description: 'Emergency repair for system failure' }
  inspection: { icon: '🔍', urgency: 'medium', description: 'Equipment inspection and testing' }
  testing: { icon: '⚙️', urgency: 'medium', description: 'System functionality testing' }
  replacement: { icon: '🔄', urgency: 'high', description: 'Equipment replacement or upgrade' }
}

export interface EquipmentTypeConfig {
  fire_alarm: { icon: '🚨', critical: true, description: 'Fire alarm system components' }
  sprinkler_system: { icon: '💧', critical: true, description: 'Sprinkler system components' }
  fire_extinguisher: { icon: '🧨', critical: true, description: 'Portable fire extinguishers' }
  emergency_lighting: { icon: '💡', critical: false, description: 'Emergency lighting systems' }
  smoke_detector: { icon: '💨', critical: true, description: 'Smoke detection devices' }
  fire_door: { icon: '🚪', critical: false, description: 'Fire-rated doors and hardware' }
  fire_pump: { icon: '⛽', critical: true, description: 'Fire pump systems' }
  suppression_system: { icon: '🧨', critical: true, description: 'Fire suppression systems' }
}

export interface LocalizedMaintenanceContent {
  en: {
    technician: 'Technician'
    scheduled: 'Scheduled'
    urgency: 'Urgency'
    duration: 'Duration'
    equipment: 'Equipment'
    location: 'Location'
    description: 'Description'
    requiredParts: 'Required Parts'
    requiredTools: 'Required Tools'
    safetyPrecautions: 'Safety Precautions'
    faultDetails: 'Fault Details'
    systemStatus: 'System Status'
    workPerformed: 'Work Performed'
    partsUsed: 'Parts Used'
    testResults: 'Test Results'
    nextMaintenance: 'Next Maintenance'
    lastMaintenance: 'Last Maintenance'
    manufacturer: 'Manufacturer'
    model: 'Model'
    serialNumber: 'Serial Number'
    warrantyExpiry: 'Warranty Expiry'
    confirmWork: 'Confirm Work Order'
    reschedule: 'Reschedule'
    viewProcedure: 'View Procedure'
    orderParts: 'Order Parts'
    contactTechnician: 'Contact Technician'
  }
  zh: {
    technician: '技术员'
    scheduled: '计划时间'
    urgency: '紧急程度'
    duration: '持续时间'
    equipment: '设备'
    location: '位置'
    description: '描述'
    requiredParts: '所需零件'
    requiredTools: '所需工具'
    safetyPrecautions: '安全预防措施'
    faultDetails: '故障详情'
    systemStatus: '系统状态'
    workPerformed: '已完成工作'
    partsUsed: '使用零件'
    testResults: '测试结果'
    nextMaintenance: '下次维护'
    lastMaintenance: '上次维护'
    manufacturer: '制造商'
    model: '型号'
    serialNumber: '序列号'
    warrantyExpiry: '保修期限'
    confirmWork: '确认工作单'
    reschedule: '重新安排'
    viewProcedure: '查看程序'
    orderParts: '订购零件'
    contactTechnician: '联系技术员'
  }
}