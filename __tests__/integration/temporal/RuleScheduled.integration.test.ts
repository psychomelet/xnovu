import { createNotificationFromRule } from '@/lib/temporal/activities/rule-scheduled'
import { RuleEngineError } from '@/types/rule-engine'
import type { RuleScheduledWorkflowInput } from '@/lib/temporal/workflows/rule-scheduled'
import {
  createTestSupabaseClient,
  setupTestWorkflowWithRule,
} from '../../helpers/supabase-test-helpers'
import type { NotificationRule, NotificationWorkflow } from '@/types/rule-engine'
import { v4 as uuidv4 } from 'uuid'

describe('Rule Scheduled Activity Integration', () => {
  const supabase = createTestSupabaseClient()
  
  // Generate UUIDs for consistent test recipients
  const testRecipient1 = uuidv4()
  const testRecipient2 = uuidv4()
  const testSingleRecipient = uuidv4()

  describe('createNotificationFromRule', () => {
    it('should create notification for valid scheduled rule', async () => {
      // Create test workflow and rule for this specific test
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {
        default_channels: ['EMAIL', 'IN_APP'],
      }, {
        rule_payload: {
          recipients: [testRecipient1, testRecipient2],
          customData: 'test',
        },
      })
      
      const testWorkflow = workflow as NotificationWorkflow
      const testRule = rule as NotificationRule

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
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase)
      const testWorkflow = workflow as NotificationWorkflow
      const testRule = rule as NotificationRule

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
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase)
      const testWorkflow = workflow as NotificationWorkflow
      const testRule = rule as NotificationRule

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
      // Create a deactivated rule for this test
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {}, {
        deactivated: true
      })
      
      const testWorkflow = workflow as NotificationWorkflow
      const testRule = rule as NotificationRule

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
        .eq('enterprise_id', testRule.enterprise_id!)

      expect(notifications).toHaveLength(0)
    })

    it('should skip notification for unpublished rule', async () => {
      // Create an unpublished rule for this test
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {}, {
        publish_status: 'DRAFT'
      })
      
      const testWorkflow = workflow as NotificationWorkflow
      const testRule = rule as NotificationRule

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
        .eq('enterprise_id', testRule.enterprise_id!)

      expect(notifications).toHaveLength(0)
    })

    it('should throw error if workflow not found', async () => {
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase)
      const testRule = rule as NotificationRule

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
      // Create rule with single recipient string
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {}, {
        rule_payload: {
          recipient: testSingleRecipient,
          customData: 'test',
        },
      })
      
      const testWorkflow = workflow as NotificationWorkflow
      const testRule = rule as NotificationRule

      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: testWorkflow.id,
        rulePayload: testRule.rule_payload,
      }

      await createNotificationFromRule(input)

      // Verify notification was created with single recipient as array
      const { data: notifications } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('notification_rule_id', testRule.id)
        .eq('enterprise_id', testRule.enterprise_id!)

      expect(notifications).toHaveLength(1)
      expect(notifications![0].recipients).toEqual([testSingleRecipient])
    })

    it('should throw error if no recipients specified', async () => {
      // Create rule without recipients
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {}, {
        rule_payload: {
          customData: 'test',
          // No recipients field
        },
      })
      
      const testWorkflow = workflow as NotificationWorkflow
      const testRule = rule as NotificationRule

      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: testWorkflow.id,
        rulePayload: testRule.rule_payload,
      }

      await expect(createNotificationFromRule(input))
        .rejects.toThrow('No recipients specified in rule payload')
    })

    it('should use workflow default channels', async () => {
      // Create workflow with empty default channels
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {
        default_channels: [],
      })
      
      const testWorkflow = workflow as NotificationWorkflow
      const testRule = rule as NotificationRule

      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: testWorkflow.id,
        rulePayload: testRule.rule_payload,
      }

      await createNotificationFromRule(input)

      // Verify notification was created with empty channels array
      const { data: notifications } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('notification_rule_id', testRule.id)
        .eq('enterprise_id', testRule.enterprise_id!)

      expect(notifications).toHaveLength(1)
      expect(notifications![0].channels).toEqual([])
    })

    it('should handle complex rule payload', async () => {
      const complexPayload = {
        recipients: [testRecipient1],
        priority: 'high',
        category: 'maintenance',
        metadata: {
          building: 'A',
          floor: 3,
          room: '301',
        },
        customData: {
          nested: {
            value: 'test',
          },
        },
      }

      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {}, {
        rule_payload: complexPayload,
      })
      
      const testWorkflow = workflow as NotificationWorkflow
      const testRule = rule as NotificationRule

      const input: RuleScheduledWorkflowInput = {
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id!,
        businessId: testRule.business_id,
        workflowId: testWorkflow.id,
        rulePayload: testRule.rule_payload,
      }

      await createNotificationFromRule(input)

      // Verify notification was created with complex payload
      const { data: notifications } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('*')
        .eq('notification_rule_id', testRule.id)
        .eq('enterprise_id', testRule.enterprise_id!)

      expect(notifications).toHaveLength(1)
      expect(notifications![0].payload).toEqual(complexPayload)
    })
  })
})

// Add minimal test to satisfy Jest requirement
describe('supabase-test-helpers', () => {
  it('should export helper functions', () => {
    expect(createTestSupabaseClient).toBeDefined()
    expect(setupTestWorkflowWithRule).toBeDefined()
  })
})