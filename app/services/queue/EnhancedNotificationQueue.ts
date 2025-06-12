/**
 * Enhanced Notification Queue with Realtime Job Support
 * 
 * Extends the original NotificationQueue to support:
 * - Realtime job processing (INSERT, UPDATE, DELETE events)
 * - Priority-based job processing 
 * - Enhanced monitoring and metrics
 * - Better error handling for different job types
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { Novu } from '@novu/api';
import type {
  NotificationJobData,
  RuleJobData,
  RuleEngineConfig,
} from '@/types/rule-engine';
import type { RealtimeJobData } from '../../daemon/types/daemon';
import { RuleService } from '../database/RuleService';
import { logger } from '../../daemon/utils/logging';

interface QueuePriorities {
  realtime: number;
  scheduled: number;
  cron: number;
}

export class EnhancedNotificationQueue {
  // Existing queues
  private notificationQueue: Queue<NotificationJobData>;
  private ruleExecutionQueue: Queue<RuleJobData>;
  
  // New realtime queue
  private realtimeQueue: Queue<RealtimeJobData>;

  // Workers
  private notificationWorker: Worker<NotificationJobData>;
  private ruleExecutionWorker: Worker<RuleJobData>;
  private realtimeWorker: Worker<RealtimeJobData>;

  // Monitoring
  private queueEvents: QueueEvents;
  private realtimeQueueEvents: QueueEvents;

  // Services
  private redis: IORedis;
  private ruleService: RuleService;
  private novu: Novu;

  // Configuration
  private priorities: QueuePriorities;

  constructor(config: RuleEngineConfig, ruleService: RuleService) {
    // Redis connection with BullMQ-specific configuration
    this.redis = new IORedis(config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null, // Required for BullMQ
      connectTimeout: 2000, // Fast fail for connection errors
    });

    // Initialize services
    this.ruleService = ruleService;
    this.novu = new Novu({ secretKey: process.env.NOVU_SECRET_KEY! });

    // Configure priorities
    this.priorities = {
      realtime: parseInt(process.env.REALTIME_QUEUE_PRIORITY || '10'),
      scheduled: parseInt(process.env.SCHEDULED_QUEUE_PRIORITY || '5'),
      cron: parseInt(process.env.CRON_QUEUE_PRIORITY || '1'),
    };

    // Queue configuration
    const queueConfig = {
      connection: this.redis,
      defaultJobOptions: {
        attempts: config.jobRetryAttempts || 3,
        backoff: {
          type: 'exponential',
          delay: config.jobRetryDelay || 5000,
        },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    };

    // Initialize queues
    this.notificationQueue = new Queue('notification-processing', queueConfig);
    this.ruleExecutionQueue = new Queue('rule-execution', queueConfig);
    this.realtimeQueue = new Queue('realtime-processing', {
      ...queueConfig,
      defaultJobOptions: {
        ...queueConfig.defaultJobOptions,
        priority: this.priorities.realtime, // High priority for realtime events
      },
    });

    // Initialize workers
    this.notificationWorker = new Worker(
      'notification-processing',
      this.processNotificationJob.bind(this),
      {
        connection: this.redis,
        concurrency: config.maxConcurrentJobs || 10,
      }
    );

    this.ruleExecutionWorker = new Worker(
      'rule-execution',
      this.processRuleExecutionJob.bind(this),
      {
        connection: this.redis,
        concurrency: 5, // Lower concurrency for rule execution
      }
    );

    this.realtimeWorker = new Worker(
      'realtime-processing',
      this.processRealtimeJob.bind(this),
      {
        connection: this.redis,
        concurrency: config.maxConcurrentJobs || 10,
      }
    );

    // Queue events for monitoring
    this.queueEvents = new QueueEvents('notification-processing', {
      connection: this.redis,
    });

    this.realtimeQueueEvents = new QueueEvents('realtime-processing', {
      connection: this.redis,
    });

    this.setupEventListeners();

    logger.queue('Enhanced notification queue initialized', {
      priorities: this.priorities,
      concurrency: config.maxConcurrentJobs || 10
    });
  }

  /**
   * Add a realtime job to the queue (NEW)
   */
  async addRealtimeJob(jobData: RealtimeJobData): Promise<void> {
    try {
      const jobOptions: any = {
        jobId: jobData.eventId, // Use event ID for deduplication
        priority: this.priorities.realtime,
      };

      await this.realtimeQueue.add(
        'process-realtime-event',
        jobData,
        jobOptions
      );

      logger.queue('Realtime job added to queue', {
        jobId: jobData.eventId,
        type: jobData.type,
        enterpriseId: jobData.enterpriseId,
        notificationId: jobData.notificationId
      });

    } catch (error) {
      logger.error('Failed to add realtime job to queue:', error instanceof Error ? error : new Error(String(error)), {
        jobData
      });
      throw error;
    }
  }

  /**
   * Add a notification job to the queue (ENHANCED)
   */
  async addNotificationJob(
    jobData: NotificationJobData,
    delay?: number
  ): Promise<void> {
    try {
      const jobOptions: any = {
        jobId: `notification-${jobData.notificationId}`,
        priority: jobData.scheduledFor ? this.priorities.scheduled : this.priorities.cron,
      };

      if (delay) {
        jobOptions.delay = delay;
      } else if (jobData.scheduledFor) {
        const delayMs = jobData.scheduledFor.getTime() - Date.now();
        if (delayMs > 0) {
          jobOptions.delay = delayMs;
        }
      }

      await this.notificationQueue.add(
        'process-notification',
        jobData,
        jobOptions
      );

      logger.queue('Notification job added to queue', {
        notificationId: jobData.notificationId,
        enterpriseId: jobData.enterpriseId,
        priority: jobOptions.priority,
        delay: jobOptions.delay
      });

    } catch (error) {
      logger.error('Failed to add notification job to queue:', error instanceof Error ? error : new Error(String(error)), {
        jobData
      });
      throw error;
    }
  }

  /**
   * Add a rule execution job to the queue (EXISTING)
   */
  async addRuleExecutionJob(
    jobData: RuleJobData,
    delay?: number
  ): Promise<void> {
    try {
      const jobOptions: any = {
        jobId: `rule-${jobData.ruleId}-${jobData.executionTime.getTime()}`,
        priority: this.priorities.cron,
      };

      if (delay) {
        jobOptions.delay = delay;
      }

      await this.ruleExecutionQueue.add(
        'execute-rule',
        jobData,
        jobOptions
      );

      logger.queue('Rule execution job added to queue', {
        ruleId: jobData.ruleId,
        enterpriseId: jobData.enterpriseId,
        triggerType: jobData.triggerType
      });

    } catch (error) {
      logger.error('Failed to add rule execution job to queue:', error instanceof Error ? error : new Error(String(error)), {
        jobData
      });
      throw error;
    }
  }

  /**
   * Process realtime jobs (NEW)
   */
  private async processRealtimeJob(job: any): Promise<void> {
    const data: RealtimeJobData = job.data;
    const startTime = Date.now();

    try {
      logger.queue('Processing realtime job', {
        jobId: job.id,
        type: data.type,
        enterpriseId: data.enterpriseId,
        notificationId: data.notificationId
      });

      switch (data.type) {
        case 'realtime-insert':
          await this.processRealtimeInsert(data);
          break;
        case 'realtime-update':
          await this.processRealtimeUpdate(data);
          break;
        case 'realtime-delete':
          await this.processRealtimeDelete(data);
          break;
        default:
          throw new Error(`Unknown realtime job type: ${data.type}`);
      }

      const duration = Date.now() - startTime;
      logger.queue('Realtime job processed successfully', {
        jobId: job.id,
        type: data.type,
        duration,
        notificationId: data.notificationId
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to process realtime job:', error instanceof Error ? error : new Error(String(error)), {
        jobId: job.id,
        type: data.type,
        duration,
        notificationId: data.notificationId
      });
      throw error;
    }
  }

  /**
   * Process realtime INSERT events
   */
  private async processRealtimeInsert(data: RealtimeJobData): Promise<void> {
    const notification = data.payload;

    // Validate notification has required fields for processing
    if (!notification.notification_workflow_id) {
      logger.warn('Notification missing workflow ID, skipping processing', {
        notificationId: notification.id,
        enterpriseId: data.enterpriseId
      });
      return;
    }

    // Check if notification is in a processable status
    if (notification.notification_status !== 'PENDING') {
      logger.info('Notification not in PENDING status, skipping processing', {
        notificationId: notification.id,
        status: notification.notification_status,
        enterpriseId: data.enterpriseId
      });
      return;
    }

    // Get workflow information
    const workflow = await this.ruleService.getWorkflow(
      notification.notification_workflow_id,
      data.enterpriseId
    );

    if (!workflow) {
      throw new Error(`Workflow ${notification.notification_workflow_id} not found for notification ${notification.id}`);
    }

    // Create notification job for immediate processing
    const notificationJobData: NotificationJobData = {
      notificationId: notification.id,
      ruleId: notification.notification_rule_id || undefined,
      enterpriseId: data.enterpriseId,
      workflowId: workflow.workflow_key,
      recipients: notification.recipients,
      payload: notification.payload as any,
      overrides: notification.overrides as any,
    };

    // Add to notification queue for processing
    await this.addNotificationJob(notificationJobData);

    logger.queue('Realtime INSERT converted to notification job', {
      notificationId: notification.id,
      workflowId: workflow.workflow_key,
      enterpriseId: data.enterpriseId
    });
  }

  /**
   * Process realtime UPDATE events
   */
  private async processRealtimeUpdate(data: RealtimeJobData): Promise<void> {
    const notification = data.payload;
    const oldNotification = data.oldPayload;

    logger.queue('Processing realtime UPDATE', {
      notificationId: notification.id,
      oldStatus: oldNotification?.notification_status,
      newStatus: notification.notification_status,
      enterpriseId: data.enterpriseId
    });

    // Handle status changes
    if (oldNotification && 
        oldNotification.notification_status !== notification.notification_status) {
      
      logger.queue('Notification status changed', {
        notificationId: notification.id,
        oldStatus: oldNotification.notification_status,
        newStatus: notification.notification_status,
        enterpriseId: data.enterpriseId
      });

      // Handle specific status transitions
      switch (notification.notification_status) {
        case 'PENDING':
          // If changed back to PENDING, re-process
          if (oldNotification.notification_status !== 'PENDING') {
            await this.processRealtimeInsert(data);
          }
          break;
        
        case 'RETRACTED':
          // Handle retraction logic if needed
          logger.queue('Notification retracted', {
            notificationId: notification.id,
            enterpriseId: data.enterpriseId
          });
          break;
        
        default:
          // Other status changes might not require action
          break;
      }
    }

    // Handle other update scenarios (recipient changes, payload changes, etc.)
    if (oldNotification) {
      const recipientsChanged = JSON.stringify(oldNotification.recipients) !== JSON.stringify(notification.recipients);
      const payloadChanged = JSON.stringify(oldNotification.payload) !== JSON.stringify(notification.payload);

      if (recipientsChanged || payloadChanged) {
        logger.queue('Notification content changed', {
          notificationId: notification.id,
          recipientsChanged,
          payloadChanged,
          enterpriseId: data.enterpriseId
        });

        // Could trigger re-processing if the notification is still pending
        if (notification.notification_status === 'PENDING') {
          await this.processRealtimeInsert(data);
        }
      }
    }
  }

  /**
   * Process realtime DELETE events
   */
  private async processRealtimeDelete(data: RealtimeJobData): Promise<void> {
    logger.queue('Processing realtime DELETE', {
      notificationId: data.notificationId,
      enterpriseId: data.enterpriseId
    });

    // Handle cleanup if needed
    // For now, just log the deletion
    logger.queue('Notification deleted', {
      notificationId: data.notificationId,
      enterpriseId: data.enterpriseId
    });
  }

  /**
   * Process notification job (EXISTING with logging enhancements)
   */
  private async processNotificationJob(job: any): Promise<void> {
    const data: NotificationJobData = job.data;
    const startTime = Date.now();

    try {
      logger.queue('Processing notification job', {
        jobId: job.id,
        notificationId: data.notificationId,
        enterpriseId: data.enterpriseId,
        workflowId: data.workflowId
      });

      // Update status to PROCESSING
      await this.ruleService.updateNotificationStatus(
        data.notificationId,
        'PROCESSING'
      );

      // Trigger Novu workflow
      const result = await this.novu.trigger({
        to: data.recipients.map(id => ({ subscriberId: id })),
        workflowId: data.workflowId,
        payload: data.payload,
        overrides: data.overrides || {},
      });

      // Update status to SENT with transaction ID (if available)
      await this.ruleService.updateNotificationStatus(
        data.notificationId,
        'SENT',
        undefined,
        (result as any).transactionId || undefined
      );

      const duration = Date.now() - startTime;
      logger.queue('Notification job processed successfully', {
        jobId: job.id,
        notificationId: data.notificationId,
        duration,
        transactionId: (result as any).transactionId
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to process notification job:', error instanceof Error ? error : new Error(String(error)), {
        jobId: job.id,
        notificationId: data.notificationId,
        duration
      });

      // Update status to FAILED with error details
      await this.ruleService.updateNotificationStatus(
        data.notificationId,
        'FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error', 
          timestamp: new Date().toISOString() 
        }
      );

      throw error;
    }
  }

  /**
   * Process rule execution job (EXISTING with logging enhancements)
   */
  private async processRuleExecutionJob(job: any): Promise<void> {
    const data: RuleJobData = job.data;
    const startTime = Date.now();

    try {
      logger.queue('Processing rule execution job', {
        jobId: job.id,
        ruleId: data.ruleId,
        enterpriseId: data.enterpriseId,
        triggerType: data.triggerType
      });

      // Get the rule details
      const rule = await this.ruleService.getRule(data.ruleId, data.enterpriseId);
      if (!rule) {
        throw new Error(`Rule ${data.ruleId} not found or inactive`);
      }

      // Get the workflow details
      const workflow = await this.ruleService.getWorkflow(
        rule.notification_workflow_id,
        data.enterpriseId
      );
      if (!workflow) {
        throw new Error(`Workflow ${rule.notification_workflow_id} not found or inactive`);
      }

      // Create notification record and process it
      const rulePayload = rule.rule_payload as any;

      if (!rulePayload || !rulePayload.recipients || !rulePayload.payload) {
        throw new Error(`Invalid rule payload for rule ${data.ruleId}`);
      }

      // Create notification record
      const notification = await this.ruleService.createNotification({
        name: rule.name,
        description: `Notification created by rule: ${rule.name}`,
        enterprise_id: data.enterpriseId,
        business_id: rule.business_id,
        notification_rule_id: rule.id,
        notification_workflow_id: rule.notification_workflow_id,
        notification_status: 'PENDING',
        channels: workflow.default_channels,
        recipients: rulePayload.recipients,
        payload: rulePayload.payload,
        overrides: rulePayload.overrides || null,
        publish_status: 'PUBLISH',
        deactivated: false,
      });

      // Add notification to processing queue
      await this.addNotificationJob({
        notificationId: notification.id,
        ruleId: rule.id,
        enterpriseId: data.enterpriseId,
        workflowId: workflow.workflow_key,
        recipients: rulePayload.recipients,
        payload: rulePayload.payload,
        overrides: rulePayload.overrides,
      });

      const duration = Date.now() - startTime;
      logger.queue('Rule execution job processed successfully', {
        jobId: job.id,
        ruleId: data.ruleId,
        notificationId: notification.id,
        duration
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to process rule execution job:', error instanceof Error ? error : new Error(String(error)), {
        jobId: job.id,
        ruleId: data.ruleId,
        duration
      });
      throw error;
    }
  }

  /**
   * Setup event listeners for monitoring (ENHANCED)
   */
  private setupEventListeners(): void {
    // Original queue events
    this.queueEvents.on('completed', (jobId) => {
      logger.queue('Job completed', { jobId, queue: 'notification' });
    });

    this.queueEvents.on('failed', (jobId, err) => {
      logger.error('Job failed', new Error(err), { jobId, queue: 'notification' });
    });

    this.queueEvents.on('stalled', (jobId) => {
      logger.queue('Job stalled', { jobId, queue: 'notification' });
    });

    // Realtime queue events
    this.realtimeQueueEvents.on('completed', (jobId) => {
      logger.queue('Realtime job completed', { jobId, queue: 'realtime' });
    });

    this.realtimeQueueEvents.on('failed', (jobId, err) => {
      logger.error('Realtime job failed', new Error(err), { jobId, queue: 'realtime' });
    });

    this.realtimeQueueEvents.on('stalled', (jobId) => {
      logger.queue('Realtime job stalled', { jobId, queue: 'realtime' });
    });

    // Worker error events
    this.notificationWorker.on('error', (err) => {
      logger.error('Notification worker error:', err instanceof Error ? err : new Error(String(err)));
    });

    this.ruleExecutionWorker.on('error', (err) => {
      logger.error('Rule execution worker error:', err instanceof Error ? err : new Error(String(err)));
    });

    this.realtimeWorker.on('error', (err) => {
      logger.error('Realtime worker error:', err instanceof Error ? err : new Error(String(err)));
    });
  }

  /**
   * Get enhanced queue statistics
   */
  async getQueueStats(timeoutMs = 2500): Promise<{
    notification: any;
    ruleExecution: any;
    realtime: any;
  }> {
    const fetchStats = async () => {
      const [notificationStats, ruleExecutionStats, realtimeStats] = await Promise.all([
        this.notificationQueue.getJobCounts(),
        this.ruleExecutionQueue.getJobCounts(),
        this.realtimeQueue.getJobCounts(),
      ]);

      return {
        notification: notificationStats,
        ruleExecution: ruleExecutionStats,
        realtime: realtimeStats,
      };
    };

    return await Promise.race([
      fetchStats(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis operation timed out')), timeoutMs)
      ),
    ]);
  }

  /**
   * Pause all queues
   */
  async pauseQueues(): Promise<void> {
    await Promise.all([
      this.notificationQueue.pause(),
      this.ruleExecutionQueue.pause(),
      this.realtimeQueue.pause(),
    ]);
  }

  /**
   * Resume all queues
   */
  async resumeQueues(): Promise<void> {
    await Promise.all([
      this.notificationQueue.resume(),
      this.ruleExecutionQueue.resume(),
      this.realtimeQueue.resume(),
    ]);
  }

  /**
   * Graceful shutdown of the queue system (ENHANCED)
   */
  async shutdown(): Promise<void> {
    logger.queue('Shutting down enhanced notification queue...');
    
    try {
      await Promise.all([
        // Close QueueEvents first to stop receiving new events
        this.queueEvents.close(),
        this.realtimeQueueEvents.close(),
        
        // Force-close workers so they don't wait for ongoing jobs
        this.notificationWorker.close(true),
        this.ruleExecutionWorker.close(true),
        this.realtimeWorker.close(true),
        
        // Close queues (these are lightweight and resolve quickly)
        this.notificationQueue.close(),
        this.ruleExecutionQueue.close(),
        this.realtimeQueue.close(),
      ]);

      // Always disconnect Redis at the end
      try {
        this.redis.disconnect();
      } catch (redisError) {
        logger.warn('Redis disconnect error (ignored during shutdown):', { error: redisError });
      }

      logger.queue('Enhanced notification queue shutdown complete');
      
    } catch (error) {
      logger.error('Error during enhanced notification queue shutdown:', error instanceof Error ? error : new Error(String(error)));
    }
  }
}