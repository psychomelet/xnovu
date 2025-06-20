import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import { renderDefaultEmail } from '../../../emails/workflows'

export const defaultEmailWorkflow = workflow(
  'default-email',
  async ({ step, payload }) => {
    await step.email(
      'send-email',
      async (controls) => {
        const { 
          templateStyle,
          showHeader,
          showFooter,
          primaryColor,
          headerLogoUrl,
          companyName,
          unsubscribeUrl
        } = controls

        const body = renderDefaultEmail({
          subject: payload.subject,
          title: payload.title,
          message: payload.message,
          recipientName: payload.recipientName,
          ctaText: payload.ctaText,
          ctaUrl: payload.ctaUrl,
          footer: payload.footer,
          templateStyle,
          showHeader,
          showFooter,
          primaryColor,
          headerLogoUrl: headerLogoUrl,
          companyName,
          unsubscribeUrl
        })

        return {
          subject: payload.subject,
          body
        }
      },
      {
        controlSchema
      }
    )
  },
  {
    payloadSchema,
    tags: ['default', 'email', 'template'],
    description: 'Default email template with customizable styling and content'
  }
)