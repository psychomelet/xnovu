/**
 * Test helpers for Supabase integration tests
 * 
 * All tests use the shared enterprise ID from global setup.
 * Cleanup is handled automatically by global teardown.
 * 
 * Usage:
 * const { workflow, rule } = await setupTestWorkflowWithRule(supabase)
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { v4 as uuidv4 } from 'uuid'
import { getTestEnterpriseId } from '../setup/test-data'

// Create Supabase client for tests
export function createTestSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials for tests')
  }

  return createClient<Database>(supabaseUrl, supabaseKey)
}

// Available workflow keys from app/novu/workflow-loader.ts
export const WORKFLOW_KEYS = {
  chat: 'default-chat',
  email: 'default-email',
  inApp: 'default-in-app',
  multiChannel: 'default-multi-channel',
  push: 'default-push',
  sms: 'default-sms',
  templateDemo: 'template-demo-workflow',
  welcome: 'welcome-onboarding-email',
  yogo: 'yogo-email'
} as const;

// Helper to get existing workflow from database
export async function getExistingWorkflow(
  supabase: ReturnType<typeof createClient<Database>>,
  workflowKey: string
): Promise<Database['notify']['Tables']['ent_notification_workflow']['Row']> {
  const { data, error } = await supabase
    .schema('notify')
    .from('ent_notification_workflow')
    .select()
    .eq('workflow_key', workflowKey)
    .single();
    
  if (error || !data) {
    throw new Error(`Workflow ${workflowKey} must exist in database. Run pnpm xnovu sync`);
  }
  return data;
}

export function createTestRule(
  workflowId: number,
  overrides?: Partial<Database['notify']['Tables']['ent_notification_rule']['Insert']>
) {
  const enterpriseId = overrides?.enterprise_id || getTestEnterpriseId()
  return {
    name: `Test Rule ${uuidv4()}`,
    notification_workflow_id: workflowId,
    trigger_type: 'CRON',
    trigger_config: {
      cron: '0 9 * * MON',
      timezone: 'UTC',
    },
    rule_payload: {
      recipients: [uuidv4()],
      test: true,
    },
    enterprise_id: enterpriseId,
    business_id: overrides?.business_id || uuidv4(),
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
    recipients: [uuidv4()],
    enterprise_id: overrides?.enterprise_id || getTestEnterpriseId(),
    notification_status: 'PENDING' as const,
    publish_status: 'PUBLISH' as const,
    ...overrides,
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

// Add minimal test to satisfy Jest requirement
describe('supabase-test-helpers', () => {
  it('should export helper functions', () => {
    expect(createTestSupabaseClient).toBeDefined()
    expect(createTestWorkflow).toBeDefined()
    expect(createTestRule).toBeDefined()
    expect(createTestNotification).toBeDefined()
    expect(setupTestWorkflowWithRule).toBeDefined()
    expect(waitForCondition).toBeDefined()
  })
})