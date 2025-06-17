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
    return this.liquidEngine.render(template, context, options);
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
   * For now, use regex-based extraction. Could be enhanced with Liquid's AST in the future.
   */
  async extractVariables(
    template: string,
    context?: Partial<TemplateContext>
  ): Promise<string[]> {
    const variables = new Set<string>();
    
    // Extract Liquid variables
    const liquidVarRegex = /\{\{\s*([^}|]+)(?:\s*\|[^}]+)?\s*\}\}/g;
    let match;
    while ((match = liquidVarRegex.exec(template)) !== null) {
      const varName = match[1].trim();
      if (!varName.includes('xnovu_render')) {
        variables.add(varName);
      }
    }
    
    // Extract variables from xnovu_render tags
    const xnovuRegex = /\{%\s*xnovu_render\s+["']([^"']+)["'](?:\s*,\s*([^%]+))?\s*%\}/g;
    while ((match = xnovuRegex.exec(template)) !== null) {
      if (match[2]) {
        // Extract variable references from the arguments
        const argStr = match[2];
        const varMatches = argStr.match(/[a-zA-Z_][a-zA-Z0-9_.]*/g);
        if (varMatches) {
          varMatches.forEach(v => {
            if (!['true', 'false', 'null', 'undefined'].includes(v)) {
              variables.add(v);
            }
          });
        }
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