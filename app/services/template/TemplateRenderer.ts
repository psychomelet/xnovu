import { TemplateEngine, TemplateContext as EngineContext } from './core/TemplateEngine';
import { SupabaseTemplateLoader } from './loaders/SupabaseTemplateLoader';
import type { Database } from '../../../lib/supabase/database.types';

type NotificationTemplate = Database['notify']['Tables']['ent_notification_template']['Row'];
type ChannelType = Database['shared_types']['Enums']['notification_channel_type'];

interface TemplateContext {
  enterpriseId: string;
  variables: Record<string, any>;
}

/**
 * Legacy TemplateRenderer class - now a wrapper around the new architecture
 * Maintained for backward compatibility
 */
export class TemplateRenderer {
  private engine: TemplateEngine;
  private loader: SupabaseTemplateLoader;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.loader = new SupabaseTemplateLoader(supabaseUrl, supabaseKey);
    this.engine = new TemplateEngine(this.loader);
  }

  /**
   * Main render method that processes templates with xnovu_render syntax
   */
  async render(
    template: string,
    context: TemplateContext
  ): Promise<string> {
    const engineContext: EngineContext = {
      enterpriseId: context.enterpriseId,
      variables: context.variables
    };

    const result = await this.engine.render(template, engineContext, {
      throwOnError: true
    });

    return result.content;
  }

  /**
   * Render a template by ID with variables
   */
  async renderTemplate(
    templateId: string,
    enterpriseId: string,
    variables: Record<string, any>
  ): Promise<{ subject?: string; body: string }> {
    const result = await this.engine.renderByKey(templateId, {
      enterpriseId,
      variables
    });

    if (result.errors.length > 0) {
      throw new Error(`Template rendering failed: ${result.errors[0].error.message}`);
    }

    return {
      subject: result.metadata?.subject,
      body: result.content
    };
  }

  /**
   * Validate template syntax without rendering
   */
  async validateTemplate(
    template: string,
    enterpriseId: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    return this.engine.validate(template, { enterpriseId });
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.loader.clearCache();
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    this.loader.clearExpiredCache();
  }

  /**
   * Get template usage statistics
   */
  getCacheStats(): {
    totalCached: number;
    validCached: number;
    expiredCached: number;
  } {
    const stats = this.loader.getStats();
    return {
      totalCached: stats.totalCached || 0,
      validCached: stats.validCached || 0,
      expiredCached: stats.expiredCached || 0
    };
  }

  // ===== Legacy private methods kept for backward compatibility =====
  // These are no longer used internally but may be relied upon by existing code

  /**
   * @deprecated Use TemplateEngine directly
   */
  private async processXNovuRenderCalls(
    template: string,
    context: TemplateContext
  ): Promise<string> {
    return this.render(template, context);
  }

  /**
   * @deprecated Use TemplateParser from core/TemplateParser.ts
   */
  private parseXNovuRenderSyntax(template: string): any[] {
    const { parser } = this.engine.getComponents();
    return parser.parseXNovuRenderSyntax(template);
  }

  /**
   * @deprecated Use TemplateParser from core/TemplateParser.ts
   */
  private parseVariablesJson(variablesJson: string): Record<string, any> {
    try {
      if (variablesJson.trim() === '{}') {
        return {};
      }
      const result = new Function('return ' + variablesJson)();
      if (typeof result !== 'object' || result === null) {
        throw new Error('Variables must be an object');
      }
      return result;
    } catch (error) {
      console.error('[TemplateRenderer] Failed to parse variables JSON:', variablesJson, error);
      return {};
    }
  }

  /**
   * @deprecated Use SupabaseTemplateLoader directly
   */
  private async loadTemplate(
    templateKey: string,
    enterpriseId: string
  ): Promise<NotificationTemplate> {
    const result = await this.loader.loadTemplate(templateKey, { enterpriseId });
    const template = result.template;
    
    // Convert to legacy format
    return {
      id: Number(template.id),
      template_key: template.templateKey,
      body_template: template.bodyTemplate,
      subject_template: template.subjectTemplate || null,
      variables_description: template.variablesDescription,
      name: template.name,
      description: null,
      publish_status: 'PUBLISH' as const,
      deactivated: false,
      typ_notification_category_id: null,
      business_id: null,
      channel_type: (template.channelType as ChannelType) || 'EMAIL',
      repr: null,
      enterprise_id: enterpriseId,
      created_at: new Date().toISOString(),
      created_by: null,
      updated_at: new Date().toISOString(),
      updated_by: null
    };
  }

  /**
   * @deprecated Use VariableInterpolator from core/VariableInterpolator.ts
   */
  private interpolateVariables(
    template: string,
    variables: Record<string, any>
  ): string {
    const { interpolator } = this.engine.getComponents();
    return interpolator.interpolate(template, variables);
  }

  /**
   * @deprecated Use VariableInterpolator from core/VariableInterpolator.ts
   */
  private getNestedValue(obj: any, path: string): any {
    const { interpolator } = this.engine.getComponents();
    return interpolator.extractValue(obj, path);
  }

  /**
   * @deprecated Cache is now managed by SupabaseTemplateLoader
   */
  private isCacheValid(compiledAt: Date): boolean {
    return true; // Always return true as cache is managed by loader
  }
}

// Singleton instance for the application
let templateRenderer: TemplateRenderer | null = null;

export function getTemplateRenderer(): TemplateRenderer {
  if (!templateRenderer) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing for TemplateRenderer');
    }

    templateRenderer = new TemplateRenderer(supabaseUrl, supabaseKey);

    // Set up periodic cache cleanup
    setInterval(() => {
      templateRenderer?.clearExpiredCache();
    }, 10 * 60 * 1000); // Cleanup every 10 minutes
  }

  return templateRenderer;
}