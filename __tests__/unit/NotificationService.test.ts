import { NotificationService } from '../../app/services/database/NotificationService';
import type { Database } from '../../lib/supabase/database.types';
import { v4 as uuidv4 } from 'uuid';

// Types
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];

// Check for required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
}

describe('NotificationService Unit Tests', () => {
  let service: NotificationService;
  const testEnterpriseId = uuidv4(); // Use proper UUID
  const testUserId = uuidv4(); // Use proper UUID
  let testNotificationIds: number[] = [];
  let testWorkflowId: number | null = null;

  beforeAll(async () => {
    service = new NotificationService();
    // Create a test workflow for notifications
    const { WorkflowService } = await import('../../app/services/database/WorkflowService');
    const workflowService = new WorkflowService();
    const testWorkflow = await workflowService.createWorkflow({
      name: 'Test Notification Workflow',
      workflow_key: 'test-notification-workflow-' + Date.now(),
      workflow_type: 'DYNAMIC',
      default_channels: ['EMAIL'],
      enterprise_id: testEnterpriseId,
      publish_status: 'DRAFT',
      deactivated: false
    });
    testWorkflowId = testWorkflow.id;
  });

  afterAll(async () => {
    // Clean up test data - delete notifications first
    for (const notificationId of testNotificationIds) {
      try {
        await service.cancelNotification(notificationId, testEnterpriseId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Clean up test workflow
    if (testWorkflowId) {
      try {
        const { WorkflowService } = await import('../../app/services/database/WorkflowService');
        const workflowService = new WorkflowService();
        await workflowService.deactivateWorkflow(testWorkflowId, testEnterpriseId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createTestNotificationInsert(overrides: Partial<NotificationInsert> = {}): NotificationInsert {
    return {
      name: 'Test Notification Unit',
      payload: { message: 'Test message' },
      recipients: [testUserId],
      notification_workflow_id: testWorkflowId!,
      enterprise_id: testEnterpriseId,
      ...overrides
    } as NotificationInsert;
  }

  describe('getNotification', () => {
    let createdNotificationId: number;

    beforeAll(async () => {
      // Create a notification for testing retrieval
      const insertData = createTestNotificationInsert({
        name: 'Unit Test Notification',
        payload: { message: 'Unit test message' }
      });
      const created = await service.createNotification(insertData);
      createdNotificationId = created.id;
      testNotificationIds.push(createdNotificationId);
    });

    it('should retrieve notification by ID', async () => {
      const result = await service.getNotification(createdNotificationId, testEnterpriseId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(createdNotificationId);
      expect(result!.name).toBe('Unit Test Notification');
      expect(result!.payload).toEqual({ message: 'Unit test message' });
      expect(result!.recipients).toEqual([testUserId]);
      expect(result!.enterprise_id).toBe(testEnterpriseId);
    });

    it('should throw error when notification not found', async () => {
      await expect(
        service.getNotification(999999, testEnterpriseId)
      ).rejects.toThrow('Failed to get notification');
    });

    it('should throw error when notification belongs to different enterprise', async () => {
      await expect(
        service.getNotification(createdNotificationId, uuidv4())
      ).rejects.toThrow('Failed to get notification');
    });
  });

  describe('createNotification', () => {
    it('should create new notification successfully', async () => {
      const insertData = createTestNotificationInsert({
        name: 'New Unit Test Notification',
        payload: { message: 'New test message' },
        recipients: [uuidv4()]
      });

      const result = await service.createNotification(insertData);
      testNotificationIds.push(result.id);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Unit Test Notification');
      expect(result.payload).toEqual({ message: 'New test message' });
      expect(result.notification_workflow_id).toBe(testWorkflowId);
      expect(result.enterprise_id).toBe(testEnterpriseId);
      expect(result.notification_status).toBe('PENDING');
    });

    it('should handle creation errors for invalid workflow ID', async () => {
      const insertData = createTestNotificationInsert({
        name: 'Invalid Notification',
        notification_workflow_id: 999999
      });

      await expect(
        service.createNotification(insertData)
      ).rejects.toThrow('Failed to create notification');
    });
  });

  describe('updateNotificationStatus', () => {
    let notificationToUpdate: NotificationRow;

    beforeAll(async () => {
      // Create a notification for testing updates
      const insertData = createTestNotificationInsert({
        name: 'Notification for Status Updates'
      });
      notificationToUpdate = await service.createNotification(insertData);
      testNotificationIds.push(notificationToUpdate.id);
    });

    it('should update status successfully', async () => {
      await service.updateNotificationStatus(
        notificationToUpdate.id,
        'PROCESSING',
        testEnterpriseId,
        undefined,
        'txn-123'
      );

      // Verify the status was updated by retrieving the notification
      const updated = await service.getNotification(notificationToUpdate.id, testEnterpriseId);
      expect(updated!.notification_status).toBe('PROCESSING');
      expect(updated!.transaction_id).toBe('txn-123');
    });

    it('should update status with error message', async () => {
      await service.updateNotificationStatus(
        notificationToUpdate.id,
        'FAILED',
        testEnterpriseId,
        'Template rendering failed'
      );

      // Verify the status and error were updated
      const updated = await service.getNotification(notificationToUpdate.id, testEnterpriseId);
      expect(updated!.notification_status).toBe('FAILED');
      expect(updated!.error_details).toBe('Template rendering failed');
    });

    it('should silently succeed when updating non-existent notification', async () => {
      // Supabase updates don't throw errors for non-matching rows
      await expect(
        service.updateNotificationStatus(999999, 'SENT', testEnterpriseId)
      ).resolves.not.toThrow();
    });
  });

  describe('cancelNotification', () => {
    it('should cancel notification by setting status to RETRACTED', async () => {
      // Create a fresh notification for this test to avoid interference
      const insertData = createTestNotificationInsert({
        name: `Notification for Cancellation ${Date.now()}`,
        publish_status: 'DRAFT' // Set to DRAFT to avoid processing by polling systems
      });
      const notificationToCancel = await service.createNotification(insertData);
      testNotificationIds.push(notificationToCancel.id);
      
      // Verify the notification exists and is in expected state
      const beforeCancel = await service.getNotification(notificationToCancel.id, testEnterpriseId);
      expect(beforeCancel).toBeDefined();
      
      await service.cancelNotification(notificationToCancel.id, testEnterpriseId);

      // Verify the status was updated to RETRACTED
      const cancelled = await service.getNotification(notificationToCancel.id, testEnterpriseId);
      expect(cancelled!.notification_status).toBe('RETRACTED');
    });

    it('should silently succeed when cancelling non-existent notification', async () => {
      // Supabase updates don't throw errors for non-matching rows
      await expect(
        service.cancelNotification(999999, testEnterpriseId)
      ).resolves.not.toThrow();
    });
  });

  describe('getNotificationsByStatus', () => {
    let pendingNotifications: NotificationRow[] = [];

    beforeAll(async () => {
      // Create notifications with specific status for testing
      const notification1 = await service.createNotification(createTestNotificationInsert({
        name: 'Pending Notification 1'
      }));
      const notification2 = await service.createNotification(createTestNotificationInsert({
        name: 'Pending Notification 2'
      }));
      
      pendingNotifications.push(notification1, notification2);
      testNotificationIds.push(notification1.id, notification2.id);
    });

    it('should retrieve notifications by status', async () => {
      const result = await service.getNotificationsByStatus('PENDING', testEnterpriseId, 10);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every(n => n.notification_status === 'PENDING')).toBe(true);
      expect(result.every(n => n.enterprise_id === testEnterpriseId)).toBe(true);
      
      // Check that at least one of our test notifications is included
      const testNotificationNames = result.map(n => n.name);
      const hasTestNotification = testNotificationNames.some(name => 
        name === 'Pending Notification 1' || name === 'Pending Notification 2'
      );
      expect(hasTestNotification).toBe(true);
    });

    it('should return empty array when no notifications match status', async () => {
      // Use a different enterprise ID that has no notifications
      const emptyEnterpriseId = uuidv4();
      const result = await service.getNotificationsByStatus('PENDING', emptyEnterpriseId, 10);
      expect(result).toEqual([]);
    });
  });

  describe('getNotificationsByWorkflow', () => {
    let workflowNotifications: NotificationRow[] = [];

    beforeAll(async () => {
      // Create notifications for the test workflow
      const notification1 = await service.createNotification(createTestNotificationInsert({
        name: 'Workflow Notification 1'
      }));
      const notification2 = await service.createNotification(createTestNotificationInsert({
        name: 'Workflow Notification 2'
      }));
      
      // Update one to SENT status for variety
      await service.updateNotificationStatus(notification1.id, 'SENT', testEnterpriseId);
      
      workflowNotifications.push(notification1, notification2);
      testNotificationIds.push(notification1.id, notification2.id);
    });

    it('should retrieve notifications for specific workflow', async () => {
      const result = await service.getNotificationsByWorkflow(testWorkflowId!, testEnterpriseId, 50);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every(n => n.notification_workflow_id === testWorkflowId)).toBe(true);
      expect(result.every(n => n.enterprise_id === testEnterpriseId)).toBe(true);
      
      // Check that our test notifications are included
      const testNotificationNames = result.map(n => n.name);
      expect(testNotificationNames).toContain('Workflow Notification 1');
      expect(testNotificationNames).toContain('Workflow Notification 2');
    });

    it('should return empty array when no notifications exist for workflow', async () => {
      const result = await service.getNotificationsByWorkflow(999999, testEnterpriseId, 10);
      expect(result).toEqual([]);
    });
  });
});