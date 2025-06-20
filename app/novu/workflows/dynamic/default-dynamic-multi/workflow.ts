import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { DynamicMultiPayload, DynamicMultiControls, ChannelConfig, TemplateRenderContext, RenderedContent } from './types'
import { getTemplateRenderer } from '../../../../services/template/TemplateRenderer'
import { notificationService } from '../../../../services/database/NotificationService'
import { renderDynamicEmail } from '../../../emails/dynamic-email-template'

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
        
        // Use React Email to render the email
        const emailHtml = await renderDynamicEmail({
          subject: content.subject,
          body: content.body,
          companyName: (stepControls as DynamicMultiControls).companyName || 'XNovu',
          primaryColor: (stepControls as DynamicMultiControls).primaryColor || '#0066cc',
          variables: content.variables,
          emailSettings: emailControls
        })
        
        return {
          subject: content.subject || 'Notification',
          body: emailHtml,
          ...channelConfig.overrides
        }
      },
      {
        skip: () => !payload.channels.email?.enabled,
        controlSchema
      }
    )

    // In-App Channel
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
        skip: () => !payload.channels.inApp?.enabled,
        controlSchema
      }
    )

    // SMS Channel
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
        skip: () => !payload.channels.sms?.enabled || !payload.recipientConfig?.recipientPhone,
        controlSchema
      }
    )

    // Push Channel
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
        skip: () => !payload.channels.push?.enabled,
        controlSchema
      }
    )

    // Chat Channel
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
        skip: () => !payload.channels.chat?.enabled || !(payload.channels.chat as any)?.webhookUrl,
        controlSchema
      }
    )

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