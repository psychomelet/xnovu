import '@testing-library/jest-dom'

// Mock environment variables
process.env.NOVU_SECRET_KEY = 'test-secret-key'
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

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