import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { Novu } from '@novu/api';
import type {
  NotificationJobData,
  RuleJobData,
  RuleEngineConfig,
  RuleEngineError
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

  constructor(config: RuleEngineConfig) {
    // Redis connection
    this.redis = new IORedis(config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Initialize services
    this.ruleService = new RuleService();
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
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    notification: any;
    ruleExecution: any;
  }> {
    const [notificationStats, ruleExecutionStats] = await Promise.all([
      this.notificationQueue.getJobCounts(),
      this.ruleExecutionQueue.getJobCounts(),
    ]);

    return {
      notification: notificationStats,
      ruleExecution: ruleExecutionStats,
    };
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
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down notification queue...');
    
    await Promise.all([
      this.notificationWorker.close(),
      this.ruleExecutionWorker.close(),
      this.queueEvents.close(),
    ]);

    await this.redis.quit();
    console.log('Notification queue shutdown complete');
  }
}