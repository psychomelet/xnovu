import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { 
  FireInspectionPayload, 
  FireInspectionControls, 
  InspectionNotificationTypeConfig, 
  InspectionTypeConfig, 
  LocalizedInspectionContent,
  InspectionStatusConfig,
  ComplianceStatusConfig
} from './types'

const notificationTypeConfig: InspectionNotificationTypeConfig = {
  assignment: { icon: '📋', urgency: 'normal', subject_prefix: 'Fire Inspection Assigned', tone: 'professional' },
  reminder: { icon: '⏰', urgency: 'medium', subject_prefix: 'Fire Inspection Reminder', tone: 'reminder' },
  overdue: { icon: '⚠️', urgency: 'high', subject_prefix: 'Fire Inspection Overdue', tone: 'urgent' },
  completion: { icon: '✅', urgency: 'normal', subject_prefix: 'Fire Inspection Completed', tone: 'informational' },
  results: { icon: '📊', urgency: 'normal', subject_prefix: 'Fire Inspection Results', tone: 'informational' },
  follow_up_required: { icon: '🔄', urgency: 'medium', subject_prefix: 'Fire Inspection Follow-up Required', tone: 'action_required' }
}

const inspectionTypeConfig: InspectionTypeConfig = {
  routine: { icon: '🔍', description: 'Regular scheduled fire safety inspection', typical_frequency: 'monthly', priority: 'medium' },
  compliance: { icon: '📋', description: 'Regulatory compliance inspection', typical_frequency: 'annual', priority: 'high' },
  follow_up: { icon: '🔄', description: 'Follow-up inspection for previous issues', typical_frequency: 'as_needed', priority: 'high' },
  emergency: { icon: '🚨', description: 'Emergency inspection due to incident or concern', typical_frequency: 'immediate', priority: 'critical' },
  annual: { icon: '📅', description: 'Annual comprehensive fire safety inspection', typical_frequency: 'yearly', priority: 'high' },
  quarterly: { icon: '📊', description: 'Quarterly fire systems inspection', typical_frequency: 'quarterly', priority: 'medium' },
  monthly: { icon: '🗓️', description: 'Monthly routine inspection', typical_frequency: 'monthly', priority: 'medium' }
}

const localizedContent: LocalizedInspectionContent = {
  en: {
    inspector: 'Inspector', scheduled: 'Scheduled', deadline: 'Deadline', duration: 'Duration',
    areas: 'Areas to Inspect', checklist: 'Inspection Checklist', preparation: 'Preparation Required',
    documents: 'Required Documents', contact: 'Contact Information', access: 'Access Requirements',
    compliance: 'Compliance Standard', previousInspection: 'Previous Inspection', nextInspection: 'Next Inspection Due',
    results: 'Inspection Results', status: 'Status', criticalIssues: 'Critical Issues', minorIssues: 'Minor Issues',
    recommendations: 'Recommendations', followUpRequired: 'Follow-up Required', followUpDeadline: 'Follow-up Deadline',
    complianceStatus: 'Compliance Status', certificateIssued: 'Certificate Issued', reschedule: 'Reschedule',
    confirm: 'Confirm', viewReport: 'View Report', downloadCertificate: 'Download Certificate'
  },
  zh: {
    inspector: '检查员', scheduled: '计划时间', deadline: '截止日期', duration: '持续时间',
    areas: '检查区域', checklist: '检查清单', preparation: '准备工作', documents: '所需文件',
    contact: '联系信息', access: '访问要求', compliance: '合规标准', previousInspection: '上次检查',
    nextInspection: '下次检查到期', results: '检查结果', status: '状态', criticalIssues: '严重问题',
    minorIssues: '次要问题', recommendations: '建议', followUpRequired: '需要跟进',
    followUpDeadline: '跟进截止日期', complianceStatus: '合规状态', certificateIssued: '证书已签发',
    reschedule: '重新安排', confirm: '确认', viewReport: '查看报告', downloadCertificate: '下载证书'
  }
}

