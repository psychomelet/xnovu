/**
 * Main daemon orchestration service
 * 
 * Coordinates all notification services:
 * - EnhancedSubscriptionManager (single shared realtime subscription for all enterprises)
 * - RuleEngineService (cron + scheduled notifications)
 * - HealthMonitor (health checks and monitoring)
 */

import { RuleEngineService, defaultRuleEngineConfig } from '@/app/services';
import { EnhancedNotificationQueue } from '@/app/services/queue/EnhancedNotificationQueue';
import { RuleService } from '@/app/services/database/RuleService';
import { EnhancedSubscriptionManager } from '@/app/services/realtime/EnhancedSubscriptionManager';
import { HealthMonitor } from './HealthMonitor';
import type { DaemonConfig, DaemonHealthStatus } from '../types/daemon';
import { logger, measureTime } from '../utils/logging';

export class DaemonManager {
  private config: DaemonConfig;
  private subscriptionManager: EnhancedSubscriptionManager | null = null;
  private ruleEngineService: RuleEngineService | null = null;
  private enhancedNotificationQueue: EnhancedNotificationQueue | null = null;
  private ruleService: RuleService | null = null;
  private healthMonitor: HealthMonitor | null = null;
  private isStarted = false;
  private isShuttingDown = false;
  private startTime: Date = new Date();

  constructor(config: DaemonConfig) {
    this.config = config;
    logger.daemon('Daemon manager initialized', { 
      enterpriseCount: config.enterpriseIds.length,
      healthPort: config.healthPort 
    });
  }

  /**
   * Start all daemon services
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Daemon already started, ignoring start request');
      return;
    }

    try {
      this.startTime = new Date();
      logger.daemon('Starting daemon services...');

      await measureTime(
        () => this.initializeServices(),
        logger,
        'Daemon services initialization completed',
        { component: 'DaemonManager' }
      );

      this.isStarted = true;
      logger.daemon('All daemon services started successfully', {
        uptime: this.getUptime(),
        enterpriseCount: this.config.enterpriseIds.length
      });

    } catch (error) {
      logger.error('Failed to start daemon services:', error instanceof Error ? error : new Error(String(error)));
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Initialize all services in correct order
   */
  private async initializeServices(): Promise<void> {
    // 1. Initialize Rule Service (database operations)
    await this.startRuleService();

    // 2. Start Enhanced Notification Queue (BullMQ with realtime support)
    await this.startEnhancedNotificationQueue();

    // 3. Start Rule Engine Service (cron + scheduled notifications)
    await this.startRuleEngineService();

    // 4. Start Subscription Manager (single realtime subscription for all enterprises)
    if (this.config.enterpriseIds.length > 0) {
      await this.startSubscriptionManager();
    } else {
      logger.warn('No enterprise IDs configured, skipping subscription manager');
    }

    // 5. Start Health Monitor (health checks + HTTP server)
    await this.startHealthMonitor();
  }

