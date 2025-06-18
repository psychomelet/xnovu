import { triggerNotificationById } from '@/lib/notifications/trigger';
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

describe('Trigger Scheduled Notification Integration Tests', () => {
  let supabase: SupabaseClient;
  let testEnterpriseId: string;
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

    // Get shared test enterprise ID
    testEnterpriseId = getTestEnterpriseId();

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-trigger-scheduled' } }
    });
  });

  afterAll(async () => {
    // Cleanup handled by global teardown
    // Just clear tracking arrays
    createdNotificationIds.length = 0;
    createdWorkflowIds.length = 0;
  });

  async function createTestWorkflow(): Promise<WorkflowRow> {
    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .insert({
        name: 'Test Scheduled Workflow Integration',
        workflow_key: 'default-email',
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
    publishStatus: 'PUBLISH' | 'DRAFT' = 'PUBLISH'
  ): Promise<NotificationRow> {
    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .insert({
        name: `Test Scheduled Notification Integration ${Date.now()}`,
        payload: { test: true, timestamp: new Date().toISOString() },
        recipients: [randomUUID()],
        notification_workflow_id: workflowId,
        publish_status: publishStatus,
        notification_status: 'PENDING',
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

  describe('triggerNotificationById with scheduled_for', () => {
    let testWorkflow: WorkflowRow;

    beforeAll(async () => {
      testWorkflow = await createTestWorkflow();
    });

    it('should process notification immediately when scheduled_for is null', async () => {
      const notification = await createTestNotification(testWorkflow.id, null);

      const result = await triggerNotificationById(notification.id);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe('SENT');
      expect(result.notificationId).toBe(notification.id);
    });

    it('should process notification immediately when scheduled_for is in the past', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const notification = await createTestNotification(
        testWorkflow.id,
        pastDate.toISOString()
      );

      const result = await triggerNotificationById(notification.id);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe('SENT');
    });

    it('should reject notification when scheduled_for is in the future', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const notification = await createTestNotification(
        testWorkflow.id,
        futureDate.toISOString()
      );

      const result = await triggerNotificationById(notification.id);

      expect(result.success).toBe(false);
      expect(result.status).toBe('SCHEDULED');
      expect(result.error).toContain('Notification scheduled for');
      expect(result.error).toContain(futureDate.toISOString());
      expect(result.notificationId).toBe(notification.id);
      expect(result.notification).toBeDefined();
    });

    it('should handle edge case where scheduled_for is exactly now', async () => {
      // Create with current time - should process since it's not in the future
      const now = new Date();
      const notification = await createTestNotification(
        testWorkflow.id,
        now.toISOString()
      );

      const result = await triggerNotificationById(notification.id);

      // Should process since scheduled time is not strictly in the future
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle very near future (1 second)', async () => {
      const nearFuture = new Date(Date.now() + 1000); // 1 second from now
      const notification = await createTestNotification(
        testWorkflow.id,
        nearFuture.toISOString()
      );

      const result = await triggerNotificationById(notification.id);

      // Should reject since it's in the future
      expect(result.success).toBe(false);
      expect(result.status).toBe('SCHEDULED');
      expect(result.error).toContain('Notification scheduled for');
    });

    it('should return error when notification is not published', async () => {
      const notification = await createTestNotification(
        testWorkflow.id,
        null,
        'DRAFT'
      );

      const result = await triggerNotificationById(notification.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Notification is not published');
      expect(result.notification).toBeDefined();
    });

    it('should handle non-existent notification', async () => {
      const result = await triggerNotificationById(999999999);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should verify notification status is not updated for future scheduled', async () => {
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
      const notification = await createTestNotification(
        testWorkflow.id,
        futureDate.toISOString()
      );

      // Trigger should fail
      const result = await triggerNotificationById(notification.id);
      expect(result.success).toBe(false);

      // Verify notification status remains PENDING
      const { data: updatedNotification } = await supabase
        .schema('notify')
        .from('ent_notification')
        .select('notification_status')
        .eq('id', notification.id)
        .single();

      expect(updatedNotification?.notification_status).toBe('PENDING');
    });
  });
});