import { TemplateRenderer } from '../app/services/template/TemplateRenderer';
import { supabase } from '../lib/supabase/client';

// Using real Supabase cloud service - no mocks

describe('TemplateRenderer', () => {
  let renderer: TemplateRenderer;
  let testEnterpriseId: string;
  let testTemplateKey: string;
  let testTemplateId: number;

  beforeAll(async () => {
    testEnterpriseId = 'test-enterprise-' + Date.now();
    testTemplateKey = 'test-template-' + Date.now();

    // Create a test template in Supabase
    const { data: template, error } = await supabase
      .schema('notify')
      .from('ent_notification_template')
      .insert({
        template_key: testTemplateKey,
        name: 'Test Template',
        body_template: 'Hello {{ name }}! Welcome to {{ location }}.',
        channel_type: 'EMAIL',
        enterprise_id: testEnterpriseId,
        publish_status: 'PUBLISH',
        deactivated: false
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create test template:', error);
      throw error;
    }

    testTemplateId = template.id;
  });

  afterAll(async () => {
    // Clean up test template
    if (testTemplateId) {
      await supabase
        .schema('notify')
        .from('ent_notification_template')
        .delete()
        .eq('id', testTemplateId);
    }
  });

  beforeEach(() => {
    // Use real Supabase instance
    renderer = new TemplateRenderer(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  });

  afterEach(() => {
    renderer.clearCache();
  });

  describe('parseXNovuRenderSyntax', () => {
    it('should parse simple xnovu_render syntax', () => {
      const template = 'Hello {{ xnovu_render("welcome-header", { name: "John" }) }}!';
      const matches = (renderer as any).parseXNovuRenderSyntax(template);
      
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({
        templateKey: 'welcome-header',
        variables: { name: 'John' },
        startIndex: 6,
        endIndex: 60
      });
    });

    it('should parse multiple xnovu_render calls', () => {
      const template = `
        {{ xnovu_render('header', { title: 'Welcome' }) }}
        <p>Content here</p>
        {{ xnovu_render('footer', { year: 2024 }) }}
      `;
      const matches = (renderer as any).parseXNovuRenderSyntax(template);
      
      expect(matches).toHaveLength(2);
      expect(matches[0].templateKey).toBe('header');
      expect(matches[1].templateKey).toBe('footer');
    });

    it('should handle complex nested variables', () => {
      const template = '{{ xnovu_render("complex", { user: { name: "John", age: 30 }, settings: { theme: "dark" } }) }}';
      const matches = (renderer as any).parseXNovuRenderSyntax(template);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].variables).toEqual({
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' }
      });
    });

    it('should handle empty variables object', () => {
      const template = '{{ xnovu_render("simple", {}) }}';
      const matches = (renderer as any).parseXNovuRenderSyntax(template);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].variables).toEqual({});
    });

    it('should handle different quote types', () => {
      const template1 = '{{ xnovu_render("template", { key: "value" }) }}';
      const template2 = "{{ xnovu_render('template', { key: 'value' }) }}";
      const template3 = '{{ xnovu_render(`template`, { key: `value` }) }}';
      
      const matches1 = (renderer as any).parseXNovuRenderSyntax(template1);
      const matches2 = (renderer as any).parseXNovuRenderSyntax(template2);
      const matches3 = (renderer as any).parseXNovuRenderSyntax(template3);
      
      expect(matches1).toHaveLength(1);
      expect(matches2).toHaveLength(1);
      expect(matches3).toHaveLength(1);
    });
  });

  describe('interpolateVariables', () => {
    it('should interpolate simple variables', () => {
      const template = 'Hello {{ name }}!';
      const variables = { name: 'John' };
      const result = (renderer as any).interpolateVariables(template, variables);
      
      expect(result).toBe('Hello John!');
    });

    it('should interpolate nested object properties', () => {
      const template = 'Hello {{ user.name }}! You are {{ user.age }} years old.';
      const variables = { user: { name: 'John', age: 30 } };
      const result = (renderer as any).interpolateVariables(template, variables);
      
      expect(result).toBe('Hello John! You are 30 years old.');
    });

    it('should interpolate array elements', () => {
      const template = 'First item: {{ items[0] }}, Second item: {{ items[1] }}';
      const variables = { items: ['Apple', 'Banana'] };
      const result = (renderer as any).interpolateVariables(template, variables);
      
      expect(result).toBe('First item: Apple, Second item: Banana');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{ name }}! Your email is {{ email }}.';
      const variables = { name: 'John' };
      const result = (renderer as any).interpolateVariables(template, variables);
      
      expect(result).toBe('Hello John! Your email is {{ email }}.');
    });

    it('should handle deeply nested properties', () => {
      const template = 'Config: {{ app.settings.theme.primary }}';
      const variables = { 
        app: { 
          settings: { 
            theme: { 
              primary: '#007bff' 
            } 
          } 
        } 
      };
      const result = (renderer as any).interpolateVariables(template, variables);
      
      expect(result).toBe('Config: #007bff');
    });
  });

  describe('getNestedValue', () => {
    it('should get simple property', () => {
      const obj = { name: 'John' };
      const result = (renderer as any).getNestedValue(obj, 'name');
      
      expect(result).toBe('John');
    });

    it('should get nested property', () => {
      const obj = { user: { profile: { name: 'John' } } };
      const result = (renderer as any).getNestedValue(obj, 'user.profile.name');
      
      expect(result).toBe('John');
    });

    it('should get array element', () => {
      const obj = { items: ['first', 'second'] };
      const result = (renderer as any).getNestedValue(obj, 'items[0]');
      
      expect(result).toBe('first');
    });

    it('should return undefined for missing path', () => {
      const obj = { user: { name: 'John' } };
      const result = (renderer as any).getNestedValue(obj, 'user.missing.property');
      
      expect(result).toBeUndefined();
    });

    it('should handle null/undefined objects', () => {
      const result1 = (renderer as any).getNestedValue(null, 'property');
      const result2 = (renderer as any).getNestedValue(undefined, 'property');
      
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });
  });

  describe('render', () => {
    it('should render template without xnovu_render calls', async () => {
      const template = 'Hello {{ name }}! Welcome to {{ building }}.';
      const context = {
        enterpriseId: testEnterpriseId,
        variables: { name: 'John', building: 'Tower A' }
      };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('Hello John! Welcome to Tower A.');
    });

    it('should handle template with xnovu_render calls', async () => {
      const template = `Before {{ xnovu_render("${testTemplateKey}", { name: "Alice", location: "Building B" }) }} After`;
      const context = {
        enterpriseId: testEnterpriseId,
        variables: {}
      };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('Before Hello Alice! Welcome to Building B. After');
    });

    it('should handle template loading errors gracefully', async () => {
      const template = 'Before {{ xnovu_render("nonexistent-key-' + Date.now() + '", {}) }} After';
      const context = {
        enterpriseId: testEnterpriseId,
        variables: {}
      };
      
      const result = await renderer.render(template, context);
      expect(result).toMatch(/Before \[Template Error: nonexistent-key-\d+\] After/);
    });

    it('should use real Supabase data', async () => {
      // Create another test template
      const dynamicKey = 'dynamic-test-' + Date.now();
      const { data: dynamicTemplate } = await supabase
        .schema('notify')
        .from('ent_notification_template')
        .insert({
          template_key: dynamicKey,
          name: 'Dynamic Test',
          body_template: 'Status: {{ status }}, Count: {{ count }}',
          channel_type: 'EMAIL',
          enterprise_id: testEnterpriseId,
          publish_status: 'PUBLISH',
          deactivated: false
        })
        .select()
        .single();

      const template = `Report: {{ xnovu_render("${dynamicKey}", { status: "Active", count: 42 }) }}`;
      const result = await renderer.render(template, {
        enterpriseId: testEnterpriseId,
        variables: {}
      });

      expect(result).toBe('Report: Status: Active, Count: 42');

      // Clean up
      if (dynamicTemplate) {
        await supabase
          .schema('notify')
          .from('ent_notification_template')
          .delete()
          .eq('id', dynamicTemplate.id);
      }
    });
  });

  describe('validateTemplate', () => {
    it('should validate template with valid syntax', async () => {
      const template = `Hello {{ name }}! {{ xnovu_render("${testTemplateKey}", { name: "Test", location: "Here" }) }}`;
      
      const result = await renderer.validateTemplate(template, testEnterpriseId);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid template references', async () => {
      const nonExistentKey = 'nonexistent-key-' + Date.now();
      const template = `Hello {{ xnovu_render("${nonExistentKey}", {}) }}`;
      
      const result = await renderer.validateTemplate(template, testEnterpriseId);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Template not found: ${nonExistentKey}`);
    });

    it('should detect empty variable placeholders', async () => {
      const template = 'Hello {{ }}!';
      
      const result = await renderer.validateTemplate(template, testEnterpriseId);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Empty variable placeholder'))).toBe(true);
    });
  });

  describe('cache management', () => {
    it('should cache loaded templates', async () => {
      // First call should hit database
      const start1 = Date.now();
      await (renderer as any).loadTemplate(testTemplateKey, testEnterpriseId);
      const duration1 = Date.now() - start1;

      // Second call should use cache (much faster)
      const start2 = Date.now();
      await (renderer as any).loadTemplate(testTemplateKey, testEnterpriseId);
      const duration2 = Date.now() - start2;

      // Cache access should be significantly faster
      expect(duration2).toBeLessThan(duration1 / 2);
    });

    it('should provide cache statistics', () => {
      const stats = renderer.getCacheStats();
      expect(stats).toHaveProperty('totalCached');
      expect(stats).toHaveProperty('validCached');
      expect(stats).toHaveProperty('expiredCached');
    });

    it('should clear cache when requested', async () => {
      // Add something to cache first
      await (renderer as any).loadTemplate(testTemplateKey, testEnterpriseId);
      
      expect(renderer.getCacheStats().totalCached).toBeGreaterThan(0);
      
      renderer.clearCache();
      expect(renderer.getCacheStats().totalCached).toBe(0);
    });
  });
});