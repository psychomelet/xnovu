import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'

export const defaultMultiChannelWorkflow = workflow(
  'default-multi-channel-template',
  async ({ step, payload }) => {
    // Optional digest step
    const digestedPayload = await step.digest(
      'digest-notifications',
      async (controls) => {
        return {
          amount: controls.enableDigest ? 100 : 1,
          unit: 'seconds' as const,
          key: controls.digestKey || payload.category || 'default',
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
    const events = digestedPayload.events || [{ payload }]
    const isDigested = events.length > 1

    // In-App Notification
    if (digestedPayload.enableInApp) {
      await step.inApp(
        'in-app-notification',
        async (controls) => {
          if (isDigested) {
            return {
              subject: `${events.length} new notifications`,
              body: events.map(e => e.payload.title).join('\\n'),
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
          skip: () => !digestedPayload.enableInApp,
          controlSchema: controlSchema.pick({ enableInApp: true })
        }
      )

      if (digestedPayload.delayBetweenChannels > 0) {
        await step.delay('delay-after-inapp', async () => ({
          amount: digestedPayload.delayBetweenChannels,
          unit: 'seconds' as const
        }))
      }
    }

    // Push Notification
    if (digestedPayload.enablePush) {
      await step.push(
        'push-notification',
        async (controls) => {
          if (isDigested) {
            return {
              title: `${events.length} new ${payload.category || 'notifications'}`,
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
            title: payload.pushTitle || payload.title,
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
          skip: () => !digestedPayload.enablePush,
          controlSchema: controlSchema.pick({ enablePush: true, pushTtl: true })
        }
      )

      if (digestedPayload.delayBetweenChannels > 0) {
        await step.delay('delay-after-push', async () => ({
          amount: digestedPayload.delayBetweenChannels,
          unit: 'seconds' as const
        }))
      }
    }

    // Email
    if (digestedPayload.enableEmail) {
      await step.email(
        'email-notification',
        async (controls) => {
          const subject = isDigested 
            ? `${events.length} new notifications from ${controls.companyName}`
            : (payload.emailSubject || payload.title)

          let bodyContent = ''
          if (isDigested) {
            bodyContent = `
              <h2>You have ${events.length} new notifications</h2>
              <ul style="list-style: none; padding: 0;">
                ${events.map(e => `
                  <li style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
                    <h3 style="margin-top: 0;">${e.payload.title}</h3>
                    <p>${e.payload.message}</p>
                  </li>
                `).join('')}
              </ul>
            `
          } else {
            bodyContent = `
              ${payload.recipientName ? `<p>Hello ${payload.recipientName},</p>` : ''}
              <h2>${payload.title}</h2>
              <div>${payload.emailMessage || payload.message}</div>
              ${payload.actionUrl ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${payload.actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${controls.primaryColor}; color: white; text-decoration: none; border-radius: 5px;">
                    View Details
                  </a>
                </div>
              ` : ''}
            `
          }

          const templateStyles = {
            default: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <h1 style="color: ${controls.primaryColor}; text-align: center;">${controls.companyName}</h1>
                  ${bodyContent}
                  <hr style="margin: 40px 0; border: none; border-top: 1px solid #eee;">
                  <p style="text-align: center; font-size: 12px; color: #666;">
                    &copy; ${new Date().getFullYear()} ${controls.companyName}. All rights reserved.
                  </p>
                </div>
              </div>
            `,
            minimal: `
              <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
                ${bodyContent}
              </div>
            `,
            branded: `
              <div style="background: #f5f5f5; padding: 40px 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <div style="background: ${controls.primaryColor}; color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0;">${controls.companyName}</h1>
                  </div>
                  <div style="padding: 40px;">
                    ${bodyContent}
                  </div>
                  <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666;">
                    &copy; ${new Date().getFullYear()} ${controls.companyName}
                  </div>
                </div>
              </div>
            `
          }

          return {
            subject: subject,
            body: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin: 0; padding: 0;">
                ${templateStyles[controls.emailTemplate]}
              </body>
              </html>
            `
          }
        },
        {
          skip: () => !digestedPayload.enableEmail,
          controlSchema: controlSchema.pick({ 
            enableEmail: true, 
            emailTemplate: true, 
            companyName: true,
            primaryColor: true
          })
        }
      )

      if (digestedPayload.delayBetweenChannels > 0) {
        await step.delay('delay-after-email', async () => ({
          amount: digestedPayload.delayBetweenChannels,
          unit: 'seconds' as const
        }))
      }
    }

    // SMS
    if (digestedPayload.enableSms && payload.recipientPhone) {
      await step.sms(
        'sms-notification',
        async () => {
          let smsBody = ''
          if (isDigested) {
            smsBody = `${digestedPayload.companyName}: You have ${events.length} new notifications. Check your app for details.`
          } else {
            smsBody = payload.smsMessage || `${digestedPayload.companyName}: ${payload.title} - ${payload.message}`
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
          skip: () => !digestedPayload.enableSms || !payload.recipientPhone,
          controlSchema: controlSchema.pick({ enableSms: true, companyName: true })
        }
      )

      if (digestedPayload.delayBetweenChannels > 0) {
        await step.delay('delay-after-sms', async () => ({
          amount: digestedPayload.delayBetweenChannels,
          unit: 'seconds' as const
        }))
      }
    }

    // Chat
    if (digestedPayload.enableChat && digestedPayload.chatWebhookUrl) {
      await step.chat(
        'chat-notification',
        async (controls) => {
          let chatBody = ''
          if (isDigested) {
            chatBody = `**${events.length} New Notifications**\\n\\n`
            chatBody += events.map(e => `• ${e.payload.title}: ${e.payload.message}`).join('\\n')
          } else {
            const priorityEmoji = payload.priority === 'critical' ? '🚨' : 
                               payload.priority === 'high' ? '⚠️' : 
                               payload.priority === 'low' ? 'ℹ️' : '📢'
            chatBody = `${priorityEmoji} **${payload.title}**\\n\\n${payload.chatMessage || payload.message}`
          }

          return {
            body: chatBody,
            webhookUrl: controls.chatWebhookUrl
          }
        },
        {
          skip: () => !digestedPayload.enableChat || !digestedPayload.chatWebhookUrl,
          controlSchema: controlSchema.pick({ 
            enableChat: true, 
            chatPlatform: true, 
            chatWebhookUrl: true 
          })
        }
      )
    }
  },
  {
    payloadSchema,
    tags: ['default', 'multi-channel', 'template', 'digest'],
    description: 'Default multi-channel workflow with digest support and configurable channel selection'
  }
)