import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Workflow = Database['public']['Tables']['ent_notification_workflow']['Row']
type WorkflowInsert = Database['public']['Tables']['ent_notification_workflow']['Insert']
type WorkflowUpdate = Database['public']['Tables']['ent_notification_workflow']['Update']
type WorkflowType = Workflow['workflow_type']
type PublishStatus = Workflow['publish_status']
type Channel = Workflow['channels'][number]

export class WorkflowService {
  /**
   * Get a single workflow by ID
   */
  static async getWorkflow(
    workflowId: string,
    enterpriseId: string
  ): Promise<Workflow | null> {
    const { data, error } = await supabase
      .from('ent_notification_workflow')
      .select('*')
      .eq('id', workflowId)
      .eq('enterprise_id', enterpriseId)
      .single()

    if (error) {
      console.error('Error fetching workflow:', error)
      return null
    }

    return data
  }

  /**
   * Get workflow by key
   */
  static async getWorkflowByKey(
    workflowKey: string,
    enterpriseId: string
  ): Promise<Workflow | null> {
    const { data, error } = await supabase
      .from('ent_notification_workflow')
      .select('*')
      .eq('workflow_key', workflowKey)
      .eq('enterprise_id', enterpriseId)
      .eq('deactivated', false)
      .single()

    if (error) {
      console.error('Error fetching workflow by key:', error)
      return null
    }

    return data
  }

  /**
   * Get all workflows for an enterprise
   */
  static async getWorkflows(
    enterpriseId: string,
    filters?: {
      workflow_type?: WorkflowType
      publish_status?: PublishStatus
      deactivated?: boolean
      channels?: Channel[]
      tags?: string[]
      limit?: number
      offset?: number
    }
  ): Promise<Workflow[]> {
    let query = supabase
      .from('ent_notification_workflow')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .order('created_at', { ascending: false })

    if (filters?.workflow_type) {
      query = query.eq('workflow_type', filters.workflow_type)
    }

    if (filters?.publish_status) {
      query = query.eq('publish_status', filters.publish_status)
    }

    if (filters?.deactivated !== undefined) {
      query = query.eq('deactivated', filters.deactivated)
    }

    if (filters?.channels && filters.channels.length > 0) {
      query = query.contains('channels', filters.channels)
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching workflows:', error)
      return []
    }

    return data || []
  }

  /**
   * Get all active dynamic workflows
   */
  static async getActiveDynamicWorkflows(
    enterpriseId: string
  ): Promise<Workflow[]> {
    return this.getWorkflows(enterpriseId, {
      workflow_type: 'DYNAMIC',
      publish_status: 'PUBLISHED',
      deactivated: false,
    })
  }

  /**
   * Create a new workflow
   */
  static async createWorkflow(
    workflow: WorkflowInsert
  ): Promise<Workflow | null> {
    const { data, error } = await supabase
      .from('ent_notification_workflow')
      .insert(workflow)
      .select()
      .single()

    if (error) {
      console.error('Error creating workflow:', error)
      return null
    }

    return data
  }

  /**
   * Update a workflow
   */
  static async updateWorkflow(
    workflowId: string,
    enterpriseId: string,
    update: WorkflowUpdate
  ): Promise<Workflow | null> {
    const { data, error } = await supabase
      .from('ent_notification_workflow')
      .update({
        ...update,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId)
      .eq('enterprise_id', enterpriseId)
      .select()
      .single()

    if (error) {
      console.error('Error updating workflow:', error)
      return null
    }

    return data
  }

  /**
   * Publish a workflow
   */
  static async publishWorkflow(
    workflowId: string,
    enterpriseId: string
  ): Promise<Workflow | null> {
    return this.updateWorkflow(workflowId, enterpriseId, {
      publish_status: 'PUBLISHED',
    })
  }

  /**
   * Deactivate a workflow
   */
  static async deactivateWorkflow(
    workflowId: string,
    enterpriseId: string
  ): Promise<Workflow | null> {
    return this.updateWorkflow(workflowId, enterpriseId, {
      deactivated: true,
    })
  }

  /**
   * Reactivate a workflow
   */
  static async reactivateWorkflow(
    workflowId: string,
    enterpriseId: string
  ): Promise<Workflow | null> {
    return this.updateWorkflow(workflowId, enterpriseId, {
      deactivated: false,
    })
  }

  /**
   * Check if workflow key exists
   */
  static async workflowKeyExists(
    workflowKey: string,
    enterpriseId: string,
    excludeId?: string
  ): Promise<boolean> {
    let query = supabase
      .from('ent_notification_workflow')
      .select('id')
      .eq('workflow_key', workflowKey)
      .eq('enterprise_id', enterpriseId)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error checking workflow key:', error)
      return false
    }

    return (data?.length || 0) > 0
  }

  /**
   * Get workflows by tag
   */
  static async getWorkflowsByTag(
    tag: string,
    enterpriseId: string
  ): Promise<Workflow[]> {
    const { data, error } = await supabase
      .from('ent_notification_workflow')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('deactivated', false)
      .contains('tags', [tag])

    if (error) {
      console.error('Error fetching workflows by tag:', error)
      return []
    }

    return data || []
  }

  /**
   * Clone a workflow
   */
  static async cloneWorkflow(
    workflowId: string,
    enterpriseId: string,
    newWorkflowKey: string,
    newWorkflowName: string
  ): Promise<Workflow | null> {
    const original = await this.getWorkflow(workflowId, enterpriseId)
    
    if (!original) {
      return null
    }

    const clone: WorkflowInsert = {
      enterprise_id: enterpriseId,
      workflow_key: newWorkflowKey,
      workflow_name: newWorkflowName,
      workflow_type: original.workflow_type,
      channels: original.channels,
      publish_status: 'DRAFT',
      deactivated: false,
      config: original.config,
      payload_schema: original.payload_schema,
      tags: [...original.tags, 'cloned'],
    }

    return this.createWorkflow(clone)
  }

  /**
   * Get workflow statistics
   */
  static async getWorkflowStats(
    enterpriseId: string
  ): Promise<{
    total: number
    byType: Record<WorkflowType, number>
    byStatus: Record<PublishStatus, number>
    activeCount: number
  }> {
    const workflows = await this.getWorkflows(enterpriseId)

    const stats = {
      total: workflows.length,
      byType: {
        STATIC: 0,
        DYNAMIC: 0,
      } as Record<WorkflowType, number>,
      byStatus: {
        DRAFT: 0,
        PUBLISHED: 0,
      } as Record<PublishStatus, number>,
      activeCount: 0,
    }

    workflows.forEach((workflow) => {
      stats.byType[workflow.workflow_type]++
      stats.byStatus[workflow.publish_status]++
      
      if (!workflow.deactivated && workflow.publish_status === 'PUBLISHED') {
        stats.activeCount++
      }
    })

    return stats
  }
}