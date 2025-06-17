import { POST, GET } from '@/app/api/trigger-async/route';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { randomUUID } from 'crypto';

// Types
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type SupabaseClient = ReturnType<typeof createClient<Database>>;

describe('Async Trigger API Scheduled Notification Integration Tests', () => {
  let supabase: SupabaseClient;
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
      global: { headers: { 'x-application-name': 'xnovu-test-async-trigger-scheduled' } }
    });
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
        name: 'Test Scheduled Workflow',
        workflow_key: `test-scheduled-workflow-${Date.now()}`,
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
    scheduledFor: string | null = null
  ): Promise<NotificationRow> {
    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .insert({
        name: `Test Scheduled Notification ${Date.now()}`,
        payload: { test: true, timestamp: new Date().toISOString() },
        recipients: ['test-user-1'],
        notification_workflow_id: workflowId,
        publish_status: 'PUBLISH',
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

  describe('POST /api/trigger-async with scheduled notifications', () => {
    let testWorkflow: WorkflowRow;

    beforeAll(async () => {
      testWorkflow = await createTestWorkflow();
    });

    it('should trigger immediately for notification without scheduled_for', async () => {
      const notification = await createTestNotification(testWorkflow.id);

      const request = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notification.id,
          async: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.async).toBe(true);
      expect(data.workflowId).toBeDefined();
      expect(data.runId).toBeDefined();
      expect(data.scheduledFor).toBeUndefined();
      expect(data.startDelay).toBeUndefined();
      expect(data.message).toContain('queued for async processing');
    });

    it('should trigger immediately for notification with past scheduled_for', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const notification = await createTestNotification(
        testWorkflow.id,
        pastDate.toISOString()
      );

      const request = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notification.id,
          async: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.scheduledFor).toBe(pastDate.toISOString());
      expect(data.startDelay).toBeUndefined();
      expect(data.message).toContain('queued for async processing');
    });

    it('should schedule with delay for future scheduled_for', async () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      const notification = await createTestNotification(
        testWorkflow.id,
        futureDate.toISOString()
      );

      const request = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notification.id,
          async: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.scheduledFor).toBe(futureDate.toISOString());
      expect(data.startDelay).toBeDefined();
      expect(data.startDelay).toBeGreaterThan(0);
      expect(data.startDelay).toBeLessThanOrEqual(5 * 60 * 1000);
      expect(data.message).toContain('scheduled for');
      expect(data.message).toContain(futureDate.toISOString());
    });

    it('should fail sync trigger for future scheduled notification', async () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const notification = await createTestNotification(
        testWorkflow.id,
        futureDate.toISOString()
      );

      const request = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notification.id,
          async: false, // Sync mode
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.async).toBe(false);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Notification scheduled for');
      expect(data.status).toBe('SCHEDULED');
    });

    it('should handle very short delays correctly', async () => {
      const nearFutureDate = new Date(Date.now() + 10 * 1000); // 10 seconds from now
      const notification = await createTestNotification(
        testWorkflow.id,
        nearFutureDate.toISOString()
      );

      const request = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notification.id,
          async: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.startDelay).toBeGreaterThan(0);
      expect(data.startDelay).toBeLessThanOrEqual(10 * 1000);
    });

    it('should handle missing notificationId', async () => {
      const request = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          async: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('notificationId or notificationIds is required');
    });

    it('should handle non-existent notification', async () => {
      const request = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: 999999999,
          async: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/trigger-async workflow status', () => {
    it('should return workflow status', async () => {
      // First create and trigger a notification
      const testWorkflow = await createTestWorkflow();
      const notification = await createTestNotification(testWorkflow.id);

      const triggerRequest = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notification.id,
          async: true,
        }),
      });

      const triggerResponse = await POST(triggerRequest);
      const triggerData = await triggerResponse.json();

      expect(triggerData.workflowId).toBeDefined();

      // Now check the workflow status
      const statusRequest = new NextRequest(
        `http://localhost:3000/api/trigger-async?workflowId=${triggerData.workflowId}`,
        { method: 'GET' }
      );

      const statusResponse = await GET(statusRequest);
      const statusData = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusData.workflowId).toBe(triggerData.workflowId);
      expect(statusData.status).toBeDefined();
      expect(statusData.historyLength).toBeDefined();
      expect(statusData.isRunning).toBeDefined();
    });

    it('should handle missing workflowId', async () => {
      const request = new NextRequest('http://localhost:3000/api/trigger-async', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('workflowId is required');
    });
  });
});