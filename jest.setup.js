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

// Jest configuration and timeout for async operations
jest.setTimeout(30000)