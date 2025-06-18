import { proxyActivities } from '@temporalio/workflow'
import type * as activities from '../activities/rule-scheduled'

const { createNotificationFromRule } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
})

export interface RuleScheduledWorkflowInput {
  ruleId: number
  enterpriseId: string | null
  businessId: string | null
  workflowId: number
  rulePayload: any
}

export async function ruleScheduledWorkflow(input: RuleScheduledWorkflowInput): Promise<void> {
  await createNotificationFromRule(input)
}