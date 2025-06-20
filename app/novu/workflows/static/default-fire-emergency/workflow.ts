import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { FireEmergencyPayload, FireEmergencyControls, EmergencyTypeConfig, LocalizedContent } from './types'
import { renderFireEmergencyEmail } from '../../../emails/workflows'

const emergencyTypeConfig: EmergencyTypeConfig = {
  fire: { icon: '🔥', color: '#D32F2F', priority: 'critical', autoEvacuate: true },
  smoke_detected: { icon: '💨', color: '#FF6F00', priority: 'high', autoEvacuate: false },
  gas_leak: { icon: '⚠️', color: '#F57C00', priority: 'high', autoEvacuate: true },
  explosion: { icon: '💥', color: '#C62828', priority: 'critical', autoEvacuate: true },
  evacuation: { icon: '🚪', color: '#1976D2', priority: 'critical', autoEvacuate: true }
}

const localizedContent: LocalizedContent = {
  en: {
    urgentPrefix: 'URGENT',
    evacuateNow: 'EVACUATE NOW',
    assemblyPoint: 'Assembly Point',
    emergencyContact: 'Emergency Contact',
    stayCalm: 'Stay calm and follow evacuation procedures',
    doNotUseElevators: 'Do NOT use elevators',
    awaitInstructions: 'Await further instructions at assembly point'
  },
  zh: {
    urgentPrefix: '紧急',
    evacuateNow: '立即疏散',
    assemblyPoint: '集合点',
    emergencyContact: '紧急联系人',
    stayCalm: '保持冷静并遵循疏散程序',
    doNotUseElevators: '请勿使用电梯',
    awaitInstructions: '在集合点等待进一步指示'
  }
}

