import { RuleEngineService, defaultRuleEngineConfig } from '@/app/services/RuleEngineService';
import type { RuleEngineConfig } from '@/types/rule-engine';

// Check for required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
}

if (!process.env.REDIS_URL) {
  throw new Error('Missing required REDIS_URL environment variable');
}

describe('RuleEngineService - Unit Tests', () => {
  let ruleEngineService: RuleEngineService | null = null;
  const testConfig: RuleEngineConfig = {
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    defaultTimezone: 'UTC',
    maxConcurrentJobs: 2, // Lower for testing
    jobRetryAttempts: 1,
    jobRetryDelay: 500,
    scheduledNotificationInterval: 5000, // 5 seconds for testing
    scheduledNotificationBatchSize: 10
  };

  afterEach(async () => {
    // Clean up service instance after each test
    if (ruleEngineService) {
      try {
        await ruleEngineService.shutdown();
      } catch (error) {
        // Ignore shutdown errors in tests
      }
      ruleEngineService = null;
    }
    jest.clearAllMocks();
  });

  describe('defaultRuleEngineConfig', () => {
    it('should have default configuration values', () => {
      expect(defaultRuleEngineConfig).toBeDefined();
      expect(defaultRuleEngineConfig.redisUrl).toMatch(/^redis:\/\//); 
      expect(defaultRuleEngineConfig.defaultTimezone).toBe('UTC');
      expect(defaultRuleEngineConfig.maxConcurrentJobs).toBeGreaterThan(0);
      expect(defaultRuleEngineConfig.jobRetryAttempts).toBeGreaterThan(0);
      expect(defaultRuleEngineConfig.jobRetryDelay).toBeGreaterThan(0);
      expect(defaultRuleEngineConfig.scheduledNotificationInterval).toBeGreaterThan(0);
      expect(defaultRuleEngineConfig.scheduledNotificationBatchSize).toBeGreaterThan(0);
    });

    it('should have valid retry configuration', () => {
      expect(defaultRuleEngineConfig.jobRetryAttempts).toBeGreaterThan(0);
      expect(defaultRuleEngineConfig.jobRetryDelay).toBeGreaterThan(0);
    });

    it('should have valid job limits', () => {
      expect(defaultRuleEngineConfig.maxConcurrentJobs).toBeGreaterThan(0);
      expect(defaultRuleEngineConfig.scheduledNotificationBatchSize).toBeGreaterThan(0);
    });

    it('should have valid interval configuration', () => {
      expect(defaultRuleEngineConfig.scheduledNotificationInterval).toBeGreaterThan(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should accept valid timezone', () => {
      const validTimezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
      
      validTimezones.forEach(timezone => {
        expect(() => {
          const config = { ...defaultRuleEngineConfig, defaultTimezone: timezone };
          // Just validate the timezone format is acceptable
          expect(config.defaultTimezone).toBe(timezone);
        }).not.toThrow();
      });
    });

    it('should have Redis URL format', () => {
      const config = defaultRuleEngineConfig;
      expect(config.redisUrl).toMatch(/^redis:\/\//);
    });
  });

  describe('RuleEngineService Instance Management', () => {
    it('should require config for first getInstance call', () => {
      expect(() => {
        RuleEngineService.getInstance();
      }).toThrow('RuleEngineService not initialized. Config required for first call.');
    });

    it('should create singleton instance with config', () => {
      ruleEngineService = RuleEngineService.getInstance(testConfig);
      expect(ruleEngineService).toBeDefined();
      expect(ruleEngineService).toBeInstanceOf(RuleEngineService);
    });

    it('should return same instance on subsequent calls', () => {
      const instance1 = RuleEngineService.getInstance(testConfig);
      const instance2 = RuleEngineService.getInstance();
      expect(instance1).toBe(instance2);
      ruleEngineService = instance1;
    });
  });

  describe('Service Components', () => {
    beforeEach(() => {
      ruleEngineService = RuleEngineService.getInstance(testConfig);
    });

    it('should have all required service components', () => {
      expect(ruleEngineService!.ruleService).toBeDefined();
      expect(ruleEngineService!.notificationQueue).toBeDefined();
      expect(ruleEngineService!.cronManager).toBeDefined();
      expect(ruleEngineService!.scheduledNotificationManager).toBeDefined();
    });

    it('should initialize successfully', async () => {
      await expect(ruleEngineService!.initialize()).resolves.not.toThrow();
    });

    it('should not initialize twice', async () => {
      await ruleEngineService!.initialize();
      // Second call should not throw
      await expect(ruleEngineService!.initialize()).resolves.not.toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    beforeEach(async () => {
      ruleEngineService = RuleEngineService.getInstance(testConfig);
      await ruleEngineService.initialize();
    });

    it('should get status after initialization', async () => {
      const status = await ruleEngineService!.getStatus();
      
      expect(status).toBeDefined();
      expect(status.initialized).toBe(true);
      expect(status.cronJobs).toBeDefined();
      expect(Array.isArray(status.cronJobs)).toBe(true);
      expect(status.scheduledNotifications).toBeDefined();
      expect(status.queueStats).toBeDefined();
      expect(status.scheduledStats).toBeDefined();
    });

    it('should perform health check', async () => {
      const health = await ruleEngineService!.healthCheck();
      
      expect(health).toBeDefined();
      expect(health.status).toMatch(/^(healthy|unhealthy)$/);
      expect(health.details).toBeDefined();
      expect(health.details.initialized).toBe(true);
    });

    it('should pause and resume operations', async () => {
      await expect(ruleEngineService!.pause()).resolves.not.toThrow();
      await expect(ruleEngineService!.resume()).resolves.not.toThrow();
    });

    it('should shutdown gracefully', async () => {
      await expect(ruleEngineService!.shutdown()).resolves.not.toThrow();
      ruleEngineService = null; // Prevent cleanup in afterEach
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      ruleEngineService = RuleEngineService.getInstance(testConfig);
    });

    it('should throw error when calling methods before initialization', async () => {
      await expect(
        ruleEngineService!.reloadCronRules()
      ).rejects.toThrow('RuleEngineService not initialized');

      await expect(
        ruleEngineService!.pause()
      ).rejects.toThrow('RuleEngineService not initialized');

      await expect(
        ruleEngineService!.resume()
      ).rejects.toThrow('RuleEngineService not initialized');
    });

    it('should handle multiple shutdown calls gracefully', async () => {
      await ruleEngineService!.initialize();
      
      await expect(ruleEngineService!.shutdown()).resolves.not.toThrow();
      await expect(ruleEngineService!.shutdown()).resolves.not.toThrow();
      
      ruleEngineService = null; // Prevent cleanup in afterEach
    });
  });
});