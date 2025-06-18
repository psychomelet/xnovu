import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type {
  NotificationRule,
  Notification,
  NotificationInsert,
  NotificationUpdate,
} from '@/types/rule-engine';
import { RuleEngineError } from '@/types/rule-engine';

export class RuleService {
  private supabase;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = createClient<Database>(
      supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Get all active rules for a specific enterprise
   */
  async getActiveRules(enterpriseId: string): Promise<NotificationRule[]> {
    try {
      const { data, error } = await this.supabase
        .schema('notify')
        .from('ent_notification_rule')
        .select(`
          *,
          ent_notification_workflow!inner(*)
        `)
        .eq('enterprise_id', enterpriseId)
        .eq('publish_status', 'PUBLISH')
        .eq('deactivated', false)
        .eq('ent_notification_workflow.publish_status', 'PUBLISH')
        .eq('ent_notification_workflow.deactivated', false);

      if (error) {
        throw new RuleEngineError(
          `Failed to fetch active rules: ${error.message}`,
          'DATABASE_ERROR',
          undefined,
          enterpriseId
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof RuleEngineError) {
        throw error;
      }
      throw new RuleEngineError(
        `Unexpected error fetching rules: ${error}`,
        'UNKNOWN_ERROR',
        undefined,
        enterpriseId
      );
    }
  }

  /**
   * Get active cron-based rules
   */
  async getActiveCronRules(enterpriseId?: string): Promise<NotificationRule[]> {
    try {
      let query = this.supabase
        .schema('notify')
        .from('ent_notification_rule')
        .select(`
          *,
          ent_notification_workflow!inner(*)
        `)
        .eq('trigger_type', 'CRON')
        .eq('publish_status', 'PUBLISH')
        .eq('deactivated', false)
        .eq('ent_notification_workflow.publish_status', 'PUBLISH')
        .eq('ent_notification_workflow.deactivated', false);

      if (enterpriseId) {
        query = query.eq('enterprise_id', enterpriseId);
      }

      const { data, error } = await query;

      if (error) {
        throw new RuleEngineError(
          `Failed to fetch cron rules: ${error.message}`,
          'DATABASE_ERROR',
          undefined,
          enterpriseId
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof RuleEngineError) {
        throw error;
      }
      throw new RuleEngineError(
        `Unexpected error fetching cron rules: ${error}`,
        'UNKNOWN_ERROR',
        undefined,
        enterpriseId
      );
    }
  }

  /**
   * Get a specific rule by ID
   */
  async getRule(ruleId: number, enterpriseId: string): Promise<NotificationRule | null> {
    try {
      const { data, error } = await this.supabase
        .schema('notify')
        .from('ent_notification_rule')
        .select(`
          *,
          ent_notification_workflow(*)
        `)
        .eq('id', ruleId)
        .eq('enterprise_id', enterpriseId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw new RuleEngineError(
          `Failed to fetch rule: ${error.message}`,
          'DATABASE_ERROR',
          ruleId,
          enterpriseId
        );
      }

      return data || null;
    } catch (error) {
      if (error instanceof RuleEngineError) {
        throw error;
      }
      throw new RuleEngineError(
        `Unexpected error fetching rule: ${error}`,
        'UNKNOWN_ERROR',
        ruleId,
        enterpriseId
      );
    }
  }

  /**
   * Get notifications scheduled for the future
   */
  async getScheduledNotifications(beforeTime?: Date): Promise<Notification[]> {
    try {
      let query = this.supabase
        .schema('notify')
        .from('ent_notification')
        .select(`
          *,
          ent_notification_workflow!inner(*)
        `)
        .eq('notification_status', 'PENDING')
        .not('scheduled_for', 'is', null);

      if (beforeTime) {
        query = query.lte('scheduled_for', beforeTime.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw new RuleEngineError(
          `Failed to fetch scheduled notifications: ${error.message}`,
          'DATABASE_ERROR'
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof RuleEngineError) {
        throw error;
      }
      throw new RuleEngineError(
        `Unexpected error fetching scheduled notifications: ${error}`,
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Create a new notification
   */
  async createNotification(notification: NotificationInsert): Promise<Notification> {
    try {
      const { data, error } = await this.supabase
        .schema('notify')
        .from('ent_notification')
        .insert(notification)
        .select()
        .single();

      if (error) {
        throw new RuleEngineError(
          `Failed to create notification: ${error.message}`,
          'DATABASE_ERROR',
          notification.notification_rule_id || undefined,
          notification.enterprise_id || undefined
        );
      }

      return data;
    } catch (error) {
      if (error instanceof RuleEngineError) {
        throw error;
      }
      throw new RuleEngineError(
        `Unexpected error creating notification: ${error}`,
        'UNKNOWN_ERROR',
        notification.notification_rule_id || undefined,
        notification.enterprise_id || undefined
      );
    }
  }

  /**
   * Update notification status
   */
  async updateNotificationStatus(
    notificationId: number,
    status: Database['shared_types']['Enums']['notification_status'],
    errorDetails?: any,
    transactionId?: string
  ): Promise<void> {
    try {
      const updates: NotificationUpdate = {
        notification_status: status
      };

      if (status === 'PROCESSING') {
        updates.processed_at = new Date().toISOString();
      }

      if (status === 'FAILED' && errorDetails) {
        updates.error_details = errorDetails;
      }

      if (transactionId) {
        updates.transaction_id = transactionId;
      }

      const { error } = await this.supabase
        .schema('notify')
        .from('ent_notification')
        .update(updates)
        .eq('id', notificationId);

      if (error) {
        throw new RuleEngineError(
          `Failed to update notification status: ${error.message}`,
          'DATABASE_ERROR',
          undefined,
          undefined
        );
      }
    } catch (error) {
      if (error instanceof RuleEngineError) {
        throw error;
      }
      throw new RuleEngineError(
        `Unexpected error updating notification status: ${error}`,
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: number, enterpriseId: string) {
    try {
      // First try enterprise-specific workflow lookup
      const { data, error } = await this.supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .select('*')
        .eq('id', workflowId)
        .eq('enterprise_id', enterpriseId)
        .eq('publish_status', 'PUBLISH')
        .eq('deactivated', false)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new RuleEngineError(
          `Failed to fetch workflow: ${error.message}`,
          'DATABASE_ERROR',
          undefined,
          enterpriseId
        );
      }

      // If found, return it
      if (data) {
        return data;
      }

      // If not found, try global workflow lookup (null enterprise_id)
      const { data: globalData, error: globalError } = await this.supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .select('*')
        .eq('id', workflowId)
        .is('enterprise_id', null)
        .eq('publish_status', 'PUBLISH')
        .eq('deactivated', false)
        .single();

      if (globalError && globalError.code !== 'PGRST116') {
        throw new RuleEngineError(
          `Failed to fetch global workflow: ${globalError.message}`,
          'DATABASE_ERROR',
          undefined,
          enterpriseId
        );
      }

      return globalData || null;
    } catch (error) {
      if (error instanceof RuleEngineError) {
        throw error;
      }
      throw new RuleEngineError(
        `Unexpected error fetching workflow: ${error}`,
        'UNKNOWN_ERROR',
        undefined,
        enterpriseId
      );
    }
  }

  /**
   * Batch update notification statuses
   */
  async batchUpdateNotificationStatus(
    notificationIds: number[],
    status: Database['shared_types']['Enums']['notification_status'],
    errorDetails?: any
  ): Promise<void> {
    try {
      const updates: NotificationUpdate = {
        notification_status: status
      };

      if (status === 'PROCESSING') {
        updates.processed_at = new Date().toISOString();
      }

      if (status === 'FAILED' && errorDetails) {
        updates.error_details = errorDetails;
      }

      const { error } = await this.supabase
        .schema('notify')
        .from('ent_notification')
        .update(updates)
        .in('id', notificationIds);

      if (error) {
        throw new RuleEngineError(
          `Failed to batch update notification statuses: ${error.message}`,
          'DATABASE_ERROR'
        );
      }
    } catch (error) {
      if (error instanceof RuleEngineError) {
        throw error;
      }
      throw new RuleEngineError(
        `Unexpected error batch updating notification statuses: ${error}`,
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Get rules updated after a specific timestamp
   */
  async getRulesUpdatedAfter(timestamp: Date, limit: number = 100, enterpriseId?: string): Promise<NotificationRule[]> {
    try {
      let query = this.supabase
        .schema('notify')
        .from('ent_notification_rule')
        .select(`
          *,
          ent_notification_workflow!inner(*)
        `)
        .gt('updated_at', timestamp.toISOString())
        .eq('trigger_type', 'CRON')
        .order('updated_at', { ascending: true })
        .limit(limit);

      if (enterpriseId) {
        query = query.eq('enterprise_id', enterpriseId);
      }

      const { data, error } = await query;

      if (error) {
        throw new RuleEngineError(
          `Failed to fetch updated rules: ${error.message}`,
          'DATABASE_ERROR',
          undefined,
          enterpriseId
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof RuleEngineError) {
        throw error;
      }
      throw new RuleEngineError(
        `Unexpected error fetching updated rules: ${error}`,
        'UNKNOWN_ERROR',
        undefined,
        enterpriseId
      );
    }
  }

  /**
   * Get the timestamp of the most recently updated rule
   */
  async getLastRuleUpdateTime(enterpriseId?: string): Promise<Date | null> {
    try {
      let query = this.supabase
        .schema('notify')
        .from('ent_notification_rule')
        .select('updated_at')
        .eq('trigger_type', 'CRON')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (enterpriseId) {
        query = query.eq('enterprise_id', enterpriseId);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw new RuleEngineError(
          `Failed to fetch last update time: ${error.message}`,
          'DATABASE_ERROR',
          undefined,
          enterpriseId
        );
      }

      return data ? new Date(data.updated_at) : null;
    } catch (error) {
      if (error instanceof RuleEngineError) {
        throw error;
      }
      throw new RuleEngineError(
        `Unexpected error fetching last update time: ${error}`,
        'UNKNOWN_ERROR',
        undefined,
        enterpriseId
      );
    }
  }

  /**
   * Get all active rules for initial sync
   */
  async getAllActiveRules(enterpriseId?: string): Promise<NotificationRule[]> {
    try {
      let query = this.supabase
        .schema('notify')
        .from('ent_notification_rule')
        .select(`
          *,
          ent_notification_workflow!inner(*)
        `)
        .eq('trigger_type', 'CRON')
        .eq('publish_status', 'PUBLISH')
        .eq('deactivated', false)
        .eq('ent_notification_workflow.publish_status', 'PUBLISH')
        .eq('ent_notification_workflow.deactivated', false);

      if (enterpriseId) {
        query = query.eq('enterprise_id', enterpriseId);
      }

      const { data, error } = await query;

      if (error) {
        throw new RuleEngineError(
          `Failed to fetch all active rules: ${error.message}`,
          'DATABASE_ERROR',
          undefined,
          enterpriseId
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof RuleEngineError) {
        throw error;
      }
      throw new RuleEngineError(
        `Unexpected error fetching all active rules: ${error}`,
        'UNKNOWN_ERROR',
        undefined,
        enterpriseId
      );
    }
  }

  /**
   * Gracefully shut down the service and its connections
   */
  async shutdown(): Promise<void> {
    try {
      // Supabase JS client v2 does not have a dedicated method to close
      // connections, as it's designed for serverless environments.
      console.log('Shutting down RuleService...');
      // No realtime connections to disconnect - using polling pattern now
      console.log('RuleService shutdown complete.');
    } catch (error) {
      console.error('Error during RuleService shutdown:', error);
    }
  }
}