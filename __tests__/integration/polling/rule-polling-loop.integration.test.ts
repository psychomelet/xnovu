import { RulePollingLoop } from '@/lib/polling/rule-polling-loop'
import {
  deleteSchedule,
  getSchedule,
  getScheduleId,
} from '@/lib/temporal/client/schedule-client'
import {
  createTestSupabaseClient,
  setupTestWorkflowWithRule,
  cleanupTestRules,
  cleanupTestWorkflows,
  waitForCondition,
} from '../../helpers/supabase-test-helpers'
import type { NotificationRule } from '@/types/rule-engine'

describe('RulePollingLoop Integration', () => {
  const supabase = createTestSupabaseClient()
  const testEnterpriseIds: string[] = []
  let pollingLoop: RulePollingLoop
  let testRules: NotificationRule[] = []

  const config = {
    pollIntervalMs: 500, // Fast polling for tests
    batchSize: 10,
  }

  beforeAll(async () => {
    // Create test rules
    for (let i = 0; i < 2; i++) {
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase)
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
  })

  beforeEach(() => {
    pollingLoop = new RulePollingLoop(config)
  })

  afterEach(async () => {
    if (pollingLoop.getIsRunning()) {
      await pollingLoop.stop()
    }
  })

  describe('start', () => {
    it('should perform initial sync and start polling', async () => {
      await pollingLoop.start()

      expect(pollingLoop.getIsRunning()).toBe(true)

      // Wait for initial sync to complete
      await waitForCondition(async () => {
        // Check if schedules were created
        for (const rule of testRules) {
          const scheduleId = getScheduleId(rule)
          const description = await getSchedule(scheduleId)
          if (!description) return false
        }
        return true
      }, 5000)

      // Verify all schedules were created
      for (const rule of testRules) {
        const scheduleId = getScheduleId(rule)
        const description = await getSchedule(scheduleId)
        expect(description).toBeDefined()
      }
    })

    it('should continue polling even if initial sync fails', async () => {
      // Create a rule with invalid configuration
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {}, {
        trigger_config: null // Invalid config
      })
      testEnterpriseIds.push(workflow.enterprise_id!)

      await pollingLoop.start()
      expect(pollingLoop.getIsRunning()).toBe(true)
    })

    it('should not start if already running', async () => {
      await pollingLoop.start()
      await pollingLoop.start()

      // Should still be running
      expect(pollingLoop.getIsRunning()).toBe(true)
    })
  })

  describe('polling for changes', () => {
    let newRule: NotificationRule

    beforeEach(async () => {
      await pollingLoop.start()

      // Wait for initial sync
      await waitForCondition(async () => {
        for (const rule of testRules) {
          const scheduleId = getScheduleId(rule)
          const description = await getSchedule(scheduleId)
          if (!description) return false
        }
        return true
      }, 5000)
    })

    afterEach(async () => {
      if (newRule) {
        try {
          await deleteSchedule(newRule)
        } catch (error) {
          // Schedule might not exist
        }
      }
    })

    it('should detect and sync new rules', async () => {
      // Create a new rule after polling started
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase)
      testEnterpriseIds.push(workflow.enterprise_id!)
      newRule = rule as NotificationRule

      // Wait for polling to pick up the new rule
      await waitForCondition(async () => {
        const scheduleId = getScheduleId(newRule)
        const description = await getSchedule(scheduleId)
        return description !== null
      }, 5000)

      // Verify schedule was created
      const scheduleId = getScheduleId(newRule)
      const description = await getSchedule(scheduleId)
      expect(description).toBeDefined()
    })

    it('should detect and sync rule updates', async () => {
      const ruleToUpdate = testRules[0]
      const scheduleId = getScheduleId(ruleToUpdate)

      // Update rule's cron expression
      const { error } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({
          trigger_config: { cron: '0 15 * * FRI', timezone: 'America/New_York' },
          updated_at: new Date().toISOString(),
        })
        .eq('id', ruleToUpdate.id)

      expect(error).toBeNull()

      // Wait for polling to pick up the change
      await waitForCondition(async () => {
        const description = await getSchedule(scheduleId)
        return description?.schedule?.spec?.cronExpressions?.[0] === '0 15 * * FRI'
      }, 5000)

      // Verify schedule was updated
      const description = await getSchedule(scheduleId)
      expect(description?.schedule?.spec?.cronExpressions).toContain('0 15 * * FRI')
      expect(description?.schedule?.spec?.timezone).toBe('America/New_York')
    })

    it('should remove schedules for deactivated rules', async () => {
      const ruleToDeactivate = testRules[1]
      const scheduleId = getScheduleId(ruleToDeactivate)

      // Deactivate the rule
      const { error } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({
          deactivated: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ruleToDeactivate.id)

      expect(error).toBeNull()

      // Wait for polling to remove the schedule
      await waitForCondition(async () => {
        const description = await getSchedule(scheduleId)
        return description === null
      }, 5000)

      // Verify schedule was removed
      const description = await getSchedule(scheduleId)
      expect(description).toBeNull()
    })
  })

  describe('stop', () => {
    it('should stop polling and cleanup', async () => {
      await pollingLoop.start()
      expect(pollingLoop.getIsRunning()).toBe(true)

      await pollingLoop.stop()
      expect(pollingLoop.getIsRunning()).toBe(false)
    })

    it('should do nothing if not running', async () => {
      await expect(pollingLoop.stop()).resolves.not.toThrow()
    })
  })

  describe('forceReconciliation', () => {
    beforeEach(async () => {
      await pollingLoop.start()

      // Wait for initial sync
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    it('should reconcile schedules when running', async () => {
      // Create an orphaned schedule by deleting a rule
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase)
      testEnterpriseIds.push(workflow.enterprise_id!)
      
      // Create schedule
      const scheduleId = getScheduleId(rule as NotificationRule)
      await pollingLoop.forceReconciliation()
      
      // Wait for schedule to be created
      await waitForCondition(async () => {
        const description = await getSchedule(scheduleId)
        return description !== null
      }, 5000)

      // Delete the rule
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .delete()
        .eq('id', rule.id)

      // Force reconciliation
      await pollingLoop.forceReconciliation()

      // Wait for orphaned schedule to be removed
      await waitForCondition(async () => {
        const description = await getSchedule(scheduleId)
        return description === null
      }, 5000)

      // Verify orphaned schedule was removed
      const description = await getSchedule(scheduleId)
      expect(description).toBeNull()
    })

    it('should warn if not running', async () => {
      await pollingLoop.stop()
      await pollingLoop.forceReconciliation()
      // Should complete without error
    })
  })
})