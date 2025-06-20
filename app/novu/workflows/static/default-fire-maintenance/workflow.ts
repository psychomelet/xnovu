import { workflow } from '@novu/framework'
import { payloadSchema, controlSchema } from './schemas'

export const defaultFireMaintenanceWorkflow = workflow(
  'default-fire-maintenance',
  async ({ step, payload }) => {
    // Email step - Primary maintenance notification
    await step.email(
      'send-maintenance-email',
      async (controls) => {
        const isUrgent = payload.urgencyLevel === 'critical' || payload.urgencyLevel === 'high'
        const urgencyPrefix = payload.urgencyLevel === 'critical' ? controls.criticalAlertPrefix : 
                             payload.urgencyLevel === 'high' ? controls.highUrgencyPrefix : controls.normalPrefix
        
        const subject = `${urgencyPrefix} ${payload.equipmentType.replace('_', ' ').toUpperCase()} Maintenance: ${payload.equipmentName} - ${payload.buildingName}`
        
        return {
          subject,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: ${controls.brandColor};">${urgencyPrefix} Fire Equipment Maintenance</h2>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>Equipment Details</h3>
                <p><strong>Equipment:</strong> ${payload.equipmentName} (${payload.equipmentType})</p>
                <p><strong>Location:</strong> ${payload.buildingName} - ${payload.locationDescription}</p>
                <p><strong>Scheduled:</strong> ${new Date(payload.scheduledDate).toLocaleDateString()} ${payload.scheduledTime}</p>
                <p><strong>Duration:</strong> ${payload.estimatedDuration}</p>
                <p><strong>Urgency:</strong> ${payload.urgencyLevel.toUpperCase()}</p>
              </div>
              
              <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>Maintenance Details</h3>
                <p><strong>Type:</strong> ${payload.maintenanceType}</p>
                <p><strong>Description:</strong> ${payload.maintenanceDescription}</p>
                ${payload.requiredParts ? `<p><strong>Required Parts:</strong> ${payload.requiredParts.join(', ')}</p>` : ''}
                ${payload.safetyPrecautions ? `<p><strong>Safety:</strong> ${payload.safetyPrecautions.join(', ')}</p>` : ''}
              </div>
              
              <div style="background: #f3e5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3>Technician Contact</h3>
                <p><strong>Name:</strong> ${payload.technicianName}</p>
                <p><strong>Company:</strong> ${payload.technicianCompany}</p>
                <p><strong>Phone:</strong> <a href="tel:${payload.technicianPhone}">${payload.technicianPhone}</a></p>
                <p><strong>Email:</strong> <a href="mailto:${payload.technicianEmail}">${payload.technicianEmail}</a></p>
              </div>
              
              ${payload.faultDetails ? `
                <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0;">
                  <h3 style="color: #d32f2f;">Fault Information</h3>
                  <p><strong>Description:</strong> ${payload.faultDetails.faultDescription}</p>
                  <p><strong>Severity:</strong> ${payload.faultDetails.severity.toUpperCase()}</p>
                  <p><strong>System Status:</strong> ${payload.faultDetails.systemStatus}</p>
                  <p><strong>Detected:</strong> ${new Date(payload.faultDetails.detectedAt).toLocaleString()}</p>
                </div>
              ` : ''}
              
              <p style="margin-top: 30px; font-size: 12px; color: #666;">
                Maintenance ID: ${payload.maintenanceId}<br>
                Equipment ID: ${payload.equipmentId}
              </p>
            </div>
          `
        }
      },
      { controlSchema }
    )

    // SMS for critical issues
    if (payload.urgencyLevel === 'critical' || payload.notificationType === 'fault_detected') {
      await step.sms(
        'send-maintenance-sms',
        async (controls) => {
          const urgencyText = payload.urgencyLevel === 'critical' ? '🚨 CRITICAL' : '⚠️ URGENT'
          const smsBody = `${urgencyText} Fire Equipment Maintenance\n${payload.equipmentName} - ${payload.buildingName}\n${payload.maintenanceDescription}\nTech: ${payload.technicianName} ${payload.technicianPhone}`
          
          return {
            body: smsBody.substring(0, 160)
          }
        },
        { controlSchema }
      )
    }

    // In-app notification
    await step.inApp(
      'send-maintenance-inapp',
      async () => {
        return {
          subject: `Fire Equipment Maintenance: ${payload.equipmentName}`,
          body: `${payload.maintenanceType} maintenance scheduled for ${payload.equipmentName} at ${payload.buildingName} on ${new Date(payload.scheduledDate).toLocaleDateString()} ${payload.scheduledTime}. Technician: ${payload.technicianName}`
        }
      },
      { controlSchema }
    )
  },
  {
    payloadSchema,
    tags: ['fire-safety', 'maintenance', 'equipment', 'multi-channel'],
    description: 'Fire equipment maintenance workflow for scheduling, fault alerts, and completion tracking'
  }
)