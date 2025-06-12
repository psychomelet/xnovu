import type { Database } from '@/lib/supabase/database.types';

// Database types
export type NotificationRule = Database['notify']['Tables']['ent_notification_rule']['Row'];
export type NotificationRuleInsert = Database['notify']['Tables']['ent_notification_rule']['Insert'];
export type NotificationRuleUpdate = Database['notify']['Tables']['ent_notification_rule']['Update'];

export type Notification = Database['notify']['Tables']['ent_notification']['Row'];
export type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];
export type NotificationUpdate = Database['notify']['Tables']['ent_notification']['Update'];

export type NotificationWorkflow = Database['notify']['Tables']['ent_notification_workflow']['Row'];

// Trigger types
export type TriggerType = 'CRON' | 'SCHEDULE';

// Trigger configuration interfaces
export interface CronTriggerConfig {
  cron: string;
  timezone?: string;
  enabled?: boolean;
}

export interface ScheduleTriggerConfig {
  schedule_time: string; // ISO string
  timezone?: string;
}

export type TriggerConfig = CronTriggerConfig | ScheduleTriggerConfig;

// Rule execution context
export interface RuleExecutionContext {
  ruleId: number;
  enterpriseId: string;
  businessId?: string;
  triggerType: TriggerType;
  triggerConfig: TriggerConfig;
  rulePayload?: any;
}

// Queue job data
export interface NotificationJobData {
  notificationId: number;
  ruleId?: number;
  enterpriseId: string;
  workflowId: string;
  recipients: string[];
  payload: any;
  overrides?: any;
  scheduledFor?: Date;
}

export interface RuleJobData {
  ruleId: number;
  enterpriseId: string;
  triggerType: TriggerType;
  executionTime: Date;
}

export interface RealtimeJobData {
  type: 'realtime-insert' | 'realtime-update' | 'realtime-delete';
  enterpriseId: string;
  notificationId: number;
  payload: any;
  oldPayload?: any; // For updates
  timestamp: Date;
  eventId: string;
}

// Service interfaces
export interface RuleEngineConfig {
  redisUrl?: string;
  defaultTimezone: string;
  maxConcurrentJobs: number;
  jobRetryAttempts: number;
  jobRetryDelay: number;
  scheduledNotificationInterval: number;
  scheduledNotificationBatchSize: number;
}

// Error types
export class RuleEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public ruleId?: number,
    public enterpriseId?: string
  ) {
    super(message);
    this.name = 'RuleEngineError';
  }
}

export class CronValidationError extends RuleEngineError {
  constructor(cronExpression: string, ruleId?: number) {
    super(
      `Invalid cron expression: ${cronExpression}`,
      'INVALID_CRON',
      ruleId
    );
    this.name = 'CronValidationError';
  }
}

export class ScheduleValidationError extends RuleEngineError {
  constructor(scheduleTime: string, ruleId?: number) {
    super(
      `Invalid schedule time: ${scheduleTime}`,
      'INVALID_SCHEDULE',
      ruleId
    );
    this.name = 'ScheduleValidationError';
  }
}