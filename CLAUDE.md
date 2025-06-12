# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XNovu is an internal notification system for smart building management platforms, built on top of Novu.co. It manages notifications for campus/park environments with hundreds of buildings, thousands of people, and devices.

The system integrates with a larger smart buildings management platform via Supabase realtime subscriptions. When notification rows are inserted into the management database, XNovu subscribes to these changes and triggers predefined workflows.

## Development Guidelines

- Always use pnpm rather than npm for package management
- Always prefer to use rg

## Environment Variables

### Environment Files Relationship
- **`.env.example`** - Contains default/placeholder values. This file is committed to git and serves as a template showing all required environment variables.
- **`.env`** - Contains actual values (secrets, API keys, etc.). This file is gitignored and overrides values from .env.example.

### Loading Order
1. `.env.example` is loaded first (provides defaults)
2. `.env` is loaded second with `override: true` (overrides defaults with actual values)

This pattern ensures:
- All required variables are documented in `.env.example`
- Actual secrets stay in `.env` and are never committed
- Tests and code can rely on `.env.example` always being present

### Important: Supabase Service Role Key Naming
The project uses **`SUPABASE_SERVICE_ROLE_KEY`** in .env (not `SUPABASE_SERVICE_ROLE_KEY`). This is the actual environment variable name used in production and tests.

**DO NOT** change test files to use `SUPABASE_SERVICE_ROLE_KEY` - they should always use `SUPABASE_SERVICE_ROLE_KEY` to match the actual environment configuration.

## Architecture Overview

### System Integration Flow
1. Management platform inserts notifications into their database
2. XNovu uses Supabase SDK to subscribe to realtime changes
3. When a notification row is inserted, XNovu queries the complete notification data
4. XNovu triggers the appropriate workflow with the queried data

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

# Build for production
pnpm build

# Run production server
pnpm start

# Lint code
pnpm lint

# Docker commands with auto-tagging
pnpm xnovu docker:build                    # Build with auto-generated tags
pnpm xnovu docker:build --platform linux/arm64  # Multi-platform build
pnpm xnovu docker:run -d                   # Run in detached mode
pnpm xnovu docker:push --dry-run           # Preview what would be pushed
pnpm xnovu docker:push -r custom-registry  # Push to custom registry
pnpm xnovu docker:stop                     # Stop and remove container
```

## Docker Auto-Tagging System

XNovu uses an intelligent auto-tagging system based on git state:

### Tag Generation
- **Commit SHA**: Always includes short git commit hash (e.g., `6f826ed`)
- **Git Tag**: Includes nearest semantic version tag if available (e.g., `v1.2.3`)
- **Latest**: Always includes `latest` tag
- **Dirty State**: Appends `-dirty` suffix if working tree has uncommitted changes

### Examples
```bash
# Clean working tree with git tag v1.0.0
Local tag: xnovu:6f826ed
Remote tags: 6f826ed, v1.0.0, latest

# Dirty working tree (uncommitted changes)
Local tag: xnovu:6f826ed-dirty
Remote tags: 6f826ed, latest

# Clean working tree without git tags
Local tag: xnovu:6f826ed
Remote tags: 6f826ed, latest
```

### Registry Configuration
- **Default Registry**: `registry.cn-shanghai.aliyuncs.com/yogosystem`
- **Image Name**: `xnovu`
- **Override Registry**: Use `-r` flag with push command

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

### Key Components
- **Supabase Integration** - Real-time subscription to notification insertions
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

## Documentation To Follow

### Novu Workflow Development

For comprehensive Novu workflow development documentation, including workflow patterns, channel steps, triggering, and smart building specific use cases, see [docs/novu-workflow.md](docs/novu-workflow.md).

### Testing

For all testing documentation, see `__tests__/CLAUDE.md`.