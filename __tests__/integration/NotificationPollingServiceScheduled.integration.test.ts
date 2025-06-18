import { NotificationPollingService } from '@/app/services/database/NotificationPollingService';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { randomUUID } from 'crypto';
import { getTestEnterpriseId } from '../setup/test-data';

// Types
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type SupabaseClient = ReturnType<typeof createClient<Database>>;

describe('NotificationPollingService Scheduled Notification Integration Tests', () => {
  let supabase: SupabaseClient;
  let pollingService: NotificationPollingService;
  let testEnterpriseId: string;
  const createdNotificationIds: number[] = [];
  const createdWorkflowIds: number[] = [];

  // Helper to wait for notification to be available
  const waitForNotification = async (
    pollFn: () => Promise<NotificationRow[]>,
    notificationId: number,
    maxRetries: number = 5
  ): Promise<NotificationRow | undefined> => {
    for (let i = 0; i < maxRetries; i++) {
      const results = await pollFn();
      const found = results.find(n => n.id === notificationId);
      if (found) return found;

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return undefined;
  };

  // Wrapper to filter polling results by our test enterprise
  const pollNotificationsForTest = async (options: Parameters<typeof pollingService.pollNotifications>[0] = {}) => {
    // Use a large batch size to ensure we get all notifications
    const results = await pollingService.pollNotifications({ ...options, batchSize: 1000 });
    return results.filter(n => n.enterprise_id === testEnterpriseId);
  };

  const pollScheduledNotificationsForTest = async (options: Parameters<typeof pollingService.pollScheduledNotifications>[0] = {}) => {
    // Use a large batch size to ensure we get all notifications
    const results = await pollingService.pollScheduledNotifications({ ...options, batchSize: 1000 });
    return results.filter(n => n.enterprise_id === testEnterpriseId);
  };

  const pollFailedNotificationsForTest = async (options: Parameters<typeof pollingService.pollFailedNotifications>[0] = {}) => {
    // Use a large batch size to ensure we get all notifications
    const results = await pollingService.pollFailedNotifications({ ...options, batchSize: 1000 });
    return results.filter(n => n.enterprise_id === testEnterpriseId);
  };

  // Check for real credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const hasRealCredentials = supabaseUrl &&
    supabaseServiceKey &&
    supabaseUrl.includes('supabase.co') &&
    supabaseServiceKey.length > 50;

  beforeAll(async () => {
    if (!hasRealCredentials) {
      throw new Error('Real Supabase credentials required for integration tests. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    // Get shared test enterprise ID
    testEnterpriseId = getTestEnterpriseId();

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-polling-scheduled' } }
    });

    pollingService = new NotificationPollingService(supabase);
  });

  afterAll(async () => {
    // Cleanup handled by global teardown
    // Just clear tracking arrays
    createdNotificationIds.length = 0;
    createdWorkflowIds.length = 0;
  });

  async function createTestWorkflow(): Promise<WorkflowRow> {
    // Always create a new workflow with unique key to avoid test interference
    const uniqueKey = `test-polling-workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .insert({
        name: `Test Polling Workflow ${Date.now()}`,
        workflow_key: uniqueKey,
        workflow_type: 'STATIC',
        default_channels: ['EMAIL'],
        publish_status: 'PUBLISH',
        deactivated: false,
        enterprise_id: testEnterpriseId,
      } satisfies WorkflowInsert)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create test workflow: ${error?.message}`);
    }

    createdWorkflowIds.push(data.id);
    return data;
  }

  async function createTestNotification(
    workflowId: number,
    scheduledFor: string | null = null,
    status: 'PENDING' | 'FAILED' | 'SENT' = 'PENDING'
  ): Promise<NotificationRow> {
    // Ensure updated_at is explicitly set to now
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .insert({
        name: `Test Polling Notification ${Date.now()}`,
        payload: { test: true },
        recipients: [randomUUID()],
        notification_workflow_id: workflowId,
        publish_status: 'PUBLISH',
        notification_status: status,
        enterprise_id: testEnterpriseId,
        scheduled_for: scheduledFor,
        updated_at: now,  // Explicitly set updated_at
      } satisfies NotificationInsert)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create test notification: ${error?.message}`);
    }

    createdNotificationIds.push(data.id);
    
    console.log('Created notification:', {
      id: data.id,
      enterprise_id: data.enterprise_id,
      updated_at: data.updated_at,
      scheduled_for: data.scheduled_for,
      status: data.notification_status
    });

    // Small delay to ensure notification is properly persisted
    await new Promise(resolve => setTimeout(resolve, 100));

    return data;
  }

  describe('pollNotifications with scheduled_for filtering', () => {
    let testWorkflow: WorkflowRow;

    beforeEach(async () => {
      // Create a fresh workflow for each test to avoid interference
      testWorkflow = await createTestWorkflow();

      // Create fresh polling service for each test to avoid timestamp issues
      pollingService = new NotificationPollingService(supabase);
      // Reset the polling timestamp to ensure we capture all notifications
      pollingService.resetPollTimestamp(new Date(Date.now() - 25 * 60 * 60 * 1000)); // 25 hours ago
      
      // Verify the timestamp was set
      const state = pollingService.getPollingState();
      console.log('Polling state after reset:', state);
    });

    it('should include notifications without scheduled_for', async () => {
      const notification = await createTestNotification(testWorkflow.id, null);
      
      // Use the helper function that retries
      const found = await waitForNotification(
        () => pollNotificationsForTest(),
        notification.id,
        10  // More retries
      );
      
      expect(found).toBeDefined();
    });

    it('should include notifications with past scheduled_for', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const notification = await createTestNotification(
        testWorkflow.id,
        pastDate.toISOString()
      );

      const results = await pollNotificationsForTest();

      const found = results.find(n => n.id === notification.id);
      expect(found).toBeDefined();
    });

    it('should exclude notifications with future scheduled_for', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const notification = await createTestNotification(
        testWorkflow.id,
        futureDate.toISOString()
      );

      const results = await pollNotificationsForTest();

      const found = results.find(n => n.id === notification.id);
      expect(found).toBeUndefined();
    });

    it('should handle mixed scheduled notifications correctly', async () => {
      // Create multiple notifications with different scheduled times
      const nullScheduled = await createTestNotification(testWorkflow.id, null);
      const pastScheduled = await createTestNotification(
        testWorkflow.id,
        new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
      );
      const futureScheduled = await createTestNotification(
        testWorkflow.id,
        new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes from now
      );

      const results = await pollNotificationsForTest();

      // Should find null and past, but not future
      expect(results.find(n => n.id === nullScheduled.id)).toBeDefined();
      expect(results.find(n => n.id === pastScheduled.id)).toBeDefined();
      expect(results.find(n => n.id === futureScheduled.id)).toBeUndefined();
    });

    it('should respect includeProcessed option with scheduled_for filter', async () => {
      // Create a fresh polling service with a reset timestamp for this test
      const testPollingService = new NotificationPollingService(supabase);
      testPollingService.resetPollTimestamp(new Date(Date.now() - 25 * 60 * 60 * 1000));

      // First, create a notification with PENDING status
      const notification = await createTestNotification(
        testWorkflow.id,
        null,
        'PENDING'
      );

      // Poll without includeProcessed to establish a baseline timestamp
      // Use retry mechanism to handle timing issues
      let foundNotification: NotificationRow | undefined;
      for (let i = 0; i < 5; i++) {
        const firstPoll = await testPollingService.pollNotifications({ batchSize: 1000 });
        const filteredFirstPoll = firstPoll.filter(n => n.enterprise_id === testEnterpriseId);
        foundNotification = filteredFirstPoll.find(n => n.id === notification.id);
        if (foundNotification) break;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      expect(foundNotification).toBeDefined();

      // Update the notification to SENT status with a new timestamp
      const newTimestamp = new Date(Date.now() + 1000).toISOString(); // 1 second in future
      await supabase
        .schema('notify')
        .from('ent_notification')
        .update({
          notification_status: 'SENT',
          updated_at: newTimestamp
        })
        .eq('id', notification.id);

      // Small delay to ensure update is persisted
      await new Promise(resolve => setTimeout(resolve, 200));

      // Poll without includeProcessed (default) - should not find SENT notification
      const resultsExcluded = await testPollingService.pollNotifications({ batchSize: 1000 });
      const filteredExcluded = resultsExcluded.filter(n => n.enterprise_id === testEnterpriseId);
      expect(filteredExcluded.find(n => n.id === notification.id)).toBeUndefined();

      // Poll with includeProcessed - should find SENT notification
      // Use retry mechanism to handle timing issues
      let foundIncluded: NotificationRow | undefined;
      for (let i = 0; i < 5; i++) {
        const resultsIncluded = await testPollingService.pollNotifications({
          batchSize: 1000,
          includeProcessed: true
        });
        const filteredIncluded = resultsIncluded.filter(n => n.enterprise_id === testEnterpriseId);
        foundIncluded = filteredIncluded.find(n => n.id === notification.id);
        if (foundIncluded) break;
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      expect(foundIncluded).toBeDefined();
    });
  });

  describe('pollScheduledNotifications', () => {
    let testWorkflow: WorkflowRow;

    beforeEach(async () => {
      // Create a fresh workflow for each test to avoid interference
      testWorkflow = await createTestWorkflow();

      // Create fresh polling service for each test to avoid timestamp issues
      pollingService = new NotificationPollingService(supabase);
      // Reset the polling timestamp to ensure we capture all notifications
      pollingService.resetPollTimestamp(new Date(Date.now() - 25 * 60 * 60 * 1000)); // 25 hours ago
      
      // Verify the timestamp was set
      const state = pollingService.getPollingState();
      console.log('Polling state after reset:', state);
    });

    it('should only return notifications with scheduled_for <= now', async () => {
      // Create notifications with various scheduled times
      const pastNotification = await createTestNotification(
        testWorkflow.id,
        new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
      );
      const futureNotification = await createTestNotification(
        testWorkflow.id,
        new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
      );
      const nullNotification = await createTestNotification(testWorkflow.id, null);

      const found = await waitForNotification(
        pollScheduledNotificationsForTest,
        pastNotification.id
      );

      // Should only find past scheduled notification
      expect(found).toBeDefined();

      // Verify other notifications are not found
      const results = await pollScheduledNotificationsForTest();
      expect(results.find(n => n.id === futureNotification.id)).toBeUndefined();
      expect(results.find(n => n.id === nullNotification.id)).toBeUndefined();
    });

    it('should order by scheduled_for ascending', async () => {
      // Create notifications with different past times
      const older = await createTestNotification(
        testWorkflow.id,
        new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago
      );
      const newer = await createTestNotification(
        testWorkflow.id,
        new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
      );

      const results = await pollScheduledNotificationsForTest();

      const olderIndex = results.findIndex(n => n.id === older.id);
      const newerIndex = results.findIndex(n => n.id === newer.id);

      // Older should come before newer
      expect(olderIndex).not.toBe(-1);
      expect(newerIndex).not.toBe(-1);
      if (olderIndex !== -1 && newerIndex !== -1) {
        expect(olderIndex).toBeLessThan(newerIndex);
      }
    });

    it('should only include PENDING status notifications', async () => {
      const pendingNotification = await createTestNotification(
        testWorkflow.id,
        new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        'PENDING'
      );
      const failedNotification = await createTestNotification(
        testWorkflow.id,
        new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        'FAILED'
      );

      const found = await waitForNotification(
        pollScheduledNotificationsForTest,
        pendingNotification.id
      );
      expect(found).toBeDefined();

      const results = await pollScheduledNotificationsForTest();
      expect(results.find(n => n.id === failedNotification.id)).toBeUndefined();
    });

    it('should handle edge case of scheduled_for exactly at current time', async () => {
      const now = new Date();
      const notification = await createTestNotification(
        testWorkflow.id,
        now.toISOString()
      );

      // Small delay to ensure we're past the scheduled time
      await new Promise(resolve => setTimeout(resolve, 200));

      const found = await waitForNotification(
        pollScheduledNotificationsForTest,
        notification.id
      );

      expect(found).toBeDefined();
    });
  });

  describe('pollFailedNotifications', () => {
    let testWorkflow: WorkflowRow;

    beforeEach(async () => {
      // Create a fresh workflow for each test to avoid interference
      testWorkflow = await createTestWorkflow();

      // Create fresh polling service for each test to avoid timestamp issues
      pollingService = new NotificationPollingService(supabase);
      // Reset the polling timestamp to ensure we capture all notifications
      pollingService.resetPollTimestamp(new Date(Date.now() - 25 * 60 * 60 * 1000)); // 25 hours ago
      
      // Verify the timestamp was set
      const state = pollingService.getPollingState();
      console.log('Polling state after reset:', state);
    });

    it('should include failed notifications regardless of scheduled_for', async () => {
      // Create failed notifications with different scheduled times
      const failedNoSchedule = await createTestNotification(
        testWorkflow.id,
        null,
        'FAILED'
      );
      const failedFutureSchedule = await createTestNotification(
        testWorkflow.id,
        new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        'FAILED'
      );

      // Use waitForNotification to make the test robust
      const foundNoSchedule = await waitForNotification(
        pollFailedNotificationsForTest,
        failedNoSchedule.id
      );
      const foundFutureSchedule = await waitForNotification(
        pollFailedNotificationsForTest,
        failedFutureSchedule.id
      );

      // Both should be included
      expect(foundNoSchedule).toBeDefined();
      expect(foundFutureSchedule).toBeDefined();
    });
  });
});