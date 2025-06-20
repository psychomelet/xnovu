import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'
import type { FireAssessmentPayload, FireAssessmentControls, AssessmentTypeConfig, LocalizedAssessmentContent } from './types'

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
        
        return {
          subject,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: ${controls.brandColor};">📊 ${payload.language === 'zh' ? '消防安全评估通知' : 'Fire Safety Assessment Notification'}</h2>
              
              <div style="background: #e8f5e8; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>${payload.language === 'zh' ? '评估详情' : 'Assessment Details'}</h3>
                <p><strong>${payload.language === 'zh' ? '评估名称' : 'Assessment'}:</strong> ${payload.assessmentTitle}</p>
                <p><strong>${payload.language === 'zh' ? '类型' : 'Type'}:</strong> ${assessmentConfig.icon} ${assessmentConfig.description}</p>
                <p><strong>${payload.language === 'zh' ? '建筑' : 'Building'}:</strong> ${payload.buildingName}</p>
                <p><strong>${content.scheduled}:</strong> ${formattedDate} ${payload.scheduledTime}</p>
                <p><strong>${content.duration}:</strong> ${payload.estimatedDuration}</p>
                ${payload.deadlineDate ? `<p><strong>${content.deadline}:</strong> ${new Date(payload.deadlineDate).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>` : ''}
              </div>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>${payload.language === 'zh' ? '评估描述' : 'Assessment Description'}</h3>
                <p>${payload.assessmentDescription}</p>
                <p><strong>${content.areas}:</strong> ${payload.areasToAssess.join(', ')}</p>
              </div>
              
              ${controls.includeCriteria && payload.assessmentCriteria.length > 0 ? `
                <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <h3>${content.criteria}</h3>
                  <ul>
                    ${payload.assessmentCriteria.map(criteria => `<li>${criteria}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${controls.includeAssessorContact ? `
                <div style="background: #f3e5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <h3>${content.assessor}</h3>
                  <p><strong>${payload.language === 'zh' ? '姓名' : 'Name'}:</strong> ${payload.assessorName}</p>
                  <p><strong>${payload.language === 'zh' ? '组织' : 'Organization'}:</strong> ${payload.assessorOrganization}</p>
                  <p><strong>${payload.language === 'zh' ? '电话' : 'Phone'}:</strong> <a href="tel:${payload.assessorPhone}">${payload.assessorPhone}</a></p>
                  <p><strong>${payload.language === 'zh' ? '邮箱' : 'Email'}:</strong> <a href="mailto:${payload.assessorEmail}">${payload.assessorEmail}</a></p>
                </div>
              ` : ''}
              
              ${payload.requiredDocuments && payload.requiredDocuments.length > 0 ? `
                <div style="background: #fff8e1; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <h3>${content.documents}</h3>
                  <ul>
                    ${payload.requiredDocuments.map(doc => `<li>${doc}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${payload.assessmentResults ? `
                <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
                  <h3>${content.results}</h3>
                  <p><strong>${payload.language === 'zh' ? '完成日期' : 'Completed'}:</strong> ${new Date(payload.assessmentResults.completedDate).toLocaleDateString(payload.language === 'zh' ? 'zh-CN' : 'en-US')}</p>
                  ${payload.assessmentResults.overallScore ? `<p><strong>${content.overallScore}:</strong> ${payload.assessmentResults.overallScore}/100</p>` : ''}
                  ${payload.assessmentResults.riskLevel ? `<p><strong>${content.riskLevel}:</strong> ${content[payload.assessmentResults.riskLevel]}</p>` : ''}
                  ${payload.assessmentResults.complianceStatus ? `<p><strong>${content.complianceStatus}:</strong> ${content[payload.assessmentResults.complianceStatus.replace('_', 'C') === 'nonCompliant' ? 'nonCompliant' : payload.assessmentResults.complianceStatus.replace('_', 'C') === 'partiallyCompliant' ? 'partiallyCompliant' : 'compliant']}</p>` : ''}
                  ${payload.assessmentResults.recommendationsCount ? `<p><strong>${content.recommendations}:</strong> ${payload.assessmentResults.recommendationsCount}</p>` : ''}
                  ${payload.assessmentResults.followUpRequired ? `<p><strong>${content.followUpRequired}:</strong> ${payload.language === 'zh' ? '是' : 'Yes'}</p>` : ''}
                </div>
              ` : ''}
              
              ${payload.assessmentResults?.criticalFindings && payload.assessmentResults.criticalFindings.length > 0 ? `
                <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0;">
                  <h3>${content.criticalFindings}</h3>
                  <ul>
                    ${payload.assessmentResults.criticalFindings.map(finding => `<li style="color: #d32f2f;">${finding}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              <p style="margin-top: 30px; font-size: 12px; color: #666;">
                ${payload.language === 'zh' ? '评估编号' : 'Assessment ID'}: ${payload.assessmentId}<br>
                ${payload.regulatoryFramework ? `${content.framework}: ${payload.regulatoryFramework}` : ''}
              </p>
            </div>
          `
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