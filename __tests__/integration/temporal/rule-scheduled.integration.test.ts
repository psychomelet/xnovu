import { createNotificationFromRule } from '@/lib/temporal/activities/rule-scheduled'
import { RuleEngineError } from '@/types/rule-engine'
import type { RuleScheduledWorkflowInput } from '@/lib/temporal/workflows/rule-scheduled'
import {
  createTestSupabaseClient,
  setupTestWorkflowWithRule,
  cleanupTestRules,
  cleanupTestWorkflows,
  cleanupTestNotifications,
} from '../../helpers/supabase-test-helpers'
import type { NotificationRule, NotificationWorkflow } from '@/types/rule-engine'
import { v4 as uuidv4 } from 'uuid'

describe('Rule Scheduled Activity Integration', () => {
  const supabase = createTestSupabaseClient()
  const testEnterpriseIds: string[] = []
  let testRule: NotificationRule
  let testWorkflow: NotificationWorkflow
  
  // Generate UUIDs for consistent test recipients
  const testRecipient1 = uuidv4()
  const testRecipient2 = uuidv4()
  const testSingleRecipient = uuidv4()

  beforeAll(async () => {
    // Create test workflow and rule
    const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {
      default_channels: ['EMAIL', 'IN_APP'],
    }, {
      rule_payload: {
        recipients: [testRecipient1, testRecipient2],
        customData: 'test',
      },
    })
    
    testWorkflow = workflow as NotificationWorkflow
    testRule = rule as NotificationRule
    testEnterpriseIds.push(workflow.enterprise_id!)
  })

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestNotifications(supabase, testEnterpriseIds)
    await cleanupTestRules(supabase, testEnterpriseIds)
    await cleanupTestWorkflows(supabase, testEnterpriseIds)
  })

  afterEach(async () => {
    // Cleanup any notifications created during tests
    await cleanupTestNotifications(supabase, testEnterpriseIds)
  })

  describe('createNotificationFromRule', () => {
    it('should create notification for valid scheduled rule', async () => {
      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: testWorkflow.id,
        rulePayload: testRule.rule_payload,
      }

      await createNotificationFromRule(input)

      // Verify notification was created
      const { data: notifications, error } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('notification_rule_id', testRule.id)
        .eq('enterprise_id', testRule.enterprise_id!)

      expect(error).toBeNull()
      expect(notifications).toHaveLength(1)
      
      const notification = notifications![0]
      expect(notification.name).toBe(`Scheduled: ${testRule.name}`)
      expect(notification.notification_workflow_id).toBe(testWorkflow.id)
      expect(notification.recipients).toEqual([testRecipient1, testRecipient2])
      expect(notification.channels).toEqual(['EMAIL', 'IN_APP'])
      expect(notification.notification_status).toBe('PENDING')
      expect(notification.publish_status).toBe('PUBLISH')
    })

    it('should throw error if enterprise ID is missing', async () => {
      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: null,
        businessId: testRule.business_id,
        workflowId: testWorkflow.id,
        rulePayload: testRule.rule_payload,
      }

      await expect(createNotificationFromRule(input))
        .rejects.toThrow(RuleEngineError)
    })

    it('should throw error if rule not found', async () => {
      const input: RuleScheduledWorkflowInput = {
        ruleId: 999999, // Non-existent rule
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: testWorkflow.id,
        rulePayload: testRule.rule_payload,
      }

      await expect(createNotificationFromRule(input))
        .rejects.toThrow('Rule not found: 999999')
    })

    it('should skip notification for deactivated rule', async () => {
      // Deactivate the rule
      const { error: updateError } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({ deactivated: true })
        .eq('id', testRule.id)

      expect(updateError).toBeNull()

      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: testWorkflow.id,
        rulePayload: testRule.rule_payload,
      }

      await createNotificationFromRule(input)

      // Verify no notification was created
      const { data: notifications } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('notification_rule_id', testRule.id)

      expect(notifications).toHaveLength(0)

      // Reactivate the rule for other tests
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({ deactivated: false })
        .eq('id', testRule.id)
    })

    it('should skip notification for unpublished rule', async () => {
      // Unpublish the rule
      const { error: updateError } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({ publish_status: 'DRAFT' })
        .eq('id', testRule.id)

      expect(updateError).toBeNull()

      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: testWorkflow.id,
        rulePayload: testRule.rule_payload,
      }

      await createNotificationFromRule(input)

      // Verify no notification was created
      const { data: notifications } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('notification_rule_id', testRule.id)

      expect(notifications).toHaveLength(0)

      // Republish the rule for other tests
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({ publish_status: 'PUBLISH' })
        .eq('id', testRule.id)
    })

    it('should throw error if workflow not found', async () => {
      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: 999999, // Non-existent workflow
        rulePayload: testRule.rule_payload,
      }

      await expect(createNotificationFromRule(input))
        .rejects.toThrow('Workflow not found: 999999')
    })

    it('should extract single recipient from rule payload', async () => {
      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: testWorkflow.id,
        rulePayload: { recipient: testSingleRecipient },
      }

      await createNotificationFromRule(input)

      // Verify notification was created with single recipient
      const { data: notifications } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('notification_rule_id', testRule.id)

      expect(notifications).toHaveLength(1)
      expect(notifications![0].recipients).toEqual([testSingleRecipient])
    })

    it('should throw error if no recipients specified', async () => {
      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: testWorkflow.id,
        rulePayload: { customData: 'test' }, // No recipients
      }

      await expect(createNotificationFromRule(input))
        .rejects.toThrow('No recipients specified in rule payload')
    })

    it('should use IN_APP as default channel if workflow has no defaults', async () => {
      // Create a workflow without default channels
      const { data: workflowNoChannels, error } = await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .insert({
          name: 'Test Workflow No Channels',
          workflow_key: 'test-no-channels',
          workflow_type: 'STATIC',
          enterprise_id: testRule.enterprise_id,
          default_channels: null,
          publish_status: 'PUBLISH', // Ensure it's published
          deactivated: false, // Ensure it's not deactivated
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(workflowNoChannels).not.toBeNull()

      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: workflowNoChannels!.id,
        rulePayload: testRule.rule_payload,
      }

      await createNotificationFromRule(input)

      // Verify notification was created with IN_APP channel
      const { data: notifications } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('notification_rule_id', testRule.id)
        .eq('notification_workflow_id', workflowNoChannels!.id)

      expect(notifications).toHaveLength(1)
      expect(notifications![0].channels).toEqual(['IN_APP'])

      // Cleanup
      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('id', workflowNoChannels!.id)
    })

    it('should handle complex rule payload', async () => {
      const testRecipient3 = uuidv4()
      const complexPayload = {
        recipients: [testRecipient1, testRecipient2, testRecipient3],
        buildingId: 'building-123',
        alert: {
          type: 'temperature',
          severity: 'high',
          threshold: 28.5,
        },
        metadata: {
          source: 'sensor-hvac-01',
          timestamp: new Date().toISOString(),
        },
      }

      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: testWorkflow.id,
        rulePayload: complexPayload,
      }

      await createNotificationFromRule(input)

      // Verify notification was created with complex payload
      const { data: notifications } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('notification_rule_id', testRule.id)

      expect(notifications).toHaveLength(1)
      expect(notifications![0].payload).toEqual(complexPayload)
      expect(notifications![0].recipients).toEqual([testRecipient1, testRecipient2, testRecipient3])
    })
  })
})