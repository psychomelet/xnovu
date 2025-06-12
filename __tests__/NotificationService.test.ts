import { NotificationService } from '../app/services/database/NotificationService';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/supabase/database.types';
import { randomUUID } from 'crypto';

// Types
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];
type NotificationUpdate = Database['notify']['Tables']['ent_notification']['Update'];
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type SupabaseClient = ReturnType<typeof createClient<Database>>;

describe('NotificationService with Real Database', () => {
  let service: NotificationService;
  let supabase: SupabaseClient;
  const testEnterpriseId = randomUUID();
  const testUserId = randomUUID();
  const createdNotificationIds: number[] = [];
  const createdWorkflowIds: number[] = [];

  // Check if we have real credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
  const hasRealCredentials = supabaseUrl && 
    supabaseServiceKey && 
    supabaseUrl.includes('supabase.co') && 
    supabaseServiceKey.length > 50;

  beforeAll(async () => {
    if (!hasRealCredentials) {
      throw new Error('Real Supabase credentials required for NotificationService tests. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-notification-service' } }
    });
    
    service = new NotificationService();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
  });

  async function cleanupTestData() {
    if (!hasRealCredentials) return;
    
    try {
      // Delete test notifications
      if (createdNotificationIds.length > 0) {
        await supabase
          .schema('notify')
          .from('ent_notification')
          .delete()
          .in('id', createdNotificationIds);
        createdNotificationIds.length = 0;
      }

      // Delete test workflows
      if (createdWorkflowIds.length > 0) {
        await supabase
          .schema('notify')
          .from('ent_notification_workflow')
          .delete()
          .in('id', createdWorkflowIds);
        createdWorkflowIds.length = 0;
      }
      
      // Delete by exact enterprise ID
      await supabase
        .schema('notify')
        .from('ent_notification')
        .delete()
        .eq('enterprise_id', testEnterpriseId);

      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('enterprise_id', testEnterpriseId);
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }

  async function createTestWorkflow(overrides: Partial<WorkflowInsert> = {}): Promise<WorkflowRow> {
    const defaultWorkflow: WorkflowInsert = {
      name: 'Test Workflow',
      workflow_key: `test-workflow-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      workflow_type: 'DYNAMIC',
      default_channels: ['EMAIL'],
      enterprise_id: testEnterpriseId,
      ...overrides
    };

    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .insert(defaultWorkflow)
      .select()
      .single();

    if (error) throw error;
    if (data) createdWorkflowIds.push(data.id);
    return data!;
  }

  async function createTestNotification(overrides: Partial<NotificationInsert> = {}): Promise<NotificationRow> {
    // Create a workflow first if not provided
    let workflowId = overrides.notification_workflow_id;
    if (!workflowId) {
      const workflow = await createTestWorkflow();
      workflowId = workflow.id;
    }

    const defaultNotification: NotificationInsert = {
      name: 'Test Notification',
      payload: { message: 'Test message' },
      recipients: ['user-123'],
      notification_workflow_id: workflowId,
      enterprise_id: testEnterpriseId,
      ...overrides
    };

    const { data, error } = await supabase
      .schema('notify')
      .from('ent_notification')
      .insert(defaultNotification)
      .select()
      .single();

    if (error) throw error;
    if (data) createdNotificationIds.push(data.id);
    return data!;
  }

  describe('getNotification', () => {
    it('should retrieve notification with relationships', async () => {
      // Create test notification
      const testNotification = await createTestNotification({
        name: 'Test Notification',
        payload: { message: 'Test message' },
        recipients: [testUserId],
        notification_status: 'PENDING'
      });

      const result = await service.getNotification(testNotification.id, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(testNotification.id);
      expect(result!.name).toBe('Test Notification');
      expect(result!.payload).toEqual({ message: 'Test message' });
      expect(result!.recipients).toEqual([testUserId]);
      expect(result!.notification_status).toBe('PENDING');
      expect(result!.enterprise_id).toBe(testEnterpriseId);
    });

    it('should return null when notification not found', async () => {
      const result = await service.getNotification(999999, testEnterpriseId);
      expect(result).toBeNull();
    });

    it('should return null when notification belongs to different enterprise', async () => {
      // Create notification for different enterprise
      const otherEnterpriseNotification = await createTestNotification({
        enterprise_id: 'other-enterprise-id'
      });

      const result = await service.getNotification(otherEnterpriseNotification.id, testEnterpriseId);
      expect(result).toBeNull();

      // Clean up additional notification
      await supabase
        .schema('notify')
        .from('ent_notification')
        .delete()
        .eq('id', otherEnterpriseNotification.id);
    });

    it('should handle database errors', async () => {
      // Try to get notification with invalid enterprise ID format that might cause DB error
      await expect(
        service.getNotification(1, '')
      ).rejects.toThrow();
    });
  });

  describe('createNotification', () => {
    it('should create new notification successfully', async () => {
      // Create workflow first
      const testWorkflow = await createTestWorkflow();

      const insertData: NotificationInsert = {
        name: 'New Notification',
        payload: { message: 'Test message' },
        recipients: ['user-456'],
        notification_workflow_id: testWorkflow.id,
        enterprise_id: testEnterpriseId
      };

      const result = await service.createNotification(insertData);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Notification');
      expect(result.payload).toEqual({ message: 'Test message' });
      expect(result.recipients).toEqual(['user-456']);
      expect(result.notification_workflow_id).toBe(testWorkflow.id);
      expect(result.enterprise_id).toBe(testEnterpriseId);
      expect(result.notification_status).toBe('PENDING'); // Default status
      
      // Track for cleanup
      createdNotificationIds.push(result.id);
    });

    it('should handle creation errors for invalid workflow ID', async () => {
      const insertData: NotificationInsert = {
        name: 'Invalid Notification',
        payload: {},
        recipients: [],
        notification_workflow_id: 999999, // Invalid workflow ID
        enterprise_id: testEnterpriseId
      };

      await expect(
        service.createNotification(insertData)
      ).rejects.toThrow();
    });
  });

  describe('updateNotificationStatus', () => {
    it('should update status successfully', async () => {
      // Create test notification
      const testNotification = await createTestNotification({
        notification_status: 'PENDING'
      });

      await service.updateNotificationStatus(
        testNotification.id,
        'PROCESSING',
        testEnterpriseId,
        undefined,
        'txn-123'
      );

      // Verify the update
      const updated = await service.getNotification(testNotification.id, testEnterpriseId);
      expect(updated).toBeDefined();
      expect(updated!.notification_status).toBe('PROCESSING');
      expect(updated!.transaction_id).toBe('txn-123');
    });

    it('should update status with error message', async () => {
      // Create test notification
      const testNotification = await createTestNotification({
        notification_status: 'PENDING'
      });

      await service.updateNotificationStatus(
        testNotification.id,
        'FAILED',
        testEnterpriseId,
        'Template rendering failed'
      );

      // Verify the update
      const updated = await service.getNotification(testNotification.id, testEnterpriseId);
      expect(updated).toBeDefined();
      expect(updated!.notification_status).toBe('FAILED');
      expect(updated!.error_details).toBe('Template rendering failed');
    });

    it('should handle update errors for non-existent notification', async () => {
      await expect(
        service.updateNotificationStatus(999999, 'SENT', testEnterpriseId)
      ).rejects.toThrow();
    });

    it('should handle update errors for different enterprise', async () => {
      // Create notification for different enterprise
      const otherNotification = await createTestNotification({
        enterprise_id: 'other-enterprise-id'
      });

      await expect(
        service.updateNotificationStatus(otherNotification.id, 'SENT', testEnterpriseId)
      ).rejects.toThrow();

      // Clean up additional notification
      await supabase
        .schema('notify')
        .from('ent_notification')
        .delete()
        .eq('id', otherNotification.id);
    });
  });

  describe('getNotificationsByStatus', () => {
    it('should retrieve notifications by status', async () => {
      // Create notifications with different statuses
      const pendingNotification1 = await createTestNotification({
        name: 'Pending Notification 1',
        notification_status: 'PENDING'
      });

      const pendingNotification2 = await createTestNotification({
        name: 'Pending Notification 2',
        notification_status: 'PENDING'
      });

      const sentNotification = await createTestNotification({
        name: 'Sent Notification',
        notification_status: 'SENT'
      });

      const result = await service.getNotificationsByStatus('PENDING', testEnterpriseId, 10);

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(result.every(n => n.notification_status === 'PENDING')).toBe(true);
      expect(result.every(n => n.enterprise_id === testEnterpriseId)).toBe(true);
      
      const resultIds = result.map(n => n.id).sort();
      const expectedIds = [pendingNotification1.id, pendingNotification2.id].sort();
      expect(resultIds).toEqual(expectedIds);
    });

    it('should use default limit when not specified', async () => {
      // Create a notification
      await createTestNotification({
        notification_status: 'SENT'
      });

      const result = await service.getNotificationsByStatus('SENT', testEnterpriseId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Default limit is 100, but we only have 1 notification
      expect(result.length).toBe(1);
    });

    it('should return empty array when no notifications match status', async () => {
      const result = await service.getNotificationsByStatus('RETRACTED', testEnterpriseId, 10);
      expect(result).toEqual([]);
    });
  });

  describe('cancelNotification', () => {
    it('should cancel notification by setting status to RETRACTED', async () => {
      // Create test notification
      const testNotification = await createTestNotification({
        notification_status: 'PENDING'
      });

      await service.cancelNotification(testNotification.id, testEnterpriseId);

      // Verify the update
      const updated = await service.getNotification(testNotification.id, testEnterpriseId);
      expect(updated).toBeDefined();
      expect(updated!.notification_status).toBe('RETRACTED');
    });

    it('should handle cancellation errors for non-existent notification', async () => {
      await expect(
        service.cancelNotification(999999, testEnterpriseId)
      ).rejects.toThrow();
    });

    it('should handle cancellation errors for different enterprise', async () => {
      // Create notification for different enterprise
      const otherNotification = await createTestNotification({
        enterprise_id: 'other-enterprise-id'
      });

      await expect(
        service.cancelNotification(otherNotification.id, testEnterpriseId)
      ).rejects.toThrow();

      // Clean up additional notification
      await supabase
        .schema('notify')
        .from('ent_notification')
        .delete()
        .eq('id', otherNotification.id);
    });
  });

  describe('getNotificationsByWorkflow', () => {
    it('should retrieve notifications for specific workflow', async () => {
      // Create workflow
      const testWorkflow = await createTestWorkflow();

      // Create notifications for this workflow
      const notification1 = await createTestNotification({
        name: 'Workflow Notification 1',
        notification_workflow_id: testWorkflow.id,
        notification_status: 'SENT',
        transaction_id: 'txn-123'
      });

      const notification2 = await createTestNotification({
        name: 'Workflow Notification 2',
        notification_workflow_id: testWorkflow.id,
        notification_status: 'PENDING'
      });

      // Create notification for different workflow
      const otherWorkflow = await createTestWorkflow();
      await createTestNotification({
        name: 'Other Workflow Notification',
        notification_workflow_id: otherWorkflow.id
      });

      const result = await service.getNotificationsByWorkflow(testWorkflow.id, testEnterpriseId, 50);

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(result.every(n => n.notification_workflow_id === testWorkflow.id)).toBe(true);
      expect(result.every(n => n.enterprise_id === testEnterpriseId)).toBe(true);
      
      const resultIds = result.map(n => n.id).sort();
      const expectedIds = [notification1.id, notification2.id].sort();
      expect(resultIds).toEqual(expectedIds);
    });

    it('should return empty array when no notifications exist for workflow', async () => {
      // Create workflow without notifications
      const emptyWorkflow = await createTestWorkflow();

      const result = await service.getNotificationsByWorkflow(emptyWorkflow.id, testEnterpriseId, 10);
      expect(result).toEqual([]);
    });
  });

  // Additional integration tests for enterprise isolation
  describe('Enterprise Isolation', () => {
    it('should maintain enterprise isolation for notification access', async () => {
      const otherEnterpriseId = `other-enterprise-${Date.now()}`;
      
      // Create notifications for different enterprises
      const testEnterpriseNotification = await createTestNotification({
        name: 'Test Enterprise Notification',
        enterprise_id: testEnterpriseId
      });
      
      const otherEnterpriseNotification = await createTestNotification({
        name: 'Other Enterprise Notification',
        enterprise_id: otherEnterpriseId
      });

      // Each enterprise should only see their own notifications
      const testResult = await service.getNotification(testEnterpriseNotification.id, testEnterpriseId);
      const otherResult = await service.getNotification(otherEnterpriseNotification.id, testEnterpriseId);

      expect(testResult).toBeDefined();
      expect(testResult!.name).toBe('Test Enterprise Notification');
      expect(otherResult).toBeNull(); // Should not see other enterprise's notification
      
      // Clean up additional notification
      await supabase
        .schema('notify')
        .from('ent_notification')
        .delete()
        .eq('id', otherEnterpriseNotification.id);
    });

    it('should isolate getNotificationsByStatus by enterprise', async () => {
      const otherEnterpriseId = `other-enterprise-${Date.now()}`;
      
      // Create notifications for test enterprise
      await createTestNotification({
        name: 'Test Enterprise Pending 1',
        notification_status: 'PENDING',
        enterprise_id: testEnterpriseId
      });
      
      await createTestNotification({
        name: 'Test Enterprise Pending 2',
        notification_status: 'PENDING',
        enterprise_id: testEnterpriseId
      });
      
      // Create notification for other enterprise
      const otherNotification = await createTestNotification({
        name: 'Other Enterprise Pending',
        notification_status: 'PENDING',
        enterprise_id: otherEnterpriseId
      });

      const testEnterpriseNotifications = await service.getNotificationsByStatus('PENDING', testEnterpriseId);
      const otherEnterpriseNotifications = await service.getNotificationsByStatus('PENDING', otherEnterpriseId);

      // Verify test enterprise sees at least 2 notifications
      expect(testEnterpriseNotifications.length).toBeGreaterThanOrEqual(2);
      expect(testEnterpriseNotifications.every(n => n.enterprise_id === testEnterpriseId)).toBe(true);

      // Verify other enterprise sees exactly 1 notification
      expect(otherEnterpriseNotifications.length).toBe(1);
      expect(otherEnterpriseNotifications[0].enterprise_id).toBe(otherEnterpriseId);

      // Verify no cross-contamination
      const testEnterpriseIds = testEnterpriseNotifications.map(n => n.id);
      const otherEnterpriseIds = otherEnterpriseNotifications.map(n => n.id);
      const intersection = testEnterpriseIds.filter(id => otherEnterpriseIds.includes(id));
      expect(intersection).toEqual([]);
      
      // Clean up additional notification
      await supabase
        .schema('notify')
        .from('ent_notification')
        .delete()
        .eq('id', otherNotification.id);
    });
  });
});