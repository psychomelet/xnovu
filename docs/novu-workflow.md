# Novu Workflow Development Guide

This document provides comprehensive guidance for developing Novu workflows in XNovu.

## Static vs Dynamic Workflows

### Static Workflows (System-Critical)
```tsx
// Example: User signup workflow - hardcoded, non-configurable
export const userSignupWorkflow = workflow(
  'user-signup',
  async ({ step, payload }) => {
    // Fixed workflow logic
    await step.email('welcome-email', async () => ({
      subject: 'Welcome to Smart Building Platform',
      body: renderWelcomeEmail(payload)
    }));
  },
  {
    payloadSchema: z.object({
      userId: z.string(),
      buildingId: z.string(),
      role: z.enum(['admin', 'tenant', 'visitor'])
    })
  }
);
```

### Dynamic Workflows (User-Configurable)
```tsx
// Example: Dynamic notification workflow
export const dynamicNotificationWorkflow = workflow(
  'dynamic-notification',
  async ({ step, payload }) => {
    // Template and configuration from database
    const config = payload.workflowConfig;

    if (config.channels.email?.enabled) {
      await step.email('dynamic-email', async () => ({
        subject: config.channels.email.subject,
        body: renderTemplate(config.channels.email.template, payload.data)
      }));
    }

    if (config.channels.inApp?.enabled) {
      await step.inApp('dynamic-in-app', async () => ({
        body: config.channels.inApp.message
      }));
    }
  },
  {
    payloadSchema: z.object({
      workflowConfig: z.object({
        channels: z.object({
          email: z.object({
            enabled: z.boolean(),
            subject: z.string(),
            template: z.string()
          }).optional(),
          inApp: z.object({
            enabled: z.boolean(),
            message: z.string()
          }).optional()
        })
      }),
      data: z.record(z.any()) // Dynamic payload data
    })
  }
);
```

## Smart Building Specific Patterns

### Subscriber Context
In the smart building context, subscribers typically represent:
- Building administrators
- Tenants
- Maintenance staff
- Visitors
- IoT device operators

### Supabase Integration Pattern

```tsx
// Subscribe to notification inserts
const subscription = supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'notify',
    table: 'ent_notification'
  }, async (payload) => {
    // Query full notification data
    const { data: notification } = await supabase
      .from('ent_notification')
      .select('*')
      .eq('id', payload.new.id)
      .single();

    // Trigger appropriate workflow
    await triggerWorkflow(notification);
  })
  .subscribe();
```

### Common Notification Scenarios
1. **Facility Alerts** - HVAC failures, security breaches, access control
2. **Maintenance Notifications** - Scheduled maintenance, work orders
3. **Tenant Communications** - Announcements, billing, amenity updates
4. **Emergency Broadcasts** - Fire alarms, evacuations, safety alerts
5. **IoT Device Alerts** - Sensor thresholds, device failures

### Payload Structure for Building Context
```tsx
const buildingNotificationSchema = z.object({
  // Building context
  campusId: z.string(),
  buildingId: z.string(),
  floor: z.number().optional(),
  zone: z.string().optional(),

  // Notification metadata
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.enum(['maintenance', 'security', 'facility', 'emergency', 'general']),

  // Target audience
  targetRole: z.enum(['all', 'admin', 'tenant', 'maintenance', 'security']).optional(),
  targetBuildings: z.array(z.string()).optional(),

  // Dynamic data from management platform
  data: z.record(z.any())
});
```

## Workflow Development Guide

### Core Building Blocks
1. **Trigger** - The event that starts the workflow (workflow identifier becomes the trigger ID)
2. **Channel Steps** - Delivery methods: `email`, `sms`, `push`, `inApp`, `chat`
3. **Action Steps** - Flow control: `delay`, `custom`, `digest`

### Complete Workflow Structure
```tsx
import { workflow } from '@novu/framework';
import { z } from 'zod';

export const myWorkflow = workflow(
  'workflow-identifier', // This becomes the trigger ID
  async ({ step, payload, subscriber }) => {
    // Workflow steps here
  },
  {
    payloadSchema: z.object({
      // Define payload validation - data passed during novu.trigger()
    }),
    name: 'Human Readable Name', // Optional: displayed in Dashboard and Inbox
    description: 'Workflow description', // Optional: for documentation
    tags: ['category'], // Optional: for organization and filtering
    preferences: { // Optional: control notification delivery preferences
      all: { enabled: true, readOnly: false },
      channels: {
        inApp: { enabled: true },
        email: { enabled: true },
        sms: { enabled: true },
        chat: { enabled: true },
        push: { enabled: true },
      },
    },
  }
);
```

