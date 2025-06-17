import {
  sanitizeForChannel,
  sanitizeVariables,
  validateContentSafety,
  emailSanitizeConfig,
  inAppSanitizeConfig,
  textOnlySanitizeConfig
} from '@/app/services/template/utils/sanitizeConfig';
import sanitizeHtml from 'sanitize-html';

describe('sanitizeConfig', () => {
  describe('sanitizeForChannel', () => {
    describe('email channel', () => {
      it('should allow safe HTML formatting', () => {
        const content = '<p>Hello <strong>world</strong>!</p>';
        const result = sanitizeForChannel(content, 'email');
        expect(result).toBe('<p>Hello <strong>world</strong>!</p>');
      });

      it('should remove script tags', () => {
        const content = '<p>Hello</p><script>alert("xss")</script>';
        const result = sanitizeForChannel(content, 'email');
        expect(result).toBe('<p>Hello</p>');
        expect(result).not.toContain('script');
      });

      it('should sanitize javascript: URLs', () => {
        const content = '<a href="javascript:alert(1)">Click me</a>';
        const result = sanitizeForChannel(content, 'email');
        expect(result).not.toContain('javascript:');
        expect(result).toBe('<a>Click me</a>');
      });

      it('should add security attributes to external links', () => {
        const content = '<a href="https://example.com">External link</a>';
        const result = sanitizeForChannel(content, 'email');
        expect(result).toContain('target="_blank"');
        expect(result).toContain('rel="noopener noreferrer"');
      });

      it('should allow images with safe attributes', () => {
        const content = '<img src="https://example.com/image.jpg" alt="Image" width="100">';
        const result = sanitizeForChannel(content, 'email');
        expect(result).toContain('src="https://example.com/image.jpg"');
        expect(result).toContain('alt="Image"');
        expect(result).toContain('width="100"');
      });

      it('should allow table elements for email layouts', () => {
        const content = '<table><tr><td>Cell content</td></tr></table>';
        const result = sanitizeForChannel(content, 'email');
        expect(result).toBe('<table><tr><td>Cell content</td></tr></table>');
      });
    });

    describe('in-app channel', () => {
      it('should allow basic formatting', () => {
        const content = '<p>Hello <strong>world</strong>!</p>';
        const result = sanitizeForChannel(content, 'in_app');
        expect(result).toBe('<p>Hello <strong>world</strong>!</p>');
      });

      it('should remove script tags', () => {
        const content = '<p>Hello</p><script>alert("xss")</script>';
        const result = sanitizeForChannel(content, 'in_app');
        expect(result).toBe('<p>Hello</p>');
      });

      it('should remove style attributes', () => {
        const content = '<p style="color: red;">Styled text</p>';
        const result = sanitizeForChannel(content, 'in_app');
        expect(result).toBe('<p>Styled text</p>');
      });

      it('should add data attributes to external links', () => {
        const content = '<a href="https://example.com">External link</a>';
        const result = sanitizeForChannel(content, 'in_app');
        // The exact format may vary, but it should contain the security attributes
        expect(result).toContain('target="_blank"');
        expect(result).toContain('rel="noopener noreferrer"');
        expect(result).toContain('data-external-link="true"');
      });

      it('should not allow tables (more restrictive than email)', () => {
        const content = '<table><tr><td>Cell</td></tr></table>';
        const result = sanitizeForChannel(content, 'in_app');
        expect(result).toBe('Cell');
      });
    });

    describe('SMS channel', () => {
      it('should strip all HTML tags', () => {
        const content = '<p>Hello <strong>world</strong>!</p>';
        const result = sanitizeForChannel(content, 'sms');
        expect(result).toBe('Hello world!');
      });

      it('should decode HTML entities', () => {
        const content = 'Hello &amp; goodbye &lt;test&gt;';
        const result = sanitizeForChannel(content, 'sms');
        expect(result).toBe('Hello & goodbye <test>');
      });
    });
  });

  describe('sanitizeVariables', () => {
    it('should sanitize string variables', () => {
      const variables = {
        name: '<script>alert("xss")</script>John',
        message: '<p>Hello world</p>'
      };
      const result = sanitizeVariables(variables, 'email');
      expect(result.name).toBe('John');
      expect(result.message).toBe('<p>Hello world</p>');
    });

    it('should recursively sanitize nested objects', () => {
      const variables = {
        user: {
          name: '<script>alert("xss")</script>John',
          profile: {
            bio: '<p>Software developer</p>'
          }
        }
      };
      const result = sanitizeVariables(variables, 'email');
      expect(result.user.name).toBe('John');
      expect(result.user.profile.bio).toBe('<p>Software developer</p>');
    });

    it('should preserve non-string values', () => {
      const variables = {
        count: 42,
        active: true,
        tags: ['tag1', 'tag2'],
        metadata: null
      };
      const result = sanitizeVariables(variables, 'email');
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.metadata).toBe(null);
    });
  });

  describe('validateContentSafety', () => {
    it('should pass safe content', () => {
      const content = '<p>Hello <strong>world</strong>!</p>';
      const result = validateContentSafety(content);
      expect(result.safe).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect script tags', () => {
      const content = '<p>Hello</p><script>alert("xss")</script>';
      const result = validateContentSafety(content);
      expect(result.safe).toBe(false);
      expect(result.warnings).toContain('Contains script tags');
    });

    it('should detect javascript: protocol', () => {
      const content = '<a href="javascript:alert(1)">Click me</a>';
      const result = validateContentSafety(content);
      expect(result.safe).toBe(false);
      expect(result.warnings).toContain('Contains javascript: protocol');
    });

    it('should detect event handlers', () => {
      const content = '<div onclick="alert(1)">Click me</div>';
      const result = validateContentSafety(content);
      expect(result.safe).toBe(false);
      expect(result.warnings).toContain('Contains event handlers (onclick, onload, etc.)');
    });

    it('should detect CSS expressions', () => {
      const content = '<div style="background: expression(alert(1))">Content</div>';
      const result = validateContentSafety(content);
      expect(result.safe).toBe(false);
      expect(result.warnings).toContain('Contains CSS expressions');
    });

    it('should detect document property access', () => {
      const content = '<script>document.cookie = "evil"</script>';
      const result = validateContentSafety(content);
      expect(result.safe).toBe(false);
      expect(result.warnings).toContain('Contains script tags');
      expect(result.warnings).toContain('Attempts to access sensitive document properties');
    });

    it('should detect window manipulation', () => {
      const content = '<script>window.location = "evil.com"</script>';
      const result = validateContentSafety(content);
      expect(result.safe).toBe(false);
      expect(result.warnings).toContain('Contains script tags');
      expect(result.warnings).toContain('Attempts to manipulate window object');
    });
  });

  describe('sanitization configs', () => {
    it('should have appropriate allowed tags for email', () => {
      expect(emailSanitizeConfig.allowedTags).toContain('table');
      expect(emailSanitizeConfig.allowedTags).toContain('img');
      expect(emailSanitizeConfig.allowedTags).toContain('a');
      expect(emailSanitizeConfig.allowedTags).toContain('p');
    });

    it('should have restricted tags for in-app', () => {
      expect(inAppSanitizeConfig.allowedTags).not.toContain('table');
      expect(inAppSanitizeConfig.allowedTags).not.toContain('img');
      expect(inAppSanitizeConfig.allowedTags).toContain('a');
      expect(inAppSanitizeConfig.allowedTags).toContain('p');
    });

    it('should strip all tags for text-only', () => {
      expect(textOnlySanitizeConfig.allowedTags).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      expect(sanitizeForChannel('', 'email')).toBe('');
      expect(sanitizeForChannel('', 'in_app')).toBe('');
      expect(sanitizeForChannel('', 'sms')).toBe('');
    });

    it('should handle malformed HTML', () => {
      const content = '<p>Unclosed paragraph<div>Mixed elements</p></div>';
      const result = sanitizeForChannel(content, 'email');
      // Should not throw and should produce some valid output
      expect(typeof result).toBe('string');
    });

    it('should handle unknown channel types', () => {
      const content = '<p>Hello <script>alert(1)</script>world</p>';
      const result = sanitizeForChannel(content, 'unknown');
      // Should default to in-app (most restrictive with HTML support)
      expect(result).toBe('<p>Hello world</p>');
    });

    it('should handle very long content', () => {
      const longContent = '<p>' + 'A'.repeat(10000) + '</p>';
      const result = sanitizeForChannel(longContent, 'email');
      expect(result).toContain('<p>');
      expect(result).toContain('</p>');
    });

    it('should handle Unicode characters', () => {
      const content = '<p>Hello 世界! 🌍 Мир!</p>';
      const result = sanitizeForChannel(content, 'email');
      expect(result).toBe('<p>Hello 世界! 🌍 Мир!</p>');
    });
  });
});