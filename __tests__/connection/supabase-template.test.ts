import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

describe('Supabase Template Connection', () => {
  let supabase: ReturnType<typeof createClient<Database>>;

  beforeAll(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found in environment variables');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseKey);
  });

  it('should connect to Supabase and access notification template table', async () => {
    const { data, error, count } = await supabase
      .schema('notify')
      .from('ent_notification_template')
      .select('*', { count: 'exact', head: true });

    // If there's an error with empty message, it might be a connection issue
    if (error && error.message) {
      throw error;
    }
    
    expect(count).toBeDefined();
    expect(typeof count === 'number').toBe(true);
  });

  it('should be able to query template by key', async () => {
    const { error } = await supabase
      .schema('notify')
      .from('ent_notification_template')
      .select('template_key, name, channel_type')
      .eq('template_key', 'test-connection-check')
      .single();

    // We expect an error (PGRST116) if no row is found, which is fine for this test
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
  });

  it('should verify template table schema', async () => {
    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification_template')
      .select('*')
      .limit(1);

    expect(error).toBeNull();

    if (data && data.length > 0) {
      const template = data[0];
      
      // Verify required fields exist
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('template_key');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('body_template');
      expect(template).toHaveProperty('channel_type');
      expect(template).toHaveProperty('publish_status');
      expect(template).toHaveProperty('deactivated');
      expect(template).toHaveProperty('enterprise_id');
    }
  });

  it('should be able to filter templates by enterprise and channel', async () => {
    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification_template')
      .select('template_key')
      .eq('enterprise_id', '00000000-0000-0000-0000-000000000001')
      .eq('channel_type', 'EMAIL')
      .eq('publish_status', 'PUBLISH')
      .eq('deactivated', false);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});