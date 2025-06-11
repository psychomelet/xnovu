import { TemplateRenderer } from '../app/services/template/TemplateRenderer';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn()
              }))
            }))
          }))
        }))
      }))
    }))
  }))
}));

describe('TemplateRenderer', () => {
  let renderer: TemplateRenderer;
  let mockSupabase: any;

  beforeEach(() => {
    // Setup mock Supabase client
    const { createClient } = require('@supabase/supabase-js');
    mockSupabase = createClient();
    
    renderer = new TemplateRenderer('http://localhost:54321', 'test-key');
  });

  afterEach(() => {
    jest.clearAllMocks();
    renderer.clearCache();
  });

  describe('parseXNovuRenderSyntax', () => {
    it('should parse simple xnovu_render syntax', () => {
      const template = 'Hello {{ xnovu_render("123", { name: "John" }) }}!';
      const matches = (renderer as any).parseXNovuRenderSyntax(template);
      
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({
        templateId: '123',
        variables: { name: 'John' },
        startIndex: 6,
        endIndex: 47
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
      expect(matches[0].templateId).toBe('header');
      expect(matches[1].templateId).toBe('footer');
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
        enterpriseId: 'test-enterprise',
        variables: { name: 'John', building: 'Tower A' }
      };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('Hello John! Welcome to Tower A.');
    });

    it('should handle template with xnovu_render calls', async () => {
      // Mock the database call
      const mockTemplate = {
        id: 123,
        body_template: 'Header: {{ title }}',
        subject_template: null,
        variables_description: null,
        name: 'test-template',
        description: null,
        publish_status: 'PUBLISHED' as const,
        deactivated: false,
        typ_notification_category_id: null,
        business_id: null,
        channel_type: 'EMAIL' as const,
        repr: null,
        enterprise_id: 'test-enterprise',
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null
      };

      mockSupabase.from().select().eq().eq().eq().eq().single.mockResolvedValue({
        data: mockTemplate,
        error: null
      });

      const template = 'Before {{ xnovu_render("123", { title: "Welcome" }) }} After';
      const context = {
        enterpriseId: 'test-enterprise',
        variables: {}
      };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('Before Header: Welcome After');
    });

    it('should handle template loading errors gracefully', async () => {
      // Mock database error
      mockSupabase.from().select().eq().eq().eq().eq().single.mockResolvedValue({
        data: null,
        error: new Error('Template not found')
      });

      const template = 'Before {{ xnovu_render("nonexistent", {}) }} After';
      const context = {
        enterpriseId: 'test-enterprise',
        variables: {}
      };
      
      const result = await renderer.render(template, context);
      expect(result).toBe('Before [Template Error: nonexistent] After');
    });
  });

  describe('validateTemplate', () => {
    it('should validate template with valid syntax', async () => {
      const template = 'Hello {{ name }}! {{ xnovu_render("123", { key: "value" }) }}';
      
      // Mock successful template loading
      mockSupabase.from().select().eq().eq().eq().eq().single.mockResolvedValue({
        data: { id: 123, body_template: 'Test' },
        error: null
      });
      
      const result = await renderer.validateTemplate(template, 'test-enterprise');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid template references', async () => {
      const template = 'Hello {{ xnovu_render("nonexistent", {}) }}';
      
      // Mock template not found
      mockSupabase.from().select().eq().eq().eq().eq().single.mockResolvedValue({
        data: null,
        error: new Error('Not found')
      });
      
      const result = await renderer.validateTemplate(template, 'test-enterprise');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template not found: nonexistent');
    });

    it('should detect empty variable placeholders', async () => {
      const template = 'Hello {{ }}!';
      
      const result = await renderer.validateTemplate(template, 'test-enterprise');
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Empty variable placeholder'))).toBe(true);
    });
  });

  describe('cache management', () => {
    it('should cache loaded templates', async () => {
      const mockTemplate = {
        id: 123,
        body_template: 'Cached template',
        subject_template: null,
        variables_description: null,
        name: 'test',
        description: null,
        publish_status: 'PUBLISHED' as const,
        deactivated: false,
        typ_notification_category_id: null,
        business_id: null,
        channel_type: 'EMAIL' as const,
        repr: null,
        enterprise_id: 'test-enterprise',
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null
      };

      mockSupabase.from().select().eq().eq().eq().eq().single.mockResolvedValue({
        data: mockTemplate,
        error: null
      });

      // First call should hit database
      await (renderer as any).loadTemplate('123', 'test-enterprise');
      expect(mockSupabase.from().select().eq().eq().eq().eq().single).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await (renderer as any).loadTemplate('123', 'test-enterprise');
      expect(mockSupabase.from().select().eq().eq().eq().eq().single).toHaveBeenCalledTimes(1);
    });

    it('should provide cache statistics', () => {
      const stats = renderer.getCacheStats();
      expect(stats).toHaveProperty('totalCached');
      expect(stats).toHaveProperty('validCached');
      expect(stats).toHaveProperty('expiredCached');
    });

    it('should clear cache when requested', async () => {
      // Add something to cache first
      (renderer as any).cache.set('test-key', {
        body: 'test',
        variables: {},
        compiledAt: new Date()
      });

      expect(renderer.getCacheStats().totalCached).toBe(1);
      
      renderer.clearCache();
      expect(renderer.getCacheStats().totalCached).toBe(0);
    });
  });
});