# XNovu Testing Guide

## Core Testing Principles

### 1. Strict Test Policy: Always Fail, Never Skip
- **NEVER** skip tests due to missing credentials or dependencies
- **ALWAYS** fail explicitly with clear error messages
- Tests either pass completely or fail immediately
- No conditional execution based on environment

### 2. Real Connections for External Services
- **NEVER** mock external services (Supabase, Novu, Redis, databases)
- **ALWAYS** use real service connections for non-Temporal services
- Test against actual APIs and databases
- Validate real-world behavior and compatibility

### 3. TestWorkflowEnvironment for Temporal
- Use `@temporalio/testing` for Temporal workflow tests
- In-memory execution with time-skipping capabilities
- No need for real Temporal server in tests
- Default namespace (no namespace management required)

## Test Categories & Execution Order

### 1. Connection Tests (`pnpm test:connections`)
**Location:** `__tests__/services/`
**Purpose:** Validate credentials and service availability
**Run:** First (fail fast on misconfiguration)

### 2. Unit Tests (`pnpm test:unit`)
**Location:** `__tests__/unit/`
**Purpose:** Business logic validation with real services
**Run:** After connection tests pass

### 3. Integration Tests (`pnpm test:integration`)
**Location:** `__tests__/integration/`
**Purpose:** Multi-service interaction testing
**Run:** Last (requires all services available)

## Commands

```bash
# Standard flow (connections → unit → integration)
pnpm test              # Run all tests in order
pnpm test:ci           # CI/CD pipeline execution

# Individual categories
pnpm test:connections  # Validate service connections
pnpm test:unit         # Business logic tests
pnpm test:integration  # Multi-service tests
pnpm test:all          # All tests without categorization

# Development
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm test:debug        # Node inspector
```

## Infrastructure Requirements

### Local Development
- Redis Docker container (port 6379)
- Valid Supabase credentials
- Valid Novu API credentials
- Test database access
- Temporal CLI installed (for tests that need real server)

### CI/CD (GitHub Actions)
- Redis service container
- Repository secrets for credentials
- Temporal CLI installed via temporalio/setup-temporal@v0
- Local Temporal dev server started automatically
- Test artifacts upload

## Hybrid Testing Approach

XNovu uses a hybrid testing approach for Temporal:

### 1. TestWorkflowEnvironment (In-Memory)
Used for pure workflow logic tests where time-skipping is beneficial:
- Workflow execution tests
- Activity mocking
- Time-based workflow behavior
- Retry and timeout testing

### 2. Local Temporal Server (Real APIs)
Used for tests that require real Temporal APIs:
- Connection tests (verify connectivity)
- Schedule API tests (create/update/delete schedules)
- Worker lifecycle tests
- Integration tests with multiple services

### Local Development
```bash
# Tests automatically start/stop local Temporal server
pnpm test

# Or manually manage Temporal server
pnpm temporal:start  # Start local dev server
pnpm temporal:check  # Check if running
pnpm temporal:stop   # Stop server
```

### CI/CD Environment
GitHub Actions automatically:
1. Installs Temporal CLI
2. Starts local Temporal dev server (in-memory, no persistence)
3. Runs all tests against localhost:7233
4. No cleanup needed (process ends with job)

## File Structure

```
__tests__/
├── services/                      # Connection tests
│   ├── NovuConnection.test.ts
│   ├── SupabaseConnection.test.ts
│   └── TemporalConnection.unit.test.ts
├── integration/                   # Multi-service tests
│   ├── temporal/                  # Temporal-specific tests
│   └── *.integration.test.ts
├── unit/                         # Unit tests
│   └── *.unit.test.ts
├── components/                    # React components
│   └── *.test.tsx
├── helpers/                      # Test utilities
│   ├── supabase-test-helpers.ts
│   └── temporal-test-helpers.ts
└── setup/                        # Test setup
    ├── global-setup.ts
    └── global-teardown.ts
```

## Temporal Testing with TestWorkflowEnvironment

```typescript
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { Duration } from '@temporalio/common'

describe('Temporal Workflow Tests', () => {
  let testEnv: TestWorkflowEnvironment
  let worker: Worker

  beforeAll(async () => {
    // Create in-memory test environment
    testEnv = await TestWorkflowEnvironment.createLocal()
    
    // Create worker with mocked activities
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-queue',
      workflowsPath: require.resolve('@/lib/temporal/workflows'),
      activities: mockActivities,
    })
    
    await worker.run()
  })

  afterAll(async () => {
    worker?.shutdown()
    await testEnv?.teardown()
  })

  it('should test scheduled workflow with time-skipping', async () => {
    // Create schedule that runs every hour
    const handle = await createSchedule(testRule)
    
    // Skip 2 hours instantly
    await testEnv.sleep(Duration.from({ hours: 2 }))
    
    // Verify workflow executed twice
    expect(mockActivity).toHaveBeenCalledTimes(2)
  })
})
```

## Test Pattern

```typescript
describe('Component/Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Feature Group', () => {
    it('should handle success case', () => {
      // Arrange
      const input = { value: 'test' };

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle error case', () => {
      expect(() => functionWithError()).toThrow('Expected error');
    });
  });
});
```

## Coverage Requirements

**Thresholds:** 70% (branches, functions, lines, statements)

**Included:**
- `app/**/*.{ts,tsx}`
- `lib/**/*.{ts,tsx}`
- `cli/**/*.{ts,tsx}`

**Excluded:**
- Type definitions (`*.d.ts`)
- Configuration files
- Build directories

## Time-Skipping Benefits

With TestWorkflowEnvironment, you can:
- Test cron schedules by jumping to trigger times instantly
- Verify polling loops over "days" in milliseconds
- Test retry policies without actual delays
- Simulate hours/days of execution in seconds
- Test complex time-based workflows deterministically

## Migration Notes

### From Real Temporal Server to TestWorkflowEnvironment
1. No namespace management required (uses default namespace)
2. No need for `ensureNamespaceExists` or namespace cleanup
3. Replace `waitForCondition` with `testEnv.sleep()` for time-based waits
4. Use `createTestEnvironment` helper from `temporal-test-helpers.ts`
5. Mock activities as needed for isolated testing