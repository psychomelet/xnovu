# Workflow Sync Guide

This document describes the simplified workflow synchronization process in XNovu.

## Overview

The workflow sync process deploys your Novu workflows to both Novu Cloud and your Supabase database. The enhanced sync command automatically handles server startup, tunnel creation, and cleanup.

## Quick Start

### Development Mode (Default)

Run a single command to sync all workflows:

```bash
pnpm xnovu sync
```

This command will:
1. Start the Next.js server on port 4000
2. Create a public tunnel using LocalTunnel
3. Sync workflows to Novu Cloud
4. Sync workflow metadata to Supabase
5. Verify the sync
6. Clean up resources (stop server, close tunnel)

### Production Mode

For production deployments where you have a fixed bridge URL:

```bash
pnpm xnovu sync --production
```

This uses the `NOVU_BRIDGE_URL` from your environment variables instead of creating a tunnel.

## Command Options

```bash
pnpm xnovu sync [options]
```

### Options

- `--dev` - Use LocalTunnel for development (default behavior)
- `--production` - Use NOVU_BRIDGE_URL from environment for production
- `--tunnel-subdomain <subdomain>` - Request a specific subdomain for LocalTunnel
- `--port <port>` - Use a custom port (default: random port to avoid conflicts)
- `--keep-alive` - Keep tunnel and server running after sync completes

### Examples

```bash
# Development with auto-generated random port
pnpm xnovu sync

# Keep tunnel running after sync (useful for testing)
pnpm xnovu sync --keep-alive

# Development with custom subdomain
pnpm xnovu sync --tunnel-subdomain myproject

# Production mode
pnpm xnovu sync --production

# Custom port
pnpm xnovu sync --port 3000

# Combine options
pnpm xnovu sync --tunnel-subdomain myproject --port 5000 --keep-alive
```

## Environment Variables

### Required for All Modes

```bash
# Novu Secret Key
NOVU_SECRET_KEY=your_novu_secret_key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Required for Production Mode

```bash
# Bridge URL for production
NOVU_BRIDGE_URL=https://your-domain.com/api/novu
```

## How It Works

### Development Mode Flow

1. **Port Selection**: Automatically finds an available random port (or uses specified port)
2. **Server Startup**: Starts Next.js server on the selected port
3. **Tunnel Creation**: Creates a public tunnel using LocalTunnel
4. **Workflow Sync**: Uses the tunnel URL to sync workflows to Novu Cloud
5. **Database Sync**: Updates workflow metadata in Supabase
6. **Verification**: Confirms workflows are properly synced
7. **Cleanup**: Stops server and closes tunnel (unless --keep-alive is used)

### Production Mode Flow

1. **Bridge URL**: Uses the NOVU_BRIDGE_URL from environment
2. **Workflow Sync**: Syncs workflows to Novu Cloud
3. **Database Sync**: Updates workflow metadata in Supabase
4. **Verification**: Confirms workflows are properly synced

## Workflow Metadata

Each workflow must have a `metadata.ts` file that defines:

```typescript
export const metadata: WorkflowMetadata = {
  workflow_key: 'unique-workflow-id',
  name: 'Human Readable Name',
  description: 'What this workflow does',
  workflow_type: 'STATIC' | 'DYNAMIC',
  default_channels: ['EMAIL', 'IN_APP', 'SMS', 'PUSH', 'CHAT'],
  payload_schema: zodToJsonSchema(payloadSchema),
  control_schema: zodToJsonSchema(controlSchema),
  // ... other fields
};
```

## CI/CD Integration

The simplified sync command is perfect for CI/CD pipelines:

```yaml
# GitHub Actions Example
- name: Sync Workflows
  env:
    NOVU_SECRET_KEY: ${{ secrets.NOVU_SECRET_KEY }}
    NOVU_BRIDGE_URL: ${{ secrets.NOVU_BRIDGE_URL }}
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
  run: |
    pnpm install
    pnpm xnovu sync --production
```

## Troubleshooting

### Server fails to start

- Check if port is already in use
- Verify all dependencies are installed: `pnpm install`
- The sync command now uses random ports by default to avoid conflicts

### Tunnel creation fails

- LocalTunnel service might be down, try again later
- Use a custom subdomain if the default is taken
- The tunnel manager will retry up to 3 times automatically

### Sync fails with timeout

- LocalTunnel can be slow - the sync now waits for tunnel stability
- LocalTunnel may have issues with external access even when local tests pass
- If sync fails, try the manual command shown in the error message
- Use `--keep-alive` to keep the tunnel open:
  ```bash
  pnpm xnovu sync --keep-alive
  # The tunnel URL will be displayed
  # Try the manual sync command in another terminal
  ```

### Known LocalTunnel Limitations

- **CRITICAL**: Do NOT test the tunnel with curl - it can break the tunnel connection
- LocalTunnel works with Node.js fetch but may fail with curl or other clients
- The tunnel needs 15+ seconds to stabilize after initial connection
- Some requests may timeout even when the tunnel appears to be working
- Once curl is used on a tunnel, it often stops working completely
- For production use, consider using a proper reverse proxy or ngrok with a paid account

### Database sync fails

- Verify Supabase credentials
- Check that the notify schema exists in your database
- Ensure workflow metadata matches database schema

### Tips for Reliable Syncing

1. **Test Local First**: Always verify the local server works before syncing:
   ```bash
   curl http://localhost:PORT/api/novu
   ```

2. **Use Keep-Alive for Testing**: When debugging, use `--keep-alive` to keep the tunnel open
3. **Manual Sync**: If automated sync fails, copy the command from the error message and run it manually

## Migration from Manual Process

If you were previously using the manual 4-step process:

1. Remove NOVU_BRIDGE_URL from .env (unless using production mode)
2. Stop any running `pnpm dev` or `npx novu@latest dev` processes
3. Run `pnpm xnovu sync` instead

The new command handles everything automatically!