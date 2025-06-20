import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { FireTrainingPayload, FireTrainingControls, TrainingTypeConfig, LocalizedTrainingContent } from './types'
import { renderFireTrainingEmail } from '../../../emails/workflows'

const trainingTypeConfig: TrainingTypeConfig = {
  fire_safety_basics: { icon: '🔥', description: 'Basic fire safety principles and procedures' },
  evacuation_procedures: { icon: '🚪', description: 'Building evacuation procedures and routes' },
  fire_warden_training: { icon: '👷', description: 'Fire warden responsibilities and duties' },
  equipment_operation: { icon: '🧯', description: 'Fire safety equipment operation' },
  emergency_response: { icon: '🚨', description: 'Emergency response protocols' },
  compliance_training: { icon: '📋', description: 'Regulatory compliance training' }
}

const localizedContent: LocalizedTrainingContent = {
  en: {
    instructor: 'Instructor', scheduled: 'Scheduled', duration: 'Duration', location: 'Location',
    objectives: 'Learning Objectives', materials: 'Required Materials', prerequisites: 'Prerequisites',
    maxParticipants: 'Maximum Participants', enrollment: 'Enrollment', completion: 'Training Completed',
    participants: 'Participants', passRate: 'Pass Rate', certificates: 'Certificates Issued',
    feedback: 'Feedback', nextTraining: 'Next Training', courseCode: 'Course Code',
    certificationType: 'Certificate Type', validityPeriod: 'Validity Period', compliance: 'Compliance Requirement',
    registerNow: 'Register for Training', downloadCertificate: 'Download Certificate',
    viewMaterials: 'View Training Materials', contactInstructor: 'Contact Instructor'
  },
  zh: {
    instructor: '讲师', scheduled: '计划时间', duration: '持续时间', location: '地点',
    objectives: '学习目标', materials: '所需材料', prerequisites: '先决条件',
    maxParticipants: '最大参与人数', enrollment: '报名', completion: '培训完成',
    participants: '参与者', passRate: '通过率', certificates: '颁发证书',
    feedback: '反馈', nextTraining: '下次培训', courseCode: '课程代码',
    certificationType: '证书类型', validityPeriod: '有效期', compliance: '合规要求',
    registerNow: '立即注册培训', downloadCertificate: '下载证书',
    viewMaterials: '查看培训材料', contactInstructor: '联系讲师'
  }
}

