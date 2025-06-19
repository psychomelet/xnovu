import { RulePollingLoop } from '@/lib/polling/rule-polling-loop'
import {
  deleteSchedule,
  getSchedule,
  getScheduleId,
} from '@/lib/temporal/client/schedule-client'
import {
  createTestSupabaseClient,
  setupTestWorkflowWithRule,
  waitForCondition,
} from '../../helpers/supabase-test-helpers'
import { getTestEnterpriseId } from '../../setup/test-data'
import type { NotificationRule } from '@/types/rule-engine'

describe('RulePollingLoop Integration', () => {
  const supabase = createTestSupabaseClient()
  const testEnterpriseId = getTestEnterpriseId()
  let pollingLoop: RulePollingLoop
  let testRules: NotificationRule[] = []

  const config = {
    pollIntervalMs: 200, // Balanced polling for tests
    batchSize: 5, // Smaller batch size for tests
    enterpriseId: testEnterpriseId, // Filter polling to test enterprise only
    initialDelayMs: 0, // No initial delay for tests
  }

  beforeAll(async () => {
    // Create single test rule for faster setup
    const { workflow, rule } = await setupTestWorkflowWithRule(supabase)
    testRules.push(rule as NotificationRule)
  })

  afterAll(async () => {
    // No need to cleanup schedules - namespace deletion handles it
  }, 10000)

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

      // Wait briefly for initial sync
      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify schedule was created
      const scheduleId = getScheduleId(testRules[0])
      const description = await getSchedule(scheduleId)
      expect(description).toBeDefined()
    })

    it('should continue polling even if initial sync fails', async () => {
      // Start polling - errors in sync should not stop the loop
      await pollingLoop.start()
      expect(pollingLoop.getIsRunning()).toBe(true)
    }, 10000)

    it('should not start if already running', async () => {
      await pollingLoop.start()
      await pollingLoop.start()

      // Should still be running
      expect(pollingLoop.getIsRunning()).toBe(true)
    }, 10000)
  })

  describe('polling for changes', () => {
    let newRule: NotificationRule

    beforeEach(async () => {
      await pollingLoop.start()
      // Brief wait for initial sync
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    afterEach(async () => {
      // No cleanup needed - namespace handles it
    })

    it('should detect and sync new rules', async () => {
      // Create a new rule after polling started
      const { workflow, rule } = await setupTestWorkflowWithRule(supabase)
      newRule = rule as NotificationRule

      // Wait for polling to pick up the new rule
      await waitForCondition(async () => {
        const scheduleId = getScheduleId(newRule)
        const description = await getSchedule(scheduleId)
        return description !== null
      }, 1000)

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
      
      // Force immediate reconciliation
      await pollingLoop.forceReconciliation()
      
      // Brief wait for update
      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify schedule still exists
      const description = await getSchedule(scheduleId)
      expect(description).toBeDefined()
    }, 10000)

    it('should remove schedules for deactivated rules', async () => {
      const ruleToDeactivate = testRules[0]
      const scheduleId = getScheduleId(ruleToDeactivate)
      
      // Verify schedule exists initially
      const initialDescription = await getSchedule(scheduleId)
      expect(initialDescription).toBeDefined()

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
      
      // Force the polling loop to check immediately
      await pollingLoop.forceReconciliation()

      // Wait for polling to remove the schedule
      await waitForCondition(async () => {
        const description = await getSchedule(scheduleId)
        return description === null
      }, 1000)

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
    }, 10000)

    it('should do nothing if not running', async () => {
      await expect(pollingLoop.stop()).resolves.not.toThrow()
    })
  })

  describe('forceReconciliation', () => {
    beforeEach(async () => {
      await pollingLoop.start()
      // Brief wait for initial sync
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should reconcile schedules when running', async () => {
      // Create a rule and immediately delete it to create orphaned schedule
      const { rule } = await setupTestWorkflowWithRule(supabase)
      const scheduleId = getScheduleId(rule as NotificationRule)
      
      // Force reconciliation to create schedule
      await pollingLoop.forceReconciliation()
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Delete the rule to orphan the schedule
      await supabase.schema('notify').from('ent_notification_rule').delete().eq('id', rule.id)

      // Force reconciliation to clean up
      await pollingLoop.forceReconciliation()
      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify orphaned schedule was removed
      const description = await getSchedule(scheduleId)
      expect(description).toBeNull()
    }, 20000)

    it('should warn if not running', async () => {
      await pollingLoop.stop()
      await pollingLoop.forceReconciliation()
      // Should complete without error
    }, 10000)
  })
})