# Testing Guide

This document describes the testing setup and strategies for the XNovu Rule Engine.

## Test Architecture

The testing setup uses a layered approach with different test types:

### Unit Tests
- **Purpose**: Test individual components in isolation
- **Mocking**: External APIs (Supabase, Novu) are mocked
- **Redis**: Mocked for unit tests
- **Speed**: Fast execution (< 1 second)
- **Command**: `pnpm test`

### Integration Tests  
- **Purpose**: Test components working together with real dependencies
- **Mocking**: Only external APIs are mocked
- **Redis**: Real Redis instance via Docker
- **Speed**: Slower execution (requires Docker setup)
- **Command**: `pnpm test:integration`

## Test Environment Setup

### Prerequisites
- Docker and Docker Compose
- Node.js 18+
- pnpm

### Docker Redis Setup

The integration tests use a real Redis instance via Docker:

```yaml
# docker-compose.test.yml
services:
  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"  # Different port to avoid conflicts
```

### Test Scripts

```bash
# Run unit tests only (default)
pnpm test

# Run integration tests with Docker Redis
pnpm test:integration

# Setup Docker Redis manually
pnpm test:setup

# Teardown Docker Redis manually  
pnpm test:teardown

# Run tests without setup/teardown
pnpm test:only

# Watch mode (starts Redis automatically)
pnpm test:watch

# Coverage with Redis
pnpm test:coverage
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.js
const customJestConfig = {
  testEnvironment: 'jest-environment-node', // Node environment for Redis
  moduleNameMapping: {
    // Only mock external APIs
    '^@supabase/supabase-js$': '<rootDir>/__mocks__/@supabase/supabase-js.js',
    '^@novu/api$': '<rootDir>/__mocks__/@novu/api.js',
    // Real Redis/BullMQ for integration tests
  }
}
```

### Environment Variables

```javascript
// jest.setup.js
process.env.REDIS_URL = 'redis://localhost:6380'
process.env.RULE_ENGINE_ENABLED = 'true'
process.env.RULE_ENGINE_MAX_CONCURRENT_JOBS = '5'
// ... other test-specific environment variables
```

## Test Types and Examples

### Unit Test Example

```typescript
// __tests__/RuleEngineService.unit.test.ts
import { defaultRuleEngineConfig } from '@/app/services/RuleEngineService';

// Mock all dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@novu/api');
jest.mock('bullmq');
jest.mock('ioredis');

describe('RuleEngineService - Unit Tests', () => {
  it('should have default configuration values', () => {
    expect(defaultRuleEngineConfig).toEqual({
      redisUrl: 'redis://localhost:6380',
      defaultTimezone: 'UTC',
      maxConcurrentJobs: 5,
      // ...
    });
  });
});
```

### Integration Test Example

```typescript
// __tests__/RuleEngineService.integration.test.ts
import { RuleEngineService } from '@/app/services/RuleEngineService';

// Only mock external APIs - use real Redis/BullMQ
jest.mock('@supabase/supabase-js');
jest.mock('@novu/api');

describe('RuleEngineService - Integration Tests', () => {
  let ruleEngine: RuleEngineService;

  afterEach(async () => {
    if (ruleEngine) {
      await ruleEngine.shutdown();
    }
  });

  it('should initialize and shutdown without errors', async () => {
    ruleEngine = RuleEngineService.getInstance(testConfig);
    
    await expect(ruleEngine.initialize()).resolves.not.toThrow();
    const status = await ruleEngine.getStatus();
    expect(status.initialized).toBe(true);
    
    await expect(ruleEngine.shutdown()).resolves.not.toThrow();
  });
});
```

## Test Patterns

### Setup and Teardown

```typescript
describe('Component Tests', () => {
  beforeEach(async () => {
    // Reset singletons
    (RuleEngineService as any).instance = null;
  });

  afterEach(async () => {
    // Clean up resources
    if (service) {
      await service.shutdown();
    }
    jest.clearAllMocks();
  });
});
```

### Async Testing with Timeouts

```typescript
it('should handle long-running operations', async () => {
  // Test logic here
}, 15000); // 15 second timeout for Redis operations
```

### Error Handling Tests

```typescript
it('should handle Redis connection failures gracefully', async () => {
  const badConfig = { ...testConfig, redisUrl: 'redis://invalid:1234' };
  
  await expect(
    service.initialize(badConfig)
  ).rejects.toThrow('Redis connection failed');
});
```

## Continuous Integration

### GitHub Actions Setup

```yaml
# .github/workflows/test.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379

steps:
  - name: Install Redis CLI
    run: |
      sudo apt-get update
      sudo apt-get install -y redis-tools

  - name: Run tests
    run: pnpm test
    env:
      REDIS_URL: redis://localhost:6379
```

### CI Test Strategy

1. **Unit Tests**: Run on every commit (fast feedback)
2. **Integration Tests**: Run on pull requests (thorough validation)
3. **Build Tests**: Ensure TypeScript compilation passes

## Debugging Tests

### Debugging Redis Issues

```bash
# Check if Redis is running
docker-compose -f docker-compose.test.yml ps

# Check Redis logs
docker-compose -f docker-compose.test.yml logs redis-test

# Connect to Redis manually
docker-compose -f docker-compose.test.yml exec redis-test redis-cli
```

### Debugging Test Failures

```bash
# Run tests with verbose output
npx jest --verbose --no-cache

# Run specific test file
npx jest __tests__/RuleEngineService.unit.test.ts

# Debug hanging tests
npx jest --detectOpenHandles --forceExit
```

### Common Issues

1. **Port Conflicts**: Ensure port 6380 is available for test Redis
2. **Memory Leaks**: Always clean up resources in `afterEach` hooks
3. **Timeout Issues**: Use appropriate timeouts for async operations
4. **Mock Issues**: Verify mocks are properly reset between tests

## Coverage Requirements

Current coverage thresholds:
- Branches: 70%
- Functions: 70%  
- Lines: 70%
- Statements: 70%

```bash
# Generate coverage report
pnpm test:coverage

# View coverage in browser
open coverage/lcov-report/index.html
```

## Best Practices

1. **Isolation**: Each test should be independent and not affect others
2. **Clean Up**: Always clean up resources (Redis connections, timers, etc.)
3. **Realistic Mocks**: Mock external APIs but use real internal dependencies when possible
4. **Error Testing**: Test both success and failure scenarios
5. **Async Handling**: Properly handle async operations with await/timeouts
6. **Resource Management**: Close connections and clean up singletons

## Performance Considerations

- Unit tests should run in < 1 second
- Integration tests can take up to 30 seconds
- Use test timeouts appropriately
- Clean up resources to prevent memory leaks
- Use Docker for consistent Redis environment