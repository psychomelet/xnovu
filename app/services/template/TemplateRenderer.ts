import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../lib/supabase/database.types';

type NotificationTemplate = Database['notify']['Tables']['ent_notification_template']['Row'];
type ChannelType = Database['shared_types']['Enums']['notification_channel_type'];

interface CompiledTemplate {
  subject?: string;
  body: string;
  variables: Record<string, any>;
  compiledAt: Date;
}

interface TemplateContext {
  enterpriseId: string;
  variables: Record<string, any>;
}

interface XNovuRenderMatch {
  fullMatch: string;
  templateKey: string;
  variables: Record<string, any>;
  startIndex: number;
  endIndex: number;
}

export class TemplateRenderer {
  private cache = new Map<string, CompiledTemplate>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
  }

  /**
   * Main render method that processes templates with xnovu_render syntax
   */
  async render(
    template: string,
    context: TemplateContext
  ): Promise<string> {
    try {
      // Step 1: Parse and process xnovu_render calls
      const processedTemplate = await this.processXNovuRenderCalls(
        template,
        context
      );

      // Step 2: Interpolate standard variables
      return this.interpolateVariables(processedTemplate, context.variables);
    } catch (error) {
      console.error('[TemplateRenderer] Render error:', error);
      throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process all xnovu_render calls in the template
   */
  private async processXNovuRenderCalls(
    template: string,
    context: TemplateContext
  ): Promise<string> {
    const xnovuMatches = this.parseXNovuRenderSyntax(template);
    
    if (xnovuMatches.length === 0) {
      return template;
    }

    let result = template;
    
    // Process matches in reverse order to maintain string indices
    for (const match of xnovuMatches.reverse()) {
      try {
        // Load template from database
        const dbTemplate = await this.loadTemplate(
          match.templateKey,
          context.enterpriseId
        );

        // Create merged context for nested rendering
        const nestedContext: TemplateContext = {
          enterpriseId: context.enterpriseId,
          variables: {
            ...context.variables,
            ...match.variables
          }
        };

        // Recursively render the loaded template
        const renderedContent = await this.render(
          dbTemplate.body_template,
          nestedContext
        );

        // Replace the xnovu_render call with rendered content
        result = result.substring(0, match.startIndex) + 
                 renderedContent + 
                 result.substring(match.endIndex);
      } catch (error) {
        console.error(`[TemplateRenderer] Failed to process template ${match.templateKey}:`, error);
        // Replace with error message instead of breaking the entire template
        const errorMessage = `[Template Error: ${match.templateKey}]`;
        result = result.substring(0, match.startIndex) + 
                 errorMessage + 
                 result.substring(match.endIndex);
      }
    }

    return result;
  }

  /**
   * Parse xnovu_render syntax from template string
   * Syntax: {{ xnovu_render('template_key', { variable: 'value' }) }}
   */
  private parseXNovuRenderSyntax(template: string): XNovuRenderMatch[] {
    const regex = /\{\{\s*xnovu_render\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\{(?:[^{}]|\{[^}]*\})*\})\s*\)\s*\}\}/g;
    const matches: XNovuRenderMatch[] = [];
    let match;

    while ((match = regex.exec(template)) !== null) {
      try {
        const [fullMatch, templateKey, variablesJson] = match;
        const variables = this.parseVariablesJson(variablesJson);

        matches.push({
          fullMatch,
          templateKey,
          variables,
          startIndex: match.index,
          endIndex: match.index + fullMatch.length
        });
      } catch (error) {
        console.error('[TemplateRenderer] Failed to parse xnovu_render match:', error);
        // Continue processing other matches
      }
    }

    return matches;
  }

  /**
   * Safely parse variables JSON with error handling
   */
  private parseVariablesJson(variablesJson: string): Record<string, any> {
    try {
      // Handle simple cases first
      if (variablesJson.trim() === '{}') {
        return {};
      }

      // Use Function constructor for safer evaluation than eval
      // This allows for more complex object syntax while being safer than eval
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
   * Load template from database with caching
   */
  private async loadTemplate(
    templateKey: string,
    enterpriseId: string
  ): Promise<NotificationTemplate> {
    const cacheKey = `${enterpriseId}:${templateKey}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached.compiledAt)) {
      return {
        id: 0, // Placeholder since we're using template_key
        body_template: cached.body,
        subject_template: cached.subject || null,
        variables_description: cached.variables,
        // Add other required fields with defaults
        name: '',
        description: null,
        publish_status: 'PUBLISH' as const,
        deactivated: false,
        typ_notification_category_id: null,
        business_id: null,
        channel_type: 'EMAIL' as ChannelType,
        repr: null,
        enterprise_id: enterpriseId,
        template_key: templateKey,
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null
      };
    }

    // Load from database
    const { data: template, error } = await this.supabase
      .schema('notify')
      .from('ent_notification_template')
      .select('*')
      .eq('template_key', templateKey)
      .eq('enterprise_id', enterpriseId)
      .eq('publish_status', 'PUBLISH')
      .eq('deactivated', false)
      .single();

    if (error || !template) {
      throw new Error(`Template not found: ${templateKey} (enterprise: ${enterpriseId})`);
    }

    // Cache the template
    this.cache.set(cacheKey, {
      subject: template.subject_template || undefined,
      body: template.body_template,
      variables: (template.variables_description as Record<string, any>) || {},
      compiledAt: new Date()
    });

    return template;
  }

  /**
   * Interpolate standard template variables
   * Supports: {{variable}}, {{object.property}}, {{array[0]}}
   */
  private interpolateVariables(
    template: string,
    variables: Record<string, any>
  ): string {
    // Simple variable interpolation regex
    const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;
    
    return template.replace(variableRegex, (match, variablePath) => {
      try {
        const value = this.getNestedValue(variables, variablePath.trim());
        return value !== undefined ? String(value) : match;
      } catch (error) {
        console.warn(`[TemplateRenderer] Failed to interpolate variable: ${variablePath}`, error);
        return match;
      }
    });
  }

  /**
   * Get nested value from object using dot notation
   * Example: getNestedValue(obj, 'user.profile.name')
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      // Handle array access like [0]
      const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        return current?.[arrayKey]?.[parseInt(index)];
      }
      return current?.[key];
    }, obj);
  }

  /**
   * Check if cached template is still valid
   */
  private isCacheValid(compiledAt: Date): boolean {
    return Date.now() - compiledAt.getTime() < this.cacheTTL;
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, template] of this.cache.entries()) {
      if (now - template.compiledAt.getTime() >= this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Validate template syntax without rendering
   */
  async validateTemplate(
    template: string,
    enterpriseId: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Check xnovu_render syntax
      const xnovuMatches = this.parseXNovuRenderSyntax(template);
      
      // Validate that referenced templates exist
      for (const match of xnovuMatches) {
        try {
          await this.loadTemplate(match.templateKey, enterpriseId);
        } catch (error) {
          errors.push(`Template not found: ${match.templateKey}`);
        }
      }

      // Check for basic syntax errors in variable interpolation
      const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;
      let match;
      while ((match = variableRegex.exec(template)) !== null) {
        const variablePath = match[1].trim();
        if (!variablePath) {
          errors.push(`Empty variable placeholder at position ${match.index}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        valid: false,
        errors
      };
    }
  }

  /**
   * Get template usage statistics
   */
  getCacheStats(): {
    totalCached: number;
    validCached: number;
    expiredCached: number;
  } {
    const now = Date.now();
    let validCached = 0;
    let expiredCached = 0;

    for (const template of this.cache.values()) {
      if (now - template.compiledAt.getTime() < this.cacheTTL) {
        validCached++;
      } else {
        expiredCached++;
      }
    }

    return {
      totalCached: this.cache.size,
      validCached,
      expiredCached
    };
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