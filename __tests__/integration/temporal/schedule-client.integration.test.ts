import {
  getScheduleId,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  listSchedules,
  getSchedule,
} from '@/lib/temporal/client/schedule-client'
import {
  createTestSupabaseClient,
  setupTestWorkflowWithRule,
  cleanupTestRules,
  cleanupTestWorkflows,
} from '../../helpers/supabase-test-helpers'
import type { NotificationRule } from '@/types/rule-engine'

describe('Schedule Client Integration', () => {
  const supabase = createTestSupabaseClient()
  const testEnterpriseIds: string[] = []
  let testRule: NotificationRule
  let testWorkflowId: number

  beforeAll(async () => {
    // Create test data
    const { workflow, rule } = await setupTestWorkflowWithRule(supabase)
    testWorkflowId = workflow.id
    testRule = rule as NotificationRule
    testEnterpriseIds.push(workflow.enterprise_id!)
  })

  afterAll(async () => {
    // Cleanup all test schedules
    try {
      const schedules = await listSchedules()
      for (const schedule of schedules) {
        if (schedule.id.includes('test-')) {
          await deleteSchedule({ id: 0, enterprise_id: '' } as NotificationRule)
        }
      }
    } catch (error) {
      console.error('Failed to cleanup schedules:', error)
    }

    // Cleanup test data
    await cleanupTestRules(supabase, testEnterpriseIds)
    await cleanupTestWorkflows(supabase, testEnterpriseIds)
  })

  describe('getScheduleId', () => {
    it('should generate correct schedule ID', () => {
      const scheduleId = getScheduleId(testRule)
      expect(scheduleId).toBe(`rule-${testRule.id}-${testRule.enterprise_id}`)
    })

    it('should handle null enterprise_id', () => {
      const ruleWithNullEnterprise = { ...testRule, enterprise_id: null }
      const scheduleId = getScheduleId(ruleWithNullEnterprise)
      expect(scheduleId).toBe(`rule-${testRule.id}-null`)
    })
  })

  describe('Schedule lifecycle', () => {
    let scheduleId: string

    beforeEach(() => {
      scheduleId = getScheduleId(testRule)
    })

    afterEach(async () => {
      // Cleanup schedule after each test
      try {
        await deleteSchedule(testRule)
      } catch (error) {
        // Schedule might not exist
      }
    })

    it('should create a schedule with correct configuration', async () => {
      const handle = await createSchedule(testRule)
      expect(handle).toBeDefined()

      // Verify schedule was created
      const description = await getSchedule(scheduleId)
      expect(description).toBeDefined()
      expect(description?.schedule?.spec?.cronExpressions).toContain('0 9 * * MON')
      expect(description?.schedule?.spec?.timezone).toBe('UTC')
      expect(description?.schedule?.state?.paused).toBe(false)
    })

    it('should pause schedule if rule is deactivated', async () => {
      const deactivatedRule = { ...testRule, deactivated: true }
      await createSchedule(deactivatedRule)

      const description = await getSchedule(scheduleId)
      expect(description?.schedule?.state?.paused).toBe(true)
    })

    it('should update existing schedule', async () => {
      // Create initial schedule
      await createSchedule(testRule)

      // Update with different cron
      const updatedRule = {
        ...testRule,
        trigger_config: { cron: '0 10 * * TUE', timezone: 'America/New_York' }
      }
      await updateSchedule(updatedRule)

      const description = await getSchedule(scheduleId)
      expect(description?.schedule?.spec?.cronExpressions).toContain('0 10 * * TUE')
      expect(description?.schedule?.spec?.timezone).toBe('America/New_York')
    })

    it('should create new schedule if not found during update', async () => {
      // Try to update non-existent schedule
      await updateSchedule(testRule)

      const description = await getSchedule(scheduleId)
      expect(description).toBeDefined()
    })

    it('should delete existing schedule', async () => {
      // Create schedule
      await createSchedule(testRule)

      // Delete it
      await deleteSchedule(testRule)

      const description = await getSchedule(scheduleId)
      expect(description).toBeNull()
    })

    it('should not throw if schedule not found during delete', async () => {
      // Try to delete non-existent schedule
      await expect(deleteSchedule(testRule)).resolves.not.toThrow()
    })

    it('should throw error if trigger_config is invalid', async () => {
      const invalidRule = { ...testRule, trigger_config: null }
      await expect(createSchedule(invalidRule)).rejects.toThrow(
        'Invalid trigger config for rule'
      )
    })

    it('should use UTC timezone if not specified', async () => {
      const ruleWithoutTimezone = {
        ...testRule,
        trigger_config: { cron: '0 9 * * MON' }
      }
      await createSchedule(ruleWithoutTimezone)

      const description = await getSchedule(scheduleId)
      expect(description?.schedule?.spec?.timezone).toBe('UTC')
    })
  })

  describe('listSchedules', () => {
    const createdScheduleIds: string[] = []

    beforeAll(async () => {
      // Create multiple schedules
      for (let i = 0; i < 3; i++) {
        const { workflow, rule } = await setupTestWorkflowWithRule(supabase)
        testEnterpriseIds.push(workflow.enterprise_id!)
        
        await createSchedule(rule as NotificationRule)
        createdScheduleIds.push(getScheduleId(rule as NotificationRule))
      }
    })

    afterAll(async () => {
      // Cleanup created schedules
      for (const scheduleId of createdScheduleIds) {
        try {
          const parts = scheduleId.split('-')
          if (parts.length >= 3) {
            const ruleId = parseInt(parts[1], 10)
            const enterpriseId = parts.slice(2).join('-')
            await deleteSchedule({
              id: ruleId,
              enterprise_id: enterpriseId,
            } as NotificationRule)
          }
        } catch (error) {
          console.error(`Failed to delete schedule ${scheduleId}:`, error)
        }
      }
    })

    it('should list all schedules with descriptions', async () => {
      const schedules = await listSchedules()
      
      expect(schedules.length).toBeGreaterThanOrEqual(3)
      
      // Verify our test schedules are included
      const testSchedules = schedules.filter(s => 
        createdScheduleIds.includes(s.id)
      )
      expect(testSchedules.length).toBe(3)
      
      // Each should have a description
      for (const schedule of testSchedules) {
        expect(schedule.description).toBeDefined()
        expect(schedule.description.schedule).toBeDefined()
      }
    })
  })

  describe('getSchedule', () => {
    let scheduleId: string

    beforeAll(async () => {
      scheduleId = getScheduleId(testRule)
      await createSchedule(testRule)
    })

    afterAll(async () => {
      await deleteSchedule(testRule)
    })

    it('should get schedule description', async () => {
      const description = await getSchedule(scheduleId)
      
      expect(description).toBeDefined()
      expect(description?.schedule?.spec).toBeDefined()
      expect(description?.schedule?.state).toBeDefined()
      expect(description?.memo).toMatchObject({
        ruleId: testRule.id,
        enterpriseId: testRule.enterprise_id,
        ruleName: testRule.name,
      })
    })

    it('should return null if schedule not found', async () => {
      const result = await getSchedule('non-existent-schedule-id')
      expect(result).toBeNull()
    })
  })
})