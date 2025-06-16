import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'

export const defaultChatWorkflow = workflow(
  'default-chat-template',
  async ({ step, payload }) => {
    await step.chat(
      'send-chat-message',
      async (controls) => {
        const { 
          platform,
          formatStyle,
          showTimestamp,
          threadId,
          iconEmoji,
          botName,
          botAvatar
        } = controls

        // Format the message based on style and platform
        let formattedMessage = ''
        
        // Add title if provided
        if (payload.title) {
          if (formatStyle === 'markdown') {
            formattedMessage += `**${payload.title}**\n\n`
          } else if (formatStyle === 'rich' && platform === 'slack') {
            formattedMessage += `*${payload.title}*\n\n`
          } else {
            formattedMessage += `${payload.title}\n\n`
          }
        }

        // Add priority indicator for high/critical
        if (payload.priority === 'high' || payload.priority === 'critical') {
          const priorityEmoji = payload.priority === 'critical' ? '🚨' : '⚠️'
          formattedMessage += `${priorityEmoji} *Priority: ${payload.priority.toUpperCase()}*\n\n`
        }

        // Add main message
        formattedMessage += payload.message

        // Add mentions
        if (payload.mentions && payload.mentions.length > 0) {
          formattedMessage += '\n\n'
          if (platform === 'slack') {
            formattedMessage += payload.mentions.map(m => `<@${m}>`).join(' ')
          } else if (platform === 'teams') {
            formattedMessage += payload.mentions.map(m => `@${m}`).join(' ')
          } else {
            formattedMessage += 'cc: ' + payload.mentions.join(', ')
          }
        }

        // Add timestamp if enabled
        if (showTimestamp) {
          const timestamp = new Date().toISOString()
          formattedMessage += `\n\n_Sent at: ${timestamp}_`
        }

        // Build platform-specific payload
        const chatPayload: any = {
          body: formattedMessage,
          webhookUrl: payload.webhookUrl
        }

        // Add platform-specific fields
        if (platform === 'slack') {
          chatPayload.slack = {
            username: botName,
            icon_emoji: iconEmoji,
            icon_url: botAvatar,
            thread_ts: threadId,
            channel: payload.channel,
            attachments: payload.attachments?.map(att => ({
              title: att.title,
              text: att.text,
              image_url: att.imageUrl,
              color: att.color || (payload.priority === 'critical' ? 'danger' : payload.priority === 'high' ? 'warning' : 'good'),
              fields: att.fields
            }))
          }
        } else if (platform === 'teams') {
          chatPayload.teams = {
            summary: payload.title || 'XNovu Notification',
            sections: payload.attachments?.map(att => ({
              activityTitle: att.title,
              activitySubtitle: att.text,
              activityImage: att.imageUrl,
              facts: att.fields?.map(f => ({
                name: f.title,
                value: f.value
              }))
            }))
          }
        } else if (platform === 'discord') {
          chatPayload.discord = {
            username: botName,
            avatar_url: botAvatar,
            embeds: payload.attachments?.map(att => ({
              title: att.title,
              description: att.text,
              image: att.imageUrl ? { url: att.imageUrl } : undefined,
              color: parseInt(att.color?.replace('#', '') || 'ff0000', 16),
              fields: att.fields
            }))
          }
        }

        // Merge with custom data
        if (payload.customData) {
          Object.assign(chatPayload, payload.customData)
        }

        return chatPayload
      },
      {
        controlSchema
      }
    )
  },
  {
    payloadSchema,
    tags: ['default', 'chat', 'template'],
    description: 'Default chat template supporting Slack, Teams, Discord, and generic webhooks'
  }
)