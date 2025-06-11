# GitHub Secrets Setup for XNovu

This guide explains how to set up GitHub secrets for running connection tests in GitHub Actions.

## Required Secrets

The following secrets need to be configured in your GitHub repository for the connection tests to run with real APIs:

### Novu Secrets
- `NOVU_SECRET_KEY` - Your Novu API secret key from the Novu dashboard
- `NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER` - Your Novu application identifier

### Supabase Secrets
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `DATABASE_URL` - Your Supabase database connection string

## How to Add Secrets

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with the exact name listed above
6. Paste the corresponding value from your Novu/Supabase dashboards

## Testing Without Secrets

If you don't have the secrets configured:
- The connection tests will be skipped automatically
- You'll see warning messages indicating which credentials are missing
- All other tests will still run normally

## Local Development

For local development, create a `.env.local` file with these same variables:

```bash
# Novu
NOVU_SECRET_KEY=your_novu_secret_key
NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER=your_novu_app_id

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=postgresql://...
```

## Security Notes

- Never commit real API keys to the repository
- Use GitHub secrets for CI/CD environments
- Keep service role keys especially secure as they bypass Row Level Security