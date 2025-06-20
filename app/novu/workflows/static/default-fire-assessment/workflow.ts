import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'

export const defaultFireAssessmentWorkflow = workflow(
  'default-fire-assessment',
  async ({ step, payload }) => {
    // Email step - Primary assessment notification
    await step.email(
      'send-assessment-email',
      async (controls) => {
        const subject = `📊 Fire Safety Assessment: ${payload.assessmentTitle} - ${payload.buildingName}`
        
        return {
          subject,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: ${controls.brandColor};">📊 Fire Safety Assessment Notification</h2>
              
              <div style="background: #e8f5e8; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>Assessment Details</h3>
                <p><strong>Assessment:</strong> ${payload.assessmentTitle}</p>
                <p><strong>Type:</strong> ${payload.assessmentType.replace('_', ' ')}</p>
                <p><strong>Building:</strong> ${payload.buildingName}</p>
                <p><strong>Scheduled:</strong> ${new Date(payload.scheduledDate).toLocaleDateString()} ${payload.scheduledTime}</p>
                <p><strong>Duration:</strong> ${payload.estimatedDuration}</p>
                ${payload.deadlineDate ? `<p><strong>Deadline:</strong> ${new Date(payload.deadlineDate).toLocaleDateString()}</p>` : ''}
              </div>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>Assessment Description</h3>
                <p>${payload.assessmentDescription}</p>
                <p><strong>Areas to Assess:</strong> ${payload.areasToAssess.join(', ')}</p>
              </div>
              
              ${controls.includeCriteria && payload.assessmentCriteria.length > 0 ? `
                <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <h3>Assessment Criteria</h3>
                  <ul>
                    ${payload.assessmentCriteria.map(criteria => `<li>${criteria}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${controls.includeAssessorContact ? `
                <div style="background: #f3e5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <h3>Lead Assessor</h3>
                  <p><strong>Name:</strong> ${payload.assessorName}</p>
                  <p><strong>Organization:</strong> ${payload.assessorOrganization}</p>
                  <p><strong>Phone:</strong> <a href="tel:${payload.assessorPhone}">${payload.assessorPhone}</a></p>
                  <p><strong>Email:</strong> <a href="mailto:${payload.assessorEmail}">${payload.assessorEmail}</a></p>
                </div>
              ` : ''}
              
              ${payload.requiredDocuments && payload.requiredDocuments.length > 0 ? `
                <div style="background: #fff8e1; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <h3>Required Documents</h3>
                  <ul>
                    ${payload.requiredDocuments.map(doc => `<li>${doc}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${payload.assessmentResults ? `
                <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
                  <h3>Assessment Results</h3>
                  <p><strong>Completed:</strong> ${new Date(payload.assessmentResults.completedDate).toLocaleDateString()}</p>
                  ${payload.assessmentResults.overallScore ? `<p><strong>Overall Score:</strong> ${payload.assessmentResults.overallScore}/100</p>` : ''}
                  ${payload.assessmentResults.riskLevel ? `<p><strong>Risk Level:</strong> ${payload.assessmentResults.riskLevel.toUpperCase()}</p>` : ''}
                  ${payload.assessmentResults.complianceStatus ? `<p><strong>Compliance Status:</strong> ${payload.assessmentResults.complianceStatus.replace('_', ' ').toUpperCase()}</p>` : ''}
                  ${payload.assessmentResults.recommendationsCount ? `<p><strong>Recommendations:</strong> ${payload.assessmentResults.recommendationsCount}</p>` : ''}
                  ${payload.assessmentResults.followUpRequired ? `<p><strong>Follow-up Required:</strong> Yes</p>` : ''}
                </div>
              ` : ''}
              
              ${payload.assessmentResults?.criticalFindings && payload.assessmentResults.criticalFindings.length > 0 ? `
                <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0;">
                  <h3>Critical Findings</h3>
                  <ul>
                    ${payload.assessmentResults.criticalFindings.map(finding => `<li style="color: #d32f2f;">${finding}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              <p style="margin-top: 30px; font-size: 12px; color: #666;">
                Assessment ID: ${payload.assessmentId}<br>
                ${payload.regulatoryFramework ? `Framework: ${payload.regulatoryFramework}` : ''}
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
        return {
          subject: `Fire Safety Assessment: ${payload.assessmentTitle}`,
          body: `${payload.assessmentType.replace('_', ' ')} assessment scheduled for ${payload.buildingName} on ${new Date(payload.scheduledDate).toLocaleDateString()}. Assessor: ${payload.assessorName}`
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