import { logger } from '@/app/services/logger'
import { RuleService } from '@/app/services/database/RuleService'
import { RuleEngineError } from '@/types/rule-engine'
import type { RuleScheduledWorkflowInput } from '../workflows/rule-scheduled'
import type { NotificationInsert } from '@/types/rule-engine'

export async function createNotificationFromRule(input: RuleScheduledWorkflowInput): Promise<void> {
  const ruleService = new RuleService()
  
  try {
    logger.info('Creating notification from scheduled rule', {
      ruleId: input.ruleId,
      enterpriseId: input.enterpriseId || 'none',
      workflowId: String(input.workflowId)
    })
    
    // Fetch the rule to ensure it's still active
    if (!input.enterpriseId) {
      throw new RuleEngineError(
        'Enterprise ID is required',
        'INVALID_INPUT',
        input.ruleId
      )
    }
    
    const rule = await ruleService.getRule(input.ruleId, input.enterpriseId)
    
    if (!rule) {
      throw new RuleEngineError(
        `Rule not found: ${input.ruleId}`,
        'RULE_NOT_FOUND',
        input.ruleId,
        input.enterpriseId
      )
    }
    
    // Check if rule is still active
    if (rule.deactivated || rule.publish_status !== 'PUBLISH') {
      logger.warn('Skipping notification for inactive rule', {
        ruleId: input.ruleId,
        deactivated: rule.deactivated,
        publishStatus: rule.publish_status
      })
      return
    }
    
    // Fetch the workflow to ensure it's still active
    const workflow = await ruleService.getWorkflow(input.workflowId, input.enterpriseId)
    
    if (!workflow) {
      throw new RuleEngineError(
        `Workflow not found: ${input.workflowId}`,
        'WORKFLOW_NOT_FOUND',
        input.ruleId,
        input.enterpriseId
      )
    }
    
    // Prepare the notification payload
    const notificationPayload: NotificationInsert = {
      name: `Scheduled: ${rule.name}`,
      description: `Notification triggered by scheduled rule: ${rule.name}`,
      payload: input.rulePayload || {},
      recipients: [], // Recipients should be defined in rule_payload
      notification_workflow_id: input.workflowId,
      notification_rule_id: input.ruleId,
      enterprise_id: input.enterpriseId || undefined,
      business_id: input.businessId || undefined,
      notification_status: 'PENDING',
      publish_status: 'PUBLISH',
      channels: workflow.default_channels || ['IN_APP'],
    }
    
    // Extract recipients from rule payload if available
    if (input.rulePayload && typeof input.rulePayload === 'object') {
      if (Array.isArray(input.rulePayload.recipients)) {
        notificationPayload.recipients = input.rulePayload.recipients
      } else if (input.rulePayload.recipient) {
        notificationPayload.recipients = [input.rulePayload.recipient]
      }
    }
    
    // Validate that we have recipients
    if (notificationPayload.recipients.length === 0) {
      throw new RuleEngineError(
        'No recipients specified in rule payload',
        'NO_RECIPIENTS',
        input.ruleId,
        input.enterpriseId
      )
    }
    
    // Create the notification
    const notification = await ruleService.createNotification(notificationPayload)
    
    logger.info('Created notification from scheduled rule', {
      notificationId: notification.id,
      ruleId: input.ruleId,
      recipients: notificationPayload.recipients.length
    })
  } catch (error) {
    logger.error('Failed to create notification from scheduled rule', {
      ruleId: input.ruleId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  } finally {
    await ruleService.shutdown()
  }
}