import { TemplateRenderer } from '@/app/services/template/TemplateRenderer';

describe('TemplateRenderer', () => {
  let renderer: TemplateRenderer;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

  beforeEach(() => {
    renderer = new TemplateRenderer(supabaseUrl, supabaseServiceKey);
  });

  afterEach(() => {
    renderer.clearCache();
  });

  describe('render', () => {
    it('should render simple template', async () => {
      const template = 'Hello {{ name }}!';
      const context = {
        enterpriseId: 'test-enterprise',
        variables: { name: 'John' }
      };

      const result = await renderer.render(template, context);
      expect(result).toBe('Hello John!');
    });

    it('should render template with nested variables', async () => {
      const template = 'Hello {{ user.name }}! You are {{ user.age }} years old.';
      const context = {
        enterpriseId: 'test-enterprise',
        variables: { user: { name: 'John', age: 30 } }
      };

      const result = await renderer.render(template, context);
      expect(result).toBe('Hello John! You are 30 years old.');
    });

    it('should handle missing variables gracefully', async () => {
      const template = 'Hello {{ name }}!';
      const context = {
        enterpriseId: 'test-enterprise',
        variables: {}
      };

      const result = await renderer.render(template, context);
      expect(result).toBe('Hello !');
    });

    it('should throw error for missing xnovu_render template', async () => {
      const template = 'Header: {{ xnovu_render("header", { title: "Welcome" }) }}';
      const context = {
        enterpriseId: 'test-enterprise',
        variables: {}
      };

      // TemplateRenderer throws on error, unlike the underlying engine
      await expect(renderer.render(template, context)).rejects.toThrow();
    });

    it('should throw error for missing Liquid xnovu_render template', async () => {
      const template = 'Header: {% xnovu_render "header", title: "Welcome" %}';
      const context = {
        enterpriseId: 'test-enterprise',
        variables: {}
      };

      // TemplateRenderer throws on error, unlike the underlying engine
      await expect(renderer.render(template, context)).rejects.toThrow();
    });
  });

  describe('validateTemplate', () => {
    it('should validate valid template syntax', async () => {
      const template = 'Hello {{ name }}!';
      const result = await renderer.validateTemplate(template, 'test-enterprise');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid syntax', async () => {
      const template = 'Hello {{ name }!'; // Missing closing bracket
      const result = await renderer.validateTemplate(template, 'test-enterprise');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate xnovu_render syntax', async () => {
      const template = '{{ xnovu_render("header", { title: "Welcome" }) }}';
      const result = await renderer.validateTemplate(template, 'test-enterprise');

      // Legacy syntax should be converted and validated
      expect(result.errors.some(e => e.includes('syntax'))).toBe(false);
    });

    it('should validate Liquid xnovu_render syntax', async () => {
      const template = '{% xnovu_render "header", title: "Welcome" %}';
      const result = await renderer.validateTemplate(template, 'test-enterprise');

      expect(result.errors.some(e => e.includes('syntax'))).toBe(false);
    });
  });

  describe('renderTemplate', () => {
    it('should throw error when template not found', async () => {
      await expect(
        renderer.renderTemplate('non-existent', 'test-enterprise', {})
      ).rejects.toThrow();
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      expect(() => renderer.clearCache()).not.toThrow();
    });

    it('should clear expired cache', () => {
      expect(() => renderer.clearExpiredCache()).not.toThrow();
    });

    it('should get cache stats', () => {
      const stats = renderer.getCacheStats();
      expect(stats).toHaveProperty('totalCached');
      expect(stats).toHaveProperty('validCached');
      expect(stats).toHaveProperty('expiredCached');
    });
  });
});