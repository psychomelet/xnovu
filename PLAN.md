# XNovu Future Development Plan

## Overview

This document outlines the comprehensive development plan for evolving XNovu from its current static workflow implementation to a fully-featured, database-driven notification system. The plan maintains code-defined workflows as the foundation while adding flexibility through database configuration, template management, and dynamic rule processing.

## Key Architectural Principles

- Workflows remain code-defined but can load configuration from database
- Enterprise isolation at every layer
- Template syntax `{{ xnovu_render() }}` for universal template loading
- Progressive enhancement from simple to complex features
- Clear separation between static (system-critical) and dynamic (user-configurable) workflows

## Phase 1: Core Infrastructure (Week 1-2)

### 1.1 Supabase Integration Layer

#### Supabase Client Setup
- Add `@supabase/supabase-js` dependency
- Create `lib/supabase/client.ts` with proper typing
- Implement connection pooling and error handling
- Add environment variables for Supabase URL and keys

#### Database Service Layer
Create `services/database/` directory with modular services:
- `NotificationService.ts` - CRUD operations for notifications
- `WorkflowService.ts` - Workflow configuration management
- `TemplateService.ts` - Template storage and retrieval
- `RuleService.ts` - Rule management

All queries must be enterprise_id scoped.

#### Realtime Subscription Manager
- Create `services/realtime/SubscriptionManager.ts`
- Subscribe to `ent_notification` INSERT events
- Handle connection lifecycle (reconnection, error recovery)
- Queue mechanism for handling high-volume inserts

### 1.2 Template Rendering Engine

#### XNovu Template Syntax
```typescript
// Template syntax: {{ xnovu_render(template_id, variables) }}
// Example: {{ xnovu_render('12345', { userName: 'John', eventDate: '2024-01-01' }) }}
```

#### Template Renderer Service
- Create `services/template/TemplateRenderer.ts`
- Parse templates for `xnovu_render` syntax using regex
- Query `ent_notification_template` by ID with enterprise_id scope
- Support nested template rendering
- Cache templates with TTL for performance
- Handle missing templates gracefully

#### Integration Points
- Extend existing React Email components
- Support in workflow step resolvers
- Add template validation on save

## Phase 2: Dynamic Workflow System (Week 3-4)

### 2.1 Dynamic Workflow Architecture

#### Workflow Factory Pattern
```typescript
// Dynamic workflow that loads configuration from database
export const createDynamicWorkflow = (config: WorkflowConfig) => {
  return workflow(
    config.workflow_key,
    async ({ step, payload }) => {
      // Update status to PROCESSING
      await updateNotificationStatus(payload.notificationId, 'PROCESSING');
      
      try {
        // Dynamic channel execution based on config
        for (const channel of config.channels) {
          if (channel === 'EMAIL') {
            await step.email('dynamic-email', async () => {
              const template = await loadTemplate(config.emailTemplateId);
              return {
                subject: renderTemplate(template.subject, payload),
                body: renderTemplate(template.body, payload)
              };
            });
          }
          // ... other channels
        }
        
        // Update status to SENT
        await updateNotificationStatus(payload.notificationId, 'SENT');
      } catch (error) {
        await updateNotificationStatus(payload.notificationId, 'FAILED', error);
        throw error;
      }
    },
    {
      payloadSchema: config.payloadSchema,
      tags: config.tags
    }
  );
};
```

#### Workflow Registry Service
- Create `services/workflow/WorkflowRegistry.ts`
- Load all STATIC workflows from code
- Dynamically create DYNAMIC workflows from database
- Cache workflow instances
- Hot-reload on configuration changes

### 2.2 Workflow Discovery & Loading

#### Auto-discovery System
- Scan `app/novu/workflows/` directory
- Register workflows by their identifier
- Map to `workflow_key` in database
- Validate workflow existence on startup

#### Database Sync
- Create sync command to update database with code workflows
- Validate workflow_key uniqueness
- Track workflow versions

## Phase 3: Rule Engine & Scheduling (Week 5-6)

### 3.1 Rule Engine Implementation

#### Rule Processor
```typescript
interface RuleConfig {
  trigger_type: 'EVENT' | 'SCHEDULE';
  trigger_config: {
    event_name?: string;
    cron?: string;
    conditions?: any;
  };
  rule_payload: string; // JavaScript code
}
```

#### Event-based Rules
- Create event bus system
- Listen to system events (user.signup, device.alert, etc.)
- Evaluate rule conditions
- Trigger notifications with computed payload

#### Scheduled Rules (Cron)
- Integrate `node-cron` or similar
- Create `services/scheduler/CronManager.ts`
- Load active rules from database
- Execute rule_payload JavaScript safely (VM2 or similar)
- Generate notification records

### 3.2 Rule Payload Execution

#### Safe JavaScript Execution
```typescript
// Example rule_payload
const rulePayload = `
  const users = await db.query('SELECT * FROM users WHERE building_id = ?', context.buildingId);
  return users.map(user => ({
    subscriberId: user.id,
    payload: {
      userName: user.name,
      message: 'Monthly maintenance reminder'
    }
  }));
`;
```

#### Execution Context
- Provide safe database query methods
- Access to date/time utilities
- Building/enterprise context
- Limited JavaScript API surface

## Phase 4: Status Management & Cancellation (Week 7)

### 4.1 Notification Lifecycle Management

