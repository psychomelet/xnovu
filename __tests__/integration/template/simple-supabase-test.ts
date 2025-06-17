import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

describe('Simple Supabase Test', () => {
  let supabase: ReturnType<typeof createClient<Database>>;

  beforeAll(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseKey);
  });

  it('should connect without schema', async () => {
    // Try without schema first
    const { data, error, count } = await supabase
      .from('ent_notification_template')
      .select('*', { count: 'exact' })
      .limit(1);

    console.log('Without schema - Error:', error);
    console.log('Without schema - Data:', data);
    console.log('Without schema - Count:', count);
  });

  it('should connect with schema', async () => {
    // Try with schema
    const { data, error, count } = await supabase
      .schema('notify')
      .from('ent_notification_template')
      .select('*', { count: 'exact' })
      .limit(1);

    console.log('With schema - Error:', error);
    console.log('With schema - Data:', data);
    console.log('With schema - Count:', count);
  });

  it('should insert and retrieve template', async () => {
    const testTemplate = {
      template_key: 'test-simple-' + Date.now(),
      name: 'Test Template',
      body_template: 'Hello {{name}}',
      channel_type: 'EMAIL' as const,
      publish_status: 'PUBLISH' as const,
      deactivated: false,
      enterprise_id: 'test-enterprise-simple'
    };

    // Insert without schema
    const { data: insertData, error: insertError } = await supabase
      .from('ent_notification_template')
      .insert(testTemplate)
      .select()
      .single();

    console.log('Insert Error:', insertError);
    console.log('Insert Data:', insertData);

    if (insertData) {
      // Try to retrieve it
      const { data: selectData, error: selectError } = await supabase
        .from('ent_notification_template')
        .select('*')
        .eq('template_key', testTemplate.template_key)
        .single();

      console.log('Select Error:', selectError);
      console.log('Select Data:', selectData);

      // Clean up
      await supabase
        .from('ent_notification_template')
        .delete()
        .eq('template_key', testTemplate.template_key);
    }
  });
});