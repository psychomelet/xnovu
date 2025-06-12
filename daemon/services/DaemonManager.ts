/**
 * Main daemon orchestration service
 * 
 * Coordinates all notification services using Temporal workflows:
 * - EnhancedSubscriptionManager (single shared realtime subscription for all enterprises)
 * - Temporal workflows (notification processing, scheduling, orchestration)
 * - HealthMonitor (health checks and monitoring)
 */

import { EnhancedSubscriptionManager } from '@/app/services/realtime/EnhancedSubscriptionManager';
import { HealthMonitor } from './HealthMonitor';
import type { DaemonConfig, DaemonHealthStatus } from '../types/daemon';
import { logger, measureTime } from '../utils/logging';
import { temporalService } from '@/lib/temporal/service';
import { getTemporalClient } from '@/lib/temporal/client';

export class DaemonManager {
  private config: DaemonConfig;
  private subscriptionManager: EnhancedSubscriptionManager | null = null;
  private healthMonitor: HealthMonitor | null = null;
  private isStarted = false;
  private isShuttingDown = false;
  private startTime: Date = new Date();
  private orchestrationWorkflowId: string | null = null;

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
    // 1. Start Temporal Service and Workers
    await this.startTemporalService();

    // 2. Start Temporal Orchestration Workflow
    await this.startOrchestrationWorkflow();

    // 3. Start Subscription Manager (single realtime subscription for all enterprises)
    if (this.config.enterpriseIds.length > 0) {
      await this.startSubscriptionManager();
    } else {
      logger.warn('No enterprise IDs configured, skipping subscription manager');
    }

    // 4. Start Health Monitor (health checks + HTTP server)
    await this.startHealthMonitor();
  }

  /**
   * Start the Temporal service
   */
  private async startTemporalService(): Promise<void> {
    try {
      logger.daemon('Starting Temporal service...');
      
      // Initialize Temporal (starts workers)
      await temporalService.initialize();
      
      logger.daemon('Temporal service started successfully');
    } catch (error) {
      logger.error('Failed to start Temporal service:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Start the master orchestration workflow
   */
  private async startOrchestrationWorkflow(): Promise<void> {
    try {
      logger.daemon('Starting orchestration workflow...');
      
      const client = await getTemporalClient();
      
      // Start the master orchestration workflow
      this.orchestrationWorkflowId = `orchestration-${Date.now()}`;
      
      await client.workflow.start('masterOrchestrationWorkflow', {
        workflowId: this.orchestrationWorkflowId,
        taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'xnovu-notification-processing',
        args: [{
          enterpriseIds: this.config.enterpriseIds,
          cronInterval: '1m',
          scheduledInterval: '1m',
          scheduledBatchSize: 100,
        }],
        // Run until explicitly cancelled
        workflowExecutionTimeout: undefined,
      });
      
      logger.daemon('Orchestration workflow started successfully', {
        workflowId: this.orchestrationWorkflowId
      });
    } catch (error) {
      logger.error('Failed to start orchestration workflow:', error instanceof Error ? error : new Error(String(error)));
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

      // Cancel orchestration workflow
      if (this.orchestrationWorkflowId) {
        shutdownPromises.push(
          this.cancelOrchestrationWorkflow().catch(error => 
            logger.error('Error cancelling orchestration workflow:', error)
          )
        );
      }

      // Shutdown Temporal service (workers)
      shutdownPromises.push(
        temporalService.shutdown().catch(error => 
          logger.error('Error shutting down Temporal Service:', error)
        )
      );

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
   * Cancel the orchestration workflow
   */
  private async cancelOrchestrationWorkflow(): Promise<void> {
    if (!this.orchestrationWorkflowId) {
      return;
    }

    try {
      const client = await getTemporalClient();
      const handle = client.workflow.getHandle(this.orchestrationWorkflowId);
      
      // Signal the workflow to stop gracefully
      await handle.signal('stopOrchestration');
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // If still running, cancel it
      try {
        await handle.cancel();
      } catch (error) {
        // Workflow might have already completed
        logger.debug('Workflow cancellation error (likely already completed):', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    } catch (error) {
      logger.error('Failed to cancel orchestration workflow:', error instanceof Error ? error : new Error(String(error)));
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
      () => this.cancelOrchestrationWorkflow(),
      () => temporalService.shutdown(),
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

      // Get Temporal status
      let temporalStatus;
      try {
        temporalStatus = await temporalService.getHealth();
      } catch (error) {
        logger.debug('Could not fetch Temporal status:', { error: error instanceof Error ? error.message : String(error) });
      }

      // Check orchestration workflow status
      let orchestrationStatus = 'not_started';
      if (this.orchestrationWorkflowId) {
        try {
          const client = await getTemporalClient();
          const handle = client.workflow.getHandle(this.orchestrationWorkflowId);
          const description = await handle.describe();
          orchestrationStatus = description.status.name;
        } catch (error) {
          orchestrationStatus = 'error';
        }
      }

      // Determine overall status
      const isHealthy = 
        this.isStarted && 
        !this.isShuttingDown &&
        temporalStatus?.status === 'healthy' &&
        subscriptionStatus.failed === 0 &&
        orchestrationStatus === 'RUNNING';

      const isDegraded = 
        this.isStarted &&
        !this.isShuttingDown &&
        (subscriptionStatus.reconnecting > 0 || subscriptionStatus.failed > 0);

      return {
        status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
        uptime,
        components: {
          subscriptions: subscriptionStatus,
          ruleEngine: temporalStatus?.status === 'healthy' ? 'healthy' : 'unhealthy',
          queue: temporalStatus?.status === 'healthy' ? 'healthy' : 'unhealthy',
          temporal: temporalStatus ? temporalStatus.status : 'unhealthy',
        },
        enterprise_status: enterpriseStatus,
        temporal_status: {
          ...temporalStatus,
          orchestrationWorkflow: orchestrationStatus
        },
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
          temporal: 'unhealthy',
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
}