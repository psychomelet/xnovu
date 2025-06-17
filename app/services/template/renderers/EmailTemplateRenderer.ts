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
      emailResult.textBody = this.htmlToText(body);
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
      emailResult.textBody = this.htmlToText(body);
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
   */
  private htmlToText(html: string): string {
    // First sanitize the HTML to ensure it's safe
    const sanitizedHtml = sanitizeForChannel(html, 'email');
    
    let text = sanitizedHtml;
    let previousText;
    
    // Remove style tags with content - use loop to handle nested/malformed tags
    do {
      previousText = text;
      text = text.replace(/<style[^>]*>[\s\S]*?<\/style\s*>/gi, '');
    } while (text !== previousText);
    
    // Remove script tags with content - use loop to handle nested/malformed tags
    do {
      previousText = text;
      text = text.replace(/<script[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    } while (text !== previousText);
    
    // Replace common block elements with newlines
    text = text.replace(/<\/?(p|div|h[1-6]|br|hr|li)[^>]*>/gi, '\n');
    
    // Replace links with text and URL
    text = text.replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)');
    
    // Remove all other HTML tags - use loop to handle nested/malformed tags
    do {
      previousText = text;
      text = text.replace(/<[^>]*>/g, '');
    } while (text !== previousText);
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&amp;/g, '&');
    
    // Clean up whitespace
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    text = text.trim();
    
    return text;
  }
}