### Workflow Context
- **subscriber**: Contains `subscriberId`, `firstName`, `lastName`, and other subscriber data
- **payload**: Type-safe payload based on payloadSchema validation
- **step**: Object containing all step functions for building the workflow

### Channel Steps - Complete Reference

#### Email Channel
```tsx
await step.email('email-step', async (controls) => {
  return {
    subject: controls.subject || 'Default Subject',
    body: controls.body || '<html>Email content</html>',
    // Optional fields:
    from: 'sender@example.com',
    replyTo: 'reply@example.com',
    attachments: [{
      file: Buffer.from('content'),
      name: 'file.txt',
      contentType: 'text/plain' // Optional
    }]
  };
}, {
  controlSchema: z.object({
    subject: z.string().default('Welcome {{subscriber.firstName}}'),
    body: z.string()
  }),
  skip: async (controls) => false, // Optional: skip condition
  providers: { // Optional: provider-specific overrides
    sendgrid: ({ controls, outputs }) => ({
      // Provider-specific configuration
      _passthrough: {
        body: { ip_pool_name: 'my-ip-pool' },
        headers: { 'Authorization': 'Bearer my-api-key' },
        query: { 'queryParam': 'queryValue' }
      }
    })
  }
});
```

#### In-App Channel
```tsx
// Returns: { seen: boolean, read: boolean, lastSeenDate: Date | null, lastReadDate: Date | null }
const inAppResult = await step.inApp('inbox-step', async (controls) => {
  return {
    subject: 'Notification Title', // Optional
    body: 'Notification message content', // Required
    // Optional fields:
    avatar: 'https://example.com/avatar.png',
    redirect: {
      url: 'https://example.com/page',
      target: '_blank' // '_self' | '_blank' | '_parent' | '_top' | '_unfencedTop'
    },
    primaryAction: {
      label: 'Primary Button',
      redirect: {
        url: 'https://example.com/action',
        target: '_self'
      }
    },
    secondaryAction: {
      label: 'Secondary Button',
      redirect: {
        url: 'https://example.com/secondary',
        target: '_self'
      }
    },
    data: {
      // Custom data payload for Inbox component customization
      customField: 'value',
      nested: { data: 'here' }
    }
  };
}, {
  disableOutputSanitization: true // Optional: prevent HTML escaping
});

// Use result in subsequent steps
if (inAppResult.seen) {
  // Take action based on notification being seen
}
```

#### SMS Channel
```tsx
await step.sms('sms-step', async (controls) => {
  return {
    body: controls.message || 'Your SMS message here',
    // Optional fields:
    to: '+1234567890' // Override recipient
  };
});
```

#### Push Channel
```tsx
await step.push('push-step', async (controls) => {
  return {
    title: 'Push Notification Title', // Required (not 'subject')
    body: 'Push notification body text', // Required
    // Optional fields:
    data: { customData: 'value' },
    image: 'https://example.com/image.png',
    icon: 'https://example.com/icon.png'
  };
});
```

#### Chat Channel
```tsx
await step.chat('chat-step', async (controls) => {
  return {
    body: 'Chat message content',
    // Optional fields:
    webhookUrl: 'https://hooks.slack.com/...'
  };
});
```

### Action Steps - Complete Reference

#### Delay Step
```tsx
await step.delay('wait-step', async (controls) => {
  return {
    amount: controls.delayAmount || 1,
    unit: controls.delayUnit || 'days' // 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
  };
}, {
  controlSchema: z.object({
    delayAmount: z.number().min(1).default(7),
    delayUnit: z.enum(['seconds', 'minutes', 'hours', 'days', 'weeks', 'months']).default('days')
  })
});
```

#### Digest Step (Batch notifications)
```tsx
await step.digest('digest-step', async (controls) => {
  return {
    amount: 30,
    unit: 'minutes', // Collect events for 30 minutes
    // Optional fields:
    lookBackWindow: {
      amount: 5,
      unit: 'minutes' // Check 5 minutes back for existing digests
    },
    digestKey: 'userId' // Group by this field
  };
});
```

#### Custom Step
```tsx
const customResult = await step.custom('custom-step', async (controls) => {
  // Perform custom logic - Note: no 'event' parameter
  const apiResponse = await fetch('https://api.example.com/data');
  const data = await apiResponse.json();

  return {
    success: true,
    data: data,
    // Any custom return data
  };
}, {
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any()
  })
});

// Access custom step results with type safety
if (customResult.success) {
  // Use customResult.data in subsequent steps
}
```

### Schema Validation Options

