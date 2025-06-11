# XNovu - Smart Building Notification Platform

A comprehensive notification system built with Next.js and Novu, featuring an advanced rule engine for smart building management platforms. Supports both manual triggers and automated rule-based notifications with cron scheduling and time-based delivery.

## Tech Stack

- **Next.js** - React framework with App Router
- **TypeScript** - Type-safe development
- **Novu** - Open-source notification infrastructure
- **Supabase** - Database and real-time subscriptions
- **BullMQ** - Redis-based queue system for job processing
- **React Email** - Build emails with React components
- **Tailwind CSS** - Utility-first CSS framework
- **pnpm** - Fast, disk space efficient package manager

## ⚡ New: Rule Engine

The rule engine provides automated notification processing with:

- **Cron-based Rules** - Schedule notifications using cron expressions
- **Time-based Scheduling** - Schedule notifications for specific times
- **Enterprise Isolation** - Multi-tenant support with data isolation
- **Queue Management** - Redis-backed job processing with BullMQ
- **Automatic Retries** - Robust error handling and retry mechanisms

## Prerequisites

- Node.js 18+
- pnpm (install with `npm install -g pnpm`)
- Redis server (for BullMQ queue system)
- Novu account and API keys
- Supabase project with notification schema

## Environment Variables

Create a `.env.local` file with:

```env
# Novu Configuration
NOVU_SECRET_KEY=your_novu_secret_key
NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER=your_app_identifier
NEXT_PUBLIC_NOVU_SUBSCRIBER_ID=your_subscriber_id

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Rule Engine Configuration
REDIS_URL=redis://localhost:6379
RULE_ENGINE_ENABLED=true
RULE_ENGINE_TIMEZONE=UTC
RULE_ENGINE_MAX_CONCURRENT_JOBS=10
```

## Installation

```bash
# Install dependencies
pnpm install
```

## Development

```bash
# Start Next.js dev server (port 4000)
pnpm dev

# In another terminal, start Novu dev server
pnpm dlx novu@latest dev
```

Both servers must be running for full functionality.

## Available Scripts

```bash
pnpm dev        # Start development server
pnpm build      # Build for production
pnpm start      # Start production server
pnpm lint       # Run ESLint
pnpm test       # Run tests
pnpm xnovu      # CLI commands for utilities
```

## Features

### Core Notification System
- Email notifications with React Email templates
- In-app notifications with Novu Inbox
- Real-time connection status monitoring
- Type-safe workflow definitions with Zod

### Rule Engine
- **Cron-based Rules** - Automated notifications using cron expressions
- **Scheduled Notifications** - Time-specific notification delivery
- **Enterprise Isolation** - Multi-tenant data separation
- **Queue Management** - BullMQ for reliable job processing
- **Error Handling** - Comprehensive retry and error tracking
- **Real-time Monitoring** - Status tracking and health checks

### Supported Notification Scenarios
- Building maintenance reminders
- Emergency broadcast notifications
- Tenant communication schedules
- Device alert processing
- Access control notifications

## Project Structure

```
app/
├── api/                    # API routes
│   ├── novu/              # Novu bridge endpoint
│   ├── trigger/           # Trigger workflows
│   ├── rule-engine/       # Rule engine management endpoints
│   └── dev-studio-status/ # Connection monitoring
├── services/              # Rule engine services
│   ├── database/          # Supabase database operations
│   ├── queue/             # BullMQ queue management
│   ├── scheduler/         # Cron and scheduled notification managers
│   └── RuleEngineService.ts # Main orchestrator service
├── lib/                   # Utility libraries
│   └── rule-engine-init.ts # Initialization and lifecycle management
├── novu/
│   ├── workflows/         # Notification workflows
│   └── emails/           # Email templates
└── components/           # React components

types/
└── rule-engine.ts         # Type definitions for rule engine

docs/
├── rule-engine-implementation.md # Implementation guide
└── rule-engine-api.md            # API reference

examples/
└── rule-engine-usage.ts  # Usage examples and patterns
```

## API Endpoints

### Core Notification APIs
- `POST /api/novu` - Novu bridge for workflow sync
- `POST /api/trigger` - Trigger welcome email
- `GET /api/dev-studio-status` - Check Novu connection

### Rule Engine Management APIs
- `GET /api/rule-engine/status` - Get rule engine status
- `POST /api/rule-engine/status` - Pause/resume/health-check operations
- `POST /api/rule-engine/reload` - Reload cron rules

## Workflows

Each workflow includes:
- `workflow.ts` - Step definitions and logic
- `schemas.ts` - Zod validation schemas
- `types.ts` - TypeScript type definitions
- `index.ts` - Workflow export

## Rule Engine Usage

### Quick Start

```typescript
import { initializeRuleEngine } from '@/app/lib/rule-engine-init';

// Initialize rule engine (auto-starts with app)
const ruleEngine = await initializeRuleEngine();

// Check status
const status = await ruleEngine.getStatus();
console.log(`Rule engine running with ${status.cronJobs.length} cron jobs`);
```

### Creating Cron Rules

Create rules in your database with the following structure:

```json
{
  "name": "Daily Standup Reminder",
  "trigger_type": "CRON",
  "trigger_config": {
    "cron": "0 9 * * 1-5",
    "timezone": "America/New_York",
    "enabled": true
  },
  "rule_payload": {
    "recipients": ["user-123", "user-456"],
    "payload": {
      "message": "Time for daily standup!"
    }
  }
}
```

### Scheduling Notifications

```json
{
  "name": "Scheduled Maintenance",
  "scheduled_for": "2024-01-15T14:00:00Z",
  "recipients": ["tenant-123", "admin-456"],
  "payload": {
    "message": "Building maintenance scheduled",
    "maintenanceType": "HVAC"
  }
}
```

## Documentation

- [Rule Engine Implementation Guide](docs/rule-engine-implementation.md)
- [Rule Engine API Reference](docs/rule-engine-api.md)
- [Usage Examples](examples/rule-engine-usage.ts)

## Learn More

- [Novu Documentation](https://docs.novu.co/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Email](https://react.email/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Supabase Documentation](https://supabase.com/docs)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.