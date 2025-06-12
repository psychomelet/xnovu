/**
 * Mocked unit tests for Rule Engine Service
 * These tests use mocks to test the service without external dependencies
 */

// Mock all dependencies for unit testing
jest.mock('@/app/services/database/RuleService', () => ({
  RuleService: jest.fn().mockImplementation(() => ({
    getActiveCronRules: jest.fn().mockResolvedValue([]),
    getDueCronRules: jest.fn().mockResolvedValue([]),
  }))
}));

jest.mock('@/app/services/queue/NotificationQueue', () => ({
  NotificationQueue: jest.fn().mockImplementation(() => ({
    getQueueStats: jest.fn().mockResolvedValue({ 
      notification: { waiting: 0, active: 0, completed: 0, failed: 0 },
      ruleExecution: { waiting: 0, active: 0, completed: 0, failed: 0 }
    }),
    pauseQueues: jest.fn().mockResolvedValue(undefined),
    resumeQueues: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('@/app/services/scheduler/CronManager', () => ({
  CronManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    getJobsStatus: jest.fn().mockReturnValue([]),
    reloadRules: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('@/app/services/scheduler/ScheduledNotificationManager', () => ({
  ScheduledNotificationManager: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    getScheduledNotificationsStats: jest.fn().mockResolvedValue({ 
      pending: 0, 
      processing: 0, 
      completed: 0, 
      failed: 0 
    }),
    getStatus: jest.fn().mockReturnValue({ isRunning: true })
  }))
}));

import { RuleEngineService } from '@/app/services/RuleEngineService';
import type { RuleEngineConfig } from '@/types/rule-engine';

const testConfig: RuleEngineConfig = {
  redisUrl: 'redis://localhost:6379',
  defaultTimezone: 'UTC',
  maxConcurrentJobs: 2,
  jobRetryAttempts: 2,
  jobRetryDelay: 1000,
};

describe('Rule Engine Service - Mocked Unit Tests', () => {
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
    expect(stats).toHaveProperty('notification');
    expect(stats).toHaveProperty('ruleExecution');
  });

  it('should handle mocked pause and resume operations', async () => {
    await ruleEngine.initialize();
    
    await expect(ruleEngine.pause()).resolves.not.toThrow();
    await expect(ruleEngine.resume()).resolves.not.toThrow();
  });

  it('should handle mocked cron rule reload', async () => {
    await ruleEngine.initialize();
    
    await expect(ruleEngine.reloadCronRules()).resolves.not.toThrow();
    await expect(ruleEngine.reloadCronRules('test-enterprise')).resolves.not.toThrow();
  });
});