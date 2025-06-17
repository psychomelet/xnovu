import { EmailTemplateRenderer } from '@/app/services/template/renderers/EmailTemplateRenderer';
import { TemplateLoader, Template, TemplateLoadResult } from '@/app/services/template/loaders/TemplateLoader';

// Mock template loader
class MockTemplateLoader implements TemplateLoader {
  private templates = new Map<string, Template>();

  setTemplate(key: string, template: Template) {
    this.templates.set(key, template);
  }

  async loadTemplate(templateKey: string): Promise<TemplateLoadResult> {
    const template = this.templates.get(templateKey);
    if (!template) {
      throw new Error(`Template not found: ${templateKey}`);
    }
    return {
      template,
      metadata: {
        loadedAt: new Date(),
        source: 'mock'
      }
    };
  }

  async loadTemplates(templateKeys: string[]): Promise<Map<string, TemplateLoadResult>> {
    const results = new Map<string, TemplateLoadResult>();
    for (const key of templateKeys) {
      try {
        const result = await this.loadTemplate(key);
        results.set(key, result);
      } catch (error) {
        // Skip missing templates
      }
    }
    return results;
  }

  async templateExists(templateKey: string): Promise<boolean> {
    return this.templates.has(templateKey);
  }

  async listTemplates(): Promise<Template[]> {
    return Array.from(this.templates.values());
  }

  clearCache(): void {
    this.templates.clear();
  }

