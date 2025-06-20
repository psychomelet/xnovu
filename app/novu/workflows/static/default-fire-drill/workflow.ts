import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { FireDrillPayload, FireDrillControls, DrillNotificationTypeConfig, DrillTypeConfig, LocalizedDrillContent } from './types'
import { renderFireDrillEmail } from '../../../emails/workflows'

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

    // SMS step for reminders and day-of notifications
    await step.sms(
      'send-drill-sms',
      async (controls: FireDrillControls) => {
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
      { 
        controlSchema,
        skip: (controls) => {
          if (!controls.enableSMS) return true
          if (!(payload.notificationType === 'reminder' || payload.notificationType === 'day_of')) return true
          if (payload.notificationType === 'reminder' && !controls.reminderChannels.includes('sms')) return true
          if (payload.notificationType === 'day_of' && !controls.dayOfChannels.includes('sms')) return true
          return false
        }
      }
    )

    // Push notification step
    await step.push(
      'send-drill-push',
      async (controls) => {
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
      { 
        controlSchema,
        skip: (controls) => {
          if (!controls.enablePush) return true
          const enabledForType = (
            (payload.notificationType === 'advance_notice' && controls.advanceNoticeChannels.includes('push')) ||
            (payload.notificationType === 'reminder' && controls.reminderChannels.includes('push')) ||
            (payload.notificationType === 'day_of' && controls.dayOfChannels.includes('push')) ||
            (payload.notificationType === 'results' && false) || // Results typically not via push
            (payload.notificationType === 'cancellation')
          )
          return !enabledForType
        }
      }
    )

    // In-App notification step
    await step.inApp(
      'send-drill-inapp',
      async (controls) => {
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
      { 
        controlSchema,
        skip: (controls) => !controls.enableInApp
      }
    )

    // Email step - Primary detailed notification
    await step.email(
      'send-drill-email',
      async (controls) => {
        
        const subjectLine = getSubjectLine()
        
        // Build event details
        const eventDetails: Record<string, string> = {
          [payload.language === 'zh' ? '演练名称' : 'Drill Name']: payload.drillName,
          [payload.language === 'zh' ? '建筑' : 'Building']: payload.buildingName,
          [payload.language === 'zh' ? '日期' : 'Date']: formattedDate,
          [payload.language === 'zh' ? '时间' : 'Time']: formattedTime,
          [content.duration]: payload.estimatedDuration,
          [payload.language === 'zh' ? '涉及楼层' : 'Floors']: payload.floorsCovered.join(', '),
          [content.assemblyPoint]: payload.assemblyPoints.join(', ')
        }
        
        // Build instructions list
        const instructions: string[] = []
        if (payload.notificationType !== 'results') {
          instructions.push(payload.drillInstructions)
          if (payload.specialInstructions) {
            instructions.push(`${payload.language === 'zh' ? '特殊说明' : 'Special Instructions'}: ${payload.specialInstructions}`)
          }
        }
        
        // Build safety guidelines
        const safetyGuidelines: string[] = [
          content.bringNothing,
          content.useStairs,
          content.awaitInstructions,
          content.returnAfterClearance
        ]
        if (payload.accessibilityNotes) {
          safetyGuidelines.push(`${payload.language === 'zh' ? '无障碍说明' : 'Accessibility'}: ${payload.accessibilityNotes}`)
        }
        if (payload.weatherBackupPlan) {
          safetyGuidelines.push(`${payload.language === 'zh' ? '天气预案' : 'Weather Backup'}: ${payload.weatherBackupPlan}`)
        }
        
        // Build secondary actions
        const secondaryActions: Array<{ text: string; url: string }> = []
        if (controls.requireParticipationConfirmation && controls.confirmationUrl && payload.totalParticipants) {
          secondaryActions.push({
            text: payload.language === 'zh' ? '确认参与' : 'Confirm Participation',
            url: `${controls.confirmationUrl}?drillId=${payload.drillId}`
          })
        }
        if (controls.includeEvacuationMap && payload.drillMapUrl) {
          secondaryActions.push({
            text: payload.language === 'zh' ? '查看疏散路线图' : 'View Evacuation Route Map',
            url: payload.drillMapUrl
          })
        }
        
        // Build message based on notification type
        let message = ''
        let additionalDetails: Record<string, string> = {}
        
        if (payload.notificationType === 'results' && payload.drillResults) {
          // Results message
          message = payload.language === 'zh' 
            ? '消防演练已完成，以下是演练结果和反馈。' 
            : 'The fire drill has been completed. Below are the results and feedback.'
          
          additionalDetails = {
            [payload.language === 'zh' ? '状态' : 'Status']: payload.drillResults.completed ? (payload.language === 'zh' ? '已完成' : 'Completed') : (payload.language === 'zh' ? '未完成' : 'Incomplete'),
            ...(payload.drillResults.completionTime && { [payload.language === 'zh' ? '完成时间' : 'Completion Time']: payload.drillResults.completionTime }),
            ...(payload.drillResults.participantCount && { [payload.language === 'zh' ? '参与人数' : 'Participants']: payload.drillResults.participantCount.toString() }),
            ...(payload.drillResults.evacuationTime && { [payload.language === 'zh' ? '疏散时间' : 'Evacuation Time']: payload.drillResults.evacuationTime }),
            ...(payload.drillResults.overallRating && { [payload.language === 'zh' ? '总体评分' : 'Overall Rating']: payload.drillResults.overallRating.toUpperCase() })
          }
          
          if (payload.drillResults.issuesIdentified && payload.drillResults.issuesIdentified.length > 0) {
            additionalDetails[content.improvementAreas] = payload.drillResults.issuesIdentified.join('\n')
          }
          if (payload.drillResults.recommendations) {
            additionalDetails[content.recommendations] = payload.drillResults.recommendations
          }
        } else {
          // Regular notification message
          message = payload.language === 'zh'
            ? `${drillConfig.mandatory ? '必须参加的' : '可选参加的'}消防演练已安排。请查看以下详情并做好准备。`
            : `A ${drillConfig.mandatory ? 'mandatory' : 'optional'} fire drill has been scheduled. Please review the details below and prepare accordingly.`
          
          if (payload.totalParticipants) {
            additionalDetails[payload.language === 'zh' ? '预期参与人数' : 'Expected Participants'] = payload.totalParticipants.toString()
            additionalDetails[payload.language === 'zh' ? '参与状态' : 'Participation Status'] = getParticipationStatus()
          }
        }
        
        // Add coordinator contact
        if (controls.includeCoordinatorContact) {
          additionalDetails[content.coordinator] = `${payload.drillCoordinator} (${payload.coordinatorPhone})`
          if (payload.coordinatorEmail) {
            additionalDetails[payload.language === 'zh' ? '协调员邮箱' : 'Coordinator Email'] = payload.coordinatorEmail
          }
        }
        
        // Add compliance info
        if (controls.includeComplianceInfo && payload.regulatoryCompliance) {
          additionalDetails[payload.language === 'zh' ? '法规合规' : 'Regulatory Compliance'] = payload.regulatoryCompliance
        }
        
        // Add drill history
        if (payload.previousDrillDate) {
          additionalDetails[content.previousDrill] = new Date(payload.previousDrillDate).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')
        }
        if (payload.nextDrillDate) {
          additionalDetails[content.nextDrill] = new Date(payload.nextDrillDate).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')
        }
        
        const body = await renderFireDrillEmail({
          subject: subjectLine,
          recipientName: payload.recipientName,
          organizationName: controls.organizationName,
          logoUrl: controls.logoUrl,
          primaryColor: controls.brandColor,
          drillTitle: `${drillConfig.icon} ${payload.language === 'zh' ? '消防演练通知' : 'Fire Drill Notification'}`,
          drillMessage: message,
          drillDate: formattedDate,
          drillTime: payload.scheduledTime,
          estimatedDuration: payload.estimatedDuration,
          assemblyPoint: payload.assemblyPoints.join(', '),
          evacuationRoute: payload.drillMapUrl,
          beforeDrillInstructions: instructions.length > 0 ? instructions : undefined,
          duringDrillInstructions: safetyGuidelines,
          buildingDetails: { ...eventDetails, ...additionalDetails },
          evacuationMapUrl: controls.includeEvacuationMap && payload.drillMapUrl 
            ? payload.drillMapUrl 
            : undefined,
          acknowledgmentUrl: controls.confirmationUrl && payload.drillId 
            ? `${controls.confirmationUrl}?drillId=${payload.drillId}` 
            : undefined,
          footerNote: `${payload.language === 'zh' ? '演练编号' : 'Drill ID'}: ${payload.drillId}\n${payload.language === 'zh' ? '此为自动生成的消防演练通知' : 'This is an automated fire drill notification'}`
        })

        return {
          subject: subjectLine,
          body
        }
      },
      { 
        controlSchema,
        skip: (controls) => !controls.enableEmail
      }
    )

    // Chat/Teams step for coordination
    await step.chat(
      'send-drill-chat',
      async (controls) => {
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
      { 
        controlSchema,
        skip: (controls) => {
          if (!controls.enableChat) return true
          if (payload.notificationType === 'day_of' && !controls.dayOfChannels.includes('chat')) return true
          return false
        }
      }
    )
  },
  {
    payloadSchema,
    tags: ['fire-safety', 'drill', 'training', 'multi-channel'],
    description: 'Comprehensive fire drill notification workflow handling scheduled drills, reminders, day-of notifications, and results with professional templates'
  }
)