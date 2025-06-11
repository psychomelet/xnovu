# Dynamic Workflow System Documentation

## Overview

The XNovu Dynamic Workflow System provides a comprehensive database-driven notification workflow management system that supports both static (system-critical) and dynamic (user-configurable) workflows with enterprise isolation and multi-channel template support.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Database Services](#database-services)
- [Workflow Management](#workflow-management)
- [API Integration](#api-integration)
- [Template Integration](#template-integration)
- [Enterprise Isolation](#enterprise-isolation)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

The dynamic workflow system is built on several key components:

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   API Endpoints     │    │  Workflow Registry   │    │  Database Services  │
│                     │    │                      │    │                     │
│ • /api/novu         │◄──►│ • Static Workflows   │◄──►│ • NotificationService│
│ • /api/trigger      │    │ • Dynamic Workflows  │    │ • WorkflowService   │
└─────────────────────┘    │ • Enterprise Isolation│    └─────────────────────┘
                           └──────────────────────┘
                                      │
                           ┌──────────▼──────────┐
                           │ Dynamic Workflow    │
                           │ Factory             │
                           │                     │
                           │ • Template Loading  │
                           │ • Channel Support   │
                           │ • Status Tracking   │
                           └─────────────────────┘
```

### Core Principles

1. **Enterprise Isolation**: All operations are scoped by `enterprise_id`
2. **Workflow Types**: Static (hardcoded) and Dynamic (database-configured)
3. **Template Integration**: Full integration with Phase 1 template system
4. **Status Tracking**: Complete notification lifecycle management
5. **Multi-Channel Support**: EMAIL, IN_APP, SMS, PUSH notifications

## Database Services

### NotificationService

Handles all notification-related database operations with enterprise scoping.

```typescript
import { notificationService } from '@/app/services/database';

// Get a notification
const notification = await notificationService.getNotification(123, 'enterprise-id');

// Update notification status
await notificationService.updateNotificationStatus(
  123, 
  'PROCESSING', 
  'enterprise-id',
  undefined, // error message
  'transaction-id'
);

// Get notifications by status
const pendingNotifications = await notificationService.getNotificationsByStatus(
  'PENDING',
  'enterprise-id',
  100 // limit
);
```

#### Available Methods

- `getNotification(id, enterpriseId)` - Get single notification with relationships
- `createNotification(notification)` - Create new notification
- `updateNotificationStatus(id, status, enterpriseId, errorMessage?, transactionId?)` - Update status
- `getNotificationsByStatus(status, enterpriseId, limit?)` - Get notifications by status
- `cancelNotification(id, enterpriseId)` - Cancel notification (set to RETRACTED)
- `getNotificationsByWorkflow(workflowId, enterpriseId, limit?)` - Get by workflow

#### Notification Statuses

- `PENDING` - Initial state, queued for processing
- `PROCESSING` - Currently being processed by workflow
- `SENT` - Successfully delivered
- `FAILED` - Processing failed with error
- `RETRACTED` - Cancelled/withdrawn

### WorkflowService

Manages workflow configurations and metadata.

```typescript
import { workflowService } from '@/app/services/database';

// Get published workflows for enterprise
const workflows = await workflowService.getPublishedWorkflows('enterprise-id');

// Get dynamic workflows only
const dynamicWorkflows = await workflowService.getDynamicWorkflows('enterprise-id');

// Parse workflow configuration
const config = await workflowService.parseWorkflowConfig(workflowRow);
```

#### Available Methods

- `getWorkflow(id, enterpriseId)` - Get single workflow
- `getWorkflowByKey(workflowKey, enterpriseId)` - Get by workflow key
- `getAllWorkflows(enterpriseId)` - Get all active workflows
- `getPublishedWorkflows(enterpriseId)` - Get published workflows only
- `getDynamicWorkflows(enterpriseId)` - Get dynamic workflows only
- `getStaticWorkflows(enterpriseId)` - Get static workflows only
- `createWorkflow(workflow)` - Create new workflow
- `updateWorkflow(id, updates, enterpriseId)` - Update workflow
- `publishWorkflow(id, enterpriseId)` - Publish workflow
- `unpublishWorkflow(id, enterpriseId)` - Unpublish workflow
- `deactivateWorkflow(id, enterpriseId)` - Deactivate workflow
- `parseWorkflowConfig(workflow)` - Parse database row to config object

#### Workflow Configuration

Workflows are configured using these database fields:

- `workflow_key` - Unique identifier for the workflow
- `workflow_type` - 'STATIC' or 'DYNAMIC'
- `default_channels` - Array of enabled channels
- `template_overrides` - Template IDs for each channel
- `payload_schema` - JSON schema for payload validation
- `publish_status` - 'DRAFT', 'PUBLISH', etc.

## Workflow Management

### WorkflowRegistry

Central registry for all workflow instances with enterprise isolation.

```typescript
import { workflowRegistry } from '@/app/services/workflow';

// Register a static workflow
workflowRegistry.registerStaticWorkflow('user-signup', userSignupWorkflow);

// Load enterprise workflows
await workflowRegistry.loadEnterpriseWorkflows('enterprise-id');

// Get workflow
const workflow = workflowRegistry.getWorkflow('workflow-key', 'enterprise-id');

// Get all workflows for enterprise
const enterpriseWorkflows = workflowRegistry.getEnterpriseWorkflows('enterprise-id');
```

#### Registry Methods

- `registerStaticWorkflow(workflowKey, instance)` - Register static workflow
- `registerDynamicWorkflow(workflowKey, config, enterpriseId)` - Register dynamic workflow
- `loadEnterpriseWorkflows(enterpriseId)` - Load all dynamic workflows for enterprise
- `getWorkflow(workflowKey, enterpriseId?)` - Get workflow instance
- `getEnterpriseWorkflows(enterpriseId)` - Get all workflows for enterprise
- `reloadEnterpriseWorkflows(enterpriseId)` - Reload dynamic workflows
- `unregisterWorkflow(workflowKey, enterpriseId?)` - Remove workflow
- `hasWorkflow(workflowKey, enterpriseId?)` - Check if workflow exists

### DynamicWorkflowFactory

Creates Novu workflow instances from database configuration.

```typescript
import { DynamicWorkflowFactory } from '@/app/services/workflow';

// Create dynamic workflow
const workflowInstance = DynamicWorkflowFactory.createDynamicWorkflow(
  config,
  'enterprise-id'
);

// Validate configuration
const isValid = DynamicWorkflowFactory.validateWorkflowConfig(config);
```

#### Workflow Configuration Interface

```typescript
interface WorkflowConfig {
  workflow_key: string;
  workflow_type: 'STATIC' | 'DYNAMIC';
  channels: string[];
  emailTemplateId?: number;
  inAppTemplateId?: number;
  smsTemplateId?: number;
  pushTemplateId?: number;
  payloadSchema?: any;
  tags?: string[];
  name?: string;
  description?: string;
}
```

#### Channel Support

The factory supports all Novu notification channels:

- **EMAIL** - Requires `emailTemplateId`
- **IN_APP** - Requires `inAppTemplateId`
- **SMS** - Requires `smsTemplateId`
- **PUSH** - Requires `pushTemplateId`

### WorkflowDiscovery

Auto-discovers static workflows from the filesystem.

```typescript
import { WorkflowDiscovery } from '@/app/services/workflow';

// Discover all static workflows
const workflows = await WorkflowDiscovery.discoverStaticWorkflows();

// Get workflow status
const statuses = await WorkflowDiscovery.getAllWorkflowsStatus();

// Validate workflow directory
const validation = await WorkflowDiscovery.validateWorkflowDirectory('/path/to/workflow');
```

#### Discovery Rules

1. Scans `app/novu/workflows/` directory
2. Each subdirectory represents a workflow
3. Must contain `index.ts` file
4. Workflow key derived from directory name (converted to kebab-case)
5. Ignores directories starting with `.` or `_`

## API Integration

### Enhanced Novu Bridge (`/api/novu`)

The Novu bridge endpoint now dynamically loads workflows from the registry.

```typescript
// Automatically serves all registered workflows to Novu
// - Static workflows are always included
// - Dynamic workflows loaded on-demand per enterprise
```

#### Features

- **Dynamic Loading** - Workflows loaded from registry at runtime
- **Caching** - Handler instances cached for performance
- **Error Handling** - Comprehensive error logging and recovery

### Enhanced Trigger Endpoint (`/api/trigger`)

Supports both static and dynamic workflows with enterprise context.

```typescript
// Trigger static workflow
POST /api/trigger
{
  "workflowId": "user-signup",
  "payload": { "userId": "123" }
}

// Trigger dynamic workflow
POST /api/trigger
{
  "workflowId": "building-alert",
  "enterpriseId": "enterprise-123",
  "notificationId": 456,
  "payload": { "buildingId": "building-789", "message": "HVAC failure" }
}
```

#### Request Parameters

- `workflowId` (required) - Workflow identifier
- `payload` (optional) - Workflow payload data
- `enterpriseId` (optional) - Enterprise context for dynamic workflows
- `subscriberId` (optional) - Override default subscriber
- `notificationId` (optional) - Link to database notification record

#### Response

```json
{
  "message": "Notification triggered successfully",
  "workflowId": "building-alert",
  "enterpriseId": "enterprise-123",
  "notificationId": 456,
  "transactionId": "novu-transaction-id",
  "result": { /* Novu trigger result */ }
}
```

## Template Integration

The dynamic workflow system integrates seamlessly with the Phase 1 template rendering system.

### Template Rendering in Workflows

```typescript
// Dynamic workflows automatically render templates
// Templates are loaded by ID from database with enterprise scoping
const templateRenderer = getTemplateRenderer();
const renderedContent = await templateRenderer.renderTemplate(
  templateId,
  enterpriseId,
  variables
);

// Returns: { subject?: string, body: string }
```

### Channel-Specific Template Handling

- **EMAIL** - Uses both `subject` and `body` from template
- **IN_APP** - Uses `subject` (optional) and `body`
- **SMS** - Uses only `body`
- **PUSH** - Uses `subject` as title and `body`

### Template Configuration

Templates are associated with workflows via the `template_overrides` field:

```json
{
  "emailTemplateId": 123,
  "inAppTemplateId": 124,
  "smsTemplateId": 125,
  "pushTemplateId": 126
}
```

## Enterprise Isolation

All components enforce strict enterprise isolation:

### Database Level

- All queries automatically include `enterprise_id` filter
- Row-level security through consistent scoping
- No cross-enterprise data access possible

### Workflow Level

- Dynamic workflows registered per enterprise
- Workflow keys can be reused across enterprises
- Static workflows shared across all enterprises

### Template Level

- Templates scoped by `enterprise_id`
- No cross-enterprise template access
- Template rendering respects enterprise context

## Usage Examples

### Creating a Dynamic Workflow

1. **Create Workflow Configuration**

```sql
INSERT INTO notify.ent_notification_workflow (
  name,
  workflow_key,
  workflow_type,
  default_channels,
  template_overrides,
  enterprise_id,
  publish_status
) VALUES (
  'Building Alert',
  'building-alert',
  'DYNAMIC',
  ARRAY['EMAIL', 'IN_APP'],
  '{"emailTemplateId": 123, "inAppTemplateId": 124}',
  'enterprise-123',
  'PUBLISH'
);
```

2. **Load into Registry**

```typescript
await workflowRegistry.loadEnterpriseWorkflows('enterprise-123');
```

3. **Trigger Workflow**

```typescript
const response = await fetch('/api/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workflowId: 'building-alert',
    enterpriseId: 'enterprise-123',
    payload: {
      buildingId: 'building-789',
      message: 'HVAC system failure detected',
      priority: 'high'
    }
  })
});
```

### Monitoring Workflow Status

```typescript
// Get all processing notifications
const processingNotifications = await notificationService.getNotificationsByStatus(
  'PROCESSING',
  'enterprise-123'
);

// Check specific notification
const notification = await notificationService.getNotification(456, 'enterprise-123');
console.log('Status:', notification?.notification_status);
console.log('Transaction ID:', notification?.transaction_id);
```

### Managing Enterprise Workflows

```typescript
// Get all workflows for enterprise
const workflows = await workflowService.getPublishedWorkflows('enterprise-123');

// Update workflow configuration
await workflowService.updateWorkflow(
  workflowId,
  {
    template_overrides: {
      emailTemplateId: 999,
      inAppTemplateId: 1000
    }
  },
  'enterprise-123'
);

// Reload workflows to pick up changes
await workflowRegistry.reloadEnterpriseWorkflows('enterprise-123');
```

## Error Handling

The system includes comprehensive error handling:

### Workflow Level

- Missing templates fallback to default content
- Invalid configurations logged but don't break system
- Status tracking includes error details

### API Level

- Validation of required parameters
- Enterprise authorization checks
- Graceful degradation for missing workflows

### Database Level

- Transaction safety for status updates
- Constraint validation on inserts
- Proper error propagation

## Performance Considerations

### Caching

- **Workflow Registry** - Instances cached until reload
- **Template Renderer** - Templates cached with TTL
- **Novu Handlers** - Handler instances cached per request

### Database Optimization

- Indexes on `enterprise_id` for all queries
- Composite indexes for common query patterns
- Minimal data transfer with selective queries

### Memory Management

- Lazy loading of dynamic workflows
- Periodic cache cleanup for templates
- Efficient workflow instance reuse

## Troubleshooting

### Common Issues

1. **Workflow Not Found**
   - Check if workflow is published (`publish_status = 'PUBLISH'`)
   - Verify enterprise ID is correct
   - Ensure workflow registry is loaded

2. **Template Rendering Fails**
   - Verify template exists and is published
   - Check enterprise scoping of templates
   - Validate template syntax

3. **Status Not Updating**
   - Check notification ID is valid number
   - Verify enterprise context matches
   - Check database constraints

### Debug Commands

```typescript
// Check workflow registry status
const stats = workflowRegistry.getStats();
console.log('Registry stats:', stats);

// Validate workflow directory
const validation = await WorkflowDiscovery.validateWorkflowDirectory('/path');
console.log('Validation:', validation);

// Check template cache
const templateRenderer = getTemplateRenderer();
const cacheStats = templateRenderer.getCacheStats();
console.log('Template cache:', cacheStats);
```

### Logging

The system provides detailed logging for debugging:

- Workflow registration events
- Template rendering operations
- Status update transactions
- Error conditions with stack traces

## Migration Guide

### From Static to Dynamic

1. Create workflow configuration in database
2. Map existing template IDs to configuration
3. Register dynamic workflow
4. Test with enterprise context
5. Migrate triggers to include enterprise ID

### Database Schema Updates

Ensure your database includes:

- `ent_notification_workflow` table with proper fields
- `ent_notification_template` table for templates  
- `ent_notification` table for tracking
- Proper foreign key relationships

## Security Considerations

- **Enterprise Isolation** - Strict scoping prevents data leakage
- **Input Validation** - All inputs validated before processing
- **Template Safety** - Safe template variable interpolation
- **Database Security** - Parameterized queries prevent injection

## Next Steps

This Dynamic Workflow implementation provides the foundation for:

- **Phase 3** - Rule Engine & Scheduling System
- **Phase 4** - Status Management & Cancellation
- **Phase 5** - Multi-tenancy & Security Enhancements
- **Phase 6** - Advanced Features & Analytics

The dynamic workflow system is now ready for production use with comprehensive enterprise support and multi-channel template integration.