# XNovu API Reference - Dynamic Workflow System

## Overview

This document provides comprehensive API reference for the XNovu Dynamic Workflow System, including all endpoints, services, and interfaces.

## Table of Contents

- [REST API Endpoints](#rest-api-endpoints)
- [Database Services API](#database-services-api)
- [Workflow Management API](#workflow-management-api)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Examples](#examples)

## REST API Endpoints

### POST /api/trigger

Triggers a notification workflow with optional enterprise context and payload.

#### Request

```http
POST /api/trigger
Content-Type: application/json

{
  "workflowId": "string (required)",
  "payload": "object (optional)",
  "enterpriseId": "string (optional)",
  "subscriberId": "string (optional)",
  "notificationId": "number (optional)"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | string | Yes | Unique identifier for the workflow |
| `payload` | object | No | Data to pass to the workflow |
| `enterpriseId` | string | No | Enterprise context for dynamic workflows |
| `subscriberId` | string | No | Override default subscriber ID |
| `notificationId` | number | No | Link to database notification record |

#### Response

```json
{
  "message": "Notification triggered successfully",
  "workflowId": "building-alert",
  "enterpriseId": "enterprise-123",
  "notificationId": 456,
  "transactionId": "novu-txn-789",
  "result": {
    // Novu trigger result object
  }
}
```

#### Error Responses

| Status Code | Description | Response |
|-------------|-------------|----------|
| 400 | Missing workflowId | `{"message": "workflowId is required"}` |
| 404 | Workflow not found | `{"message": "Workflow 'xxx' not found", "available": {...}}` |
| 500 | Server error | `{"message": "Error triggering notification", "error": {...}}` |

#### Examples

**Static Workflow Trigger:**
```bash
curl -X POST http://localhost:3000/api/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "user-signup",
    "payload": {
      "userId": "user-123",
      "email": "user@example.com"
    }
  }'
```

**Dynamic Workflow Trigger:**
```bash
curl -X POST http://localhost:3000/api/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "building-alert",
    "enterpriseId": "enterprise-123",
    "notificationId": 456,
    "payload": {
      "buildingId": "building-789",
      "message": "HVAC failure detected",
      "priority": "high"
    }
  }'
```

### GET/POST /api/novu

Novu framework bridge endpoint that serves workflow definitions to Novu cloud/self-hosted instances.

#### Features

- Automatically discovers and serves all registered workflows
- Caches workflow handlers for optimal performance
- Supports both static and dynamic workflows
- Enterprise-aware workflow loading

#### Request

```http
GET /api/novu
POST /api/novu
OPTIONS /api/novu
```

#### Response

Returns Novu framework responses for workflow discovery and execution.

### GET /api/dev-studio-status

Checks Novu connection status for development.

## Database Services API

### NotificationService

#### Methods

##### `getNotification(id: number, enterpriseId: string): Promise<NotificationRow | null>`

Retrieves a single notification with related data.

```typescript
const notification = await notificationService.getNotification(123, 'enterprise-id');
```

##### `createNotification(notification: NotificationInsert): Promise<NotificationRow>`

Creates a new notification record.

```typescript
const notification = await notificationService.createNotification({
  name: 'Building Alert',
  payload: { buildingId: 'building-123' },
  recipients: ['user-456'],
  notification_workflow_id: 1,
  enterprise_id: 'enterprise-789'
});
```

##### `updateNotificationStatus(id: number, status: NotificationStatus, enterpriseId: string, errorMessage?: string, transactionId?: string): Promise<void>`

Updates notification status with optional error details and transaction ID.

```typescript
await notificationService.updateNotificationStatus(
  123,
  'PROCESSING',
  'enterprise-id',
  undefined,
  'novu-txn-456'
);
```

##### `getNotificationsByStatus(status: NotificationStatus, enterpriseId: string, limit?: number): Promise<NotificationRow[]>`

Retrieves notifications by status with optional limit.

```typescript
const pending = await notificationService.getNotificationsByStatus(
  'PENDING',
  'enterprise-id',
  100
);
```

##### `cancelNotification(id: number, enterpriseId: string): Promise<void>`

Cancels a notification by setting status to RETRACTED.

```typescript
await notificationService.cancelNotification(123, 'enterprise-id');
```

##### `getNotificationsByWorkflow(workflowId: number, enterpriseId: string, limit?: number): Promise<NotificationRow[]>`

Retrieves notifications for a specific workflow.

```typescript
const notifications = await notificationService.getNotificationsByWorkflow(
  1,
  'enterprise-id',
  50
);
```

### WorkflowService

#### Methods

##### `getWorkflow(id: number, enterpriseId: string): Promise<WorkflowRow | null>`

Retrieves a single workflow by ID.

```typescript
const workflow = await workflowService.getWorkflow(1, 'enterprise-id');
```

##### `getWorkflowByKey(workflowKey: string, enterpriseId: string): Promise<WorkflowRow | null>`

Retrieves a workflow by its unique key.

```typescript
const workflow = await workflowService.getWorkflowByKey(
  'building-alert',
  'enterprise-id'
);
```

##### `getAllWorkflows(enterpriseId: string): Promise<WorkflowRow[]>`

Retrieves all active workflows for an enterprise.

```typescript
const workflows = await workflowService.getAllWorkflows('enterprise-id');
```

##### `getPublishedWorkflows(enterpriseId: string): Promise<WorkflowRow[]>`

Retrieves only published workflows.

```typescript
const published = await workflowService.getPublishedWorkflows('enterprise-id');
```

##### `getDynamicWorkflows(enterpriseId: string): Promise<WorkflowRow[]>`

Retrieves only dynamic workflows.

```typescript
const dynamic = await workflowService.getDynamicWorkflows('enterprise-id');
```

##### `getStaticWorkflows(enterpriseId: string): Promise<WorkflowRow[]>`

Retrieves only static workflows.

```typescript
const static = await workflowService.getStaticWorkflows('enterprise-id');
```

##### `createWorkflow(workflow: WorkflowInsert): Promise<WorkflowRow>`

Creates a new workflow.

```typescript
const workflow = await workflowService.createWorkflow({
  name: 'Building Alert',
  workflow_key: 'building-alert',
  workflow_type: 'DYNAMIC',
  default_channels: ['EMAIL', 'IN_APP'],
  enterprise_id: 'enterprise-123'
});
```

##### `updateWorkflow(id: number, updates: WorkflowUpdate, enterpriseId: string): Promise<WorkflowRow>`

Updates an existing workflow.

```typescript
const updated = await workflowService.updateWorkflow(
  1,
  {
    template_overrides: {
      emailTemplateId: 999
    }
  },
  'enterprise-id'
);
```

##### `publishWorkflow(id: number, enterpriseId: string): Promise<WorkflowRow>`

Publishes a workflow.

```typescript
const published = await workflowService.publishWorkflow(1, 'enterprise-id');
```

##### `unpublishWorkflow(id: number, enterpriseId: string): Promise<WorkflowRow>`

Unpublishes a workflow.

```typescript
const unpublished = await workflowService.unpublishWorkflow(1, 'enterprise-id');
```

##### `deactivateWorkflow(id: number, enterpriseId: string): Promise<WorkflowRow>`

Deactivates a workflow.

```typescript
const deactivated = await workflowService.deactivateWorkflow(1, 'enterprise-id');
```

##### `parseWorkflowConfig(workflow: WorkflowRow): Promise<WorkflowConfig>`

Parses database workflow row into configuration object.

```typescript
const config = await workflowService.parseWorkflowConfig(workflowRow);
```

## Workflow Management API

### WorkflowRegistry

#### Methods

##### `registerStaticWorkflow(workflowKey: string, workflowInstance: any): void`

Registers a static workflow instance.

```typescript
workflowRegistry.registerStaticWorkflow('user-signup', userSignupWorkflow);
```

##### `registerDynamicWorkflow(workflowKey: string, config: WorkflowConfig, enterpriseId: string): void`

Registers a dynamic workflow for an enterprise.

```typescript
workflowRegistry.registerDynamicWorkflow(
  'building-alert',
  config,
  'enterprise-123'
);
```

##### `loadEnterpriseWorkflows(enterpriseId: string): Promise<void>`

Loads all dynamic workflows for an enterprise.

```typescript
await workflowRegistry.loadEnterpriseWorkflows('enterprise-123');
```

##### `getWorkflow(workflowKey: string, enterpriseId?: string): RegisteredWorkflow | null`

Retrieves a workflow instance.

```typescript
const workflow = workflowRegistry.getWorkflow('building-alert', 'enterprise-123');
```

##### `getEnterpriseWorkflows(enterpriseId: string): RegisteredWorkflow[]`

Gets all workflows for an enterprise.

```typescript
const workflows = workflowRegistry.getEnterpriseWorkflows('enterprise-123');
```

##### `reloadEnterpriseWorkflows(enterpriseId: string): Promise<void>`

Reloads dynamic workflows for an enterprise.

```typescript
await workflowRegistry.reloadEnterpriseWorkflows('enterprise-123');
```

##### `unregisterWorkflow(workflowKey: string, enterpriseId?: string): boolean`

Unregisters a workflow.

```typescript
const removed = workflowRegistry.unregisterWorkflow('building-alert', 'enterprise-123');
```

##### `hasWorkflow(workflowKey: string, enterpriseId?: string): boolean`

Checks if a workflow is registered.

```typescript
const exists = workflowRegistry.hasWorkflow('building-alert', 'enterprise-123');
```

##### `getStats(): object`

Gets registry statistics.

```typescript
const stats = workflowRegistry.getStats();
// Returns: { total: number, static: number, dynamic: number, enterprises: number }
```

### DynamicWorkflowFactory

#### Static Methods

##### `createDynamicWorkflow(config: WorkflowConfig, enterpriseId: string): any`

Creates a Novu workflow instance from configuration.

```typescript
const workflow = DynamicWorkflowFactory.createDynamicWorkflow(config, 'enterprise-123');
```

##### `validateWorkflowConfig(config: WorkflowConfig): boolean`

Validates workflow configuration.

```typescript
const isValid = DynamicWorkflowFactory.validateWorkflowConfig(config);
```

##### `createDefaultPayloadSchema(): ZodSchema`

Creates default payload schema for workflows.

```typescript
const schema = DynamicWorkflowFactory.createDefaultPayloadSchema();
```

### WorkflowDiscovery

#### Static Methods

##### `discoverStaticWorkflows(): Promise<Map<string, any>>`

Discovers static workflows from filesystem.

```typescript
const workflows = await WorkflowDiscovery.discoverStaticWorkflows();
```

##### `validateWorkflowDirectory(workflowDir: string): Promise<ValidationResult>`

Validates a workflow directory structure.

```typescript
const validation = await WorkflowDiscovery.validateWorkflowDirectory('/path');
```

##### `getAllWorkflowsStatus(): Promise<WorkflowStatus[]>`

Gets status of all discovered workflows.

```typescript
const statuses = await WorkflowDiscovery.getAllWorkflowsStatus();
```

## Type Definitions

### Core Types

```typescript
// Notification status enum
type NotificationStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRACTED';

// Workflow type enum
type WorkflowType = 'STATIC' | 'DYNAMIC';

// Channel type enum
type ChannelType = 'EMAIL' | 'IN_APP' | 'SMS' | 'CHAT' | 'PUSH';

// Publish status enum
type PublishStatus = 'NONE' | 'DRAFT' | 'DISCARD' | 'PUBLISH' | 'DELETED' | 'REVIEW';
```

### Interface Types

```typescript
interface WorkflowConfig {
  workflow_key: string;
  workflow_type: WorkflowType;
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

interface RegisteredWorkflow {
  id: string;
  type: 'STATIC' | 'DYNAMIC';
  instance: any;
  config?: WorkflowConfig;
  enterpriseId?: string;
}

interface DiscoveredWorkflow {
  workflowKey: string;
  filePath: string;
  directory: string;
  exports: any;
}
```

### Database Types

```typescript
// Auto-generated from Supabase schema
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];
type NotificationUpdate = Database['notify']['Tables']['ent_notification']['Update'];

type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type WorkflowUpdate = Database['notify']['Tables']['ent_notification_workflow']['Update'];
```

## Error Handling

### Error Types

```typescript
interface ApiError {
  message: string;
  error?: {
    message: string;
    type: string;
    constructor: string;
    stack?: string;
    raw?: any;
  };
}
```

### Common Error Scenarios

#### Workflow Not Found

```json
{
  "message": "Workflow 'unknown-workflow' not found for enterprise 'enterprise-123'",
  "available": {
    "total": 5,
    "static": 2,
    "dynamic": 3
  }
}
```

#### Invalid Configuration

```json
{
  "message": "Invalid workflow configuration",
  "details": "Missing emailTemplateId for EMAIL channel"
}
```

#### Database Errors

```json
{
  "message": "Failed to update notification status",
  "error": {
    "message": "Foreign key constraint violation",
    "type": "DatabaseError"
  }
}
```

### Error Handling Best Practices

1. **Always check return values** from service methods
2. **Use try-catch blocks** for async operations
3. **Validate inputs** before calling services
4. **Log errors** with appropriate detail level
5. **Provide meaningful error messages** to users

## Examples

### Complete Workflow Creation Example

```typescript
// 1. Create workflow configuration
const workflowData = {
  name: 'Building Emergency Alert',
  workflow_key: 'building-emergency',
  workflow_type: 'DYNAMIC' as const,
  default_channels: ['EMAIL', 'IN_APP', 'SMS'],
  template_overrides: {
    emailTemplateId: 101,
    inAppTemplateId: 102,
    smsTemplateId: 103
  },
  payload_schema: {
    buildingId: { type: 'string', required: true },
    message: { type: 'string', required: true },
    priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
  },
  enterprise_id: 'enterprise-123',
  publish_status: 'PUBLISH' as const
};

// 2. Create in database
const workflow = await workflowService.createWorkflow(workflowData);

// 3. Load into registry
await workflowRegistry.loadEnterpriseWorkflows('enterprise-123');

// 4. Trigger workflow
const response = await fetch('/api/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workflowId: 'building-emergency',
    enterpriseId: 'enterprise-123',
    payload: {
      buildingId: 'building-456',
      message: 'Fire alarm activated on floor 3',
      priority: 'critical'
    }
  })
});
```

### Monitoring Workflow Execution

```typescript
// Monitor notification status
async function monitorNotification(notificationId: number, enterpriseId: string) {
  let status = 'PENDING';
  
  while (['PENDING', 'PROCESSING'].includes(status)) {
    const notification = await notificationService.getNotification(
      notificationId,
      enterpriseId
    );
    
    if (!notification) {
      throw new Error('Notification not found');
    }
    
    status = notification.notification_status;
    console.log(`Notification ${notificationId} status: ${status}`);
    
    if (status === 'FAILED') {
      console.error('Error details:', notification.error_details);
      break;
    }
    
    if (status === 'SENT') {
      console.log('Notification sent successfully');
      break;
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return status;
}
```

### Bulk Workflow Operations

```typescript
// Load multiple enterprise workflows
async function loadMultipleEnterprises(enterpriseIds: string[]) {
  const results = await Promise.allSettled(
    enterpriseIds.map(id => workflowRegistry.loadEnterpriseWorkflows(id))
  );
  
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Failed to load workflows for ${enterpriseIds[index]}:`, result.reason);
    } else {
      console.log(`Loaded workflows for ${enterpriseIds[index]}`);
    }
  });
}

// Get enterprise statistics
async function getEnterpriseStats(enterpriseId: string) {
  const [workflows, notifications] = await Promise.all([
    workflowService.getAllWorkflows(enterpriseId),
    notificationService.getNotificationsByStatus('SENT', enterpriseId, 1000)
  ]);
  
  return {
    totalWorkflows: workflows.length,
    dynamicWorkflows: workflows.filter(w => w.workflow_type === 'DYNAMIC').length,
    staticWorkflows: workflows.filter(w => w.workflow_type === 'STATIC').length,
    sentNotifications: notifications.length
  };
}
```

## Performance Considerations

### Caching Strategies

- **Workflow Registry**: Instances cached until explicit reload
- **Template Renderer**: Templates cached with TTL (5 minutes default)
- **Novu Handlers**: Handler instances cached per request lifecycle

### Database Optimization

- Use indexes on `enterprise_id` for all enterprise-scoped queries
- Limit result sets with appropriate LIMIT clauses
- Use selective field queries instead of SELECT *

### Memory Management

- Clean up expired cache entries periodically
- Avoid loading all workflows if only specific ones needed
- Use lazy loading for dynamic workflow instances

## Security Best Practices

1. **Enterprise Isolation**: Always validate enterprise context
2. **Input Validation**: Validate all inputs before database operations
3. **Access Control**: Implement proper authentication and authorization
4. **Audit Logging**: Log all workflow operations for compliance
5. **Rate Limiting**: Implement rate limiting on trigger endpoints

This API reference provides comprehensive coverage of all dynamic workflow system functionality.