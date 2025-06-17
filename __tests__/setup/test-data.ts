import { randomUUID } from 'crypto';

// Global test enterprise ID - unique per test run
// Check if it's already set in the environment (from global setup)
let testEnterpriseId: string | null = process.env.TEST_ENTERPRISE_ID || null;

/**
 * Get the test enterprise ID for this test run.
 * This is generated once per test suite run and shared across all tests.
 */
export function getTestEnterpriseId(): string {
  if (!testEnterpriseId) {
    // In case the environment variable wasn't set, check again
    testEnterpriseId = process.env.TEST_ENTERPRISE_ID || null;
    if (!testEnterpriseId) {
      throw new Error('Test enterprise ID not initialized. Ensure global setup has run.');
    }
  }
  return testEnterpriseId;
}

/**
 * Initialize the test enterprise ID.
 * Called by global setup.
 */
export function initializeTestEnterpriseId(): string {
  testEnterpriseId = randomUUID();
  console.log(`🧪 Test run initialized with enterprise ID: ${testEnterpriseId}`);
  return testEnterpriseId;
}

/**
 * Get the current test enterprise ID without throwing.
 * Used by teardown to clean up even if setup failed.
 */
export function getCurrentTestEnterpriseId(): string | null {
  return testEnterpriseId || process.env.TEST_ENTERPRISE_ID || null;
}

/**
 * Generate a test user ID
 */
export function generateTestUserId(): string {
  return randomUUID();
}

/**
 * Generate a test workflow key with enterprise ID included
 */
export function generateTestWorkflowKey(baseKey: string): string {
  return `${baseKey}-${getTestEnterpriseId()}`;
}

/**
 * Generate a temporal workflow ID with enterprise ID included
 */
export function generateTemporalWorkflowId(type: string, id: number | string): string {
  return `${type}-${getTestEnterpriseId()}-${id}`;
}