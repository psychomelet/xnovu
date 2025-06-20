import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { FireAssessmentPayload, FireAssessmentControls, AssessmentTypeConfig, LocalizedAssessmentContent } from './types'
import { renderFireAssessmentEmail } from '../../../emails/workflows'

const assessmentTypeConfig: AssessmentTypeConfig = {
  risk_assessment: { icon: '⚠️', description: 'Comprehensive risk assessment and analysis' },
  compliance_audit: { icon: '📋', description: 'Regulatory compliance audit and review' },
  safety_evaluation: { icon: '🔍', description: 'Safety systems evaluation and testing' },
  vulnerability_analysis: { icon: '🛡️', description: 'Security vulnerability analysis' },
  performance_review: { icon: '📊', description: 'Performance review and optimization' }
}

const localizedContent: LocalizedAssessmentContent = {
  en: {
    assessor: 'Lead Assessor', scheduled: 'Scheduled', deadline: 'Deadline', duration: 'Duration',
    areas: 'Areas to Assess', criteria: 'Assessment Criteria', documents: 'Required Documents',
    contact: 'Contact Information', results: 'Assessment Results', overallScore: 'Overall Score',
    riskLevel: 'Risk Level', complianceStatus: 'Compliance Status', criticalFindings: 'Critical Findings',
    recommendations: 'Recommendations', followUpRequired: 'Follow-up Required', followUpDeadline: 'Follow-up Deadline',
    previousAssessment: 'Previous Assessment', nextAssessment: 'Next Assessment Due', framework: 'Regulatory Framework',
    viewReport: 'View Assessment Report', scheduleFollowUp: 'Schedule Follow-up', downloadCertificate: 'Download Compliance Certificate',
    low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
    compliant: 'Compliant', nonCompliant: 'Non-Compliant', partiallyCompliant: 'Partially Compliant'
  },
  zh: {
    assessor: '首席评估员', scheduled: '计划时间', deadline: '截止日期', duration: '持续时间',
    areas: '评估区域', criteria: '评估标准', documents: '所需文件',
    contact: '联系信息', results: '评估结果', overallScore: '总体评分',
    riskLevel: '风险等级', complianceStatus: '合规状态', criticalFindings: '关键发现',
    recommendations: '建议', followUpRequired: '需要跟进', followUpDeadline: '跟进截止日期',
    previousAssessment: '上次评估', nextAssessment: '下次评估到期', framework: '监管框架',
    viewReport: '查看评估报告', scheduleFollowUp: '安排跟进', downloadCertificate: '下载合规证书',
    low: '低', medium: '中', high: '高', critical: '严重',
    compliant: '合规', nonCompliant: '不合规', partiallyCompliant: '部分合规'
  }
}

export const defaultFireAssessmentWorkflow = workflow(
  'default-fire-assessment',
  async ({ step, payload }) => {
    const assessmentConfig = assessmentTypeConfig[payload.assessmentType]
    const content = localizedContent[payload.language]
    
    const formattedDate = new Date(payload.scheduledDate).toLocaleDateString(
      payload.language === 'zh' ? 'zh-CN' : 'en-US',
      { timeZone: 'Asia/Shanghai' }
    )
    
    // Email step - Primary assessment notification
    await step.email(
      'send-assessment-email',
      async (controls: FireAssessmentControls) => {
        const subject = payload.language === 'zh'
          ? `📊 消防安全评估: ${payload.assessmentTitle} - ${payload.buildingName}`
          : `📊 Fire Safety Assessment: ${payload.assessmentTitle} - ${payload.buildingName}`
        
        // Prepare assessment details
        const assessmentDetails: Record<string, string> = {
          'Building': payload.buildingName,
          'Date': `${formattedDate} ${payload.scheduledTime}`,
          'Duration': payload.estimatedDuration,
          'Areas': payload.areasToAssess.join(', ')
        }
        if (payload.deadlineDate) {
          assessmentDetails['Deadline'] = new Date(payload.deadlineDate).toLocaleDateString(
            payload.language === 'zh' ? 'zh-CN' : 'en-US'
          )
        }

        const body = renderFireAssessmentEmail({
          subject,
          recipientName: payload.recipientName,
          organizationName: controls.organizationName,
          logoUrl: controls.logoUrl,
          primaryColor: controls.brandColor,
          assessmentTitle: payload.assessmentTitle,
          assessmentMessage: payload.assessmentDescription,
          assessmentType: assessmentConfig.description,
          dueDate: payload.deadlineDate ? new Date(payload.deadlineDate).toLocaleDateString(
            payload.language === 'zh' ? 'zh-CN' : 'en-US'
          ) : undefined,
          assessor: controls.includeAssessorContact ? payload.assessorName : undefined,
          riskLevel: payload.assessmentResults?.riskLevel,
          riskFindings: payload.assessmentResults?.criticalFindings,
          recommendations: payload.requiredDocuments,
          areasAssessed: payload.areasToAssess,
          complianceStatus: assessmentDetails,
          immediateActions: payload.assessmentCriteria,
          reportUrl: controls.enableReportAccess && payload.reportUrl 
            ? `${payload.reportUrl}?assessmentId=${payload.assessmentId}` 
            : undefined,
          actionPlanUrl: controls.enableActionPlan && payload.actionPlanUrl 
            ? `${payload.actionPlanUrl}?assessmentId=${payload.assessmentId}` 
            : undefined,
          footerNote: payload.language === 'zh' 
            ? '此为自动生成的消防安全评估通知' 
            : 'This is an automated fire safety assessment notification'
        })

        return {
          subject,
          body
        }
      },
      { controlSchema }
    )

    // In-app notification
    await step.inApp(
      'send-assessment-inapp',
      async () => {
        const subject = payload.language === 'zh'
          ? `消防安全评估: ${payload.assessmentTitle}`
          : `Fire Safety Assessment: ${payload.assessmentTitle}`
          
        const body = payload.language === 'zh'
          ? `${assessmentConfig.description}计划于${formattedDate}在${payload.buildingName}进行。评估员: ${payload.assessorName}`
          : `${payload.assessmentType.replace('_', ' ')} assessment scheduled for ${payload.buildingName} on ${formattedDate}. Assessor: ${payload.assessorName}`
        
        return {
          subject,
          body
        }
      },
      { controlSchema }
    )
  },
  {
    payloadSchema,
    tags: ['fire-safety', 'assessment', 'compliance', 'audit'],
    description: 'Fire safety assessment workflow for risk assessments, compliance audits, and safety evaluations'
  }
)