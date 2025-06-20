import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { DynamicMultiPayload, DynamicMultiControls, ChannelConfig, TemplateRenderContext, RenderedContent } from './types'
import { getTemplateRenderer } from '../../../../services/template/TemplateRenderer'
import { notificationService } from '../../../../services/database/NotificationService'

export const defaultDynamicMultiWorkflow = workflow(
  'default-dynamic-multi',
  async ({ step, payload, subscriber }) => {
    const controls = {} as DynamicMultiControls
    const enterpriseId = subscriber?.subscriberId || 'default'

    // Update notification status if provided
    if (payload.notificationId) {
      try {
        const parsedNotificationId = typeof payload.notificationId === 'string' 
          ? parseInt(payload.notificationId) 
          : payload.notificationId
        await notificationService.updateNotificationStatus(
          parsedNotificationId,
          'PROCESSING',
          enterpriseId
        )
      } catch (error) {
        console.warn('Failed to update notification status:', error)
      }
    }

    // Helper function to merge variables
    const mergeVariables = (channelConfig: ChannelConfig): Record<string, any> => {
      return {
        ...payload.globalVariables,
        ...channelConfig.variables,
        ...payload.recipientConfig,
        // System variables
        enterpriseId,
        subscriberId: subscriber?.subscriberId,
        timestamp: new Date().toISOString(),
        companyName: controls.companyName || 'XNovu',
        primaryColor: controls.primaryColor || '#0066cc'
      }
    }

    // Helper function to render content
    const renderContent = async (
      channelConfig: ChannelConfig, 
      channelType: string
    ): Promise<RenderedContent> => {
      const variables = mergeVariables(channelConfig)
      
      try {
        if (channelConfig.templateId) {
          const templateRenderer = getTemplateRenderer()
          const context: TemplateRenderContext = {
            enterpriseId,
            variables,
            channel: channelType,
            recipientConfig: payload.recipientConfig
          }
          
          const result = await templateRenderer.renderTemplate(
            channelConfig.templateId,
            enterpriseId,
            variables
          )
          
          return {
            subject: result.subject,
            body: result.body,
            variables
          }
        } else if (channelConfig.customContent) {
          const templateRenderer = getTemplateRenderer()
          
          const renderedSubject = channelConfig.customContent.subject 
            ? await templateRenderer.render(channelConfig.customContent.subject, { enterpriseId, variables })
            : undefined
            
          const renderedBody = await templateRenderer.render(
            channelConfig.customContent.body, 
            { enterpriseId, variables }
          )
          
          return {
            subject: renderedSubject,
            body: renderedBody,
            variables
          }
        } else {
          throw new Error('No template or custom content provided')
        }
      } catch (error) {
        console.error(`Template rendering failed for ${channelType}:`, error)
        return {
          subject: `Notification - ${channelType}`,
          body: `Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variables
        }
      }
    }

    // Email Channel
    if (payload.channels.email?.enabled) {
      await step.email(
        'dynamic-email',
        async (stepControls) => {
          const channelConfig = payload.channels.email!
          const content = await renderContent(channelConfig, 'email')
          const emailControls = (stepControls as DynamicMultiControls).emailSettings || {
            templateStyle: 'default' as const,
            showHeader: true,
            showFooter: true,
            headerLogoUrl: undefined,
            unsubscribeUrl: undefined
          }
          
          const templateStyles = {
            default: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  ${emailControls.showHeader ? `<h1 style="color: ${(stepControls as DynamicMultiControls).primaryColor}; text-align: center;">${(stepControls as DynamicMultiControls).companyName}</h1>` : ''}
                  ${content.body}
                  ${emailControls.showFooter ? `
                    <hr style="margin: 40px 0; border: none; border-top: 1px solid #eee;">
                    <p style="text-align: center; font-size: 12px; color: #666;">
                      &copy; ${new Date().getFullYear()} ${(stepControls as DynamicMultiControls).companyName}. All rights reserved.
                    </p>
                  ` : ''}
                </div>
              </div>
            `,
            minimal: `
              <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
                ${content.body}
              </div>
            `,
            branded: `
              <div style="background: #f5f5f5; padding: 40px 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <div style="background: ${(stepControls as DynamicMultiControls).primaryColor}; color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0;">${(stepControls as DynamicMultiControls).companyName}</h1>
                  </div>
                  <div style="padding: 40px;">
                    ${content.body}
                  </div>
                  <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666;">
                    &copy; ${new Date().getFullYear()} ${(stepControls as DynamicMultiControls).companyName}
                  </div>
                </div>
              </div>
            `
          }

          const templateStyle = emailControls.templateStyle || 'default'
          
          return {
            subject: content.subject || 'Notification',
            body: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin: 0; padding: 0;">
                ${templateStyles[templateStyle] || templateStyles.default}
              </body>
              </html>
            `,
            ...channelConfig.overrides
          }
        },
        {
          controlSchema
        }
      )
    }

    // In-App Channel
    if (payload.channels.inApp?.enabled) {
      await step.inApp(
        'dynamic-in-app',
        async (stepControls) => {
          const channelConfig = payload.channels.inApp!
          const content = await renderContent(channelConfig, 'inApp')
          const inAppControls = (stepControls as DynamicMultiControls).inAppSettings || {
            showAvatar: true,
            avatarUrl: undefined,
            enableRedirect: true
          }
          
          return {
            subject: content.subject || 'Notification',
            body: content.body,
            avatar: inAppControls.showAvatar ? inAppControls.avatarUrl : undefined,
            redirect: inAppControls.enableRedirect && payload.recipientConfig?.customData?.actionUrl
              ? { url: payload.recipientConfig.customData.actionUrl, target: '_blank' as const }
              : undefined,
            data: {
              variables: content.variables,
              enterpriseId,
              channel: 'inApp',
              ...channelConfig.overrides
            },
            ...channelConfig.overrides
          }
        },
        {
          controlSchema
        }
      )
    }

    // SMS Channel
    if (payload.channels.sms?.enabled) {
      await step.sms(
        'dynamic-sms',
        async (stepControls) => {
          const channelConfig = payload.channels.sms!
          const content = await renderContent(channelConfig, 'sms')
          const smsControls = (stepControls as DynamicMultiControls).smsSettings || {
            maxLength: 160,
            includeCompanyName: true
          }
          
          let smsBody = content.body
          if (smsControls.includeCompanyName) {
            smsBody = `${(stepControls as DynamicMultiControls).companyName}: ${smsBody}`
          }
          
          // Truncate to SMS limit
          const maxLength = smsControls.maxLength || 160
          if (smsBody.length > maxLength) {
            smsBody = smsBody.substring(0, maxLength - 3) + '...'
          }
          
          return {
            body: smsBody,
            to: payload.recipientConfig?.recipientPhone,
            ...channelConfig.overrides
          }
        },
        {
          skip: () => !payload.recipientConfig?.recipientPhone,
          controlSchema
        }
      )
    }

    // Push Channel
    if (payload.channels.push?.enabled) {
      await step.push(
        'dynamic-push',
        async (stepControls) => {
          const channelConfig = payload.channels.push!
          const content = await renderContent(channelConfig, 'push')
          const pushControls = (stepControls as DynamicMultiControls).pushSettings || {
            ttl: 3600,
            priority: 'normal' as const
          }
          
          return {
            subject: content.subject || 'Notification',
            body: content.body,
            data: {
              variables: content.variables,
              enterpriseId,
              channel: 'push',
              ...channelConfig.overrides
            },
            android: {
              ttl: (pushControls.ttl || 3600) * 1000,
              priority: pushControls.priority || 'normal'
            },
            ...channelConfig.overrides
          }
        },
        {
          controlSchema
        }
      )
    }

    // Chat Channel
    if (payload.channels.chat?.enabled) {
      await step.chat(
        'dynamic-chat',
        async (stepControls) => {
          const channelConfig = payload.channels.chat!
          const content = await renderContent(channelConfig, 'chat')
          const chatControls = (stepControls as DynamicMultiControls).chatSettings || {
            platform: 'slack' as const,
            webhookUrl: undefined,
            enableMarkdown: true
          }
          
          let chatBody = content.body
          if (chatControls.enableMarkdown && chatControls.platform !== 'webhook') {
            chatBody = content.subject ? `**${content.subject}**\n\n${chatBody}` : chatBody
          }
          
          return {
            body: chatBody,
            webhookUrl: chatControls.webhookUrl,
            ...channelConfig.overrides
          }
        },
        {
          skip: (stepControls) => !(stepControls as DynamicMultiControls).chatSettings?.webhookUrl,
          controlSchema
        }
      )
    }

    // Update notification status to SENT if successful
    if (payload.notificationId) {
      try {
        const parsedNotificationId = typeof payload.notificationId === 'string' 
          ? parseInt(payload.notificationId) 
          : payload.notificationId
        await notificationService.updateNotificationStatus(
          parsedNotificationId,
          'SENT',
          enterpriseId
        )
      } catch (error) {
        console.warn('Failed to update notification status to SENT:', error)
      }
    }
  },
  {
    payloadSchema,
    tags: ['dynamic', 'multi-channel', 'template', 'flexible'],
    description: 'Highly flexible dynamic multi-channel workflow with configurable templates and channels'
  }
)