const statusConfig: InspectionStatusConfig = {
  passed: { color: '#4CAF50', icon: '✅', message_en: 'Inspection passed successfully', message_zh: '检查通过' },
  passed_with_notes: { color: '#FF9800', icon: '✅⚠️', message_en: 'Inspection passed with minor observations', message_zh: '检查通过但有轻微问题' },
  failed: { color: '#F44336', icon: '❌', message_en: 'Inspection failed - issues must be addressed', message_zh: '检查未通过 - 必须解决问题' },
  pending_review: { color: '#2196F3', icon: '🔄', message_en: 'Inspection results pending review', message_zh: '检查结果待审核' }
}

const complianceConfig: ComplianceStatusConfig = {
  compliant: { color: '#4CAF50', icon: '✅', message_en: 'Fully compliant with regulations', message_zh: '完全符合法规要求' },
  non_compliant: { color: '#F44336', icon: '❌', message_en: 'Non-compliant - immediate action required', message_zh: '不合规 - 需要立即采取行动' },
  partially_compliant: { color: '#FF9800', icon: '⚠️', message_en: 'Partially compliant - improvements needed', message_zh: '部分合规 - 需要改进' }
}

export const defaultFireInspectionWorkflow = workflow(
  'default-fire-inspection',
  async ({ step, payload }) => {
    const notificationConfig = notificationTypeConfig[payload.notificationType]
    const inspectionConfig = inspectionTypeConfig[payload.inspectionType]
    const content = localizedContent[payload.language]
    
    const formattedDate = new Date(payload.scheduledDate).toLocaleDateString(
      payload.language === 'zh' ? 'zh-CN' : 'en-US',
      { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' }
    )
    
    const formattedTime = payload.scheduledTime

    // Helper functions
    const getSubjectLine = () => {
      const prefix = payload.language === 'zh' 
        ? (payload.notificationType === 'assignment' ? '消防检查分配' :
           payload.notificationType === 'reminder' ? '消防检查提醒' :
           payload.notificationType === 'overdue' ? '消防检查逾期' :
           payload.notificationType === 'completion' ? '消防检查完成' :
           payload.notificationType === 'results' ? '消防检查结果' : '消防检查需要跟进')
        : notificationConfig.subject_prefix
      
      return `${notificationConfig.icon} ${prefix}: ${payload.inspectionTitle} - ${payload.buildingName}`
    }

    const isUrgentNotification = () => {
      return payload.notificationType === 'overdue' || 
             (payload.notificationType === 'results' && payload.inspectionResults?.criticalIssues && payload.inspectionResults.criticalIssues.length > 0) ||
             payload.inspectionType === 'emergency'
    }

    // Conditional SMS step for urgent notifications
    if (isUrgentNotification()) {
      await step.sms(
        'send-inspection-sms',
        async (controls) => {
          if (!controls.enableSMS) return { body: '' }
          if (payload.notificationType === 'overdue' && !controls.overdueChannels.includes('sms')) return { body: '' }
          
          const urgencyText = payload.notificationType === 'overdue' ? 
            (payload.language === 'zh' ? '⚠️ 消防检查逾期' : '⚠️ Fire Inspection Overdue') :
            (payload.language === 'zh' ? '🚨 消防检查紧急' : '🚨 Fire Inspection Urgent')
          
          const smsBody = payload.language === 'zh' 
            ? `${urgencyText}\n检查: ${payload.inspectionTitle}\n建筑: ${payload.buildingName}\n日期: ${formattedDate}\n检查员: ${payload.inspectorName} ${payload.inspectorPhone}`
            : `${urgencyText}\nInspection: ${payload.inspectionTitle}\nBuilding: ${payload.buildingName}\nDate: ${formattedDate}\nInspector: ${payload.inspectorName} ${payload.inspectorPhone}`

          return {
            body: smsBody.substring(0, 160) // SMS length limit
          }
        },
        { controlSchema }
      )
    }

    // Push notification step
    await step.push(
      'send-inspection-push',
      async (controls) => {
        if (!controls.enablePush) return { subject: '', body: '' }
        
        // Check if push is enabled for this notification type
        const enabledForType = (
          (payload.notificationType === 'assignment' && controls.assignmentChannels.includes('push')) ||
          (payload.notificationType === 'reminder' && controls.reminderChannels.includes('push')) ||
          (payload.notificationType === 'overdue' && controls.overdueChannels.includes('push')) ||
          (payload.notificationType === 'completion' && false) || // Completion typically not via push
          (payload.notificationType === 'results' && false) || // Results typically not via push
          (payload.notificationType === 'follow_up_required')
        )
        
        if (!enabledForType) return { subject: '', body: '' }
        
        return {
          subject: getSubjectLine(),
          body: payload.language === 'zh'
            ? `${payload.inspectionTitle}\n建筑: ${payload.buildingName}\n${formattedDate} ${formattedTime}\n检查员: ${payload.inspectorName}`
            : `${payload.inspectionTitle}\nBuilding: ${payload.buildingName}\n${formattedDate} ${formattedTime}\nInspector: ${payload.inspectorName}`,
          data: {
            inspectionType: payload.inspectionType,
            notificationType: payload.notificationType,
            buildingName: payload.buildingName,
            inspectionId: payload.inspectionId,
            urgent: isUrgentNotification()
          }
        }
      },
      { controlSchema }
    )

    // In-App notification step
    await step.inApp(
      'send-inspection-inapp',
      async (controls) => {
        if (!controls.enableInApp) return { subject: '', body: '' }
        
        let bodyText = ''
        if (payload.notificationType === 'results' && payload.inspectionResults) {
          const statusInfo = statusConfig[payload.inspectionResults.overallStatus || 'pending_review']
          bodyText = payload.language === 'zh'
            ? `检查结果: ${payload.inspectionTitle}\n建筑: ${payload.buildingName}\n状态: ${statusInfo.message_zh}\n完成日期: ${payload.inspectionResults.completionDate}`
            : `Inspection Results: ${payload.inspectionTitle}\nBuilding: ${payload.buildingName}\nStatus: ${statusInfo.message_en}\nCompleted: ${payload.inspectionResults.completionDate}`
        } else {
          bodyText = payload.language === 'zh'
            ? `消防检查: ${payload.inspectionTitle}\n建筑: ${payload.buildingName}\n时间: ${formattedDate} ${formattedTime}\n检查员: ${payload.inspectorName}\n区域: ${payload.inspectionAreas.join(', ')}`
            : `Fire Inspection: ${payload.inspectionTitle}\nBuilding: ${payload.buildingName}\nTime: ${formattedDate} ${formattedTime}\nInspector: ${payload.inspectorName}\nAreas: ${payload.inspectionAreas.join(', ')}`
        }
        
        return {
          subject: getSubjectLine(),
          body: bodyText,
          data: {
            inspectionType: payload.inspectionType,
            notificationType: payload.notificationType,
            buildingName: payload.buildingName,
            inspectionId: payload.inspectionId,
            scheduledDate: payload.scheduledDate,
            scheduledTime: payload.scheduledTime
          }
        }
      },
      { controlSchema }
    )

    // Email step - Primary detailed notification
    await step.email(
      'send-inspection-email',
      async (controls) => {
        if (!controls.enableEmail) return { subject: '', body: '' }
        
        // Build checklist HTML
        const checklistHtml = controls.includeChecklist && payload.checklistItems.length > 0
          ? `<div style="margin: 20px 0; padding: 15px; background: #e3f2fd; border: 1px solid #2196f3; border-radius: 4px;">
               <h3 style="margin: 0 0 10px 0; color: #1976d2;">${content.checklist}</h3>
               <ul style="margin: 0; padding-left: 20px; color: #555;">
                 ${payload.checklistItems.map(item => `<li style="margin: 5px 0;">${item}</li>`).join('')}
               </ul>
               ${payload.checklistUrl ? `<p style="margin: 10px 0 0 0;"><a href="${payload.checklistUrl}" target="_blank" style="color: #1976d2; text-decoration: underline;">${payload.language === 'zh' ? '查看完整清单' : 'View Full Checklist'}</a></p>` : ''}
             </div>`
          : ''
        
        // Build inspector contact HTML
        const inspectorContactHtml = controls.includeInspectorContact
          ? `<div style="margin: 20px 0; padding: 15px; background: #f3e5f5; border: 1px solid #9c27b0; border-radius: 4px;">
               <h3 style="margin: 0 0 10px 0; color: #7b1fa2;">${content.inspector} ${content.contact}</h3>
               <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '姓名' : 'Name'}:</strong> ${payload.inspectorName}</p>
               <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '组织' : 'Organization'}:</strong> ${payload.inspectorOrganization}</p>
               <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '电话' : 'Phone'}:</strong> <a href="tel:${payload.inspectorPhone}" style="color: #7b1fa2;">${payload.inspectorPhone}</a></p>
               <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '邮箱' : 'Email'}:</strong> <a href="mailto:${payload.inspectorEmail}" style="color: #7b1fa2;">${payload.inspectorEmail}</a></p>
               ${payload.inspectorCertification ? `<p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '认证' : 'Certification'}:</strong> ${payload.inspectorCertification}</p>` : ''}
             </div>`
          : ''
        
        // Build preparation tasks HTML
        const preparationTasksHtml = controls.includePreparationTasks && payload.preparationTasks && payload.preparationTasks.length > 0
          ? `<div style="margin: 20px 0; padding: 15px; background: #fff8e1; border: 1px solid #ffb74d; border-radius: 4px;">
               <h3 style="margin: 0 0 10px 0; color: #f57c00;">${content.preparation}</h3>
               <ul style="margin: 0; padding-left: 20px; color: #555;">
                 ${payload.preparationTasks.map(task => `<li style="margin: 5px 0;">${task}</li>`).join('')}
               </ul>
               ${payload.requiredDocuments && payload.requiredDocuments.length > 0 ? `
                 <h4 style="margin: 15px 0 5px 0; color: #f57c00;">${content.documents}</h4>
                 <ul style="margin: 0; padding-left: 20px; color: #555;">
                   ${payload.requiredDocuments.map(doc => `<li style="margin: 5px 0;">${doc}</li>`).join('')}
                 </ul>
               ` : ''}
             </div>`
          : ''
        
        // Build compliance info HTML
        const complianceInfoHtml = controls.includeComplianceInfo && payload.regulatoryStandard
          ? `<div style="margin: 20px 0; padding: 15px; background: #e8f5e8; border: 1px solid #4caf50; border-radius: 4px;">
               <h3 style="margin: 0 0 10px 0; color: #388e3c;">${content.compliance}</h3>
               <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '标准' : 'Standard'}:</strong> ${payload.regulatoryStandard}</p>
               ${payload.complianceDeadline ? `<p style="margin: 5px 0;"><strong>${content.deadline}:</strong> ${new Date(payload.complianceDeadline).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>` : ''}
               ${payload.certificateType ? `<p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '证书类型' : 'Certificate Type'}:</strong> ${payload.certificateType}</p>` : ''}
             </div>`
          : ''
        
        // Build results HTML for results notifications
        const resultsHtml = payload.notificationType === 'results' && payload.inspectionResults
          ? `<div style="margin: 20px 0;">
               <h2 style="color: ${controls.brandColor}; margin-bottom: 15px;">${content.results}</h2>
               
               ${payload.inspectionResults.overallStatus ? `
                 <div style="background: ${statusConfig[payload.inspectionResults.overallStatus].color}15; border-left: 4px solid ${statusConfig[payload.inspectionResults.overallStatus].color}; padding: 15px; margin: 15px 0;">
                   <h3 style="margin: 0 0 10px 0; color: ${statusConfig[payload.inspectionResults.overallStatus].color};">
                     ${statusConfig[payload.inspectionResults.overallStatus].icon} ${content.status}
                   </h3>
                   <p style="margin: 0; font-weight: bold;">${payload.language === 'zh' ? statusConfig[payload.inspectionResults.overallStatus].message_zh : statusConfig[payload.inspectionResults.overallStatus].message_en}</p>
                 </div>
               ` : ''}
               
               <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0;">
                 <h3 style="margin: 0 0 10px 0; color: #333;">${payload.language === 'zh' ? '检查详情' : 'Inspection Details'}</h3>
                 ${payload.inspectionResults.completionDate ? `<p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '完成日期' : 'Completion Date'}:</strong> ${new Date(payload.inspectionResults.completionDate).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>` : ''}
                 ${payload.inspectionResults.recommendationsCount ? `<p style="margin: 5px 0;"><strong>${content.recommendations}:</strong> ${payload.inspectionResults.recommendationsCount}</p>` : ''}
                 ${payload.inspectionResults.complianceStatus ? `<p style="margin: 5px 0;"><strong>${content.complianceStatus}:</strong> ${complianceConfig[payload.inspectionResults.complianceStatus].icon} ${payload.language === 'zh' ? complianceConfig[payload.inspectionResults.complianceStatus].message_zh : complianceConfig[payload.inspectionResults.complianceStatus].message_en}</p>` : ''}
                 ${payload.inspectionResults.certificateIssued ? `<p style="margin: 5px 0;"><strong>${content.certificateIssued}:</strong> ${payload.inspectionResults.certificateIssued ? (payload.language === 'zh' ? '是' : 'Yes') : (payload.language === 'zh' ? '否' : 'No')}</p>` : ''}
               </div>
               
               ${payload.inspectionResults.criticalIssues && payload.inspectionResults.criticalIssues.length > 0 ? `
                 <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 15px 0;">
                   <h3 style="margin: 0 0 10px 0; color: #d32f2f;">${content.criticalIssues}</h3>
                   <ul style="margin: 0; padding-left: 20px;">
                     ${payload.inspectionResults.criticalIssues.map(issue => `<li style="margin: 5px 0; color: #d32f2f;">${issue}</li>`).join('')}
                   </ul>
                 </div>
               ` : ''}
               
               ${payload.inspectionResults.minorIssues && payload.inspectionResults.minorIssues.length > 0 ? `
                 <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0;">
                   <h3 style="margin: 0 0 10px 0; color: #f57c00;">${content.minorIssues}</h3>
                   <ul style="margin: 0; padding-left: 20px;">
                     ${payload.inspectionResults.minorIssues.map(issue => `<li style="margin: 5px 0; color: #f57c00;">${issue}</li>`).join('')}
                   </ul>
                 </div>
               ` : ''}
               
               ${payload.inspectionResults.followUpRequired ? `
                 <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 15px 0;">
                   <h3 style="margin: 0 0 10px 0; color: #1976d2;">🔄 ${content.followUpRequired}</h3>
                   ${payload.inspectionResults.followUpDeadline ? `<p style="margin: 5px 0;"><strong>${content.followUpDeadline}:</strong> ${new Date(payload.inspectionResults.followUpDeadline).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>` : ''}
                 </div>
               ` : ''}
             </div>`
          : ''

        // Build action buttons
        const actionButtonsHtml = `
          <div style="text-align: center; margin: 30px 0;">
            ${controls.requirePreInspectionConfirmation && controls.confirmationUrl && payload.notificationType === 'assignment' ? `
              <a href="${controls.confirmationUrl}?inspectionId=${payload.inspectionId}" 
                 style="display: inline-block; margin: 5px; padding: 12px 24px; background-color: ${controls.brandColor}; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                ${content.confirm} ${payload.language === 'zh' ? '检查' : 'Inspection'}
              </a>
            ` : ''}
            ${controls.enableRescheduling && controls.rescheduleUrl && (payload.notificationType === 'assignment' || payload.notificationType === 'reminder') ? `
              <a href="${controls.rescheduleUrl}?inspectionId=${payload.inspectionId}" 
                 style="display: inline-block; margin: 5px; padding: 12px 24px; background-color: #757575; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                ${content.reschedule}
              </a>
            ` : ''}
            ${controls.autoGenerateReport && controls.reportGenerationUrl && payload.notificationType === 'results' ? `
              <a href="${controls.reportGenerationUrl}?inspectionId=${payload.inspectionId}" 
                 style="display: inline-block; margin: 5px; padding: 12px 24px; background-color: #2196f3; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                ${content.viewReport}
              </a>
            ` : ''}
            ${controls.certificateGenerationEnabled && controls.certificateTemplateUrl && payload.inspectionResults?.certificateIssued ? `
              <a href="${controls.certificateTemplateUrl}?inspectionId=${payload.inspectionId}" 
                 style="display: inline-block; margin: 5px; padding: 12px 24px; background-color: #4caf50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                ${content.downloadCertificate}
              </a>
            ` : ''}
          </div>
        `

        return {
          subject: getSubjectLine(),
          body: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${getSubjectLine()}</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
              <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="text-align: center; padding: 20px 0; border-bottom: 3px solid ${controls.brandColor};">
                  ${controls.logoUrl ? `<img src="${controls.logoUrl}" alt="${controls.organizationName}" style="max-height: 50px; margin-bottom: 10px;">` : ''}
                  <h1 style="margin: 10px 0 0 0; color: ${controls.brandColor};">${controls.organizationName}</h1>
                </div>
                
                <!-- Inspection Header -->
                <div style="text-align: center; padding: 20px 0; background: linear-gradient(135deg, ${controls.brandColor}15, ${controls.brandColor}05); margin: 20px -30px; border-radius: 8px;">
                  <h2 style="margin: 0; color: ${controls.brandColor}; font-size: 24px;">
                    ${inspectionConfig.icon} ${payload.language === 'zh' ? '消防检查通知' : 'Fire Inspection Notification'}
                  </h2>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">${inspectionConfig.description}</p>
                </div>
                
                <!-- Main Content -->
                <div style="padding: 20px 0;">
                  ${payload.recipientName ? `<p style="margin-bottom: 20px; font-size: 16px;">${payload.language === 'zh' ? '您好' : 'Dear'} ${payload.recipientName},</p>` : ''}
                  
                  <!-- Inspection Details -->
                  <div style="background: #fff3e0; border-left: 4px solid ${controls.brandColor}; padding: 15px; margin: 20px 0;">
                    <h3 style="margin: 0 0 15px 0; color: ${controls.brandColor};">${payload.language === 'zh' ? '检查详情' : 'Inspection Details'}</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${payload.language === 'zh' ? '检查名称' : 'Inspection Title'}:</td><td style="padding: 5px 0;">${payload.inspectionTitle}</td></tr>
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${payload.language === 'zh' ? '建筑' : 'Building'}:</td><td style="padding: 5px 0;">${payload.buildingName}</td></tr>
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${content.scheduled}:</td><td style="padding: 5px 0;">${formattedDate} ${formattedTime}</td></tr>
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${content.duration}:</td><td style="padding: 5px 0;">${payload.estimatedDuration}</td></tr>
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${payload.language === 'zh' ? '楼层' : 'Floors'}:</td><td style="padding: 5px 0;">${payload.floorsToInspect.join(', ')}</td></tr>
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${content.areas}:</td><td style="padding: 5px 0;">${payload.inspectionAreas.join(', ')}</td></tr>
                      ${payload.deadlineDate ? `<tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${content.deadline}:</td><td style="padding: 5px 0;">${new Date(payload.deadlineDate).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</td></tr>` : ''}
                    </table>
                  </div>
                  
                  ${payload.notificationType !== 'results' ? `
                    <!-- Purpose and Instructions -->
                    <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
                      <h3 style="margin: 0 0 10px 0; color: #1976d2;">${payload.language === 'zh' ? '检查目的' : 'Inspection Purpose'}</h3>
                      <div style="color: #555; line-height: 1.6; white-space: pre-wrap;">${payload.inspectionPurpose}</div>
                      ${payload.accessRequirements ? `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #90caf9;"><strong>${content.access}:</strong><br><span style="color: #555; white-space: pre-wrap;">${payload.accessRequirements}</span></div>` : ''}
                    </div>
                  ` : ''}
                  
                  ${resultsHtml}
                  ${preparationTasksHtml}
                  ${inspectorContactHtml}
                  ${checklistHtml}
                  ${complianceInfoHtml}
                  ${actionButtonsHtml}
                  
                  <!-- Additional Information -->
                  <div style="margin: 30px 0; padding: 15px; background: #fafafa; border-radius: 4px; font-size: 12px; color: #666;">
                    <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '检查编号' : 'Inspection ID'}:</strong> ${payload.inspectionId}</p>
                    ${payload.previousInspectionDate ? `<p style="margin: 5px 0;"><strong>${content.previousInspection}:</strong> ${new Date(payload.previousInspectionDate).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>` : ''}
                    ${payload.nextInspectionDue ? `<p style="margin: 5px 0;"><strong>${content.nextInspection}:</strong> ${new Date(payload.nextInspectionDue).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>` : ''}
                  </div>
                </div>
                
                <!-- Footer -->
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #666;">
                  <p>&copy; ${new Date().getFullYear()} ${controls.organizationName}. ${payload.language === 'zh' ? '版权所有' : 'All rights reserved'}.</p>
                  <p style="margin-top: 10px; color: ${controls.brandColor};">
                    ${payload.language === 'zh' ? '此为自动生成的消防检查通知' : 'This is an automated fire inspection notification'}
                  </p>
                </div>
              </div>
            </body>
            </html>
          `
        }
      },
      { controlSchema }
    )

    // Chat/Teams step for coordination
    await step.chat(
      'send-inspection-chat',
      async (controls) => {
        if (!controls.enableChat) return { body: '' }
        
        const chatMessage = payload.language === 'zh'
          ? `${notificationConfig.icon} **消防检查通知** ${inspectionConfig.icon}
**检查标题**: ${payload.inspectionTitle}
**建筑**: ${payload.buildingName}
**时间**: ${formattedDate} ${formattedTime}
**预计时长**: ${payload.estimatedDuration}
**楼层**: ${payload.floorsToInspect.join(', ')}
**区域**: ${payload.inspectionAreas.join(', ')}
**检查员**: ${payload.inspectorName} (${payload.inspectorPhone})
**目的**: ${payload.inspectionPurpose}

**检查编号**: ${payload.inspectionId}
${payload.checklistUrl ? `**检查清单**: ${payload.checklistUrl}` : ''}
${payload.procedureDocumentUrl ? `**程序文档**: ${payload.procedureDocumentUrl}` : ''}`
          : `${notificationConfig.icon} **Fire Inspection Notification** ${inspectionConfig.icon}
**Inspection**: ${payload.inspectionTitle}
**Building**: ${payload.buildingName}
**Time**: ${formattedDate} ${formattedTime}
**Duration**: ${payload.estimatedDuration}
**Floors**: ${payload.floorsToInspect.join(', ')}
**Areas**: ${payload.inspectionAreas.join(', ')}
**Inspector**: ${payload.inspectorName} (${payload.inspectorPhone})
**Purpose**: ${payload.inspectionPurpose}

**Inspection ID**: ${payload.inspectionId}
${payload.checklistUrl ? `**Checklist**: ${payload.checklistUrl}` : ''}
${payload.procedureDocumentUrl ? `**Procedure Document**: ${payload.procedureDocumentUrl}` : ''}`

        return {
          body: chatMessage
        }
      },
      { controlSchema }
    )
  },
  {
    payloadSchema,
    tags: ['fire-safety', 'inspection', 'compliance', 'multi-channel'],
    description: 'Comprehensive fire inspection workflow handling assignments, reminders, overdue notices, completion notifications, and results with professional templates and compliance tracking'
  }
)