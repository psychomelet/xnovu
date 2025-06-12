import { supabase as supabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];
type NotificationUpdate = Database['notify']['Tables']['ent_notification']['Update'];
type NotificationStatus = Database['shared_types']['Enums']['notification_status'];

export class NotificationService {
  private supabase = supabaseClient;

  async getNotification(id: number, enterpriseId: string): Promise<NotificationRow | null> {
    const { data, error } = await this.supabase
      .schema('notify')
      .from('ent_notification')
      .select(`
        *,
        ent_notification_workflow!inner(*),
        typ_notification_category(*),
        typ_notification_priority(*)
      `)
      .eq('id', id)
      .eq('enterprise_id', enterpriseId)
      .single();

    if (error) {
      throw new Error(`Failed to get notification: ${error.message}`);
    }

    return data;
  }

  async createNotification(notification: NotificationInsert): Promise<NotificationRow> {
    const { data, error } = await this.supabase
      .schema('notify')
      .from('ent_notification')
      .insert(notification)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return data;
  }

  async updateNotificationStatus(
    id: number,
    status: NotificationStatus,
    enterpriseId: string,
    errorMessage?: string,
    transactionId?: string
  ): Promise<void> {
    const updateData: NotificationUpdate = {
      notification_status: status,
      updated_at: new Date().toISOString(),
    };

    if (errorMessage) {
      updateData.error_details = errorMessage;
    }

    if (transactionId) {
      updateData.transaction_id = transactionId;
    }

    const { error } = await this.supabase
      .schema('notify')
      .from('ent_notification')
      .update(updateData)
      .eq('id', id)
      .eq('enterprise_id', enterpriseId);

    if (error) {
      throw new Error(`Failed to update notification status: ${error.message}`);
    }
  }

  async getNotificationsByStatus(
    status: NotificationStatus,
    enterpriseId: string,
    limit = 100
  ): Promise<NotificationRow[]> {
    const { data, error } = await this.supabase
      .schema('notify')
      .from('ent_notification')
      .select('*')
      .eq('notification_status', status)
      .eq('enterprise_id', enterpriseId)
      .limit(limit)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get notifications by status: ${error.message}`);
    }

    return data || [];
  }

  async cancelNotification(id: number, enterpriseId: string): Promise<void> {
    await this.updateNotificationStatus(id, 'RETRACTED', enterpriseId);
  }

  async getNotificationsByWorkflow(
    workflowId: number,
    enterpriseId: string,
    limit = 100
  ): Promise<NotificationRow[]> {
    const { data, error } = await this.supabase
      .schema('notify')
      .from('ent_notification')
      .select('*')
      .eq('notification_workflow_id', workflowId)
      .eq('enterprise_id', enterpriseId)
      .limit(limit)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get notifications by workflow: ${error.message}`);
    }

    return data || [];
  }
}

export const notificationService = new NotificationService();