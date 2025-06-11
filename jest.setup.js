import '@testing-library/jest-dom'

// Mock environment variables
process.env.NOVU_SECRET_KEY = 'test-secret-key'
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'