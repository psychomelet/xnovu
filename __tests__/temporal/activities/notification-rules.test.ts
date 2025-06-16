import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'
import { 
  runNotificationRule, 
  fetchAllCronRules 
} from '@/lib/temporal/activities/notification-rules'

type NotificationWorkflow = Database['notify']['Tables']['ent_notification_workflow']['Insert']
type NotificationRule = Database['notify']['Tables']['ent_notification_rule']['Insert']
type NotificationCategory = Database['notify']['Tables']['typ_notification_category']['Row']
type NotificationPriority = Database['notify']['Tables']['typ_notification_priority']['Row']

describe('Notification Rules Activities', () => {
  let testEnterpriseId: string
  let testWorkflowId: number
  let testCategoryId: number
  let testPriorityId: number
  let testRuleId: number
  let createdNotificationIds: number[] = []

  beforeAll(async () => {
    try {
      // Create test enterprise
      const { data: enterprise, error: enterpriseError } = await supabase
      .schema('base')
      .from('ent_enterprise')
      .insert({
        name: 'Test Enterprise for Notification Rules',
        status: 'ACTIVE'
      })
      .select()
      .single()

    if (enterpriseError) throw enterpriseError
    testEnterpriseId = enterprise.id

    // Get or create notification category
    const { data: categories } = await supabase
      .schema('notify')
      .from('typ_notification_category')
      .select('*')
      .limit(1)

    if (categories && categories.length > 0) {
      testCategoryId = categories[0].id
    } else {
      const { data: category, error: categoryError } = await supabase
        .schema('notify')
        .from('typ_notification_category')
        .insert({
          name: 'Test Category',
          description: 'Test category for notification rules'
        })
        .select()
        .single()

      if (categoryError) throw categoryError
      testCategoryId = category.id
    }

    // Get or create notification priority
    const { data: priorities } = await supabase
      .schema('notify')
      .from('typ_notification_priority')
      .select('*')
      .limit(1)

    if (priorities && priorities.length > 0) {
      testPriorityId = priorities[0].id
    } else {
      const { data: priority, error: priorityError } = await supabase
        .schema('notify')
        .from('typ_notification_priority')
        .insert({
          name: 'MEDIUM',
          level: 2
        })
        .select()
        .single()

      if (priorityError) throw priorityError
      testPriorityId = priority.id
    }

    // Create test workflow
    const workflowData: NotificationWorkflow = {
      workflow_key: 'test-notification-rule-workflow',
      name: 'Test Notification Rule Workflow',
      description: 'Workflow for testing notification rules',
      workflow_type: 'STATIC',
      default_channels: ['IN_APP'],
      notification_category_id: testCategoryId,
      notification_priority_id: testPriorityId,
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
    } catch (error) {
      console.error('Error in beforeAll:', error)
      throw error
    }
  })

  afterAll(async () => {
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

  describe('fetchAllCronRules', () => {
    it('should fetch all active CRON rules', async () => {
      // Create a test CRON rule
      const ruleData: NotificationRule = {
        name: 'Test CRON Rule',
        description: 'Test CRON rule for fetching',
        publish_status: 'PUBLISH',
        deactivated: false,
        notification_workflow_id: testWorkflowId,
        trigger_type: 'CRON',
        trigger_config: { cron: '0 9 * * MON', timezone: 'UTC', enabled: true },
        rule_payload: { test: true },
        enterprise_id: testEnterpriseId
      }

      const { data: rule, error } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .insert(ruleData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(rule).toBeDefined()
      testRuleId = rule!.id

      // Fetch all CRON rules
      const rules = await fetchAllCronRules()
      expect(rules).toBeInstanceOf(Array)
      expect(rules.length).toBeGreaterThan(0)

      // Verify our test rule is included
      const testRule = rules.find(r => r.id === testRuleId)
      expect(testRule).toBeDefined()
      expect(testRule?.trigger_type).toBe('CRON')
      expect(testRule?.publish_status).toBe('PUBLISH')
      expect(testRule?.deactivated).toBe(false)
    })

    it('should filter CRON rules by enterprise ID', async () => {
      const rules = await fetchAllCronRules(testEnterpriseId)
      expect(rules).toBeInstanceOf(Array)
      
      // All returned rules should belong to the test enterprise
      rules.forEach(rule => {
        expect(rule.enterprise_id).toBe(testEnterpriseId)
      })
    })

    it('should not return inactive or draft rules', async () => {
      // Create an inactive rule
      const inactiveRule: NotificationRule = {
        name: 'Inactive CRON Rule',
        description: 'This rule should not be fetched',
        publish_status: 'DRAFT',
        deactivated: true,
        notification_workflow_id: testWorkflowId,
        trigger_type: 'CRON',
        trigger_config: { cron: '0 10 * * *' },
        enterprise_id: testEnterpriseId
      }

      const { data: rule } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .insert(inactiveRule)
        .select()
        .single()

      // Fetch rules and verify inactive rule is not included
      const rules = await fetchAllCronRules(testEnterpriseId)
      const inactiveRuleFound = rules.find(r => r.id === rule?.id)
      expect(inactiveRuleFound).toBeUndefined()

      // Clean up
      if (rule?.id) {
        await supabase
          .schema('notify')
          .from('ent_notification_rule')
          .delete()
          .eq('id', rule.id)
      }
    })
  })

  describe('runNotificationRule', () => {
    it('should successfully run a valid CRON rule', async () => {
      // Track created notification
      const notificationsBefore = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('id')
        .eq('enterprise_id', testEnterpriseId)

      const beforeCount = notificationsBefore.data?.length || 0

      // Run the notification rule
      await expect(
        runNotificationRule({
          ruleId: testRuleId,
          enterpriseId: testEnterpriseId
        })
      ).resolves.not.toThrow()

      // Verify a notification was created
      const notificationsAfter = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('enterprise_id', testEnterpriseId)
        .order('created_at', { ascending: false })

      const afterCount = notificationsAfter.data?.length || 0
      expect(afterCount).toBeGreaterThan(beforeCount)

      // Track the created notification for cleanup
      if (notificationsAfter.data && notificationsAfter.data.length > 0) {
        const newNotification = notificationsAfter.data[0]
        createdNotificationIds.push(newNotification.id)
        
        // Verify notification properties
        expect(newNotification.notification_workflow_id).toBe(testWorkflowId)
        expect(newNotification.enterprise_id).toBe(testEnterpriseId)
        expect(newNotification.payload).toEqual({ test: true })
      }
    })

    it('should fail for non-existent rule', async () => {
      await expect(
        runNotificationRule({
          ruleId: 999999,
          enterpriseId: testEnterpriseId
        })
      ).rejects.toThrow(/Failed to fetch rule/)
    })

    it('should fail for deactivated rule', async () => {
      // Deactivate the rule
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({ deactivated: true })
        .eq('id', testRuleId)

      await expect(
        runNotificationRule({
          ruleId: testRuleId,
          enterpriseId: testEnterpriseId
        })
      ).rejects.toThrow(/is not active/)

      // Reactivate for other tests
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({ deactivated: false })
        .eq('id', testRuleId)
    })

    it('should fail for non-CRON rule', async () => {
      // Create a SCHEDULE rule
      const scheduleRule: NotificationRule = {
        name: 'Schedule Rule',
        description: 'This is not a CRON rule',
        publish_status: 'PUBLISH',
        deactivated: false,
        notification_workflow_id: testWorkflowId,
        trigger_type: 'SCHEDULE',
        trigger_config: { schedule_time: '2024-12-31T00:00:00Z' },
        enterprise_id: testEnterpriseId
      }

      const { data: rule } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .insert(scheduleRule)
        .select()
        .single()

      if (rule) {
        await expect(
          runNotificationRule({
            ruleId: rule.id,
            enterpriseId: testEnterpriseId
          })
        ).rejects.toThrow(/unsupported trigger type/)

        // Clean up
        await supabase
          .schema('notify')
          .from('ent_notification_rule')
          .delete()
          .eq('id', rule.id)
      }
    })

    it('should fail for rule with invalid CRON config', async () => {
      // Create rule with invalid config
      const invalidRule: NotificationRule = {
        name: 'Invalid CRON Rule',
        description: 'Rule with invalid CRON config',
        publish_status: 'PUBLISH',
        deactivated: false,
        notification_workflow_id: testWorkflowId,
        trigger_type: 'CRON',
        trigger_config: { invalid: 'config' }, // Missing 'cron' field
        enterprise_id: testEnterpriseId
      }

      const { data: rule } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .insert(invalidRule)
        .select()
        .single()

      if (rule) {
        await expect(
          runNotificationRule({
            ruleId: rule.id,
            enterpriseId: testEnterpriseId
          })
        ).rejects.toThrow(/invalid cron configuration/)

        // Clean up
        await supabase
          .schema('notify')
          .from('ent_notification_rule')
          .delete()
          .eq('id', rule.id)
      }
    })
  })
})