#### Status Update Hooks
- Inject status updates at workflow start/end
- Handle async status propagation
- Implement retry logic for failed updates

#### Cancellation API
```typescript
// POST /api/notifications/:id/cancel
export async function cancelNotification(notificationId: string) {
  // 1. Update database status to RETRACTED
  await updateNotificationStatus(notificationId, 'RETRACTED');
  
  // 2. Get transaction_id from notification
  const notification = await getNotification(notificationId);
  
  // 3. Cancel via Novu API
  if (notification.transaction_id) {
    await novu.events.cancel(notification.transaction_id);
  }
}
```

### 4.2 Status Tracking Service
- Real-time status updates via webhooks
- Batch status processing for performance
- Status history tracking
- Analytics and reporting

## Phase 5: Multi-tenancy & Security (Week 8)

### 5.1 Enterprise Isolation

#### Query Interceptor
- Automatic enterprise_id injection in all queries
- Row-level security policies
- Audit logging

#### Context Management
```typescript
// Enterprise context middleware
export function withEnterprise(enterpriseId: string) {
  return AsyncLocalStorage.run({ enterpriseId }, callback);
}
```

### 5.2 Security Enhancements
- Input validation for all API endpoints
- Rate limiting per enterprise
- Webhook signature verification
- Encrypted template variables

## Phase 6: Advanced Features (Week 9-10)

### 6.1 Template Marketplace
- Shareable template library
- Version control for templates
- Template inheritance and composition

### 6.2 Analytics & Monitoring
- Notification delivery metrics
- Channel performance tracking
- Rule execution statistics
- Real-time dashboards

### 6.3 Advanced Triggering
- Batch notification processing
- Priority queues
- Delivery time optimization
- A/B testing for templates

## Technical Implementation Details

### Database Query Patterns
```typescript
// Always scope by enterprise_id
const getWorkflows = async (enterpriseId: string) => {
  return supabase
    .from('ent_notification_workflow')
    .select('*')
    .eq('enterprise_id', enterpriseId)
    .eq('publish_status', 'PUBLISHED')
    .eq('deactivated', false);
};
```

### Template Rendering Implementation
```typescript
class TemplateRenderer {
  private cache = new Map<string, CompiledTemplate>();
  
  async render(template: string, enterpriseId: string, variables: Record<string, any>) {
    // Parse xnovu_render syntax
    const regex = /\{\{\s*xnovu_render\s*\(\s*['"]([^'"]+)['"]\s*,\s*({[^}]+})\s*\)\s*\}\}/g;
    
    let result = template;
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      const [fullMatch, templateId, varsJson] = match;
      const templateVars = JSON.parse(varsJson);
      
      // Load template from database
      const dbTemplate = await this.loadTemplate(templateId, enterpriseId);
      
      // Recursive rendering
      const rendered = await this.render(dbTemplate.body_template, enterpriseId, {
        ...variables,
        ...templateVars
      });
      
      result = result.replace(fullMatch, rendered);
    }
    
    // Handle standard variables
    return this.interpolate(result, variables);
  }
}
```

### Workflow Registration
```typescript
// On startup
async function registerWorkflows() {
  // 1. Register static workflows from code
  const staticWorkflows = await discoverStaticWorkflows();
  
  // 2. Load dynamic workflow configs from database
  const dynamicConfigs = await loadDynamicWorkflowConfigs();
  
  // 3. Create dynamic workflow instances
  for (const config of dynamicConfigs) {
    const workflow = createDynamicWorkflow(config);
    WorkflowRegistry.register(config.workflow_key, workflow);
  }
  
  // 4. Validate all workflows have bridge endpoint
  await validateWorkflowBridge();
}
```

## Migration Strategy

### Phase-wise Rollout
1. Deploy infrastructure without breaking existing functionality
2. Migrate one workflow at a time to dynamic system
3. Enable rule engine for new workflows first
4. Gradually migrate existing manual triggers
5. Full cutover after validation period

### Backward Compatibility
- Maintain existing API endpoints
- Support both old and new trigger mechanisms
- Gradual deprecation with clear timelines
- Migration tools for existing data

## Success Metrics

### Technical Metrics
- Notification delivery rate > 99.9%
- API response time < 200ms
- Template rendering time < 50ms
- Zero enterprise data leakage

### Business Metrics
- Reduced time to create new notification types
- Increased flexibility for enterprise customization
- Improved notification engagement rates
- Reduced support tickets for notification issues

## Risk Mitigation

### Technical Risks
- **Database Performance**: Implement caching, indexing, and query optimization
- **Template Injection**: Strict validation and sandboxed execution
- **Scale Issues**: Horizontal scaling and queue-based processing
- **Data Isolation**: Row-level security and audit trails

### Operational Risks
- **Migration Failures**: Comprehensive rollback procedures
- **Learning Curve**: Detailed documentation and training
- **Integration Issues**: Extensive testing with staging environments
- **Monitoring Gaps**: Comprehensive logging and alerting

## Timeline Summary

- **Weeks 1-2**: Core Infrastructure
- **Weeks 3-4**: Dynamic Workflow System
- **Weeks 5-6**: Rule Engine & Scheduling
- **Week 7**: Status Management & Cancellation
- **Week 8**: Multi-tenancy & Security
- **Weeks 9-10**: Advanced Features

Total estimated time: 10 weeks for full implementation with a dedicated team.