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

      // Access the private method for testing
      const htmlToText = (renderer as any).htmlToText.bind(renderer);
      const result = htmlToText(maliciousHtml);

      // Should not contain script content
      expect(result).not.toContain('alert');
      expect(result).not.toContain('xss');
      expect(result).not.toContain('another');
      expect(result).not.toContain('mixed');
      expect(result).not.toContain('attrs');
      expect(result).toContain('Safe content');
      expect(result).toContain('More safe content');
    });

    it('should handle nested script tags', async () => {
      const maliciousHtml = `
        <p>Safe content</p>
        <script><script>alert('nested')</script></script>
        <p>More safe content</p>
      `;

      const htmlToText = (renderer as any).htmlToText.bind(renderer);
      const result = htmlToText(maliciousHtml);

      expect(result).not.toContain('alert');
      expect(result).not.toContain('nested');
      expect(result).toContain('Safe content');
    });

    it('should handle style tags with malformed end tags and mixed characters', async () => {
      const maliciousHtml = `
        <p>Safe content</p>
        <style>body { background: url('javascript:alert(1)') }</style >
        <style >body { color: red }  </style  >
        <style>body { margin: 0 }</style\t\n disabled>
        <style>body { padding: 0 }</style class="test" id="bad">
        <p>More safe content</p>
      `;

      const htmlToText = (renderer as any).htmlToText.bind(renderer);
      const result = htmlToText(maliciousHtml);

      expect(result).not.toContain('javascript:alert');
      expect(result).not.toContain('background');
      expect(result).not.toContain('color: red');
      expect(result).not.toContain('margin: 0');
      expect(result).not.toContain('padding: 0');
      expect(result).toContain('Safe content');
    });
  });

  describe('Incomplete multi-character sanitization fix', () => {
    it('should handle incomplete HTML tags', async () => {
      const maliciousHtml = `
        <p>Safe content</p>
        <div onclick="alert('xss')" 
        <span>More content</span>
        <img src="x" onerror="alert('img')"
        <p>Final content</p>
      `;

      const htmlToText = (renderer as any).htmlToText.bind(renderer);
      const result = htmlToText(maliciousHtml);

      // Should not contain event handlers or incomplete tags
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
      expect(result).toContain('Safe content');
      expect(result).toContain('More content');
      expect(result).toContain('Final content');
    });

    it('should handle deeply nested malformed HTML', async () => {
      const maliciousHtml = `
        <div><script><div><script>alert('deep')</script></div></script></div>
        <p><span><a href="javascript:void(0)">Link</a></span></p>
        <img><script>alert('after img')</script>
      `;

      const htmlToText = (renderer as any).htmlToText.bind(renderer);
      const result = htmlToText(maliciousHtml);

      expect(result).not.toContain('alert');
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('deep');
      expect(result).toContain('Link');
    });

    it('should handle mixed content with incomplete tags and scripts', async () => {
      const maliciousHtml = `
        <p>Start</p>
        <script>var x = '<script>alert("nested")</script>';</script>
        <div onclick="alert('div')"
        <style>body { background: url('data:text/html,<script>alert(1)</script>') }</style>
        <a href="javascript:alert('link')">Click</a>
        <p>End</p>
      `;

      const htmlToText = (renderer as any).htmlToText.bind(renderer);
      const result = htmlToText(maliciousHtml);

      expect(result).not.toContain('alert');
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('<script>');
      expect(result).toContain('Start');
      expect(result).toContain('Click');
      expect(result).toContain('End');
    });
  });

  describe('Loop-based sanitization effectiveness', () => {
    it('should eventually clean all malicious content with multiple iterations', async () => {
      // This test verifies that the do-while loops will eventually clean all content
      const maliciousHtml = `
        <script><script><script>alert('triple')</script></script></script>
        <div><script>alert('in div')</script></div>
        <style><style>body { color: red }</style></style>
        <p>Safe content</p>
      `;

      const htmlToText = (renderer as any).htmlToText.bind(renderer);
      const result = htmlToText(maliciousHtml);

      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
      expect(result).not.toContain('style');
      expect(result).not.toContain('color: red');
      expect(result).toContain('Safe content');
    });

    it('should handle maximum nesting scenarios', async () => {
      // Create deeply nested malicious content
      let nestedContent = 'alert("deep")';
      for (let i = 0; i < 10; i++) {
        nestedContent = `<script>${nestedContent}</script>`;
      }
      const maliciousHtml = `<p>Safe</p>${nestedContent}<p>Also Safe</p>`;

      const htmlToText = (renderer as any).htmlToText.bind(renderer);
      const result = htmlToText(maliciousHtml);

      expect(result).not.toContain('alert');
      expect(result).not.toContain('script');
      expect(result).not.toContain('deep');
      expect(result).toContain('Safe');
      expect(result).toContain('Also Safe');
    });
  });

  describe('Performance and safety verification', () => {
    it('should not get stuck in infinite loops', async () => {
      const maliciousHtml = `
        <script>while(true) { alert('infinite'); }</script>
        <p>Content</p>
      `;

      const htmlToText = (renderer as any).htmlToText.bind(renderer);
      const startTime = Date.now();
      const result = htmlToText(maliciousHtml);
      const endTime = Date.now();

      // Should complete quickly (under 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result).not.toContain('while');
      expect(result).not.toContain('alert');
      expect(result).toContain('Content');
    });

    it('should handle very large malicious content', async () => {
      // Create large content with embedded scripts
      const largeContent = 'A'.repeat(10000);
      const maliciousHtml = `
        <p>${largeContent}</p>
        <script>alert('large')</script>
        <p>${largeContent}</p>
      `;

      const htmlToText = (renderer as any).htmlToText.bind(renderer);
      const result = htmlToText(maliciousHtml);

      expect(result).not.toContain('alert');
      expect(result).not.toContain('script');
      expect(result).toContain('A'); // Should contain the safe content
    });
  });
});