export const defaultFireTrainingWorkflow = workflow(
  'default-fire-training',
  async ({ step, payload }) => {
    const trainingConfig = trainingTypeConfig[payload.trainingType]
    const content = localizedContent[payload.language]
    
    const formattedDate = new Date(payload.scheduledDate).toLocaleDateString(
      payload.language === 'zh' ? 'zh-CN' : 'en-US',
      { timeZone: 'Asia/Shanghai' }
    )
    
    // Email step - Primary training notification
    await step.email(
      'send-training-email',
      async (controls: FireTrainingControls) => {
        const subject = payload.language === 'zh'
          ? `🎓 消防安全培训: ${payload.trainingTitle} - ${payload.buildingName}`
          : `🎓 Fire Safety Training: ${payload.trainingTitle} - ${payload.buildingName}`
        
        // Build event details
        const eventDetails: Record<string, string> = {
          [content.scheduled]: `${formattedDate} ${payload.scheduledTime}`,
          [content.duration]: payload.duration,
          [content.location]: `${payload.buildingName} - ${payload.roomLocation}`,
          [content.maxParticipants]: payload.maxParticipants.toString()
        }
        if (payload.courseCode) {
          eventDetails[content.courseCode] = payload.courseCode
        }
        
        // Build objectives and prerequisites
        const instructions: string[] = []
        if (payload.objectives && payload.objectives.length > 0) {
          instructions.push(`${content.objectives}:\n${payload.objectives.map(obj => `• ${obj}`).join('\n')}`)
        }
        if (payload.prerequisites && payload.prerequisites.length > 0) {
          instructions.push(`${content.prerequisites}:\n${payload.prerequisites.map(pre => `• ${pre}`).join('\n')}`)
        }
        
        // Build materials list
        const checklist = payload.requiredMaterials?.map(material => ({ task: material, completed: false })) || []
        
        // Add instructor info to event details
        if (controls.includeInstructorInfo) {
          eventDetails[content.instructor] = payload.instructorName
          eventDetails[payload.language === 'zh' ? '讲师单位' : 'Instructor Organization'] = payload.instructorOrganization
          eventDetails[payload.language === 'zh' ? '讲师电话' : 'Instructor Phone'] = payload.instructorPhone
          eventDetails[payload.language === 'zh' ? '讲师邮箱' : 'Instructor Email'] = payload.instructorEmail
        }
        
        // Add completion details if available
        if (payload.completionDetails) {
          eventDetails[payload.language === 'zh' ? '完成日期' : 'Completed'] = new Date(payload.completionDetails.completedDate).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')
          eventDetails[content.participants] = payload.completionDetails.participantCount.toString()
          if (payload.completionDetails.passRate) {
            eventDetails[content.passRate] = `${payload.completionDetails.passRate}%`
          }
          if (payload.completionDetails.certificatesIssued) {
            eventDetails[content.certificates] = payload.completionDetails.certificatesIssued.toString()
          }
          if (payload.completionDetails.feedback) {
            eventDetails[content.feedback] = payload.completionDetails.feedback
          }
        }
        
        // Add certification info
        if (payload.certificationType) {
          eventDetails[content.certificationType] = payload.certificationType
        }
        if (payload.validityPeriod) {
          eventDetails[content.validityPeriod] = payload.validityPeriod
        }
        if (payload.complianceRequirement) {
          eventDetails[content.compliance] = payload.complianceRequirement
        }
        
        // Build message
        const message = payload.completionDetails
          ? (payload.language === 'zh' ? '消防安全培训已成功完成。' : 'Fire safety training has been successfully completed.')
          : (payload.language === 'zh' ? `${trainingConfig.description}。请查看以下培训详情。` : `${trainingConfig.description}. Please review the training details below.`)
        
        // Build primary action
        const primaryAction = controls.enableEnrollment && payload.enrollmentUrl && !payload.completionDetails
          ? {
              text: content.registerNow,
              url: `${payload.enrollmentUrl}?trainingId=${payload.trainingId}`
            }
          : undefined
        
        const body = renderFireTrainingEmail({
          subject,
          recipientName: payload.recipientName,
          organizationName: controls.organizationName,
          logoUrl: controls.logoUrl,
          primaryColor: controls.brandColor,
          trainingTitle: payload.trainingTitle,
          trainingMessage: message,
          trainingDate: formattedDate,
          trainingTime: payload.scheduledTime,
          trainingDuration: payload.duration,
          instructions: instructions.length > 0 ? instructions.join('\n\n') : undefined,
          requirements: payload.requiredMaterials,
          trainerInfo: controls.includeInstructorInfo ? {
            'Name': payload.instructorName,
            'Organization': payload.instructorOrganization,
            'Phone': payload.instructorPhone,
            'Email': payload.instructorEmail
          } : undefined,
          registrationUrl: controls.enableEnrollment && payload.enrollmentUrl && !payload.completionDetails 
            ? `${payload.enrollmentUrl}?trainingId=${payload.trainingId}` 
            : undefined,
          footerNote: `${payload.language === 'zh' ? '培训编号' : 'Training ID'}: ${payload.trainingId}`
        })
        
        return {
          subject,
          body
        }
      },
      { controlSchema }
    )

    // In-app notification
    await step.inApp(
      'send-training-inapp',
      async () => {
        const subject = payload.language === 'zh'
          ? `消防安全培训: ${payload.trainingTitle}`
          : `Fire Safety Training: ${payload.trainingTitle}`
          
        const body = payload.language === 'zh'
          ? `${trainingConfig.description}计划于${formattedDate} ${payload.scheduledTime}在${payload.buildingName}进行。讲师: ${payload.instructorName}`
          : `${payload.trainingType.replace('_', ' ')} training scheduled for ${formattedDate} ${payload.scheduledTime} at ${payload.buildingName}. Instructor: ${payload.instructorName}`
        
        return {
          subject,
          body
        }
      },
      { controlSchema }
    )

    // Push notification
    await step.push(
      'send-training-push',
      async () => {
        const subject = payload.language === 'zh'
          ? `🎓 消防培训: ${payload.trainingTitle}`
          : `🎓 Fire Training: ${payload.trainingTitle}`
          
        const body = payload.language === 'zh'
          ? `${formattedDate} ${payload.scheduledTime} 在${payload.buildingName}`
          : `${formattedDate} ${payload.scheduledTime} at ${payload.buildingName}`
        
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
    tags: ['fire-safety', 'training', 'education', 'certification'],
    description: 'Fire safety training workflow for announcements, enrollment, reminders, and completion certificates'
  }
)