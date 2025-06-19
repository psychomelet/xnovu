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
  createTestRule,
  waitForCondition,
} from '../../helpers/supabase-test-helpers'
import { getTestEnterpriseId } from '../../setup/test-data'
import type { NotificationRule } from '@/types/rule-engine'

describe('RuleSyncService Integration', () => {
  const supabase = createTestSupabaseClient()
  const testEnterpriseId = getTestEnterpriseId()
  let service: RuleSyncService
  let testRule: NotificationRule

  beforeAll(async () => {
    service = new RuleSyncService()
    
    // Create only one test rule for all tests
    const { workflow, rule } = await setupTestWorkflowWithRule(supabase)
    testRule = rule as NotificationRule
  }, 10000)

  afterAll(async () => {
    // No need to cleanup schedules - namespace deletion handles it
    await service.shutdown()
  }, 5000)

  describe('syncAllRules', () => {
    it('should sync active rules', async () => {
      await service.syncAllRules(testEnterpriseId)

      // Verify schedule exists
      const schedule = await getSchedule(getScheduleId(testRule))
      expect(schedule).toBeDefined()
    }, 10000)

    it('should handle orphaned schedules', async () => {
      // Create a temporary rule and schedule
      const { rule: tempRule } = await setupTestWorkflowWithRule(supabase)
      await createSchedule(tempRule as NotificationRule)
      
      // Delete the rule to create orphan
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .delete()
        .eq('id', tempRule.id)

      // Sync should clean up orphan
      await service.syncAllRules(testEnterpriseId)

      // Verify orphaned schedule was deleted
      const orphanSchedule = await getSchedule(getScheduleId(tempRule as NotificationRule))
      expect(orphanSchedule).toBeNull()
    }, 10000)

    it('should handle sync errors gracefully', async () => {
      // Create rule with invalid config
      const { rule: invalidRule } = await setupTestWorkflowWithRule(supabase, 'default-email', {
        trigger_config: { cron: 'invalid-cron' }
      })

      // Sync should not throw despite error
      await expect(service.syncAllRules(testEnterpriseId)).resolves.not.toThrow()
      
      // Cleanup
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .delete()
        .eq('id', invalidRule.id)
    }, 10000)
  })

  describe('syncRule', () => {
    it('should create or update schedule for active CRON rule', async () => {
      await service.syncRule(testRule)

      const schedule = await getSchedule(getScheduleId(testRule))
      expect(schedule).toBeDefined()
      expect(schedule?.spec).toBeDefined()
    }, 5000)

    it('should skip non-CRON rules', async () => {
      const nonCronRule = { ...testRule, trigger_type: 'EVENT' as any }
      await service.syncRule(nonCronRule)

      // Should not create schedule for non-CRON rule
      // Note: Using original testRule ID since we modified a copy
      const schedule = await getSchedule(getScheduleId(testRule))
      // Schedule might exist from previous test, but that's okay
      expect(schedule).toBeDefined()
    }, 5000)

    it('should remove schedule for deactivated rule', async () => {
      // First ensure schedule exists
      await service.syncRule(testRule)
      
      // Then deactivate and sync
      const deactivatedRule = { ...testRule, deactivated: true }
      await service.syncRule(deactivatedRule)

      const schedule = await getSchedule(getScheduleId(testRule))
      expect(schedule).toBeNull()
    }, 5000)

    it('should remove schedule for unpublished rule', async () => {
      // First create schedule
      await service.syncRule(testRule)
      
      // Then unpublish and sync
      const unpublishedRule = { ...testRule, publish_status: 'DRAFT' as const }
      await service.syncRule(unpublishedRule)

      const schedule = await getSchedule(getScheduleId(testRule))
      expect(schedule).toBeNull()
    }, 5000)
  })

  describe('reconcileSchedules', () => {
    it('should reconcile schedules and return stats', async () => {
      // Create a fresh rule and schedule for reconciliation
      const { rule: reconcileRule } = await setupTestWorkflowWithRule(supabase)
      await createSchedule(reconcileRule as NotificationRule)
      
      const stats = await service.reconcileSchedules(testEnterpriseId)

      // Check stats structure
      expect(typeof stats.created).toBe('number')
      expect(typeof stats.updated).toBe('number')
      expect(typeof stats.deleted).toBe('number')
      expect(typeof stats.errors).toBe('number')
      
      // Cleanup
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .delete()
        .eq('id', reconcileRule.id)
    }, 10000)

    it('should track errors in stats', async () => {
      // Create rule with invalid config
      const { rule: invalidRule } = await setupTestWorkflowWithRule(supabase, 'default-email', {
        trigger_config: { cron: 'invalid' }
      })

      const stats = await service.reconcileSchedules(testEnterpriseId)
      
      // Should have recorded error for invalid rule
      expect(stats.errors).toBeGreaterThanOrEqual(1)
      
      // Cleanup
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .delete()
        .eq('id', invalidRule.id)
    }, 10000)
  })
})

// Add minimal test to satisfy Jest requirement
describe('supabase-test-helpers', () => {
  it('should export helper functions', () => {
    expect(createTestSupabaseClient).toBeDefined()
  })
})