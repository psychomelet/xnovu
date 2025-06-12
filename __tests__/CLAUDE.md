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