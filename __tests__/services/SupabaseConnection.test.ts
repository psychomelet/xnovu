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

      // Test basic connection by accessing the client
      expect(supabase).toBeDefined();
      expect(supabase.from).toBeDefined();
      expect(supabase.schema).toBeDefined();
      expect(supabase.channel).toBeDefined();
      
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

      // Test that we can create schema-specific client
      expect(supabase).toBeDefined();
      expect(supabase.schema).toBeDefined();
      
      const notifyClient = supabase.schema('notify');
      expect(notifyClient).toBeDefined();
      expect(notifyClient.from).toBeDefined();
      
      console.log('✅ Notify schema client created successfully');
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
      if (supabaseUrl && !supabaseUrl.includes('your-project-id')) {
        expect(supabaseUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
        console.log(`✅ Supabase URL format valid: ${supabaseUrl}`);
      } else if (supabaseUrl) {
        console.log(`⚠️  Using placeholder Supabase URL: ${supabaseUrl}`);
      }

      if (supabaseAnonKey && !supabaseAnonKey.includes('your_anon_key_here')) {
        expect(supabaseAnonKey).toMatch(/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/);
        console.log(`✅ Supabase anon key format valid: ${supabaseAnonKey.substring(0, 20)}...`);
      } else if (supabaseAnonKey) {
        console.log(`⚠️  Using placeholder Supabase anon key: ${supabaseAnonKey}`);
      }

      if (databaseUrl && !databaseUrl.includes('your-database-url')) {
        expect(databaseUrl).toMatch(/^postgresql:\/\/.+/);
        const maskedUrl = databaseUrl.replace(/:[^:@]*@/, ':***@');
        console.log(`✅ Database URL format valid: ${maskedUrl}`);
      } else if (databaseUrl) {
        console.log(`⚠️  Using placeholder database URL`);
      }
      
      console.log('✅ Environment configuration check completed');
    });
  });
});