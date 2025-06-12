# Testing Philosophy

## STRICT TEST POLICY: NEVER SKIP, ALWAYS FAIL

When writing tests for XNovu:

**NEVER skip tests** due to missing credentials, configurations, or dependencies:
- ❌ Do NOT use `console.log('⚠️ Skipping test - missing X')` and early returns
- ❌ Do NOT gracefully degrade when credentials are invalid
- ❌ Do NOT allow tests to "pass" by skipping critical validations

**ALWAYS fail explicitly** when requirements aren't met:
- ✅ Throw clear errors when credentials are missing or invalid
- ✅ Fail fast with descriptive error messages
- ✅ Make it immediately obvious when the environment is misconfigured

**Why this approach:**
- Prevents false sense of security from "passing" skipped tests
- Forces proper CI/CD configuration and credential management
- Provides immediate feedback on environment issues
- Ensures all tests either pass completely or fail explicitly

**Implementation:**
- Use centralized credential validation that throws on invalid credentials
- Service tests (`__tests__/services/`) validate credentials first
- Integration tests assume credentials are valid (fail if they're not)
- No conditional test execution based on credential availability

## REAL CONNECTIONS ONLY: NO MOCKING EXTERNAL SERVICES

When writing tests for XNovu:

**NEVER mock external services** - always use real connections:
- ❌ Do NOT mock Supabase client or database connections
- ❌ Do NOT mock Novu API or SDK
- ❌ Do NOT mock Redis or any cache layer
- ❌ Do NOT mock any database operations

**ALWAYS use real services** for all test types:
- ✅ Use actual Supabase connections with test database
- ✅ Use real Novu API with test credentials
- ✅ Use actual Redis instance (Docker container for local, service for CI)
- ✅ Perform real database operations and verify actual results

**Why this approach:**
- Ensures tests reflect real-world behavior
- Catches integration issues early
- Validates actual API contracts and responses
- Prevents false positives from mocked behaviors
- Guarantees compatibility with service updates

**Test Infrastructure:**
- Local development: Use Docker containers for Redis and databases
- CI/CD: Use GitHub Actions service containers
- All tests require valid credentials and running services
- Connection tests validate service availability first

## Test Categorization

Tests are organized into distinct categories for better management and execution order:

### 1. Connection Tests (`pnpm test:connections`)
- Located in `__tests__/services/`
- Validate external service credentials (Novu, Supabase, Database)
- Must run first to ensure environment is properly configured
- Fail fast if credentials are invalid

### 2. Unit Tests (`pnpm test:unit`)
- All tests except those in `services/` or `integration/` directories
- Assume credentials are valid (connection tests passed)
- Focus on business logic and component behavior
- No redundant credential checks

### 3. Integration Tests (`pnpm test:integration`)
- Located in `__tests__/integration/`
- Test interactions between multiple services
- Require all external services to be available
- Run after unit tests in CI pipeline

### Test Commands

```bash
# Standard test flow - runs all tests in order: connections → unit → integration
pnpm test

# Individual test categories
pnpm test:connections  # Run only connection/credential validation tests
pnpm test:unit        # Run only unit tests (skips services & integration)
pnpm test:integration # Run only integration tests
pnpm test:all         # Run all tests without categorization

# CI/CD pipeline - runs all categories in order
pnpm test:ci          # connections → unit → integration

# Development helpers
pnpm test:watch       # Watch mode with test database setup
pnpm test:coverage    # Generate coverage report
```

This approach ensures:
- Credentials are validated once at the beginning
- Tests fail fast on configuration issues
- No redundant credential checking in individual tests
- Clear separation of concerns
- Efficient test execution

## Test Architecture Overview

XNovu uses a multi-layered testing strategy with clear separation of concerns:

1. **Connection Tests** (`__tests__/services/`) - Validate real API connections
2. **Unit Tests** - Test business logic with real services (no mocking)
3. **Integration Tests** (`__tests__/integration/`) - Test multi-service interactions
4. **CI/CD Tests** - Automated testing in GitHub Actions with Redis service

## Running Tests

```bash
# Run all tests (includes Redis setup/teardown)
pnpm test:all

# Run specific test categories
pnpm test:connections    # Test real API connections (requires credentials)
pnpm test:unit          # Test business logic (real services)
pnpm test:integration   # Test multi-service flows (requires Redis)

# Development commands
pnpm test:watch         # Watch mode with auto-rerun
pnpm test:coverage      # Generate coverage report
pnpm test:debug         # Debug tests with Node inspector

# Utility commands
pnpm test:setup         # Start Redis container (local only)
pnpm test:teardown      # Stop Redis container (local only)
pnpm test:lint          # Lint test files
pnpm test:type-check    # TypeScript validation
```

## Test Infrastructure

### Redis Configuration
- **Port**: 6379 (consistent across local and CI)
- **Local**: Docker container via `docker-compose.test.yml`
- **CI**: GitHub Actions service container
- **Health checks**: Built-in with 30-second timeout

### Environment Variables
Test environment variables are configured in `jest.setup.js`:
- Fallback values for missing credentials
- Redis URL: `redis://localhost:6379`
- Rule Engine settings for integration tests

### Test Infrastructure Requirements
```
Local Development:
├── Redis Docker container (port 6379)
├── Valid Supabase credentials
├── Valid Novu API credentials
└── Test database access

CI/CD Environment:
├── GitHub Actions service containers
├── Repository secrets for all credentials
└── Automated service health checks
```

## File Naming Conventions

```
__tests__/
├── services/                    # Connection tests
│   ├── NovuConnection.test.ts  # Real API connection tests
│   └── SupabaseConnection.test.ts
├── integration/                 # Multi-service tests
│   ├── RuleEngineService.integration.test.ts
│   └── SubscriptionManager.integration.test.ts
├── components/                  # React component tests
│   └── ComponentName.test.tsx
└── utils/                      # Utility function tests
    └── utilityName.test.ts
```

**Naming patterns:**
- Unit tests: `ComponentName.test.ts`
- Integration tests: `ServiceName.integration.test.ts`
- Connection tests: `ServiceName.test.ts` (in services/)
- Test utilities: `testUtils.ts` or `helpers.test.ts`

## Test Structure Pattern

```typescript
describe('ComponentName', () => {
  // Setup and teardown
  beforeEach(() => {
    // Setup test environment
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Feature Group', () => {
    it('should do something specific', () => {
      // Arrange: Set up test data
      const input = { value: 'test' };

      // Act: Execute the function
      const result = functionUnderTest(input);

      // Assert: Verify the outcome
      expect(result).toBe('expected');
    });

    it('should handle error cases', () => {
      // Always test both success and failure paths
      expect(() => functionWithError()).toThrow('Expected error');
    });
  });
});
```

## CI/CD Testing

GitHub Actions runs tests with:
- Redis service container on port 6379
- All environment variables from repository secrets
- Test result artifacts uploaded for review
- Jest cache for faster subsequent runs

**CI Test Order:**
1. Connection tests (validate API access)
2. Unit tests (business logic)
3. Integration tests (multi-service flows)

## Debugging Tests

```bash
# Run specific test file
pnpm jest __tests__/services/NovuConnection.test.ts

# Run tests matching pattern
pnpm jest --testNamePattern="should handle errors"

# Debug with Node inspector
pnpm test:debug
# Then open chrome://inspect in Chrome

# Run with verbose output
pnpm jest --verbose --no-coverage

# Run single test file in watch mode
pnpm jest --watch __tests__/specific.test.ts
```

## Coverage Requirements

Current thresholds (configured in `jest.config.js`):
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

Coverage includes:
- `app/**/*.{ts,tsx}` - Application code
- `lib/**/*.{ts,tsx}` - Library utilities
- `cli/**/*.{ts,tsx}` - CLI tools

Excluded from coverage:
- Type definition files (`*.d.ts`)
- Configuration files
- Build output directories