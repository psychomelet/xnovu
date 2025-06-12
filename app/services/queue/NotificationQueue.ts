import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { Novu } from '@novu/api';
import type {
  NotificationJobData,
  RuleJobData,
  RuleEngineConfig,
} from '@/types/rule-engine';
import { RuleService } from '../database/RuleService';

export class NotificationQueue {
  private notificationQueue: Queue<NotificationJobData>;
  private ruleExecutionQueue: Queue<RuleJobData>;
  private notificationWorker: Worker<NotificationJobData>;
  private ruleExecutionWorker: Worker<RuleJobData>;
  private queueEvents: QueueEvents;
  private redis: IORedis;
  private ruleService: RuleService;
  private novu: Novu;

  constructor(config: RuleEngineConfig, ruleService: RuleService) {
    // Redis connection with BullMQ-specific configuration
    this.redis = new IORedis(config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null, // Required for BullMQ
      connectTimeout: 2000, // Fast fail for connection errors
    });

    // Initialize services
    this.ruleService = ruleService;
    this.novu = new Novu({ secretKey: process.env.NOVU_SECRET_KEY! });

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

    // Queue events for monitoring
    this.queueEvents = new QueueEvents('notification-processing', {
      connection: this.redis,
    });

    this.setupEventListeners();
  }

  /**
   * Add a notification job to the queue
   */
  async addNotificationJob(
    jobData: NotificationJobData,
    delay?: number
  ): Promise<void> {
    try {
      const jobOptions: any = {
        jobId: `notification-${jobData.notificationId}`,
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

      console.log(`Added notification job for notification ${jobData.notificationId}`);
    } catch (error) {
      console.error(`Failed to add notification job: ${error}`);
      throw error;
    }
  }

  /**
   * Add a rule execution job to the queue
   */
  async addRuleExecutionJob(
    jobData: RuleJobData,
    delay?: number
  ): Promise<void> {
    try {
      const jobOptions: any = {
        jobId: `rule-${jobData.ruleId}-${jobData.executionTime.getTime()}`,
      };

      if (delay) {
        jobOptions.delay = delay;
      }

      await this.ruleExecutionQueue.add(
        'execute-rule',
        jobData,
        jobOptions
      );

      console.log(`Added rule execution job for rule ${jobData.ruleId}`);
    } catch (error) {
      console.error(`Failed to add rule execution job: ${error}`);
      throw error;
    }
  }

  /**
   * Process notification job
   */
  private async processNotificationJob(job: any): Promise<void> {
    const data: NotificationJobData = job.data;

    try {
      console.log(`Processing notification ${data.notificationId}`);

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

      console.log(`Successfully processed notification ${data.notificationId}`);
    } catch (error) {
      console.error(`Failed to process notification ${data.notificationId}:`, error);

      // Update status to FAILED with error details
      await this.ruleService.updateNotificationStatus(
        data.notificationId,
        'FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() }
      );

      throw error;
    }
  }

  /**
   * Process rule execution job
   */
  private async processRuleExecutionJob(job: any): Promise<void> {
    const data: RuleJobData = job.data;

    try {
      console.log(`Executing rule ${data.ruleId} for enterprise ${data.enterpriseId}`);

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

      // For now, create a simple notification without code execution
      // The rule_payload contains the notification data and recipients
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

      console.log(`Successfully executed rule ${data.ruleId}, created notification ${notification.id}`);
    } catch (error) {
      console.error(`Failed to execute rule ${data.ruleId}:`, error);
      throw error;
    }
  }

  /**
   * Setup event listeners for monitoring
   */
  private setupEventListeners(): void {
    this.queueEvents.on('completed', (jobId) => {
      console.log(`Job ${jobId} completed successfully`);
    });

    this.queueEvents.on('failed', (jobId, err) => {
      console.error(`Job ${jobId} failed:`, err);
    });

    this.queueEvents.on('stalled', (jobId) => {
      console.warn(`Job ${jobId} stalled`);
    });

    this.notificationWorker.on('error', (err) => {
      console.error('Notification worker error:', err);
    });

    this.ruleExecutionWorker.on('error', (err) => {
      console.error('Rule execution worker error:', err);
    });
  }

  /**
   * Retrieve basic queue statistics. When Redis is unreachable this call
   * can otherwise take a long time while BullMQ retries the connection.
   * A safeguard timeout is therefore added to fail fast in such scenarios –
   * especially important for the test suite that purposefully injects an
   * invalid Redis host.
   */
  async getQueueStats(timeoutMs = 2500): Promise<{
    notification: any;
    ruleExecution: any;
  }> {
    // Helper that actually queries BullMQ
    const fetchStats = async () => {
      const [notificationStats, ruleExecutionStats] = await Promise.all([
        this.notificationQueue.getJobCounts(),
        this.ruleExecutionQueue.getJobCounts(),
      ]);

      return {
        notification: notificationStats,
        ruleExecution: ruleExecutionStats,
      };
    };

    // Race the Redis operation against a timeout to avoid hanging
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
    ]);
  }

  /**
   * Resume all queues
   */
  async resumeQueues(): Promise<void> {
    await Promise.all([
      this.notificationQueue.resume(),
      this.ruleExecutionQueue.resume(),
    ]);
  }

  /**
   * Graceful shutdown of the queue system
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down notification queue...');
    try {
      await Promise.all([
        // Close QueueEvents first to stop receiving new events
        this.queueEvents.close(),
        // Force-close workers so they don't wait for ongoing jobs
        this.notificationWorker.close(true),
        this.ruleExecutionWorker.close(true),
        // Close queues (these are lightweight and resolve quickly)
        this.notificationQueue.close(),
        this.ruleExecutionQueue.close(),
      ]);

      // Always disconnect Redis at the end regardless of its current status.
      //  Using disconnect() (vs quit()) prevents waiting for pending commands
      //  which is important for test environments where the server may be
      //  unreachable (e.g. when intentionally providing an invalid host).
      try {
        this.redis.disconnect();
      } catch (redisError) {
        // Swallow any errors – we're in shutdown path and can't do much.
        console.warn('Redis disconnect error (ignored during shutdown):', redisError);
      }

      console.log('Notification queue shutdown complete.');
    } catch (error) {
      console.error('Error during notification queue shutdown:', error);
      // Do not rethrow, to allow other shutdown processes to complete
    }
  }
}