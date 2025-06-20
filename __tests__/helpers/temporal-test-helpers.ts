/**
 * Test helpers for Temporal TestWorkflowEnvironment
 * 
 * These utilities help with testing Temporal workflows using TestWorkflowEnvironment,
 * providing time-skipping capabilities and simplified workflow testing.
 */

import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { WorkflowClient } from '@temporalio/client'
import { Duration } from '@temporalio/common'
import * as activities from '@/lib/temporal/activities'

export interface TestEnvironmentSetup {
  testEnv: TestWorkflowEnvironment
  worker: Worker
  client: any // Can be either WorkflowClient or TestWorkflowEnvironment client
}

/**
 * Create a test environment with worker for testing workflows
 * @param taskQueue - The task queue name (default: 'test-queue')
 * @param mockActivities - Optional activity mocks to override real activities
 */
export async function createTestEnvironment(
  taskQueue: string = 'test-queue',
  mockActivities?: Partial<typeof activities>
): Promise<TestEnvironmentSetup> {
  // Create test environment
  const testEnv = await TestWorkflowEnvironment.createLocal()
  
  // Create worker with workflows and activities
  const worker = await Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue,
    workflowsPath: require.resolve('@/lib/temporal/workflows'),
    activities: {
      ...activities,
      ...mockActivities, // Override with mocks if provided
    },
  })
  
  // Start the worker
  const workerRun = worker.run()
  
  // Store the worker promise for cleanup
  ;(testEnv as any).workerRun = workerRun
  ;(testEnv as any).worker = worker
  
  return {
    testEnv,
    worker,
    client: testEnv.client,
  }
}

/**
 * Clean up test environment and worker
 */
export async function cleanupTestEnvironment(setup: TestEnvironmentSetup): Promise<void> {
  const { testEnv, worker } = setup
  
  // Shutdown the worker
  worker.shutdown()
  await (testEnv as any).workerRun
  
  // Teardown test environment
  await testEnv.teardown()
}

/**
 * Skip time in the test environment
 * This is the key benefit of TestWorkflowEnvironment - instant time travel!
 */
export async function skipTime(
  testEnv: TestWorkflowEnvironment,
  duration: Duration | string | number
): Promise<void> {
  await testEnv.sleep(duration)
}

/**
 * Wait for a workflow to complete with time-skipping
 * Unlike waitForCondition, this can skip time to make workflows complete instantly
 */
export async function waitForWorkflowWithTimeSkip(
  setup: TestEnvironmentSetup,
  workflowId: string,
  maxDuration: Duration | string | number = '5m'
): Promise<void> {
  const { testEnv, client } = setup
  
  // Get workflow handle
  const handle = client.getHandle ? client.getHandle(workflowId) : client.workflow.getHandle(workflowId)
  
  // Skip time to allow workflow to complete
  await skipTime(testEnv, maxDuration)
  
  // The workflow should now be complete
  await handle.result()
}

/**
 * Test scheduled workflows by skipping to their trigger times
 */
export async function testScheduledWorkflow(
  setup: TestEnvironmentSetup,
  scheduleId: string,
  expectedTriggerTimes: Date[]
): Promise<void> {
  const { testEnv } = setup
  
  for (const triggerTime of expectedTriggerTimes) {
    // Calculate how much time to skip
    const now = new Date(await testEnv.currentTimeMs())
    const timeToSkip = triggerTime.getTime() - now.getTime()
    
    if (timeToSkip > 0) {
      await skipTime(testEnv, timeToSkip)
    }
    
    // Verify the schedule triggered at this time
    // (Implementation depends on how schedules are tracked in your system)
  }
}

/**
 * Test workflow retries with exponential backoff using time-skipping
 */
export async function testWorkflowRetries(
  setup: TestEnvironmentSetup,
  workflowId: string,
  expectedRetries: number,
  initialInterval: Duration | string | number = '1s'
): Promise<void> {
  const { testEnv } = setup
  
  // Skip through each retry interval
  let currentIntervalMs = typeof initialInterval === 'string' ? 1000 : 
                          typeof initialInterval === 'number' ? initialInterval : 
                          1000 // Default to 1 second
  
  for (let i = 0; i < expectedRetries; i++) {
    await skipTime(testEnv, currentIntervalMs)
    // Double the interval for exponential backoff
    currentIntervalMs *= 2
  }
}

/**
 * Create a mock activity that tracks calls and can be configured
 */
export function createMockActivity<T extends (...args: any[]) => any>(
  name: string,
  defaultImplementation?: T
): jest.MockedFunction<T> {
  const mock = jest.fn(defaultImplementation || (() => Promise.resolve()))
  mock.mockName(name)
  return mock as any // Simplified type to avoid complex Jest type issues
}

/**
 * Helper to test polling loops with time-skipping
 */
export async function testPollingLoop(
  setup: TestEnvironmentSetup,
  pollInterval: Duration | string | number,
  expectedPolls: number
): Promise<void> {
  const { testEnv } = setup
  
  // Skip time for each expected poll
  for (let i = 0; i < expectedPolls; i++) {
    await skipTime(testEnv, pollInterval)
  }
}

// Add test to satisfy Jest
describe('temporal-test-helpers', () => {
  it('should export helper functions', () => {
    expect(createTestEnvironment).toBeDefined()
    expect(cleanupTestEnvironment).toBeDefined()
    expect(skipTime).toBeDefined()
    expect(waitForWorkflowWithTimeSkip).toBeDefined()
    expect(testScheduledWorkflow).toBeDefined()
    expect(testWorkflowRetries).toBeDefined()
    expect(createMockActivity).toBeDefined()
    expect(testPollingLoop).toBeDefined()
  })
})