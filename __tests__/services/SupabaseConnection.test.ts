import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Supabase Connection', () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
  const databaseUrl = process.env.DATABASE_URL || '';

  // Validate credentials before each test

  describe('Supabase JS SDK', () => {
    it('should connect to Supabase with service role key', async () => {
      if (!supabaseUrl || !supabaseServiceKey || !supabaseUrl.includes('supabase.co') || supabaseServiceKey.length <= 50) {
        throw new Error('Real Supabase credentials required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY environment variables.');
      }

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
      expect(supabase.auth).toBeDefined();
      expect(supabase.auth.admin).toBeDefined();

      // Try to list users - this requires service role key
      const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

      if (error) {
        // Service role key validation failed
        throw new Error(`Service role key verification failed: ${error.message}`);
      } else {
        console.log('✅ Supabase JS SDK Test - Connection successful, service role key verified successfully');
      }
    }, 15000);

    it('should fail gracefully with invalid credentials', async () => {
      const invalidSupabase = createClient(
        'https://invalid.supabase.co',
        'invalid-anon-key'
      );

      // Test that we can create the client (it doesn't validate until first use)
      expect(invalidSupabase).toBeDefined();
      expect(invalidSupabase.from).toBeDefined();

      // Test that invalid credentials fail on first use
      const { error } = await invalidSupabase.auth.admin.listUsers();
      expect(error).toBeDefined();
      expect(error?.message).toContain('fetch failed');
    }, 10000);
  });

  describe('Schema Access', () => {
    it('should be able to query from notify.ent_notification table', async () => {
      if (!supabaseUrl || !supabaseServiceKey || !supabaseUrl.includes('supabase.co') || supabaseServiceKey.length <= 50) {
        throw new Error('Real Supabase credentials required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY environment variables.');
      }

      const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
        }
      });

      // Test that we can create schema-specific client
      expect(supabase).toBeDefined();
      expect(supabase.schema).toBeDefined();

      // Test querying from notify schema
      const notifyClient = supabase.schema('notify');
      expect(notifyClient).toBeDefined();
      expect(notifyClient.from).toBeDefined();

      // Try to query from notify.ent_notification table
      const { data, error } = await notifyClient
        .from('ent_notification')
        .select('id, name, created_at')
        .limit(1);

      // Handle different possible outcomes
      if (error && error.code === 'PGRST116') {
        throw new Error('Schema Access Test failed - notify.ent_notification table not found. Ensure the notify schema is properly set up.');
      } else if (error && error.message.includes('permission')) {
        throw new Error(`Permission denied accessing notify.ent_notification: ${error.message}`);
      } else if (error) {
        throw new Error(`Schema Access Test failed: ${error.message}`);
      } else {
        // Query succeeded
        expect(Array.isArray(data)).toBe(true);
        console.log(`✅ Schema Access Test - Successfully queried notify.ent_notification table (found ${data?.length || 0} records)`);
      }
    }, 15000);
  });

  describe('DB Access', () => {
    it('should connect to database using DATABASE_URL with psql', async () => {
      if (!databaseUrl || databaseUrl === 'postgresql://postgres.your-project-id:your-password@aws-0-region.pooler.supabase.com:6543/postgres') {
        throw new Error('Real DATABASE_URL required. Set DATABASE_URL environment variable with actual database connection string.');
      }

      try {
        // Test psql connection with a simple query
        const { stdout, stderr } = await execAsync(`psql "${databaseUrl}" -c "SELECT NOW()" -t`);

        if (stderr && !stderr.includes('NOTICE')) {
          console.log('⚠️  psql stderr (may be warnings):', stderr);
        }

        expect(stdout).toBeDefined();
        expect(stdout.trim()).toBeTruthy();

        // Parse the timestamp to verify it's valid
        const timestamp = stdout.trim();
        const parsedDate = new Date(timestamp);
        expect(parsedDate.toString()).not.toBe('Invalid Date');

        console.log(`✅ DB Access Test - Database connection via psql successful | Current time: ${timestamp}`);

      } catch (error: any) {
        // Check if psql is available
        if (error.message.includes('psql: command not found') || error.code === 'ENOENT') {
          throw new Error('psql command not found. Install postgresql-client to run database connection tests.');
        }

        // Connection or authentication error - always fail
        throw new Error(`Database connection failed: ${error.message}`);
      }
    }, 20000);
  });
});