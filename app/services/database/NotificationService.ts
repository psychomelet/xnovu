import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Notification = Database['public']['Tables']['ent_notification']['Row']
type NotificationInsert = Database['public']['Tables']['ent_notification']['Insert']
type NotificationUpdate = Database['public']['Tables']['ent_notification']['Update']
type NotificationStatus = Notification['status']

export class NotificationService {
  /**
   * Get a single notification by ID
   */
  static async getNotification(
    notificationId: string,
    enterpriseId: string
  ): Promise<Notification | null> {
    const { data, error } = await supabase
      .from('ent_notification')
      .select('*')
      .eq('id', notificationId)
      .eq('enterprise_id', enterpriseId)
      .single()

    if (error) {
      console.error('Error fetching notification:', error)
      return null
    }

    return data
  }

  /**
   * Get all notifications for an enterprise
   */
  static async getNotifications(
    enterpriseId: string,
    filters?: {
      status?: NotificationStatus
      workflow_key?: string
      subscriber_id?: string
      limit?: number
      offset?: number
    }
  ): Promise<Notification[]> {
    let query = supabase
      .from('ent_notification')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.workflow_key) {
      query = query.eq('workflow_key', filters.workflow_key)
    }

    if (filters?.subscriber_id) {
      query = query.eq('subscriber_id', filters.subscriber_id)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching notifications:', error)
      return []
    }

    return data || []
  }

  /**
   * Create a new notification
   */
  static async createNotification(
    notification: NotificationInsert
  ): Promise<Notification | null> {
    const { data, error } = await supabase
      .from('ent_notification')
      .insert(notification)
      .select()
      .single()

    if (error) {
      console.error('Error creating notification:', error)
      return null
    }

    return data
  }

  /**
   * Update notification status
   */
  static async updateNotificationStatus(
    notificationId: string,
    enterpriseId: string,
    status: NotificationStatus,
    errorDetails?: string,
    transactionId?: string
  ): Promise<Notification | null> {
    const update: NotificationUpdate = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (errorDetails) {
      update.error_details = errorDetails
    }

    if (transactionId) {
      update.transaction_id = transactionId
    }

    const { data, error } = await supabase
      .from('ent_notification')
      .update(update)
      .eq('id', notificationId)
      .eq('enterprise_id', enterpriseId)
      .select()
      .single()

    if (error) {
      console.error('Error updating notification status:', error)
      return null
    }

    return data
  }

  /**
   * Cancel a notification (update status to RETRACTED)
   */
  static async cancelNotification(
    notificationId: string,
    enterpriseId: string
  ): Promise<Notification | null> {
    return this.updateNotificationStatus(
      notificationId,
      enterpriseId,
      'RETRACTED'
    )
  }

  /**
   * Bulk create notifications
   */
  static async bulkCreateNotifications(
    notifications: NotificationInsert[]
  ): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('ent_notification')
      .insert(notifications)
      .select()

    if (error) {
      console.error('Error bulk creating notifications:', error)
      return []
    }

    return data || []
  }

  /**
   * Get notifications by transaction ID
   */
  static async getNotificationByTransactionId(
    transactionId: string,
    enterpriseId: string
  ): Promise<Notification | null> {
    const { data, error } = await supabase
      .from('ent_notification')
      .select('*')
      .eq('transaction_id', transactionId)
      .eq('enterprise_id', enterpriseId)
      .single()

    if (error) {
      console.error('Error fetching notification by transaction ID:', error)
      return null
    }

    return data
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(
    enterpriseId: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    total: number
    byStatus: Record<NotificationStatus, number>
    byWorkflow: Record<string, number>
  }> {
    let query = supabase
      .from('ent_notification')
      .select('status, workflow_key')
      .eq('enterprise_id', enterpriseId)

    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching notification stats:', error)
      return {
        total: 0,
        byStatus: {
          PENDING: 0,
          PROCESSING: 0,
          SENT: 0,
          FAILED: 0,
          RETRACTED: 0,
        },
        byWorkflow: {},
      }
    }

    const stats = {
      total: data?.length || 0,
      byStatus: {
        PENDING: 0,
        PROCESSING: 0,
        SENT: 0,
        FAILED: 0,
        RETRACTED: 0,
      } as Record<NotificationStatus, number>,
      byWorkflow: {} as Record<string, number>,
    }

    data?.forEach((notification) => {
      stats.byStatus[notification.status as NotificationStatus]++
      stats.byWorkflow[notification.workflow_key] = 
        (stats.byWorkflow[notification.workflow_key] || 0) + 1
    })

    return stats
  }
}