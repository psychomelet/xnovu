# XNovu - Novu Notification Platform

A modern notification system built with Next.js and Novu for email and in-app notifications.

## Tech Stack

- **Next.js** - React framework with App Router
- **TypeScript** - Type-safe development
- **Novu** - Open-source notification infrastructure
- **React Email** - Build emails with React components
- **Tailwind CSS** - Utility-first CSS framework
- **pnpm** - Fast, disk space efficient package manager

## Prerequisites

- Node.js 18+
- pnpm (install with `npm install -g pnpm`)
- Novu account and API keys

## Environment Variables

Create a `.env.local` file with:

```env
NOVU_SECRET_KEY=your_novu_secret_key
NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER=your_app_identifier
NEXT_PUBLIC_NOVU_SUBSCRIBER_ID=your_subscriber_id
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
```

## Features

- Email notifications with React Email templates
- In-app notifications with Novu Inbox
- Two example workflows:
  - Welcome onboarding email
  - Yogo email workflow
- Real-time connection status monitoring
- Type-safe workflow definitions with Zod

## Project Structure

```
app/
├── api/                    # API routes
│   ├── novu/              # Novu bridge endpoint
│   ├── trigger/           # Trigger workflows
│   └── dev-studio-status/ # Connection monitoring
├── novu/
│   ├── workflows/         # Notification workflows
│   └── emails/           # Email templates
└── components/           # React components
```

## API Endpoints

- `POST /api/novu` - Novu bridge for workflow sync
- `POST /api/trigger` - Trigger welcome email
- `POST /api/triggerYogo` - Trigger Yogo email
- `GET /api/dev-studio-status` - Check Novu connection
- `POST /api/events` - Track user events

## Workflows

Each workflow includes:
- `workflow.ts` - Step definitions and logic
- `schemas.ts` - Zod validation schemas
- `types.ts` - TypeScript type definitions
- `index.ts` - Workflow export

## Learn More

- [Novu Documentation](https://docs.novu.co/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Email](https://react.email/)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.