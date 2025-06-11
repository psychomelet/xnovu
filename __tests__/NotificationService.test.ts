import { NotificationService } from '../app/services/database/NotificationService';
import type { Database } from '../lib/supabase/database.types';

// Types
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];

// Mock Supabase client with proper factory pattern
jest.mock('../lib/supabase/client', () => {
  const mock = {
    schema: jest.fn(() => mock),
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    insert: jest.fn(() => mock),
    update: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    single: jest.fn(),
    limit: jest.fn(() => mock),
    order: jest.fn(() => mock)
  };
  return {
    supabase: mock
  };
});

describe('NotificationService', () => {
  let service: NotificationService;
  let mockSupabase: any;
  const mockEnterpriseId = 'test-enterprise-123';

  beforeEach(() => {
    jest.clearAllMocks();
    // Get fresh mock instance
    mockSupabase = require('../lib/supabase/client').supabase;
    service = new NotificationService();
  });

  describe('getNotification', () => {
    it('should retrieve notification with relationships', async () => {
      const mockNotification: NotificationRow = {
        id: 1,
        name: 'Test Notification',
        payload: { message: 'Test message' },
        recipients: ['user-123'],
        notification_status: 'PENDING',
        notification_workflow_id: 1,
        enterprise_id: mockEnterpriseId,
        transaction_id: null,
        error_details: null,
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        overrides: null,
        typ_notification_category_id: null,
        typ_notification_priority_id: null
      };

      mockSupabase.single.mockResolvedValue({
        data: mockNotification,
        error: null
      });

      const result = await service.getNotification(1, mockEnterpriseId);

      expect(mockSupabase.schema).toHaveBeenCalledWith('notify');
      expect(mockSupabase.from).toHaveBeenCalledWith('ent_notification');
      expect(mockSupabase.select).toHaveBeenCalledWith(`
        *,
        ent_notification_workflow!inner(*),
        typ_notification_category(*),
        typ_notification_priority(*)
      `);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 1);
      expect(mockSupabase.eq).toHaveBeenCalledWith('enterprise_id', mockEnterpriseId);
      expect(result).toEqual(mockNotification);
    });

    it('should return null when notification not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null // Return null data without error for not found case
      });

      const result = await service.getNotification(999, mockEnterpriseId);
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed')
      });

      await expect(
        service.getNotification(1, mockEnterpriseId)
      ).rejects.toThrow('Failed to get notification: Database connection failed');
    });
  });

  describe('createNotification', () => {
    it('should create new notification successfully', async () => {
      const insertData: NotificationInsert = {
        name: 'New Notification',
        payload: { message: 'Test message' },
        recipients: ['user-456'],
        notification_workflow_id: 1,
        enterprise_id: mockEnterpriseId
      };

      const createdNotification: NotificationRow = {
        id: 2,
        ...insertData,
        notification_status: 'PENDING',
        transaction_id: null,
        error_details: null,
        created_at: new Date().toISOString(),
        created_by: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
        overrides: null,
        typ_notification_category_id: null,
        typ_notification_priority_id: null
      };

      mockSupabase.single.mockResolvedValue({
        data: createdNotification,
        error: null
      });

      const result = await service.createNotification(insertData);

      expect(mockSupabase.schema).toHaveBeenCalledWith('notify');
      expect(mockSupabase.from).toHaveBeenCalledWith('ent_notification');
      expect(mockSupabase.insert).toHaveBeenCalledWith(insertData);
      expect(result).toEqual(createdNotification);
    });

    it('should handle creation errors', async () => {
      const insertData: NotificationInsert = {
        name: 'Invalid Notification',
        payload: {},
        recipients: [],
        notification_workflow_id: 999, // Invalid workflow ID
        enterprise_id: mockEnterpriseId
      };

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Foreign key constraint violation')
      });

      await expect(
        service.createNotification(insertData)
      ).rejects.toThrow('Failed to create notification: Foreign key constraint violation');
    });
  });

  describe('updateNotificationStatus', () => {
    it('should update status successfully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: 1 },
        error: null
      });

      await service.updateNotificationStatus(
        1,
        'PROCESSING',
        mockEnterpriseId,
        undefined,
        'txn-123'
      );

      expect(mockSupabase.schema).toHaveBeenCalledWith('notify');
      expect(mockSupabase.from).toHaveBeenCalledWith('ent_notification');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        notification_status: 'PROCESSING',
        transaction_id: 'txn-123',
        updated_at: expect.any(String)
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 1);
      expect(mockSupabase.eq).toHaveBeenCalledWith('enterprise_id', mockEnterpriseId);
    });

    it('should update status with error message', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: 1 },
        error: null
      });

      await service.updateNotificationStatus(
        1,
        'FAILED',
        mockEnterpriseId,
        'Template rendering failed'
      );

      expect(mockSupabase.update).toHaveBeenCalledWith({
        notification_status: 'FAILED',
        error_details: 'Template rendering failed',
        updated_at: expect.any(String)
      });
    });

    it('should handle update errors', async () => {
      // Mock the entire chain to return an error
      const mockChain = {
        schema: jest.fn(() => mockChain),
        from: jest.fn(() => mockChain),
        update: jest.fn(() => mockChain),
        eq: jest.fn()
      };
      
      // The first .eq() call returns the chain, the second returns a promise with error
      mockChain.eq
        .mockReturnValueOnce(mockChain) // First .eq('id', id) returns chain
        .mockResolvedValueOnce({ // Second .eq('enterprise_id', enterpriseId) returns promise with error
          data: null,
          error: new Error('Notification not found')
        });
      
      mockSupabase.schema.mockReturnValueOnce(mockChain);

      await expect(
        service.updateNotificationStatus(999, 'SENT', mockEnterpriseId)
      ).rejects.toThrow('Failed to update notification status: Notification not found');
    });
  });

  describe('getNotificationsByStatus', () => {
    it('should retrieve notifications by status', async () => {
      const mockNotifications: NotificationRow[] = [
        {
          id: 1,
          name: 'Notification 1',
          payload: {},
          recipients: ['user-1'],
          notification_status: 'PENDING',
          notification_workflow_id: 1,
          enterprise_id: mockEnterpriseId,
          transaction_id: null,
          error_details: null,
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          overrides: null,
          typ_notification_category_id: null,
          typ_notification_priority_id: null
        },
        {
          id: 2,
          name: 'Notification 2',
          payload: {},
          recipients: ['user-2'],
          notification_status: 'PENDING',
          notification_workflow_id: 1,
          enterprise_id: mockEnterpriseId,
          transaction_id: null,
          error_details: null,
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          overrides: null,
          typ_notification_category_id: null,
          typ_notification_priority_id: null
        }
      ];

      // Mock the full chain since this method doesn't use .single()
      mockSupabase.order.mockResolvedValue({
        data: mockNotifications,
        error: null
      });

      const result = await service.getNotificationsByStatus('PENDING', mockEnterpriseId, 10);

      expect(mockSupabase.schema).toHaveBeenCalledWith('notify');
      expect(mockSupabase.from).toHaveBeenCalledWith('ent_notification');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('notification_status', 'PENDING');
      expect(mockSupabase.eq).toHaveBeenCalledWith('enterprise_id', mockEnterpriseId);
      expect(mockSupabase.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockNotifications);
    });

    it('should use default limit when not specified', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null
      });

      await service.getNotificationsByStatus('SENT', mockEnterpriseId);

      expect(mockSupabase.limit).toHaveBeenCalledWith(100);
    });
  });

  describe('cancelNotification', () => {
    it('should cancel notification by setting status to RETRACTED', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: 1 },
        error: null
      });

      await service.cancelNotification(1, mockEnterpriseId);

      expect(mockSupabase.schema).toHaveBeenCalledWith('notify');
      expect(mockSupabase.from).toHaveBeenCalledWith('ent_notification');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        notification_status: 'RETRACTED',
        updated_at: expect.any(String)
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 1);
      expect(mockSupabase.eq).toHaveBeenCalledWith('enterprise_id', mockEnterpriseId);
    });

    it('should handle cancellation errors', async () => {
      // Mock the entire chain to return an error
      const mockChain = {
        schema: jest.fn(() => mockChain),
        from: jest.fn(() => mockChain),
        update: jest.fn(() => mockChain),
        eq: jest.fn()
      };
      
      // The first .eq() call returns the chain, the second returns a promise with error
      mockChain.eq
        .mockReturnValueOnce(mockChain) // First .eq('id', id) returns chain
        .mockResolvedValueOnce({ // Second .eq('enterprise_id', enterpriseId) returns promise with error
          data: null,
          error: new Error('Access denied')
        });
      
      mockSupabase.schema.mockReturnValueOnce(mockChain);

      await expect(
        service.cancelNotification(1, mockEnterpriseId)
      ).rejects.toThrow('Failed to update notification status: Access denied');
    });
  });

  describe('getNotificationsByWorkflow', () => {
    it('should retrieve notifications for specific workflow', async () => {
      const mockNotifications: NotificationRow[] = [
        {
          id: 1,
          name: 'Workflow Notification',
          payload: {},
          recipients: ['user-1'],
          notification_status: 'SENT',
          notification_workflow_id: 5,
          enterprise_id: mockEnterpriseId,
          transaction_id: 'txn-123',
          error_details: null,
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null,
          overrides: null,
          typ_notification_category_id: null,
          typ_notification_priority_id: null
        }
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockNotifications,
        error: null
      });

      const result = await service.getNotificationsByWorkflow(5, mockEnterpriseId, 50);

      expect(mockSupabase.schema).toHaveBeenCalledWith('notify');
      expect(mockSupabase.from).toHaveBeenCalledWith('ent_notification');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('notification_workflow_id', 5);
      expect(mockSupabase.eq).toHaveBeenCalledWith('enterprise_id', mockEnterpriseId);
      expect(mockSupabase.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(mockNotifications);
    });
  });
});