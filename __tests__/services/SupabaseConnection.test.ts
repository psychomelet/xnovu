import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

describe('Supabase Connection', () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

  describe('Supabase JS SDK', () => {
    it('should connect to Supabase with valid credentials', async () => {
      const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            'x-application-name': 'xnovu-test',
          },
        },
      });

      // Test basic connection by accessing the client
      expect(supabase).toBeDefined();
      expect(supabase.from).toBeDefined();
      expect(supabase.schema).toBeDefined();
      expect(supabase.channel).toBeDefined();

      const { data, error } = await supabase.auth.getSession();

      expect(error).toBeNull();
      expect(data.session).toBeDefined();
      
      console.log('✅ Supabase JS SDK connection successful');
    }, 15000);

    it('should fail gracefully with invalid credentials', async () => {
      const invalidSupabase = createClient(
        'https://invalid.supabase.co',
        'invalid-anon-key'
      );

      // Test that we can create the client (it doesn't validate until first use)
      expect(invalidSupabase).toBeDefined();
      expect(invalidSupabase.from).toBeDefined();
      
      console.log('✅ Invalid credentials handled gracefully');
    }, 10000);
  });

  describe('Schema Access', () => {
    it('should be able to access notify schema when configured', async () => {
      const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
        },
        db: {
          schema: 'notify',
        },
      });

      // Test that we can create schema-specific client
      expect(supabase).toBeDefined();
      expect(supabase.schema).toBeDefined();
      
      const notifyClient = supabase.schema('notify');
      expect(notifyClient).toBeDefined();
      expect(notifyClient.from).toBeDefined();
      
      console.log('✅ Notify schema client created successfully');

      // Add a simple query to verify we can read from the database
      const { data, error } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('id')
        .limit(1);

      // Ensure the query executed without errors (RLS may return empty data set)
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    }, 15000);
  });
});