import { z } from 'zod'
import { payloadSchema, controlSchema } from './schemas'

export type FireAssessmentPayload = z.infer<typeof payloadSchema>
export type FireAssessmentControls = z.infer<typeof controlSchema>

export interface AssessmentTypeConfig {
  risk_assessment: { icon: '⚠️', description: 'Comprehensive risk assessment and analysis' }
  compliance_audit: { icon: '📋', description: 'Regulatory compliance audit and review' }
  safety_evaluation: { icon: '🔍', description: 'Safety systems evaluation and testing' }
  vulnerability_analysis: { icon: '🛡️', description: 'Security vulnerability analysis' }
  performance_review: { icon: '📊', description: 'Performance review and optimization' }
}

export interface LocalizedAssessmentContent {
  en: {
    assessor: 'Lead Assessor'
    scheduled: 'Scheduled'
    deadline: 'Deadline'
    duration: 'Duration'
    areas: 'Areas to Assess'
    criteria: 'Assessment Criteria'
    documents: 'Required Documents'
    contact: 'Contact Information'
    results: 'Assessment Results'
    overallScore: 'Overall Score'
    riskLevel: 'Risk Level'
    complianceStatus: 'Compliance Status'
    criticalFindings: 'Critical Findings'
    recommendations: 'Recommendations'
    followUpRequired: 'Follow-up Required'
    followUpDeadline: 'Follow-up Deadline'
    previousAssessment: 'Previous Assessment'
    nextAssessment: 'Next Assessment Due'
    framework: 'Regulatory Framework'
    viewReport: 'View Assessment Report'
    scheduleFollowUp: 'Schedule Follow-up'
    downloadCertificate: 'Download Compliance Certificate'
    low: 'Low'
    medium: 'Medium'
    high: 'High'
    critical: 'Critical'
    compliant: 'Compliant'
    nonCompliant: 'Non-Compliant'
    partiallyCompliant: 'Partially Compliant'
  }
  zh: {
    assessor: '首席评估员'
    scheduled: '计划时间'
    deadline: '截止日期'
    duration: '持续时间'
    areas: '评估区域'
    criteria: '评估标准'
    documents: '所需文件'
    contact: '联系信息'
    results: '评估结果'
    overallScore: '总体评分'
    riskLevel: '风险等级'
    complianceStatus: '合规状态'
    criticalFindings: '关键发现'
    recommendations: '建议'
    followUpRequired: '需要跟进'
    followUpDeadline: '跟进截止日期'
    previousAssessment: '上次评估'
    nextAssessment: '下次评估到期'
    framework: '监管框架'
    viewReport: '查看评估报告'
    scheduleFollowUp: '安排跟进'
    downloadCertificate: '下载合规证书'
    low: '低'
    medium: '中'
    high: '高'
    critical: '严重'
    compliant: '合规'
    nonCompliant: '不合规'
    partiallyCompliant: '部分合规'
  }
}