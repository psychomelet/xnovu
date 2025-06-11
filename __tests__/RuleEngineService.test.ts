import { RuleEngineService, defaultRuleEngineConfig } from '@/app/services/RuleEngineService';
import type { RuleEngineConfig } from '@/types/rule-engine';

// Mock all external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@novu/api');
jest.mock('bullmq');
jest.mock('ioredis');
jest.mock('node-cron');

// Mock internal services
jest.mock('@/app/services/database/RuleService');
jest.mock('@/app/services/queue/NotificationQueue');
jest.mock('@/app/services/scheduler/CronManager');
jest.mock('@/app/services/scheduler/ScheduledNotificationManager');

describe('RuleEngineService', () => {
  let ruleEngine: RuleEngineService;
  const testConfig: RuleEngineConfig = {
    ...defaultRuleEngineConfig,
    redisUrl: 'redis://localhost:6379',
    maxConcurrentJobs: 5,
  };

  beforeEach(() => {
    // Reset singleton instance before each test
    (RuleEngineService as any).instance = null;
    ruleEngine = RuleEngineService.getInstance(testConfig);
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await ruleEngine.shutdown();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
  });

  describe('initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = RuleEngineService.getInstance(testConfig);
      const instance2 = RuleEngineService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should throw error when accessing without config', () => {
      (RuleEngineService as any).instance = null;
      
      expect(() => {
        RuleEngineService.getInstance();
      }).toThrow('RuleEngineService not initialized');
    });

    it('should initialize all components', async () => {
      const initializeSpy = jest.spyOn(ruleEngine.cronManager, 'initialize')
        .mockResolvedValue();
      const startSpy = jest.spyOn(ruleEngine.scheduledNotificationManager, 'start')
        .mockImplementation();

      await ruleEngine.initialize();

      expect(initializeSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
    });
  });

  describe('cron rule management', () => {
    beforeEach(async () => {
      await ruleEngine.initialize();
    });

    it('should reload cron rules', async () => {
      const reloadSpy = jest.spyOn(ruleEngine.cronManager, 'reloadRules')
        .mockResolvedValue();

      await ruleEngine.reloadCronRules('ent-123');

      expect(reloadSpy).toHaveBeenCalledWith('ent-123');
    });

    it('should reload all cron rules when no enterprise specified', async () => {
      const reloadSpy = jest.spyOn(ruleEngine.cronManager, 'reloadRules')
        .mockResolvedValue();

      await ruleEngine.reloadCronRules();

      expect(reloadSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe('system status', () => {
    beforeEach(async () => {
      await ruleEngine.initialize();
    });

    it('should get comprehensive system status', async () => {
      const mockCronJobs = [
        {
          ruleId: 1,
          enterpriseId: 'ent-123',
          cronExpression: '0 9 * * *',
          timezone: 'UTC',
          isRunning: false,
          isScheduled: true,
        },
      ];

      const mockQueueStats = {
        notification: { waiting: 0, active: 0, completed: 10, failed: 1 },
        ruleExecution: { waiting: 0, active: 0, completed: 5, failed: 0 },
      };

      const mockScheduledStats = {
        totalScheduled: 15,
        overdue: 2,
        upcoming24h: 5,
        upcomingWeek: 8,
      };

      jest.spyOn(ruleEngine.cronManager, 'getJobsStatus')
        .mockReturnValue(mockCronJobs);
      jest.spyOn(ruleEngine.notificationQueue, 'getQueueStats')
        .mockResolvedValue(mockQueueStats);
      jest.spyOn(ruleEngine.scheduledNotificationManager, 'getScheduledNotificationsStats')
        .mockResolvedValue(mockScheduledStats);
      jest.spyOn(ruleEngine.scheduledNotificationManager, 'getStatus')
        .mockReturnValue({
          isRunning: true,
          isProcessing: false,
          checkInterval: 60000,
          batchSize: 100,
        });

      const status = await ruleEngine.getStatus();

      expect(status).toEqual({
        initialized: true,
        cronJobs: mockCronJobs,
        scheduledNotifications: {
          isRunning: true,
          isProcessing: false,
          checkInterval: 60000,
          batchSize: 100,
        },
        queueStats: mockQueueStats,
        scheduledStats: mockScheduledStats,
      });
    });
  });

  describe('pause and resume', () => {
    beforeEach(async () => {
      await ruleEngine.initialize();
    });

    it('should pause all components', async () => {
      const pauseQueuesSpy = jest.spyOn(ruleEngine.notificationQueue, 'pauseQueues')
        .mockResolvedValue();
      const stopScheduledSpy = jest.spyOn(ruleEngine.scheduledNotificationManager, 'stop')
        .mockImplementation();

      await ruleEngine.pause();

      expect(pauseQueuesSpy).toHaveBeenCalled();
      expect(stopScheduledSpy).toHaveBeenCalled();
    });

    it('should resume all components', async () => {
      const resumeQueuesSpy = jest.spyOn(ruleEngine.notificationQueue, 'resumeQueues')
        .mockResolvedValue();
      const startScheduledSpy = jest.spyOn(ruleEngine.scheduledNotificationManager, 'start')
        .mockImplementation();

      await ruleEngine.resume();

      expect(resumeQueuesSpy).toHaveBeenCalled();
      expect(startScheduledSpy).toHaveBeenCalled();
    });

    it('should throw error when pausing uninitialized service', async () => {
      // Reset singleton instance to ensure uninitialized state
      (RuleEngineService as any).instance = null;
      const uninitializedEngine = RuleEngineService.getInstance(testConfig);
      
      await expect(uninitializedEngine.pause()).rejects.toThrow(
        'RuleEngineService not initialized'
      );
    });
  });

  describe('health check', () => {
    beforeEach(async () => {
      await ruleEngine.initialize();
    });

    it('should return healthy status when all components are working', async () => {
      jest.spyOn(ruleEngine.cronManager, 'getJobsStatus')
        .mockReturnValue([]);
      jest.spyOn(ruleEngine.scheduledNotificationManager, 'getStatus')
        .mockReturnValue({
          isRunning: true,
          isProcessing: false,
          checkInterval: 60000,
          batchSize: 100,
        });

      const health = await ruleEngine.healthCheck();

      expect(health).toEqual({
        status: 'healthy',
        details: {
          initialized: true,
          cronManager: true,
          scheduledManager: true,
          queue: true,
        },
      });
    });

    it('should return unhealthy status when scheduled manager is not running', async () => {
      jest.spyOn(ruleEngine.cronManager, 'getJobsStatus')
        .mockReturnValue([]);
      jest.spyOn(ruleEngine.scheduledNotificationManager, 'getStatus')
        .mockReturnValue({
          isRunning: false,
          isProcessing: false,
          checkInterval: 60000,
          batchSize: 100,
        });

      const health = await ruleEngine.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details.scheduledManager).toBe(false);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await ruleEngine.initialize();
    });

    it('should shutdown all components gracefully', async () => {
      const shutdownCronSpy = jest.spyOn(ruleEngine.cronManager, 'shutdown')
        .mockResolvedValue();
      const stopScheduledSpy = jest.spyOn(ruleEngine.scheduledNotificationManager, 'stop')
        .mockImplementation();
      const shutdownQueueSpy = jest.spyOn(ruleEngine.notificationQueue, 'shutdown')
        .mockResolvedValue();

      await ruleEngine.shutdown();

      expect(shutdownCronSpy).toHaveBeenCalled();
      expect(stopScheduledSpy).toHaveBeenCalled();
      expect(shutdownQueueSpy).toHaveBeenCalled();
    });

    it('should reset singleton instance after shutdown', async () => {
      await ruleEngine.shutdown();
      
      expect((RuleEngineService as any).instance).toBeNull();
    });

    it('should handle shutdown errors gracefully', async () => {
      jest.spyOn(ruleEngine.cronManager, 'shutdown')
        .mockRejectedValue(new Error('Shutdown error'));

      await expect(ruleEngine.shutdown()).rejects.toThrow('Shutdown error');
    });
  });
});

describe('defaultRuleEngineConfig', () => {
  it('should have correct default values', () => {
    expect(defaultRuleEngineConfig).toEqual({
      redisUrl: 'redis://localhost:6379',
      defaultTimezone: 'UTC',
      maxConcurrentJobs: 10,
      jobRetryAttempts: 3,
      jobRetryDelay: 5000,
    });
  });

  it('should use environment variables when available', () => {
    // Environment variables are set at module load time, so we need to test the pattern
    // rather than actual runtime behavior in Jest
    const expectedDefaults = {
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      defaultTimezone: process.env.RULE_ENGINE_TIMEZONE || 'UTC',
      maxConcurrentJobs: parseInt(process.env.RULE_ENGINE_MAX_CONCURRENT_JOBS || '10'),
      jobRetryAttempts: parseInt(process.env.RULE_ENGINE_RETRY_ATTEMPTS || '3'),
      jobRetryDelay: parseInt(process.env.RULE_ENGINE_RETRY_DELAY || '5000'),
    };

    expect(defaultRuleEngineConfig).toEqual(expectedDefaults);
  });
});