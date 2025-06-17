# Testing Temporal Schedule Sync

This document describes how to test the Temporal schedule synchronization functionality.

## Prerequisites

Before running tests, ensure you have:

1. **Supabase Credentials**: Valid `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. **Temporal Server**: Running Temporal server (local or cloud)
3. **Environment Variables**: Properly configured `.env` file

## Test Structure

All tests use real Supabase connections and Temporal services. No mocking is used, following the project's testing principles.

### Test Helpers

Located in `__tests__/helpers/supabase-test-helpers.ts`:

- `createTestSupabaseClient()`: Creates a Supabase client for tests
- `createTestWorkflow()`: Factory for test workflow data
- `createTestRule()`: Factory for test rule data
- `setupTestWorkflowWithRule()`: Creates workflow and rule in database
- `cleanupTest*()`: Cleanup functions for test data
- `waitForCondition()`: Helper for waiting on async conditions

### Integration Tests

#### Schedule Client Tests
`__tests__/integration/temporal/schedule-client.integration.test.ts`

Tests schedule CRUD operations:
- Creating schedules from rules
- Updating existing schedules
- Deleting schedules
- Listing all schedules
- Getting schedule descriptions

#### Rule Sync Service Tests
`__tests__/integration/temporal/rule-sync-service.integration.test.ts`

Tests synchronization logic:
- Initial sync of all rules on startup
- Individual rule synchronization
- Orphaned schedule cleanup
- Reconciliation with statistics

#### Rule Polling Loop Tests
`__tests__/integration/polling/rule-polling-loop.integration.test.ts`

Tests the polling mechanism:
- Polling loop lifecycle
- Detecting new rules
- Detecting rule updates
- Removing schedules for deactivated rules
- Force reconciliation

#### Rule Scheduled Activity Tests
`__tests__/integration/temporal/rule-scheduled.integration.test.ts`

Tests notification creation:
- Creating notifications from scheduled rules
- Validation and error handling
- Recipient extraction
- Complex payload handling

## Running Tests

```bash
# Run all integration tests
pnpm test:integration

# Run specific test file
pnpm jest __tests__/integration/temporal/schedule-client.integration.test.ts

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch
```

## Test Data Management

### Automatic Cleanup

All tests automatically clean up their data:
- Test workflows are deleted after tests
- Test rules are deleted after tests
- Test schedules are deleted after tests
- Test notifications are deleted after tests

### Enterprise ID Pattern

Tests use unique enterprise IDs to avoid conflicts:
- `test-sync-ent-{n}`: For sync tests
- `test-polling-ent-{n}`: For polling tests
- `test-scheduled-ent`: For scheduled activity tests
- `test-{feature}-{purpose}`: For specific test cases

### Schedule ID Pattern

Schedules follow the pattern: `rule-{ruleId}-{enterpriseId}`

## Common Test Patterns

### Waiting for Async Operations

```typescript
await waitForCondition(async () => {
  const description = await getSchedule(scheduleId)
  return description !== null
}, 5000) // 5 second timeout
```

### Creating Test Data

```typescript
const { workflow, rule } = await setupTestWorkflowWithRule(supabase, {
  enterprise_id: 'test-my-feature',
  default_channels: ['EMAIL', 'IN_APP'],
}, {
  trigger_config: { cron: '0 9 * * MON' },
  rule_payload: { recipients: ['user-1'] },
})
```

### Cleanup Pattern

```typescript
afterAll(async () => {
  await cleanupTestRules(supabase, testEnterpriseIds)
  await cleanupTestWorkflows(supabase, testEnterpriseIds)
})
```

## Troubleshooting

### Test Failures

1. **Missing Credentials**: Ensure environment variables are set
2. **Temporal Connection**: Verify Temporal server is running
3. **Database Permissions**: Check Supabase service role key has proper permissions
4. **Cleanup Issues**: Manually check database for orphaned test data

### Manual Cleanup

If tests fail to clean up properly:

```sql
-- Delete test schedules from Temporal
-- Use Temporal CLI or UI to remove schedules starting with 'rule-'

-- Delete test data from Supabase
DELETE FROM notify.ent_notification WHERE enterprise_id LIKE 'test-%';
DELETE FROM notify.ent_notification_rule WHERE enterprise_id LIKE 'test-%';
DELETE FROM notify.ent_notification_workflow WHERE enterprise_id LIKE 'test-%';
```

## Best Practices

1. **Use Unique IDs**: Always use unique enterprise IDs for test isolation
2. **Clean Up**: Always clean up test data, even on test failure
3. **Wait for Consistency**: Use `waitForCondition` for eventual consistency
4. **Test Real Scenarios**: Test actual workflows, not mocked behavior
5. **Fail Fast**: Tests should fail immediately on missing credentials