  /**
   * Start the rule service (database operations)
   */
  private async startRuleService(): Promise<void> {
    try {
      logger.daemon('Initializing Rule Service...');
      
      this.ruleService = new RuleService();
      
      logger.daemon('Rule Service started successfully');
    } catch (error) {
      logger.error('Failed to start Rule Service:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Start the enhanced notification queue (BullMQ with realtime support)
   */
  private async startEnhancedNotificationQueue(): Promise<void> {
    try {
      logger.queue('Initializing Enhanced Notification Queue...');

      // Use existing rule engine configuration for queue
      const ruleEngineConfig = {
        ...defaultRuleEngineConfig,
        redisUrl: this.config.redis.url,
      };

      this.enhancedNotificationQueue = new EnhancedNotificationQueue(
        ruleEngineConfig, 
        this.ruleService!
      );

      logger.queue('Enhanced Notification Queue started successfully');
    } catch (error) {
      logger.error('Failed to start Enhanced Notification Queue:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Start the rule engine service (existing cron + scheduled functionality)
   */
  private async startRuleEngineService(): Promise<void> {
    try {
      logger.ruleEngine('Initializing Rule Engine Service...');

      // Use existing rule engine configuration
      const ruleEngineConfig = {
        ...defaultRuleEngineConfig,
        redisUrl: this.config.redis.url,
      };

      this.ruleEngineService = RuleEngineService.getInstance(ruleEngineConfig);
      await this.ruleEngineService.initialize();

      logger.ruleEngine('Rule Engine Service started successfully');
    } catch (error) {
      logger.error('Failed to start Rule Engine Service:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Start the subscription manager for realtime subscriptions (single shared subscription)
   */
  private async startSubscriptionManager(): Promise<void> {
    try {
      logger.subscription('Initializing Subscription Manager...', 'daemon', {
        enterpriseCount: this.config.enterpriseIds.length
      });

      // Create a single subscription manager that handles all enterprises
      this.subscriptionManager = new EnhancedSubscriptionManager({
        enterpriseId: 'shared', // Special identifier for shared subscription
        enterpriseIds: this.config.enterpriseIds, // Pass the list of enterprises to monitor
        notificationQueue: this.enhancedNotificationQueue!,
        events: ['INSERT', 'UPDATE'],
        reconnectDelay: this.config.subscription.reconnectDelay,
        maxRetries: this.config.subscription.maxRetries,
        onNotification: async (notification, eventType) => {
          logger.subscription(`Notification received via callback (${eventType})`, 'shared', {
            notificationId: notification.id,
            enterpriseId: notification.enterprise_id,
            eventType
          });
        },
        onError: (error) => {
          logger.error(`Subscription error for shared subscription:`, error);
        }
      });

      await this.subscriptionManager.start();

      logger.subscription('Subscription Manager started successfully', 'daemon', {
        enterpriseCount: this.config.enterpriseIds.length
      });
    } catch (error) {
      logger.error('Failed to start Subscription Manager:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Start the health monitor service
   */
  private async startHealthMonitor(): Promise<void> {
    try {
      logger.health('Starting Health Monitor...');

      this.healthMonitor = new HealthMonitor({
        port: this.config.healthPort,
        daemonManager: this,
      });

      await this.healthMonitor.start();

      logger.health('Health Monitor started successfully', {
        port: this.config.healthPort
      });
    } catch (error) {
      logger.error('Failed to start Health Monitor:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Graceful shutdown of all services
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.daemon('Starting graceful shutdown...');

    try {
      const shutdownPromises: Promise<any>[] = [];

      // Shutdown health monitor first (stop accepting health checks)
      if (this.healthMonitor) {
        shutdownPromises.push(
          this.healthMonitor.stop().catch(error => 
            logger.error('Error shutting down Health Monitor:', error)
          )
        );
      }

      // Shutdown subscription manager (stop receiving new realtime events)
      if (this.subscriptionManager) {
        shutdownPromises.push(
          this.subscriptionManager.stop().catch(error => 
            logger.error('Error shutting down Subscription Manager:', error)
          )
        );
      }

      // Shutdown rule engine service (stop cron jobs and scheduled processing)
      if (this.ruleEngineService) {
        shutdownPromises.push(
          this.ruleEngineService.shutdown().catch(error => 
            logger.error('Error shutting down Rule Engine Service:', error)
          )
        );
      }

      // Shutdown enhanced notification queue (stop BullMQ workers and queues)
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
          setTimeout(() => reject(new Error('Shutdown timeout')), 30000)
        )
      ]);

      this.isStarted = false;
      logger.daemon('Graceful shutdown completed', {
        uptime: this.getUptime()
      });

    } catch (error) {
      logger.error('Error during graceful shutdown:', error instanceof Error ? error : new Error(String(error)));
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Force cleanup (used in error scenarios)
   */
  private async cleanup(): Promise<void> {
    logger.daemon('Performing emergency cleanup...');

    const cleanupTasks = [
      () => this.healthMonitor?.stop(),
      () => this.subscriptionManager?.stop(),
      () => this.ruleEngineService?.shutdown(),
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
   * Get comprehensive health status
   */
  async getHealthStatus(): Promise<DaemonHealthStatus> {
    const uptime = this.getUptime();
    
    try {
      // Get subscription manager status
      const subscriptionStatus = this.subscriptionManager 
        ? {
            total: this.config.enterpriseIds.length,
            active: this.subscriptionManager.isHealthy() ? this.config.enterpriseIds.length : 0,
            failed: this.subscriptionManager.isHealthy() ? 0 : this.config.enterpriseIds.length,
            reconnecting: 0
          }
        : { total: 0, active: 0, failed: 0, reconnecting: 0 };

      const enterpriseStatus: Record<string, string> = {};
      if (this.subscriptionManager) {
        const status = this.subscriptionManager.getStatus();
        this.config.enterpriseIds.forEach(enterpriseId => {
          enterpriseStatus[enterpriseId] = status.isActive ? 'subscribed' : 'error';
        });
      }

      // Get rule engine status
      const ruleEngineHealth = this.ruleEngineService
        ? await this.ruleEngineService.healthCheck()
        : { status: 'unhealthy' as const };

      // Get queue stats (if available)
      let queueStats;
      try {
        queueStats = this.enhancedNotificationQueue
          ? await this.enhancedNotificationQueue.getQueueStats()
          : undefined;
      } catch (error) {
        logger.debug('Could not fetch queue stats:', { error: error instanceof Error ? error.message : String(error) });
      }

      // Determine overall status
      const isHealthy = 
        this.isStarted && 
        !this.isShuttingDown &&
        ruleEngineHealth.status === 'healthy' &&
        subscriptionStatus.failed === 0;

      const isDegraded = 
        this.isStarted &&
        !this.isShuttingDown &&
        (subscriptionStatus.reconnecting > 0 || subscriptionStatus.failed > 0) &&
        ruleEngineHealth.status === 'healthy';

      return {
        status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
        uptime,
        components: {
          subscriptions: subscriptionStatus,
          ruleEngine: this.ruleEngineService ? ruleEngineHealth.status : 'not_initialized',
          queue: queueStats ? 'healthy' : 'not_initialized',
        },
        enterprise_status: enterpriseStatus,
        queue_stats: queueStats,
      };

    } catch (error) {
      logger.error('Error getting health status:', error instanceof Error ? error : new Error(String(error)));
      
      return {
        status: 'unhealthy',
        uptime,
        components: {
          subscriptions: { total: 0, active: 0, failed: 0, reconnecting: 0 },
          ruleEngine: 'unhealthy',
          queue: 'unhealthy',
        },
        enterprise_status: {},
      };
    }
  }

  /**
   * Get daemon uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Get health monitor port
   */
  getHealthPort(): number {
    return this.config.healthPort;
  }

  /**
   * Check if daemon is started
   */
  isRunning(): boolean {
    return this.isStarted && !this.isShuttingDown;
  }

  /**
   * Get subscription manager (for testing/debugging)
   */
  getSubscriptionManager(): EnhancedSubscriptionManager | null {
    return this.subscriptionManager;
  }

  /**
   * Get rule engine service (for testing/debugging)
   */
  getRuleEngineService(): RuleEngineService | null {
    return this.ruleEngineService;
  }
}