import { BaseChannelRenderer } from './BaseChannelRenderer';
import { TemplateContext, RenderOptions } from '../core/TemplateEngine';

export class SmsTemplateRenderer extends BaseChannelRenderer {
  private readonly SMS_MAX_LENGTH = 1600; // GSM 7-bit encoding limit for concatenated SMS
  private readonly SMS_SINGLE_LENGTH = 160;

  constructor(templateLoader: any) {
    super(templateLoader, 'SMS');
  }

  protected getDefaultFormat(): string {
    return 'text';
  }

  protected getDefaultVariables(): Record<string, any> {
    return {
      shortUrl: '{{shortUrl}}',
      optOutText: 'Reply STOP to unsubscribe'
    };
  }

  protected getDefaultOptions(): RenderOptions {
    return {
      throwOnError: false,
      errorPlaceholder: '[SMS Error]', // Keep error messages short for SMS
      maxDepth: 3 // Lower depth for SMS to keep content concise
    };
  }

  protected validateChannelSpecific(
    template: string,
    context?: Partial<TemplateContext>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check length
    if (template.length > this.SMS_MAX_LENGTH) {
      errors.push(`SMS template exceeds ${this.SMS_MAX_LENGTH} character limit`);
    }

    // Check for HTML tags (SMS should be plain text)
    if (/<[^>]+>/.test(template)) {
      errors.push('SMS templates should not contain HTML tags');
    }

    // Check for non-GSM characters that might cause issues
    const nonGsmPattern = /[^\x00-\x7F\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]/;
    if (nonGsmPattern.test(template)) {
      errors.push('SMS template contains characters that may not be supported by all carriers');
    }

    // Check for required opt-out text (regulatory compliance)
    const lowerTemplate = template.toLowerCase();
    if (!lowerTemplate.includes('stop') && !lowerTemplate.includes('opt out') && !lowerTemplate.includes('unsubscribe')) {
      errors.push('SMS templates should include opt-out instructions for compliance');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Render SMS with length optimization
   */
  async render(
    template: string,
    context: TemplateContext,
    options?: any
  ): Promise<any> {
    const result = await super.render(template, context, options);

    // Clean up the content for SMS
    result.content = this.cleanForSms(result.content);

    // Add metadata about SMS segments
    const metadata = {
      ...result.metadata,
      smsSegments: this.calculateSegments(result.content),
      characterCount: result.content.length,
      hasNonGsmCharacters: this.hasNonGsmCharacters(result.content)
    };

    return {
      ...result,
      metadata
    };
  }

  /**
   * Clean content for SMS delivery
   */
  private cleanForSms(content: string): string {
    // Remove any HTML tags if present
    let cleaned = content.replace(/<[^>]+>/g, '');

    // Replace multiple spaces with single space
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Replace fancy quotes and dashes with standard ones
    cleaned = cleaned.replace(/[""]/g, '"');
    cleaned = cleaned.replace(/['']/g, "'");
    cleaned = cleaned.replace(/[–—]/g, '-');

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Calculate number of SMS segments needed
   */
  private calculateSegments(content: string): number {
    const length = content.length;
    
    if (length <= this.SMS_SINGLE_LENGTH) {
      return 1;
    }

    // For concatenated SMS, each segment has 153 characters (7 reserved for headers)
    const concatLength = 153;
    return Math.ceil(length / concatLength);
  }

  /**
   * Check for non-GSM characters
   */
  private hasNonGsmCharacters(content: string): boolean {
    // GSM 7-bit default alphabet and extended characters
    const gsmRegex = /^[\x00-\x7F\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]*$/;
    return !gsmRegex.test(content);
  }

  /**
   * Truncate message to fit within SMS limits with ellipsis
   */
  truncateToFit(content: string, maxLength: number = this.SMS_SINGLE_LENGTH): string {
    if (content.length <= maxLength) {
      return content;
    }

    const ellipsis = '...';
    const truncateLength = maxLength - ellipsis.length;
    
    // Try to break at word boundary
    const truncated = content.substring(0, truncateLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > truncateLength * 0.8) {
      return truncated.substring(0, lastSpace) + ellipsis;
    }

    return truncated + ellipsis;
  }

  /**
   * Create a shortened URL placeholder for long URLs
   */
  shortenUrlPlaceholders(content: string): string {
    // Replace long URLs with shortened placeholders
    const urlRegex = /https?:\/\/[^\s]+/g;
    return content.replace(urlRegex, (url) => {
      if (url.length > 25) {
        return '{{shortUrl}}';
      }
      return url;
    });
  }
}