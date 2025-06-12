import { Context } from '@temporalio/activity'
import { workflowLoader } from '@/app/services/workflow'
import type { NotificationData, WorkflowConfig } from './supabase'

export interface NovuTriggerParams {
  workflowKey: string
  recipients: string[]
  payload: any
  overrides?: any
  enterpriseId?: string
}

export interface TriggerResult {
  transactionId?: string
  success: boolean
  error?: string
}

export interface RenderedContent {
  workflowKey: string
  recipients: string[]
  payload: any
  overrides: any
}


// Trigger a Novu workflow
export async function triggerNovuWorkflow(
  params: NovuTriggerParams | RenderedContent
): Promise<TriggerResult> {
  Context.current().heartbeat()
  
  try {
    // Load enterprise workflows if needed
    const enterpriseId = 'enterpriseId' in params ? params.enterpriseId : undefined
    if (enterpriseId) {
      await workflowLoader.loadEnterpriseWorkflows(enterpriseId)
    }

    // Get workflow from registry
    const workflow = workflowLoader.getWorkflow(params.workflowKey, enterpriseId)
    if (!workflow) {
      return {
        success: false,
        error: `Workflow '${params.workflowKey}' not found`
      }
    }

    // Trigger the workflow
    const result = await workflow.trigger({
      to: params.recipients.map(id => ({ subscriberId: id })),
      payload: params.payload,
      overrides: params.overrides
    })

    return {
      success: true,
      transactionId: result?.transactionId
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to trigger Novu workflow:', errorMessage)
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

// Trigger a static workflow
export async function triggerStaticWorkflow(
  key: string,
  data: NotificationData
): Promise<TriggerResult> {
  return triggerNovuWorkflow({
    workflowKey: key,
    recipients: data.recipients,
    payload: data.payload,
    overrides: data.overrides,
    enterpriseId: data.enterpriseId
  })
}

// Validate workflow exists
export async function validateWorkflow(
  workflowKey: string,
  enterpriseId?: string
): Promise<boolean> {
  Context.current().heartbeat()
  
  try {
    if (enterpriseId) {
      await workflowLoader.loadEnterpriseWorkflows(enterpriseId)
    }
    
    const workflow = workflowLoader.getWorkflow(workflowKey, enterpriseId)
    return workflow !== null
  } catch (error) {
    console.error('Failed to validate workflow:', error)
    return false
  }
}

// Get workflow statistics
export async function getWorkflowStats() {
  Context.current().heartbeat()
  
  return workflowLoader.getStats()
}