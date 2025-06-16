# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XNovu is an internal notification system for smart building management platforms, built on top of Novu.co. It manages notifications for campus/park environments with hundreds of buildings, thousands of people, and devices.

The system integrates with a larger smart buildings management platform using an outbox pattern with Temporal workflows. XNovu polls the notification table for new entries based on the updated_at timestamp and triggers predefined workflows.

## Development Guidelines

- Always use pnpm rather than npm for package management
- Always prefer to use rg

## Architecture Overview

### System Integration Flow
1. Management platform inserts notifications into their database
2. XNovu uses Temporal workflows to poll the notification table at regular intervals
3. When new or updated notifications are found (based on updated_at timestamp), XNovu retrieves the complete data
4. XNovu triggers the appropriate workflow with the retrieved data

### Workflow Types
1. **Static Workflows** - Critical system workflows (e.g., user-signup) that are hardcoded and not user-configurable
2. **Dynamic Workflows** - User-configurable workflows where templates and payloads can be customized by the management platform

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server (port 4000)
pnpm dev

# Start Novu studio for local development
npx novu@latest dev

# For self-hosted Novu setup
# npx novu@latest dev -d https://novu-dash.yogo.cloud

# Generate TypeScript types from Supabase
pnpm xnovu generate-types

# Sync workflows to Novu Cloud and database
pnpm xnovu sync

# Build for production
pnpm build

# Run production server
pnpm start

# Lint code
pnpm lint

# Docker deployment
# See docs/deployment.md for Docker commands and deployment strategies

## Project Structure

### API Routes (`app/api/`)
- `/api/novu` - Novu bridge endpoint serving workflows to Novu cloud/self-hosted
- `/api/trigger` - Unified trigger endpoint accepting workflowId and payload
- `/api/dev-studio-status` - Checks Novu connection status

### Workflow Organization (`app/novu/workflows/`)
Each workflow module follows this structure:
- `index.ts` - Workflow exports
- `workflow.ts` - Step definitions and logic
- `schemas.ts` - Zod validation schemas
- `types.ts` - TypeScript type definitions
- `metadata.ts` - Database metadata for workflow sync

### Key Components
- **Temporal Polling Workflows** - Reliable notification processing using outbox pattern
- **Novu Bridge** - Serves workflows to Novu instance
- **In-App Notifications** - Uses Novu's Inbox component (`app/components/NotificationToast/`)

## Database Types and Integration

### Auto-Generated Types
XNovu uses auto-generated TypeScript types from the Supabase database schema:

```bash
# Generate latest types from remote Supabase project
pnpm xnovu generate-types
```

This creates `lib/supabase/database.types.ts` with comprehensive type definitions for all database schemas:
- `notify` - Notification system tables
- `shared_types` - Common enums and shared types

### Type Usage Patterns

```tsx
import type { Database } from '@/lib/supabase/database.types'

// Extract specific table types
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row']
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert']
type NotificationUpdate = Database['notify']['Tables']['ent_notification']['Update']

// Extract enum types
type NotificationStatus = Database['shared_types']['Enums']['notification_status']
type ChannelType = Database['shared_types']['Enums']['notification_channel_type']
type WorkflowType = Database['shared_types']['Enums']['notification_workflow_type']
```

### Notification System Tables

#### Core Tables
- **`ent_notification`** - Individual notification instances with payload, recipients, and status
- **`ent_notification_workflow`** - Workflow definitions (static vs dynamic)
- **`ent_notification_template`** - Channel-specific templates for dynamic workflows
- **`ent_notification_rule`** - Trigger rules that create notifications
- **`typ_notification_category`** - Categorization (maintenance, security, etc.)
- **`typ_notification_priority`** - Priority levels (low, medium, high, critical)

#### Type-Safe Database Operations
```tsx
// Type-safe notification insert
const { data, error } = await supabase
  .schema('notify')
  .from('ent_notification')
  .insert({
    name: 'Building Alert',
    payload: { buildingId: 'building-123', message: 'HVAC failure detected' },
    recipients: ['user-456'],
    notification_workflow_id: 1,
    enterprise_id: 'ent-789'
  } satisfies Database['notify']['Tables']['ent_notification']['Insert'])

// Type-safe notification query with relationships
const { data: notification } = await supabase
  .schema('notify')
  .from('ent_notification')
  .select(`
    *,
    ent_notification_workflow!inner(*),
    typ_notification_category(*),
    typ_notification_priority(*)
  `)
  .eq('id', notificationId)
  .single()
```

#### Handling Json Types
The generated types use `Json` type for flexible payload fields. Cast to `any` when interfacing with external APIs:

```tsx
// Safe casting for Novu API integration
const result = await novu.trigger(workflow.workflow_key, {
  to: recipients.map(id => ({ subscriberId: id })),
  payload: notification.payload as any, // Cast Json to any for Novu
  overrides: notification.overrides as any || {}
})
```

## Workflow Synchronization

XNovu uses a metadata-based approach for syncing workflows to both Novu Cloud and the database.

### Workflow Metadata

Each workflow has a `metadata.ts` file that defines:
- `workflow_key` - Unique identifier matching the Novu workflow ID
- `name` - Human-readable workflow name
- `description` - What the workflow does
- `workflow_type` - "STATIC" for system workflows, "DYNAMIC" for user-configurable
- `default_channels` - Array of channels used (EMAIL, IN_APP, SMS, PUSH, CHAT)
- `payload_schema` - JSON Schema generated from Zod schema for payload validation
- `control_schema` - JSON Schema generated from Zod schema for workflow controls
- `template_overrides` - Channel-specific template overrides
- Additional fields for categorization and multi-tenancy

### Syncing Workflows

```bash
# Sync all workflows to Novu Cloud and database
pnpm xnovu sync

# This command:
# 1. Syncs workflows to Novu Cloud using the bridge URL
# 2. Reads metadata from each workflow's metadata.ts
# 3. Creates/updates records in ent_notification_workflow table
```

### Creating New Workflows

1. Create workflow directory under `app/novu/workflows/`
2. Add standard files: `index.ts`, `workflow.ts`, `schemas.ts`, `types.ts`
3. Generate workflow files: `pnpm xnovu workflow generate`
4. Review and complete the generated metadata.ts file
5. Run sync to deploy: `pnpm xnovu sync`

Note: The workflow index is automatically regenerated during `pnpm build`

## Documentation To Follow

### Novu Workflow Development

For comprehensive Novu workflow development documentation, including workflow patterns, channel steps, triggering, and smart building specific use cases, see [docs/novu-workflow.md](docs/novu-workflow.md).

### Deployment

For Docker containerization, deployment strategies, and production configuration, see [docs/deployment.md](docs/deployment.md).

### Testing

For all testing documentation, see `__tests__/CLAUDE.md`.