export const defaultFireEmergencyWorkflow = workflow(
  'default-fire-emergency',
  async ({ step, payload }) => {
    const emergencyConfig = emergencyTypeConfig[payload.emergencyType]
    const content = localizedContent[payload.language]
    const formattedDateTime = new Date(payload.detectedAt).toLocaleString(
      payload.language === 'zh' ? 'zh-CN' : 'en-US',
      { timeZone: 'Asia/Shanghai' }
    )

    // Helper function to create location string
    const getLocationString = () => {
      let location = payload.buildingName
      if (payload.floorNumber) location += ` - ${payload.floorNumber}`
      if (payload.zoneId) location += ` (${payload.zoneId})`
      return location
    }

    // SMS Step - Immediate critical alert
    await step.sms(
      'send-emergency-sms',
      async (controls) => {
        const location = getLocationString()
        const urgentText = `${controls.smsUrgencyPrefix} ${emergencyConfig.icon}`
        
        const smsBody = payload.language === 'zh' 
          ? `${urgentText}\n${payload.alertMessage}\n位置: ${location}\n${content.evacuateNow}: ${payload.assemblyPoint}\n${content.emergencyContact}: ${payload.emergencyContactPhone}\n时间: ${formattedDateTime}`
          : `${urgentText}\n${payload.alertMessage}\nLocation: ${location}\n${content.evacuateNow}: ${payload.assemblyPoint}\n${content.emergencyContact}: ${payload.emergencyContactPhone}\nTime: ${formattedDateTime}`

        return {
          body: smsBody.substring(0, 160) // SMS length limit
        }
      },
      { 
        controlSchema,
        skip: (controls) => !controls.enableSMS
      }
    )

    // Push Notification Step - Immediate mobile alert
    await step.push(
      'send-emergency-push',
      async (controls) => {
        const location = getLocationString()
        
        return {
          subject: `${emergencyConfig.icon} ${content.urgentPrefix}: ${payload.emergencyType.toUpperCase()}`,
          body: payload.language === 'zh'
            ? `${payload.alertMessage}\n位置: ${location}\n${content.evacuateNow}: ${payload.assemblyPoint}`
            : `${payload.alertMessage}\nLocation: ${location}\n${content.evacuateNow}: ${payload.assemblyPoint}`,
          data: {
            emergencyType: payload.emergencyType,
            severity: payload.severity,
            buildingName: payload.buildingName,
            alertId: payload.alertId,
            urgencyLevel: controls.pushUrgencyLevel
          }
        }
      },
      { 
        controlSchema,
        skip: (controls) => !controls.enablePush
      }
    )

    // In-App Notification Step - Persistent dashboard alert
    await step.inApp(
      'send-emergency-inapp',
      async (controls) => {
        const location = getLocationString()
        
        return {
          subject: `${emergencyConfig.icon} ${payload.emergencyType.toUpperCase()} - ${payload.buildingName}`,
          body: payload.language === 'zh'
            ? `紧急警报: ${payload.alertMessage}\n位置: ${location}\n疏散指示: ${payload.evacuationInstructions}\n集合点: ${payload.assemblyPoint}\n紧急联系人: ${payload.emergencyContactName} (${payload.emergencyContactPhone})`
            : `Emergency Alert: ${payload.alertMessage}\nLocation: ${location}\nEvacuation: ${payload.evacuationInstructions}\nAssembly Point: ${payload.assemblyPoint}\nEmergency Contact: ${payload.emergencyContactName} (${payload.emergencyContactPhone})`,
          data: {
            emergencyType: payload.emergencyType,
            severity: payload.severity,
            buildingName: payload.buildingName,
            alertId: payload.alertId,
            color: emergencyConfig.color
          }
        }
      },
      { 
        controlSchema,
        skip: (controls) => !controls.enableInApp
      }
    )

    // Email Step - Detailed emergency information
    await step.email(
      'send-emergency-email',
      async (controls) => {
        const location = getLocationString()
        const urgencyBadge = `<span style="background: ${emergencyConfig.color}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 14px;">${emergencyConfig.icon} ${content.urgentPrefix}</span>`
        
        const emailSubject = payload.language === 'zh'
          ? `🚨 紧急警报: ${payload.emergencyType} - ${payload.buildingName}`
          : `🚨 EMERGENCY ALERT: ${payload.emergencyType.toUpperCase()} - ${payload.buildingName}`

        // Build location details
        const locationDetails: Record<string, string> = controls.includeBuildingInfo ? {
          Building: payload.buildingName,
          ...(payload.floorNumber && { Floor: payload.floorNumber }),
          ...(payload.zoneId && { Zone: payload.zoneId }),
          Description: payload.locationDescription,
          'Assembly Point': payload.assemblyPoint
        } : {}

        // Build emergency contacts
        const emergencyContacts = controls.includeEmergencyContacts ? [
          { label: 'Primary', name: payload.emergencyContactName, phone: payload.emergencyContactPhone },
          { label: 'Fire Department', name: '', phone: '119' },
          { label: 'Security', name: '', phone: '110' }
        ] : []

        // Build safety reminders
        const safetyReminders = [
          content.stayCalm,
          content.doNotUseElevators,
          content.awaitInstructions,
          payload.language === 'zh' ? '如遇浓烟，请低身行进' : 'If you encounter smoke, crawl low under the smoke',
          payload.language === 'zh' ? '关闭身后的门，但不要锁门' : 'Close doors behind you, but do not lock them'
        ]

        const body = await renderFireEmergencyEmail({
          subject: emailSubject,
          recipientName: payload.recipientName,
          organizationName: controls.organizationName,
          logoUrl: controls.logoUrl,
          urgencyBadge,
          emergencyTitle: payload.language === 'zh' ? '火灾紧急警报' : 'FIRE EMERGENCY ALERT',
          emergencySubtitle: `${payload.language === 'zh' ? '检测时间' : 'Detected at'}: ${formattedDateTime}`,
          emergencyColor: emergencyConfig.color,
          alertTitle: payload.language === 'zh' ? '紧急情况' : 'Emergency Situation',
          alertMessage: payload.alertMessage,
          alertColor: emergencyConfig.color,
          instructionsTitle: payload.language === 'zh' ? '疏散指示' : 'Evacuation Instructions',
          instructionsContent: payload.evacuationInstructions,
          additionalInstructions: payload.additionalInstructions,
          safetyReminders,
          locationDetails: Object.keys(locationDetails).length > 0 ? locationDetails : undefined,
          emergencyContacts: emergencyContacts.length > 0 ? emergencyContacts : undefined,
          evacuationMapUrl: controls.includeEvacuationMap ? payload.buildingMapUrl : undefined,
          acknowledgmentUrl: controls.requireAcknowledgment ? controls.acknowledgmentUrl : undefined,
          alertId: payload.alertId,
          reportedBy: payload.reportedBy || payload.systemSource,
          severity: payload.severity,
          detectedAt: formattedDateTime,
          footerNote: payload.language === 'zh' ? '这是一个自动生成的紧急警报通知' : 'This is an automated emergency alert notification'
        })

        return {
          subject: emailSubject,
          body
        }
      },
      { 
        controlSchema,
        skip: (controls) => !controls.enableEmail
      }
    )

    // Chat/Teams Step - For coordination teams
    await step.chat(
      'send-emergency-chat',
      async (controls) => {
        const location = getLocationString()
        
        const chatMessage = payload.language === 'zh'
          ? `🚨 **火灾紧急警报** 🚨
**位置**: ${location}
**类型**: ${payload.emergencyType}
**严重程度**: ${payload.severity}
**时间**: ${formattedDateTime}

**警报信息**: ${payload.alertMessage}
**疏散指示**: ${payload.evacuationInstructions}
**集合点**: ${payload.assemblyPoint}
**紧急联系人**: ${payload.emergencyContactName} (${payload.emergencyContactPhone})

**警报编号**: ${payload.alertId}
${payload.buildingMapUrl ? `**疏散地图**: ${payload.buildingMapUrl}` : ''}`
          : `🚨 **FIRE EMERGENCY ALERT** 🚨
**Location**: ${location}
**Type**: ${payload.emergencyType}
**Severity**: ${payload.severity}
**Time**: ${formattedDateTime}

**Alert**: ${payload.alertMessage}
**Evacuation**: ${payload.evacuationInstructions}
**Assembly Point**: ${payload.assemblyPoint}
**Emergency Contact**: ${payload.emergencyContactName} (${payload.emergencyContactPhone})

**Alert ID**: ${payload.alertId}
${payload.buildingMapUrl ? `**Evacuation Map**: ${payload.buildingMapUrl}` : ''}`

        return {
          body: chatMessage
        }
      },
      { 
        controlSchema,
        skip: (controls) => !controls.enableChat
      }
    )
  },
  {
    payloadSchema,
    tags: ['fire-safety', 'emergency', 'critical', 'multi-channel'],
    description: 'Critical fire emergency alert workflow with multi-channel notifications for immediate response'
  }
)