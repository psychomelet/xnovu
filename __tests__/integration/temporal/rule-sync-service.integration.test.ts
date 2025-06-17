import { RuleSyncService } from '@/lib/temporal/services/rule-sync-service'
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  getScheduleId,
} from '@/lib/temporal/client/schedule-client'
import {
  createTestSupabaseClient,
  setupTestWorkflowWithRule,
  cleanupTestRules,
  cleanupTestWorkflows,
  createTestRule,
} from '../../helpers/supabase-test-helpers'
import type { NotificationRule } from '@/types/rule-engine'

describe('RuleSyncService Integration', () => {
  const supabase = createTestSupabaseClient()
  const testEnterpriseIds: string[] = []
  let service: RuleSyncService
  let testRules: NotificationRule[] = []

  beforeAll(async () => {
    service = new RuleSyncService()
    
    // Create test rules
    for (let i = 0; i < 3; i++) {
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {
        enterprise_id: `test-sync-ent-${i}`,
      })
      testEnterpriseIds.push(workflow.enterprise_id!)
      testRules.push(rule as NotificationRule)
    }
  })

  afterAll(async () => {
    // Cleanup all test schedules
    for (const rule of testRules) {
      try {
        await deleteSchedule(rule)
      } catch (error) {
        // Schedule might not exist
      }
    }

    // Cleanup test data
    await cleanupTestRules(supabase, testEnterpriseIds)
    await cleanupTestWorkflows(supabase, testEnterpriseIds)
    await service.shutdown()
  })

  describe('syncAllRules', () => {
    beforeEach(async () => {
      // Cleanup any existing schedules
      for (const rule of testRules) {
        try {
          await deleteSchedule(rule)
        } catch (error) {
          // Schedule might not exist
        }
      }
    })

    it('should sync all active rules on startup', async () => {
      // Pre-create one schedule to test update
      await createSchedule(testRules[0])

      await service.syncAllRules()

      // Verify all schedules were created/updated
      for (const rule of testRules) {
        const scheduleId = getScheduleId(rule)
        const description = await getSchedule(scheduleId)
        expect(description).toBeDefined()
        expect(description?.schedule?.state?.paused).toBe(false)
      }
    })

    it('should delete orphaned schedules', async () => {
      // Create a schedule for a rule that will be "deleted"
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {
        enterprise_id: 'test-orphan-ent',
      })
      testEnterpriseIds.push(workflow.enterprise_id!)
      
      const orphanScheduleId = getScheduleId(rule as NotificationRule)
      await createSchedule(rule as NotificationRule)
      
      // Delete the rule from database
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .delete()
        .eq('id', rule.id)

      // Run sync
      await service.syncAllRules()

      // Verify orphaned schedule was deleted
      const description = await getSchedule(orphanScheduleId)
      expect(description).toBeNull()
    })

    it('should handle sync errors gracefully', async () => {
      // Create a rule with invalid cron expression
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {
        enterprise_id: 'test-invalid-ent',
      }, {
        trigger_config: { cron: 'invalid-cron' }
      })
      testEnterpriseIds.push(workflow.enterprise_id!)

      // Sync should complete despite the error
      await expect(service.syncAllRules()).resolves.not.toThrow()
    })
  })

  describe('syncRule', () => {
    let testRule: NotificationRule

    beforeEach(async () => {
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {
        enterprise_id: 'test-sync-rule-ent',
      })
      testEnterpriseIds.push(workflow.enterprise_id!)
      testRule = rule as NotificationRule
    })

    afterEach(async () => {
      try {
        await deleteSchedule(testRule)
      } catch (error) {
        // Schedule might not exist
      }
    })

    it('should create or update schedule for active CRON rule', async () => {
      await service.syncRule(testRule)

      const scheduleId = getScheduleId(testRule)
      const description = await getSchedule(scheduleId)
      expect(description).toBeDefined()
      expect(description?.schedule?.state?.paused).toBe(false)
    })

    it('should skip non-CRON rules', async () => {
      // Update rule to non-CRON type
      const { error } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({ trigger_type: 'EVENT' })
        .eq('id', testRule.id)

      expect(error).toBeNull()

      const nonCronRule = { ...testRule, trigger_type: 'EVENT' as any }
      await service.syncRule(nonCronRule)

      const scheduleId = getScheduleId(testRule)
      const description = await getSchedule(scheduleId)
      expect(description).toBeNull()
    })

    it('should remove schedule for deactivated rule', async () => {
      // Create schedule first
      await service.syncRule(testRule)

      // Update rule to deactivated
      const { error } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({ deactivated: true })
        .eq('id', testRule.id)

      expect(error).toBeNull()

      const deactivatedRule = { ...testRule, deactivated: true }
      await service.syncRule(deactivatedRule)

      const scheduleId = getScheduleId(testRule)
      const description = await getSchedule(scheduleId)
      expect(description).toBeNull()
    })

    it('should remove schedule for unpublished rule', async () => {
      // Create schedule first
      await service.syncRule(testRule)

      // Update rule to draft
      const { error } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({ publish_status: 'DRAFT' })
        .eq('id', testRule.id)

      expect(error).toBeNull()

      const unpublishedRule = { ...testRule, publish_status: 'DRAFT' as const }
      await service.syncRule(unpublishedRule)

      const scheduleId = getScheduleId(testRule)
      const description = await getSchedule(scheduleId)
      expect(description).toBeNull()
    })
  })

  describe('reconcileSchedules', () => {
    beforeEach(async () => {
      // Cleanup any existing schedules
      for (const rule of testRules) {
        try {
          await deleteSchedule(rule)
        } catch (error) {
          // Schedule might not exist
        }
      }
    })

    it('should reconcile schedules and return stats', async () => {
      // Pre-create one schedule
      await createSchedule(testRules[0])

      // Create an orphaned schedule
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {
        enterprise_id: 'test-reconcile-orphan',
      })
      testEnterpriseIds.push(workflow.enterprise_id!)
      await createSchedule(rule as NotificationRule)
      
      // Delete the rule to make it orphaned
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .delete()
        .eq('id', rule.id)

      const stats = await service.reconcileSchedules()

      expect(stats.updated).toBe(1) // testRules[0]
      expect(stats.created).toBe(2) // testRules[1] and testRules[2]
      expect(stats.deleted).toBe(1) // orphaned schedule
      expect(stats.errors).toBe(0)
    })

    it('should track errors in stats', async () => {
      // Create a rule with invalid configuration
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {
        enterprise_id: 'test-reconcile-error',
      }, {
        trigger_config: null // Invalid config
      })
      testEnterpriseIds.push(workflow.enterprise_id!)

      const stats = await service.reconcileSchedules()

      // Should have at least one error for the invalid rule
      expect(stats.errors).toBeGreaterThanOrEqual(1)
    })
  })
})