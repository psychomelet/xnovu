import { Client, ScheduleHandle } from '@temporalio/client'
import { getTemporalClient, getTemporalConnection } from './client'
import { fetchAllCronRules } from './activities/notification-rules'
import { CronTriggerConfig } from '@/types/rule-engine'
import { cronRuleExecutionWorkflow, type CronRuleExecutionParams } from './workflows/cron-rule-execution'

export interface SyncCronRulesOptions {
  namespace?: string
  enterpriseId?: string
  dryRun?: boolean
}

export interface SyncCronRulesResult {
  created: string[]
  updated: string[]
  deleted: string[]
  errors: Array<{ ruleId: string; error: string }>
}

/**
 * Sync all CRON rules from the database to Temporal schedules
 */
export async function syncCronRulesToTemporal(options: SyncCronRulesOptions = {}): Promise<SyncCronRulesResult> {
  const { namespace = process.env.TEMPORAL_NAMESPACE || 'default', enterpriseId, dryRun = false } = options
  
  const result: SyncCronRulesResult = {
    created: [],
    updated: [],
    deleted: [],
    errors: [],
  }

  try {
    // Get Temporal client with the specified namespace
    const connection = await getTemporalConnection()
    const client = new Client({
      connection,
      namespace: namespace || process.env.TEMPORAL_NAMESPACE || 'default',
    })

    // Fetch all active CRON rules from the database
    const rules = await fetchAllCronRules(enterpriseId)
    
    // Get all existing schedules from Temporal
    const existingSchedules = new Map<string, ScheduleHandle>()
    const schedulePrefix = enterpriseId ? `cron-rule-${enterpriseId}-` : 'cron-rule-'
    
    for await (const schedule of client.schedule.list()) {
      if (schedule.scheduleId.startsWith(schedulePrefix)) {
        existingSchedules.set(schedule.scheduleId, client.schedule.getHandle(schedule.scheduleId))
      }
    }

    // Process each rule
    for (const rule of rules) {
      const scheduleId = `cron-rule-${rule.enterprise_id}-${rule.id}`
      
      try {
        const triggerConfig = rule.trigger_config as unknown as CronTriggerConfig
        if (!triggerConfig?.cron) {
          result.errors.push({
            ruleId: rule.id.toString(),
            error: 'Invalid cron configuration',
          })
          continue
        }

        const scheduleSpec = {
          scheduleId,
          spec: {
            cronExpressions: [triggerConfig.cron],
            timezone: triggerConfig.timezone || 'UTC',
          },
          action: {
            type: 'startWorkflow' as const,
            workflowType: cronRuleExecutionWorkflow,
            args: [{
              ruleId: rule.id,
              enterpriseId: rule.enterprise_id!,
              businessId: rule.business_id || undefined,
            }] as [CronRuleExecutionParams],
            taskQueue: 'notification-queue',
            workflowId: `${scheduleId}-${Date.now()}`,
          },
          state: {
            paused: triggerConfig.enabled === false,
          },
          memo: {
            ruleName: rule.name,
            description: rule.description,
            workflowId: rule.notification_workflow_id,
          },
        }

        if (existingSchedules.has(scheduleId)) {
          // Update existing schedule
          if (!dryRun) {
            const handle = existingSchedules.get(scheduleId)!
            await handle.update((prev) => ({
              ...prev,
              spec: scheduleSpec.spec,
              state: scheduleSpec.state,
              memo: scheduleSpec.memo,
            }))
          }
          result.updated.push(scheduleId)
          existingSchedules.delete(scheduleId)
        } else {
          // Create new schedule
          if (!dryRun) {
            await client.schedule.create(scheduleSpec)
          }
          result.created.push(scheduleId)
        }
      } catch (error) {
        result.errors.push({
          ruleId: rule.id.toString(),
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Delete schedules that no longer have active rules
    for (const [scheduleId, handle] of existingSchedules) {
      try {
        if (!dryRun) {
          await handle.delete()
        }
        result.deleted.push(scheduleId)
      } catch (error) {
        result.errors.push({
          ruleId: scheduleId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return result
  } catch (error) {
    throw new Error(`Failed to sync CRON rules: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Get the status of a specific CRON rule schedule in Temporal
 */
export async function getCronRuleScheduleStatus(
  ruleId: number,
  enterpriseId: string,
  namespace?: string
): Promise<{
  exists: boolean
  paused?: boolean
  nextRun?: Date
  lastRun?: Date
}> {
  const connection = await getTemporalConnection()
  const client = new Client({
    connection,
    namespace: namespace || process.env.TEMPORAL_NAMESPACE || 'default',
  })

  const scheduleId = `cron-rule-${enterpriseId}-${ruleId}`
  
  try {
    const handle = client.schedule.getHandle(scheduleId)
    const description = await handle.describe()
    
    return {
      exists: true,
      paused: description.state.paused,
      nextRun: description.info.nextActionTimes[0],
      lastRun: description.info.recentActions[0]?.scheduledAt,
    }
  } catch (error) {
    return {
      exists: false,
    }
  }
}

/**
 * Manually trigger a CRON rule (run it immediately)
 */
export async function triggerCronRule(
  ruleId: number,
  enterpriseId: string,
  namespace?: string
): Promise<void> {
  const connection = await getTemporalConnection()
  const client = new Client({
    connection,
    namespace: namespace || process.env.TEMPORAL_NAMESPACE || 'default',
  })

  const scheduleId = `cron-rule-${enterpriseId}-${ruleId}`
  
  try {
    const handle = client.schedule.getHandle(scheduleId)
    await handle.trigger()
  } catch (error) {
    throw new Error(`Failed to trigger CRON rule: ${error instanceof Error ? error.message : String(error)}`)
  }
}