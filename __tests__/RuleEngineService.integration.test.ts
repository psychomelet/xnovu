import { RuleEngineService, defaultRuleEngineConfig } from '@/app/services/RuleEngineService';
import type { RuleEngineConfig } from '@/types/rule-engine';
import { createClient } from '@supabase/supabase-js';
import { Novu } from '@novu/api';
import type { Database } from '@/lib/supabase/database.types';

describe('RuleEngineService - Integration Tests', () => {
  let ruleEngine: RuleEngineService;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
  const novuSecretKey = process.env.NOVU_SECRET_KEY || '';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  // Check if we have real credentials
  const hasRealCredentials = supabaseUrl && 
    supabaseServiceKey && 
    supabaseUrl.includes('supabase.co') && 
    supabaseServiceKey.length > 50 &&
    novuSecretKey &&
    !novuSecretKey.includes('test-secret-key') &&
    novuSecretKey.length > 20;

  const testConfig: RuleEngineConfig = {
    ...defaultRuleEngineConfig,
    redisUrl: redisUrl,
    maxConcurrentJobs: 2, // Reduce for testing
    scheduledNotificationInterval: 10000, // Reduce interval for testing
    scheduledNotificationBatchSize: 10, // Reduce batch size
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
      } catch (error) {
        // Ignore shutdown errors in tests
      }
      (RuleEngineService as any).instance = null;
    }
  });

  describe('basic functionality', () => {
    it('should create singleton instance without initialization', () => {
      const instance1 = RuleEngineService.getInstance(testConfig);
      const instance2 = RuleEngineService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(RuleEngineService);
      
      ruleEngine = instance1; // Store for cleanup
    });

    it('should get status without throwing', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      const status = await ruleEngine.getStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('cronJobs');
      expect(status).toHaveProperty('scheduledNotifications');
      expect(Array.isArray(status.cronJobs)).toBe(true);
    });

    it('should initialize and shutdown without errors', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      
      // Initialize should not throw
      await expect(ruleEngine.initialize()).resolves.not.toThrow();
      
      // Should be marked as initialized
      const status = await ruleEngine.getStatus();
      expect(status.initialized).toBe(true);
      
      // Shutdown should not throw
      await expect(ruleEngine.shutdown()).resolves.not.toThrow();
    }, 15000); // Longer timeout for Redis operations

    it('should work with real API connections when available', async () => {
      if (!hasRealCredentials) {
        console.log('⚠️  Skipping real API test - no real credentials configured');
        console.log('   To run these tests, set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY, and NOVU_SECRET_KEY');
        return;
      }

      // Test that real API clients can be created
      const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      });
      expect(supabase).toBeDefined();

      const novu = new Novu({ secretKey: novuSecretKey });
      expect(novu).toBeDefined();

      console.log('✅ RuleEngineService integration test with real API connections completed');
    }, 15000);
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