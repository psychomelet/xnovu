import { z } from 'zod'
import { payloadSchema, controlSchema } from './schemas'

export type DynamicMultiPayload = z.infer<typeof payloadSchema>
export type DynamicMultiControls = z.infer<typeof controlSchema>

export interface ChannelConfig {
  enabled: boolean
  templateId?: string
  customContent?: {
    subject?: string
    body: string
  }
  variables?: Record<string, any>
  overrides?: Record<string, any>
}

export interface ChannelConfiguration {
  email?: ChannelConfig
  inApp?: ChannelConfig
  sms?: ChannelConfig
  push?: ChannelConfig
  chat?: ChannelConfig
}

export interface RecipientConfig {
  recipientName?: string
  recipientPhone?: string
  recipientEmail?: string
  customData?: Record<string, any>
}

export interface TemplateRenderContext {
  enterpriseId: string
  variables: Record<string, any>
  channel: string
  recipientConfig?: RecipientConfig
}

export interface RenderedContent {
  subject?: string
  body: string
  variables?: Record<string, any>
}

export interface ChannelExecutionResult {
  channel: string
  success: boolean
  content?: RenderedContent
  error?: string
}

export interface WorkflowExecutionContext {
  payload: DynamicMultiPayload
  controls: DynamicMultiControls
  enterpriseId: string
  subscriberId: string
}

export type ChannelType = 'email' | 'inApp' | 'sms' | 'push' | 'chat'

export interface ChannelExecutor {
  channel: ChannelType
  execute: (config: ChannelConfig, context: WorkflowExecutionContext) => Promise<any>
}

export interface NotificationChannelStepConfig {
  stepId: string
  skipCondition?: (controls: DynamicMultiControls) => boolean
  controlSchema?: any
}