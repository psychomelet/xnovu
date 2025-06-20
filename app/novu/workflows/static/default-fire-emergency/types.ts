import { z } from 'zod'
import { payloadSchema, controlSchema } from './schemas'

export type FireEmergencyPayload = z.infer<typeof payloadSchema>
export type FireEmergencyControls = z.infer<typeof controlSchema>

export interface FireEmergencyTemplateData extends FireEmergencyPayload {
  formattedDateTime: string
  urgencyBadge: string
  evacuationMapHtml: string
  emergencyContactsHtml: string
  buildingInfoHtml: string
  acknowledgmentHtml: string
}

export interface EmergencyChannelConfig {
  sms: {
    enabled: boolean
    maxLength: number
    urgencyPrefix: string
  }
  push: {
    enabled: boolean
    urgencyLevel: 'normal' | 'high' | 'critical'
    sound: string
  }
  email: {
    enabled: boolean
    priority: 'normal' | 'high' | 'urgent'
    includeAttachments: boolean
  }
  inApp: {
    enabled: boolean
    autoExpire: boolean
    expireMinutes: number
  }
  chat: {
    enabled: boolean
    mentionEveryone: boolean
    channelType: 'teams' | 'slack' | 'webhook'
  }
}

export interface EmergencyTypeConfig {
  fire: {
    icon: '🔥'
    color: '#D32F2F'
    priority: 'critical'
    autoEvacuate: true
  }
  smoke_detected: {
    icon: '💨'
    color: '#FF6F00'
    priority: 'high'
    autoEvacuate: false
  }
  gas_leak: {
    icon: '⚠️'
    color: '#F57C00'
    priority: 'high'
    autoEvacuate: true
  }
  explosion: {
    icon: '💥'
    color: '#C62828'
    priority: 'critical'
    autoEvacuate: true
  }
  evacuation: {
    icon: '🚪'
    color: '#1976D2'
    priority: 'critical'
    autoEvacuate: true
  }
}

export interface LocalizedContent {
  en: {
    urgentPrefix: 'URGENT'
    evacuateNow: 'EVACUATE NOW'
    assemblyPoint: 'Assembly Point'
    emergencyContact: 'Emergency Contact'
    stayCalm: 'Stay calm and follow evacuation procedures'
    doNotUseElevators: 'Do NOT use elevators'
    awaitInstructions: 'Await further instructions at assembly point'
  }
  zh: {
    urgentPrefix: '紧急'
    evacuateNow: '立即疏散'
    assemblyPoint: '集合点'
    emergencyContact: '紧急联系人'
    stayCalm: '保持冷静并遵循疏散程序'
    doNotUseElevators: '请勿使用电梯'
    awaitInstructions: '在集合点等待进一步指示'
  }
}