import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { FireDrillPayload, FireDrillControls, DrillNotificationTypeConfig, DrillTypeConfig, LocalizedDrillContent } from './types'

const notificationTypeConfig: DrillNotificationTypeConfig = {
  advance_notice: { icon: '📋', urgency: 'normal', subject_prefix: 'Fire Drill Scheduled', tone: 'informational' },
  reminder: { icon: '⏰', urgency: 'medium', subject_prefix: 'Fire Drill Reminder', tone: 'reminder' },
  day_of: { icon: '🚨', urgency: 'high', subject_prefix: 'Fire Drill Today', tone: 'immediate' },
  results: { icon: '📊', urgency: 'normal', subject_prefix: 'Fire Drill Results', tone: 'informational' },
  cancellation: { icon: '❌', urgency: 'medium', subject_prefix: 'Fire Drill Cancelled', tone: 'important' }
}

const drillTypeConfig: DrillTypeConfig = {
  scheduled: { icon: '🗓️', description: 'Regular scheduled fire drill', mandatory: true },
  unannounced: { icon: '⚡', description: 'Surprise fire drill to test readiness', mandatory: true },
  mandatory: { icon: '📋', description: 'Required regulatory compliance drill', mandatory: true },
  training: { icon: '🎓', description: 'Educational fire safety training drill', mandatory: false }
}

const localizedContent: LocalizedDrillContent = {
  en: {
    mandatory: 'Mandatory',
    optional: 'Optional',
    allBuildings: 'All Buildings',
    assemblyPoint: 'Assembly Point',
    coordinator: 'Drill Coordinator',
    duration: 'Estimated Duration',
    participationRequired: 'Participation is required',
    participationOptional: 'Participation is optional',
    bringNothing: 'Leave personal items behind',
    useStairs: 'Use stairs only - elevators will be disabled',
    awaitInstructions: 'Await instructions at assembly point',
    returnAfterClearance: 'Return to building only after all-clear signal',
    contactForQuestions: 'Contact coordinator for questions',
    regulatoryCompliance: 'This drill fulfills regulatory requirements',
    previousDrill: 'Previous Drill',
    nextDrill: 'Next Drill',
    improvementAreas: 'Areas for Improvement',
    recommendations: 'Recommendations'
  },
  zh: {
    mandatory: '必须参加',
    optional: '可选参加',
    allBuildings: '所有建筑',
    assemblyPoint: '集合点',
    coordinator: '演练协调员',
    duration: '预计时长',
    participationRequired: '必须参加',
    participationOptional: '可选参加',
    bringNothing: '请勿携带个人物品',
    useStairs: '仅使用楼梯 - 电梯将被禁用',
    awaitInstructions: '在集合点等待指示',
    returnAfterClearance: '仅在收到安全信号后返回建筑',
    contactForQuestions: '如有疑问请联系协调员',
    regulatoryCompliance: '此演练符合法规要求',
    previousDrill: '上次演练',
    nextDrill: '下次演练',
    improvementAreas: '改进领域',
    recommendations: '建议'
  }
}

