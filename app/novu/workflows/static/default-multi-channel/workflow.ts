import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import { renderMultiChannelEmail } from '../../../emails/workflows'

export const defaultMultiChannelWorkflow = workflow(
  'default-multi-channel',
  async ({ step, payload, subscriber }) => {
    // Optional digest step
    const digestResult = await step.digest(
      'digest-notifications',
      async (controls) => {
        return {
          amount: controls.enableDigest ? controls.digestWindow : 1,
          unit: 'seconds' as const,
          digestKey: controls.digestKey || payload.category || 'default',
        }
      },
      {
        controlSchema: controlSchema.pick({ 
          enableDigest: true, 
          digestKey: true, 
          digestWindow: true 
        })
      }
    )

    // Use digested events if available, otherwise use single payload
    const events = digestResult.events || [{ payload }]
    const isDigested = events.length > 1

    // In-App Notification
    await step.inApp(
      'in-app-notification',
      async (controls) => {
        if (isDigested) {
          return {
            subject: `${events.length} new notifications`,
            body: events.map(e => e.payload.title as string).join('\n'),
            data: {
              count: events.length,
              category: payload.category,
              priority: payload.priority,
              events: events
            }
          }
        }

        return {
          subject: payload.title,
          body: payload.message,
          avatar: payload.iconUrl,
          redirect: payload.actionUrl 
            ? { url: payload.actionUrl, target: '_blank' as const }
            : undefined,
          primaryAction: payload.actionUrl
            ? {
                label: 'View Details',
                redirect: { url: payload.actionUrl, target: '_blank' as const }
              }
            : undefined,
          data: {
            category: payload.category,
            priority: payload.priority,
            ...payload.customData
          }
        }
      },
      {
        skip: (controls) => !controls.enableInApp,
        controlSchema: controlSchema.pick({ enableInApp: true })
      }
    )


    // Push Notification
    await step.push(
      'push-notification',
      async (controls) => {
        if (isDigested) {
          return {
            subject: `${events.length} new ${payload.category || 'notifications'}`,
            body: `You have ${events.length} unread notifications`,
            badge: events.length,
            data: {
              count: events.length,
              category: payload.category,
              events: events
            }
          }
        }

        return {
          subject: payload.pushTitle || payload.title,
          body: payload.pushMessage || payload.message,
          icon: payload.iconUrl,
          image: payload.imageUrl,
          data: {
            category: payload.category,
            priority: payload.priority,
            actionUrl: payload.actionUrl,
            ...payload.customData
          },
          android: {
            ttl: controls.pushTtl * 1000,
            priority: payload.priority === 'critical' ? 'high' : 'normal'
          }
        }
      },
      {
        skip: (controls) => !controls.enablePush,
        controlSchema: controlSchema.pick({ enablePush: true, pushTtl: true })
      }
    )


    // Email
    await step.email(
      'email-notification',
      async (controls) => {
        const subject = isDigested 
          ? `${events.length} new notifications from ${controls.companyName}`
          : (payload.emailSubject || payload.title)

        let message = ''
        let additionalSections: string[] = []
        
        if (isDigested) {
          message = `You have ${events.length} new notifications`
          
          // Create a formatted list of notifications
          const notificationsList = events.map(e => `
            <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
              <h3 style="margin-top: 0;">${e.payload.title as string}</h3>
              <p>${e.payload.message as string}</p>
            </div>
          `).join('')
          
          additionalSections.push(notificationsList)
        } else {
          message = payload.emailMessage || payload.message
        }

        const body = await renderMultiChannelEmail({
          subject,
          title: isDigested ? `${events.length} New Notifications` : payload.title,
          message,
          recipientName: payload.recipientName,
          ctaText: !isDigested && payload.actionUrl ? 'View Details' : undefined,
          ctaUrl: !isDigested ? payload.actionUrl : undefined,
          emailTemplate: controls.emailTemplate,
          primaryColor: controls.primaryColor,
          companyName: controls.companyName,
          additionalSections,
          isDigested,
          eventCount: events.length
        })

        return {
          subject,
          body
        }
      },
      {
        skip: (controls) => !controls.enableEmail,
        controlSchema: controlSchema.pick({ 
          enableEmail: true, 
          emailTemplate: true, 
          companyName: true,
          primaryColor: true
        })
      }
    )


    // SMS
    await step.sms(
      'sms-notification',
      async (controls) => {
        let smsBody = ''
        if (isDigested) {
          smsBody = `${controls.companyName}: You have ${events.length} new notifications. Check your app for details.`
        } else {
          smsBody = payload.smsMessage || `${controls.companyName}: ${payload.title} - ${payload.message}`
        }

        // Truncate to SMS limit
        if (smsBody.length > 160) {
          smsBody = smsBody.substring(0, 157) + '...'
        }

        return {
          body: smsBody,
          to: payload.recipientPhone
        }
      },
      {
        skip: (controls) => !controls.enableSms || !payload.recipientPhone,
        controlSchema: controlSchema.pick({ enableSms: true, companyName: true })
      }
    )


    // Chat
    await step.chat(
      'chat-notification',
      async (controls) => {
        let chatBody = ''
        if (isDigested) {
          chatBody = `**${events.length} New Notifications**\n\n`
          chatBody += events.map(e => `• ${e.payload.title as string}: ${e.payload.message as string}`).join('\n')
        } else {
          const priorityEmoji = payload.priority === 'critical' ? '🚨' : 
                             payload.priority === 'high' ? '⚠️' : 
                             payload.priority === 'low' ? 'ℹ️' : '📢'
          chatBody = `${priorityEmoji} **${payload.title}**\n\n${payload.chatMessage || payload.message}`
        }

        return {
          body: chatBody,
          webhookUrl: controls.chatWebhookUrl
        }
      },
      {
        skip: (controls) => !controls.enableChat || !controls.chatWebhookUrl,
        controlSchema: controlSchema.pick({ 
          enableChat: true, 
          chatPlatform: true, 
          chatWebhookUrl: true 
        })
      }
    )
  },
  {
    payloadSchema,
    tags: ['default', 'multi-channel', 'template', 'digest'],
    description: 'Default multi-channel workflow with digest support and configurable channel selection'
  }
)