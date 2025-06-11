/**
 * Integration tests for Rule Engine with real Redis connection
 * These tests run when REDIS_URL is available (CI environment)
 */

import { RuleEngineService } from '@/app/services/RuleEngineService';
import type { RuleEngineConfig } from '@/types/rule-engine';

// Skip these tests if Redis is not available
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SKIP_INTEGRATION_TESTS = !process.env.CI && !process.env.REDIS_URL;

const testConfig: RuleEngineConfig = {
  redisUrl: REDIS_URL,
  defaultTimezone: 'UTC',
  maxConcurrentJobs: 2,
  jobRetryAttempts: 2,
  jobRetryDelay: 1000,
};

describe('Rule Engine Integration Tests', () => {
  // Skip if Redis is not available
  beforeAll(() => {
    if (SKIP_INTEGRATION_TESTS) {
      console.log('⏭️ Skipping integration tests - Redis not available');
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
    (SKIP_INTEGRATION_TESTS ? it.skip : it)('should connect to Redis and initialize successfully', async () => {
      // This test only runs in CI or when Redis is explicitly available
      ruleEngine = RuleEngineService.getInstance(testConfig);
      
      await expect(ruleEngine.initialize()).resolves.not.toThrow();
      
      const status = await ruleEngine.getStatus();
      expect(status.initialized).toBe(true);
    }, 10000);

    (SKIP_INTEGRATION_TESTS ? it.skip : it)('should perform health check with Redis', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      const health = await ruleEngine.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.initialized).toBe(true);
    }, 10000);

    (SKIP_INTEGRATION_TESTS ? it.skip : it)('should handle queue operations with Redis', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      // Get queue stats (should work with real Redis)
      const stats = await ruleEngine.notificationQueue.getQueueStats();
      
      expect(stats).toHaveProperty('notification');
      expect(stats).toHaveProperty('ruleExecution');
      expect(typeof stats.notification).toBe('object');
      expect(typeof stats.ruleExecution).toBe('object');
    }, 10000);

    (SKIP_INTEGRATION_TESTS ? it.skip : it)('should pause and resume with Redis', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      // Test pause
      await expect(ruleEngine.pause()).resolves.not.toThrow();
      
      // Test resume
      await expect(ruleEngine.resume()).resolves.not.toThrow();
      
      const status = await ruleEngine.getStatus();
      expect(status.initialized).toBe(true);
    }, 10000);

    (SKIP_INTEGRATION_TESTS ? it.skip : it)('should reload cron rules', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      // Should not throw when reloading rules (even if no rules exist)
      await expect(ruleEngine.reloadCronRules()).resolves.not.toThrow();
      await expect(ruleEngine.reloadCronRules('test-enterprise')).resolves.not.toThrow();
    }, 10000);
  });

  describe('Error Handling', () => {
    (SKIP_INTEGRATION_TESTS ? it.skip : it)('should handle Redis connection errors gracefully', async () => {
      // Test with invalid Redis URL
      const badConfig = {
        ...testConfig,
        redisUrl: 'redis://nonexistent:6379',
      };

      const badRuleEngine = RuleEngineService.getInstance(badConfig);
      
      // Should handle Redis connection errors during initialization
      await expect(badRuleEngine.initialize()).rejects.toThrow();
      
      // Clean up the bad instance
      (RuleEngineService as any).instance = null;
    }, 15000);
  });

  describe('Performance', () => {
    (SKIP_INTEGRATION_TESTS ? it.skip : it)('should initialize within reasonable time', async () => {
      const startTime = Date.now();
      
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      const initTime = Date.now() - startTime;
      
      // Should initialize within 5 seconds
      expect(initTime).toBeLessThan(5000);
    }, 10000);
  });
});

// Mock fallback tests for when Redis is not available
describe('Rule Engine Unit Tests (Mocked)', () => {
  beforeAll(() => {
    // Ensure mocks are active for unit tests
    jest.doMock('@supabase/supabase-js');
    jest.doMock('@novu/api');
    jest.doMock('bullmq');
    jest.doMock('ioredis');
    jest.doMock('node-cron');
  });

  let ruleEngine: RuleEngineService;

  beforeEach(() => {
    // Reset singleton for each test
    (RuleEngineService as any).instance = null;
    ruleEngine = RuleEngineService.getInstance(testConfig);
  });

  afterEach(async () => {
    try {
      await ruleEngine.shutdown();
    } catch (error) {
      // Ignore cleanup errors in mocked tests
    }
    (RuleEngineService as any).instance = null;
  });

  it('should initialize with mocked dependencies', async () => {
    await expect(ruleEngine.initialize()).resolves.not.toThrow();
    
    const status = await ruleEngine.getStatus();
    expect(status.initialized).toBe(true);
  });

  it('should perform mocked health check', async () => {
    await ruleEngine.initialize();
    
    const health = await ruleEngine.healthCheck();
    expect(health.status).toBe('healthy');
  });

  it('should handle mocked queue operations', async () => {
    await ruleEngine.initialize();
    
    const stats = await ruleEngine.notificationQueue.getQueueStats();
    expect(stats).toBeDefined();
  });
});