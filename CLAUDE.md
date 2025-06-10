# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application with React 19, integrated with Novu notification platform. It demonstrates email and in-app notifications with TypeScript.

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server (port 4000)
pnpm dev

# Start Novu development server (required for notifications)
pnpm dlx novu@latest dev

# Build for production
pnpm build

# Run production server
pnpm start

# Lint code
pnpm lint
```

## Architecture

### API Routes (`app/api/`)
- `/api/novu` - Novu bridge endpoint that connects workflows to Novu cloud
- `/api/trigger` - Triggers welcome-onboarding-email workflow
- `/api/triggerYogo` - Triggers yogo-email workflow
- `/api/dev-studio-status` - Checks Novu connection status
- `/api/events` - Tracks user events

### Novu Workflows (`app/novu/workflows/`)
Each workflow follows this structure:
- `index.ts` - Exports the workflow
- `workflow.ts` - Defines workflow steps and logic
- `schemas.ts` - Zod schemas for validation
- `types.ts` - TypeScript types

### Key Integration Points
1. **Novu Bridge**: The `/api/novu` route serves workflows to Novu cloud
2. **Environment Variables**: Required for Novu connection
   - `NOVU_SECRET_KEY`
   - `NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER`
   - `NEXT_PUBLIC_NOVU_SUBSCRIBER_ID`
3. **In-App Notifications**: Uses Novu's Inbox component in `app/components/NotificationToast/`

## Development Workflow

1. When modifying workflows, changes are reflected in the Novu dev studio
2. Email templates use React Email components in `app/novu/emails/`
3. The app checks Novu connection status every 3 seconds on the home page
4. Both dev servers (Next.js and Novu) must be running for full functionality

## Next.js 15 & React 19 Updates

- Using React 19 with improved performance and concurrent features
- Next.js 15 with Turbopack enabled for faster development builds
- All API routes use `NextRequest` and `NextResponse` from `next/server`
- TypeScript target set to ES2022 for modern JavaScript features
- Package manager: pnpm for faster, more efficient dependency management

## Important Patterns

- Workflows are defined using Novu's declarative syntax with steps
- Email templates are React components that get compiled to HTML
- All workflow payloads are validated with Zod schemas
- The bridge endpoint automatically serves all workflows from the workflows directory