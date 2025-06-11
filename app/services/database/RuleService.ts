import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Rule = Database['public']['Tables']['ent_notification_rule']['Row']
type RuleInsert = Database['public']['Tables']['ent_notification_rule']['Insert']
type RuleUpdate = Database['public']['Tables']['ent_notification_rule']['Update']
type TriggerType = Rule['trigger_type']

export class RuleService {
  /**
   * Get a single rule by ID
   */
  static async getRule(
    ruleId: string,
    enterpriseId: string
  ): Promise<Rule | null> {
    const { data, error } = await supabase
      .from('ent_notification_rule')
      .select('*')
      .eq('id', ruleId)
      .eq('enterprise_id', enterpriseId)
      .single()

    if (error) {
      console.error('Error fetching rule:', error)
      return null
    }

    return data
  }

  /**
   * Get all rules for an enterprise
   */
  static async getRules(
    enterpriseId: string,
    filters?: {
      trigger_type?: TriggerType
      workflow_key?: string
      enabled?: boolean
      limit?: number
      offset?: number
    }
  ): Promise<Rule[]> {
    let query = supabase
      .from('ent_notification_rule')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .order('created_at', { ascending: false })

    if (filters?.trigger_type) {
      query = query.eq('trigger_type', filters.trigger_type)
    }

    if (filters?.workflow_key) {
      query = query.eq('workflow_key', filters.workflow_key)
    }

    if (filters?.enabled !== undefined) {
      query = query.eq('enabled', filters.enabled)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching rules:', error)
      return []
    }

    return data || []
  }

  /**
   * Get all active rules
   */
  static async getActiveRules(
    enterpriseId: string
  ): Promise<Rule[]> {
    return this.getRules(enterpriseId, { enabled: true })
  }

  /**
   * Get scheduled rules (for cron processing)
   */
  static async getScheduledRules(
    enterpriseId: string
  ): Promise<Rule[]> {
    return this.getRules(enterpriseId, {
      trigger_type: 'SCHEDULE',
      enabled: true,
    })
  }

  /**
   * Get event-based rules
   */
  static async getEventRules(
    enterpriseId: string,
    eventName?: string
  ): Promise<Rule[]> {
    let query = supabase
      .from('ent_notification_rule')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('trigger_type', 'EVENT')
      .eq('enabled', true)

    if (eventName) {
      query = query.eq('trigger_config->>event_name', eventName)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching event rules:', error)
      return []
    }

    return data || []
  }

  /**
   * Create a new rule
   */
  static async createRule(
    rule: RuleInsert
  ): Promise<Rule | null> {
    const { data, error } = await supabase
      .from('ent_notification_rule')
      .insert(rule)
      .select()
      .single()

    if (error) {
      console.error('Error creating rule:', error)
      return null
    }

    return data
  }

  /**
   * Update a rule
   */
  static async updateRule(
    ruleId: string,
    enterpriseId: string,
    update: RuleUpdate
  ): Promise<Rule | null> {
    const { data, error } = await supabase
      .from('ent_notification_rule')
      .update({
        ...update,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ruleId)
      .eq('enterprise_id', enterpriseId)
      .select()
      .single()

    if (error) {
      console.error('Error updating rule:', error)
      return null
    }

    return data
  }

  /**
   * Enable a rule
   */
  static async enableRule(
    ruleId: string,
    enterpriseId: string
  ): Promise<Rule | null> {
    return this.updateRule(ruleId, enterpriseId, { enabled: true })
  }

  /**
   * Disable a rule
   */
  static async disableRule(
    ruleId: string,
    enterpriseId: string
  ): Promise<Rule | null> {
    return this.updateRule(ruleId, enterpriseId, { enabled: false })
  }

  /**
   * Delete a rule
   */
  static async deleteRule(
    ruleId: string,
    enterpriseId: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('ent_notification_rule')
      .delete()
      .eq('id', ruleId)
      .eq('enterprise_id', enterpriseId)

    if (error) {
      console.error('Error deleting rule:', error)
      return false
    }

    return true
  }

  /**
   * Validate rule configuration
   */
  static validateRule(rule: RuleInsert | Rule): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Validate trigger configuration
    if (rule.trigger_type === 'EVENT') {
      if (!rule.trigger_config.event_name) {
        errors.push('Event-based rules must have an event_name')
      }
    } else if (rule.trigger_type === 'SCHEDULE') {
      if (!rule.trigger_config.cron) {
        errors.push('Scheduled rules must have a cron expression')
      } else {
        // Basic cron validation (more comprehensive validation could be added)
        const cronParts = rule.trigger_config.cron.split(' ')
        if (cronParts.length < 5 || cronParts.length > 6) {
          errors.push('Invalid cron expression')
        }
      }
    }

    // Validate rule payload (basic check)
    if (!rule.rule_payload || rule.rule_payload.trim() === '') {
      errors.push('Rule payload cannot be empty')
    }

    // Validate workflow key
    if (!rule.workflow_key || rule.workflow_key.trim() === '') {
      errors.push('Workflow key is required')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Test rule execution (dry run)
   */
  static async testRule(
    ruleId: string,
    enterpriseId: string,
    testContext?: Record<string, any>
  ): Promise<{
    success: boolean
    result?: any
    error?: string
  }> {
    const rule = await this.getRule(ruleId, enterpriseId)
    
    if (!rule) {
      return {
        success: false,
        error: 'Rule not found',
      }
    }

    try {
      // In a real implementation, this would execute the rule payload
      // in a sandboxed environment with the provided context
      // For now, we'll just validate the rule
      const validation = this.validateRule(rule)
      
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
        }
      }

      return {
        success: true,
        result: {
          message: 'Rule validation passed',
          testContext,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get rules by workflow
   */
  static async getRulesByWorkflow(
    workflowKey: string,
    enterpriseId: string
  ): Promise<Rule[]> {
    return this.getRules(enterpriseId, { workflow_key: workflowKey })
  }

  /**
   * Clone a rule
   */
  static async cloneRule(
    ruleId: string,
    enterpriseId: string,
    newRuleName: string
  ): Promise<Rule | null> {
    const original = await this.getRule(ruleId, enterpriseId)
    
    if (!original) {
      return null
    }

    const clone: RuleInsert = {
      enterprise_id: enterpriseId,
      rule_name: newRuleName,
      trigger_type: original.trigger_type,
      trigger_config: original.trigger_config,
      rule_payload: original.rule_payload,
      workflow_key: original.workflow_key,
      enabled: false, // Start disabled for safety
    }

    return this.createRule(clone)
  }

  /**
   * Get rule execution history (placeholder)
   */
  static async getRuleExecutionHistory(
    ruleId: string,
    enterpriseId: string,
    limit: number = 100
  ): Promise<any[]> {
    // This would require a separate execution history table
    // For now, return empty array as placeholder
    return []
  }

  /**
   * Update rule execution timestamp
   */
  static async updateRuleLastExecution(
    ruleId: string,
    enterpriseId: string
  ): Promise<Rule | null> {
    // This would update a last_executed_at field
    // For now, just update the updated_at timestamp
    return this.updateRule(ruleId, enterpriseId, {})
  }
}