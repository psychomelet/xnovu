import { EmailTemplateRenderer } from '@/app/services/template/renderers/EmailTemplateRenderer';
import { TemplateLoader, Template, TemplateLoadResult } from '@/app/services/template/loaders/TemplateLoader';

// Mock template loader
class MockTemplateLoader implements TemplateLoader {
  private templates = new Map<string, Template>();

  addTemplate(key: string, template: Partial<Template>) {
    this.templates.set(key, {
      id: key,
      templateKey: key,
      name: template.name || key,
      bodyTemplate: template.bodyTemplate || '',
      subjectTemplate: template.subjectTemplate,
      ...template
    } as Template);
  }

  async loadTemplate(templateKey: string): Promise<TemplateLoadResult> {
    const template = this.templates.get(templateKey);
    if (!template) {
      throw new Error(`Template not found: ${templateKey}`);
    }
    return {
      template,
      metadata: { loadedAt: new Date(), source: 'mock' }
    };
  }

  async loadTemplates(templateKeys: string[]): Promise<Map<string, TemplateLoadResult>> {
    const results = new Map<string, TemplateLoadResult>();
    for (const key of templateKeys) {
      const result = await this.loadTemplate(key);
      results.set(key, result);
    }
    return results;
  }

  async templateExists(templateKey: string): Promise<boolean> {
    return this.templates.has(templateKey);
  }

  async listTemplates(): Promise<Template[]> {
    return Array.from(this.templates.values());
  }
}

