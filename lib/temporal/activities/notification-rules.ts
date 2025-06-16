import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'
import { triggerNotificationById } from '@/lib/notifications/trigger'
import { CronTriggerConfig } from '@/types/rule-engine'

type NotificationRule = Database['notify']['Tables']['ent_notification_rule']['Row']
type NotificationInsert = Database['notify']['Tables']['ent_notification_rule']['Insert']

export interface RunNotificationRuleParams {
  ruleId: number
  enterpriseId: string
  businessId?: string
}

/**
 * Run a single notification rule by creating a notification and triggering it
 */
export async function runNotificationRule(params: RunNotificationRuleParams): Promise<void> {
  const { ruleId, enterpriseId, businessId } = params
  
  // Fetch the rule with its workflow
  const { data: rule, error: ruleError } = await supabase
    .schema('notify')
    .from('ent_notification_rule')
    .select(`
      *,
      ent_notification_workflow!inner(*)
    `)
    .eq('id', ruleId)
    .eq('enterprise_id', enterpriseId)
    .single()

  if (ruleError || !rule) {
    throw new Error(`Failed to fetch rule ${ruleId}: ${ruleError?.message || 'Rule not found'}`)
  }

  // Validate rule is active
  if (rule.deactivated || rule.publish_status !== 'PUBLISH') {
    throw new Error(`Rule ${ruleId} is not active`)
  }

  // Validate trigger type
  if (rule.trigger_type !== 'CRON') {
    throw new Error(`Rule ${ruleId} has unsupported trigger type: ${rule.trigger_type}`)
  }

  // Parse trigger config
  const triggerConfig = rule.trigger_config as unknown as CronTriggerConfig
  if (!triggerConfig?.cron) {
    throw new Error(`Rule ${ruleId} has invalid cron configuration`)
  }

  // Get the workflow
  const workflow = rule.ent_notification_workflow
  if (!workflow) {
    throw new Error(`Workflow not found for rule ${ruleId}`)
  }

  // Create a notification from the rule
  const notificationPayload = {
    name: `${rule.name} - ${new Date().toISOString()}`,
    description: rule.description,
    notification_workflow_id: rule.notification_workflow_id,
    enterprise_id: enterpriseId,
    business_id: businessId || rule.business_id,
    payload: rule.rule_payload || {},
    recipients: [], // Will be determined by the workflow
    notification_status: 'PENDING' as const,
  }

  const { data: notification, error: notificationError } = await supabase
    .schema('notify')
    .from('ent_notification')
    .insert(notificationPayload)
    .select()
    .single()

  if (notificationError || !notification) {
    throw new Error(`Failed to create notification: ${notificationError?.message}`)
  }

  // Trigger the notification
  try {
    const result = await triggerNotificationById(notification.id)
    if (!result.success) {
      throw new Error(result.error || 'Failed to trigger notification')
    }
  } catch (error) {
    // Update notification status to failed
    await supabase
      .schema('notify')
      .from('ent_notification')
      .update({ notification_status: 'FAILED' })
      .eq('id', notification.id)
    
    throw error
  }
}

/**
 * Fetch all active CRON rules for syncing with Temporal
 */
export async function fetchAllCronRules(enterpriseId?: string): Promise<NotificationRule[]> {
  let query = supabase
    .schema('notify')
    .from('ent_notification_rule')
    .select('*')
    .eq('trigger_type', 'CRON')
    .eq('publish_status', 'PUBLISH')
    .eq('deactivated', false)

  if (enterpriseId) {
    query = query.eq('enterprise_id', enterpriseId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch CRON rules: ${error.message}`)
  }

  return data || []
}