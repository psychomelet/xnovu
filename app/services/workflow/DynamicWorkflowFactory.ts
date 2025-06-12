import { workflow } from '@novu/framework';
import { z } from 'zod';
import type { WorkflowConfig } from '../database/WorkflowService';
import { notificationService } from '../database/NotificationService';
import { getTemplateRenderer } from '../template/TemplateRenderer';

export class DynamicWorkflowFactory {
  static createDynamicWorkflow(config: WorkflowConfig, enterpriseId: string) {
    return workflow(
      config.workflow_key,
      async ({ step, payload }) => {
        // Update status to PROCESSING
        if (payload.notificationId) {
          const parsedNotificationId = typeof payload.notificationId === 'string' 
            ? parseInt(payload.notificationId) 
            : payload.notificationId;
          await notificationService.updateNotificationStatus(
            parsedNotificationId,
            'PROCESSING',
            enterpriseId
          );
        }

        try {
          // Dynamic channel execution based on config
          for (const channel of config.channels) {
            switch (channel.toUpperCase()) {
              case 'EMAIL':
                if (config.emailTemplateId) {
                  await step.email('dynamic-email', async () => {
                    const templateRenderer = getTemplateRenderer();
                    const renderedContent = await templateRenderer.renderTemplate(
                      String(config.emailTemplateId),
                      enterpriseId,
                      payload.data || {}
                    );

                    return {
                      subject: renderedContent.subject || 'Notification',
                      body: renderedContent.body
                    };
                  });
                }
                break;

              case 'IN_APP':
              case 'INAPP':
                if (config.inAppTemplateId) {
                  await step.inApp('dynamic-in-app', async () => {
                    const templateRenderer = getTemplateRenderer();
                    const renderedContent = await templateRenderer.renderTemplate(
                      String(config.inAppTemplateId),
                      enterpriseId,
                      payload.data || {}
                    );

                    return {
                      subject: renderedContent.subject,
                      body: renderedContent.body,
                      data: payload.data || {}
                    };
                  });
                }
                break;

              case 'SMS':
                if (config.smsTemplateId) {
                  await step.sms('dynamic-sms', async () => {
                    const templateRenderer = getTemplateRenderer();
                    const renderedContent = await templateRenderer.renderTemplate(
                      String(config.smsTemplateId),
                      enterpriseId,
                      payload.data || {}
                    );

                    return {
                      body: renderedContent.body
                    };
                  });
                }
                break;

              case 'PUSH':
                if (config.pushTemplateId) {
                  await step.push('dynamic-push', async () => {
                    const templateRenderer = getTemplateRenderer();
                    const renderedContent = await templateRenderer.renderTemplate(
                      String(config.pushTemplateId),
                      enterpriseId,
                      payload.data || {}
                    );

                    return {
                      title: renderedContent.subject || 'Notification',
                      body: renderedContent.body
                    } as any;
                  });
                }
                break;

              default:
                console.warn(`Unsupported channel: ${channel}`);
            }
          }

          // Update status to SENT
          if (payload.notificationId) {
            const parsedNotificationId = typeof payload.notificationId === 'string' 
              ? parseInt(payload.notificationId) 
              : payload.notificationId;
            await notificationService.updateNotificationStatus(
              parsedNotificationId,
              'SENT',
              enterpriseId
            );
          }
        } catch (error) {
          // Update status to FAILED
          if (payload.notificationId) {
            const parsedNotificationId = typeof payload.notificationId === 'string' 
              ? parseInt(payload.notificationId) 
              : payload.notificationId;
            await notificationService.updateNotificationStatus(
              parsedNotificationId,
              'FAILED',
              enterpriseId,
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
          throw error;
        }
      },
      {
        // Use provided schema or default schema
        payloadSchema: config.payloadSchema ? 
          z.object(config.payloadSchema) : 
          z.object({
            notificationId: z.string().optional(),
            data: z.record(z.any()).optional(),
            subscriberId: z.string().optional(),
            enterprise_id: z.string().optional()
          }),
        name: config.name,
        description: config.description,
        tags: config.tags || ['dynamic']
      }
    );
  }

  static validateWorkflowConfig(config: WorkflowConfig): boolean {
    // Basic validation
    if (!config.workflow_key || !config.channels || config.channels.length === 0) {
      return false;
    }

    // Validate each channel has corresponding template
    for (const channel of config.channels) {
      switch (channel.toUpperCase()) {
        case 'EMAIL':
          if (!config.emailTemplateId) return false;
          break;
        case 'IN_APP':
        case 'INAPP':
          if (!config.inAppTemplateId) return false;
          break;
        case 'SMS':
          if (!config.smsTemplateId) return false;
          break;
        case 'PUSH':
          if (!config.pushTemplateId) return false;
          break;
        default:
          return false; // Unknown channel
      }
    }

    return true;
  }

  static createDefaultPayloadSchema() {
    return z.object({
      notificationId: z.string().optional(),
      data: z.record(z.any()).optional(),
      subscriberId: z.string().optional(),
      enterprise_id: z.string().optional(),
      buildingId: z.string().optional(),
      campusId: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      category: z.enum(['maintenance', 'security', 'facility', 'emergency', 'general']).optional()
    });
  }
}

export const dynamicWorkflowFactory = new DynamicWorkflowFactory();