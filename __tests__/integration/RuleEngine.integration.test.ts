/**
 * Integration tests for Rule Engine with real Redis connection
 * These tests run when REDIS_URL is available (CI environment)
 */

import { RuleEngineService } from '@/app/services/RuleEngineService';
import type { RuleEngineConfig } from '@/types/rule-engine';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const testConfig: RuleEngineConfig = {
  redisUrl: REDIS_URL,
  defaultTimezone: 'UTC',
  maxConcurrentJobs: 2,
  jobRetryAttempts: 2,
  jobRetryDelay: 1000,
  scheduledNotificationInterval: 60000,
  scheduledNotificationBatchSize: 100,
};

describe('Rule Engine Integration Tests', () => {
  beforeAll(() => {
    if (!process.env.REDIS_URL && !process.env.CI) {
      throw new Error('Redis URL required for integration tests. Set REDIS_URL environment variable or run in CI environment.');
    }
  });

  let ruleEngine: RuleEngineService | null = null;

  afterEach(async () => {
    if (ruleEngine) {
      try {
        await ruleEngine.shutdown();
        // Give extra time for connections to fully close
        await new Promise(resolve => setTimeout(resolve, 100));
        ruleEngine = null;
        // Clear singleton
        (RuleEngineService as any).instance = null;
      } catch (error) {
        console.warn('Error during test cleanup:', error);
      }
    }
  }, 3000);

  describe('Redis Integration', () => {
    it('should connect to Redis and initialize successfully', async () => {
      // This test only runs in CI or when Redis is explicitly available
      ruleEngine = RuleEngineService.getInstance(testConfig);

      await expect(ruleEngine.initialize()).resolves.not.toThrow();

      const status = await ruleEngine.getStatus();
      expect(status.initialized).toBe(true);
    }, 3000);

    it('should perform health check with Redis', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();

      const health = await ruleEngine.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.initialized).toBe(true);
    }, 3000);

    it('should handle queue operations with Redis', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();

      // Get queue stats (should work with real Redis)
      const stats = await ruleEngine.notificationQueue.getQueueStats();

      expect(stats).toHaveProperty('notification');
      expect(stats).toHaveProperty('ruleExecution');
      expect(typeof stats.notification).toBe('object');
      expect(typeof stats.ruleExecution).toBe('object');
    }, 3000);

    it('should pause and resume with Redis', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();

      // Test pause
      await expect(ruleEngine.pause()).resolves.not.toThrow();

      // Test resume
      await expect(ruleEngine.resume()).resolves.not.toThrow();

      const status = await ruleEngine.getStatus();
      expect(status.initialized).toBe(true);
    }, 3000);

    it('should reload cron rules', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();

      // Should not throw when reloading rules (even if no rules exist)
      await expect(ruleEngine.reloadCronRules()).resolves.not.toThrow();
      await expect(ruleEngine.reloadCronRules('123e4567-e89b-12d3-a456-426614174000')).resolves.not.toThrow();
    }, 3000);
  });
});
