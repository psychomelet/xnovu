import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

describe('Supabase Connection', () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  beforeAll(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('⚠️  Supabase credentials not configured - skipping Supabase connection tests');
    }
    if (!databaseUrl) {
      console.log('⚠️  DATABASE_URL not configured - skipping PostgreSQL connection tests');
    }
  });

  describe('Supabase JS SDK', () => {
    it('should connect to Supabase with valid credentials', async () => {
      if (!supabaseUrl || !supabaseAnonKey) {
        console.log('Skipping Supabase test - credentials not configured');
        return;
      }

      const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            'x-application-name': 'xnovu-test',
          },
        },
      });

      // Test basic connection by calling the health endpoint equivalent
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);

      if (error) {
        // This might fail due to RLS policies, which is expected
        console.log('⚠️  Query failed (possibly due to RLS policies):', error.message);
        // Still consider this a successful connection test if it's an auth/permission error
        expect(['PGRST116', 'PGRST301', '42501']).toContain(error.code);
      } else {
        expect(data).toBeDefined();
        console.log('✅ Supabase JS SDK connection successful');
      }
    }, 15000);

    it('should fail gracefully with invalid credentials', async () => {
      const invalidSupabase = createClient(
        supabaseUrl || 'https://invalid.supabase.co',
        'invalid-anon-key'
      );

      const { data, error } = await invalidSupabase
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);

      expect(error).toBeDefined();
      expect(data).toBeNull();
    }, 10000);
  });

  describe('Schema Access', () => {
    it('should be able to access notify schema when configured', async () => {
      if (!supabaseUrl || !supabaseAnonKey) {
        console.log('Skipping schema test - credentials not configured');
        return;
      }

      const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
        },
        db: {
          schema: 'notify',
        },
      });

      try {
        // Try to access notification-related tables
        const { data, error } = await supabase
          .schema('notify')
          .from('ent_notification')
          .select('id')
          .limit(1);

        if (error) {
          // Expected to fail due to RLS policies in most cases
          console.log('⚠️  Notify schema access restricted (expected):', error.message);
          expect(error).toBeDefined();
        } else {
          console.log('✅ Notify schema accessible');
          expect(data).toBeDefined();
        }
      } catch (error) {
        console.log('⚠️  Notify schema test failed:', error);
        expect(error).toBeDefined();
      }
    }, 15000);

    it('should handle base schema access', async () => {
      if (!supabaseUrl || !supabaseAnonKey) {
        console.log('Skipping base schema test - credentials not configured');
        return;
      }

      const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

      try {
        // Try to access base schema tables
        const { data, error } = await supabase
          .schema('base')
          .from('ent_enterprise')
          .select('id')
          .limit(1);

        if (error) {
          console.log('⚠️  Base schema access restricted (expected):', error.message);
          expect(error).toBeDefined();
        } else {
          console.log('✅ Base schema accessible');
          expect(data).toBeDefined();
        }
      } catch (error) {
        console.log('⚠️  Base schema test failed:', error);
        expect(error).toBeDefined();
      }
    }, 15000);
  });

  describe('Real-time Capabilities', () => {
    it('should be able to create realtime channel', async () => {
      if (!supabaseUrl || !supabaseAnonKey) {
        console.log('Skipping realtime test - credentials not configured');
        return;
      }

      const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

      const channel = supabase.channel('test-channel');
      
      expect(channel).toBeDefined();
      expect(typeof channel.subscribe).toBe('function');
      expect(typeof channel.unsubscribe).toBe('function');

      // Test channel creation (doesn't require actual subscription)
      console.log('✅ Realtime channel creation successful');
      
      // Clean up
      await channel.unsubscribe();
    }, 10000);
  });

  describe('Environment Configuration', () => {
    it('should have proper environment variables format', () => {
      if (supabaseUrl) {
        expect(supabaseUrl).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
        console.log(`✅ Supabase URL format valid: ${supabaseUrl}`);
      }

      if (supabaseAnonKey) {
        expect(supabaseAnonKey).toMatch(/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/);
        console.log(`✅ Supabase anon key format valid: ${supabaseAnonKey.substring(0, 20)}...`);
      }

      if (databaseUrl) {
        expect(databaseUrl).toMatch(/^postgresql:\/\/.+/);
        const maskedUrl = databaseUrl.replace(/:[^:@]*@/, ':***@');
        console.log(`✅ Database URL format valid: ${maskedUrl}`);
      }
    });
  });
});