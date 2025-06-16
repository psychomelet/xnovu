import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'

export const defaultInAppWorkflow = workflow(
  'default-in-app',
  async ({ step, payload }) => {
    await step.inApp(
      'send-in-app-notification',
      async (controls) => {
        const { 
          showAvatar, 
          avatarUrl, 
          primaryActionLabel, 
          secondaryActionLabel,
          enableRedirect 
        } = controls

        return {
          subject: payload.title,
          body: payload.message,
          avatar: showAvatar && avatarUrl ? avatarUrl : undefined,
          redirect: enableRedirect && payload.actionUrl 
            ? { url: payload.actionUrl, target: '_blank' as const }
            : undefined,
          primaryAction: primaryActionLabel
            ? {
                label: primaryActionLabel,
                redirect: payload.actionUrl 
                  ? { url: payload.actionUrl, target: '_blank' as const }
                  : undefined
              }
            : undefined,
          secondaryAction: secondaryActionLabel
            ? {
                label: secondaryActionLabel,
                redirect: { url: '/', target: '_self' as const }
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
        controlSchema
      }
    )
  },
  {
    payloadSchema,
    tags: ['default', 'in-app', 'template'],
    description: 'Default in-app notification template with configurable options'
  }
)