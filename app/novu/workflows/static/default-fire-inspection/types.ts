import { z } from 'zod'
import { payloadSchema, controlSchema } from './schemas'

export type FireInspectionPayload = z.infer<typeof payloadSchema>
export type FireInspectionControls = z.infer<typeof controlSchema>

export interface FireInspectionTemplateData extends FireInspectionPayload {
  formattedDate: string
  formattedTime: string
  notificationIcon: string
  urgencyLevel: string
  checklistHtml: string
  inspectorContactHtml: string
  preparationTasksHtml: string
  resultsHtml: string
  complianceInfoHtml: string
  followUpHtml: string
}

export interface InspectionNotificationTypeConfig {
  assignment: {
    icon: '📋'
    urgency: 'normal'
    subject_prefix: 'Fire Inspection Assigned'
    tone: 'professional'
  }
  reminder: {
    icon: '⏰'
    urgency: 'medium'
    subject_prefix: 'Fire Inspection Reminder'
    tone: 'reminder'
  }
  overdue: {
    icon: '⚠️'
    urgency: 'high'
    subject_prefix: 'Fire Inspection Overdue'
    tone: 'urgent'
  }
  completion: {
    icon: '✅'
    urgency: 'normal'
    subject_prefix: 'Fire Inspection Completed'
    tone: 'informational'
  }
  results: {
    icon: '📊'
    urgency: 'normal'
    subject_prefix: 'Fire Inspection Results'
    tone: 'informational'
  }
  follow_up_required: {
    icon: '🔄'
    urgency: 'medium'
    subject_prefix: 'Fire Inspection Follow-up Required'
    tone: 'action_required'
  }
}

export interface InspectionTypeConfig {
  routine: {
    icon: '🔍'
    description: 'Regular scheduled fire safety inspection'
    typical_frequency: 'monthly'
    priority: 'medium'
  }
  compliance: {
    icon: '📋'
    description: 'Regulatory compliance inspection'
    typical_frequency: 'annual'
    priority: 'high'
  }
  follow_up: {
    icon: '🔄'
    description: 'Follow-up inspection for previous issues'
    typical_frequency: 'as_needed'
    priority: 'high'
  }
  emergency: {
    icon: '🚨'
    description: 'Emergency inspection due to incident or concern'
    typical_frequency: 'immediate'
    priority: 'critical'
  }
  annual: {
    icon: '📅'
    description: 'Annual comprehensive fire safety inspection'
    typical_frequency: 'yearly'
    priority: 'high'
  }
  quarterly: {
    icon: '📊'
    description: 'Quarterly fire systems inspection'
    typical_frequency: 'quarterly'
    priority: 'medium'
  }
  monthly: {
    icon: '🗓️'
    description: 'Monthly routine inspection'
    typical_frequency: 'monthly'
    priority: 'medium'
  }
}

export interface LocalizedInspectionContent {
  en: {
    inspector: 'Inspector'
    scheduled: 'Scheduled'
    deadline: 'Deadline'
    duration: 'Duration'
    areas: 'Areas to Inspect'
    checklist: 'Inspection Checklist'
    preparation: 'Preparation Required'
    documents: 'Required Documents'
    contact: 'Contact Information'
    access: 'Access Requirements'
    compliance: 'Compliance Standard'
    previousInspection: 'Previous Inspection'
    nextInspection: 'Next Inspection Due'
    results: 'Inspection Results'
    status: 'Status'
    criticalIssues: 'Critical Issues'
    minorIssues: 'Minor Issues'
    recommendations: 'Recommendations'
    followUpRequired: 'Follow-up Required'
    followUpDeadline: 'Follow-up Deadline'
    complianceStatus: 'Compliance Status'
    certificateIssued: 'Certificate Issued'
    reschedule: 'Reschedule'
    confirm: 'Confirm'
    viewReport: 'View Report'
    downloadCertificate: 'Download Certificate'
  }
  zh: {
    inspector: '检查员'
    scheduled: '计划时间'
    deadline: '截止日期'
    duration: '持续时间'
    areas: '检查区域'
    checklist: '检查清单'
    preparation: '准备工作'
    documents: '所需文件'
    contact: '联系信息'
    access: '访问要求'
    compliance: '合规标准'
    previousInspection: '上次检查'
    nextInspection: '下次检查到期'
    results: '检查结果'
    status: '状态'
    criticalIssues: '严重问题'
    minorIssues: '次要问题'
    recommendations: '建议'
    followUpRequired: '需要跟进'
    followUpDeadline: '跟进截止日期'
    complianceStatus: '合规状态'
    certificateIssued: '证书已签发'
    reschedule: '重新安排'
    confirm: '确认'
    viewReport: '查看报告'
    downloadCertificate: '下载证书'
  }
}

export interface InspectionStatusConfig {
  passed: {
    color: '#4CAF50'
    icon: '✅'
    message_en: 'Inspection passed successfully'
    message_zh: '检查通过'
  }
  passed_with_notes: {
    color: '#FF9800'
    icon: '✅⚠️'
    message_en: 'Inspection passed with minor observations'
    message_zh: '检查通过但有轻微问题'
  }
  failed: {
    color: '#F44336'
    icon: '❌'
    message_en: 'Inspection failed - issues must be addressed'
    message_zh: '检查未通过 - 必须解决问题'
  }
  pending_review: {
    color: '#2196F3'
    icon: '🔄'
    message_en: 'Inspection results pending review'
    message_zh: '检查结果待审核'
  }
}

export interface ComplianceStatusConfig {
  compliant: {
    color: '#4CAF50'
    icon: '✅'
    message_en: 'Fully compliant with regulations'
    message_zh: '完全符合法规要求'
  }
  non_compliant: {
    color: '#F44336'
    icon: '❌'
    message_en: 'Non-compliant - immediate action required'
    message_zh: '不合规 - 需要立即采取行动'
  }
  partially_compliant: {
    color: '#FF9800'
    icon: '⚠️'
    message_en: 'Partially compliant - improvements needed'
    message_zh: '部分合规 - 需要改进'
  }
}