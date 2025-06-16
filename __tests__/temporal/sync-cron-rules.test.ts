import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { Client } from '@temporalio/client'
import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/database.types'
import { getTemporalConnection } from '@/lib/temporal/client'
import {
  syncCronRulesToTemporal,
  getCronRuleScheduleStatus,
  triggerCronRule
} from '@/lib/temporal/sync-cron-rules'

type NotificationWorkflow = Database['notify']['Tables']['ent_notification_workflow']['Insert']
type NotificationRule = Database['notify']['Tables']['ent_notification_rule']['Insert']

describe('CRON Rule Sync to Temporal', () => {
  let testEnterpriseId: string
  let testWorkflowId: number
  let testRuleIds: number[] = []
  let createdScheduleIds: string[] = []
  let temporalClient: Client

  beforeAll(async () => {
    // Skip if Temporal is not available
    if (!process.env.TEMPORAL_ADDRESS) {
      console.warn('Skipping Temporal sync tests - TEMPORAL_ADDRESS not configured')
      return
    }
    
    // Get temporal client
    try {
      const connection = await getTemporalConnection()
      temporalClient = new Client({ connection })
    } catch (error) {
      console.warn('Failed to connect to Temporal:', error)
      return
    }

    // Create test enterprise
    const { data: enterprise, error: enterpriseError } = await supabase
      .schema('base')
      .from('ent_enterprise')
      .insert({
        name: 'Test Enterprise for CRON Sync',
        status: 'ACTIVE'
      })
      .select()
      .single()

    if (enterpriseError) throw enterpriseError
    testEnterpriseId = enterprise.id

    // Create test workflow
    const workflowData: NotificationWorkflow = {
      workflow_key: 'test-cron-sync-workflow',
      name: 'Test CRON Sync Workflow',
      description: 'Workflow for testing CRON sync',
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
  })

  afterAll(async () => {
    // Clean up Temporal schedules
    try {
      for (const scheduleId of createdScheduleIds) {
        try {
          const handle = temporalClient.schedule.getHandle(scheduleId)
          await handle.delete()
        } catch (error) {
          // Schedule might already be deleted
        }
      }
    } catch (error) {
      console.error('Error cleaning up Temporal schedules:', error)
    }

    // Clean up test rules
    if (testRuleIds.length > 0) {
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .delete()
        .in('id', testRuleIds)
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

  beforeEach(async () => {
    // Clean up any leftover schedules from previous test runs
    const schedulePrefix = `cron-rule-${testEnterpriseId}-`
    for await (const schedule of temporalClient.schedule.list()) {
      if (schedule.scheduleId.startsWith(schedulePrefix)) {
        try {
          const handle = temporalClient.schedule.getHandle(schedule.scheduleId)
          await handle.delete()
        } catch (error) {
          // Ignore errors
        }
      }
    }
  })

  describe('syncCronRulesToTemporal', () => {
    it('should create schedules for new CRON rules', async () => {
      // Create test CRON rules
      const rules: NotificationRule[] = [
        {
          name: 'Daily Morning Report',
          description: 'Send daily report at 9 AM',
          publish_status: 'PUBLISH',
          deactivated: false,
          notification_workflow_id: testWorkflowId,
          trigger_type: 'CRON',
          trigger_config: { cron: '0 9 * * *', timezone: 'UTC', enabled: true },
          enterprise_id: testEnterpriseId
        },
        {
          name: 'Weekly Summary',
          description: 'Send weekly summary on Mondays',
          publish_status: 'PUBLISH',
          deactivated: false,
          notification_workflow_id: testWorkflowId,
          trigger_type: 'CRON',
          trigger_config: { cron: '0 10 * * MON', timezone: 'America/New_York', enabled: true },
          enterprise_id: testEnterpriseId
        }
      ]

      for (const rule of rules) {
        const { data, error } = await supabase
          .schema('notify')
          .from('ent_notification_rule')
          .insert(rule)
          .select()
          .single()

        if (error) throw error
        testRuleIds.push(data.id)
      }

      // Sync rules to Temporal
      const result = await syncCronRulesToTemporal({
        enterpriseId: testEnterpriseId
      })

      // Verify results
      expect(result.created.length).toBe(2)
      expect(result.updated.length).toBe(0)
      expect(result.deleted.length).toBe(0)
      expect(result.errors.length).toBe(0)

      // Track created schedules for cleanup
      createdScheduleIds.push(...result.created)

      // Verify schedules exist in Temporal
      for (const ruleId of testRuleIds) {
        const scheduleId = `cron-rule-${testEnterpriseId}-${ruleId}`
        const handle = temporalClient.schedule.getHandle(scheduleId)
        const description = await handle.describe()
        
        expect(description).toBeDefined()
        expect(description.scheduleId).toBe(scheduleId)
        expect(description.spec.cronExpressions).toBeDefined()
        expect(description.spec.cronExpressions!.length).toBeGreaterThan(0)
      }
    })

    it('should update existing schedules when rules change', async () => {
      // First sync
      const firstResult = await syncCronRulesToTemporal({
        enterpriseId: testEnterpriseId
      })

      expect(firstResult.created.length).toBeGreaterThan(0)

      // Update one of the rules
      const ruleToUpdate = testRuleIds[0]
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({
          trigger_config: { cron: '0 15 * * *', timezone: 'UTC', enabled: true }
        })
        .eq('id', ruleToUpdate)

      // Second sync should update
      const secondResult = await syncCronRulesToTemporal({
        enterpriseId: testEnterpriseId
      })

      expect(secondResult.created.length).toBe(0)
      expect(secondResult.updated.length).toBeGreaterThan(0)
      expect(secondResult.deleted.length).toBe(0)

      // Verify the schedule was updated
      const scheduleId = `cron-rule-${testEnterpriseId}-${ruleToUpdate}`
      const handle = temporalClient.schedule.getHandle(scheduleId)
      const description = await handle.describe()
      
      expect(description.spec.cronExpressions![0]).toBe('0 15 * * *')
    })

    it('should delete schedules for deactivated rules', async () => {
      // Deactivate one rule
      const ruleToDeactivate = testRuleIds[0]
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({ deactivated: true })
        .eq('id', ruleToDeactivate)

      // Sync should delete the schedule
      const result = await syncCronRulesToTemporal({
        enterpriseId: testEnterpriseId
      })

      expect(result.deleted.length).toBeGreaterThan(0)
      expect(result.deleted).toContain(`cron-rule-${testEnterpriseId}-${ruleToDeactivate}`)

      // Verify schedule no longer exists
      const scheduleId = `cron-rule-${testEnterpriseId}-${ruleToDeactivate}`
      await expect(
        temporalClient.schedule.getHandle(scheduleId).describe()
      ).rejects.toThrow()

      // Reactivate for cleanup
      await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .update({ deactivated: false })
        .eq('id', ruleToDeactivate)
    })

    it('should handle dry run mode without making changes', async () => {
      // Get current state
      const beforeSchedules: string[] = []
      for await (const schedule of temporalClient.schedule.list()) {
        if (schedule.scheduleId.startsWith(`cron-rule-${testEnterpriseId}-`)) {
          beforeSchedules.push(schedule.scheduleId)
        }
      }

      // Run sync in dry run mode
      const result = await syncCronRulesToTemporal({
        enterpriseId: testEnterpriseId,
        dryRun: true
      })

      // Verify results show what would happen
      expect(result.created.length + result.updated.length + result.deleted.length).toBeGreaterThan(0)

      // Verify no actual changes were made
      const afterSchedules: string[] = []
      for await (const schedule of temporalClient.schedule.list()) {
        if (schedule.scheduleId.startsWith(`cron-rule-${testEnterpriseId}-`)) {
          afterSchedules.push(schedule.scheduleId)
        }
      }

      expect(afterSchedules.sort()).toEqual(beforeSchedules.sort())
    })

    it('should handle rules with invalid CRON expressions', async () => {
      // Create rule with invalid CRON
      const invalidRule: NotificationRule = {
        name: 'Invalid CRON Rule',
        description: 'Rule with invalid CRON expression',
        publish_status: 'PUBLISH',
        deactivated: false,
        notification_workflow_id: testWorkflowId,
        trigger_type: 'CRON',
        trigger_config: { cron: 'invalid cron expression' },
        enterprise_id: testEnterpriseId
      }

      const { data, error } = await supabase
        .schema('notify')
        .from('ent_notification_rule')
        .insert(invalidRule)
        .select()
        .single()

      if (error) throw error
      testRuleIds.push(data.id)

      // Sync should report error for invalid rule
      const result = await syncCronRulesToTemporal({
        enterpriseId: testEnterpriseId
      })

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.ruleId === data.id.toString())).toBe(true)
    })
  })

  describe('getCronRuleScheduleStatus', () => {
    it('should return status for existing schedule', async () => {
      // Ensure we have a synced rule
      await syncCronRulesToTemporal({ enterpriseId: testEnterpriseId })

      const ruleId = testRuleIds[0]
      const status = await getCronRuleScheduleStatus(ruleId, testEnterpriseId)

      expect(status.exists).toBe(true)
      expect(status.paused).toBeDefined()
      expect(status.nextRun).toBeDefined()
    })

    it('should return not exists for non-existent schedule', async () => {
      const status = await getCronRuleScheduleStatus(999999, testEnterpriseId)
      
      expect(status.exists).toBe(false)
      expect(status.paused).toBeUndefined()
      expect(status.nextRun).toBeUndefined()
    })
  })

  describe('triggerCronRule', () => {
    it('should manually trigger a CRON rule', async () => {
      // Ensure we have a synced rule
      await syncCronRulesToTemporal({ enterpriseId: testEnterpriseId })

      const ruleId = testRuleIds[0]
      
      // This should not throw
      await expect(
        triggerCronRule(ruleId, testEnterpriseId)
      ).resolves.not.toThrow()

      // Note: We can't easily verify the workflow was triggered without
      // waiting for it to complete, which would make the test slow
    })

    it('should fail for non-existent schedule', async () => {
      await expect(
        triggerCronRule(999999, testEnterpriseId)
      ).rejects.toThrow(/Failed to trigger CRON rule/)
    })
  })

  describe('namespace support', () => {
    it('should sync to a custom namespace', async () => {
      const customNamespace = process.env.TEMPORAL_NAMESPACE || 'default'
      
      const result = await syncCronRulesToTemporal({
        enterpriseId: testEnterpriseId,
        namespace: customNamespace
      })

      expect(result.errors.length).toBe(0)
      
      // Verify schedule exists in the namespace
      const status = await getCronRuleScheduleStatus(
        testRuleIds[0],
        testEnterpriseId,
        customNamespace
      )
      
      expect(status.exists).toBe(true)
    })
  })
})