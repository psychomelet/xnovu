import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { FireEmergencyPayload, FireEmergencyControls, EmergencyTypeConfig, LocalizedContent } from './types'

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
        if (!controls.enableSMS) return { body: '' }
        
        const location = getLocationString()
        const urgentText = `${controls.smsUrgencyPrefix} ${emergencyConfig.icon}`
        
        const smsBody = payload.language === 'zh' 
          ? `${urgentText}\n${payload.alertMessage}\n位置: ${location}\n${content.evacuateNow}: ${payload.assemblyPoint}\n${content.emergencyContact}: ${payload.emergencyContactPhone}\n时间: ${formattedDateTime}`
          : `${urgentText}\n${payload.alertMessage}\nLocation: ${location}\n${content.evacuateNow}: ${payload.assemblyPoint}\n${content.emergencyContact}: ${payload.emergencyContactPhone}\nTime: ${formattedDateTime}`

        return {
          body: smsBody.substring(0, 160) // SMS length limit
        }
      },
      { controlSchema }
    )

    // Push Notification Step - Immediate mobile alert
    await step.push(
      'send-emergency-push',
      async (controls) => {
        if (!controls.enablePush) return { subject: '', body: '' }
        
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
      { controlSchema }
    )

    // In-App Notification Step - Persistent dashboard alert
    await step.inApp(
      'send-emergency-inapp',
      async (controls) => {
        if (!controls.enableInApp) return { subject: '', body: '' }
        
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
      { controlSchema }
    )

    // Email Step - Detailed emergency information
    await step.email(
      'send-emergency-email',
      async (controls) => {
        if (!controls.enableEmail) return { subject: '', body: '' }
        
        const location = getLocationString()
        const urgencyBadge = `<span style="background: ${emergencyConfig.color}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 14px;">${emergencyConfig.icon} ${content.urgentPrefix}</span>`
        
        // Build evacuation map HTML
        const evacuationMapHtml = controls.includeEvacuationMap && payload.buildingMapUrl
          ? `<div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-left: 4px solid ${emergencyConfig.color};">
               <h3 style="margin: 0 0 10px 0; color: ${emergencyConfig.color};">Evacuation Map</h3>
               <a href="${payload.buildingMapUrl}" target="_blank" style="color: ${emergencyConfig.color}; text-decoration: underline;">View Building Evacuation Map</a>
             </div>`
          : ''
        
        // Build emergency contacts HTML
        const emergencyContactsHtml = controls.includeEmergencyContacts
          ? `<div style="margin: 20px 0; padding: 15px; background: #fff3e0; border: 1px solid #ffb74d; border-radius: 4px;">
               <h3 style="margin: 0 0 10px 0; color: #f57c00;">Emergency Contacts</h3>
               <p style="margin: 5px 0;"><strong>Primary:</strong> ${payload.emergencyContactName} - <a href="tel:${payload.emergencyContactPhone}" style="color: ${emergencyConfig.color};">${payload.emergencyContactPhone}</a></p>
               <p style="margin: 5px 0;"><strong>Fire Department:</strong> <a href="tel:119" style="color: ${emergencyConfig.color};">119</a></p>
               <p style="margin: 5px 0;"><strong>Security:</strong> <a href="tel:110" style="color: ${emergencyConfig.color};">110</a></p>
             </div>`
          : ''
        
        // Build building info HTML
        const buildingInfoHtml = controls.includeBuildingInfo
          ? `<div style="margin: 20px 0; padding: 15px; background: #e3f2fd; border: 1px solid #2196f3; border-radius: 4px;">
               <h3 style="margin: 0 0 10px 0; color: #1976d2;">Location Details</h3>
               <p style="margin: 5px 0;"><strong>Building:</strong> ${payload.buildingName}</p>
               ${payload.floorNumber ? `<p style="margin: 5px 0;"><strong>Floor:</strong> ${payload.floorNumber}</p>` : ''}
               ${payload.zoneId ? `<p style="margin: 5px 0;"><strong>Zone:</strong> ${payload.zoneId}</p>` : ''}
               <p style="margin: 5px 0;"><strong>Description:</strong> ${payload.locationDescription}</p>
               <p style="margin: 5px 0;"><strong>Assembly Point:</strong> ${payload.assemblyPoint}</p>
             </div>`
          : ''
        
        // Build acknowledgment HTML
        const acknowledgmentHtml = controls.requireAcknowledgment && controls.acknowledgmentUrl
          ? `<div style="text-align: center; margin: 30px 0;">
               <a href="${controls.acknowledgmentUrl}?alertId=${payload.alertId}" 
                  style="display: inline-block; padding: 12px 24px; background-color: ${emergencyConfig.color}; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                 Acknowledge Receipt
               </a>
             </div>`
          : ''

        const emailSubject = payload.language === 'zh'
          ? `🚨 紧急警报: ${payload.emergencyType} - ${payload.buildingName}`
          : `🚨 EMERGENCY ALERT: ${payload.emergencyType.toUpperCase()} - ${payload.buildingName}`

        return {
          subject: emailSubject,
          body: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${emailSubject}</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
              <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="text-align: center; padding: 20px 0; border-bottom: 3px solid ${emergencyConfig.color};">
                  ${controls.logoUrl ? `<img src="${controls.logoUrl}" alt="${controls.organizationName}" style="max-height: 50px; margin-bottom: 10px;">` : ''}
                  <h1 style="margin: 10px 0 0 0; color: ${emergencyConfig.color};">${controls.organizationName}</h1>
                </div>
                
                <!-- Emergency Alert Header -->
                <div style="text-align: center; padding: 20px 0; background: linear-gradient(135deg, ${emergencyConfig.color}15, ${emergencyConfig.color}05); margin: 20px -30px; border-radius: 8px;">
                  ${urgencyBadge}
                  <h2 style="margin: 15px 0 5px 0; color: ${emergencyConfig.color}; font-size: 24px;">${payload.language === 'zh' ? '火灾紧急警报' : 'FIRE EMERGENCY ALERT'}</h2>
                  <p style="margin: 0; color: #666; font-size: 14px;">${payload.language === 'zh' ? '检测时间' : 'Detected at'}: ${formattedDateTime}</p>
                </div>
                
                <!-- Main Content -->
                <div style="padding: 20px 0;">
                  ${payload.recipientName ? `<p style="margin-bottom: 20px; font-size: 16px;">${payload.language === 'zh' ? '您好' : 'Dear'} ${payload.recipientName},</p>` : ''}
                  
                  <div style="background: #ffebee; border-left: 4px solid ${emergencyConfig.color}; padding: 15px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: ${emergencyConfig.color};">${payload.language === 'zh' ? '紧急情况' : 'Emergency Situation'}</h3>
                    <p style="margin: 0; font-size: 16px; font-weight: bold;">${payload.alertMessage}</p>
                  </div>
                  
                  <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #f57c00;">${payload.language === 'zh' ? '疏散指示' : 'Evacuation Instructions'}</h3>
                    <div style="color: #555; line-height: 1.6; white-space: pre-wrap;">${payload.evacuationInstructions}</div>
                    ${payload.additionalInstructions ? `<div style="margin-top: 10px; color: #555; line-height: 1.6; white-space: pre-wrap;">${payload.additionalInstructions}</div>` : ''}
                  </div>
                  
                  <!-- Safety Reminders -->
                  <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #388e3c;">${payload.language === 'zh' ? '安全提醒' : 'Safety Reminders'}</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #555;">
                      <li>${content.stayCalm}</li>
                      <li>${content.doNotUseElevators}</li>
                      <li>${content.awaitInstructions}</li>
                      ${payload.language === 'zh' ? '<li>如遇浓烟，请低身行进</li>' : '<li>If you encounter smoke, crawl low under the smoke</li>'}
                      ${payload.language === 'zh' ? '<li>关闭身后的门，但不要锁门</li>' : '<li>Close doors behind you, but do not lock them</li>'}
                    </ul>
                  </div>
                  
                  ${buildingInfoHtml}
                  ${emergencyContactsHtml}
                  ${evacuationMapHtml}
                  ${acknowledgmentHtml}
                  
                  <!-- Alert Information -->
                  <div style="margin: 30px 0; padding: 15px; background: #f5f5f5; border-radius: 4px; font-size: 12px; color: #666;">
                    <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '警报编号' : 'Alert ID'}:</strong> ${payload.alertId}</p>
                    <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '报告者' : 'Reported by'}:</strong> ${payload.reportedBy || payload.systemSource}</p>
                    <p style="margin: 5px 0;"><strong>${payload.language === 'zh' ? '严重程度' : 'Severity'}:</strong> ${payload.severity.toUpperCase()}</p>
                  </div>
                </div>
                
                <!-- Footer -->
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #666;">
                  <p>&copy; ${new Date().getFullYear()} ${controls.organizationName}. ${payload.language === 'zh' ? '版权所有' : 'All rights reserved'}.</p>
                  <p style="margin-top: 10px; color: ${emergencyConfig.color}; font-weight: bold;">
                    ${payload.language === 'zh' ? '这是一个自动生成的紧急警报通知' : 'This is an automated emergency alert notification'}
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

    // Chat/Teams Step - For coordination teams
    await step.chat(
      'send-emergency-chat',
      async (controls) => {
        if (!controls.enableChat) return { body: '' }
        
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
      { controlSchema }
    )
  },
  {
    payloadSchema,
    tags: ['fire-safety', 'emergency', 'critical', 'multi-channel'],
    description: 'Critical fire emergency alert workflow with multi-channel notifications for immediate response'
  }
)