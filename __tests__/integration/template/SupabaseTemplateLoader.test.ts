import { SupabaseTemplateLoader } from '@/app/services/template/loaders/SupabaseTemplateLoader';
import { TemplateNotFoundError } from '@/app/services/template/loaders/TemplateLoader';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

const TEST_ENTERPRISE_ID = '00000000-0000-0000-0000-000000000001';

describe('SupabaseTemplateLoader Integration', () => {
  let loader: SupabaseTemplateLoader;
  let supabase: ReturnType<typeof createClient<Database>>;

  beforeAll(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found in environment variables');
    }

    loader = new SupabaseTemplateLoader(supabaseUrl, supabaseKey);
    supabase = createClient<Database>(supabaseUrl, supabaseKey);
  });

  beforeEach(async () => {
    // Clean up test templates for all test enterprises
    const testEnterprises = [
      TEST_ENTERPRISE_ID,
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003'
    ];
    
    for (const enterpriseId of testEnterprises) {
      const { error } = await supabase
        .schema('notify')
        .from('ent_notification_template')
        .delete()
        .eq('enterprise_id', enterpriseId);
      
      if (error) {
        console.error(`Error cleaning up test templates for ${enterpriseId}:`, error);
      }
    }
  });

  afterAll(async () => {
    // Final cleanup for all test enterprises
    const testEnterprises = [
      TEST_ENTERPRISE_ID,
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003'
    ];
    
    for (const enterpriseId of testEnterprises) {
      const { error } = await supabase
        .schema('notify')
        .from('ent_notification_template')
        .delete()
        .eq('enterprise_id', enterpriseId);
      
      if (error) {
        console.error(`Error in final cleanup for ${enterpriseId}:`, error);
      }
    }
  });

  describe('loadTemplate', () => {
    it('should load template from database', async () => {
      // Insert test template
      const { error: insertError } = await supabase
        .schema('notify')
        .from('ent_notification_template')
        .insert({
          template_key: 'test-welcome',
          name: 'Welcome Email',
          body_template: 'Welcome {{name}} to our service!',
          subject_template: 'Welcome to {{company}}',
          channel_type: 'EMAIL',
          publish_status: 'PUBLISH',
          deactivated: false,
          enterprise_id: TEST_ENTERPRISE_ID,
          variables_description: { name: 'string', company: 'string' }
        });

      expect(insertError).toBeNull();

      // Load template
      const result = await loader.loadTemplate('test-welcome', {
        enterpriseId: TEST_ENTERPRISE_ID
      });

      expect(result.template.templateKey).toBe('test-welcome');
      expect(result.template.name).toBe('Welcome Email');
      expect(result.template.bodyTemplate).toBe('Welcome {{name}} to our service!');
      expect(result.template.subjectTemplate).toBe('Welcome to {{company}}');
      expect(result.template.channelType).toBe('EMAIL');
      expect(result.metadata?.source).toBe('database');
    });

    it('should throw TemplateNotFoundError for missing template', async () => {
      await expect(
        loader.loadTemplate('non-existent', { enterpriseId: TEST_ENTERPRISE_ID })
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it('should respect enterprise isolation', async () => {
      // Insert template for different enterprise
      await supabase
        .schema('notify')
        .from('ent_notification_template')
        .insert({
          template_key: 'isolated-template',
          name: 'Isolated Template',
          body_template: 'This is isolated',
          channel_type: 'EMAIL',
          publish_status: 'PUBLISH',
          deactivated: false,
          enterprise_id: '00000000-0000-0000-0000-000000000002'
        });

      // Should not find template for different enterprise
      await expect(
        loader.loadTemplate('isolated-template', { enterpriseId: TEST_ENTERPRISE_ID })
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it('should cache loaded templates', async () => {
      // Insert test template
      await supabase
        .schema('notify')
        .from('ent_notification_template')
        .insert({
          template_key: 'cached-template',
          name: 'Cached Template',
          body_template: 'Original content',
          channel_type: 'EMAIL',
          publish_status: 'PUBLISH',
          deactivated: false,
          enterprise_id: TEST_ENTERPRISE_ID
        });

      // First load
      const result1 = await loader.loadTemplate('cached-template', {
        enterpriseId: TEST_ENTERPRISE_ID
      });
      expect(result1.metadata?.source).toBe('database');

      // Update template in database
      await supabase
        .schema('notify')
        .from('ent_notification_template')
        .update({ body_template: 'Updated content' })
        .eq('template_key', 'cached-template')
        .eq('enterprise_id', TEST_ENTERPRISE_ID);

      // Second load should come from cache
      const result2 = await loader.loadTemplate('cached-template', {
        enterpriseId: TEST_ENTERPRISE_ID
      });
      expect(result2.metadata?.source).toBe('cache');
      expect(result2.template.bodyTemplate).toBe('Original content');

      // Clear cache and load again
      loader.clearCache();
      const result3 = await loader.loadTemplate('cached-template', {
        enterpriseId: TEST_ENTERPRISE_ID
      });
      expect(result3.metadata?.source).toBe('database');
      expect(result3.template.bodyTemplate).toBe('Updated content');
    });
  });

  describe('loadTemplates', () => {
    it('should load multiple templates', async () => {
      // Insert test templates
      await supabase
        .schema('notify')
        .from('ent_notification_template')
        .insert([
          {
            template_key: 'multi-1',
            name: 'Template 1',
            body_template: 'Content 1',
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          },
          {
            template_key: 'multi-2',
            name: 'Template 2',
            body_template: 'Content 2',
            channel_type: 'SMS',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          }
        ]);

      const results = await loader.loadTemplates(
        ['multi-1', 'multi-2', 'non-existent'],
        { enterpriseId: TEST_ENTERPRISE_ID }
      );

      expect(results.size).toBe(2);
      expect(results.has('multi-1')).toBe(true);
      expect(results.has('multi-2')).toBe(true);
      expect(results.has('non-existent')).toBe(false);
    });
  });

  describe('templateExists', () => {
    it('should check if template exists', async () => {
      // Insert test template
      await supabase
        .schema('notify')
        .from('ent_notification_template')
        .insert({
          template_key: 'exists-check',
          name: 'Exists Check',
          body_template: 'Content',
          channel_type: 'EMAIL',
          publish_status: 'PUBLISH',
          deactivated: false,
          enterprise_id: TEST_ENTERPRISE_ID
        });

      const exists = await loader.templateExists('exists-check', {
        enterpriseId: TEST_ENTERPRISE_ID
      });
      expect(exists).toBe(true);

      const notExists = await loader.templateExists('not-exists', {
        enterpriseId: TEST_ENTERPRISE_ID
      });
      expect(notExists).toBe(false);
    });
  });

  describe('listTemplates', () => {
    it('should list templates with filters', async () => {
      // Insert test templates
      const { error: insertError } = await supabase
        .schema('notify')
        .from('ent_notification_template')
        .insert([
          {
            template_key: 'list-email-1',
            name: 'Email Template 1',
            body_template: 'Email content',
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          },
          {
            template_key: 'list-email-2',
            name: 'Email Template 2',
            body_template: 'Email content 2',
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          },
          {
            template_key: 'list-sms-1',
            name: 'SMS Template',
            body_template: 'SMS content',
            channel_type: 'SMS',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          },
          {
            template_key: 'list-other-enterprise',
            name: 'Other Enterprise Template',
            body_template: 'Other content',
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: '00000000-0000-0000-0000-000000000003'
          }
        ]);

      expect(insertError).toBeNull();

      // List all templates for enterprise
      const allTemplates = await loader.listTemplates({
        enterpriseId: TEST_ENTERPRISE_ID
      });
      expect(allTemplates).toHaveLength(3);

      // List only email templates
      const emailTemplates = await loader.listTemplates({
        enterpriseId: TEST_ENTERPRISE_ID,
        channelType: 'EMAIL'
      });
      expect(emailTemplates).toHaveLength(2);
      expect(emailTemplates.every(t => t.channelType === 'EMAIL')).toBe(true);

      // List only SMS templates
      const smsTemplates = await loader.listTemplates({
        enterpriseId: TEST_ENTERPRISE_ID,
        channelType: 'SMS'
      });
      expect(smsTemplates).toHaveLength(1);
      expect(smsTemplates[0].channelType).toBe('SMS');
    });

    it('should not return deactivated or unpublished templates', async () => {
      await supabase
        .schema('notify')
        .from('ent_notification_template')
        .insert([
          {
            template_key: 'active-template',
            name: 'Active Template',
            body_template: 'Active',
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          },
          {
            template_key: 'deactivated-template',
            name: 'Deactivated Template',
            body_template: 'Deactivated',
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: true,
            enterprise_id: TEST_ENTERPRISE_ID
          },
          {
            template_key: 'draft-template',
            name: 'Draft Template',
            body_template: 'Draft',
            channel_type: 'EMAIL',
            publish_status: 'DRAFT',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          }
        ]);

      const templates = await loader.listTemplates({
        enterpriseId: TEST_ENTERPRISE_ID
      });

      expect(templates).toHaveLength(1);
      expect(templates[0].templateKey).toBe('active-template');
    });
  });

  describe('cache management', () => {
    it('should track cache statistics', async () => {
      // Create a new loader instance to isolate stats
      const statsLoader = new SupabaseTemplateLoader(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Insert templates
      await supabase
        .schema('notify')
        .from('ent_notification_template')
        .insert([
          {
            template_key: 'stats-1',
            name: 'Stats 1',
            body_template: 'Content 1',
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          },
          {
            template_key: 'stats-2',
            name: 'Stats 2',
            body_template: 'Content 2',
            channel_type: 'EMAIL',
            publish_status: 'PUBLISH',
            deactivated: false,
            enterprise_id: TEST_ENTERPRISE_ID
          }
        ]);
      
      // Load templates
      await statsLoader.loadTemplate('stats-1', { enterpriseId: TEST_ENTERPRISE_ID });
      await statsLoader.loadTemplate('stats-2', { enterpriseId: TEST_ENTERPRISE_ID });
      
      // Load again (should hit cache)
      await statsLoader.loadTemplate('stats-1', { enterpriseId: TEST_ENTERPRISE_ID });
      
      const stats = statsLoader.getStats();
      expect(stats.totalLoaded).toBe(2);
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(2);
      expect(stats.totalCached).toBe(2);
      expect(stats.validCached).toBe(2);
      expect(stats.expiredCached).toBe(0);
    });

    it('should clear expired cache entries', async () => {
      // Create loader with very short TTL for testing
      const shortTTLLoader = new SupabaseTemplateLoader(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { cache: true, cacheTTL: 100 } // 100ms TTL
      );

      await supabase
        .schema('notify')
        .from('ent_notification_template')
        .insert({
          template_key: 'expire-test',
          name: 'Expire Test',
          body_template: 'Content',
          channel_type: 'EMAIL',
          publish_status: 'PUBLISH',
          deactivated: false,
          enterprise_id: TEST_ENTERPRISE_ID
        });

      // Load template
      await shortTTLLoader.loadTemplate('expire-test', { enterpriseId: TEST_ENTERPRISE_ID });

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Clear expired entries
      shortTTLLoader.clearExpiredCache();

      const stats = shortTTLLoader.getStats();
      expect(stats.totalCached).toBe(0);
    });
  });
});