import '@testing-library/jest-dom'

// Environment variables come from:
// - GitHub Actions: set via secrets in workflow env section
// - Local development: loaded from .env.local by Next.js or manual export

// Only set fallback environment variables if not already set
// These provide graceful fallbacks for missing credentials
if (!process.env.NOVU_SECRET_KEY) {
  process.env.NOVU_SECRET_KEY = 'test-secret-key'
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project-id.supabase.co'
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'your_anon_key_here'
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres.your-project-id:password@aws-0-region.pooler.supabase.com:6543/postgres'
}

// Configure Redis for tests - use Docker Redis on port 6380
process.env.REDIS_URL = 'redis://localhost:6380'
process.env.RULE_ENGINE_ENABLED = 'true'
process.env.RULE_ENGINE_TIMEZONE = 'UTC'
process.env.RULE_ENGINE_MAX_CONCURRENT_JOBS = '5'
process.env.RULE_ENGINE_RETRY_ATTEMPTS = '2'
process.env.RULE_ENGINE_RETRY_DELAY = '1000'
process.env.NODE_ENV = 'test'

// Set Jest timeout for async operations
jest.setTimeout(30000)