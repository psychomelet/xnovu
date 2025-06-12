import '@testing-library/jest-dom'
import { config } from 'dotenv'
import { existsSync } from 'fs'
import { join } from 'path'

// Load environment variables from .env.local if it exists
const envLocalPath = join(process.cwd(), '.env.local')
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true })
}

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
if (!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY = 'your_service_role_key_here'
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

// Add Node.js globals for Next.js compatibility
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Add Web API globals that Next.js requires
if (typeof global.Request === 'undefined') {
  // Mock Request and Response for Next.js API routes
  global.Request = class Request {
    constructor(input, init = {}) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init.method || 'GET';
      this.headers = new Map(Object.entries(init.headers || {}));
      this._body = init.body || null;
    }
    
    async json() {
      return JSON.parse(this._body || '{}');
    }
    
    async text() {
      return this._body || '';
    }
  };
  
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = new Map(Object.entries(init.headers || {}));
    }
    
    static json(data, init = {}) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers
        }
      });
    }
    
    async json() {
      return JSON.parse(this.body);
    }
  };
  
  global.Headers = class Headers extends Map {};
}

// Set Jest timeout for async operations
jest.setTimeout(30000)