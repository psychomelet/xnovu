import { ScheduleClient, ScheduleHandle, ScheduleDescription } from '@temporalio/client'
import { getTemporalConnection } from './index'
import { logger } from '@/app/services/logger'
import type { NotificationRule } from '@/types/rule-engine'

let scheduleClient: ScheduleClient | null = null

export async function getScheduleClient(): Promise<ScheduleClient> {
  if (!scheduleClient) {
    const connection = await getTemporalConnection()
    const namespace = process.env.TEMPORAL_NAMESPACE || 'default'
    
    scheduleClient = new ScheduleClient({
      connection,
      namespace,
    })
  }
  return scheduleClient
}

export function getScheduleId(rule: NotificationRule): string {
  return `rule-${rule.id}-${rule.enterprise_id}`
}

export async function createSchedule(rule: NotificationRule): Promise<ScheduleHandle> {
  const client = await getScheduleClient()
  const scheduleId = getScheduleId(rule)
  
  if (!rule.trigger_config || typeof rule.trigger_config !== 'object') {
    throw new Error(`Invalid trigger config for rule ${rule.id}`)
  }
  
  const triggerConfig = rule.trigger_config as any
  const cronExpression = triggerConfig.cron
  const timezone = triggerConfig.timezone || 'UTC'
  
  logger.info('Creating Temporal schedule', {
    scheduleId,
    ruleId: rule.id,
    cronExpression,
    timezone
  })
  
  const handle = await client.create({
    scheduleId,
    spec: {
      cronExpressions: [cronExpression],
      timezone: timezone,
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'ruleScheduledWorkflow',
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'notifications',
      args: [{
        ruleId: rule.id,
        enterpriseId: rule.enterprise_id,
        businessId: rule.business_id,
        workflowId: rule.notification_workflow_id,
        rulePayload: rule.rule_payload,
      }],
    },
    memo: {
      ruleId: rule.id,
      enterpriseId: rule.enterprise_id,
      ruleName: rule.name,
    },
    state: {
      paused: rule.deactivated || rule.publish_status !== 'PUBLISH',
      note: `Notification rule: ${rule.name}`,
    },
  })
  
  return handle
}

export async function updateSchedule(rule: NotificationRule): Promise<void> {
  const client = await getScheduleClient()
  const scheduleId = getScheduleId(rule)
  
  try {
    const handle = client.getHandle(scheduleId)
    
    if (!rule.trigger_config || typeof rule.trigger_config !== 'object') {
      throw new Error(`Invalid trigger config for rule ${rule.id}`)
    }
    
    const triggerConfig = rule.trigger_config as any
    const cronExpression = triggerConfig.cron
    const timezone = triggerConfig.timezone || 'UTC'
    
    logger.info('Updating Temporal schedule', {
      scheduleId,
      ruleId: rule.id,
      cronExpression,
      timezone
    })
    
    await handle.update((prev) => {
      return {
        ...prev,
        spec: {
          ...prev.spec,
          cronExpressions: [cronExpression],
          timezone: timezone,
        },
        action: {
          ...prev.action,
          type: 'startWorkflow',
          workflowType: 'ruleScheduledWorkflow',
          args: [{
            ruleId: rule.id,
            enterpriseId: rule.enterprise_id,
            businessId: rule.business_id,
            workflowId: rule.notification_workflow_id,
            rulePayload: rule.rule_payload,
          }],
        },
        state: {
          ...prev.state,
          paused: rule.deactivated || rule.publish_status !== 'PUBLISH',
          note: `Notification rule: ${rule.name}`,
        },
      }
    })
  } catch (error: any) {
    if (error?.code === 5) { // NOT_FOUND
      logger.warn('Schedule not found, creating new one', { scheduleId })
      await createSchedule(rule)
    } else {
      throw error
    }
  }
}

export async function deleteSchedule(rule: NotificationRule): Promise<void> {
  const client = await getScheduleClient()
  const scheduleId = getScheduleId(rule)
  
  try {
    const handle = client.getHandle(scheduleId)
    
    logger.info('Deleting Temporal schedule', {
      scheduleId,
      ruleId: rule.id
    })
    
    await handle.delete()
  } catch (error: any) {
    if (error?.code === 5) { // NOT_FOUND
      logger.warn('Schedule not found, already deleted', { scheduleId })
    } else {
      throw error
    }
  }
}

export async function listSchedules(): Promise<Array<{ id: string; description: ScheduleDescription }>> {
  const client = await getScheduleClient()
  const schedules: Array<{ id: string; description: ScheduleDescription }> = []
  
  for await (const scheduleSummary of client.list()) {
    try {
      const handle = client.getHandle(scheduleSummary.scheduleId)
      const description = await handle.describe()
      schedules.push({
        id: scheduleSummary.scheduleId,
        description,
      })
    } catch (error) {
      logger.warn('Failed to describe schedule', {
        scheduleId: scheduleSummary.scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
  
  return schedules
}

export async function getSchedule(scheduleId: string): Promise<ScheduleDescription | null> {
  const client = await getScheduleClient()
  
  try {
    const handle = client.getHandle(scheduleId)
    return await handle.describe()
  } catch (error: any) {
    if (error?.code === 5) { // NOT_FOUND
      return null
    }
    throw error
  }
}