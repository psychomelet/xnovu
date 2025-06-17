import { VariableInterpolator } from '@/app/services/template/core/VariableInterpolator';

describe('VariableInterpolator', () => {
  let interpolator: VariableInterpolator;

  beforeEach(() => {
    interpolator = new VariableInterpolator();
  });

  describe('interpolate', () => {
    it('should interpolate simple variables', () => {
      const template = 'Hello {{name}}, welcome!';
      const variables = { name: 'John' };
      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('Hello John, welcome!');
    });

    it('should interpolate multiple variables', () => {
      const template = '{{greeting}} {{name}}, your email is {{email}}';
      const variables = {
        greeting: 'Hello',
        name: 'John',
        email: 'john@example.com'
      };
      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('Hello John, your email is john@example.com');
    });

    it('should handle nested object properties', () => {
      const template = 'User: {{user.name}} from {{user.address.city}}';
      const variables = {
        user: {
          name: 'John',
          address: {
            city: 'New York'
          }
        }
      };
      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('User: John from New York');
    });

    it('should handle array access', () => {
      const template = 'First: {{items[0]}}, Second: {{items[1]}}';
      const variables = {
        items: ['Apple', 'Banana', 'Cherry']
      };
      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('First: Apple, Second: Banana');
    });

    it('should handle nested array access', () => {
      const template = 'Name: {{users[0].name}}, Age: {{users[0].age}}';
      const variables = {
        users: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 }
        ]
      };
      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('Name: John, Age: 30');
    });

    it('should preserve undefined variables', () => {
      const template = 'Hello {{name}}, your ID is {{id}}';
      const variables = { name: 'John' };
      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('Hello John, your ID is {{id}}');
    });

    it('should convert non-string values to strings', () => {
      const template = 'Count: {{count}}, Active: {{active}}, Score: {{score}}';
      const variables = {
        count: 42,
        active: true,
        score: 3.14
      };
      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('Count: 42, Active: true, Score: 3.14');
    });

    it('should handle null and undefined values', () => {
      const template = 'Null: {{nullValue}}, Undefined: {{undefinedValue}}';
      const variables = {
        nullValue: null,
        undefinedValue: undefined
      };
      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('Null: null, Undefined: {{undefinedValue}}');
    });

    it('should handle whitespace in placeholders', () => {
      const template = 'Hello {{ name }}, welcome {{ user.name }}!';
      const variables = {
        name: 'John',
        user: { name: 'Jane' }
      };
      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('Hello John, welcome Jane!');
    });

    it('should handle empty template', () => {
      const result = interpolator.interpolate('', { name: 'John' });
      expect(result).toBe('');
    });

    it('should handle template with no variables', () => {
      const template = 'Hello world!';
      const result = interpolator.interpolate(template, { name: 'John' });
      expect(result).toBe('Hello world!');
    });
  });

  describe('hasVariable', () => {
    it('should return true for existing variables', () => {
      const obj = {
        name: 'John',
        user: { email: 'john@example.com' }
      };

      expect(interpolator.hasVariable(obj, 'name')).toBe(true);
      expect(interpolator.hasVariable(obj, 'user.email')).toBe(true);
    });

    it('should return false for non-existing variables', () => {
      const obj = { name: 'John' };

      expect(interpolator.hasVariable(obj, 'email')).toBe(false);
      expect(interpolator.hasVariable(obj, 'user.email')).toBe(false);
    });

    it('should handle array access', () => {
      const obj = {
        items: ['a', 'b', 'c'],
        users: [{ name: 'John' }]
      };

      expect(interpolator.hasVariable(obj, 'items[0]')).toBe(true);
      expect(interpolator.hasVariable(obj, 'items[3]')).toBe(false);
      expect(interpolator.hasVariable(obj, 'users[0].name')).toBe(true);
    });
  });

  describe('extractValue', () => {
    it('should extract values with type preservation', () => {
      const obj = {
        string: 'text',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { key: 'value' }
      };

      expect(interpolator.extractValue(obj, 'string')).toBe('text');
      expect(interpolator.extractValue(obj, 'number')).toBe(42);
      expect(interpolator.extractValue(obj, 'boolean')).toBe(true);
      expect(interpolator.extractValue(obj, 'array')).toEqual([1, 2, 3]);
      expect(interpolator.extractValue(obj, 'object')).toEqual({ key: 'value' });
    });
  });

  describe('setNestedValue', () => {
    it('should set simple values', () => {
      const obj: Record<string, any> = {};
      interpolator.setNestedValue(obj, 'name', 'John');

      expect(obj.name).toBe('John');
    });

    it('should set nested values', () => {
      const obj: Record<string, any> = {};
      interpolator.setNestedValue(obj, 'user.profile.name', 'John');

      expect(obj.user.profile.name).toBe('John');
    });

    it('should set array values', () => {
      const obj: Record<string, any> = {};
      interpolator.setNestedValue(obj, 'items[0]', 'first');
      interpolator.setNestedValue(obj, 'items[2]', 'third');

      expect(obj.items[0]).toBe('first');
      expect(obj.items[1]).toBeUndefined();
      expect(obj.items[2]).toBe('third');
    });

    it('should set nested array values', () => {
      const obj: Record<string, any> = {};
      interpolator.setNestedValue(obj, 'users[0].name', 'John');

      expect(obj.users[0].name).toBe('John');
    });
  });

  describe('interpolateWithFormatter', () => {
    it('should use custom formatter', () => {
      const template = 'Price: {{price}}, Date: {{date}}';
      const variables = {
        price: 42.5,
        date: new Date('2024-01-01')
      };
      const formatter = (value: any, path: string) => {
        if (path === 'price') {
          return `$${value.toFixed(2)}`;
        }
        if (path === 'date' && value instanceof Date) {
          return value.toLocaleDateString();
        }
        return String(value);
      };

      const result = interpolator.interpolateWithFormatter(template, variables, formatter);
      // The date will format differently based on locale and timezone
      expect(result).toMatch(/Price: \$42\.50, Date: \d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });

  describe('getAllPaths', () => {
    it('should get all paths from object', () => {
      const obj = {
        name: 'John',
        user: {
          email: 'john@example.com',
          profile: {
            age: 30
          }
        },
        items: ['a', { id: 1 }]
      };

      const paths = interpolator.getAllPaths(obj);

      expect(paths).toContain('name');
      expect(paths).toContain('user');
      expect(paths).toContain('user.email');
      expect(paths).toContain('user.profile');
      expect(paths).toContain('user.profile.age');
      expect(paths).toContain('items');
      expect(paths).toContain('items[0]');
      expect(paths).toContain('items[1]');
      expect(paths).toContain('items[1].id');
    });

    it('should handle empty object', () => {
      const paths = interpolator.getAllPaths({});
      expect(paths).toEqual([]);
    });
  });
});