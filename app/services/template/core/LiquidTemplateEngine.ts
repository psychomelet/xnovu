import { Liquid } from 'liquidjs';
import { TemplateLoader } from '../loaders/TemplateLoader';
import { TemplateContext, RenderResult } from './TemplateEngine';

export class LiquidTemplateEngine {
  private liquid: Liquid;
  private templateLoader: TemplateLoader;
  private renderCache = new Map<string, Set<string>>();

  constructor(templateLoader: TemplateLoader) {
    this.templateLoader = templateLoader;
    this.liquid = new Liquid({
      cache: process.env.NODE_ENV === 'production',
      strictFilters: true,
      strictVariables: false,
      trimTagRight: false,
      trimTagLeft: false,
      trimOutputRight: false,
      trimOutputLeft: false,
      greedy: false,
      globals: {
        maxTemplateDepth: 10
      }
    });

    // Register custom xnovu_render tag
    this.registerXnovuRenderTag();
    
    // Add helper methods to liquid options
    (this.liquid.options as any).hasLegacySyntax = (template: string) => this.hasLegacySyntax(template);
    (this.liquid.options as any).convertLegacyToLiquid = (template: string) => this.convertLegacyToLiquid(template);
  }

  /**
   * Register the custom xnovu_render tag for Liquid
   * Usage: {% xnovu_render "template_key" variable1: "value1", variable2: "value2" %}
   */
  private registerXnovuRenderTag() {
    const templateLoader = this.templateLoader;
    const liquid = this.liquid;

    // Helper function to parse variables
    const parseVariables = (variableStr: string, scope: any): Record<string, any> => {
      if (!variableStr) return {};

      const variables: Record<string, any> = {};
      
      // Parse key:value pairs
      const pairs = variableStr.split(',').map(s => s.trim());
      for (const pair of pairs) {
        const [key, ...valueParts] = pair.split(':').map(s => s.trim());
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          
          // Evaluate the value in the current scope
          try {
            // Try to get variable from scope first
            if (scope.get(value) !== undefined) {
              variables[key] = scope.get(value);
            } else if (value.startsWith('"') && value.endsWith('"')) {
              // String literal
              variables[key] = value.slice(1, -1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
              // String literal
              variables[key] = value.slice(1, -1);
            } else if (value === 'true' || value === 'false') {
              // Boolean
              variables[key] = value === 'true';
            } else if (!isNaN(Number(value))) {
              // Number
              variables[key] = Number(value);
            } else {
              // Try to get nested value from scope
              variables[key] = scope.get(value) || value;
            }
          } catch (e) {
            variables[key] = value;
          }
        }
      }

      return variables;
    };

    this.liquid.registerTag('xnovu_render', {
      parse(tagToken) {
        // Parse template key and variables
        const args = tagToken.args.trim();
        // Updated regex to handle comma separator
        const match = args.match(/^["']([^"']+)["'](?:\s*,\s*(.+))?$/);
        
        if (!match) {
          throw new Error(`Invalid xnovu_render syntax: ${args}`);
        }

        this.templateKey = match[1];
        this.variableStr = match[2] || '';
      },

      async render(scope) {
        try {
          // Get the current rendering context
          const context = scope.getAll() as TemplateContext;
          const templateKey = this.templateKey;

          // Track template dependencies for circular detection
          const renderPath = context._renderPath || [];
          if (renderPath.includes(templateKey)) {
            throw new Error(`Circular dependency detected: ${renderPath.join(' -> ')} -> ${templateKey}`);
          }
          
          // Check max depth
          const maxDepth = context._maxDepth || this.liquid.options.globals?.maxTemplateDepth || 10;
          if (renderPath.length >= maxDepth) {
            throw new Error(`Maximum template depth (${maxDepth}) exceeded`);
          }

          // Parse variables passed to the tag
          const tagVariables = parseVariables(this.variableStr, scope);

          // Load the template
          const loadResult = await templateLoader.loadTemplate(
            templateKey,
            context
          );

          // Create nested context - merge variables properly
          const nestedContext = {
            ...context,
            ...tagVariables,
            ...context.variables,
            ...tagVariables,
            _renderPath: [...renderPath, templateKey]
          };

          // Track loaded template
          if (context._templatesLoaded) {
            context._templatesLoaded.push(templateKey);
          }

          // Convert legacy syntax in loaded template if needed
          let templateContent = loadResult.template.bodyTemplate;
          if (this.liquid.options.hasLegacySyntax && this.liquid.options.hasLegacySyntax(templateContent)) {
            templateContent = this.liquid.options.convertLegacyToLiquid(templateContent);
          }

          // Render the loaded template
          const rendered = await liquid.parseAndRender(
            templateContent,
            nestedContext
          );

          return rendered;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[LiquidTemplateEngine] Error rendering template '${this.templateKey}':`, errorMessage);
          
          // Add error to context if available
          const ctx = scope.getAll();
          if (ctx._errors) {
            ctx._errors.push({
              templateKey: this.templateKey,
              error: error instanceof Error ? error : new Error(errorMessage)
            });
          }
          
          // Use custom error placeholder if available
          const errorPlaceholder = ctx._errorPlaceholder || '[Template Error: {{key}}]';
          return errorPlaceholder.replace('{{key}}', this.templateKey);
        }
      }
    });
  }

  /**
   * Render a template string with Liquid
   */
  async render(
    template: string,
    context: TemplateContext,
    options?: { maxDepth?: number; errorPlaceholder?: string }
  ): Promise<RenderResult> {
    const startTime = Date.now();
    const errors: RenderResult['errors'] = [];
    const templatesLoaded: string[] = [];

    try {
      // Check if template uses legacy syntax
      if (this.hasLegacySyntax(template)) {
        template = this.convertLegacyToLiquid(template);
      }

      // Add context helpers - ensure variables are at root level for Liquid
      const renderContext = {
        ...context,
        ...context.variables,
        _renderPath: [],
        _templatesLoaded: templatesLoaded,
        _errors: errors,
        _maxDepth: options?.maxDepth || 10,
        _errorPlaceholder: options?.errorPlaceholder
      };

      // Render with Liquid
      const content = await this.liquid.parseAndRender(template, renderContext);

      return {
        content,
        errors,
        metadata: {
          templatesLoaded: [...new Set(templatesLoaded)],
          renderTime: Date.now() - startTime,
          depth: templatesLoaded.length > 0 ? Math.max(...templatesLoaded.map(() => 1)) : 0
        }
      };
    } catch (error) {
      const renderError = {
        templateKey: 'root',
        error: error instanceof Error ? error : new Error(String(error))
      };
      errors.push(renderError);

      return {
        content: template,
        errors,
        metadata: {
          renderTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Render a template by its key
   */
  async renderByKey(
    templateKey: string,
    context: TemplateContext,
    options?: { maxDepth?: number; errorPlaceholder?: string }
  ): Promise<RenderResult> {
    try {
      const loadResult = await this.templateLoader.loadTemplate(templateKey, context);
      
      const renderContext = {
        ...context,
        ...loadResult.template.variablesDescription,
        ...context.variables,
        variables: {
          ...loadResult.template.variablesDescription,
          ...context.variables
        }
      };

      const bodyResult = await this.render(
        loadResult.template.bodyTemplate,
        renderContext,
        options
      );

      let subjectResult: RenderResult | undefined;
      if (loadResult.template.subjectTemplate) {
        subjectResult = await this.render(
          loadResult.template.subjectTemplate,
          renderContext,
          options
        );
      }

      return {
        content: bodyResult.content,
        errors: [
          ...bodyResult.errors,
          ...(subjectResult?.errors || [])
        ],
        metadata: {
          ...bodyResult.metadata,
          subject: subjectResult?.content,
          templateKey,
          templateName: loadResult.template.name,
          templatesLoaded: [templateKey, ...(bodyResult.metadata?.templatesLoaded || [])]
        }
      };
    } catch (error) {
      const errorPlaceholder = options?.errorPlaceholder || '[Template Error: {{key}}]';
      return {
        content: errorPlaceholder.replace('{{key}}', templateKey),
        errors: [{
          templateKey,
          error: error instanceof Error ? error : new Error(String(error))
        }]
      };
    }
  }

  /**
   * Check if template contains legacy xnovu_render syntax
   */
  private hasLegacySyntax(template: string): boolean {
    return /\{\{\s*xnovu_render\s*\(/.test(template);
  }

  /**
   * Convert legacy {{ xnovu_render('key', {...}) }} to {% xnovu_render "key" ... %}
   */
  private convertLegacyToLiquid(template: string): string {
    const regex = /\{\{\s*xnovu_render\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\{(?:[^{}]|\{[^}]*\})*\})\s*\)\s*\}\}/g;
    
    return template.replace(regex, (match, templateKey, variablesJson) => {
      try {
        // Parse the variables object
        const variables = this.parseVariablesJson(variablesJson);
        
        // Convert to Liquid syntax
        const variablePairs = Object.entries(variables)
          .map(([key, value]) => {
            if (typeof value === 'string') {
              return `${key}: "${value}"`;
            } else if (typeof value === 'object') {
              // For complex objects, reference them from context
              return `${key}: ${key}`;
            } else {
              return `${key}: ${value}`;
            }
          })
          .join(', ');

        const tag = variablePairs 
          ? `xnovu_render "${templateKey}", ${variablePairs}`
          : `xnovu_render "${templateKey}"`;
        
        // Return Liquid tag - Liquid automatically preserves surrounding whitespace
        return `{% ${tag} %}`;
      } catch (error) {
        console.error('[LiquidTemplateEngine] Failed to convert legacy syntax:', error);
        return match;
      }
    });
  }

  /**
   * Safely parse variables JSON (without using new Function)
   */
  private parseVariablesJson(variablesJson: string): Record<string, any> {
    try {
      // Handle simple empty object
      if (variablesJson.trim() === '{}') {
        return {};
      }

      // More sophisticated JSON parsing
      let cleaned = variablesJson.trim();
      
      // Replace unquoted keys with quoted keys
      cleaned = cleaned.replace(/(\{|,)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
      
      // Handle single quotes in string values
      // Match strings that start and end with single quotes
      cleaned = cleaned.replace(/:\s*'([^']*)'/g, (match, content) => {
        // Escape any double quotes in the content
        const escaped = content.replace(/"/g, '\\"');
        return `:"${escaped}"`;
      });
      
      // Handle nested objects and arrays
      cleaned = cleaned.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '"$1":');
      
      // Parse the cleaned JSON
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('[LiquidTemplateEngine] Failed to parse variables JSON:', variablesJson, error);
      return {};
    }
  }

  /**
   * Validate template syntax
   */
  async validate(template: string, context?: Partial<TemplateContext>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Convert legacy syntax if needed
      if (this.hasLegacySyntax(template)) {
        template = this.convertLegacyToLiquid(template);
      }

      // Parse template to check syntax
      await this.liquid.parse(template);
      
      // Check for referenced templates
      const xnovuMatches = this.extractXnovuRenderTags(template);
      if (this.templateLoader.templateExists) {
        for (const templateKey of xnovuMatches) {
          try {
            const exists = await this.templateLoader.templateExists(templateKey, context);
            if (!exists) {
              errors.push(`Template not found: ${templateKey}`);
            }
          } catch (error) {
            // Skip on error
          }
        }
      }
      
      return { valid: errors.length === 0, errors };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Check if it's an empty variable placeholder error
      if (errorMessage.includes('invalid value expression: ""')) {
        const match = errorMessage.match(/line:(\d+), col:(\d+)/);
        if (match) {
          const col = parseInt(match[2]);
          errors.push(`Empty variable placeholder at position ${col - 3}`);
        } else {
          errors.push(errorMessage);
        }
      } else {
        errors.push(errorMessage);
      }
      return { valid: false, errors };
    }
  }
  
  /**
   * Extract xnovu_render template keys from a template
   */
  private extractXnovuRenderTags(template: string): string[] {
    const tags: string[] = [];
    
    // Match legacy syntax
    const legacyRegex = /\{\{\s*xnovu_render\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = legacyRegex.exec(template)) !== null) {
      tags.push(match[1]);
    }
    
    // Match Liquid syntax
    const liquidRegex = /\{%\s*xnovu_render\s+["']([^"']+)["']/g;
    while ((match = liquidRegex.exec(template)) !== null) {
      tags.push(match[1]);
    }
    
    return [...new Set(tags)];
  }
}