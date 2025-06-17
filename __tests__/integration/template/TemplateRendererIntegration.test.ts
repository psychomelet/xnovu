import { TemplateEngine } from '@/app/services/template/core/TemplateEngine';
import { SupabaseTemplateLoader } from '@/app/services/template/loaders/SupabaseTemplateLoader';
import { EmailTemplateRenderer } from '@/app/services/template/renderers/EmailTemplateRenderer';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

const TEST_ENTERPRISE_ID = '00000000-0000-0000-0000-000000000010';

describe('Template Renderer Integration', () => {
  let engine: TemplateEngine;
  let emailRenderer: EmailTemplateRenderer;
  let loader: SupabaseTemplateLoader;
  let supabase: ReturnType<typeof createClient<Database>>;

  beforeAll(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found in environment variables');
    }

    loader = new SupabaseTemplateLoader(supabaseUrl, supabaseKey);
    engine = new TemplateEngine(loader);
    emailRenderer = new EmailTemplateRenderer(loader);
    supabase = createClient<Database>(supabaseUrl, supabaseKey);
  });

  beforeEach(async () => {
    // Clean up test templates
    await supabase
      .schema('notify')
      .from('ent_notification_template')
      .delete()
      .eq('enterprise_id', TEST_ENTERPRISE_ID);

    // Insert test templates
    await supabase
      .schema('notify')
      .from('ent_notification_template')
      .insert([
        {
          template_key: 'email-header',
          name: 'Email Header',
          body_template: '<header style="background: #f0f0f0; padding: 20px;"><h1>{{company}}</h1></header>',
          channel_type: 'EMAIL',
          publish_status: 'PUBLISH',
          deactivated: false,
          enterprise_id: TEST_ENTERPRISE_ID
        },
        {
          template_key: 'email-footer',
          name: 'Email Footer',
          body_template: '<footer style="margin-top: 40px; font-size: 12px;">© {{year}} {{company}}. All rights reserved.</footer>',
          channel_type: 'EMAIL',
          publish_status: 'PUBLISH',
          deactivated: false,
          enterprise_id: TEST_ENTERPRISE_ID
        },
        {
          template_key: 'welcome-content',
          name: 'Welcome Content',
          body_template: `
            <div style="padding: 20px;">
              <h2>Welcome {{user.name}}!</h2>
              <p>Thank you for joining {{company}}. Your account has been created with the email: {{user.email}}.</p>
              <p>Get started by <a href="{{actionUrl}}">completing your profile</a>.</p>
            </div>
          `,
          channel_type: 'EMAIL',
          publish_status: 'PUBLISH',
          deactivated: false,
          enterprise_id: TEST_ENTERPRISE_ID
        },
        {
          template_key: 'full-email',
          name: 'Full Email Template',
          subject_template: 'Welcome to {{company}}, {{user.name}}!',
          body_template: `
            {{ xnovu_render('email-header', { company: 'Acme Corp' }) }}
            {{ xnovu_render('welcome-content', { user: { name: 'John Doe', email: 'john@example.com' }, company: 'Acme Corp', actionUrl: 'https://example.com/profile' }) }}
            {{ xnovu_render('email-footer', { year: 2024, company: 'Acme Corp' }) }}
          `,
          channel_type: 'EMAIL',
          publish_status: 'PUBLISH',
          deactivated: false,
          enterprise_id: TEST_ENTERPRISE_ID,
          variables_description: {
            user: { name: 'string', email: 'string' },
            company: 'string',
            currentYear: 'number'
          }
        },
        {
          template_key: 'full-email-dynamic',
          name: 'Full Email Template Dynamic',
          subject_template: 'Welcome to {{company}}, {{user.name}}!',
          body_template: `
            {{ xnovu_render('email-header', { company: 'Tech Solutions' }) }}
            {{ xnovu_render('welcome-content', { user: { name: 'Jane Smith', email: 'jane@example.com' }, company: 'Tech Solutions', actionUrl: 'https://example.com/profile' }) }}
            {{ xnovu_render('email-footer', { year: 2024, company: 'Tech Solutions' }) }}
          `,
          channel_type: 'EMAIL',
          publish_status: 'PUBLISH',
          deactivated: false,
          enterprise_id: TEST_ENTERPRISE_ID,
          variables_description: {
            user: { name: 'string', email: 'string' },
            company: 'string',
            currentYear: 'number'
          }
        },
        {
          template_key: 'notification-template',
          name: 'Notification Template',
          body_template: `
            <div class="notification">
              <h3>{{title}}</h3>
              <p>{{message}}</p>
              {{ xnovu_render('action-buttons', { actions: actions }) }}
            </div>
          `,
          channel_type: 'IN_APP',
          publish_status: 'PUBLISH',
          deactivated: false,
          enterprise_id: TEST_ENTERPRISE_ID
        },
        {
          template_key: 'action-buttons',
          name: 'Action Buttons',
          body_template: `
            <div class="actions">
              <button onclick="handleAction('{{actions.primary.id}}')">{{actions.primary.label}}</button>
              <button onclick="handleAction('{{actions.secondary.id}}')">{{actions.secondary.label}}</button>
            </div>
          `,
          channel_type: 'IN_APP',
          publish_status: 'PUBLISH',
          deactivated: false,
          enterprise_id: TEST_ENTERPRISE_ID
        }
      ]);
  });

  afterAll(async () => {
    // Final cleanup
    await supabase
      .schema('notify')
      .from('ent_notification_template')
      .delete()
      .eq('enterprise_id', TEST_ENTERPRISE_ID);
  });

  describe('TemplateEngine with Supabase', () => {
    it('should render template with nested xnovu_render calls', async () => {
      const context = {
        enterpriseId: TEST_ENTERPRISE_ID,
        variables: {
          user: {
            name: 'John Doe',
            email: 'john@example.com'
          },
          company: 'Acme Corp',
          currentYear: 2024
        }
      };

      const result = await engine.renderByKey('full-email', context);

      expect(result.errors).toHaveLength(0);
      expect(result.metadata?.subject).toBe('Welcome to Acme Corp, John Doe!');
      expect(result.content).toContain('<h1>Acme Corp</h1>');
      expect(result.content).toContain('Welcome John Doe!');
      expect(result.content).toContain('john@example.com');
      expect(result.content).toContain('© 2024 Acme Corp');
      // Note: renderByKey doesn't include the initial template in templatesLoaded, only nested ones
      expect(result.metadata?.templatesLoaded).toContain('email-header');
      expect(result.metadata?.templatesLoaded).toContain('welcome-content');
      expect(result.metadata?.templatesLoaded).toContain('email-footer');
    });

    it('should handle missing nested templates gracefully', async () => {
      const template = `
        Hello {{name}},
        {{ xnovu_render('missing-template', {}) }}
        Best regards
      `;

      const result = await engine.render(template, {
        enterpriseId: TEST_ENTERPRISE_ID,
        variables: { name: 'John' }
      });

      expect(result.content).toContain('Hello John');
      expect(result.content).toContain('[Template Error: missing-template]');
      expect(result.content).toContain('Best regards');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].templateKey).toBe('missing-template');
    });

    it('should validate templates with database lookup', async () => {
      const template = `
        {{ xnovu_render('email-header', { company: 'Test' }) }}
        Content here
        {{ xnovu_render('non-existent', {}) }}
      `;

      const validation = await engine.validate(template, {
        enterpriseId: TEST_ENTERPRISE_ID
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Template not found: non-existent');
    });

    it('should extract variables from nested templates', async () => {
      const template = "{{ xnovu_render('notification-template', {}) }}";
      
      const variables = await engine.extractVariables(template, {
        enterpriseId: TEST_ENTERPRISE_ID
      });

      expect(variables).toContain('title');
      expect(variables).toContain('message');
      // Note: Variable extraction finds the actual nested variables used, not just the root object
      expect(variables).toContain('actions.primary.id');
      expect(variables).toContain('actions.primary.label');
      expect(variables).toContain('actions.secondary.id');
      expect(variables).toContain('actions.secondary.label');
    });
  });

  describe('EmailTemplateRenderer with Supabase', () => {
    it('should render email template with all features', async () => {
      const context = {
        enterpriseId: TEST_ENTERPRISE_ID,
        variables: {
          user: {
            name: 'Jane Smith',
            email: 'jane@example.com'
          },
          company: 'Tech Solutions',
          currentYear: 2024
        }
      };

      const result = await emailRenderer.renderByKey('full-email-dynamic', context, {
        includeTextVersion: true,
        subjectPrefix: '[Important]'
      });

      expect(result.subject).toBe('[Important] Welcome to Tech Solutions, Jane Smith!');
      expect(result.body).toContain('<h1>Tech Solutions</h1>');
      expect(result.body).toContain('Welcome Jane Smith!');
      expect(result.textBody).toBeDefined();
      expect(result.textBody).toContain('Tech Solutions');
      expect(result.textBody).toContain('Welcome Jane Smith!');
      expect(result.textBody).not.toContain('<h1>');
    });

    it('should handle enterprise isolation', async () => {
      // Try to render template from different enterprise
      const context = {
        enterpriseId: 'different-enterprise',
        variables: {
          user: { name: 'Test', email: 'test@example.com' },
          company: 'Test Co',
          currentYear: 2024
        }
      };

      const result = await emailRenderer.renderByKey('full-email', context);

      expect(result.errors).toHaveLength(1);
      expect(result.content).toContain('[Email Template Error: full-email]');
    });
  });

  describe('Complex nested template scenarios', () => {
    it('should handle deeply nested templates with variable inheritance', async () => {
      // Create deeply nested templates
      await supabase
        .schema('notify')
        .from('ent_notification_template')
        .insert([
          {
            template_key: 'level-1',
            name: 'Level 1',
            body_template: "L1: {{var1}} - {{ xnovu_render('level-2', { var2: 'from-L1' }) }}",
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          },
          {
            template_key: 'level-2',
            name: 'Level 2',
            body_template: "L2: {{var1}}, {{var2}} - {{ xnovu_render('level-3', { var3: 'from-L2' }) }}",
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          },
          {
            template_key: 'level-3',
            name: 'Level 3',
            body_template: "L3: {{var1}}, {{var2}}, {{var3}}",
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          }
        ]);

      const result = await engine.renderByKey('level-1', {
        enterpriseId: TEST_ENTERPRISE_ID,
        variables: { var1: 'root-value' }
      });

      expect(result.content).toBe('L1: root-value - L2: root-value, from-L1 - L3: root-value, from-L1, from-L2');
      expect(result.metadata?.templatesLoaded).toEqual(['level-1', 'level-2', 'level-3']);
    });

    it('should handle circular reference protection', async () => {
      // Create circular reference
      await supabase
        .schema('notify')
        .from('ent_notification_template')
        .insert([
          {
            template_key: 'circular-1',
            name: 'Circular 1',
            body_template: "C1: {{ xnovu_render('circular-2', {}) }}",
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          },
          {
            template_key: 'circular-2',
            name: 'Circular 2',
            body_template: "C2: {{ xnovu_render('circular-1', {}) }}",
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          }
        ]);

      const result = await engine.renderByKey('circular-1', {
        enterpriseId: TEST_ENTERPRISE_ID,
        variables: {}
      }, { maxDepth: 5 });

      expect(result.errors).toHaveLength(1);
      // Accept either circular dependency or max depth error
      expect(
        result.errors[0].error.message.includes('Circular dependency detected') ||
        result.errors[0].error.message.includes('Maximum template depth')
      ).toBe(true);
    });
  });

  describe('Performance and caching', () => {
    it('should efficiently render templates with caching', async () => {
      const context = {
        enterpriseId: TEST_ENTERPRISE_ID,
        variables: {
          user: { name: 'Test User', email: 'test@example.com' },
          company: 'Test Co',
          currentYear: 2024
        }
      };

      // Clear cache to ensure clean test
      loader.clearCache();

      // First render - should load from database
      const start1 = Date.now();
      const result1 = await engine.renderByKey('full-email', context);
      const time1 = Date.now() - start1;

      expect(result1.errors).toHaveLength(0);

      // Second render - should use cache
      const start2 = Date.now();
      const result2 = await engine.renderByKey('full-email', context);
      const time2 = Date.now() - start2;

      expect(result2.errors).toHaveLength(0);
      expect(result2.content).toBe(result1.content);

      // Cache should make second render faster
      expect(time2).toBeLessThan(time1);

      // Check cache stats
      const stats = loader.getStats();
      expect(stats.cacheHits).toBeGreaterThan(0);
    });
  });
});