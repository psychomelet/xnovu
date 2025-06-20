import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'

export const defaultFireTrainingWorkflow = workflow(
  'default-fire-training',
  async ({ step, payload }) => {
    // Email step - Primary training notification
    await step.email(
      'send-training-email',
      async (controls) => {
        const subject = `🎓 Fire Safety Training: ${payload.trainingTitle} - ${payload.buildingName}`
        
        return {
          subject,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: ${controls.brandColor};">🎓 Fire Safety Training Notification</h2>
              
              <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>Training Details</h3>
                <p><strong>Training:</strong> ${payload.trainingTitle}</p>
                <p><strong>Type:</strong> ${payload.trainingType.replace('_', ' ')}</p>
                <p><strong>Date:</strong> ${new Date(payload.scheduledDate).toLocaleDateString()}</p>
                <p><strong>Time:</strong> ${payload.scheduledTime}</p>
                <p><strong>Duration:</strong> ${payload.duration}</p>
                <p><strong>Location:</strong> ${payload.buildingName} - ${payload.locationDescription}</p>
                ${payload.maxParticipants ? `<p><strong>Max Participants:</strong> ${payload.maxParticipants}</p>` : ''}
              </div>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>Training Description</h3>
                <p>${payload.trainingDescription}</p>
                ${payload.prerequisites ? `<p><strong>Prerequisites:</strong> ${payload.prerequisites}</p>` : ''}
              </div>
              
              ${controls.includeObjectives && payload.trainingObjectives.length > 0 ? `
                <div style="background: #e8f5e8; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <h3>Learning Objectives</h3>
                  <ul>
                    ${payload.trainingObjectives.map(obj => `<li>${obj}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${controls.includeInstructorContact ? `
                <div style="background: #f3e5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <h3>Instructor Contact</h3>
                  <p><strong>Name:</strong> ${payload.instructorName}</p>
                  <p><strong>Organization:</strong> ${payload.instructorOrganization}</p>
                  <p><strong>Phone:</strong> <a href="tel:${payload.instructorPhone}">${payload.instructorPhone}</a></p>
                  <p><strong>Email:</strong> <a href="mailto:${payload.instructorEmail}">${payload.instructorEmail}</a></p>
                </div>
              ` : ''}
              
              ${payload.requiredMaterials && payload.requiredMaterials.length > 0 ? `
                <div style="background: #fff8e1; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <h3>Required Materials</h3>
                  <ul>
                    ${payload.requiredMaterials.map(material => `<li>${material}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${controls.enableEnrollment && payload.enrollmentUrl ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${payload.enrollmentUrl}?trainingId=${payload.trainingId}" 
                     style="display: inline-block; padding: 12px 24px; background-color: ${controls.brandColor}; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Register for Training
                  </a>
                </div>
              ` : ''}
              
              ${payload.completionDetails ? `
                <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
                  <h3>Training Completed</h3>
                  <p><strong>Completed:</strong> ${new Date(payload.completionDetails.completedDate).toLocaleDateString()}</p>
                  <p><strong>Participants:</strong> ${payload.completionDetails.participantCount}</p>
                  ${payload.completionDetails.passRate ? `<p><strong>Pass Rate:</strong> ${payload.completionDetails.passRate}%</p>` : ''}
                  ${payload.completionDetails.certificatesIssued ? `<p><strong>Certificates Issued:</strong> ${payload.completionDetails.certificatesIssued}</p>` : ''}
                </div>
              ` : ''}
              
              <p style="margin-top: 30px; font-size: 12px; color: #666;">
                Training ID: ${payload.trainingId}<br>
                ${payload.courseCode ? `Course Code: ${payload.courseCode}` : ''}
              </p>
            </div>
          `
        }
      },
      { controlSchema }
    )

    // In-app notification
    await step.inApp(
      'send-training-inapp',
      async () => {
        return {
          subject: `Fire Safety Training: ${payload.trainingTitle}`,
          body: `${payload.trainingType.replace('_', ' ')} training scheduled for ${new Date(payload.scheduledDate).toLocaleDateString()} ${payload.scheduledTime} at ${payload.buildingName}. Instructor: ${payload.instructorName}`
        }
      },
      { controlSchema }
    )

    // Push notification
    await step.push(
      'send-training-push',
      async () => {
        return {
          subject: `🎓 Fire Training: ${payload.trainingTitle}`,
          body: `${new Date(payload.scheduledDate).toLocaleDateString()} ${payload.scheduledTime} at ${payload.buildingName}`
        }
      },
      { controlSchema }
    )
  },
  {
    payloadSchema,
    tags: ['fire-safety', 'training', 'education', 'certification'],
    description: 'Fire safety training workflow for announcements, enrollment, reminders, and completion certificates'
  }
)