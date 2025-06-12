# XNovu - Smart Building Notification Platform

A comprehensive notification system built with Next.js and Novu, featuring Temporal workflows for reliable and scalable notification processing in smart building management platforms.

## Tech Stack

- **Next.js** - React framework with App Router
- **TypeScript** - Type-safe development
- **Novu** - Open-source notification infrastructure
- **Supabase** - Database and real-time subscriptions
- **Temporal** - Durable workflow execution platform
- **React Email** - Build emails with React components
- **Tailwind CSS** - Utility-first CSS framework
- **pnpm** - Fast, disk space efficient package manager

## ⚡ Temporal-Powered Architecture

The system uses Temporal workflows for:

- **Durable Execution** - Workflows survive failures and restarts
- **Automatic Retries** - Built-in retry policies with exponential backoff
- **Scalable Processing** - Horizontal scaling with worker pools
- **Workflow Visibility** - Real-time monitoring and debugging
- **Time-based Scheduling** - Cron and scheduled notifications

## Prerequisites

- Node.js 18+
- pnpm (install with `npm install -g pnpm`)
- Docker & Docker Compose (for Temporal)
- Novu account and API keys
- Supabase project with notification schema

## Environment Variables

Create a `.env` file with:

```bash
cp .env.example .env
```

## Installation

```bash
# Install dependencies
pnpm install

# Start Temporal services
pnpm temporal:start
```

## Development

```bash
# Start Next.js dev server (port 4000)
pnpm dev

# In another terminal, start Novu dev server
pnpm dlx novu@latest dev

# View Temporal UI
pnpm temporal:ui
```

All three services must be running for full functionality.

## Available Scripts

```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm test             # Run unit tests
pnpm test:integration # Run integration tests
pnpm xnovu            # CLI commands for utilities

# Temporal commands
pnpm temporal:start   # Start Temporal services
pnpm temporal:stop    # Stop Temporal services
pnpm temporal:logs    # View Temporal logs
pnpm temporal:ui      # Open Temporal UI (http://localhost:8080)
```

## Features

### Core Notification System
- Email notifications with React Email templates
- In-app notifications with Novu Inbox
- Real-time connection status monitoring
- Type-safe workflow definitions with Zod

### Temporal Workflows
- **Notification Processing** - Reliable notification delivery
- **Realtime Monitoring** - Process Supabase realtime events
- **Cron Scheduling** - Automated notifications using cron expressions
- **Scheduled Delivery** - Time-specific notification processing
- **Master Orchestration** - Coordinate all subsystems

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
│   └── dev-studio-status/ # Connection monitoring
├── services/              # Core services
│   ├── database/          # Supabase database operations
│   └── realtime/          # Enhanced subscription manager
├── novu/
│   ├── workflows/         # Notification workflows
│   └── emails/           # Email templates
└── components/           # React components

lib/
└── temporal/             # Temporal integration
    ├── workflows/        # Workflow definitions
    ├── activities/       # Activity implementations
    ├── client/          # Temporal client
    └── worker/          # Worker configuration

daemon/
├── services/            # Daemon services
│   ├── DaemonManager.ts # Main orchestrator
│   └── HealthMonitor.ts # Health checks
└── index.ts            # Daemon entry point

types/
└── rule-engine.ts      # Type definitions

docs/
├── temporal-architecture.md  # Temporal design docs
└── deployment.md            # Deployment guide
```

## API Endpoints

### Core Notification APIs
- `POST /api/novu` - Novu bridge for workflow sync
- `POST /api/trigger` - Trigger workflows
- `GET /api/dev-studio-status` - Check Novu connection

## Temporal Workflows

### Notification Processing Workflow
Processes individual notifications with retry logic and error handling.

### Realtime Monitoring Workflow
Polls Supabase for new notifications when realtime subscriptions are not available.

### Scheduling Workflows
- **Cron Scheduling** - Execute notifications based on cron expressions
- **Scheduled Notifications** - Process time-based notifications

### Master Orchestration Workflow
Coordinates all subsystems and manages workflow lifecycles.

## Daemon Operation

The daemon runs all notification services:

```bash
# Start the daemon
pnpm xnovu daemon:start

# Check daemon status
pnpm xnovu daemon:status

# Stop the daemon
pnpm xnovu daemon:stop
```

## Monitoring

### Temporal UI
Access the Temporal Web UI at http://localhost:8080 to:
- View running workflows
- Inspect execution history
- Debug failures
- Monitor performance

### Health Endpoints
- Daemon health: http://localhost:3001/health
- Detailed status: http://localhost:3001/status

## Documentation

- [Temporal Architecture](docs/temporal-architecture.md)
- [Deployment Guide](docs/deployment.md)
- [Novu Workflow Development](docs/novu-workflow.md)

## Learn More

- [Temporal Documentation](https://docs.temporal.io/)
- [Novu Documentation](https://docs.novu.co/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Email](https://react.email/)
- [Supabase Documentation](https://supabase.com/docs)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.