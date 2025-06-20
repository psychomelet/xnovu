import { InAppTemplateRenderer } from '@/app/services/template/renderers/InAppTemplateRenderer';
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

describe('InAppTemplateRenderer - Sanitization', () => {
  let renderer: InAppTemplateRenderer;
  let mockLoader: MockTemplateLoader;

  beforeEach(() => {
    mockLoader = new MockTemplateLoader();
    renderer = new InAppTemplateRenderer(mockLoader);
  });

  describe('XSS prevention', () => {
    it('should remove script tags', async () => {
      const template = '<p>Hello {{name}}!</p><script>alert("xss")</script>';
      const context = {
        variables: { name: 'John' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).toBe('<p>Hello John!</p>');
      expect(result.content).not.toContain('script');
      expect(result.metadata?.safetyValidation?.safe).toBe(false);
    });

    it('should remove event handlers', async () => {
      const template = '<div onclick="alert(1)">{{message}}</div>';
      const context = {
        variables: { message: 'Click me' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).toBe('<div>Click me</div>');
      expect(result.content).not.toContain('onclick');
    });

    it('should remove dangerous protocols', async () => {
      const template = '<a href="javascript:alert(1)">Link</a>';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).not.toContain('javascript:');
      expect(result.content).toContain('<a'); // Link should be present but sanitized
    });

    it('should sanitize malicious variables', async () => {
      const template = '<p>{{userInput}}</p>';
      const context = {
        variables: {
          userInput: '<script>alert("xss")</script>Safe content'
        },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).toBe('<p>Safe content</p>');
      expect(result.content).not.toContain('script');
    });
  });

  describe('in-app specific restrictions', () => {
    it('should not allow tables (more restrictive than email)', async () => {
      const template = '<table><tr><td>{{data}}</td></tr></table>';
      const context = {
        variables: { data: 'Cell content' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).toBe('Cell content');
      expect(result.content).not.toContain('<table>');
    });

    it('should not allow images', async () => {
      const template = '<p>Check this out: <img src="image.jpg" alt="test"></p>';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).toBe('<p>Check this out: </p>');
      expect(result.content).not.toContain('<img>');
    });

    it('should remove style attributes', async () => {
      const template = '<p style="color: red;">{{message}}</p>';
      const context = {
        variables: { message: 'Styled text' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).toBe('<p>Styled text</p>');
      expect(result.content).not.toContain('style=');
    });

    it('should add data attributes to external links', async () => {
      const template = '<a href="https://example.com">External</a>';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).toContain('data-external-link="true"');
      expect(result.content).toContain('target="_blank"');
      expect(result.content).toContain('rel="noopener noreferrer"');
    });
  });

  describe('allowed content', () => {
    it('should allow basic formatting', async () => {
      const template = `
        <h3>{{title}}</h3>
        <p>This is <strong>bold</strong> and <em>italic</em> text.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `;
      const context = {
        variables: { title: 'Notification' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).toContain('<h3>Notification</h3>');
      expect(result.content).toContain('<strong>bold</strong>');
      expect(result.content).toContain('<em>italic</em>');
      expect(result.content).toContain('<ul>');
      expect(result.content).toContain('<li>');
    });

    it('should allow code formatting', async () => {
      const template = '<p>Run <code>{{command}}</code> to execute.</p>';
      const context = {
        variables: { command: 'npm install' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).toContain('<code>npm install</code>');
    });

    it('should allow safe class attributes', async () => {
      const template = '<p class="notification-text">{{message}}</p>';
      const context = {
        variables: { message: 'Hello' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).toContain('class="notification-text"');
    });
  });

  describe('markdown to HTML conversion with sanitization', () => {
    it('should sanitize converted markdown', async () => {
      const template = '# {{title}}\n\n**Bold text** with [link](javascript:alert(1))';
      const context = {
        variables: { title: 'Title' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.renderAsHtml(template, context);

      // The markdown converter generates HTML and then sanitizes it
      expect(result.content).toContain('<strong>Bold text</strong>');
      expect(result.content).not.toContain('javascript:');
      expect(result.content).toContain('Title'); // Title should be present
    });

    it('should handle malicious markdown input', async () => {
      const template = `
        # Normal Title
        
        <script>alert("xss")</script>
        
        [Click here](javascript:alert(1))
        
        **Safe bold text**
      `;
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.renderAsHtml(template, context);

      expect(result.content).toContain('Normal Title'); // Title should be present
      expect(result.content).toContain('<strong>Safe bold text</strong>');
      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('javascript:');
    });
  });

  describe('validation warnings', () => {
    it('should warn about iframe usage', async () => {
      const template = '<p>Content</p><iframe src="http://example.com"></iframe>';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const validation = await renderer.validate(template, context);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('In-app templates should not contain iframes');
    });

    it('should warn about form usage', async () => {
      const template = '<form><input type="text"></form>';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const validation = await renderer.validate(template, context);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('In-app templates should not contain forms');
    });

    it('should warn about external resources', async () => {
      const template = '<img src="https://example.com/image.jpg" alt="external">';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const validation = await renderer.validate(template, context);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('In-app templates should avoid external resources for better performance');
    });
  });

  describe('sanitization options', () => {
    it('should allow disabling sanitization', async () => {
      const template = '<p>{{message}}</p><script>alert("test")</script>';
      const context = {
        variables: { message: 'Hello' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context, { channelType: 'IN_APP', sanitize: false });

      expect(result.content).toContain('<script>');
    });

    it('should sanitize by default', async () => {
      const template = '<p>Hello!</p><script>alert("test")</script>';
      const context = {
        variables: {},
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).not.toContain('<script>');
      expect(result.metadata?.safetyValidation?.safe).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle deeply nested malicious content', async () => {
      const template = `
        <div>
          <p>
            <span>
              <script>alert("nested")</script>
              {{message}}
            </span>
          </p>
        </div>
      `;
      const context = {
        variables: { message: 'Safe content' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.render(template, context);

      expect(result.content).toContain('Safe content');
      expect(result.content).not.toContain('script');
      expect(result.content).not.toContain('alert');
    });

    it('should handle mixed content types', async () => {
      const template = `
        # Markdown Header
        
        <p>HTML paragraph with {{variable}}</p>
        
        **Markdown bold** and <strong>HTML bold</strong>
        
        <script>alert("mixed")</script>
      `;
      const context = {
        variables: { variable: 'content' },
        enterpriseId: '00000000-0000-0000-0000-000000000001'
      };

      const result = await renderer.renderAsHtml(template, context);

      expect(result.content).toContain('<p>HTML paragraph with content</p>');
      expect(result.content).toContain('<strong>');
      expect(result.content).not.toContain('<script>');
    });
  });
});