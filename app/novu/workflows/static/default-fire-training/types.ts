import { z } from 'zod'
import { payloadSchema, controlSchema } from './schemas'

export type FireTrainingPayload = z.infer<typeof payloadSchema>
export type FireTrainingControls = z.infer<typeof controlSchema>

export interface TrainingTypeConfig {
  fire_safety_basics: { icon: '🔥', description: 'Basic fire safety principles and procedures' }
  evacuation_procedures: { icon: '🚪', description: 'Building evacuation procedures and routes' }
  fire_warden_training: { icon: '👷', description: 'Fire warden responsibilities and duties' }
  equipment_operation: { icon: '🧯', description: 'Fire safety equipment operation' }
  emergency_response: { icon: '🚨', description: 'Emergency response protocols' }
  compliance_training: { icon: '📋', description: 'Regulatory compliance training' }
}

export interface LocalizedTrainingContent {
  en: {
    instructor: 'Instructor'
    scheduled: 'Scheduled'
    duration: 'Duration'
    location: 'Location'
    objectives: 'Learning Objectives'
    materials: 'Required Materials'
    prerequisites: 'Prerequisites'
    maxParticipants: 'Maximum Participants'
    enrollment: 'Enrollment'
    completion: 'Training Completed'
    participants: 'Participants'
    passRate: 'Pass Rate'
    certificates: 'Certificates Issued'
    feedback: 'Feedback'
    nextTraining: 'Next Training'
    courseCode: 'Course Code'
    certificationType: 'Certificate Type'
    validityPeriod: 'Validity Period'
    compliance: 'Compliance Requirement'
    registerNow: 'Register for Training'
    downloadCertificate: 'Download Certificate'
    viewMaterials: 'View Training Materials'
    contactInstructor: 'Contact Instructor'
  }
  zh: {
    instructor: '讲师'
    scheduled: '计划时间'
    duration: '持续时间'
    location: '地点'
    objectives: '学习目标'
    materials: '所需材料'
    prerequisites: '先决条件'
    maxParticipants: '最大参与人数'
    enrollment: '报名'
    completion: '培训完成'
    participants: '参与者'
    passRate: '通过率'
    certificates: '颁发证书'
    feedback: '反馈'
    nextTraining: '下次培训'
    courseCode: '课程代码'
    certificationType: '证书类型'
    validityPeriod: '有效期'
    compliance: '合规要求'
    registerNow: '立即注册培训'
    downloadCertificate: '下载证书'
    viewMaterials: '查看培训材料'
    contactInstructor: '联系讲师'
  }
}