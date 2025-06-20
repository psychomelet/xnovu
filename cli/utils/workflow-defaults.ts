import { faker } from '@faker-js/faker';

/**
 * Generates default payload values for different workflow types
 * These are sensible test values that respect schema constraints
 */

interface WorkflowDefaults {
  [key: string]: Record<string, any>;
}

// Helper to generate building-related data for fire safety workflows
function generateBuildingData() {
  return {
    buildingName: faker.company.name() + ' Building',
    buildingAddress: faker.location.streetAddress(true),
    floorNumber: faker.number.int({ min: 1, max: 20 }),
    evacuationPoint: `Assembly Point ${faker.helpers.arrayElement(['A', 'B', 'C', 'D'])}`,
    emergencyContact: {
      name: faker.person.fullName(),
      phone: faker.phone.number(),
      role: faker.helpers.arrayElement(['Fire Marshal', 'Safety Officer', 'Building Manager'])
    }
  };
}

export const workflowDefaults: WorkflowDefaults = {
  'default-email': {
    subject: 'Test Email Notification',
    recipientName: faker.person.fullName(),
    title: 'Important Update',
    message: faker.lorem.paragraph(),
    ctaText: 'View Details',
    ctaUrl: 'https://example.com/action',
    footer: 'This is an automated notification from XNovu',
    priority: 'medium',
    category: 'update',
    customData: {
      generatedAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }
  },

  'default-sms': {
    recipientName: faker.person.firstName(),
    recipientPhone: faker.phone.number(),
    message: faker.lorem.sentence({ min: 5, max: 10 }), // Keep under 160 chars
    urgency: 'medium',
    includeLink: false,
    customData: {
      source: 'CLI Trigger'
    }
  },

  'default-in-app': {
    inAppSubject: 'New Notification',
    inAppBody: faker.lorem.paragraph(2),
    priority: 'medium',
    category: 'general',
    actionUrl: 'https://app.example.com/notifications',
    customData: {
      timestamp: new Date().toISOString()
    }
  },

  'default-push': {
    title: 'Push Notification',
    message: faker.lorem.sentence(),
    actionUrl: 'https://app.example.com',
    imageUrl: 'https://via.placeholder.com/400x200',
    iconUrl: 'https://via.placeholder.com/96x96',
    priority: 'high',
    category: 'alert',
    customData: {
      badge: 1
    }
  },

  'default-chat': {
    title: 'System Alert',
    message: faker.lorem.paragraph(),
    platform: 'slack',
    webhookUrl: process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
    mentions: [],
    priority: 'medium',
    customData: {
      channel: '#notifications'
    }
  },

  'default-multi-channel': {
    title: 'Multi-Channel Notification',
    message: faker.lorem.paragraph(),
    priority: 'medium',
    category: 'update',
    actionUrl: 'https://app.example.com/action',
    
    // Channel-specific content
    emailSubject: 'Important: Multi-Channel Update',
    emailPreheader: 'You have a new notification',
    emailCtaText: 'View in App',
    
    smsMessage: faker.lorem.sentence({ min: 5, max: 8 }),
    smsIncludeLink: true,
    
    pushTitle: 'New Update Available',
    pushBody: faker.lorem.sentence(),
    pushImageUrl: 'https://via.placeholder.com/400x200',
    
    inAppSubject: 'You have a new notification',
    inAppBody: faker.lorem.paragraph(),
    inAppAvatar: 'https://via.placeholder.com/48x48',
    
    chatWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    chatMentions: [],
    
    customData: {
      source: 'XNovu CLI',
      triggeredAt: new Date().toISOString()
    }
  },

  'default-dynamic-multi': {
    channels: [
      {
        type: 'email',
        enabled: true,
        content: {
          subject: 'Dynamic Email Notification',
          body: faker.lorem.paragraphs(2),
          ctaText: 'Take Action',
          ctaUrl: 'https://example.com'
        }
      },
      {
        type: 'inApp',
        enabled: true,
        content: {
          subject: 'New In-App Message',
          body: faker.lorem.paragraph(),
          avatar: 'https://via.placeholder.com/48x48'
        }
      }
    ],
    globalVariables: {
      userName: faker.person.fullName(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    },
    metadata: {
      source: 'CLI Dynamic Trigger',
      version: '1.0'
    }
  },

  // Fire safety workflows
  'default-fire-emergency': {
    ...generateBuildingData(),
    fireLocation: `Floor ${faker.number.int({ min: 1, max: 20 })}, ${faker.helpers.arrayElement(['North', 'South', 'East', 'West'])} Wing`,
    evacuationStatus: 'IN_PROGRESS',
    estimatedContainmentTime: '30 minutes',
    affectedAreas: [`Zone ${faker.helpers.arrayElement(['A', 'B', 'C'])}`, `Zone ${faker.helpers.arrayElement(['D', 'E', 'F'])}`],
    emergencyServices: {
      fireNotified: true,
      policeNotified: false,
      ambulanceNotified: true,
      arrivalTime: '5-10 minutes'
    },
    safetyInstructions: [
      'Use stairs, do not use elevators',
      'Close doors behind you',
      'Proceed to nearest assembly point',
      'Do not re-enter building until all-clear'
    ],
    priority: 'critical',
    customData: {
      incidentId: faker.string.uuid(),
      triggeredBy: 'Smoke Detector - Zone A3'
    }
  },

  'default-fire-drill': {
    ...generateBuildingData(),
    drillType: faker.helpers.arrayElement(['scheduled', 'surprise']),
    scheduledTime: faker.date.future().toISOString(),
    expectedDuration: '15-20 minutes',
    assemblyPoints: ['North Parking Lot', 'South Garden Area'],
    participationRequired: true,
    floorWardens: [
      { floor: 1, name: faker.person.fullName(), contact: faker.phone.number() },
      { floor: 2, name: faker.person.fullName(), contact: faker.phone.number() }
    ],
    instructions: [
      'This is a scheduled fire drill',
      'Please evacuate calmly via nearest exit',
      'Report to your designated assembly point',
      'Wait for all-clear signal'
    ],
    priority: 'high',
    customData: {
      drillId: faker.string.uuid()
    }
  },

  'default-fire-assessment': {
    ...generateBuildingData(),
    assessmentType: 'annual',
    scheduledDate: faker.date.future().toISOString(),
    assessor: {
      name: faker.person.fullName(),
      company: faker.company.name(),
      certification: `FPA-${faker.number.int({ min: 10000, max: 99999 })}`
    },
    areasToAssess: [
      'Fire alarm systems',
      'Emergency lighting',
      'Fire extinguishers',
      'Evacuation routes',
      'Assembly points'
    ],
    estimatedDuration: '2-3 hours',
    contactPerson: {
      name: faker.person.fullName(),
      role: 'Facilities Manager',
      phone: faker.phone.number(),
      email: faker.internet.email()
    },
    priority: 'medium',
    customData: {
      assessmentId: faker.string.uuid(),
      lastAssessmentDate: faker.date.past().toISOString()
    }
  }
};

/**
 * Get default payload for a workflow
 * Returns a copy to prevent mutation
 */
export function getWorkflowDefaults(workflowKey: string): Record<string, any> {
  const defaults = workflowDefaults[workflowKey];
  if (!defaults) {
    // Return minimal defaults for unknown workflows
    return {
      title: 'Test Notification',
      message: 'This is a test notification triggered from CLI',
      priority: 'medium',
      customData: {
        source: 'XNovu CLI',
        timestamp: new Date().toISOString()
      }
    };
  }
  
  // Return a deep copy to prevent mutation
  return JSON.parse(JSON.stringify(defaults));
}

/**
 * Merge custom payload with defaults
 * Custom values override defaults
 */
export function mergePayloadWithDefaults(
  workflowKey: string, 
  customPayload: Record<string, any>
): Record<string, any> {
  const defaults = getWorkflowDefaults(workflowKey);
  
  // Deep merge, with custom values taking precedence
  return {
    ...defaults,
    ...customPayload,
    customData: {
      ...(defaults.customData || {}),
      ...(customPayload.customData || {})
    }
  };
}