export const defaultFireDrillWorkflow = workflow(
  'default-fire-drill',
  async ({ step, payload }) => {
    const notificationConfig = notificationTypeConfig[payload.notificationType]
    const drillConfig = drillTypeConfig[payload.drillType]
    const content = localizedContent[payload.language]
    
    const formattedDate = new Date(payload.scheduledDate).toLocaleDateString(
      payload.language === 'zh' ? 'zh-CN' : 'en-US',
      { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' }
    )
    
    const formattedTime = payload.scheduledTime

    // Helper functions
    const getSubjectLine = () => {
      const prefix = payload.language === 'zh' 
        ? (payload.notificationType === 'advance_notice' ? '消防演练通知' :
           payload.notificationType === 'reminder' ? '消防演练提醒' :
           payload.notificationType === 'day_of' ? '消防演练今日进行' :
           payload.notificationType === 'results' ? '消防演练结果' : '消防演练取消')
        : notificationConfig.subject_prefix
      
      return `${notificationConfig.icon} ${prefix}: ${payload.drillName} - ${payload.buildingName}`
    }

    const getParticipationStatus = () => {
      return drillConfig.mandatory 
        ? (payload.language === 'zh' ? content.participationRequired : content.participationRequired)
        : (payload.language === 'zh' ? content.participationOptional : content.participationOptional)
    }

    // Conditional SMS step for reminders and day-of notifications
    if (payload.notificationType === 'reminder' || payload.notificationType === 'day_of') {
      await step.sms(
        'send-drill-sms',
        async (controls: FireDrillControls) => {
          if (!controls.enableSMS) return { body: '' }
          if (payload.notificationType === 'reminder' && !controls.reminderChannels.includes('sms')) return { body: '' }
          if (payload.notificationType === 'day_of' && !controls.dayOfChannels.includes('sms')) return { body: '' }
          
          const urgencyText = payload.notificationType === 'day_of' ? 
            (payload.language === 'zh' ? '🚨 今日消防演练' : '🚨 Fire Drill Today') :
            (payload.language === 'zh' ? '⏰ 消防演练提醒' : '⏰ Fire Drill Reminder')
          
          const smsBody = payload.language === 'zh' 
            ? `${urgencyText}\n演练: ${payload.drillName}\n建筑: ${payload.buildingName}\n时间: ${formattedDate} ${formattedTime}\n集合点: ${payload.assemblyPoints.join(', ')}\n协调员: ${payload.drillCoordinator} ${payload.coordinatorPhone}`
            : `${urgencyText}\nDrill: ${payload.drillName}\nBuilding: ${payload.buildingName}\nTime: ${formattedDate} ${formattedTime}\nAssembly: ${payload.assemblyPoints.join(', ')}\nCoordinator: ${payload.drillCoordinator} ${payload.coordinatorPhone}`

          return {
            body: smsBody.substring(0, 160) // SMS length limit
          }
        },
        { controlSchema }
      )
    }

    // Push notification step
    await step.push(
      'send-drill-push',
      async (controls) => {
        if (!controls.enablePush) return { subject: '', body: '' }
        
        // Check if push is enabled for this notification type
        const enabledForType = (
          (payload.notificationType === 'advance_notice' && controls.advanceNoticeChannels.includes('push')) ||
          (payload.notificationType === 'reminder' && controls.reminderChannels.includes('push')) ||
          (payload.notificationType === 'day_of' && controls.dayOfChannels.includes('push')) ||
          (payload.notificationType === 'results' && false) || // Results typically not via push
          (payload.notificationType === 'cancellation')
        )
        
        if (!enabledForType) return { subject: '', body: '' }
        
        return {
          subject: getSubjectLine(),
          body: payload.language === 'zh'
            ? `${payload.drillName}\n建筑: ${payload.buildingName}\n${formattedDate} ${formattedTime}\n${getParticipationStatus()}`
            : `${payload.drillName}\nBuilding: ${payload.buildingName}\n${formattedDate} ${formattedTime}\n${getParticipationStatus()}`,
          data: {
            drillType: payload.drillType,
            notificationType: payload.notificationType,
            buildingName: payload.buildingName,
            drillId: payload.drillId,
            mandatory: drillConfig.mandatory
          }
        }
      },
      { controlSchema }
    )

    // In-App notification step
    await step.inApp(
      'send-drill-inapp',
      async (controls) => {
        if (!controls.enableInApp) return { subject: '', body: '' }
        
        return {
          subject: getSubjectLine(),
          body: payload.language === 'zh'
            ? `消防演练通知: ${payload.drillName}\n建筑: ${payload.buildingName}\n时间: ${formattedDate} ${formattedTime}\n预计时长: ${payload.estimatedDuration}\n集合点: ${payload.assemblyPoints.join(', ')}\n协调员: ${payload.drillCoordinator}\n${getParticipationStatus()}`
            : `Fire Drill Notice: ${payload.drillName}\nBuilding: ${payload.buildingName}\nTime: ${formattedDate} ${formattedTime}\nDuration: ${payload.estimatedDuration}\nAssembly Points: ${payload.assemblyPoints.join(', ')}\nCoordinator: ${payload.drillCoordinator}\n${getParticipationStatus()}`,
          data: {
            drillType: payload.drillType,
            notificationType: payload.notificationType,
            buildingName: payload.buildingName,
            drillId: payload.drillId,
            scheduledDate: payload.scheduledDate,
            scheduledTime: payload.scheduledTime
          }
        }
      },
      { controlSchema }
    )

    // Email step - Primary detailed notification
    await step.email(
      'send-drill-email',
      async (controls) => {
        if (!controls.enableEmail) return { subject: '', body: '' }
        
        // Build evacuation map HTML
        const evacuationMapHtml = controls.includeEvacuationMap && payload.drillMapUrl
          ? `<div style="margin: 20px 0; padding: 15px; background: #e3f2fd; border: 1px solid #2196f3; border-radius: 4px;">
               <h3 style="margin: 0 0 10px 0; color: #1976d2;">${payload.language === 'zh' ? '疏散路线图' : 'Evacuation Map'}</h3>
               <a href="${payload.drillMapUrl}" target="_blank" style="color: #1976d2; text-decoration: underline;">
                 ${payload.language === 'zh' ? '查看疏散路线图' : 'View Evacuation Route Map'}
               </a>
             </div>`
          : ''
        
        // Build coordinator contact HTML
        const coordinatorContactHtml = controls.includeCoordinatorContact
          ? `<div style="margin: 20px 0; padding: 15px; background: #f3e5f5; border: 1px solid #9c27b0; border-radius: 4px;">
               <h3 style="margin: 0 0 10px 0; color: #7b1fa2;">${content.coordinator}</h3>
               <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '姓名' : 'Name'}:</strong> ${payload.drillCoordinator}</p>
               <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '电话' : 'Phone'}:</strong> <a href="tel:${payload.coordinatorPhone}" style="color: #7b1fa2;">${payload.coordinatorPhone}</a></p>
               <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '邮箱' : 'Email'}:</strong> <a href="mailto:${payload.coordinatorEmail}" style="color: #7b1fa2;">${payload.coordinatorEmail}</a></p>
               <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">${content.contactForQuestions}</p>
             </div>`
          : ''
        
        // Build compliance info HTML
        const complianceInfoHtml = controls.includeComplianceInfo && payload.regulatoryCompliance
          ? `<div style="margin: 20px 0; padding: 15px; background: #e8f5e8; border: 1px solid #4caf50; border-radius: 4px;">
               <h3 style="margin: 0 0 10px 0; color: #388e3c;">${payload.language === 'zh' ? '法规合规' : 'Regulatory Compliance'}</h3>
               <p style="margin: 0; color: #555;">${content.regulatoryCompliance}: ${payload.regulatoryCompliance}</p>
             </div>`
          : ''
        
        // Build results HTML for results notifications
        const resultsHtml = payload.notificationType === 'results' && payload.drillResults
          ? `<div style="margin: 20px 0;">
               <h2 style="color: ${controls.brandColor}; margin-bottom: 15px;">${payload.language === 'zh' ? '演练结果' : 'Drill Results'}</h2>
               
               <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0;">
                 <h3 style="margin: 0 0 10px 0; color: #333;">${payload.language === 'zh' ? '总体表现' : 'Overall Performance'}</h3>
                 <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '状态' : 'Status'}:</strong> ${payload.drillResults.completed ? (payload.language === 'zh' ? '已完成' : 'Completed') : (payload.language === 'zh' ? '未完成' : 'Incomplete')}</p>
                 ${payload.drillResults.completionTime ? `<p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '完成时间' : 'Completion Time'}:</strong> ${payload.drillResults.completionTime}</p>` : ''}
                 ${payload.drillResults.participantCount ? `<p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '参与人数' : 'Participants'}:</strong> ${payload.drillResults.participantCount}</p>` : ''}
                 ${payload.drillResults.evacuationTime ? `<p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '疏散时间' : 'Evacuation Time'}:</strong> ${payload.drillResults.evacuationTime}</p>` : ''}
                 ${payload.drillResults.overallRating ? `<p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '总体评分' : 'Overall Rating'}:</strong> ${payload.drillResults.overallRating.toUpperCase()}</p>` : ''}
               </div>
               
               ${payload.drillResults.issuesIdentified && payload.drillResults.issuesIdentified.length > 0 ? `
                 <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0;">
                   <h3 style="margin: 0 0 10px 0; color: #f57c00;">${content.improvementAreas}</h3>
                   <ul style="margin: 0; padding-left: 20px;">
                     ${payload.drillResults.issuesIdentified.map(issue => `<li style="margin: 5px 0;">${issue}</li>`).join('')}
                   </ul>
                 </div>
               ` : ''}
               
               ${payload.drillResults.recommendations ? `
                 <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 15px 0;">
                   <h3 style="margin: 0 0 10px 0; color: #388e3c;">${content.recommendations}</h3>
                   <p style="margin: 0; color: #555; white-space: pre-wrap;">${payload.drillResults.recommendations}</p>
                 </div>
               ` : ''}
             </div>`
          : ''

        // Build participant info HTML
        const participantInfoHtml = payload.totalParticipants
          ? `<div style="margin: 20px 0; padding: 15px; background: #fff8e1; border: 1px solid #ffb74d; border-radius: 4px;">
               <h3 style="margin: 0 0 10px 0; color: #f57c00;">${payload.language === 'zh' ? '参与信息' : 'Participation Information'}</h3>
               <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '预期参与人数' : 'Expected Participants'}:</strong> ${payload.totalParticipants}</p>
               <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '参与状态' : 'Participation Status'}:</strong> ${getParticipationStatus()}</p>
               ${controls.requireParticipationConfirmation && controls.confirmationUrl ? `
                 <div style="margin: 15px 0; text-align: center;">
                   <a href="${controls.confirmationUrl}?drillId=${payload.drillId}" 
                      style="display: inline-block; padding: 10px 20px; background-color: ${controls.brandColor}; color: white; text-decoration: none; border-radius: 4px;">
                     ${payload.language === 'zh' ? '确认参与' : 'Confirm Participation'}
                   </a>
                 </div>
               ` : ''}
             </div>`
          : ''

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
                
                <!-- Drill Header -->
                <div style="text-align: center; padding: 20px 0; background: linear-gradient(135deg, ${controls.brandColor}15, ${controls.brandColor}05); margin: 20px -30px; border-radius: 8px;">
                  <h2 style="margin: 0; color: ${controls.brandColor}; font-size: 24px;">
                    ${drillConfig.icon} ${payload.language === 'zh' ? '消防演练通知' : 'Fire Drill Notification'}
                  </h2>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">${drillConfig.description}</p>
                </div>
                
                <!-- Main Content -->
                <div style="padding: 20px 0;">
                  ${payload.recipientName ? `<p style="margin-bottom: 20px; font-size: 16px;">${payload.language === 'zh' ? '您好' : 'Dear'} ${payload.recipientName},</p>` : ''}
                  
                  <!-- Drill Details -->
                  <div style="background: #fff3e0; border-left: 4px solid ${controls.brandColor}; padding: 15px; margin: 20px 0;">
                    <h3 style="margin: 0 0 15px 0; color: ${controls.brandColor};">${payload.language === 'zh' ? '演练详情' : 'Drill Details'}</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${payload.language === 'zh' ? '演练名称' : 'Drill Name'}:</td><td style="padding: 5px 0;">${payload.drillName}</td></tr>
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${payload.language === 'zh' ? '建筑' : 'Building'}:</td><td style="padding: 5px 0;">${payload.buildingName}</td></tr>
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${payload.language === 'zh' ? '日期' : 'Date'}:</td><td style="padding: 5px 0;">${formattedDate}</td></tr>
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${payload.language === 'zh' ? '时间' : 'Time'}:</td><td style="padding: 5px 0;">${formattedTime}</td></tr>
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${content.duration}:</td><td style="padding: 5px 0;">${payload.estimatedDuration}</td></tr>
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${payload.language === 'zh' ? '涉及楼层' : 'Floors'}:</td><td style="padding: 5px 0;">${payload.floorsCovered.join(', ')}</td></tr>
                      <tr><td style="padding: 5px 0; font-weight: bold; color: #555;">${content.assemblyPoint}:</td><td style="padding: 5px 0;">${payload.assemblyPoints.join(', ')}</td></tr>
                    </table>
                  </div>
                  
                  ${payload.notificationType !== 'results' ? `
                    <!-- Instructions -->
                    <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
                      <h3 style="margin: 0 0 10px 0; color: #1976d2;">${payload.language === 'zh' ? '演练说明' : 'Drill Instructions'}</h3>
                      <div style="color: #555; line-height: 1.6; white-space: pre-wrap;">${payload.drillInstructions}</div>
                      ${payload.specialInstructions ? `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #90caf9;"><strong>${payload.language === 'zh' ? '特殊说明' : 'Special Instructions'}:</strong><br><span style="color: #555; white-space: pre-wrap;">${payload.specialInstructions}</span></div>` : ''}
                    </div>
                    
                    <!-- Safety Guidelines -->
                    <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
                      <h3 style="margin: 0 0 10px 0; color: #388e3c;">${payload.language === 'zh' ? '安全指引' : 'Safety Guidelines'}</h3>
                      <ul style="margin: 0; padding-left: 20px; color: #555;">
                        <li>${content.bringNothing}</li>
                        <li>${content.useStairs}</li>
                        <li>${content.awaitInstructions}</li>
                        <li>${content.returnAfterClearance}</li>
                        ${payload.accessibilityNotes ? `<li><strong>${payload.language === 'zh' ? '无障碍说明' : 'Accessibility'}:</strong> ${payload.accessibilityNotes}</li>` : ''}
                        ${payload.weatherBackupPlan ? `<li><strong>${payload.language === 'zh' ? '天气预案' : 'Weather Backup'}:</strong> ${payload.weatherBackupPlan}</li>` : ''}
                      </ul>
                    </div>
                  ` : ''}
                  
                  ${resultsHtml}
                  ${participantInfoHtml}
                  ${coordinatorContactHtml}
                  ${evacuationMapHtml}
                  ${complianceInfoHtml}
                  
                  <!-- Additional Information -->
                  ${payload.previousDrillDate || payload.nextDrillDate ? `
                    <div style="margin: 30px 0; padding: 15px; background: #fafafa; border-radius: 4px; font-size: 12px; color: #666;">
                      ${payload.previousDrillDate ? `<p style="margin: 5px 0;"><strong>${content.previousDrill}:</strong> ${new Date(payload.previousDrillDate).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>` : ''}
                      ${payload.nextDrillDate ? `<p style="margin: 5px 0;"><strong>${content.nextDrill}:</strong> ${new Date(payload.nextDrillDate).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>` : ''}
                      <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '演练编号' : 'Drill ID'}:</strong> ${payload.drillId}</p>
                    </div>
                  ` : ''}
                </div>
                
                <!-- Footer -->
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #666;">
                  <p>&copy; ${new Date().getFullYear()} ${controls.organizationName}. ${payload.language === 'zh' ? '版权所有' : 'All rights reserved'}.</p>
                  <p style="margin-top: 10px; color: ${controls.brandColor};">
                    ${payload.language === 'zh' ? '此为自动生成的消防演练通知' : 'This is an automated fire drill notification'}
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
      'send-drill-chat',
      async (controls) => {
        if (!controls.enableChat) return { body: '' }
        if (payload.notificationType === 'day_of' && !controls.dayOfChannels.includes('chat')) return { body: '' }
        
        const chatMessage = payload.language === 'zh'
          ? `${notificationConfig.icon} **消防演练通知** ${drillConfig.icon}
**演练名称**: ${payload.drillName}
**建筑**: ${payload.buildingName}
**时间**: ${formattedDate} ${formattedTime}
**预计时长**: ${payload.estimatedDuration}
**楼层**: ${payload.floorsCovered.join(', ')}
**集合点**: ${payload.assemblyPoints.join(', ')}
**协调员**: ${payload.drillCoordinator} (${payload.coordinatorPhone})
**演练目的**: ${payload.drillPurpose}

**演练编号**: ${payload.drillId}
${payload.drillMapUrl ? `**疏散地图**: ${payload.drillMapUrl}` : ''}
${payload.procedureDocumentUrl ? `**程序文档**: ${payload.procedureDocumentUrl}` : ''}`
          : `${notificationConfig.icon} **Fire Drill Notification** ${drillConfig.icon}
**Drill Name**: ${payload.drillName}
**Building**: ${payload.buildingName}
**Time**: ${formattedDate} ${formattedTime}
**Duration**: ${payload.estimatedDuration}
**Floors**: ${payload.floorsCovered.join(', ')}
**Assembly Points**: ${payload.assemblyPoints.join(', ')}
**Coordinator**: ${payload.drillCoordinator} (${payload.coordinatorPhone})
**Purpose**: ${payload.drillPurpose}

**Drill ID**: ${payload.drillId}
${payload.drillMapUrl ? `**Evacuation Map**: ${payload.drillMapUrl}` : ''}
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
    tags: ['fire-safety', 'drill', 'training', 'multi-channel'],
    description: 'Comprehensive fire drill notification workflow handling scheduled drills, reminders, day-of notifications, and results with professional templates'
  }
)