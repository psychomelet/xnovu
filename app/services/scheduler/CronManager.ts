import * as cron from 'node-cron';
import type {
  NotificationRule,
  CronTriggerConfig,
  RuleJobData
} from '@/types/rule-engine';
import { CronValidationError, RuleEngineError } from '@/types/rule-engine';
import { RuleService } from '../database/RuleService';
import { NotificationQueue } from '../queue/NotificationQueue';

interface CronJob {
  ruleId: number;
  enterpriseId: string;
  cronExpression: string;
  timezone: string;
  task: cron.ScheduledTask;
  isRunning: boolean;
}

export class CronManager {
  private jobs = new Map<string, CronJob>();
  private ruleService: RuleService;
  private notificationQueue: NotificationQueue;
  private defaultTimezone: string;

  constructor(
    ruleService: RuleService,
    notificationQueue: NotificationQueue,
    defaultTimezone = 'UTC'
  ) {
    this.ruleService = ruleService;
    this.notificationQueue = notificationQueue;
    this.defaultTimezone = defaultTimezone;
  }

  /**
   * Initialize cron manager by loading all active cron rules
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing CronManager...');
      
      // Get all active cron rules across all enterprises
      const cronRules = await this.ruleService.getActiveCronRules();
      
      console.log(`Found ${cronRules.length} active cron rules`);

      // Schedule each rule
      for (const rule of cronRules) {
        try {
          await this.scheduleRule(rule);
        } catch (error) {
          console.error(`Failed to schedule rule ${rule.id}:`, error);
        }
      }

      console.log(`CronManager initialized with ${this.jobs.size} scheduled jobs`);
    } catch (error) {
      console.error('Failed to initialize CronManager:', error);
      throw error;
    }
  }

  /**
   * Schedule a single cron rule
   */
  async scheduleRule(rule: NotificationRule): Promise<void> {
    try {
      const jobKey = this.getJobKey(rule.id, rule.enterprise_id!);

      // Skip if already scheduled
      if (this.jobs.has(jobKey)) {
        console.log(`Rule ${rule.id} already scheduled, skipping`);
        return;
      }

      // Validate and parse trigger config
      const triggerConfig = this.parseCronTriggerConfig(rule);
      
      // Validate cron expression
      if (!cron.validate(triggerConfig.cron)) {
        throw new CronValidationError(triggerConfig.cron, rule.id);
      }

      // Create the cron job
      const task = cron.schedule(
        triggerConfig.cron,
        () => this.executeRule(rule),
        {
          scheduled: triggerConfig.enabled !== false,
          timezone: triggerConfig.timezone || this.defaultTimezone,
        }
      );

      // Store job reference
      const cronJob: CronJob = {
        ruleId: rule.id,
        enterpriseId: rule.enterprise_id!,
        cronExpression: triggerConfig.cron,
        timezone: triggerConfig.timezone || this.defaultTimezone,
        task,
        isRunning: false,
      };

      this.jobs.set(jobKey, cronJob);

      console.log(
        `Scheduled cron rule ${rule.id} (${rule.name}) with expression: ${triggerConfig.cron}`
      );
    } catch (error) {
      console.error(`Failed to schedule rule ${rule.id}:`, error);
      throw error;
    }
  }

  /**
   * Unschedule a cron rule
   */
  async unscheduleRule(ruleId: number, enterpriseId: string): Promise<void> {
    const jobKey = this.getJobKey(ruleId, enterpriseId);
    const job = this.jobs.get(jobKey);

    if (!job) {
      console.log(`Rule ${ruleId} not found in scheduled jobs`);
      return;
    }

    try {
      job.task.stop();
      this.jobs.delete(jobKey);

      console.log(`Unscheduled cron rule ${ruleId}`);
    } catch (error) {
      console.error(`Failed to unschedule rule ${ruleId}:`, error);
      throw error;
    }
  }

  /**
   * Update a cron rule (unschedule old, schedule new)
   */
  async updateRule(rule: NotificationRule): Promise<void> {
    await this.unscheduleRule(rule.id, rule.enterprise_id!);
    await this.scheduleRule(rule);
  }

