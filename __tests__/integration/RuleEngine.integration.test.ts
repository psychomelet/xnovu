/**
 * Integration tests for Rule Engine with real cloud Redis connection
 * These tests require real cloud services configured in .env.local
 */

import { RuleEngineService } from '@/app/services/RuleEngineService';
import { supabase } from '@/lib/supabase/client';
import type { RuleEngineConfig } from '@/types/rule-engine';

// Using real cloud Redis from .env.local
const REDIS_URL = process.env.REDIS_URL!;

const testConfig: RuleEngineConfig = {
  redisUrl: REDIS_URL,
  defaultTimezone: 'UTC',
  maxConcurrentJobs: 2,
  jobRetryAttempts: 2,
  jobRetryDelay: 1000,
  scheduledNotificationInterval: 10000,
  scheduledNotificationBatchSize: 10,
};

describe('Rule Engine Integration Tests with Cloud Services', () => {
  let ruleEngine: RuleEngineService | null = null;
  let testEnterpriseId: string;
  let testRuleId: number;

  beforeAll(async () => {
    testEnterpriseId = 'test-enterprise-' + Date.now();

    // Create test rule in Supabase
    const { data: rule, error } = await supabase
      .schema('notify')
      .from('ent_notification_rule')
      .insert({
        name: 'Test Rule',
        enterprise_id: testEnterpriseId,
        rule_type: 'SCHEDULE',
        trigger_config: {
          schedule: '0 9 * * *', // Daily at 9 AM
          timezone: 'UTC'
        },
        action_config: {
          workflowId: 'test-workflow',
          payload: { test: true }
        },
        is_active: true,
        deactivated: false
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create test rule:', error);
      throw error;
    }

    testRuleId = rule.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testRuleId) {
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .delete()
        .eq('id', testRuleId);
    }
  });

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

  describe('Cloud Redis Integration', () => {
    it('should connect to cloud Redis and initialize successfully', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      
      await expect(ruleEngine.initialize()).resolves.not.toThrow();
      
      const status = await ruleEngine.getStatus();
      expect(status.initialized).toBe(true);
    }, 30000); // Longer timeout for cloud services

    it('should perform health check with cloud Redis', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      const health = await ruleEngine.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.initialized).toBe(true);
      expect(health.details.notificationQueue).toBeDefined();
      expect(health.details.cronManager).toBeDefined();
    }, 30000);

    it('should handle queue operations with cloud Redis', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      // Get queue stats (should work with real Redis)
      const stats = await ruleEngine.notificationQueue.getQueueStats();
      
      expect(stats).toHaveProperty('notification');
      expect(stats).toHaveProperty('ruleExecution');
      expect(typeof stats.notification).toBe('object');
      expect(typeof stats.ruleExecution).toBe('object');
      
      // Check queue properties
      expect(stats.notification).toHaveProperty('waiting');
      expect(stats.notification).toHaveProperty('active');
      expect(stats.notification).toHaveProperty('completed');
      expect(stats.notification).toHaveProperty('failed');
    }, 30000);

    it('should pause and resume with cloud Redis', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      // Test pause
      await expect(ruleEngine.pause()).resolves.not.toThrow();
      
      // Verify paused state
      let status = await ruleEngine.getStatus();
      expect(status.initialized).toBe(true);
      
      // Test resume
      await expect(ruleEngine.resume()).resolves.not.toThrow();
      
      // Verify resumed state
      status = await ruleEngine.getStatus();
      expect(status.initialized).toBe(true);
    }, 30000);

    it('should reload cron rules from Supabase', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      // Should not throw when reloading rules
      await expect(ruleEngine.reloadCronRules()).resolves.not.toThrow();
      
      // Should reload rules for specific enterprise
      await expect(ruleEngine.reloadCronRules(testEnterpriseId)).resolves.not.toThrow();
      
      // Check if test rule was loaded
      const status = await ruleEngine.getStatus();
      const testRuleJob = status.cronJobs.find(job => 
        job.name.includes(testRuleId.toString())
      );
      
      expect(testRuleJob).toBeDefined();
      if (testRuleJob) {
        expect(testRuleJob.schedule).toBe('0 9 * * *');
        expect(testRuleJob.running).toBe(true);
      }
    }, 30000);
  });

  describe('Error Handling with Cloud Services', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Test with invalid Redis URL
      const badConfig = {
        ...testConfig,
        redisUrl: 'redis://invalid-host-that-does-not-exist:6379',
      };

      const badRuleEngine = RuleEngineService.getInstance(badConfig);
      
      // Should handle Redis connection errors during initialization
      await expect(badRuleEngine.initialize()).rejects.toThrow();
      
      // Clean up the bad instance
      (RuleEngineService as any).instance = null;
    }, 30000);

    it('should handle Supabase query errors gracefully', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      // Try to reload rules for non-existent enterprise
      await expect(
        ruleEngine.reloadCronRules('non-existent-enterprise')
      ).resolves.not.toThrow();
      
      // Should have no cron jobs for non-existent enterprise
      const status = await ruleEngine.getStatus();
      const nonExistentJobs = status.cronJobs.filter(job => 
        job.name.includes('non-existent-enterprise')
      );
      expect(nonExistentJobs).toHaveLength(0);
    }, 30000);
  });

  describe('Performance with Cloud Services', () => {
    it('should initialize within reasonable time', async () => {
      const startTime = Date.now();
      
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      const initTime = Date.now() - startTime;
      
      // Should initialize within 10 seconds (cloud services may be slower)
      expect(initTime).toBeLessThan(10000);
      
      console.log(`Rule Engine initialized in ${initTime}ms`);
    }, 30000);

    it('should handle concurrent operations efficiently', async () => {
      ruleEngine = RuleEngineService.getInstance(testConfig);
      await ruleEngine.initialize();
      
      // Perform multiple operations concurrently
      const operations = [
        ruleEngine.getStatus(),
        ruleEngine.healthCheck(),
        ruleEngine.notificationQueue.getQueueStats(),
        ruleEngine.reloadCronRules(testEnterpriseId),
      ];
      
      const startTime = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;
      
      // All operations should complete successfully
      expect(results).toHaveLength(4);
      expect(results[0]).toHaveProperty('initialized');
      expect(results[1]).toHaveProperty('status');
      expect(results[2]).toHaveProperty('notification');
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000);
      
      console.log(`Concurrent operations completed in ${duration}ms`);
    }, 30000);
  });
});