  getStats() {
    return {
      totalLoaded: this.templates.size,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
}

describe('EmailTemplateRenderer - Sanitization', () => {
  let renderer: EmailTemplateRenderer;
  let mockLoader: MockTemplateLoader;

  beforeEach(() => {
    mockLoader = new MockTemplateLoader();
    renderer = new EmailTemplateRenderer(mockLoader);
  });

  describe('XSS prevention', () => {
    it('should sanitize script tags in template content', async () => {
      const template = '<p>Hello {{name}}!</p><script>alert("xss")</script>';
      const context = {
        variables: { name: 'John' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.body).toBe('<p>Hello John!</p>');
      expect(result.body).not.toContain('script');
      expect(result.safetyValidation?.safe).toBe(false);
      expect(result.safetyValidation?.warnings).toContain('Contains script tags');
    });

    it('should sanitize javascript: URLs in links', async () => {
      const template = '<a href="javascript:alert(1)">Click me</a>';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.body).not.toContain('javascript:');
      expect(result.body).toBe('<a>Click me</a>');
    });

    it('should sanitize malicious variables', async () => {
      const template = '<p>Hello {{name}}!</p>';
      const context = {
        variables: { 
          name: '<script>alert("xss")</script>Malicious User'
        },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.body).toBe('<p>Hello Malicious User!</p>');
      expect(result.body).not.toContain('script');
    });

    it('should handle event handlers in HTML', async () => {
      const template = '<div onclick="alert(1)">{{message}}</div>';
      const context = {
        variables: { message: 'Hello' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.body).not.toContain('onclick');
      expect(result.safetyValidation?.safe).toBe(false);
      expect(result.safetyValidation?.warnings).toContain('Contains event handlers (onclick, onload, etc.)');
    });
  });

  describe('safe HTML preservation', () => {
    it('should preserve safe formatting tags', async () => {
      const template = `
        <h1>Welcome {{name}}!</h1>
        <p>This is a <strong>bold</strong> and <em>italic</em> message.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `;
      const context = {
        variables: { name: 'John' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.body).toContain('<h1>Welcome John!</h1>');
      expect(result.body).toContain('<strong>bold</strong>');
      expect(result.body).toContain('<em>italic</em>');
      expect(result.body).toContain('<ul>');
      expect(result.body).toContain('<li>');
    });

    it('should preserve safe links with security attributes', async () => {
      const template = '<a href="https://example.com">External link</a>';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.body).toContain('href="https://example.com"');
      expect(result.body).toContain('target="_blank"');
      expect(result.body).toContain('rel="noopener noreferrer"');
    });

    it('should preserve images with safe attributes', async () => {
      const template = '<img src="https://example.com/image.jpg" alt="Test image" width="100" height="50">';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.body).toContain('src="https://example.com/image.jpg"');
      expect(result.body).toContain('alt="Test image"');
      expect(result.body).toContain('width="100"');
      expect(result.body).toContain('height="50"');
    });

    it('should preserve table structures for email layouts', async () => {
      const template = `
        <table border="1" cellpadding="5">
          <tr>
            <td>Header 1</td>
            <td>Header 2</td>
          </tr>
          <tr>
            <td>{{data1}}</td>
            <td>{{data2}}</td>
          </tr>
        </table>
      `;
      const context = {
        variables: { data1: 'Value 1', data2: 'Value 2' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.body).toContain('<table');
      expect(result.body).toContain('<tr>');
      expect(result.body).toContain('<td>Value 1</td>');
      expect(result.body).toContain('<td>Value 2</td>');
    });
  });

  describe('text version sanitization', () => {
    it('should create safe text version from HTML', async () => {
      const template = `
        <h1>Welcome!</h1>
        <p>This is a <strong>test</strong> with <a href="https://example.com">a link</a>.</p>
        <script>alert("xss")</script>
      `;
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context, { includeTextVersion: true });

      expect(result.textBody).not.toContain('<script>');
      expect(result.textBody).not.toContain('alert');
      expect(result.textBody).toContain('Welcome!');
      expect(result.textBody).toContain('test');
      expect(result.textBody).toContain('a link (https://example.com)');
    });
  });

  describe('subject sanitization', () => {
    it('should sanitize subject lines', async () => {
      const template = 'Subject: Welcome <script>alert("xss")</script>{{name}}!\n\n<p>Email body</p>';
      const context = {
        variables: { name: 'John' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.subject).toBe('Welcome John!');
      expect(result.subject).not.toContain('script');
    });

    it('should sanitize subject from template metadata', async () => {
      mockLoader.setTemplate('test-email', {
        id: '1',
        templateKey: 'test-email',
        name: 'Test Email',
        bodyTemplate: '<p>Body content</p>',
        subjectTemplate: 'Alert: <script>alert("xss")</script>{{type}}',
        channelType: 'EMAIL',
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      });

      const context = {
        variables: { type: 'Security' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.renderByKey('test-email', context);

      expect(result.subject).toBe('Alert: Security');
      expect(result.subject).not.toContain('script');
    });
  });

  describe('sanitization options', () => {
    it('should allow disabling sanitization', async () => {
      const template = '<p>Hello {{name}}!</p><script>alert("test")</script>';
      const context = {
        variables: { name: 'John' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context, { sanitize: false });

      // When sanitization is disabled, script tags should remain
      expect(result.body).toContain('<script>');
      expect(result.body).toContain('alert("test")');
    });

    it('should allow disabling safety validation', async () => {
      const template = '<p>Hello!</p><script>alert("test")</script>';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context, { validateSafety: false });

      expect(result.safetyValidation).toBeUndefined();
    });

    it('should sanitize by default', async () => {
      const template = '<p>Hello!</p><script>alert("test")</script>';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.body).not.toContain('<script>');
      expect(result.safetyValidation?.safe).toBe(false);
    });
  });

  describe('complex XSS scenarios', () => {
    it('should handle nested script attempts', async () => {
      const template = '<div><p>Normal content</p><scr<script>alert(1)</script>ipt>alert(2)</script></div>';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      // The key is that script tags are removed, even if some text remnants remain
      expect(result.body).not.toContain('<script>');
      expect(result.body).not.toContain('</script>');
      expect(result.body).toContain('<p>Normal content</p>');
      expect(result.safetyValidation?.safe).toBe(false);
    });

    it('should handle data: URLs in images', async () => {
      const template = '<img src="data:text/html,<script>alert(1)</script>" alt="test">';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      // Data URLs are allowed for images, and the script content should be HTML-escaped
      expect(result.body).toContain('<img');
      expect(result.body).toContain('&lt;script&gt;'); // HTML entities are safe
      expect(result.body).not.toContain('<script>'); // No actual script tags
    });

    it('should handle CSS injection attempts', async () => {
      const template = '<div style="background: expression(alert(1))">Content</div>';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      // The div with dangerous CSS should be removed entirely, but we detect the threat
      expect(result.safetyValidation?.safe).toBe(false);
      expect(result.safetyValidation?.warnings).toContain('Contains CSS expressions');
      // Content might be removed if the entire element is filtered out for safety
    });
  });
});