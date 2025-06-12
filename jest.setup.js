import '@testing-library/jest-dom'
import { config } from 'dotenv'

// Load .env first (defaults)
config()

// Test environment configuration
process.env.NODE_ENV = 'test'

// Override specific values for test environment
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.RULE_ENGINE_MAX_CONCURRENT_JOBS = '5'
process.env.RULE_ENGINE_RETRY_ATTEMPTS = '2'
process.env.RULE_ENGINE_RETRY_DELAY = '1000'

// Jest configuration
jest.setTimeout(30000)