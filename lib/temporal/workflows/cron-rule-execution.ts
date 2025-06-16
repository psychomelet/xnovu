import { proxyActivities, sleep } from '@temporalio/workflow'
import type * as activities from '../activities'
import type { RunNotificationRuleParams } from '../activities/notification-rules'

const { runNotificationRule } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
})

export interface CronRuleExecutionParams {
  ruleId: number
  enterpriseId: string
  businessId?: string
}

/**
 * Workflow to execute a CRON rule by creating and triggering a notification
 */
export async function cronRuleExecutionWorkflow(params: CronRuleExecutionParams): Promise<void> {
  const { ruleId, enterpriseId, businessId } = params
  
  try {
    // Execute the rule
    await runNotificationRule({
      ruleId,
      enterpriseId,
      businessId,
    } as RunNotificationRuleParams)
  } catch (error) {
    // Log error and re-throw for visibility in Temporal UI
    console.error(`Failed to execute CRON rule ${ruleId}:`, error)
    throw error
  }
}