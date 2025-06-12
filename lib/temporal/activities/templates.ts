import { Context } from '@temporalio/activity'
import type { Template, NotificationData } from './supabase'
import type { RenderedContent } from './novu'

// Template rendering function
function renderTemplate(template: string, data: any): string {
  return template.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const keys = key.trim().split('.')
    let value = data
    
    for (const k of keys) {
      value = value?.[k]
    }
    
    return value !== undefined ? String(value) : match
  })
}

// Render all templates for a notification
export async function renderTemplates(
  templates: Template[],
  notification: NotificationData
): Promise<RenderedContent> {
  Context.current().heartbeat()
  
  const renderedOverrides: any = {
    email: {},
    sms: {},
    push: {},
    in_app: {},
    chat: {}
  }

  // Process each template
  for (const template of templates) {
    const channel = template.channel.toLowerCase()
    
    if (!renderedOverrides[channel]) {
      renderedOverrides[channel] = {}
    }

    // Render template content based on type
    if (typeof template.content === 'string') {
      renderedOverrides[channel].body = renderTemplate(
        template.content,
        notification.payload
      )
    } else if (typeof template.content === 'object') {
      // Handle complex template structures
      const rendered: any = {}
      
      for (const [key, value] of Object.entries(template.content)) {
        if (typeof value === 'string') {
          rendered[key] = renderTemplate(value, notification.payload)
        } else {
          rendered[key] = value
        }
      }
      
      Object.assign(renderedOverrides[channel], rendered)
    }

    // Apply metadata if present
    if (template.metadata) {
      Object.assign(renderedOverrides[channel], template.metadata)
    }
  }

  // Merge with existing overrides
  const finalOverrides = {
    ...notification.overrides,
    ...renderedOverrides
  }

  return {
    workflowKey: `dynamic-workflow-${notification.workflowId}`,
    recipients: notification.recipients,
    payload: notification.payload,
    overrides: finalOverrides
  }
}

// Validate template syntax
export async function validateTemplateSyntax(
  template: string
): Promise<{ valid: boolean; errors: string[] }> {
  Context.current().heartbeat()
  
  const errors: string[] = []
  const regex = /\{\{(.*?)\}\}/g
  let match
  
  while ((match = regex.exec(template)) !== null) {
    const expression = match[1].trim()
    
    if (!expression) {
      errors.push(`Empty expression at position ${match.index}`)
    }
    
    // Check for valid variable path
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(expression)) {
      errors.push(`Invalid expression syntax: ${expression}`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// Preview rendered template
export async function previewTemplate(
  template: string,
  sampleData: any
): Promise<string> {
  Context.current().heartbeat()
  
  return renderTemplate(template, sampleData)
}