import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Template = Database['public']['Tables']['ent_notification_template']['Row']
type TemplateInsert = Database['public']['Tables']['ent_notification_template']['Insert']
type TemplateUpdate = Database['public']['Tables']['ent_notification_template']['Update']
type TemplateType = Template['template_type']

export class TemplateService {
  private static templateCache = new Map<string, { template: Template; expiry: number }>()
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get a single template by ID
   */
  static async getTemplate(
    templateId: string,
    enterpriseId: string
  ): Promise<Template | null> {
    // Check cache first
    const cacheKey = `${enterpriseId}:${templateId}`
    const cached = this.templateCache.get(cacheKey)
    
    if (cached && cached.expiry > Date.now()) {
      return cached.template
    }

    const { data, error } = await supabase
      .from('ent_notification_template')
      .select('*')
      .eq('id', templateId)
      .eq('enterprise_id', enterpriseId)
      .single()

    if (error) {
      console.error('Error fetching template:', error)
      return null
    }

    // Cache the template
    if (data) {
      this.templateCache.set(cacheKey, {
        template: data,
        expiry: Date.now() + this.CACHE_TTL,
      })
    }

    return data
  }

  /**
   * Get templates by name
   */
  static async getTemplateByName(
    templateName: string,
    enterpriseId: string
  ): Promise<Template | null> {
    const { data, error } = await supabase
      .from('ent_notification_template')
      .select('*')
      .eq('template_name', templateName)
      .eq('enterprise_id', enterpriseId)
      .single()

    if (error) {
      console.error('Error fetching template by name:', error)
      return null
    }

    return data
  }

  /**
   * Get all templates for an enterprise
   */
  static async getTemplates(
    enterpriseId: string,
    filters?: {
      template_type?: TemplateType
      search?: string
      limit?: number
      offset?: number
    }
  ): Promise<Template[]> {
    let query = supabase
      .from('ent_notification_template')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .order('created_at', { ascending: false })

    if (filters?.template_type) {
      query = query.eq('template_type', filters.template_type)
    }

    if (filters?.search) {
      query = query.or(
        `template_name.ilike.%${filters.search}%,body_template.ilike.%${filters.search}%`
      )
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching templates:', error)
      return []
    }

    return data || []
  }

  /**
   * Create a new template
   */
  static async createTemplate(
    template: TemplateInsert
  ): Promise<Template | null> {
    const { data, error } = await supabase
      .from('ent_notification_template')
      .insert(template)
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return null
    }

    return data
  }

  /**
   * Update a template
   */
  static async updateTemplate(
    templateId: string,
    enterpriseId: string,
    update: TemplateUpdate
  ): Promise<Template | null> {
    const { data, error } = await supabase
      .from('ent_notification_template')
      .update({
        ...update,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('enterprise_id', enterpriseId)
      .select()
      .single()

    if (error) {
      console.error('Error updating template:', error)
      return null
    }

    // Invalidate cache
    const cacheKey = `${enterpriseId}:${templateId}`
    this.templateCache.delete(cacheKey)

    return data
  }

  /**
   * Delete a template
   */
  static async deleteTemplate(
    templateId: string,
    enterpriseId: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('ent_notification_template')
      .delete()
      .eq('id', templateId)
      .eq('enterprise_id', enterpriseId)

    if (error) {
      console.error('Error deleting template:', error)
      return false
    }

    // Invalidate cache
    const cacheKey = `${enterpriseId}:${templateId}`
    this.templateCache.delete(cacheKey)

    return true
  }

  /**
   * Render a template with variables
   */
  static renderTemplate(
    template: string,
    variables: Record<string, any>
  ): string {
    let rendered = template

    // Handle standard variable replacement {{variableName}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
      rendered = rendered.replace(regex, String(value))
    })

    return rendered
  }

  /**
   * Parse and render xnovu_render syntax
   */
  static async renderXNovuTemplate(
    template: string,
    enterpriseId: string,
    variables: Record<string, any>
  ): Promise<string> {
    const regex = /\{\{\s*xnovu_render\s*\(\s*['"]([^'"]+)['"]\s*,\s*({[^}]+})\s*\)\s*\}\}/g
    
    let result = template
    let match

    const replacements: Array<{ match: string; replacement: string }> = []

    // Find all matches first
    while ((match = regex.exec(template)) !== null) {
      const [fullMatch, templateId, varsJson] = match
      
      try {
        const templateVars = JSON.parse(varsJson)
        
        // Load template from database
        const dbTemplate = await this.getTemplate(templateId, enterpriseId)
        
        if (!dbTemplate) {
          console.warn(`Template ${templateId} not found`)
          continue
        }

        // Merge variables
        const mergedVars = { ...variables, ...templateVars }

        // Recursive rendering
        const rendered = await this.renderXNovuTemplate(
          dbTemplate.body_template,
          enterpriseId,
          mergedVars
        )

        replacements.push({ match: fullMatch, replacement: rendered })
      } catch (error) {
        console.error(`Error parsing template variables: ${varsJson}`, error)
      }
    }

    // Apply all replacements
    replacements.forEach(({ match, replacement }) => {
      result = result.replace(match, replacement)
    })

    // Handle standard variables
    return this.renderTemplate(result, variables)
  }

  /**
   * Validate template syntax
   */
  static validateTemplate(template: string): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Check for unclosed variables
    const openBrackets = (template.match(/\{\{/g) || []).length
    const closeBrackets = (template.match(/\}\}/g) || []).length
    
    if (openBrackets !== closeBrackets) {
      errors.push('Unmatched template brackets')
    }

    // Validate xnovu_render syntax
    const xnovuRegex = /\{\{\s*xnovu_render\s*\(\s*['"]([^'"]+)['"]\s*,\s*({[^}]+})\s*\)\s*\}\}/g
    let xnovuMatch

    while ((xnovuMatch = xnovuRegex.exec(template)) !== null) {
      const [, , varsJson] = xnovuMatch
      
      try {
        JSON.parse(varsJson)
      } catch {
        errors.push(`Invalid JSON in xnovu_render: ${varsJson}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Clone a template
   */
  static async cloneTemplate(
    templateId: string,
    enterpriseId: string,
    newTemplateName: string
  ): Promise<Template | null> {
    const original = await this.getTemplate(templateId, enterpriseId)
    
    if (!original) {
      return null
    }

    const clone: TemplateInsert = {
      enterprise_id: enterpriseId,
      template_name: newTemplateName,
      template_type: original.template_type,
      subject_template: original.subject_template,
      body_template: original.body_template,
      metadata: {
        ...original.metadata,
        cloned_from: templateId,
      },
    }

    return this.createTemplate(clone)
  }

  /**
   * Get template usage statistics
   */
  static async getTemplateUsage(
    templateId: string,
    enterpriseId: string
  ): Promise<number> {
    // This would require joining with notifications table
    // For now, return 0 as placeholder
    // In real implementation, would query notifications that reference this template
    return 0
  }

  /**
   * Clear template cache
   */
  static clearCache(): void {
    this.templateCache.clear()
  }

  /**
   * Get templates by type
   */
  static async getTemplatesByType(
    templateType: TemplateType,
    enterpriseId: string
  ): Promise<Template[]> {
    return this.getTemplates(enterpriseId, { template_type: templateType })
  }
}