import type { RuleEngineConfig } from '@/types/rule-engine';
import { RuleService } from './database/RuleService';
import { NotificationQueue } from './queue/NotificationQueue';
import { CronManager } from './scheduler/CronManager';
import { ScheduledNotificationManager } from './scheduler/ScheduledNotificationManager';

export class RuleEngineService {
  private static instance: RuleEngineService | null = null;

  public ruleService: RuleService;
  public notificationQueue: NotificationQueue;
  public cronManager: CronManager;
  public scheduledNotificationManager: ScheduledNotificationManager;

  private isInitialized = false;
  private isShuttingDown = false;

  private constructor(config: RuleEngineConfig) {
    // Initialize services
    this.ruleService = new RuleService();
    this.notificationQueue = new NotificationQueue(config, this.ruleService);
    this.cronManager = new CronManager(
      this.ruleService,
      this.notificationQueue,
      config.defaultTimezone
    );
    this.scheduledNotificationManager = new ScheduledNotificationManager(
      this.ruleService,
      this.notificationQueue
    );
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: RuleEngineConfig): RuleEngineService {
    if (!RuleEngineService.instance) {
      if (!config) {
        throw new Error('RuleEngineService not initialized. Config required for first call.');
      }
      RuleEngineService.instance = new RuleEngineService(config);
    }
    return RuleEngineService.instance;
  }

  /**
   * Initialize the rule engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('RuleEngineService already initialized');
      return;
    }

    try {
      console.log('Initializing RuleEngineService...');

      // Initialize cron manager (loads and schedules all cron rules)
      await this.cronManager.initialize();

      // Start scheduled notification manager
      this.scheduledNotificationManager.start();

      this.isInitialized = true;
      console.log('RuleEngineService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RuleEngineService:', error);
      throw error;
    }
  }

  /**
   * Reload cron rules (useful after configuration changes)
   */
  async reloadCronRules(enterpriseId?: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('RuleEngineService not initialized');
    }

    await this.cronManager.reloadRules(enterpriseId);
  }

  /**
   * Get overall system status
   */
  async getStatus(): Promise<{
    initialized: boolean;
    cronJobs: Array<{
      ruleId: number;
      enterpriseId: string;
      cronExpression: string;
      timezone: string;
      isRunning: boolean;
      isScheduled: boolean;
    }>;
    scheduledNotifications: {
      isRunning: boolean;
      isProcessing: boolean;
      checkInterval: number;
      batchSize: number;
    };
    queueStats: {
      notification: any;
      ruleExecution: any;
    };
    scheduledStats: {
      totalScheduled: number;
      overdue: number;
      upcoming24h: number;
      upcomingWeek: number;
    };
  }> {
    const [queueStats, scheduledStats] = await Promise.all([
      this.notificationQueue.getQueueStats(),
      this.scheduledNotificationManager.getScheduledNotificationsStats(),
    ]);

    return {
      initialized: this.isInitialized,
      cronJobs: this.cronManager.getJobsStatus(),
      scheduledNotifications: this.scheduledNotificationManager.getStatus(),
      queueStats,
      scheduledStats,
    };
  }

  /**
   * Pause all processing (useful for maintenance)
   */
  async pause(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('RuleEngineService not initialized');
    }

    console.log('Pausing RuleEngineService...');

    // Pause queues
    await this.notificationQueue.pauseQueues();

    // Stop scheduled notification manager
    this.scheduledNotificationManager.stop();

    console.log('RuleEngineService paused');
  }

  /**
   * Resume all processing
   */
  async resume(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('RuleEngineService not initialized');
    }

    console.log('Resuming RuleEngineService...');

    // Resume queues
    await this.notificationQueue.resumeQueues();

    // Start scheduled notification manager
    this.scheduledNotificationManager.start();

    console.log('RuleEngineService resumed');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('RuleEngineService already shutting down');
      return;
    }

    this.isShuttingDown = true;
    console.log('Shutting down RuleEngineService...');

    try {
      // Stop cron manager
      await this.cronManager.shutdown();

      // Stop scheduled notification manager
      this.scheduledNotificationManager.stop();

      // Shutdown notification queue
      await this.notificationQueue.shutdown();

      // Shutdown rule service (closes database connections)
      await this.ruleService.shutdown();

      this.isInitialized = false;
      RuleEngineService.instance = null;

      console.log('RuleEngineService shutdown complete');
    } catch (error) {
      console.error('Error during RuleEngineService shutdown:', error);
      throw error;
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      initialized: boolean;
      cronManager: boolean;
      scheduledManager: boolean;
      queue: boolean;
    };
  }> {
    const details = {
      initialized: this.isInitialized,
      cronManager: this.cronManager.getJobsStatus().length >= 0, // Basic check
      scheduledManager: this.scheduledNotificationManager.getStatus().isRunning,
      queue: true, // Could add queue health check
    };

    const status = Object.values(details).every(Boolean) ? 'healthy' : 'unhealthy';

    return { status, details };
  }
}

// Export default configuration
export const defaultRuleEngineConfig: RuleEngineConfig = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  defaultTimezone: process.env.RULE_ENGINE_TIMEZONE || 'UTC',
  maxConcurrentJobs: parseInt(process.env.RULE_ENGINE_MAX_CONCURRENT_JOBS || '10'),
  jobRetryAttempts: parseInt(process.env.RULE_ENGINE_RETRY_ATTEMPTS || '3'),
  jobRetryDelay: parseInt(process.env.RULE_ENGINE_RETRY_DELAY || '5000'),
  scheduledNotificationInterval: parseInt(process.env.RULE_ENGINE_SCHEDULED_INTERVAL || '60000'),
  scheduledNotificationBatchSize: parseInt(process.env.RULE_ENGINE_SCHEDULED_BATCH_SIZE || '100'),
};