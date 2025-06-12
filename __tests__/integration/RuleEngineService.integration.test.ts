import { RuleEngineService, defaultRuleEngineConfig } from '@/app/services/RuleEngineService';
import type { RuleEngineConfig } from '@/types/rule-engine';
import { createClient } from '@supabase/supabase-js';
import { Novu } from '@novu/api';
import type { Database } from '@/lib/supabase/database.types';

describe('RuleEngineService - Integration Tests', () => {
  let ruleEngine: RuleEngineService;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const novuSecretKey = process.env.NOVU_SECRET_KEY || '';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  // Integration tests use whatever credentials are available
  // Run `pnpm test:connections` first to validate credentials

  const testConfig: RuleEngineConfig = {
    ...defaultRuleEngineConfig,
    redisUrl: redisUrl,
    maxConcurrentJobs: 2, // Reduce for testing
    scheduledNotificationInterval: 10000, // Reduce interval for testing
    scheduledNotificationBatchSize: 10, // Reduce batch size for testing
  };

  beforeEach(async () => {
    // Reset singleton instance before each test
    (RuleEngineService as any).instance = null;
  });

  afterEach(async () => {
    // Clean up after each test
    if (ruleEngine) {
      try {
        await ruleEngine.shutdown();
        // Give extra time for connections to fully close
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Ignore shutdown errors in tests
      }
      (RuleEngineService as any).instance = null;
    }
  });

  afterAll(async () => {
    // Final cleanup to ensure all handles are closed
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  describe('basic functionality', () => {
    it('should create singleton instance without initialization', () => {
      const instance1 = RuleEngineService.getInstance(testConfig);
      const instance2 = RuleEngineService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(RuleEngineService);

      ruleEngine = instance1; // Store for cleanup
    });

    it('should get status with real database connection', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);

      // This will make real database calls
      const status = await ruleEngine.getStatus();

      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('cronJobs');
      expect(status).toHaveProperty('scheduledNotifications');
      expect(status).toHaveProperty('queueStats');
      expect(status).toHaveProperty('scheduledStats');
      expect(Array.isArray(status.cronJobs)).toBe(true);
      expect(typeof status.scheduledStats.totalScheduled).toBe('number');
      expect(typeof status.scheduledStats.overdue).toBe('number');
      expect(typeof status.scheduledStats.upcoming24h).toBe('number');
      expect(typeof status.scheduledStats.upcomingWeek).toBe('number');
    }, 30000); // Longer timeout for real database calls

    it('should initialize and shutdown with real database', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);

      // Initialize will load real cron rules from database
      await expect(ruleEngine.initialize()).resolves.not.toThrow();

      // Should be marked as initialized
      const status = await ruleEngine.getStatus();
      expect(status.initialized).toBe(true);

      // Shutdown should not throw
      await expect(ruleEngine.shutdown()).resolves.not.toThrow();
    }, 30000); // Longer timeout for database operations

    it('should handle service orchestration with real database', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);

      await ruleEngine.initialize();

      // Test pause and resume
      await expect(ruleEngine.pause()).resolves.not.toThrow();
      await expect(ruleEngine.resume()).resolves.not.toThrow();

      // Test health check
      const health = await ruleEngine.healthCheck();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('details');
      expect(['healthy', 'unhealthy']).toContain(health.status);
      expect(health.details).toHaveProperty('initialized');
      expect(health.details).toHaveProperty('cronManager');
      expect(health.details).toHaveProperty('scheduledManager');
      expect(health.details).toHaveProperty('queue');

      // Test cron rule reload - will query real database
      await expect(ruleEngine.reloadCronRules()).resolves.not.toThrow();

      // Test with specific enterprise ID
      await expect(ruleEngine.reloadCronRules('123e4567-e89b-12d3-a456-426614174000')).resolves.not.toThrow();
    }, 30000);

    it('should work with real API connections', async () => {
      // Test real database connection using the correct service role key
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      const supabase = createClient<Database>(supabaseUrl, serviceKey, {
        auth: { persistSession: false }
      });
      expect(supabase).toBeDefined();

      // Test basic database connectivity
      const { data, error } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .select('id')
        .limit(1);

      // Should not throw an error (even if no data exists)
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);

      // Test Novu client creation
      const novu = new Novu({ secretKey: novuSecretKey });
      expect(novu).toBeDefined();

      console.log('✅ RuleEngineService integration test with real connections completed');
    }, 30000);
  });
});

describe('defaultRuleEngineConfig', () => {
  it('should have correct default values', () => {
    expect(defaultRuleEngineConfig).toEqual({
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      defaultTimezone: process.env.RULE_ENGINE_TIMEZONE || 'UTC',
      maxConcurrentJobs: parseInt(process.env.RULE_ENGINE_MAX_CONCURRENT_JOBS || '10'),
      jobRetryAttempts: parseInt(process.env.RULE_ENGINE_RETRY_ATTEMPTS || '3'),
      jobRetryDelay: parseInt(process.env.RULE_ENGINE_RETRY_DELAY || '5000'),
      scheduledNotificationInterval: parseInt(process.env.RULE_ENGINE_SCHEDULED_INTERVAL || '60000'),
      scheduledNotificationBatchSize: parseInt(process.env.RULE_ENGINE_SCHEDULED_BATCH_SIZE || '100'),
    });
  });
});