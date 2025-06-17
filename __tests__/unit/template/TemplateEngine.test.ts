import { TemplateEngine, TemplateContext } from '@/app/services/template/core/TemplateEngine';
import { TemplateLoader, Template, TemplateLoadResult, TemplateNotFoundError } from '@/app/services/template/loaders/TemplateLoader';

// Mock template loader for unit tests
class MockTemplateLoader implements TemplateLoader {
  private templates = new Map<string, Template>();

  constructor(templates?: Record<string, Partial<Template>>) {
    if (templates) {
      Object.entries(templates).forEach(([key, template]) => {
        this.addTemplate(key, template);
      });
    }
  }

  addTemplate(key: string, template: Partial<Template>) {
    this.templates.set(key, {
      id: key,
      templateKey: key,
      name: template.name || key,
      bodyTemplate: template.bodyTemplate || '',
      subjectTemplate: template.subjectTemplate,
      variablesDescription: template.variablesDescription,
      channelType: template.channelType,
      enterpriseId: template.enterpriseId,
      ...template
    } as Template);
  }

  async loadTemplate(templateKey: string, context?: Record<string, any>): Promise<TemplateLoadResult> {
    const template = this.templates.get(templateKey);
    if (!template) {
      throw new TemplateNotFoundError(templateKey, context);
    }

    // Check enterprise ID if provided
    if (context?.enterpriseId && template.enterpriseId && template.enterpriseId !== context.enterpriseId) {
      throw new TemplateNotFoundError(templateKey, context);
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
        // Skip failed templates
      }
    }
    return results;
  }

  async templateExists(templateKey: string, context?: Record<string, any>): Promise<boolean> {
    const template = this.templates.get(templateKey);
    if (!template) {
      return false;
    }
    
    // Check enterprise ID if provided
    if (context?.enterpriseId && template.enterpriseId && template.enterpriseId !== context.enterpriseId) {
      return false;
    }
    
    return true;
  }

  async listTemplates(): Promise<Template[]> {
    return Array.from(this.templates.values());
  }

  clearCache() {
    // No-op for mock
  }
}

