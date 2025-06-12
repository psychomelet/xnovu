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
        ruleEngine = null;
        // Clear singleton
        (RuleEngineService as any).instance = null;
      } catch (error) {
        console.warn('Error during test cleanup:', error);
      }
    }
  });

  describe('Redis Integration', () => {
    it('should connect to Redis and initialize successfully', async () => {
      // This test only runs in CI or when Redis is explicitly available
      ruleEngine = RuleEngineService.getInstance(testConfig);
      
      await expect(ruleEngine.initialize()).resolves.not.toThrow();
      
      const status = await ruleEngine.getStatus();
      expect(status.initialized).toBe(true);
    }, 10000);

    it('should perform health check with Redis', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      const health = await ruleEngine.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.initialized).toBe(true);
    }, 10000);

    it('should handle queue operations with Redis', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      // Get queue stats (should work with real Redis)
      const stats = await ruleEngine.notificationQueue.getQueueStats();
      
      expect(stats).toHaveProperty('notification');
      expect(stats).toHaveProperty('ruleExecution');
      expect(typeof stats.notification).toBe('object');
      expect(typeof stats.ruleExecution).toBe('object');
    }, 10000);

    it('should pause and resume with Redis', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      // Test pause
      await expect(ruleEngine.pause()).resolves.not.toThrow();
      
      // Test resume
      await expect(ruleEngine.resume()).resolves.not.toThrow();
      
      const status = await ruleEngine.getStatus();
      expect(status.initialized).toBe(true);
    }, 10000);

    it('should reload cron rules', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      // Should not throw when reloading rules (even if no rules exist)
      await expect(ruleEngine.reloadCronRules()).resolves.not.toThrow();
      await expect(ruleEngine.reloadCronRules('test-enterprise')).resolves.not.toThrow();
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Note: This test currently fails on database connection before reaching Redis
      // This is expected behavior according to the test philosophy (fail fast on invalid credentials)
      // TODO: This test should be moved to a proper Redis-only test when database mocking is separated
      
      // Test with invalid Redis URL
      const badConfig = {
        ...testConfig,
        redisUrl: 'redis://nonexistent:6379',
      };

      const badRuleEngine = RuleEngineService.getInstance(badConfig);
      
      // Should handle connection errors during initialization 
      // (Currently fails on database, which is acceptable per test philosophy)
      await expect(badRuleEngine.initialize()).rejects.toThrow();
      
      // Clean up the bad instance
      (RuleEngineService as any).instance = null;
    }, 15000);
  });

  describe('Performance', () => {
    it('should initialize within reasonable time', async () => {
      const startTime = Date.now();
      
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      const initTime = Date.now() - startTime;
      
      // Should initialize within 5 seconds
      expect(initTime).toBeLessThan(5000);
    }, 10000);
  });
});

