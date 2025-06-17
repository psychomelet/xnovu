import { BaseChannelRenderer, ChannelRenderResult, ChannelRenderOptions } from './BaseChannelRenderer';
import { TemplateContext, RenderOptions, RenderResult } from '../core/TemplateEngine';
import { sanitizeForChannel } from '../utils/sanitizeConfig';

export interface EmailRenderOptions extends ChannelRenderOptions {
  includeTextVersion?: boolean;
  subjectPrefix?: string;
}

export interface EmailRenderResult extends ChannelRenderResult {
  subject: string;
  body: string;
  textBody?: string;
  safetyValidation?: {
    safe: boolean;
    warnings: string[];
  };
}

export class EmailTemplateRenderer extends BaseChannelRenderer {
  constructor(templateLoader: any) {
    super(templateLoader, 'EMAIL');
  }

  /**
   * Render email template with subject extraction
   */
  async render(
    template: string,
    context: TemplateContext,
    options?: EmailRenderOptions
  ): Promise<EmailRenderResult> {
    const result = await super.render(template, context, options);
    
    // Extract subject from content if it starts with "Subject:"
    const { subject, body } = this.extractSubjectAndBody(result.content);
    
    // Apply subject prefix if provided
    const finalSubject = options?.subjectPrefix 
      ? `${options.subjectPrefix} ${subject}`
      : subject;

    const emailResult: EmailRenderResult = {
      ...result,
      subject: sanitizeForChannel(finalSubject, 'email'),
      body: body,
      safetyValidation: result.metadata?.safetyValidation
    };

    // Generate text version if requested
    if (options?.includeTextVersion) {
      emailResult.textBody = await this.htmlToText(body);
    }

    return emailResult;
  }

  /**
   * Render email template by key
   */
  async renderByKey(
    templateKey: string,
    context: TemplateContext,
    options?: EmailRenderOptions
  ): Promise<EmailRenderResult> {
    const result = await super.renderByKey(templateKey, context, options);
    
    // If template has separate subject, use it
    let subject = result.subject || '';
    let body = result.content;

    // Otherwise extract from body
    if (!subject) {
      const extracted = this.extractSubjectAndBody(body);
      subject = extracted.subject;
      body = extracted.body;
    }

    // Apply subject prefix if provided
    const finalSubject = options?.subjectPrefix 
      ? `${options.subjectPrefix} ${subject}`
      : subject;

    const emailResult: EmailRenderResult = {
      ...result,
      subject: sanitizeForChannel(finalSubject, 'email'),
      body: body,
      safetyValidation: result.metadata?.safetyValidation
    };

    // Generate text version if requested
    if (options?.includeTextVersion) {
      emailResult.textBody = await this.htmlToText(body);
    }

    return emailResult;
  }

  protected getDefaultFormat(): string {
    return 'html';
  }

  protected getDefaultVariables(): Record<string, any> {
    return {
      currentYear: new Date().getFullYear(),
      unsubscribeUrl: '{{unsubscribeUrl}}',
      preferencesUrl: '{{preferencesUrl}}'
    };
  }

  protected getDefaultOptions(): RenderOptions {
    return {
      throwOnError: false,
      errorPlaceholder: '[Email Template Error: {{key}}]'
    };
  }

  protected validateChannelSpecific(
    template: string,
    context?: Partial<TemplateContext>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for common email issues
    if (template.length > 102400) { // 100KB limit
      errors.push('Email template exceeds 100KB size limit');
    }

    // Check for required email elements (basic validation)
    const lowerTemplate = template.toLowerCase();
    if (lowerTemplate.includes('<script')) {
      errors.push('Email templates should not contain <script> tags');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract subject and body from content
   * If content starts with "Subject: ...\n", extract it as subject
   */
  private extractSubjectAndBody(content: string): { subject: string; body: string } {
    const subjectMatch = content.match(/^Subject:\s*(.+?)(\n|$)/i);
    
    if (subjectMatch) {
      const subject = subjectMatch[1].trim();
      const body = content.substring(subjectMatch[0].length).trim();
      return { subject, body };
    }

    return { subject: '', body: content };
  }

  /**
   * Apply email-specific sanitization to the result
   */
  protected async sanitizeResult(result: RenderResult): Promise<RenderResult> {
    return {
      ...result,
      content: sanitizeForChannel(result.content, 'email')
    };
  }

  /**
   * Simple HTML to text conversion
   * @deprecated Use {{ content | html_to_text }} filter in templates instead
   */
  private async htmlToText(html: string): Promise<string> {
    // Use Liquid engine to apply the html_to_text filter
    const engine = this.getEngine();
    if (engine && 'getLiquidEngine' in engine) {
      try {
        const template = '{{ content | html_to_text }}';
        const result = await engine.render(template, {
          variables: { content: html }
        });
        return result.content;
      } catch (error) {
        // Fall through to fallback
      }
    }
    
    // Fallback to simple conversion
    const sanitizedHtml = sanitizeForChannel(html, 'email');
    return sanitizedHtml.replace(/<[^>]*>/g, '').trim();
  }
}