describe('TemplateEngine', () => {
  let engine: TemplateEngine;
  let mockLoader: MockTemplateLoader;

  beforeEach(() => {
    mockLoader = new MockTemplateLoader({
      'welcome': {
        bodyTemplate: 'Welcome {{name}}!'
      },
      'header': {
        bodyTemplate: '<h1>{{title}}</h1>'
      },
      'footer': {
        bodyTemplate: '<footer>© {{year}} {{company}}</footer>'
      },
      'nested': {
        bodyTemplate: "Start {{ xnovu_render('header', { title: 'Hello' }) }} End"
      },
      'email': {
        subjectTemplate: 'Hello {{name}}',
        bodyTemplate: 'Welcome {{name}}, your email is {{email}}'
      },
      'recursive': {
        bodyTemplate: "Level 1: {{ xnovu_render('recursive2', {}) }}"
      },
      'recursive2': {
        bodyTemplate: "Level 2: {{ xnovu_render('recursive3', {}) }}"
      },
      'recursive3': {
        bodyTemplate: "Level 3: End"
      }
    });

    engine = new TemplateEngine(mockLoader);
  });

  describe('render', () => {
    it('should render simple template', async () => {
      const template = 'Hello {{name}}, welcome!';
      const context: TemplateContext = {
        variables: { name: 'John' }
      };

      const result = await engine.render(template, context);

      expect(result.content).toBe('Hello John, welcome!');
      expect(result.errors).toEqual([]);
    });

    it('should render template with xnovu_render', async () => {
      const template = "Header: {{ xnovu_render('header', { title: 'Test' }) }}";
      const context: TemplateContext = {
        variables: {}
      };

      const result = await engine.render(template, context);

      expect(result.content).toBe('Header: <h1>Test</h1>');
      expect(result.errors).toEqual([]);
      expect(result.metadata?.templatesLoaded).toContain('header');
    });

    it('should merge variables in nested templates', async () => {
      const template = "{{ xnovu_render('welcome', {}) }}";
      const context: TemplateContext = {
        variables: { name: 'John' }
      };

      const result = await engine.render(template, context);

      expect(result.content).toBe('Welcome John!');
    });

    it('should override parent variables with xnovu_render variables', async () => {
      const template = "{{ xnovu_render('welcome', { name: 'Jane' }) }}";
      const context: TemplateContext = {
        variables: { name: 'John' }
      };

      const result = await engine.render(template, context);

      expect(result.content).toBe('Welcome Jane!');
    });

    it('should handle multiple xnovu_render calls', async () => {
      const template = `
        {{ xnovu_render('header', { title: 'Page' }) }}
        Content
        {{ xnovu_render('footer', { year: 2024, company: 'ACME' }) }}
      `;
      const context: TemplateContext = {
        variables: {}
      };

      const result = await engine.render(template, context);

      expect(result.content).toContain('<h1>Page</h1>');
      expect(result.content).toContain('<footer>© 2024 ACME</footer>');
      expect(result.metadata?.templatesLoaded).toContain('header');
      expect(result.metadata?.templatesLoaded).toContain('footer');
      expect(result.metadata?.templatesLoaded).toHaveLength(2);
    });

    it('should handle nested xnovu_render calls', async () => {
      const template = "{{ xnovu_render('nested', {}) }}";
      const context: TemplateContext = {
        variables: {}
      };

      const result = await engine.render(template, context);

      expect(result.content).toBe('Start <h1>Hello</h1> End');
      expect(result.metadata?.templatesLoaded).toContain('nested');
      expect(result.metadata?.templatesLoaded).toContain('header');
    });

    it('should handle template not found error', async () => {
      const template = "{{ xnovu_render('missing', {}) }}";
      const context: TemplateContext = {
        variables: {}
      };

      const result = await engine.render(template, context);

      expect(result.content).toBe('[Template Error: missing]');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].templateKey).toBe('missing');
    });

    it('should throw error when throwOnError is true', async () => {
      const template = "{{ xnovu_render('missing', {}) }}";
      const context: TemplateContext = {
        variables: {}
      };

      await expect(
        engine.render(template, context, { throwOnError: true })
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it('should respect maxDepth limit', async () => {
      const template = "{{ xnovu_render('recursive', {}) }}";
      const context: TemplateContext = {
        variables: {}
      };

      const result = await engine.render(template, context, { maxDepth: 2 });

      expect(result.content).toContain('Level 1: Level 2:');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error.message).toContain('Maximum template depth');
    });

    it('should use custom error placeholder', async () => {
      const template = "{{ xnovu_render('missing', {}) }}";
      const context: TemplateContext = {
        variables: {}
      };

      const result = await engine.render(template, context, {
        errorPlaceholder: 'ERROR: {{key}} not found'
      });

      expect(result.content).toBe('ERROR: missing not found');
    });
  });

  describe('renderByKey', () => {
    it('should render template by key', async () => {
      const context: TemplateContext = {
        variables: { name: 'John', email: 'john@example.com' }
      };

      const result = await engine.renderByKey('email', context);

      expect(result.content).toBe('Welcome John, your email is john@example.com');
      expect(result.metadata?.subject).toBe('Hello John');
      expect(result.metadata?.templateKey).toBe('email');
    });

    it('should merge template variables with context', async () => {
      mockLoader.addTemplate('vars-template', {
        bodyTemplate: '{{greeting}} {{name}}',
        variablesDescription: { greeting: 'Hello' }
      });

      const context: TemplateContext = {
        variables: { name: 'John' }
      };

      const result = await engine.renderByKey('vars-template', context);

      expect(result.content).toBe('Hello John');
    });

    it('should handle template not found', async () => {
      const context: TemplateContext = {
        variables: {}
      };

      const result = await engine.renderByKey('missing', context);

      expect(result.content).toBe('[Template Error: missing]');
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('validate', () => {
    it('should validate valid template', async () => {
      const template = "Hello {{name}}, {{ xnovu_render('welcome', {}) }}";
      const result = await engine.validate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect syntax errors', async () => {
      const template = "Hello {{}}";
      const result = await engine.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Empty variable placeholder at position 6');
    });

    it('should detect missing templates', async () => {
      const template = "{{ xnovu_render('missing', {}) }}";
      const result = await engine.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template not found: missing');
    });

    it('should validate with enterprise context', async () => {
      mockLoader.addTemplate('enterprise-template', {
        bodyTemplate: 'Enterprise content',
        enterpriseId: 'ent-123'
      });

      const template = "{{ xnovu_render('enterprise-template', {}) }}";
      
      // Should pass without enterprise context (since context is optional)
      const result1 = await engine.validate(template);
      expect(result1.valid).toBe(true);

      // Should fail with wrong enterprise context
      const result2 = await engine.validate(template, { enterpriseId: 'wrong-enterprise' });
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Template not found: enterprise-template');

      // Should pass with correct enterprise context
      const result3 = await engine.validate(template, { enterpriseId: 'ent-123' });
      expect(result3.valid).toBe(true);
    });
  });

  describe('extractVariables', () => {
    it('should extract direct variables', async () => {
      const template = 'Hello {{name}}, your ID is {{id}}';
      const variables = await engine.extractVariables(template);

      expect(variables).toEqual(['name', 'id']);
    });

    it('should extract variables from nested templates', async () => {
      mockLoader.addTemplate('user-info', {
        bodyTemplate: 'User: {{user.name}}, Email: {{user.email}}'
      });

      const template = "{{ xnovu_render('user-info', {}) }} - ID: {{id}}";
      const variables = await engine.extractVariables(template);

      expect(variables).toContain('user.name');
      expect(variables).toContain('user.email');
      expect(variables).toContain('id');
    });

    it('should handle missing templates gracefully', async () => {
      const template = "{{ xnovu_render('missing', {}) }} {{name}}";
      const variables = await engine.extractVariables(template);

      expect(variables).toContain('name');
    });
  });

  describe('getComponents', () => {
    it('should return underlying components', () => {
      const components = engine.getComponents();

      expect(components.parser).toBeDefined();
      expect(components.interpolator).toBeDefined();
      expect(components.templateLoader).toBe(mockLoader);
    });
  });
});