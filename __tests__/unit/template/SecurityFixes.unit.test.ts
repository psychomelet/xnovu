import { EmailTemplateRenderer } from '@/app/services/template/renderers/EmailTemplateRenderer';
import { SupabaseTemplateLoader } from '@/app/services/template/loaders/SupabaseTemplateLoader';

// Mock Supabase loader for testing
const mockLoader = {
  loadTemplate: jest.fn(),
  clearCache: jest.fn(),
  clearExpiredCache: jest.fn(),
  getStats: jest.fn()
} as any;

describe('Security Fixes for GitHub Actions Bot Recommendations', () => {
  let renderer: EmailTemplateRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
    renderer = new EmailTemplateRenderer(mockLoader);
  });

  describe('Script tag filtering with loop-based approach', () => {
    it('should handle malformed script end tags with various whitespace and characters', async () => {
      const maliciousHtml = `
        <p>Safe content</p>
        <script>alert('xss')</script >
        <script>alert('another')  </script  >
        <script>alert('mixed')</script\t\n bar>
        <script>alert('attrs')</script disabled class="test">
        <p>More safe content</p>
      `;

      const template = 'Subject: Test\n\n' + maliciousHtml;
      const result = await renderer.render(template, {
        variables: {},
        format: 'html'
      }, {
        channelType: 'EMAIL',
        includeTextVersion: true
      });

      // Check the text version doesn't contain script content
      expect(result.textBody).toBeDefined();
      expect(result.textBody).not.toContain('alert');
      expect(result.textBody).not.toContain('xss');
      expect(result.textBody).toContain('Safe content');
      expect(result.textBody).toContain('More safe content');
      
      // Check the HTML version is sanitized
      expect(result.body).not.toContain('<script');
    });

    it('should handle nested script tags', async () => {
      const maliciousHtml = `
        <p>Safe content</p>
        <script><script>alert('nested')</script></script>
        <p>More safe content</p>
      `;

      const template = 'Subject: Test\n\n' + maliciousHtml;
      const result = await renderer.render(template, {
        variables: {},
        format: 'html'
      }, {
        channelType: 'EMAIL',
        includeTextVersion: true
      });

      expect(result.textBody).not.toContain('alert');
      expect(result.textBody).not.toContain('nested');
      expect(result.textBody).toContain('Safe content');
      
      expect(result.body).not.toContain('<script');
    });

    it('should handle style tags with malformed end tags and mixed characters', async () => {
      const maliciousHtml = `
        <p>Safe content</p>
        <style>body { background: url('javascript:alert(1)') }</style >
        <style>.evil { display: none }</style\t\n bar>
        <p>More safe content</p>
      `;

      const template = 'Subject: Test\n\n' + maliciousHtml;
      const result = await renderer.render(template, {
        variables: {},
        format: 'html'
      }, {
        channelType: 'EMAIL',
        includeTextVersion: true
      });

      expect(result.textBody).not.toContain('javascript:');
      expect(result.textBody).not.toContain('alert');
      expect(result.textBody).toContain('Safe content');
      
      expect(result.body).not.toContain('<style');
      expect(result.body).not.toContain('javascript:');
    });
  });

  describe('Incomplete multi-character sanitization fix', () => {
    it('should handle incomplete HTML tags', async () => {
      const maliciousHtml = `
        <p>Safe content</p>
        <scr<script>ipt>alert('test')</script>
        <sty<style>le>body{background:red}</style>
        <p>More safe content</p>
      `;

      const template = 'Subject: Test\n\n' + maliciousHtml;
      const result = await renderer.render(template, {
        variables: {},
        format: 'html'
      }, {
        channelType: 'EMAIL',
        includeTextVersion: true
      });

      // The important thing is that the dangerous content is neutralized
      expect(result.body).not.toContain('<script>');
      expect(result.body).not.toContain('<style>');
      expect(result.body).not.toContain('javascript:');
      
      // Safe content should be preserved
      expect(result.textBody).toContain('Safe content');
      expect(result.textBody).toContain('More safe content');
    });

    it('should handle deeply nested malformed HTML', async () => {
      const maliciousHtml = `
        <p>Safe content</p>
        <div<div<div<script>alert('nested')</script>></div>></div>></div>
        <p>More safe content</p>
      `;

      const template = 'Subject: Test\n\n' + maliciousHtml;
      const result = await renderer.render(template, {
        variables: {},
        format: 'html'
      }, {
        channelType: 'EMAIL',
        includeTextVersion: true
      });

      // Ensure no script execution is possible
      expect(result.body).not.toContain('<script>');
      expect(result.body).not.toContain('javascript:');
      
      // Safe content should be preserved
      expect(result.textBody).toContain('Safe content');
      expect(result.textBody).toContain('More safe content');
    });

    it('should handle mixed content with incomplete tags and scripts', async () => {
      const maliciousHtml = `
        <p>Safe content 1</p>
        <sc<script>ript>alert(1)</sc</script>ript>
        <p>Safe content 2</p>
        <sty<style>le>.bad{}</st</style>yle>
        <p>Safe content 3</p>
      `;

      const template = 'Subject: Test\n\n' + maliciousHtml;
      const result = await renderer.render(template, {
        variables: {},
        format: 'html'
      }, {
        channelType: 'EMAIL',
        includeTextVersion: true
      });

      // Ensure malicious content is neutralized
      expect(result.body).not.toContain('<script>');
      expect(result.body).not.toContain('<style>');
      expect(result.body).not.toContain('javascript:');
      
      // All safe content should be preserved
      expect(result.textBody).toContain('Safe content 1');
      expect(result.textBody).toContain('Safe content 2');
      expect(result.textBody).toContain('Safe content 3');
    });
  });

  describe('Loop-based sanitization effectiveness', () => {
    it('should eventually clean all malicious content with multiple iterations', async () => {
      const complexMalicious = `
        <p>Safe</p>
        <script>/* <script> */ alert(1) /* </script> */</script>
        <style>/* <style> */ body{} /* </style> */</style>
        <p>Content</p>
      `;

      const template = 'Subject: Test\n\n' + complexMalicious;
      const result = await renderer.render(template, {
        variables: {},
        format: 'html'
      }, {
        channelType: 'EMAIL',
        includeTextVersion: true
      });

      expect(result.textBody).not.toContain('alert');
      expect(result.textBody).not.toContain('/*');
      expect(result.textBody).toContain('Safe');
      expect(result.textBody).toContain('Content');
      
      expect(result.body).not.toContain('<script');
      expect(result.body).not.toContain('<style');
    });

    it('should handle maximum nesting scenarios', async () => {
      // Generate deeply nested script tags
      let nested = 'alert("deep")';
      for (let i = 0; i < 10; i++) {
        nested = `<script>${nested}</script>`;
      }

      const maliciousHtml = `
        <p>Safe content</p>
        ${nested}
        <p>More safe content</p>
      `;

      const template = 'Subject: Test\n\n' + maliciousHtml;
      const result = await renderer.render(template, {
        variables: {},
        format: 'html'
      }, {
        channelType: 'EMAIL',
        includeTextVersion: true
      });

      expect(result.textBody).not.toContain('alert');
      expect(result.textBody).not.toContain('deep');
      expect(result.textBody).toContain('Safe content');
    });
  });

  describe('Performance and safety verification', () => {
    it('should not get stuck in infinite loops', async () => {
      // Create content that might cause regex backtracking
      const potentiallyProblematic = `
        <p>Safe</p>
        <scr${'i'.repeat(1000)}pt>alert(1)</script>
        <p>Content</p>
      `;

      const template = 'Subject: Test\n\n' + potentiallyProblematic;
      
      // Should complete within reasonable time
      const startTime = Date.now();
      const result = await renderer.render(template, {
        variables: {},
        format: 'html'
      }, {
        channelType: 'EMAIL',
        includeTextVersion: true
      });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
      expect(result.textBody).toContain('Safe');
      expect(result.textBody).toContain('Content');
    });

    it('should handle very large malicious content', async () => {
      // Generate large content with many script tags
      const scripts = Array(100).fill('<script>alert("xss")</script>').join('\n');
      const maliciousHtml = `
        <p>Start</p>
        ${scripts}
        <p>End</p>
      `;

      const template = 'Subject: Test\n\n' + maliciousHtml;
      const result = await renderer.render(template, {
        variables: {},
        format: 'html'
      }, {
        channelType: 'EMAIL',
        includeTextVersion: true
      });

      expect(result.textBody).not.toContain('alert');
      expect(result.textBody).not.toContain('xss');
      expect(result.textBody).toContain('Start');
      expect(result.textBody).toContain('End');
      
      expect(result.body).not.toContain('<script');
    });
  });
});