  /**
   * Execute a cron rule by adding it to the queue
   */
  private async executeRule(rule: NotificationRule): Promise<void> {
    const jobKey = this.getJobKey(rule.id, rule.enterprise_id!);
    const job = this.jobs.get(jobKey);

    if (!job) {
      console.error(`Job not found for rule ${rule.id}`);
      return;
    }

    if (job.isRunning) {
      console.log(`Rule ${rule.id} is already running, skipping execution`);
      return;
    }

    try {
      job.isRunning = true;

      console.log(`Executing cron rule ${rule.id} (${rule.name})`);

      // Add rule execution job to queue
      const ruleJobData: RuleJobData = {
        ruleId: rule.id,
        enterpriseId: rule.enterprise_id!,
        triggerType: 'CRON',
        executionTime: new Date(),
      };

      await this.notificationQueue.addRuleExecutionJob(ruleJobData);

      console.log(`Added rule execution job for rule ${rule.id}`);
    } catch (error) {
      console.error(`Failed to execute rule ${rule.id}:`, error);
    } finally {
      job.isRunning = false;
    }
  }

  /**
   * Reload all cron rules (useful for configuration updates)
   */
  async reloadRules(enterpriseId?: string): Promise<void> {
    try {
      console.log(`Reloading cron rules${enterpriseId ? ` for enterprise ${enterpriseId}` : ''}`);

      // Stop and remove existing jobs
      if (enterpriseId) {
        // Remove jobs for specific enterprise
        const jobsToRemove = Array.from(this.jobs.entries())
          .filter(([_, job]) => job.enterpriseId === enterpriseId)
          .map(([key, job]) => ({ key, job }));

        for (const { key, job } of jobsToRemove) {
          job.task.stop();
          this.jobs.delete(key);
        }
      } else {
        // Remove all jobs
        for (const job of this.jobs.values()) {
          job.task.stop();
        }
        this.jobs.clear();
      }

      // Load and schedule new rules
      const cronRules = await this.ruleService.getActiveCronRules(enterpriseId);

      for (const rule of cronRules) {
        try {
          await this.scheduleRule(rule);
        } catch (error) {
          console.error(`Failed to schedule rule ${rule.id} during reload:`, error);
        }
      }

      console.log(`Reloaded ${cronRules.length} cron rules`);
    } catch (error) {
      console.error('Failed to reload cron rules:', error);
      throw error;
    }
  }

  /**
   * Get status of all scheduled jobs
   */
  getJobsStatus(): Array<{
    ruleId: number;
    enterpriseId: string;
    cronExpression: string;
    timezone: string;
    isRunning: boolean;
    isScheduled: boolean;
  }> {
    return Array.from(this.jobs.values()).map(job => ({
      ruleId: job.ruleId,
      enterpriseId: job.enterpriseId,
      cronExpression: job.cronExpression,
      timezone: job.timezone,
      isRunning: job.isRunning,
      isScheduled: true, // Assume scheduled if in jobs map
    }));
  }

  /**
   * Get next execution times for all jobs
   */
  getNextExecutions(): Array<{
    ruleId: number;
    enterpriseId: string;
    nextExecution: Date | null;
  }> {
    return Array.from(this.jobs.values()).map(job => {
      let nextExecution: Date | null = null;
      
      try {
        // This is a simplified approach - in production you might want to use a cron parser
        // to calculate the next execution time more accurately
        // For simplicity, assume next execution is in the next minute
        // In production, you'd use a proper cron parser to calculate accurate next execution
        nextExecution = new Date(Date.now() + 60000);
      } catch (error) {
        console.error(`Failed to calculate next execution for rule ${job.ruleId}:`, error);
      }

      return {
        ruleId: job.ruleId,
        enterpriseId: job.enterpriseId,
        nextExecution,
      };
    });
  }

  /**
   * Stop all cron jobs
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down CronManager...');

    for (const job of this.jobs.values()) {
      try {
        job.task.stop();
      } catch (error) {
        console.error(`Failed to stop job for rule ${job.ruleId}:`, error);
      }
    }

    this.jobs.clear();
    console.log('CronManager shutdown complete');
  }

  /**
   * Parse and validate cron trigger configuration
   */
  private parseCronTriggerConfig(rule: NotificationRule): CronTriggerConfig {
    if (!rule.trigger_config) {
      throw new RuleEngineError(
        `Missing trigger_config for rule ${rule.id}`,
        'INVALID_CONFIG',
        rule.id,
        rule.enterprise_id!
      );
    }

    const config = rule.trigger_config as any;

    if (!config.cron) {
      throw new RuleEngineError(
        `Missing cron expression in trigger_config for rule ${rule.id}`,
        'INVALID_CONFIG',
        rule.id,
        rule.enterprise_id!
      );
    }

    return {
      cron: config.cron,
      timezone: config.timezone || this.defaultTimezone,
      enabled: config.enabled !== false,
    };
  }

  /**
   * Generate job key for rule identification
   */
  private getJobKey(ruleId: number, enterpriseId: string): string {
    return `${enterpriseId}:${ruleId}`;
  }
}