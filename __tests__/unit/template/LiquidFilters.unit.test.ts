import { LiquidTemplateEngine } from '@/app/services/template/core/LiquidTemplateEngine';
import { TemplateLoader } from '@/app/services/template/loaders/TemplateLoader';

// Mock template loader
class MockTemplateLoader implements TemplateLoader {
  async loadTemplate(templateKey: string, context?: any) {
    return {
      template: {
        id: '1',
        templateKey,
        name: templateKey,
        bodyTemplate: `Mock template for ${templateKey}`,
        subjectTemplate: null,
        variablesDescription: {},
        channelType: 'EMAIL'
      },
      metadata: {
        loadedAt: new Date(),
        source: 'database' as const
      }
    };
  }

  async templateExists(templateKey: string): Promise<boolean> {
    return true;
  }

  clearCache(): void {}
  clearExpiredCache(): void {}
  getStats() {
    return { totalCached: 0, validCached: 0, expiredCached: 0 };
  }
}

describe('Liquid Filters', () => {
  let engine: LiquidTemplateEngine;
  let loader: MockTemplateLoader;

  beforeEach(() => {
    loader = new MockTemplateLoader();
    engine = new LiquidTemplateEngine(loader);
  });

  describe('html_to_text filter', () => {
    it('should convert HTML to plain text', async () => {
      const template = '{{ content | html_to_text }}';
      const context = {
        variables: {
          content: '<h1>Hello</h1><p>This is a <strong>test</strong></p>'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content.trim()).toBe('Hello\n\nThis is a test');
    });

    it('should handle links', async () => {
      const template = '{{ content | html_to_text }}';
      const context = {
        variables: {
          content: '<a href="https://example.com">Click here</a>'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content.trim()).toBe('Click here (https://example.com)');
    });

    it('should decode HTML entities', async () => {
      const template = '{{ content | html_to_text }}';
      const context = {
        variables: {
          content: '&lt;test&gt; &amp; &quot;quotes&quot;'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content.trim()).toBe('<test> & "quotes"');
    });
  });

  describe('markdown_to_html filter', () => {
    it('should convert headers', async () => {
      const template = '{{ content | markdown_to_html }}';
      const context = {
        variables: {
          content: '# Header 1\n## Header 2'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content).toContain('<h1>Header 1</h1>');
      expect(result.content).toContain('<h2>Header 2</h2>');
    });

    it('should convert bold and italic', async () => {
      const template = '{{ content | markdown_to_html }}';
      const context = {
        variables: {
          content: 'This is **bold** and *italic*'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content).toContain('<strong>bold</strong>');
      expect(result.content).toContain('<em>italic</em>');
    });

    it('should convert links', async () => {
      const template = '{{ content | markdown_to_html }}';
      const context = {
        variables: {
          content: '[Click here](https://example.com)'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content).toContain('<a href="https://example.com">Click here</a>');
    });
  });

  describe('sanitization filters', () => {
    it('should sanitize for email', async () => {
      const template = '{{ content | sanitize_email }}';
      const context = {
        variables: {
          content: '<script>alert("xss")</script><p>Safe content</p>'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content).not.toContain('<script>');
      expect(result.content).toContain('<p>Safe content</p>');
    });

    it('should sanitize for in-app', async () => {
      const template = '{{ content | sanitize_inapp }}';
      const context = {
        variables: {
          content: '<p style="color: red;">Text</p><iframe src="evil"></iframe>'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content).not.toContain('style=');
      expect(result.content).not.toContain('<iframe');
      expect(result.content).toContain('<p>Text</p>');
    });

    it('should strip HTML for SMS', async () => {
      const template = '{{ content | sanitize_sms }}';
      const context = {
        variables: {
          content: '<h1>Title</h1><p>Message</p>'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content).toBe('TitleMessage');
    });
  });

  describe('extract_subject filter', () => {
    it('should extract subject from content', async () => {
      const template = '{% assign data = content | extract_subject %}Subject: {{ data.subject }}, Body: {{ data.body }}';
      const context = {
        variables: {
          content: 'Subject: Test Email\nThis is the body'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content).toBe('Subject: Test Email, Body: This is the body');
    });

    it('should handle content without subject', async () => {
      const template = '{% assign data = content | extract_subject %}Subject: {{ data.subject }}, Body: {{ data.body }}';
      const context = {
        variables: {
          content: 'This is just body content'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content).toBe('Subject: , Body: This is just body content');
    });
  });

  describe('utility filters', () => {
    it('should stringify JSON', async () => {
      const template = '{{ data | json }}';
      const context = {
        variables: {
          data: { name: 'John', age: 30 }
        }
      };

      const result = await engine.render(template, context);
      expect(result.content).toBe('{"name":"John","age":30}');
    });

    it('should provide default values', async () => {
      const template = '{{ missing | default: "fallback" }}';
      const context = {
        variables: {}
      };

      const result = await engine.render(template, context);
      expect(result.content).toBe('fallback');
    });

    it('should not use default for existing values', async () => {
      const template = '{{ value | default: "fallback" }}';
      const context = {
        variables: { value: 'exists' }
      };

      const result = await engine.render(template, context);
      expect(result.content).toBe('exists');
    });
  });

  describe('filter chaining', () => {
    it('should chain multiple filters', async () => {
      const template = '{{ content | markdown_to_html | sanitize_email }}';
      const context = {
        variables: {
          content: '# Title\n\n**Bold** text with <script>alert("xss")</script>'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content).toContain('<h1>Title</h1>');
      expect(result.content).toContain('<strong>Bold</strong>');
      expect(result.content).not.toContain('<script>');
    });

    it('should chain html to text conversion', async () => {
      const template = '{{ content | markdown_to_html | html_to_text }}';
      const context = {
        variables: {
          content: '# Title\n\n**Bold** text'
        }
      };

      const result = await engine.render(template, context);
      expect(result.content.trim()).toBe('Title\n\nBold text');
    });
  });
});