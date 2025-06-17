import { TemplateEngine, TemplateContext, RenderOptions, RenderResult } from '../core/TemplateEngine';
import { TemplateLoader } from '../loaders/TemplateLoader';
import { sanitizeVariables, validateContentSafety } from '../utils/sanitizeConfig';

export interface ChannelRenderOptions extends RenderOptions {
  channelType: string;
  format?: 'html' | 'text' | 'markdown';
  sanitize?: boolean; // Enable/disable sanitization (default: true)
  validateSafety?: boolean; // Enable/disable safety validation (default: true)
}

export interface ChannelRenderResult extends RenderResult {
  subject?: string;
  channelType: string;
  format?: string;
  safetyValidation?: {
    safe: boolean;
    warnings: string[];
  };
}

export abstract class BaseChannelRenderer {
  protected engine: TemplateEngine;
  protected channelType: string;

  constructor(templateLoader: TemplateLoader, channelType: string) {
    this.engine = new TemplateEngine(templateLoader);
    this.channelType = channelType;
  }

  /**
   * Render a template for this channel
   */
  async render(
    template: string,
    context: TemplateContext,
    options?: ChannelRenderOptions
  ): Promise<ChannelRenderResult> {
    const channelContext = this.prepareContext(context, options);
    const renderOptions = this.prepareOptions(options);
    
    const result = await this.engine.render(template, channelContext, renderOptions);
    
    // Apply post-render sanitization and validation
    const finalResult = await this.postProcessResult(result, options);
    
    return {
      ...finalResult,
      channelType: this.channelType,
      format: options?.format || this.getDefaultFormat()
    };
  }

  /**
   * Render a template by key for this channel
   */
  async renderByKey(
    templateKey: string,
    context: TemplateContext,
    options?: ChannelRenderOptions
  ): Promise<ChannelRenderResult> {
    const channelContext = {
      ...this.prepareContext(context, options),
      channelType: this.channelType
    };
    
    const renderOptions = this.prepareOptions(options);
    const result = await this.engine.renderByKey(templateKey, channelContext, renderOptions);
    
    // Apply post-render sanitization and validation
    const finalResult = await this.postProcessResult(result, options);
    
    return {
      ...finalResult,
      channelType: this.channelType,
      format: options?.format || this.getDefaultFormat(),
      subject: finalResult.metadata?.subject
    };
  }

  /**
   * Validate a template for this channel
   */
  async validate(
    template: string,
    context?: Partial<TemplateContext>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const validation = await this.engine.validate(template, context);
    const channelValidation = this.validateChannelSpecific(template, context);
    
    return {
      valid: validation.valid && channelValidation.valid,
      errors: [...validation.errors, ...channelValidation.errors]
    };
  }

  /**
   * Get underlying template engine
   */
  getEngine(): TemplateEngine {
    return this.engine;
  }

  /**
   * Prepare context with channel-specific defaults and sanitization
   */
  protected prepareContext(context: TemplateContext, options?: ChannelRenderOptions): TemplateContext {
    const shouldSanitize = options?.sanitize !== false; // Default to true
    
    let variables = {
      ...this.getDefaultVariables(),
      ...context.variables
    };
    
    // Sanitize variables if enabled
    if (shouldSanitize && variables) {
      variables = sanitizeVariables(variables, this.channelType);
    }
    
    return {
      ...context,
      channelType: this.channelType,
      variables
    };
  }

  /**
   * Prepare options with channel-specific defaults
   */
  protected prepareOptions(options?: ChannelRenderOptions): RenderOptions {
    return {
      ...this.getDefaultOptions(),
      ...options
    };
  }

  /**
   * Get default format for this channel
   */
  protected abstract getDefaultFormat(): string;

  /**
   * Get default variables for this channel
   */
  protected abstract getDefaultVariables(): Record<string, any>;

  /**
   * Get default render options for this channel
   */
  protected abstract getDefaultOptions(): RenderOptions;

  /**
   * Validate channel-specific requirements
   */
  protected abstract validateChannelSpecific(
    template: string,
    context?: Partial<TemplateContext>
  ): { valid: boolean; errors: string[] };

  /**
   * Post-process rendered result with sanitization and validation
   */
  protected async postProcessResult(
    result: RenderResult,
    options?: ChannelRenderOptions
  ): Promise<RenderResult> {
    const shouldSanitize = options?.sanitize !== false; // Default to true
    const shouldValidate = options?.validateSafety !== false; // Default to true
    
    let processedResult = { ...result };
    
    // Validate content safety BEFORE sanitization to detect original threats
    let safetyValidation;
    if (shouldValidate) {
      safetyValidation = validateContentSafety(processedResult.content);
    }
    
    // Apply channel-specific sanitization
    if (shouldSanitize) {
      processedResult = await this.sanitizeResult(processedResult);
    }
    
    // Add safety validation results to metadata
    if (shouldValidate && safetyValidation) {
      processedResult.metadata = {
        ...processedResult.metadata,
        safetyValidation
      };
    }
    
    return processedResult;
  }

  /**
   * Apply channel-specific sanitization to the result
   * Override in child classes for custom sanitization logic
   */
  protected async sanitizeResult(result: RenderResult): Promise<RenderResult> {
    // Default implementation - no sanitization
    // Child classes should override this for channel-specific sanitization
    return result;
  }
}