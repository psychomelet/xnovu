import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { FireTrainingPayload, FireTrainingControls, TrainingTypeConfig, LocalizedTrainingContent } from './types'

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
        
        return {
          subject,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: ${controls.brandColor};">🎓 ${payload.language === 'zh' ? '消防安全培训通知' : 'Fire Safety Training Notification'}</h2>
              
              <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>${payload.language === 'zh' ? '培训详情' : 'Training Details'}</h3>
                <p><strong>${payload.language === 'zh' ? '培训名称' : 'Training'}:</strong> ${payload.trainingTitle}</p>
                <p><strong>${payload.language === 'zh' ? '类型' : 'Type'}:</strong> ${trainingConfig.icon} ${trainingConfig.description}</p>
                <p><strong>${payload.language === 'zh' ? '日期' : 'Date'}:</strong> ${formattedDate}</p>
                <p><strong>${payload.language === 'zh' ? '时间' : 'Time'}:</strong> ${payload.scheduledTime}</p>
                <p><strong>${content.duration}:</strong> ${payload.duration}</p>
                <p><strong>${content.location}:</strong> ${payload.buildingName} - ${payload.locationDescription}</p>
                ${payload.roomNumber ? `<p><strong>${payload.language === 'zh' ? '房间' : 'Room'}:</strong> ${payload.roomNumber}</p>` : ''}
                ${payload.maxParticipants ? `<p><strong>${content.maxParticipants}:</strong> ${payload.maxParticipants}</p>` : ''}
              </div>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>${payload.language === 'zh' ? '培训描述' : 'Training Description'}</h3>
                <p>${payload.trainingDescription}</p>
                ${payload.prerequisites ? `<p><strong>${content.prerequisites}:</strong> ${payload.prerequisites}</p>` : ''}
              </div>
              
              ${controls.includeObjectives && payload.trainingObjectives.length > 0 ? `
                <div style="background: #e8f5e8; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <h3>${content.objectives}</h3>
                  <ul>
                    ${payload.trainingObjectives.map(obj => `<li>${obj}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${controls.includeInstructorContact ? `
                <div style="background: #f3e5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <h3>${content.instructor} ${payload.language === 'zh' ? '联系方式' : 'Contact'}</h3>
                  <p><strong>${payload.language === 'zh' ? '姓名' : 'Name'}:</strong> ${payload.instructorName}</p>
                  <p><strong>${payload.language === 'zh' ? '组织' : 'Organization'}:</strong> ${payload.instructorOrganization}</p>
                  <p><strong>${payload.language === 'zh' ? '电话' : 'Phone'}:</strong> <a href="tel:${payload.instructorPhone}">${payload.instructorPhone}</a></p>
                  <p><strong>${payload.language === 'zh' ? '邮箱' : 'Email'}:</strong> <a href="mailto:${payload.instructorEmail}">${payload.instructorEmail}</a></p>
                </div>
              ` : ''}
              
              ${payload.requiredMaterials && payload.requiredMaterials.length > 0 ? `
                <div style="background: #fff8e1; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <h3>${content.materials}</h3>
                  <ul>
                    ${payload.requiredMaterials.map(material => `<li>${material}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${controls.enableEnrollment && payload.enrollmentUrl ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${payload.enrollmentUrl}?trainingId=${payload.trainingId}" 
                     style="display: inline-block; padding: 12px 24px; background-color: ${controls.brandColor}; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    ${content.registerNow}
                  </a>
                </div>
              ` : ''}
              
              ${payload.completionDetails ? `
                <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
                  <h3>${content.completion}</h3>
                  <p><strong>${payload.language === 'zh' ? '完成日期' : 'Completed'}:</strong> ${new Date(payload.completionDetails.completedDate).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>
                  <p><strong>${content.participants}:</strong> ${payload.completionDetails.participantCount}</p>
                  ${payload.completionDetails.passRate ? `<p><strong>${content.passRate}:</strong> ${payload.completionDetails.passRate}%</p>` : ''}
                  ${payload.completionDetails.certificatesIssued ? `<p><strong>${content.certificates}:</strong> ${payload.completionDetails.certificatesIssued}</p>` : ''}
                  ${payload.completionDetails.feedback ? `<p><strong>${content.feedback}:</strong> ${payload.completionDetails.feedback}</p>` : ''}
                </div>
              ` : ''}
              
              ${payload.certificationType || payload.validityPeriod || payload.complianceRequirement ? `
                <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0;">
                  <h3>${payload.language === 'zh' ? '认证信息' : 'Certification Information'}</h3>
                  ${payload.certificationType ? `<p><strong>${content.certificationType}:</strong> ${payload.certificationType}</p>` : ''}
                  ${payload.validityPeriod ? `<p><strong>${content.validityPeriod}:</strong> ${payload.validityPeriod}</p>` : ''}
                  ${payload.complianceRequirement ? `<p><strong>${content.compliance}:</strong> ${payload.complianceRequirement}</p>` : ''}
                </div>
              ` : ''}
              
              <p style="margin-top: 30px; font-size: 12px; color: #666;">
                ${payload.language === 'zh' ? '培训编号' : 'Training ID'}: ${payload.trainingId}<br>
                ${payload.courseCode ? `${content.courseCode}: ${payload.courseCode}` : ''}
              </p>
            </div>
          `
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