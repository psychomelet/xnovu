# XNovu Testing Guide

## Core Testing Principles

### 1. Strict Test Policy: Always Fail, Never Skip
- **NEVER** skip tests due to missing credentials or dependencies
- **ALWAYS** fail explicitly with clear error messages
- Tests either pass completely or fail immediately
- No conditional execution based on environment

### 2. Real Connections Only: No Mocking
- **NEVER** mock external services (Supabase, Novu, Redis, databases)
- **ALWAYS** use real service connections
- Test against actual APIs and databases
- Validate real-world behavior and compatibility

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

### CI/CD (GitHub Actions)
- Redis service container
- Repository secrets for credentials
- Automated health checks
- Test artifacts upload

## File Structure

```
__tests__/
├── services/                      # Connection tests
│   ├── NovuConnection.test.ts
│   └── SupabaseConnection.test.ts
├── integration/                   # Multi-service tests
│   └── *.integration.test.ts
├── components/                    # React components
│   └── *.test.tsx
└── utils/                        # Utilities
    └── *.test.ts
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