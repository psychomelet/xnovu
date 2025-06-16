import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'

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

        const headerHtml = showHeader ? `
          <div style="text-align: center; padding: 20px 0; border-bottom: 1px solid #eee;">
            ${headerLogoUrl ? `<img src="${headerLogoUrl}" alt="${companyName}" style="max-height: 50px;">` : `<h2 style="margin: 0; color: ${primaryColor};">${companyName}</h2>`}
          </div>
        ` : ''

        const footerHtml = showFooter ? `
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #666;">
            <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            ${unsubscribeUrl ? `<p><a href="${unsubscribeUrl}" style="color: ${primaryColor};">Unsubscribe from these emails</a></p>` : ''}
          </div>
        ` : ''

        const ctaHtml = payload.ctaText && payload.ctaUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${payload.ctaUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${primaryColor}; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              ${payload.ctaText}
            </a>
          </div>
        ` : ''

        const bodyStyles = {
          default: 'font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;',
          minimal: 'font-family: system-ui, -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;',
          branded: `font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;`
        }

        const containerStyles = {
          default: 'background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);',
          minimal: 'background-color: white; padding: 0;',
          branded: 'background-color: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'
        }

        return {
          subject: payload.subject,
          body: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${payload.subject}</title>
            </head>
            <body style="${bodyStyles[templateStyle]}">
              <div style="${containerStyles[templateStyle]}">
                ${headerHtml}
                
                <div style="padding: 20px 0;">
                  ${payload.recipientName ? `<p style="margin-bottom: 20px;">Hello ${payload.recipientName},</p>` : ''}
                  
                  <h1 style="color: #333; margin-bottom: 20px;">${payload.title}</h1>
                  
                  <div style="color: #555; line-height: 1.6; white-space: pre-wrap;">${payload.message}</div>
                  
                  ${ctaHtml}
                  
                  ${payload.footer ? `<p style="margin-top: 30px; color: #666;">${payload.footer}</p>` : ''}
                </div>
                
                ${footerHtml}
              </div>
            </body>
            </html>
          `
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