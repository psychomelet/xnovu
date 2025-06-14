/**
 * Main worker orchestration service
 * 
 * Coordinates all notification services using Temporal workflows:
 * - Notification polling workflow (outbox pattern for reliable processing)
 * - Temporal workflows (notification processing, scheduling, orchestration)
 * - HealthMonitor (health checks and monitoring)
 */
import { HealthMonitor } from './HealthMonitor';
import type { WorkerConfig, WorkerHealthStatus } from '../types/worker';
import { logger, measureTime } from '../utils/logging';
import { temporalService } from '@/lib/temporal/service';
import { getTemporalClient } from '@/lib/temporal/client';

export class WorkerManager {
  private config: WorkerConfig;
  private healthMonitor: HealthMonitor | null = null;
  private isStarted = false;
  private isShuttingDown = false;
  private startTime: Date = new Date();
  private orchestrationWorkflowId: string | null = null;
  private pollingWorkflowIds: Map<string, string> = new Map();

  constructor(config: WorkerConfig) {
    this.config = config;
    logger.worker('Worker manager initialized', { 
      enterpriseCount: config.enterpriseIds.length,
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
        uptime: this.getUptime(),
        enterpriseCount: this.config.enterpriseIds.length
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
    // 1. Start Temporal Service and Workers
    await this.startTemporalService();

    // 2. Start Temporal Orchestration Workflow
    await this.startOrchestrationWorkflow();

    // 3. Start Notification Polling Workflows
    if (this.config.enterpriseIds.length > 0) {
      await this.startPollingWorkflows();
    } else {
      logger.warn('No enterprise IDs configured, skipping polling workflows');
    }

    // 4. Start Health Monitor (health checks + HTTP server)
    await this.startHealthMonitor();
  }

  /**
   * Start the Temporal service
   */
  private async startTemporalService(): Promise<void> {
    try {
      logger.worker('Starting Temporal service...');
      
      // Initialize Temporal (starts workers)
      await temporalService.initialize();
      
      logger.worker('Temporal service started successfully');
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
      logger.worker('Starting orchestration workflow...');
      
      const client = await getTemporalClient();
      
      // Start the master orchestration workflow
      this.orchestrationWorkflowId = `orchestration-${Date.now()}`;
      
      await client.start('notificationOrchestrationWorkflow', {
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
      
      logger.worker('Orchestration workflow started successfully', {
        workflowId: this.orchestrationWorkflowId
      });
    } catch (error) {
      logger.error('Failed to start orchestration workflow:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Start notification polling workflows (outbox pattern)
   */
  private async startPollingWorkflows(): Promise<void> {
    try {
      logger.worker('Starting notification polling workflows...', {
        enterpriseCount: this.config.enterpriseIds.length
      });

      const client = await getTemporalClient();
      const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'xnovu-notification-processing';

      // Start a polling workflow for each enterprise
      for (const enterpriseId of this.config.enterpriseIds) {
        const workflowId = `notification-polling-${enterpriseId}-${Date.now()}`;
        
        await client.start('notificationPollingWorkflow', {
          workflowId,
          taskQueue,
          args: [{
            enterpriseId,
            pollInterval: this.config.subscription?.pollInterval || 5000, // Default 5 seconds
            batchSize: this.config.subscription?.batchSize || 100,
            includeProcessed: false,
            processFailedNotifications: true,
            processScheduledNotifications: true
          }],
          // Run until explicitly cancelled
          workflowExecutionTimeout: undefined,
        });

        this.pollingWorkflowIds.set(enterpriseId, workflowId);
        
        logger.worker('Started polling workflow for enterprise', {
          enterpriseId,
          workflowId
        });
      }

      logger.worker('All polling workflows started successfully', {
        enterpriseCount: this.config.enterpriseIds.length
      });
    } catch (error) {
      logger.error('Failed to start polling workflows:', error instanceof Error ? error : new Error(String(error)));
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

      // Cancel polling workflows
      for (const [enterpriseId, workflowId] of this.pollingWorkflowIds) {
        shutdownPromises.push(
          this.cancelPollingWorkflow(enterpriseId, workflowId).catch(error => 
            logger.error('Error cancelling polling workflow:', error)
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
   * Cancel the orchestration workflow
   */
  private async cancelOrchestrationWorkflow(): Promise<void> {
    if (!this.orchestrationWorkflowId) {
      return;
    }

    try {
      const client = await getTemporalClient();
      const handle = client.getHandle(this.orchestrationWorkflowId);
      
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
   * Cancel a polling workflow
   */
  private async cancelPollingWorkflow(enterpriseId: string, workflowId: string): Promise<void> {
    try {
      const client = await getTemporalClient();
      const handle = client.getHandle(workflowId);
      
      // Signal the workflow to pause
      await handle.signal('pause');
      
      // Wait a bit for graceful pause
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Cancel the workflow
      try {
        await handle.cancel();
      } catch (error) {
        // Workflow might have already completed
        logger.debug('Polling workflow cancellation error:', { 
          enterpriseId,
          workflowId,
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    } catch (error) {
      logger.error('Failed to cancel polling workflow:', {
        enterpriseId,
        workflowId,
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }

  /**
   * Force cleanup (used in error scenarios)
   */
  private async cleanup(): Promise<void> {
    logger.worker('Performing emergency cleanup...');

    const cleanupTasks = [
      () => this.healthMonitor?.stop(),
      async () => {
        for (const [enterpriseId, workflowId] of this.pollingWorkflowIds) {
          await this.cancelPollingWorkflow(enterpriseId, workflowId).catch(() => {});
        }
      },
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
  async getHealthStatus(): Promise<WorkerHealthStatus> {
    const uptime = this.getUptime();
    
    try {
      // Get polling workflow status
      const pollingStatus = {
        total: this.pollingWorkflowIds.size,
        active: 0,
        failed: 0,
        reconnecting: 0
      };

      const enterpriseStatus: Record<string, string> = {};
      
      // Check status of each polling workflow
      for (const [enterpriseId, workflowId] of this.pollingWorkflowIds) {
        try {
          const client = await getTemporalClient();
          const handle = client.getHandle(workflowId);
          const description = await handle.describe();
          
          if (description.status.name === 'RUNNING') {
            pollingStatus.active++;
            enterpriseStatus[enterpriseId] = 'polling';
          } else {
            pollingStatus.failed++;
            enterpriseStatus[enterpriseId] = 'error';
          }
        } catch (error) {
          pollingStatus.failed++;
          enterpriseStatus[enterpriseId] = 'error';
        }
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
          const handle = client.getHandle(this.orchestrationWorkflowId);
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
        pollingStatus.failed === 0 &&
        orchestrationStatus === 'RUNNING';

      const isDegraded = 
        this.isStarted &&
        !this.isShuttingDown &&
        pollingStatus.failed > 0;

      return {
        status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
        uptime,
        components: {
          subscriptions: pollingStatus,
          ruleEngine: temporalStatus?.status === 'healthy' ? 'healthy' : 'unhealthy',
          temporal: temporalStatus ? (temporalStatus.status === 'disabled' ? 'not_initialized' : temporalStatus.status) : 'unhealthy',
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
          temporal: 'unhealthy',
        },
        enterprise_status: {},
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
   * Get polling workflow IDs (for testing/debugging)
   */
  getPollingWorkflowIds(): Map<string, string> {
    return this.pollingWorkflowIds;
  }
}