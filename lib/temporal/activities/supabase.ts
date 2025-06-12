import { Context } from '@temporalio/activity'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import type { 
  Notification, 
  NotificationWorkflow,
  NotificationRule 
} from '@/types/rule-engine'

export interface PollConfig {
  enterpriseIds: string[]
  since: number
  limit?: number
}

export interface NotificationData {
  id: number
  enterpriseId: string
  workflowId: number
  payload: any
  recipients: string[]
  overrides?: any
  status: string
  createdAt: string
}

export interface WorkflowConfig {
  id: number
  key: string
  type: 'static' | 'dynamic'
  name: string
  description?: string
  configuration?: any
}

export interface Template {
  id: number
  workflowId: number
  channel: string
  content: any
  metadata?: any
}

// Poll for new notifications
export async function pollSupabaseNotifications(
  config: PollConfig
): Promise<NotificationData[]> {
  const { enterpriseIds, since, limit = 100 } = config
  
  Context.current().heartbeat()
  
  const timestamp = new Date(since).toISOString()
  
  const { data, error } = await supabase
    .schema('notify')
    .from('ent_notification')
    .select('*')
    .in('enterprise_id', enterpriseIds)
    .gt('created_at', timestamp)
    .eq('notification_status', 'PENDING')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to poll notifications: ${error.message}`)
  }

  return (data || []).map(notification => ({
    id: notification.id,
    enterpriseId: notification.enterprise_id || '',
    workflowId: notification.notification_workflow_id,
    payload: notification.payload,
    recipients: notification.recipients || [],
    overrides: notification.overrides || {},
    status: notification.notification_status || 'PENDING',
    createdAt: notification.created_at
  }))
}

// Fetch workflow configuration
export async function fetchWorkflowConfig(
  workflowId: number
): Promise<WorkflowConfig> {
  Context.current().heartbeat()
  
  const { data, error } = await supabase
    .schema('notify')
    .from('ent_notification_workflow')
    .select('*')
    .eq('id', workflowId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch workflow config: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Workflow not found: ${workflowId}`)
  }

  return {
    id: data.id,
    key: data.workflow_key,
    type: data.type,
    name: data.name,
    description: data.description || undefined,
    configuration: data.configuration
  }
}

// Fetch templates for dynamic workflows
export async function fetchTemplates(
  workflowId: number
): Promise<Template[]> {
  Context.current().heartbeat()
  
  const { data, error } = await supabase
    .schema('notify')
    .from('ent_notification_template')
    .select('*')
    .eq('notification_workflow_id', workflowId)
    .eq('is_active', true)

  if (error) {
    throw new Error(`Failed to fetch templates: ${error.message}`)
  }

  return (data || []).map(template => ({
    id: template.id,
    workflowId: template.notification_workflow_id,
    channel: template.channel,
    content: template.content,
    metadata: template.metadata
  }))
}

// Update notification status
export async function updateNotificationStatus(
  notificationId: number,
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRACTED' | 'pending' | 'processing' | 'completed' | 'failed' | 'scheduled',
  error?: string
): Promise<void> {
  Context.current().heartbeat()
  
  const update: any = {
    status,
    updated_at: new Date().toISOString()
  }

  if (status === 'completed') {
    update.completed_at = new Date().toISOString()
  }

  if (error) {
    update.error = error
  }

  const { error: updateError } = await supabase
    .schema('notify')
    .from('ent_notification')
    .update(update)
    .eq('id', notificationId)

  if (updateError) {
    throw new Error(`Failed to update notification status: ${updateError.message}`)
  }
}

// Fetch active cron rules
export async function fetchActiveCronRules(): Promise<NotificationRule[]> {
  Context.current().heartbeat()
  
  const { data, error } = await supabase
    .schema('notify')
    .from('ent_notification_rule')
    .select('*')
    .eq('trigger_type', 'CRON')
    .eq('is_active', true)

  if (error) {
    throw new Error(`Failed to fetch cron rules: ${error.message}`)
  }

  return data || []
}

// Fetch scheduled notifications
export async function fetchScheduledNotifications(
  batchSize: number = 100
): Promise<Notification[]> {
  Context.current().heartbeat()
  
  const now = new Date().toISOString()
  
  const { data, error } = await supabase
    .schema('notify')
    .from('ent_notification')
    .select('*')
    .eq('notification_status', 'PENDING')
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(batchSize)

  if (error) {
    throw new Error(`Failed to fetch scheduled notifications: ${error.message}`)
  }

  return data || []
}

// Record notification as processed
export async function recordNotificationProcessed(
  notificationId: number
): Promise<void> {
  await updateNotificationStatus(notificationId, 'completed')
}

// Record notification error
export async function recordNotificationError(
  notificationId: number,
  error: string
): Promise<void> {
  await updateNotificationStatus(notificationId, 'failed', error)
}