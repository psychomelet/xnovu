import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'

export const defaultSmsWorkflow = workflow(
  'default-sms-template',
  async ({ step, payload }) => {
    await step.sms(
      'send-sms',
      async (controls) => {
        const { 
          messagePrefix,
          messageSuffix,
          includeUnsubscribe,
          senderName
        } = controls

        let fullMessage = ''
        
        // Add sender name if urgency is high or critical
        if (payload.urgency === 'high' || payload.urgency === 'critical') {
          fullMessage += `[${senderName} URGENT] `
        } else if (messagePrefix) {
          fullMessage += `${messagePrefix} `
        }
        
        // Add main message
        fullMessage += payload.message
        
        // Add link if requested
        if (payload.includeLink && payload.linkUrl) {
          // In real implementation, URL shortening would happen here
          fullMessage += ` ${payload.linkUrl}`
        }
        
        // Add suffix
        if (messageSuffix) {
          fullMessage += ` ${messageSuffix}`
        }
        
        // Add unsubscribe if enabled
        if (includeUnsubscribe) {
          fullMessage += ' Reply STOP to unsubscribe.'
        }
        
        // Truncate if message exceeds SMS limit (160 chars)
        if (fullMessage.length > 160) {
          fullMessage = fullMessage.substring(0, 157) + '...'
        }

        return {
          body: fullMessage,
          to: payload.recipientPhone
        }
      },
      {
        controlSchema
      }
    )
  },
  {
    payloadSchema,
    tags: ['default', 'sms', 'template'],
    description: 'Default SMS template with character limit awareness and urgency support'
  }
)