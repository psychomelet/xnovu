import { workflow } from '@novu/framework';
import { z } from 'zod';
import { 
  renderEmailTemplate, 
  renderInAppTemplate,
  renderTemplateForStep
} from '../../../services/template/WorkflowTemplateIntegration';

// Schema for template-aware workflow
const templateDemoPayloadSchema = z.object({
  enterpriseId: z.string(),
  recipientId: z.string(),
  templateId: z.string().optional(),
  buildingId: z.string(),
  buildingName: z.string(),
  alertType: z.enum(['MAINTENANCE', 'SECURITY', 'EMERGENCY', 'GENERAL']),
  alertMessage: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  scheduledFor: z.string().optional(),
  customData: z.record(z.any()).optional(),
});

const templateDemoControlSchema = z.object({
  useCustomTemplate: z.boolean().default(false),
  customTemplateId: z.string().optional(),
  fallbackSubject: z.string().default('Building Alert'),
  fallbackBody: z.string().default('You have received a building notification.'),
});

type TemplateDemoPayload = z.infer<typeof templateDemoPayloadSchema>;
type TemplateDemoControls = z.infer<typeof templateDemoControlSchema>;

/**
 * Template-aware workflow that demonstrates xnovu_render functionality
 */
export const templateDemoWorkflow = workflow(
  'template-demo-workflow',
  async ({ step, payload }: { step: any; payload: TemplateDemoPayload }) => {
    // Prepare template variables
    const templateVariables = {
      recipient: {
        id: payload.recipientId,
      },
      building: {
        id: payload.buildingId,
        name: payload.buildingName,
      },
      alert: {
        type: payload.alertType,
        message: payload.alertMessage,
        priority: payload.priority,
      },
      timestamp: new Date().toISOString(),
      ...payload.customData,
    };

    // Email step with template rendering
    await step.email(
      'template-email',
      async (controls: TemplateDemoControls) => {
        try {
          if (controls.useCustomTemplate && controls.customTemplateId) {
            // Use custom template from database
            const rendered = await renderEmailTemplate(
              payload.enterpriseId,
              controls.customTemplateId,
              templateVariables
            );
            return rendered;
          } else if (payload.templateId) {
            // Use template from payload
            const rendered = await renderEmailTemplate(
              payload.enterpriseId,
              payload.templateId,
              templateVariables
            );
            return rendered;
          } else {
            // Use fallback template with xnovu_render syntax
            const fallbackTemplate = `Subject: ${controls.fallbackSubject}
{{ xnovu_render('default-email-header', { buildingName: building.name }) }}

<h2>Building Alert: {{ alert.type }}</h2>
<p><strong>Building:</strong> {{ building.name }}</p>
<p><strong>Priority:</strong> {{ alert.priority }}</p>
<p><strong>Message:</strong> {{ alert.message }}</p>
<p><strong>Time:</strong> {{ timestamp }}</p>

{{ xnovu_render('default-email-footer', { buildingName: building.name }) }}`;

            const rendered = await renderTemplateForStep({
              enterpriseId: payload.enterpriseId,
              fallbackTemplate,
              variables: templateVariables,
              channelType: 'EMAIL'
            });

            return {
              subject: rendered.subject || controls.fallbackSubject,
              body: rendered.body
            };
          }
        } catch (error) {
          console.error('[template-demo-workflow] Email rendering error:', error);
          // Fallback to basic template
          return {
            subject: `${controls.fallbackSubject} - ${payload.buildingName}`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Building Alert: ${payload.alertType}</h2>
                <p><strong>Building:</strong> ${payload.buildingName}</p>
                <p><strong>Priority:</strong> ${payload.priority}</p>
                <p><strong>Message:</strong> ${payload.alertMessage}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <hr>
                <p style="font-size: 12px; color: #666;">
                  This is a fallback message due to template rendering error.
                </p>
              </div>
            `
          };
        }
      },
      {
        controlSchema: templateDemoControlSchema,
      }
    );

    // In-app notification step
    await step.inApp(
      'template-in-app',
      async (controls: TemplateDemoControls) => {
        try {
          if (payload.templateId) {
            const rendered = await renderInAppTemplate(
              payload.enterpriseId,
              payload.templateId,
              templateVariables
            );
            return {
              subject: rendered.subject || `${payload.alertType} Alert`,
              body: rendered.body
            };
          } else {
            // Use fallback template with xnovu_render
            const fallbackTemplate = `{{ xnovu_render('in-app-alert', { alertType: alert.type, buildingName: building.name, message: alert.message }) }}`;
            
            const rendered = await renderTemplateForStep({
              enterpriseId: payload.enterpriseId,
              fallbackTemplate,
              variables: templateVariables,
              channelType: 'IN_APP'
            });

            return {
              subject: `${payload.alertType} - ${payload.buildingName}`,
              body: rendered.body
            };
          }
        } catch (error) {
          console.error('[template-demo-workflow] In-app rendering error:', error);
          // Fallback to basic notification
          return {
            subject: `${payload.alertType} Alert - ${payload.buildingName}`,
            body: `${payload.alertMessage} (Priority: ${payload.priority})`
          };
        }
      },
      {
        controlSchema: templateDemoControlSchema,
      }
    );

    // Conditional SMS step for high priority alerts
    if (payload.priority === 'HIGH' || payload.priority === 'CRITICAL') {
      await step.sms(
        'template-sms',
        async () => {
          try {
            // SMS templates are typically shorter
            const smsTemplate = `{{ xnovu_render('sms-alert', { buildingName: building.name, alertType: alert.type, message: alert.message }) }}`;
            
            const rendered = await renderTemplateForStep({
              enterpriseId: payload.enterpriseId,
              fallbackTemplate: smsTemplate,
              variables: templateVariables,
              channelType: 'SMS'
            });

            return {
              body: rendered.body
            };
          } catch (error) {
            console.error('[template-demo-workflow] SMS rendering error:', error);
            // Fallback SMS
            return {
              body: `ALERT: ${payload.alertType} at ${payload.buildingName}. ${payload.alertMessage}`
            };
          }
        }
      );
    }
  },
  {
    payloadSchema: templateDemoPayloadSchema,
    name: 'Template Demo Workflow',
    description: 'Demonstrates template rendering with xnovu_render syntax',
    tags: ['template', 'demo', 'building-alert'],
  }
);

export default templateDemoWorkflow;