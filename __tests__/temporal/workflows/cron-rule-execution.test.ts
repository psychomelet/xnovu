import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'
import { cronRuleExecutionWorkflow } from '@/lib/temporal/workflows/cron-rule-execution'
import * as activities from '@/lib/temporal/activities'

type NotificationWorkflow = Database['notify']['Tables']['ent_notification_workflow']['Insert']
type NotificationRule = Database['notify']['Tables']['ent_notification_rule']['Insert']

describe('CRON Rule Execution Workflow', () => {
  let testEnv: TestWorkflowEnvironment
  let testEnterpriseId: string
  let testWorkflowId: number
  let testRuleId: number
  let createdNotificationIds: number[] = []

  beforeAll(async () => {
    // Skip connection tests if not configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials are not configured.')
    }

    // Set up test workflow environment
    testEnv = await TestWorkflowEnvironment.createLocal()

    // Create test enterprise
    const { data: enterprise, error: enterpriseError } = await supabase
      .schema('base')
      .from('ent_enterprise')
      .insert({
        name: 'Test Enterprise for CRON Execution',
        status: 'ACTIVE'
      })
      .select()
      .single()

    if (enterpriseError) throw enterpriseError
    testEnterpriseId = enterprise.id

    // Create test workflow
    const workflowData: NotificationWorkflow = {
      workflow_key: 'test-cron-execution-workflow',
      name: 'Test CRON Execution Workflow',
      description: 'Workflow for testing CRON execution',
      workflow_type: 'STATIC',
      default_channels: ['IN_APP'],
      enterprise_id: testEnterpriseId
    }

    const { data: workflow, error: workflowError } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .insert(workflowData)
      .select()
      .single()

    if (workflowError) throw workflowError
    testWorkflowId = workflow.id

    // Create test CRON rule
    const ruleData: NotificationRule = {
      name: 'Test CRON Execution Rule',
      description: 'Rule for testing workflow execution',
      publish_status: 'PUBLISH',
      deactivated: false,
      notification_workflow_id: testWorkflowId,
      trigger_type: 'CRON',
      trigger_config: { cron: '0 12 * * *', timezone: 'UTC', enabled: true },
      rule_payload: { source: 'workflow-test' },
      enterprise_id: testEnterpriseId
    }

    const { data: rule, error: ruleError } = await supabase
      .schema('notify')
      .from('ent_notification_rule')
      .insert(ruleData)
      .select()
      .single()

    if (ruleError) throw ruleError
    testRuleId = rule.id
  })

  afterAll(async () => {
    // Clean up test environment
    await testEnv?.teardown()

    // Clean up created notifications
    if (createdNotificationIds.length > 0) {
      await supabase
        .schema('notify')
        .from('ent_notification')
        .delete()
        .in('id', createdNotificationIds)
    }

    // Clean up test rule
    if (testRuleId) {
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .delete()
        .eq('id', testRuleId)
    }

    // Clean up test workflow
    if (testWorkflowId) {
      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('id', testWorkflowId)
    }

    // Clean up test enterprise
    if (testEnterpriseId) {
      await supabase
        .schema('base')
        .from('ent_enterprise')
        .delete()
        .eq('id', testEnterpriseId)
    }
  })

  it('should execute CRON rule and create notification', async () => {
    // Track notifications before execution
    const notificationsBefore = await supabase
      .schema('notify')
      .from('ent_notification')
      .select('id')
      .eq('enterprise_id', testEnterpriseId)

    const beforeCount = notificationsBefore.data?.length || 0

    // Create worker with real activities
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-queue',
      workflowsPath: require.resolve('@/lib/temporal/workflows/cron-rule-execution'),
      activities,
    })

    // Execute the workflow
    const result = await worker.runUntil(
      testEnv.client.workflow.execute(cronRuleExecutionWorkflow, {
        workflowId: 'test-cron-execution',
        taskQueue: 'test-queue',
        args: [{
          ruleId: testRuleId,
          enterpriseId: testEnterpriseId,
          businessId: undefined
        }],
      })
    )

    // Verify workflow completed without errors
    expect(result).toBeUndefined() // Workflow returns void

    // Verify notification was created
    const notificationsAfter = await supabase
      .schema('notify')
      .from('ent_notification')
      .select('*')
      .eq('enterprise_id', testEnterpriseId)
      .order('created_at', { ascending: false })

    const afterCount = notificationsAfter.data?.length || 0
    expect(afterCount).toBeGreaterThan(beforeCount)

    // Track and verify the created notification
    if (notificationsAfter.data && notificationsAfter.data.length > 0) {
      const newNotification = notificationsAfter.data[0]
      createdNotificationIds.push(newNotification.id)
      
      expect(newNotification.notification_workflow_id).toBe(testWorkflowId)
      expect(newNotification.enterprise_id).toBe(testEnterpriseId)
      expect(newNotification.payload).toEqual({ source: 'workflow-test' })
      expect(newNotification.name).toContain('Test CRON Execution Rule')
    }
  })

  it('should handle errors gracefully', async () => {
    // Create worker with real activities
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-queue',
      workflowsPath: require.resolve('@/lib/temporal/workflows/cron-rule-execution'),
      activities,
    })

    // Execute workflow with non-existent rule
    await expect(
      worker.runUntil(
        testEnv.client.workflow.execute(cronRuleExecutionWorkflow, {
          workflowId: 'test-cron-execution-error',
          taskQueue: 'test-queue',
          args: [{
            ruleId: 999999,
            enterpriseId: testEnterpriseId,
            businessId: undefined
          }],
        })
      )
    ).rejects.toThrow(/Failed to fetch rule/)
  })

  it('should pass business ID when provided', async () => {
    const testBusinessId = 'test-business-123'

    // Create worker with mocked activities to verify parameters
    let capturedParams: any = null
    const mockedActivities = {
      ...activities,
      runNotificationRule: async (params: any) => {
        capturedParams = params
        // Call the real activity
        return activities.runNotificationRule(params)
      }
    }

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-queue',
      workflowsPath: require.resolve('@/lib/temporal/workflows/cron-rule-execution'),
      activities: mockedActivities,
    })

    // Execute workflow with business ID
    await worker.runUntil(
      testEnv.client.workflow.execute(cronRuleExecutionWorkflow, {
        workflowId: 'test-cron-execution-business',
        taskQueue: 'test-queue',
        args: [{
          ruleId: testRuleId,
          enterpriseId: testEnterpriseId,
          businessId: testBusinessId
        }],
      })
    )

    // Verify business ID was passed correctly
    expect(capturedParams).toBeDefined()
    expect(capturedParams.businessId).toBe(testBusinessId)

    // Clean up any created notifications
    const notifications = await supabase
      .schema('notify')
      .from('ent_notification')
      .select('id')
      .eq('business_id', testBusinessId)

    if (notifications.data) {
      createdNotificationIds.push(...notifications.data.map(n => n.id))
    }
  })

  it('should retry on transient failures', async () => {
    let attemptCount = 0
    
    // Create worker with activities that fail initially
    const retriedActivities = {
      ...activities,
      runNotificationRule: async (params: any) => {
        attemptCount++
        if (attemptCount < 2) {
          throw new Error('Transient error')
        }
        return activities.runNotificationRule(params)
      }
    }

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-queue',
      workflowsPath: require.resolve('@/lib/temporal/workflows/cron-rule-execution'),
      activities: retriedActivities,
    })

    // Execute workflow - should succeed after retry
    await worker.runUntil(
      testEnv.client.workflow.execute(cronRuleExecutionWorkflow, {
        workflowId: 'test-cron-execution-retry',
        taskQueue: 'test-queue',
        args: [{
          ruleId: testRuleId,
          enterpriseId: testEnterpriseId,
          businessId: undefined
        }],
      })
    )

    // Verify it retried
    expect(attemptCount).toBe(2)

    // Clean up any created notifications
    const notifications = await supabase
      .schema('notify')
      .from('ent_notification')
      .select('id')
      .eq('enterprise_id', testEnterpriseId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (notifications.data && notifications.data.length > 0) {
      createdNotificationIds.push(notifications.data[0].id)
    }
  })
})