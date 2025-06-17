import { TemplateLoader } from '../loaders/TemplateLoader';
import { LiquidTemplateEngine } from './LiquidTemplateEngine';

export interface TemplateContext {
  variables: Record<string, any>;
  enterpriseId?: string;
  [key: string]: any;
}

export interface RenderOptions {
  maxDepth?: number;
  throwOnError?: boolean;
  errorPlaceholder?: string;
}

export interface RenderResult {
  content: string;
  errors: Array<{
    templateKey: string;
    error: Error;
    position?: { start: number; end: number };
  }>;
  metadata?: {
    templatesLoaded?: string[];
    renderTime?: number;
    depth?: number;
    subject?: string;
    templateKey?: string;
    templateName?: string;
    loadedAt?: Date;
    source?: 'database' | 'cache';
    cacheKey?: string;
    enterpriseId?: string;
    channelType?: string;
    safetyValidation?: {
      safe: boolean;
      warnings: string[];
    };
  };
}

export class TemplateEngine {
  private liquidEngine: LiquidTemplateEngine;

  constructor(templateLoader: TemplateLoader) {
    this.liquidEngine = new LiquidTemplateEngine(templateLoader);
  }

  /**
   * Main render method that processes templates with xnovu_render syntax
   */
  async render(
    template: string,
    context: TemplateContext,
    options?: RenderOptions
  ): Promise<RenderResult> {
    const result = await this.liquidEngine.render(template, context, options);
    
    // Apply throwOnError option
    if (options?.throwOnError && result.errors.length > 0) {
      throw result.errors[0].error;
    }
    
    return result;
  }

  /**
   * Render a template by its key
   */
  async renderByKey(
    templateKey: string,
    context: TemplateContext,
    options?: RenderOptions
  ): Promise<RenderResult> {
    // Delegate to Liquid engine
    return this.liquidEngine.renderByKey(templateKey, context, options);
  }

  /**
   * Validate template syntax without rendering
   */
  async validate(
    template: string,
    context?: Partial<TemplateContext>
  ): Promise<{ valid: boolean; errors: string[] }> {
    // Use Liquid engine for validation
    return this.liquidEngine.validate(template, context);
  }

  /**
   * Extract all variables used in a template (including nested templates)
   */
  async extractVariables(
    template: string,
    context?: Partial<TemplateContext>
  ): Promise<string[]> {
    const variables = new Set<string>();
    
    // Extract direct Liquid variables
    const liquidVarRegex = /\{\{\s*([^}|]+)(?:\s*\|[^}]+)?\s*\}\}/g;
    let match;
    while ((match = liquidVarRegex.exec(template)) !== null) {
      const varName = match[1].trim();
      if (!varName.includes('xnovu_render')) {
        variables.add(varName);
      }
    }
    
    // Extract from legacy xnovu_render syntax
    const legacyRegex = /\{\{\s*xnovu_render\s*\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = legacyRegex.exec(template)) !== null) {
      const templateKey = match[1];
      try {
        const loadResult = await this.liquidEngine.getTemplateLoader().loadTemplate(templateKey, context);
        const nestedVars = await this.extractVariables(loadResult.template.bodyTemplate, context);
        nestedVars.forEach(v => variables.add(v));
      } catch (error) {
        // Skip on error
      }
    }
    
    // Extract from Liquid xnovu_render syntax
    const liquidXnovuRegex = /\{%\s*xnovu_render\s+["']([^"']+)["']/g;
    while ((match = liquidXnovuRegex.exec(template)) !== null) {
      const templateKey = match[1];
      try {
        const loadResult = await this.liquidEngine.getTemplateLoader().loadTemplate(templateKey, context);
        const nestedVars = await this.extractVariables(loadResult.template.bodyTemplate, context);
        nestedVars.forEach(v => variables.add(v));
      } catch (error) {
        // Skip on error
      }
    }
    
    return Array.from(variables);
  }


  /**
   * Get the underlying Liquid engine for advanced usage
   */
  getLiquidEngine(): LiquidTemplateEngine {
    return this.liquidEngine;
  }
}