#### Using Zod (Recommended)
```tsx
import { z } from 'zod';

const payloadSchema = z.object({
  userId: z.string(),
  amount: z.number().positive(),
  email: z.string().email(),
  metadata: z.object({
    source: z.enum(['web', 'mobile', 'api']),
    timestamp: z.string().datetime()
  }).optional()
});

const controlSchema = z.object({
  subject: z.string().min(1).max(100),
  showBanner: z.boolean().default(true),
  buttonColor: z.string().regex(/^#[0-9A-F]{6}$/i).default('#0066FF')
});
```

#### Using JSON Schema
```tsx
const payloadSchema = {
  type: 'object',
  properties: {
    userId: { type: 'string' },
    amount: { type: 'number', minimum: 0 },
    email: { type: 'string', format: 'email' }
  },
  required: ['userId', 'email'],
  additionalProperties: false
} as const;
```

#### Using Class-Validator
```tsx
import { IsString, IsEmail, IsPositive, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PayloadSchema {
  @IsString()
  userId: string;

  @IsPositive()
  amount: number;

  @IsEmail()
  email: string;
}
```

### Control vs Payload Schema
- **Payload Schema**: Developer-controlled data passed via `novu.trigger()`
- **Control Schema**: Non-technical user editable values in Novu Dashboard

Example showing both:
```tsx
workflow('order-confirmation',
  async ({ step, payload }) => {
    await step.email('send-confirmation', async (controls) => {
      return {
        subject: controls.subject.replace('{{orderId}}', payload.orderId),
        body: controls.emailTemplate
      };
    }, {
      controlSchema: z.object({
        subject: z.string().default('Order {{orderId}} Confirmed'),
        emailTemplate: z.string()
      })
    });
  },
  {
    payloadSchema: z.object({
      orderId: z.string(),
      customerEmail: z.string().email(),
      items: z.array(z.object({
        name: z.string(),
        quantity: z.number()
      }))
    })
  }
);
```

### Advanced Patterns

#### Just-in-Time Data Fetching
```tsx
await step.email('dynamic-email', async () => {
  // Fetch fresh data during execution
  const user = await db.getUser(payload.userId);
  const account = await api.getAccountDetails(user.accountId);

  return {
    subject: `${user.name}, your ${account.plan} plan update`,
    body: generateEmailBody(user, account)
  };
});
```

#### Conditional Step Execution
```tsx
await step.inApp('premium-notification',
  async () => ({
    subject: 'Exclusive Premium Feature',
    body: 'Check out our new premium features!'
  }),
  {
    skip: async () => {
      const user = await db.getUser(payload.userId);
      return user.plan !== 'premium'; // Skip if not premium
    }
  }
);
```

#### Multi-Step Workflow with Branching
```tsx
workflow('user-onboarding', async ({ step, payload }) => {
  // Initial welcome email
  await step.email('welcome', async () => ({
    subject: 'Welcome to Our Platform!',
    body: welcomeEmailTemplate()
  }));

  // Wait 3 days
  await step.delay('wait-3-days', async () => ({
    amount: 3,
    unit: 'days'
  }));

  // Check if user completed profile
  const profileStatus = await step.custom('check-profile', async () => {
    const user = await db.getUser(payload.userId);
    return { isComplete: user.profileComplete };
  });

  // Send different follow-up based on profile status
  if (!profileStatus.isComplete) {
    await step.email('complete-profile-reminder', async () => ({
      subject: 'Complete Your Profile for Better Experience',
      body: profileReminderTemplate()
    }));
  } else {
    await step.inApp('feature-announcement', async () => ({
      subject: 'Discover Our Features',
      body: 'Now that your profile is set up, explore these features...'
    }));
  }
});
```

#### Using Tags for Organization
```tsx
// Security-related notifications
workflow('login-alert', async ({ step }) => { ... }, {
  tags: ['security', 'alerts', 'high-priority']
});

workflow('password-reset', async ({ step }) => { ... }, {
  tags: ['security', 'account']
});

// Marketing notifications
workflow('weekly-newsletter', async ({ step }) => { ... }, {
  tags: ['marketing', 'newsletter', 'recurring']
});
```

