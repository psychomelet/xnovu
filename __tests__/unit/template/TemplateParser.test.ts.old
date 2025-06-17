import { TemplateParser } from '@/app/services/template/core/TemplateParser';

describe('TemplateParser', () => {
  let parser: TemplateParser;

  beforeEach(() => {
    parser = new TemplateParser();
  });

  describe('parseXNovuRenderSyntax', () => {
    it('should parse single xnovu_render call', () => {
      const template = "Hello {{ xnovu_render('welcome_message', { name: 'John' }) }}!";
      const matches = parser.parseXNovuRenderSyntax(template);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        fullMatch: "{{ xnovu_render('welcome_message', { name: 'John' }) }}",
        templateKey: 'welcome_message',
        variables: { name: 'John' },
        startIndex: 6,
        endIndex: 61
      });
    });

    it('should parse multiple xnovu_render calls', () => {
      const template = `
        {{ xnovu_render('header', {}) }}
        Content here
        {{ xnovu_render('footer', { year: 2024 }) }}
      `;
      const matches = parser.parseXNovuRenderSyntax(template);

      expect(matches).toHaveLength(2);
      expect(matches[0].templateKey).toBe('header');
      expect(matches[0].variables).toEqual({});
      expect(matches[1].templateKey).toBe('footer');
      expect(matches[1].variables).toEqual({ year: 2024 });
    });

    it('should handle nested objects in variables', () => {
      const template = "{{ xnovu_render('complex', { user: { name: 'John', age: 30 }, active: true }) }}";
      const matches = parser.parseXNovuRenderSyntax(template);

      expect(matches).toHaveLength(1);
      expect(matches[0].variables).toEqual({
        user: { name: 'John', age: 30 },
        active: true
      });
    });

    it('should handle different quote styles', () => {
      const templates = [
        `{{ xnovu_render('single', {}) }}`,
        `{{ xnovu_render("double", {}) }}`,
        `{{ xnovu_render(\`backtick\`, {}) }}`
      ];

      templates.forEach((template, index) => {
        const matches = parser.parseXNovuRenderSyntax(template);
        expect(matches).toHaveLength(1);
        expect(matches[0].templateKey).toBe(['single', 'double', 'backtick'][index]);
      });
    });

    it('should handle whitespace variations', () => {
      const templates = [
        `{{xnovu_render('compact',{})}}`,
        `{{ xnovu_render( 'spaced' , { } ) }}`,
        `{{  xnovu_render(  'extra'  ,  {}  )  }}`
      ];

      templates.forEach((template) => {
        const matches = parser.parseXNovuRenderSyntax(template);
        expect(matches).toHaveLength(1);
      });
    });

    it('should return empty array for no matches', () => {
      const template = 'Hello {{name}}, welcome!';
      const matches = parser.parseXNovuRenderSyntax(template);
      expect(matches).toEqual([]);
    });

    it('should handle malformed xnovu_render calls gracefully', () => {
      const template = "{{ xnovu_render('bad', { invalid json }) }}";
      const matches = parser.parseXNovuRenderSyntax(template);
      
      // Parser should attempt to parse but variables might be empty due to invalid JSON
      expect(matches).toHaveLength(1);
      expect(matches[0].templateKey).toBe('bad');
      expect(matches[0].variables).toEqual({});
    });
  });

  describe('extractVariablePlaceholders', () => {
    it('should extract simple variables', () => {
      const template = 'Hello {{name}}, your email is {{email}}';
      const variables = parser.extractVariablePlaceholders(template);

      expect(variables).toEqual(['name', 'email']);
    });

    it('should extract nested variables', () => {
      const template = 'User: {{user.name}} from {{user.address.city}}';
      const variables = parser.extractVariablePlaceholders(template);

      expect(variables).toEqual(['user.name', 'user.address.city']);
    });

    it('should extract array access variables', () => {
      const template = 'First item: {{items[0]}}, Second: {{items[1].name}}';
      const variables = parser.extractVariablePlaceholders(template);

      expect(variables).toEqual(['items[0]', 'items[1].name']);
    });

    it('should ignore xnovu_render calls', () => {
      const template = "{{name}} and {{ xnovu_render('test', {}) }}";
      const variables = parser.extractVariablePlaceholders(template);

      expect(variables).toEqual(['name']);
    });

    it('should return unique variables only', () => {
      const template = '{{name}} and {{name}} again, plus {{email}}';
      const variables = parser.extractVariablePlaceholders(template);

      expect(variables).toEqual(['name', 'email']);
    });

    it('should handle empty template', () => {
      const variables = parser.extractVariablePlaceholders('');
      expect(variables).toEqual([]);
    });
  });

  describe('validateSyntax', () => {
    it('should validate correct syntax', () => {
      const template = 'Hello {{name}}!';
      const result = parser.validateSyntax(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect empty placeholders', () => {
      const template = 'Hello {{}}!';
      const result = parser.validateSyntax(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Empty variable placeholder at position 6');
    });

    it('should detect mismatched brackets', () => {
      const template = 'Hello {{name} and {{email}}';
      const result = parser.validateSyntax(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Mismatched brackets: 2 opening, 1 closing');
    });

    it('should validate xnovu_render syntax', () => {
      const template = "{{ xnovu_render('test', { name: 'value' }) }}";
      const result = parser.validateSyntax(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle complex mixed templates', () => {
      const template = `
        {{ xnovu_render('header', { title: 'Welcome' }) }}
        Hello {{user.name}},
        Your balance is {{account.balance}}
        {{ xnovu_render('footer', {}) }}
      `;
      const result = parser.validateSyntax(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});