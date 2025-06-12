/**
 * Worker Manager
 * 
 * Manages BullMQ workers for processing jobs:
 * - Creates enhanced notification queue with workers
 * - Handles graceful shutdown
 * - Monitors worker health
 */

import { EnhancedNotificationQueue } from '@/app/services/queue/EnhancedNotificationQueue';
import { RuleService } from '@/app/services/database/RuleService';
import { defaultRuleEngineConfig } from '@/app/services';
import type { RuleEngineConfig } from '@/types/rule-engine';
import { logger, measureTime } from '../../daemon/utils/logging';

interface WorkerConfig {
  concurrency: number;
  logLevel: string;
  redis: {
    url: string;
  };
  supabase: {
    url: string;
    serviceKey: string;
  };
  novu: {
    secretKey: string;
  };
  ruleEngine: {
    maxConcurrentJobs: number;
    retryAttempts: number;
    retryDelay: number;
  };
}

export class WorkerManager {
  private config: WorkerConfig;
  private enhancedNotificationQueue: EnhancedNotificationQueue | null = null;
  private ruleService: RuleService | null = null;
  private isStarted = false;
  private isShuttingDown = false;
  private startTime: Date = new Date();

  constructor(config: WorkerConfig) {
    this.config = config;
    logger.info('Worker manager initialized', {
      component: 'WorkerManager',
      concurrency: config.concurrency,
      logLevel: config.logLevel
    });
  }

  /**
   * Start the worker processes
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Worker manager already started');
      return;
    }

    try {
      this.startTime = new Date();
      logger.info('Starting worker services...', { component: 'WorkerManager' });

      await measureTime(
        () => this.initializeServices(),
        logger,
        'Worker services initialization completed',
        { component: 'WorkerManager' }
      );

      this.isStarted = true;
      logger.info('Worker services started successfully', {
        component: 'WorkerManager',
        uptime: this.getUptime(),
        concurrency: this.config.concurrency
      });

    } catch (error) {
      logger.error('Failed to start worker services:', error instanceof Error ? error : new Error(String(error)));
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Initialize all worker services
   */
  private async initializeServices(): Promise<void> {
    // 1. Initialize Rule Service (database operations)
    await this.startRuleService();

    // 2. Start Enhanced Notification Queue with workers
    await this.startEnhancedNotificationQueue();
  }

  /**
   * Start the rule service (database operations)
   */
  private async startRuleService(): Promise<void> {
    try {
      logger.info('Initializing Rule Service...', { component: 'WorkerManager' });
      
      this.ruleService = new RuleService();
      
      logger.info('Rule Service started successfully', { component: 'WorkerManager' });
    } catch (error) {
      logger.error('Failed to start Rule Service:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Start the enhanced notification queue with workers
   */
  private async startEnhancedNotificationQueue(): Promise<void> {
    try {
      logger.queue('Initializing Enhanced Notification Queue with workers...');

      // Create rule engine configuration for the queue
      const ruleEngineConfig: RuleEngineConfig = {
        ...defaultRuleEngineConfig,
        redisUrl: this.config.redis.url,
        maxConcurrentJobs: this.config.ruleEngine.maxConcurrentJobs,
        jobRetryAttempts: this.config.ruleEngine.retryAttempts,
        jobRetryDelay: this.config.ruleEngine.retryDelay,
      };

      this.enhancedNotificationQueue = new EnhancedNotificationQueue(
        ruleEngineConfig, 
        this.ruleService!
      );

      logger.queue('Enhanced Notification Queue with workers started successfully', {
        concurrency: this.config.concurrency,
        maxConcurrentJobs: ruleEngineConfig.maxConcurrentJobs
      });
    } catch (error) {
      logger.error('Failed to start Enhanced Notification Queue:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Graceful shutdown of all worker services
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Worker shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful worker shutdown...', { component: 'WorkerManager' });

    try {
      const shutdownPromises: Promise<any>[] = [];

      // Shutdown enhanced notification queue (stop workers and close queues)
      if (this.enhancedNotificationQueue) {
        shutdownPromises.push(
          this.enhancedNotificationQueue.shutdown().catch(error => 
            logger.error('Error shutting down Enhanced Notification Queue:', error)
          )
        );
      }

      // Shutdown rule service (close database connections)
      if (this.ruleService) {
        shutdownPromises.push(
          this.ruleService.shutdown().catch(error => 
            logger.error('Error shutting down Rule Service:', error)
          )
        );
      }

      // Wait for all shutdowns to complete (with timeout)
      await Promise.race([
        Promise.all(shutdownPromises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Worker shutdown timeout')), 30000)
        )
      ]);

      this.isStarted = false;
      logger.info('Graceful worker shutdown completed', {
        component: 'WorkerManager',
        uptime: this.getUptime()
      });

    } catch (error) {
      logger.error('Error during graceful worker shutdown:', error instanceof Error ? error : new Error(String(error)));
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Force cleanup (used in error scenarios)
   */
  private async cleanup(): Promise<void> {
    logger.info('Performing emergency worker cleanup...', { component: 'WorkerManager' });

    const cleanupTasks = [
      () => this.enhancedNotificationQueue?.shutdown(),
      () => this.ruleService?.shutdown(),
    ];

    for (const task of cleanupTasks) {
      try {
        await task();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    this.isStarted = false;
  }

  /**
   * Get worker uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.isStarted && !this.isShuttingDown;
  }

  /**
   * Get worker status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    uptime: number;
    concurrency: number;
    queueStats?: any;
  }> {
    let queueStats;
    
    try {
      queueStats = this.enhancedNotificationQueue 
        ? await this.enhancedNotificationQueue.getQueueStats()
        : undefined;
    } catch (error) {
      logger.debug('Could not fetch worker queue stats:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    return {
      isRunning: this.isRunning(),
      uptime: this.getUptime(),
      concurrency: this.config.concurrency,
      queueStats,
    };
  }

  /**
   * Get enhanced notification queue (for testing/debugging)
   */
  getEnhancedNotificationQueue(): EnhancedNotificationQueue | null {
    return this.enhancedNotificationQueue;
  }

  /**
   * Get rule service (for testing/debugging)
   */
  getRuleService(): RuleService | null {
    return this.ruleService;
  }
}