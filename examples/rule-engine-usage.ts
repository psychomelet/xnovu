/**
 * Example usage of the XNovu Rule Engine
 * 
 * This file demonstrates how to:
 * 1. Initialize the rule engine
 * 2. Create cron-based rules
 * 3. Create scheduled notifications
 * 4. Monitor system status
 */

import { RuleEngineService, defaultRuleEngineConfig } from '@/app/services';
import type { NotificationRuleInsert, NotificationInsert } from '@/types/rule-engine';

async function initializeRuleEngine() {
  console.log('🚀 Initializing Rule Engine...');
  
  // Get singleton instance with configuration
  const ruleEngine = RuleEngineService.getInstance(defaultRuleEngineConfig);
  
  // Initialize all components
  await ruleEngine.initialize();
  
  console.log('✅ Rule Engine initialized successfully');
  return ruleEngine;
}

async function createCronRule(ruleEngine: RuleEngineService) {
  console.log('📅 Creating cron-based rule...');
  
  // Example: Daily standup reminder, weekdays at 9 AM EST
  const cronRuleData: NotificationRuleInsert = {
    name: 'Daily Standup Reminder',
    description: 'Remind team members about daily standup meeting',
    enterprise_id: 'ent-demo-123',
    business_id: 'biz-demo-456',
    notification_workflow_id: 1, // Assumes workflow exists
    trigger_type: 'CRON',
    trigger_config: {
      cron: '0 9 * * 1-5', // 9 AM, Monday to Friday
      timezone: 'America/New_York',
      enabled: true
    },
    rule_payload: {
      recipients: [
        'user-123',
        'user-456',
        'user-789'
      ],
      payload: {
        message: 'Time for our daily standup meeting!',
        meetingLink: 'https://meet.company.com/standup',
        buildingId: 'building-main',
        reminder: true
      },
      overrides: {
        email: {
          subject: 'Daily Standup - 9:00 AM'
        }
      }
    },
    publish_status: 'PUBLISH',
    deactivated: false
  };

  // In a real application, you would save this to the database
  // using your application's API or direct database access
  console.log('Cron rule data:', JSON.stringify(cronRuleData, null, 2));
  
  // After saving to database, reload rules to pick up the new rule
  await ruleEngine.reloadCronRules('ent-demo-123');
  
  console.log('✅ Cron rule created and loaded');
}

async function createScheduledNotification(ruleEngine: RuleEngineService) {
  console.log('⏰ Creating scheduled notification...');
  
  // Example: Maintenance notification scheduled for tomorrow at 2 PM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0); // 2 PM
  
  const scheduledNotificationData: NotificationInsert = {
    name: 'Scheduled Building Maintenance',
    description: 'HVAC maintenance scheduled notification',
    enterprise_id: 'ent-demo-123',
    business_id: 'biz-demo-456',
    notification_workflow_id: 2, // Assumes maintenance workflow exists
    notification_status: 'PENDING',
    channels: ['EMAIL', 'IN_APP'],
    recipients: [
      'tenant-123',
      'tenant-456',
      'admin-789'
    ],
    payload: {
      maintenanceType: 'HVAC',
      buildingId: 'building-main',
      estimatedDuration: '4 hours',
      contactNumber: '+1-555-0123',
      alternativeBuildings: ['building-north', 'building-south']
    },
    scheduled_for: tomorrow.toISOString(),
    publish_status: 'PUBLISH',
    deactivated: false
  };

  // In a real application, you would save this to the database
  console.log('Scheduled notification data:', JSON.stringify(scheduledNotificationData, null, 2));
  console.log(`Scheduled for: ${tomorrow.toISOString()}`);
  
  console.log('✅ Scheduled notification created');
}

async function monitorSystemStatus(ruleEngine: RuleEngineService) {
  console.log('📊 Checking system status...');
  
  const status = await ruleEngine.getStatus();
  
  console.log('System Status:');
  console.log(`- Initialized: ${status.initialized}`);
  console.log(`- Active Cron Jobs: ${status.cronJobs.length}`);
  console.log(`- Scheduled Manager Running: ${status.scheduledNotifications.isRunning}`);
  console.log(`- Queue Stats:`, status.queueStats);
  console.log(`- Scheduled Stats:`, status.scheduledStats);
  
  // Show details of cron jobs
  if (status.cronJobs.length > 0) {
    console.log('\nActive Cron Jobs:');
    status.cronJobs.forEach(job => {
      console.log(`  - Rule ${job.ruleId} (${job.enterpriseId}): ${job.cronExpression}`);
      console.log(`    Timezone: ${job.timezone}, Running: ${job.isRunning}, Scheduled: ${job.isScheduled}`);
    });
  }
}

