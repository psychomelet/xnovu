import { TemplateEngine, TemplateContext, RenderOptions, RenderResult } from '../core/TemplateEngine';
import { TemplateLoader } from '../loaders/TemplateLoader';

export interface ChannelRenderOptions extends RenderOptions {
  channelType: string;
  format?: 'html' | 'text' | 'markdown';
}

export interface ChannelRenderResult extends RenderResult {
  subject?: string;
  channelType: string;
  format?: string;
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
    const channelContext = this.prepareContext(context);
    const renderOptions = this.prepareOptions(options);
    
    const result = await this.engine.render(template, channelContext, renderOptions);
    
    return {
      ...result,
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
      ...this.prepareContext(context),
      channelType: this.channelType
    };
    
    const renderOptions = this.prepareOptions(options);
    const result = await this.engine.renderByKey(templateKey, channelContext, renderOptions);
    
    return {
      ...result,
      channelType: this.channelType,
      format: options?.format || this.getDefaultFormat(),
      subject: result.metadata?.subject
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
   * Prepare context with channel-specific defaults
   */
  protected prepareContext(context: TemplateContext): TemplateContext {
    return {
      ...context,
      channelType: this.channelType,
      variables: {
        ...this.getDefaultVariables(),
        ...context.variables
      }
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
}