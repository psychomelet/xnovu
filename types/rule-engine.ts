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
export type TriggerType = 'CRON';

// Trigger configuration interfaces
export interface CronTriggerConfig {
  cron: string;
  timezone?: string;
  enabled?: boolean;
}

export type TriggerConfig = CronTriggerConfig;

// Rule execution context
export interface RuleExecutionContext {
  ruleId: number;
  enterpriseId: string;
  businessId?: string;
  triggerType: TriggerType;
  triggerConfig: TriggerConfig;
  rulePayload?: any;
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

