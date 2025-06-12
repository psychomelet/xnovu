import '@testing-library/jest-dom'
import { config } from 'dotenv'
import { existsSync } from 'fs'
import { join } from 'path'

// Load .env first (defaults)
config()

// Then load .env.local if it exists (overrides)
const envLocalPath = join(process.cwd(), '.env.local')
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true })
}

// Test environment configuration
process.env.NODE_ENV = 'test'

// Override specific values for test environment
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.RULE_ENGINE_MAX_CONCURRENT_JOBS = '5'
process.env.RULE_ENGINE_RETRY_ATTEMPTS = '2'
process.env.RULE_ENGINE_RETRY_DELAY = '1000'

// Jest configuration
jest.setTimeout(30000)