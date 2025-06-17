import { TemplateParser, XNovuRenderMatch } from './TemplateParser';
import { VariableInterpolator } from './VariableInterpolator';
import { TemplateLoader, TemplateNotFoundError } from '../loaders/TemplateLoader';
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
  private parser: TemplateParser;
  private interpolator: VariableInterpolator;
  private templateLoader: TemplateLoader;
  private liquidEngine: LiquidTemplateEngine;
  private readonly defaultOptions: RenderOptions = {
    maxDepth: 10,
    throwOnError: false,
    errorPlaceholder: '[Template Error: {{key}}]'
  };

  constructor(templateLoader: TemplateLoader) {
    this.parser = new TemplateParser();
    this.interpolator = new VariableInterpolator();
    this.templateLoader = templateLoader;
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
    // Delegate to Liquid engine for rendering
    const result = await this.liquidEngine.render(template, context, options);
    
    // Apply any error handling options
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
    
    // Extract from current template
    const directVars = this.parser.extractVariablePlaceholders(template);
    directVars.forEach(v => variables.add(v));

    // Also check for Liquid variables
    const liquidVarRegex = /\{\{\s*([^}|]+)(?:\s*\|[^}]+)?\s*\}\}/g;
    let match;
    while ((match = liquidVarRegex.exec(template)) !== null) {
      const varName = match[1].trim();
      if (!varName.includes('xnovu_render')) {
        variables.add(varName);
      }
    }

    // Extract from nested templates (both legacy and Liquid syntax)
    const xnovuMatches = this.parser.parseXNovuRenderSyntax(template);
    const liquidMatches = template.matchAll(/\{%\s*xnovu_render\s+["']([^"']+)["'].*?\s*%\}/g);
    
    const allMatches = [
      ...xnovuMatches.map(m => m.templateKey),
      ...Array.from(liquidMatches).map(m => m[1])
    ];

    for (const templateKey of allMatches) {
      try {
        const loadResult = await this.templateLoader.loadTemplate(
          templateKey,
          context
        );
        const nestedVars = await this.extractVariables(
          loadResult.template.bodyTemplate,
          context
        );
        nestedVars.forEach(v => variables.add(v));
      } catch (error) {
        console.warn(`Failed to extract variables from ${templateKey}:`, error);
      }
    }

    return Array.from(variables);
  }


  /**
   * Get the underlying components for advanced usage
   */
  getComponents() {
    return {
      parser: this.parser,
      interpolator: this.interpolator,
      templateLoader: this.templateLoader,
      liquidEngine: this.liquidEngine
    };
  }
}