import { BaseChannelRenderer } from './BaseChannelRenderer';
import { TemplateContext, RenderOptions, RenderResult } from '../core/TemplateEngine';
import { sanitizeForChannel } from '../utils/sanitizeConfig';

export class InAppTemplateRenderer extends BaseChannelRenderer {
  constructor(templateLoader: any) {
    super(templateLoader, 'IN_APP');
  }

  protected getDefaultFormat(): string {
    return 'markdown';
  }

  protected getDefaultVariables(): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      readUrl: '{{readUrl}}',
      actionUrl: '{{actionUrl}}'
    };
  }

  protected getDefaultOptions(): RenderOptions {
    return {
      throwOnError: false,
      errorPlaceholder: '[In-App Template Error: {{key}}]',
      maxDepth: 5 // Lower depth for in-app to keep content concise
    };
  }

  protected validateChannelSpecific(
    template: string,
    context?: Partial<TemplateContext>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // In-app notifications should be concise
    if (template.length > 10240) { // 10KB limit
      errors.push('In-app template exceeds 10KB size limit');
    }

    // Check for elements that don't work well in in-app
    if (template.includes('<iframe')) {
      errors.push('In-app templates should not contain iframes');
    }

    if (template.includes('<form')) {
      errors.push('In-app templates should not contain forms');
    }

    // Warn about external resources
    const externalResourcePattern = /<(?:img|script|link)[^>]+(?:src|href)=["'](?:https?:)?\/\//gi;
    if (externalResourcePattern.test(template)) {
      errors.push('In-app templates should avoid external resources for better performance');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert markdown to safe HTML for in-app display
   */
  async renderAsHtml(
    template: string,
    context: TemplateContext,
    options?: any
  ): Promise<any> {
    const result = await this.render(template, context, {
      ...options,
      format: 'html'
    });

    // Convert markdown to HTML if needed
    if (this.isMarkdown(result.content)) {
      result.content = this.markdownToHtml(result.content);
    }

    return result;
  }

  /**
   * Check if content appears to be markdown
   */
  private isMarkdown(content: string): boolean {
    const markdownPatterns = [
      /^#{1,6}\s/m,           // Headers
      /\*\*[^*]+\*\*/,        // Bold
      /\*[^*]+\*/,            // Italic
      /\[([^\]]+)\]\([^)]+\)/, // Links
      /^[-*]\s/m,             // Lists
      /^>\s/m,                // Blockquotes
      /```[\s\S]+```/         // Code blocks
    ];

    return markdownPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Apply in-app specific sanitization to the result
   */
  protected async sanitizeResult(result: RenderResult): Promise<RenderResult> {
    return {
      ...result,
      content: sanitizeForChannel(result.content, 'in_app')
    };
  }

  /**
   * Basic markdown to HTML conversion for in-app display
   */
  private markdownToHtml(markdown: string): string {
    let html = markdown;

    // Headers
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Lists
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${html}</p>`;

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    // Sanitize the generated HTML for security
    return sanitizeForChannel(html, 'in_app');
  }
}