async function performHealthCheck(ruleEngine: RuleEngineService) {
  console.log('🏥 Performing health check...');
  
  const health = await ruleEngine.healthCheck();
  
  console.log(`Overall Status: ${health.status}`);
  console.log('Component Health:');
  console.log(`- Initialized: ${health.details.initialized}`);
  console.log(`- Cron Manager: ${health.details.cronManager}`);
  console.log(`- Scheduled Manager: ${health.details.scheduledManager}`);
  console.log(`- Queue: ${health.details.queue}`);
  
  if (health.status === 'unhealthy') {
    console.warn('⚠️ System is unhealthy, check component details above');
  } else {
    console.log('✅ System is healthy');
  }
}

async function demonstrateMaintenanceOperations(ruleEngine: RuleEngineService) {
  console.log('🔧 Demonstrating maintenance operations...');
  
  // Pause processing
  console.log('Pausing rule engine...');
  await ruleEngine.pause();
  console.log('✅ Rule engine paused');
  
  // Check status while paused
  const pausedStatus = await ruleEngine.getStatus();
  console.log(`Scheduled manager running while paused: ${pausedStatus.scheduledNotifications.isRunning}`);
  
  // Resume processing
  console.log('Resuming rule engine...');
  await ruleEngine.resume();
  console.log('✅ Rule engine resumed');
  
  // Reload specific enterprise rules
  console.log('Reloading rules for enterprise ent-demo-123...');
  await ruleEngine.reloadCronRules('ent-demo-123');
  console.log('✅ Enterprise rules reloaded');
}

async function gracefulShutdown(ruleEngine: RuleEngineService) {
  console.log('🛑 Performing graceful shutdown...');
  
  await ruleEngine.shutdown();
  
  console.log('✅ Rule engine shutdown complete');
}

// Main demonstration function
async function main() {
  let ruleEngine: RuleEngineService;
  
  try {
    // Initialize the rule engine
    ruleEngine = await initializeRuleEngine();
    
    // Create example rules and notifications
    await createCronRule(ruleEngine);
    await createScheduledNotification(ruleEngine);
    
    // Monitor system
    await monitorSystemStatus(ruleEngine);
    await performHealthCheck(ruleEngine);
    
    // Demonstrate maintenance operations
    await demonstrateMaintenanceOperations(ruleEngine);
    
    console.log('\n🎉 Rule Engine demonstration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during demonstration:', error);
  } finally {
    // Always perform graceful shutdown
    if (ruleEngine!) {
      await gracefulShutdown(ruleEngine);
    }
  }
}

// Additional utility functions for real-world usage

/**
 * Create a weekly maintenance reminder rule
 */
export async function createWeeklyMaintenanceRule(
  enterpriseId: string,
  buildingId: string,
  recipients: string[]
): Promise<NotificationRuleInsert> {
  return {
    name: `Weekly Maintenance - ${buildingId}`,
    description: 'Weekly maintenance reminder for building systems',
    enterprise_id: enterpriseId,
    notification_workflow_id: 3, // Maintenance workflow
    trigger_type: 'CRON',
    trigger_config: {
      cron: '0 8 * * 1', // Every Monday at 8 AM
      timezone: 'UTC',
      enabled: true
    },
    rule_payload: {
      recipients,
      payload: {
        buildingId,
        maintenanceType: 'weekly_inspection',
        checklistUrl: `https://maintenance.company.com/checklist/${buildingId}`
      }
    },
    publish_status: 'PUBLISH',
    deactivated: false
  };
}

/**
 * Create an emergency notification for immediate delivery
 */
export async function createEmergencyNotification(
  enterpriseId: string,
  buildingId: string,
  emergencyType: string,
  message: string,
  recipients: string[]
): Promise<NotificationInsert> {
  return {
    name: `Emergency: ${emergencyType}`,
    description: `Emergency notification for ${buildingId}`,
    enterprise_id: enterpriseId,
    notification_workflow_id: 4, // Emergency workflow
    notification_status: 'PENDING',
    channels: ['EMAIL', 'SMS', 'IN_APP', 'PUSH'],
    recipients,
    payload: {
      emergencyType,
      buildingId,
      message,
      severity: 'CRITICAL',
      timestamp: new Date().toISOString(),
      contactNumber: '+1-555-EMERGENCY'
    },
    // No scheduled_for = immediate processing
    publish_status: 'PUBLISH',
    deactivated: false
  };
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}