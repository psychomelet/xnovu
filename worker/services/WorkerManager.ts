/**
 * Main worker orchestration service
 *
 * Coordinates simplified notification services:
 * - Temporal worker for async notification triggering
 * - Polling loop service that runs parallel to temporal
 * - HealthMonitor (health checks and monitoring)
 */
import { HealthMonitor } from './HealthMonitor';
import type { WorkerConfig, WorkerHealthStatus } from '../types/worker';
import { logger, measureTime } from '../utils/logging';
import { createWorker } from '@/lib/temporal/worker';
import { Worker } from '@temporalio/worker';
import { NotificationPollingLoop } from '@/lib/polling/polling-loop';

export class WorkerManager {
  private config: WorkerConfig;
  private healthMonitor: HealthMonitor | null = null;
  private isStarted = false;
  private isShuttingDown = false;
  private startTime: Date = new Date();
  private workerRunning = false;
  private pollingLoop: NotificationPollingLoop | null = null;
  private temporalWorker: Worker | null = null;

  constructor(config: WorkerConfig) {
    this.config = config;
    logger.worker('Worker manager initialized', {
      healthPort: config.healthPort
    });
  }

  /**
   * Start all worker services
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Worker already started, ignoring start request');
      return;
    }

    try {
      this.startTime = new Date();
      logger.worker('Starting worker services...');

      await measureTime(
        () => this.initializeServices(),
        'Worker services initialization completed',
        { component: 'WorkerManager' }
      );

      this.isStarted = true;
      logger.worker('All worker services started successfully', {
        uptime: this.getUptime()
      });

    } catch (error) {
      logger.error('Failed to start worker services:', error instanceof Error ? error : new Error(String(error)));
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Initialize all services in correct order
   */
  private async initializeServices(): Promise<void> {
    // 1. Start Temporal Worker and Polling Loop
    await this.startTemporalWorker();

    // 2. Start Health Monitor (health checks + HTTP server)
    await this.startHealthMonitor();
  }

  /**
   * Start the Temporal worker and polling loop
   */
  private async startTemporalWorker(): Promise<void> {
    try {
      logger.worker('Starting Temporal worker and polling loop...');

      // Create the Temporal worker
      this.temporalWorker = await createWorker();
      
      // Start the worker in the background (non-blocking)
      this.temporalWorker.run().catch(error => {
        logger.error('Temporal worker stopped unexpectedly:', error);
        this.workerRunning = false;
      });

      // Create and start the polling loop
      this.pollingLoop = new NotificationPollingLoop({
        pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '1000', 10),
        failedPollIntervalMs: parseInt(process.env.FAILED_POLL_INTERVAL_MS || '60000', 10),
        scheduledPollIntervalMs: parseInt(process.env.SCHEDULED_POLL_INTERVAL_MS || '30000', 10),
        batchSize: parseInt(process.env.POLL_BATCH_SIZE || '100', 10),
        temporal: {
          address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
          namespace: process.env.TEMPORAL_NAMESPACE || 'default',
          taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'xnovu-notifications',
        },
      });

      await this.pollingLoop.start();
      this.workerRunning = true;

      logger.worker('Temporal worker and polling loop started successfully');
    } catch (error) {
      logger.error('Failed to start Temporal worker:', error instanceof Error ? error : new Error(String(error)));
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
        workerManager: this,
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
    logger.worker('Starting graceful shutdown...');

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

      // Stop polling loop
      if (this.pollingLoop) {
        shutdownPromises.push(
          this.pollingLoop.stop().catch(error =>
            logger.error('Error stopping polling loop:', error)
          )
        );
      }

      // Stop temporal worker
      if (this.temporalWorker) {
        shutdownPromises.push(
          (async () => {
            this.temporalWorker!.shutdown();
            // Wait for worker to stop
            await new Promise<void>((resolve) => {
              const checkInterval = setInterval(() => {
                if (!this.temporalWorker || this.temporalWorker.getState() === 'STOPPED') {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
              // Force resolve after 10 seconds
              setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
              }, 10000);
            });
          })().catch(error =>
            logger.error('Error stopping Temporal worker:', error)
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
      logger.worker('Graceful shutdown completed', {
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
    logger.worker('Performing emergency cleanup...');

    const cleanupTasks = [
      () => this.healthMonitor?.stop(),
      () => this.pollingLoop?.stop(),
      () => this.temporalWorker?.shutdown(),
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
  async getHealthStatus(): Promise<WorkerHealthStatus> {
    const uptime = this.getUptime();

    try {
      // Get polling loop status
      const pollingLoopRunning = this.pollingLoop?.getIsRunning() || false;
      const pollingStatus = {
        total: 1,
        active: pollingLoopRunning ? 1 : 0,
        failed: pollingLoopRunning ? 0 : 1,
        reconnecting: 0
      };

      // Determine overall status
      const isHealthy =
        this.isStarted &&
        !this.isShuttingDown &&
        this.workerRunning &&
        pollingLoopRunning;

      const isDegraded =
        this.isStarted &&
        !this.isShuttingDown &&
        (!this.workerRunning || !pollingLoopRunning);

      return {
        status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
        uptime,
        components: {
          subscriptions: pollingStatus,
          ruleEngine: this.workerRunning ? 'healthy' : 'unhealthy',
          temporal: this.workerRunning ? 'healthy' : 'unhealthy',
        },
        temporal_status: {
          status: this.workerRunning ? 'healthy' : 'unhealthy',
          pollingLoop: pollingLoopRunning ? 'RUNNING' : 'STOPPED'
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
          temporal: 'unhealthy',
        },
      };
    }
  }

  /**
   * Get worker uptime in seconds
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
   * Check if worker is started
   */
  isRunning(): boolean {
    return this.isStarted && !this.isShuttingDown;
  }

  /**
   * Get the current polling loop status
   */
  getPollingLoopStatus(): boolean {
    return this.pollingLoop?.getIsRunning() || false;
  }

}