describe('EmailTemplateRenderer', () => {
  let renderer: EmailTemplateRenderer;
  let mockLoader: MockTemplateLoader;

  beforeEach(() => {
    mockLoader = new MockTemplateLoader();
    renderer = new EmailTemplateRenderer(mockLoader);

    // Add test templates
    mockLoader.addTemplate('welcome-email', {
      subjectTemplate: 'Welcome {{name}}!',
      bodyTemplate: '<h1>Hello {{name}}</h1><p>Welcome to our service.</p>'
    });

    mockLoader.addTemplate('inline-subject', {
      bodyTemplate: 'Subject: Important Notice\n\n<p>This is the email body for {{name}}.</p>'
    });

    mockLoader.addTemplate('html-email', {
      bodyTemplate: `
        <html>
          <body>
            <h1>{{title}}</h1>
            <p>Hello {{user.name}},</p>
            <p>Click <a href="{{link}}">here</a> to continue.</p>
          </body>
        </html>
      `
    });
  });

  describe('render', () => {
    it('should render email with variables', async () => {
      const template = '<p>Hello {{name}}, your order #{{orderId}} is ready.</p>';
      const context = {
        variables: {
          name: 'John',
          orderId: '12345'
        }
      };

      const result = await renderer.render(template, context);

      expect(result.subject).toBe('');
      expect(result.body).toBe('<p>Hello John, your order #12345 is ready.</p>');
      expect(result.channelType).toBe('EMAIL');
    });

    it('should extract subject from content', async () => {
      const template = 'Subject: Order Update\n\n<p>Your order is on the way!</p>';
      const context = { variables: {} };

      const result = await renderer.render(template, context);

      expect(result.subject).toBe('Order Update');
      expect(result.body).toBe('<p>Your order is on the way!</p>');
    });

    it('should apply subject prefix', async () => {
      const template = 'Subject: Order Update\n\n<p>Content</p>';
      const context = { variables: {} };
      const options = { subjectPrefix: '[URGENT]' };

      const result = await renderer.render(template, context, options);

      expect(result.subject).toBe('[URGENT] Order Update');
    });

    it('should generate text version when requested', async () => {
      const template = '<h1>Title</h1><p>Hello <strong>World</strong></p>';
      const context = { variables: {} };
      const options = { includeTextVersion: true };

      const result = await renderer.render(template, context, options);

      expect(result.textBody).toBeDefined();
      expect(result.textBody).toContain('Title');
      expect(result.textBody).toContain('Hello World');
      expect(result.textBody).not.toContain('<h1>');
    });
  });

  describe('renderByKey', () => {
    it('should render template with separate subject', async () => {
      const context = {
        variables: { name: 'John' }
      };

      const result = await renderer.renderByKey('welcome-email', context);

      expect(result.subject).toBe('Welcome John!');
      expect(result.body).toContain('<h1>Hello John</h1>');
    });

    it('should extract inline subject from body', async () => {
      const context = {
        variables: { name: 'John' }
      };

      const result = await renderer.renderByKey('inline-subject', context);

      expect(result.subject).toBe('Important Notice');
      expect(result.body).toContain('This is the email body for John');
      expect(result.body).not.toContain('Subject:');
    });

    it('should handle nested templates', async () => {
      mockLoader.addTemplate('email-header', {
        bodyTemplate: '<header>Company Logo</header>'
      });

      mockLoader.addTemplate('main-email', {
        subjectTemplate: 'Newsletter',
        bodyTemplate: "{{ xnovu_render('email-header', {}) }}<main>Content</main>"
      });

      const result = await renderer.renderByKey('main-email', { variables: {} });

      expect(result.subject).toBe('Newsletter');
      expect(result.body).toContain('<header>Company Logo</header>');
      expect(result.body).toContain('<main>Content</main>');
    });
  });

  describe('validateChannelSpecific', () => {
    it('should validate email size limit', async () => {
      const largeTemplate = '<p>' + 'x'.repeat(102401) + '</p>';
      const result = await renderer.validate(largeTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Email template exceeds 100KB size limit');
    });

    it('should detect script tags', async () => {
      const template = '<p>Hello</p><script>alert("XSS")</script>';
      const result = await renderer.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Email templates should not contain <script> tags');
    });

    it('should pass valid email template', async () => {
      const template = '<h1>{{title}}</h1><p>{{content}}</p>';
      const result = await renderer.validate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('htmlToText conversion', () => {
    it('should convert complex HTML to text', async () => {
      const template = `
        <div>
          <h1>Welcome</h1>
          <p>Hello <strong>John</strong>,</p>
          <p>Visit our <a href="https://example.com">website</a> for more info.</p>
          <ul>
            <li>Feature 1</li>
            <li>Feature 2</li>
          </ul>
        </div>
      `;
      const context = { variables: {} };
      const options = { includeTextVersion: true };

      const result = await renderer.render(template, context, options);

      expect(result.textBody).toContain('Welcome');
      expect(result.textBody).toContain('Hello John');
      expect(result.textBody).toContain('website (https://example.com)');
      expect(result.textBody).toContain('Feature 1');
      expect(result.textBody).toContain('Feature 2');
    });

    it('should handle HTML entities', async () => {
      const template = '<p>&lt;Hello&gt; &amp; &quot;World&quot; &nbsp; &#39;Test&#39;</p>';
      const context = { variables: {} };
      const options = { includeTextVersion: true };

      const result = await renderer.render(template, context, options);

      expect(result.textBody).toContain('<Hello>');
      expect(result.textBody).toContain(' & ');
      expect(result.textBody).toContain('"World"');
      expect(result.textBody).toContain('Test');
    });

    it('should remove style and script tags', async () => {
      const template = `
        <style>body { color: red; }</style>
        <p>Content</p>
        <script>console.log('test');</script>
      `;
      const context = { variables: {} };
      const options = { includeTextVersion: true };

      const result = await renderer.render(template, context, options);

      expect(result.textBody).toBe('Content');
      expect(result.textBody).not.toContain('color: red');
      expect(result.textBody).not.toContain('console.log');
    });
  });

  describe('default values', () => {
    it('should include default email variables', async () => {
      const template = 'Year: {{currentYear}}, Unsubscribe: {{unsubscribeUrl}}';
      const context = { variables: {} };

      const result = await renderer.render(template, context);

      expect(result.body).toContain(`Year: ${new Date().getFullYear()}`);
      expect(result.body).toContain('Unsubscribe: {{unsubscribeUrl}}');
    });

    it('should override default variables', async () => {
      const template = 'Year: {{currentYear}}';
      const context = {
        variables: {
          currentYear: '2025'
        }
      };

      const result = await renderer.render(template, context);

      expect(result.body).toBe('Year: 2025');
    });
  });
});