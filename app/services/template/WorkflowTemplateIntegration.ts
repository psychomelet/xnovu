import { renderTemplateForWorkflow } from './TemplateAwareEmail';
import { getTemplateRenderer } from './TemplateRenderer';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/supabase/database.types';

type NotificationTemplate = Database['notify']['Tables']['ent_notification_template']['Row'];
type ChannelType = Database['shared_types']['Enums']['notification_channel_type'];

interface WorkflowStepResult {
  subject?: string;
  body: string;
}

interface WorkflowTemplateContext {
  enterpriseId: string;
  templateKey?: string;
  fallbackTemplate?: string;
  variables: Record<string, any>;
  channelType: ChannelType;
}

/**
 * Integration service for using templates in Novu workflows
 */
export class WorkflowTemplateIntegration {
  private templateRenderer = getTemplateRenderer();

  /**
   * Render template for workflow step
   * Can use either templateKey (database) or fallbackTemplate (inline)
   */
  async renderForWorkflowStep(
    context: WorkflowTemplateContext
  ): Promise<WorkflowStepResult> {
    let template: string;

    if (context.templateKey) {
      // Load template from database
      const dbTemplate = await this.loadTemplateFromDb(
        context.templateKey,
        context.enterpriseId,
        context.channelType
      );
      
      // Combine subject and body for processing
      template = dbTemplate.subject_template
        ? `Subject: ${dbTemplate.subject_template}\n${dbTemplate.body_template}`
        : dbTemplate.body_template;
    } else if (context.fallbackTemplate) {
      // Use inline template
      template = context.fallbackTemplate;
    } else {
      throw new Error('Either templateKey or fallbackTemplate must be provided');
    }

    // Render the template
    return await renderTemplateForWorkflow(
      template,
      context.enterpriseId,
      context.variables
    );
  }

  /**
   * Load template from database with enterprise and channel filtering
   */
  private async loadTemplateFromDb(
    templateKey: string,
    enterpriseId: string,
    channelType: ChannelType
  ): Promise<NotificationTemplate> {
    // This would normally use the TemplateRenderer's database access
    // but for direct workflow integration we'll use a direct query
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    const { data: template, error } = await supabase
      .schema('notify')
      .from('ent_notification_template')
      .select('*')
      .eq('template_key', templateKey)
      .eq('enterprise_id', enterpriseId)
      .eq('channel_type', channelType)
      .eq('publish_status', 'PUBLISH')
      .eq('deactivated', false)
      .single();

    if (error || !template) {
      throw new Error(
        `Template not found: ${templateKey} (enterprise: ${enterpriseId}, channel: ${channelType})`
      );
    }

    return template;
  }

  /**
   * Validate that a template exists and is accessible
   */
  async validateTemplateAccess(
    templateKey: string,
    enterpriseId: string,
    channelType: ChannelType
  ): Promise<boolean> {
    try {
      await this.loadTemplateFromDb(templateKey, enterpriseId, channelType);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Render template with validation
   */
  async renderWithValidation(
    template: string,
    enterpriseId: string,
    variables: Record<string, any>
  ): Promise<{ result: WorkflowStepResult; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Validate template first
      const validation = await this.templateRenderer.validateTemplate(
        template,
        enterpriseId
      );
      
      if (!validation.valid) {
        errors.push(...validation.errors);
      }

      // Render even if validation has warnings
      const result = await renderTemplateForWorkflow(
        template,
        enterpriseId,
        variables
      );

      return { result, errors };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      
      // Return fallback result
      return {
        result: {
          subject: 'Notification',
          body: `Template rendering failed: ${errorMessage}`
        },
        errors
      };
    }
  }
}

// Singleton instance
let workflowTemplateIntegration: WorkflowTemplateIntegration | null = null;

export function getWorkflowTemplateIntegration(): WorkflowTemplateIntegration {
  if (!workflowTemplateIntegration) {
    workflowTemplateIntegration = new WorkflowTemplateIntegration();
  }
  return workflowTemplateIntegration;
}

/**
 * Helper function for easy integration in workflow steps
 */
export async function renderTemplateForStep(
  context: WorkflowTemplateContext
): Promise<WorkflowStepResult> {
  const integration = getWorkflowTemplateIntegration();
  return await integration.renderForWorkflowStep(context);
}

/**
 * Helper function for email workflow steps
 */
export async function renderEmailTemplate(
  enterpriseId: string,
  templateKey: string,
  variables: Record<string, any>
): Promise<{ subject: string; body: string }> {
  const result = await renderTemplateForStep({
    enterpriseId,
    templateKey,
    variables,
    channelType: 'EMAIL'
  });

  return {
    subject: result.subject || 'Notification',
    body: result.body
  };
}

/**
 * Helper function for in-app workflow steps
 */
export async function renderInAppTemplate(
  enterpriseId: string,
  templateKey: string,
  variables: Record<string, any>
): Promise<{ subject?: string; body: string }> {
  return await renderTemplateForStep({
    enterpriseId,
    templateKey,
    variables,
    channelType: 'IN_APP'
  });
}

/**
 * Helper function for SMS workflow steps
 */
export async function renderSmsTemplate(
  enterpriseId: string,
  templateKey: string,
  variables: Record<string, any>
): Promise<{ body: string }> {
  const result = await renderTemplateForStep({
    enterpriseId,
    templateKey,
    variables,
    channelType: 'SMS'
  });

  return { body: result.body };
}