### React Email Integration
```tsx
// 1. Create email template: app/novu/emails/order-confirmation.tsx
import { Html, Body, Container, Text, Button } from '@react-email/components';

interface OrderEmailProps {
  customerName: string;
  orderId: string;
  items: Array<{ name: string; quantity: number }>;
}

export const OrderConfirmationEmail = ({ customerName, orderId, items }: OrderEmailProps) => (
  <Html>
    <Body>
      <Container>
        <Text>Hi {customerName},</Text>
        <Text>Your order #{orderId} has been confirmed!</Text>
        {items.map((item, i) => (
          <Text key={i}>{item.name} x{item.quantity}</Text>
        ))}
        <Button href="https://example.com/orders">View Order</Button>
      </Container>
    </Body>
  </Html>
);

// 2. Use in workflow
import { render } from '@react-email/components';
import { OrderConfirmationEmail } from '../../emails/order-confirmation';

await step.email('order-confirmation', async () => ({
  subject: `Order #${payload.orderId} Confirmed`,
  body: render(
    <OrderConfirmationEmail
      customerName={payload.customerName}
      orderId={payload.orderId}
      items={payload.items}
    />
  )
}));
```

### Triggering Workflows

#### From Server-Side Code
```tsx
import { Novu } from '@novu/api';

const novu = new Novu({ secretKey: process.env.NOVU_SECRET_KEY });

// Basic trigger
await novu.trigger({
  to: {
    subscriberId: 'user-123', // Required
    email: 'user@example.com', // Optional subscriber data
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    avatar: 'https://example.com/avatar.jpg',
    locale: 'en-US',
    data: { customField: 'value' } // Custom subscriber data
  },
  workflowId: 'workflow-identifier',
  payload: {
    // Type-safe payload matching your workflow's payloadSchema
    orderId: 'ORD-123',
    amount: 99.99
  },
  overrides: { // Optional: override workflow settings
    email: {
      from: 'special@example.com'
    }
  },
  actor: { // Optional: who triggered this notification
    subscriberId: 'admin-456'
  }
});

// Bulk trigger to multiple subscribers
await novu.bulkTrigger([
  {
    name: 'workflow-identifier',
    to: { subscriberId: 'user-1' },
    payload: { amount: 100 }
  },
  {
    name: 'workflow-identifier',
    to: { subscriberId: 'user-2' },
    payload: { amount: 200 }
  }
]);
```

#### From Client-Side (via API endpoint)
```tsx
// Create an API endpoint (e.g., /api/trigger)
export async function POST(request: Request) {
  const { workflowId, subscriberId, payload } = await request.json();

  const novu = new Novu({ secretKey: process.env.NOVU_SECRET_KEY });

  await novu.trigger({
    to: { subscriberId },
    workflowId,
    payload
  });

  return Response.json({ success: true });
}
```

### Step Options Interface

#### Common Options (All Steps)
```tsx
{
  controlSchema: ZodSchema | JsonSchema | ClassValidator, // Define dashboard controls
  skip: async (controls) => boolean, // Conditionally skip the step
  providers: { // Provider-specific overrides
    [providerName]: ({ controls, outputs }) => ProviderConfig
  },
  disableOutputSanitization: boolean // Prevent HTML escaping (default: false)
}
```

#### Provider Overrides
```tsx
await step.email('send-email', resolver, {
  providers: {
    sendgrid: ({ controls, outputs }) => ({
      // Provider-specific fields
      personalizations: [{ to: [{ email: 'user@example.com' }] }],
      // Passthrough for raw API access
      _passthrough: {
        body: { ip_pool_name: 'transactional' },
        headers: { 'X-Custom-Header': 'value' },
        query: { 'param': 'value' }
      }
    }),
    slack: ({ controls, outputs }) => ({
      text: outputs.body,
      blocks: [{
        type: 'section',
        text: { type: 'mrkdwn', text: outputs.body }
      }]
    })
  }
});
```

## Common Patterns

### Building-wide Broadcast
```tsx
// Broadcast to all occupants of specific buildings
await novu.bulkTrigger(
  buildingOccupants.map(occupant => ({
    name: 'building-announcement',
    to: { subscriberId: occupant.id },
    payload: {
      buildingId: building.id,
      message: announcement.message,
      priority: 'medium'
    }
  }))
);
```

### Zone-specific Alerts
```tsx
// Target specific zones within buildings
const zoneSubscribers = await getSubscribersByZone(buildingId, zoneId);
await triggerZoneAlert(zoneSubscribers, alertData);
```

### Escalation Workflows
```tsx
// Escalate unacknowledged critical alerts
workflow('critical-alert-escalation', async ({ step, payload }) => {
  // Initial notification
  const result = await step.inApp('initial-alert', async () => ({
    body: payload.message,
    data: { requiresAcknowledgment: true }
  }));

  // Wait for acknowledgment
  await step.delay('wait-for-ack', async () => ({
    amount: 5,
    unit: 'minutes'
  }));

  // Escalate if not acknowledged
  if (!result.read) {
    await step.email('escalation-email', async () => ({
      to: payload.escalationEmail,
      subject: 'URGENT: Unacknowledged Critical Alert',
      body: renderEscalationEmail(payload)
    }));
  }
});
```