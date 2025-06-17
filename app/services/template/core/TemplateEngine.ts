import { TemplateParser, XNovuRenderMatch } from './TemplateParser';
import { VariableInterpolator } from './VariableInterpolator';
import { TemplateLoader, TemplateNotFoundError } from '../loaders/TemplateLoader';

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
  };
}

export class TemplateEngine {
  private parser: TemplateParser;
  private interpolator: VariableInterpolator;
  private templateLoader: TemplateLoader;
  private readonly defaultOptions: RenderOptions = {
    maxDepth: 10,
    throwOnError: false,
    errorPlaceholder: '[Template Error: {{key}}]'
  };

  constructor(templateLoader: TemplateLoader) {
    this.parser = new TemplateParser();
    this.interpolator = new VariableInterpolator();
    this.templateLoader = templateLoader;
  }

  /**
   * Main render method that processes templates with xnovu_render syntax
   */
  async render(
    template: string,
    context: TemplateContext,
    options?: RenderOptions
  ): Promise<RenderResult> {
    const startTime = Date.now();
    const opts: Required<RenderOptions> = { 
      ...this.defaultOptions, 
      ...options 
    } as Required<RenderOptions>;
    const errors: RenderResult['errors'] = [];
    const templatesLoaded: string[] = [];

    try {
      const result = await this.renderRecursive(
        template,
        context,
        opts,
        0,
        errors,
        templatesLoaded
      );

      return {
        content: result,
        errors,
        metadata: {
          templatesLoaded: [...new Set(templatesLoaded)],
          renderTime: Date.now() - startTime,
          depth: Math.max(...templatesLoaded.map(() => 1), 0)
        }
      };
    } catch (error) {
      if (opts.throwOnError) {
        throw error;
      }
      return {
        content: template,
        errors: [{
          templateKey: 'root',
          error: error instanceof Error ? error : new Error(String(error))
        }]
      };
    }
  }

  /**
   * Render a template by its key
   */
  async renderByKey(
    templateKey: string,
    context: TemplateContext,
    options?: RenderOptions
  ): Promise<RenderResult> {
    const templatesLoaded: string[] = [];
    
    try {
      const loadResult = await this.templateLoader.loadTemplate(templateKey, context);
      templatesLoaded.push(templateKey);
      
      const renderContext = {
        ...context,
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
      const renderError = {
        templateKey,
        error: error instanceof Error ? error : new Error(String(error))
      };

      if (options?.throwOnError) {
        throw error;
      }

      return {
        content: (options?.errorPlaceholder || this.defaultOptions.errorPlaceholder!).replace('{{key}}', templateKey),
        errors: [renderError]
      };
    }
  }

  /**
   * Validate template syntax without rendering
   */
  async validate(
    template: string,
    context?: Partial<TemplateContext>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const syntaxValidation = this.parser.validateSyntax(template);
    if (!syntaxValidation.valid) {
      return syntaxValidation;
    }

    const errors: string[] = [];

    // Check if referenced templates exist
    const xnovuMatches = this.parser.parseXNovuRenderSyntax(template);
    for (const match of xnovuMatches) {
      try {
        const exists = await this.templateLoader.templateExists(
          match.templateKey,
          context
        );
        if (!exists) {
          errors.push(`Template not found: ${match.templateKey}`);
        }
      } catch (error) {
        errors.push(`Failed to check template ${match.templateKey}: ${error}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: [...syntaxValidation.errors, ...errors]
    };
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

    // Extract from nested templates
    const xnovuMatches = this.parser.parseXNovuRenderSyntax(template);
    for (const match of xnovuMatches) {
      try {
        const loadResult = await this.templateLoader.loadTemplate(
          match.templateKey,
          context
        );
        const nestedVars = await this.extractVariables(
          loadResult.template.bodyTemplate,
          context
        );
        nestedVars.forEach(v => variables.add(v));
      } catch (error) {
        console.warn(`Failed to extract variables from ${match.templateKey}:`, error);
      }
    }

    return Array.from(variables);
  }

  /**
   * Private recursive rendering method
   */
  private async renderRecursive(
    template: string,
    context: TemplateContext,
    options: Required<RenderOptions>,
    depth: number,
    errors: RenderResult['errors'],
    templatesLoaded: string[]
  ): Promise<string> {
    // Check max depth to prevent infinite recursion
    if (depth >= options.maxDepth) {
      const error = new Error(`Maximum template depth (${options.maxDepth}) exceeded`);
      errors.push({ templateKey: 'depth-limit', error });
      if (options.throwOnError) {
        throw error;
      }
      return template;
    }

    // Step 1: Process xnovu_render calls
    const processedTemplate = await this.processXNovuRenderCalls(
      template,
      context,
      options,
      depth,
      errors,
      templatesLoaded
    );

    // Step 2: Interpolate standard variables
    return this.interpolator.interpolate(processedTemplate, context.variables);
  }

  /**
   * Process all xnovu_render calls in the template
   */
  private async processXNovuRenderCalls(
    template: string,
    context: TemplateContext,
    options: Required<RenderOptions>,
    depth: number,
    errors: RenderResult['errors'],
    templatesLoaded: string[]
  ): Promise<string> {
    const xnovuMatches = this.parser.parseXNovuRenderSyntax(template);

    if (xnovuMatches.length === 0) {
      return template;
    }

    let result = template;

    // Process matches in reverse order to maintain string indices
    for (const match of xnovuMatches.reverse()) {
      try {
        // Load template from loader
        const loadResult = await this.templateLoader.loadTemplate(
          match.templateKey,
          context
        );
        templatesLoaded.push(match.templateKey);

        // Create merged context for nested rendering
        const nestedContext: TemplateContext = {
          ...context,
          variables: {
            ...context.variables,
            ...match.variables
          }
        };

        // Recursively render the loaded template
        const renderedContent = await this.renderRecursive(
          loadResult.template.bodyTemplate,
          nestedContext,
          options,
          depth + 1,
          errors,
          templatesLoaded
        );

        // Replace the xnovu_render call with rendered content
        result = result.substring(0, match.startIndex) +
                 renderedContent +
                 result.substring(match.endIndex);
      } catch (error) {
        const renderError = {
          templateKey: match.templateKey,
          error: error instanceof Error ? error : new Error(String(error)),
          position: { start: match.startIndex, end: match.endIndex }
        };
        errors.push(renderError);

        if (options.throwOnError) {
          throw error;
        }

        // Replace with error placeholder
        const errorMessage = options.errorPlaceholder.replace('{{key}}', match.templateKey);
        result = result.substring(0, match.startIndex) +
                 errorMessage +
                 result.substring(match.endIndex);
      }
    }

    return result;
  }

  /**
   * Get the underlying components for advanced usage
   */
  getComponents() {
    return {
      parser: this.parser,
      interpolator: this.interpolator,
      templateLoader: this.templateLoader
    };
  }
}