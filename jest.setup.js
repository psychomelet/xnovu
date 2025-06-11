import '@testing-library/jest-dom'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local for all services
// Important: Load .env.local with override to ensure it takes precedence over .env
const envPath = path.resolve(process.cwd(), '.env.local')
const result = dotenv.config({ path: envPath, override: true })

if (result.error) {
  console.error('Error loading .env.local:', result.error)
}

// Verify credentials are loaded for cloud services
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Supabase cloud credentials not found in .env.local. Tests require real Supabase instance.')
  process.exit(1)
}

if (!process.env.NOVU_SECRET_KEY || !process.env.NOVU_API_URL) {
  console.error('ERROR: Novu cloud credentials not found in .env.local. Tests require real Novu instance.')
  process.exit(1)
}

// Check for Redis configuration
if (!process.env.REDIS_URL || process.env.REDIS_URL.includes('localhost')) {
  console.warn('WARNING: Cloud Redis URL not configured. Some tests may fail.')
  console.warn('For full cloud testing, set REDIS_URL in .env.local to point to your cloud Redis instance.')
  // Set a default for tests that don't actually need Redis
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
}

process.env.RULE_ENGINE_ENABLED = 'true'
process.env.RULE_ENGINE_TIMEZONE = 'UTC'
process.env.RULE_ENGINE_MAX_CONCURRENT_JOBS = '5'
process.env.RULE_ENGINE_RETRY_ATTEMPTS = '2'
process.env.RULE_ENGINE_RETRY_DELAY = '1000'
process.env.NODE_ENV = 'test'

// Set Jest timeout for async operations with cloud services
jest.setTimeout(60000) // Increased timeout for cloud services