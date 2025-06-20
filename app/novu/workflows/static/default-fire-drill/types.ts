import { z } from 'zod'
import { payloadSchema, controlSchema } from './schemas'

export type FireDrillPayload = z.infer<typeof payloadSchema>
export type FireDrillControls = z.infer<typeof controlSchema>

export interface FireDrillTemplateData extends FireDrillPayload {
  formattedDate: string
  formattedTime: string
  notificationIcon: string
  urgencyLevel: string
  evacuationMapHtml: string
  coordinatorContactHtml: string
  participantInfoHtml: string
  resultsHtml: string
  complianceInfoHtml: string
}

export interface DrillNotificationTypeConfig {
  advance_notice: {
    icon: '📋'
    urgency: 'normal'
    subject_prefix: 'Fire Drill Scheduled'
    tone: 'informational'
  }
  reminder: {
    icon: '⏰'
    urgency: 'medium'
    subject_prefix: 'Fire Drill Reminder'
    tone: 'reminder'
  }
  day_of: {
    icon: '🚨'
    urgency: 'high'
    subject_prefix: 'Fire Drill Today'
    tone: 'immediate'
  }
  results: {
    icon: '📊'
    urgency: 'normal'
    subject_prefix: 'Fire Drill Results'
    tone: 'informational'
  }
  cancellation: {
    icon: '❌'
    urgency: 'medium'
    subject_prefix: 'Fire Drill Cancelled'
    tone: 'important'
  }
}

export interface DrillTypeConfig {
  scheduled: {
    icon: '🗓️'
    description: 'Regular scheduled fire drill'
    mandatory: true
  }
  unannounced: {
    icon: '⚡'
    description: 'Surprise fire drill to test readiness'
    mandatory: true
  }
  mandatory: {
    icon: '📋'
    description: 'Required regulatory compliance drill'
    mandatory: true
  }
  training: {
    icon: '🎓'
    description: 'Educational fire safety training drill'
    mandatory: false
  }
}

export interface LocalizedDrillContent {
  en: {
    mandatory: 'Mandatory'
    optional: 'Optional'
    allBuildings: 'All Buildings'
    assemblyPoint: 'Assembly Point'
    coordinator: 'Drill Coordinator'
    duration: 'Estimated Duration'
    participationRequired: 'Participation is required'
    participationOptional: 'Participation is optional'
    bringNothing: 'Leave personal items behind'
    useStairs: 'Use stairs only - elevators will be disabled'
    awaitInstructions: 'Await instructions at assembly point'
    returnAfterClearance: 'Return to building only after all-clear signal'
    contactForQuestions: 'Contact coordinator for questions'
    regulatoryCompliance: 'This drill fulfills regulatory requirements'
    previousDrill: 'Previous Drill'
    nextDrill: 'Next Drill'
    improvementAreas: 'Areas for Improvement'
    recommendations: 'Recommendations'
  }
  zh: {
    mandatory: '必须参加'
    optional: '可选参加'
    allBuildings: '所有建筑'
    assemblyPoint: '集合点'
    coordinator: '演练协调员'
    duration: '预计时长'
    participationRequired: '必须参加'
    participationOptional: '可选参加'
    bringNothing: '请勿携带个人物品'
    useStairs: '仅使用楼梯 - 电梯将被禁用'
    awaitInstructions: '在集合点等待指示'
    returnAfterClearance: '仅在收到安全信号后返回建筑'
    contactForQuestions: '如有疑问请联系协调员'
    regulatoryCompliance: '此演练符合法规要求'
    previousDrill: '上次演练'
    nextDrill: '下次演练'
    improvementAreas: '改进领域'
    recommendations: '建议'
  }
}

export interface DrillParticipantRole {
  all_occupants: {
    responsibilities: string[]
    specificInstructions: string[]
  }
  fire_wardens: {
    responsibilities: string[]
    specificInstructions: string[]
    additionalDuties: string[]
  }
  department_heads: {
    responsibilities: string[]
    specificInstructions: string[]
    reportingRequirements: string[]
  }
  security_team: {
    responsibilities: string[]
    specificInstructions: string[]
    coordinationTasks: string[]
  }
  management: {
    responsibilities: string[]
    specificInstructions: string[]
    oversightTasks: string[]
  }
  drill_coordinators: {
    responsibilities: string[]
    specificInstructions: string[]
    leadshipTasks: string[]
  }
}