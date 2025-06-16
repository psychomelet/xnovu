import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'

export const defaultPushWorkflow = workflow(
  'default-push-template',
  async ({ step, payload }) => {
    await step.push(
      'send-push-notification',
      async (controls) => {
        const { 
          enableVibration,
          ttl,
          requireInteraction,
          silent,
          tag,
          defaultIcon,
          clickAction
        } = controls

        // Determine the appropriate action based on controls and payload
        let actions = undefined
        if (clickAction === 'open_url' && payload.actionUrl) {
          actions = [{
            action: 'open',
            title: 'Open',
            url: payload.actionUrl
          }]
        } else if (clickAction === 'custom' && payload.customData?.actions) {
          actions = payload.customData.actions
        }

        // Build the push notification data
        const notificationData: any = {
          category: payload.category,
          priority: payload.priority,
          ...payload.customData
        }

        // Remove actions from customData if they were used
        if (notificationData.actions) {
          delete notificationData.actions
        }

        return {
          title: payload.title,
          body: payload.message,
          icon: payload.iconUrl || defaultIcon,
          image: payload.imageUrl,
          badge: payload.badge,
          sound: silent ? undefined : payload.sound,
          tag: tag,
          requireInteraction: requireInteraction,
          vibrate: enableVibration && !silent ? [200, 100, 200] : undefined,
          timestamp: Date.now(),
          data: notificationData,
          actions: actions,
          // Platform-specific options
          android: {
            ttl: ttl * 1000, // Convert to milliseconds
            priority: payload.priority === 'critical' ? 'high' : 'normal',
            channelId: payload.category || 'default'
          },
          ios: {
            sound: silent ? undefined : payload.sound || 'default',
            badge: payload.badge,
            threadId: payload.category
          },
          web: {
            ttl: ttl,
            urgency: payload.priority === 'critical' ? 'high' : 'normal',
            topic: payload.category
          }
        }
      },
      {
        controlSchema
      }
    )
  },
  {
    payloadSchema,
    tags: ['default', 'push', 'template'],
    description: 'Default push notification template with platform-specific options'
  }
)