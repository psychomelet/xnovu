import { NotificationPollingService } from '@/app/services/database/NotificationPollingService';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { randomUUID } from 'crypto';

// Types
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type SupabaseClient = ReturnType<typeof createClient<Database>>;

describe('NotificationPollingService Scheduled Notification Integration Tests', () => {
  let supabase: SupabaseClient;
  let pollingService: NotificationPollingService;
  const testEnterpriseId = randomUUID();
  const createdNotificationIds: number[] = [];
  const createdWorkflowIds: number[] = [];

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

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-polling-scheduled' } }
    });

    pollingService = new NotificationPollingService(supabase);
  });

  afterAll(async () => {
    // Clean up test data
    for (const notificationId of createdNotificationIds) {
      try {
        await supabase
          .schema('notify')
          .from('ent_notification')
          .delete()
          .eq('id', notificationId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    for (const workflowId of createdWorkflowIds) {
      try {
        await supabase
          .schema('notify')
          .from('ent_notification_workflow')
          .delete()
          .eq('id', workflowId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  async function createTestWorkflow(): Promise<WorkflowRow> {
    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .insert({
        name: 'Test Polling Workflow',
        workflow_key: `test-polling-workflow-${Date.now()}`,
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
    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .insert({
        name: `Test Polling Notification ${Date.now()}`,
        payload: { test: true },
        recipients: ['test-user-1'],
        notification_workflow_id: workflowId,
        publish_status: 'PUBLISH',
        notification_status: status,
        enterprise_id: testEnterpriseId,
        scheduled_for: scheduledFor,
      } satisfies NotificationInsert)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create test notification: ${error?.message}`);
    }

    createdNotificationIds.push(data.id);
    return data;
  }

  describe('pollNotifications with scheduled_for filtering', () => {
    let testWorkflow: WorkflowRow;

    beforeAll(async () => {
      testWorkflow = await createTestWorkflow();
    });

    it('should include notifications without scheduled_for', async () => {
      const notification = await createTestNotification(testWorkflow.id, null);

      const results = await pollingService.pollNotifications({ batchSize: 10 });

      const found = results.find(n => n.id === notification.id);
      expect(found).toBeDefined();
    });

    it('should include notifications with past scheduled_for', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const notification = await createTestNotification(
        testWorkflow.id,
        pastDate.toISOString()
      );

      const results = await pollingService.pollNotifications({ batchSize: 10 });

      const found = results.find(n => n.id === notification.id);
      expect(found).toBeDefined();
    });

    it('should exclude notifications with future scheduled_for', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const notification = await createTestNotification(
        testWorkflow.id,
        futureDate.toISOString()
      );

      const results = await pollingService.pollNotifications({ batchSize: 10 });

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

      const results = await pollingService.pollNotifications({ batchSize: 20 });

      // Should find null and past, but not future
      expect(results.find(n => n.id === nullScheduled.id)).toBeDefined();
      expect(results.find(n => n.id === pastScheduled.id)).toBeDefined();
      expect(results.find(n => n.id === futureScheduled.id)).toBeUndefined();
    });

    it('should respect includeProcessed option with scheduled_for filter', async () => {
      const sentNotification = await createTestNotification(
        testWorkflow.id,
        null,
        'SENT'
      );

      // Without includeProcessed (default)
      const resultsExcluded = await pollingService.pollNotifications({ batchSize: 10 });
      expect(resultsExcluded.find(n => n.id === sentNotification.id)).toBeUndefined();

      // With includeProcessed
      const resultsIncluded = await pollingService.pollNotifications({ 
        batchSize: 10,
        includeProcessed: true 
      });
      expect(resultsIncluded.find(n => n.id === sentNotification.id)).toBeDefined();
    });
  });

  describe('pollScheduledNotifications', () => {
    let testWorkflow: WorkflowRow;

    beforeAll(async () => {
      testWorkflow = await createTestWorkflow();
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

      const results = await pollingService.pollScheduledNotifications({ batchSize: 20 });

      // Should only find past scheduled notification
      expect(results.find(n => n.id === pastNotification.id)).toBeDefined();
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

      const results = await pollingService.pollScheduledNotifications({ batchSize: 20 });

      const olderIndex = results.findIndex(n => n.id === older.id);
      const newerIndex = results.findIndex(n => n.id === newer.id);

      // Older should come before newer
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

      const results = await pollingService.pollScheduledNotifications({ batchSize: 20 });

      expect(results.find(n => n.id === pendingNotification.id)).toBeDefined();
      expect(results.find(n => n.id === failedNotification.id)).toBeUndefined();
    });

    it('should handle edge case of scheduled_for exactly at current time', async () => {
      const now = new Date();
      const notification = await createTestNotification(
        testWorkflow.id,
        now.toISOString()
      );

      // Small delay to ensure we're past the scheduled time
      await new Promise(resolve => setTimeout(resolve, 100));

      const results = await pollingService.pollScheduledNotifications({ batchSize: 10 });

      expect(results.find(n => n.id === notification.id)).toBeDefined();
    });
  });

  describe('pollFailedNotifications', () => {
    let testWorkflow: WorkflowRow;

    beforeAll(async () => {
      testWorkflow = await createTestWorkflow();
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

      const results = await pollingService.pollFailedNotifications({ batchSize: 10 });

      // Both should be included
      expect(results.find(n => n.id === failedNoSchedule.id)).toBeDefined();
      expect(results.find(n => n.id === failedFutureSchedule.id)).toBeDefined();
    });
  });
});