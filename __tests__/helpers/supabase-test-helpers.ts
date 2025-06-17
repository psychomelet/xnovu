import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { v4 as uuidv4 } from 'uuid'

// Create Supabase client for tests
export function createTestSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials for tests')
  }

  return createClient<Database>(supabaseUrl, supabaseKey)
}

// Test data factories
export function createTestWorkflow(overrides?: Partial<Database['notify']['Tables']['ent_notification_workflow']['Insert']>) {
  return {
    name: `Test Workflow ${uuidv4()}`,
    workflow_key: `test-workflow-${uuidv4()}`,
    workflow_type: 'STATIC' as const,
    default_channels: ['IN_APP'] as Database['shared_types']['Enums']['notification_channel_type'][],
    enterprise_id: `test-ent-${uuidv4()}`,
    publish_status: 'PUBLISH' as const,
    deactivated: false,
    ...overrides,
  }
}

export function createTestRule(
  workflowId: number,
  overrides?: Partial<Database['notify']['Tables']['ent_notification_rule']['Insert']>
) {
  return {
    name: `Test Rule ${uuidv4()}`,
    notification_workflow_id: workflowId,
    trigger_type: 'CRON',
    trigger_config: {
      cron: '0 9 * * MON',
      timezone: 'UTC',
    },
    rule_payload: {
      recipients: [`user-${uuidv4()}`],
      test: true,
    },
    enterprise_id: overrides?.enterprise_id || `test-ent-${uuidv4()}`,
    business_id: overrides?.business_id || `test-biz-${uuidv4()}`,
    publish_status: 'PUBLISH' as const,
    deactivated: false,
    ...overrides,
  }
}

export function createTestNotification(
  workflowId: number,
  overrides?: Partial<Database['notify']['Tables']['ent_notification']['Insert']>
) {
  return {
    name: `Test Notification ${uuidv4()}`,
    notification_workflow_id: workflowId,
    payload: { test: true },
    recipients: [`user-${uuidv4()}`],
    enterprise_id: overrides?.enterprise_id || `test-ent-${uuidv4()}`,
    notification_status: 'PENDING' as const,
    publish_status: 'PUBLISH' as const,
    ...overrides,
  }
}

// Cleanup helpers
export async function cleanupTestWorkflows(supabase: ReturnType<typeof createTestSupabaseClient>, enterpriseIds: string[]) {
  if (enterpriseIds.length === 0) return

  const { error } = await supabase
    .schema('notify')
    .from('ent_notification_workflow')
    .delete()
    .in('enterprise_id', enterpriseIds)

  if (error) {
    console.error('Failed to cleanup test workflows:', error)
  }
}

export async function cleanupTestRules(supabase: ReturnType<typeof createTestSupabaseClient>, enterpriseIds: string[]) {
  if (enterpriseIds.length === 0) return

  const { error } = await supabase
    .schema('notify')
    .from('ent_notification_rule')
    .delete()
    .in('enterprise_id', enterpriseIds)

  if (error) {
    console.error('Failed to cleanup test rules:', error)
  }
}

export async function cleanupTestNotifications(supabase: ReturnType<typeof createTestSupabaseClient>, enterpriseIds: string[]) {
  if (enterpriseIds.length === 0) return

  const { error } = await supabase
    .schema('notify')
    .from('ent_notification')
    .delete()
    .in('enterprise_id', enterpriseIds)

  if (error) {
    console.error('Failed to cleanup test notifications:', error)
  }
}

// Test setup helpers
export async function setupTestWorkflowWithRule(
  supabase: ReturnType<typeof createTestSupabaseClient>,
  workflowOverrides?: Partial<Database['notify']['Tables']['ent_notification_workflow']['Insert']>,
  ruleOverrides?: Partial<Database['notify']['Tables']['ent_notification_rule']['Insert']>
) {
  // Create workflow
  const workflowData = createTestWorkflow(workflowOverrides)
  const { data: workflow, error: workflowError } = await supabase
    .schema('notify')
    .from('ent_notification_workflow')
    .insert(workflowData)
    .select()
    .single()

  if (workflowError || !workflow) {
    throw new Error(`Failed to create test workflow: ${workflowError?.message}`)
  }

  // Create rule
  const ruleData = createTestRule(workflow.id, {
    enterprise_id: workflow.enterprise_id,
    ...ruleOverrides,
  })
  const { data: rule, error: ruleError } = await supabase
    .schema('notify')
    .from('ent_notification_rule')
    .insert(ruleData)
    .select()
    .single()

  if (ruleError || !rule) {
    throw new Error(`Failed to create test rule: ${ruleError?.message}`)
  }

  return { workflow, rule }
}

// Wait helpers for eventual consistency
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  throw new Error('Timeout waiting for condition')
}