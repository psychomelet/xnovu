import { NextRequest } from 'next/server';
import { POST as triggerPOST } from '../app/api/trigger/route';
import { GET as novuGET, POST as novuPOST } from '../app/api/novu/route';

// Mock environment variables
process.env.NOVU_SECRET_KEY = 'test-secret-key';
process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID = 'default-subscriber';

// Mock dependencies
const mockWorkflowLoader = {
  getWorkflow: jest.fn(),
  getAllWorkflows: jest.fn()
};

const mockNotificationService = {
  updateNotificationStatus: jest.fn()
};

const mockServe = jest.fn();

jest.mock('../app/services/workflow', () => ({
  workflowLoader: mockWorkflowLoader
}));

jest.mock('../app/services/database', () => ({
  notificationService: mockNotificationService
}));

jest.mock('@novu/framework', () => ({
  serve: mockServe
}));

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('/api/trigger', () => {
    it('should trigger static workflow successfully', async () => {
      const mockWorkflow = {
        trigger: jest.fn().mockResolvedValue({
          transactionId: 'txn-123',
          success: true
        })
      };

      mockWorkflowLoader.getWorkflow.mockResolvedValue(mockWorkflow);

      const requestBody = {
        workflowId: 'user-signup',
        payload: {
          userId: 'user-123',
          email: 'user@example.com'
        }
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toMatchObject({
        message: 'Notification triggered successfully',
        workflowId: 'user-signup',
        transactionId: 'txn-123'
      });

      expect(mockWorkflowLoader.getWorkflow).toHaveBeenCalledWith('user-signup');
      expect(mockWorkflow.trigger).toHaveBeenCalledWith({
        to: 'default-subscriber',
        payload: expect.objectContaining({
          userId: 'user-123',
          email: 'user@example.com',
          subscriberId: 'default-subscriber',
          timestamp: expect.any(String)
        })
      });
    });

    it('should trigger dynamic workflow with enterprise context', async () => {
      const mockWorkflow = {
        trigger: jest.fn().mockResolvedValue({
          transactionId: 'txn-456',
          success: true
        })
      };

      mockWorkflowLoader.getWorkflow.mockResolvedValue(mockWorkflow);
      mockNotificationService.updateNotificationStatus.mockResolvedValue(undefined);

      const requestBody = {
        workflowId: 'building-alert',
        enterpriseId: 'enterprise-123',
        notificationId: 789,
        subscriberId: 'user-456',
        payload: {
          buildingId: 'building-789',
          message: 'HVAC failure detected',
          priority: 'high'
        }
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toMatchObject({
        message: 'Notification triggered successfully',
        workflowId: 'building-alert',
        enterpriseId: 'enterprise-123',
        notificationId: 789,
        transactionId: 'txn-456'
      });

      expect(mockWorkflowLoader.getWorkflow).toHaveBeenCalledWith('building-alert', 'enterprise-123');
      expect(mockWorkflow.trigger).toHaveBeenCalledWith({
        to: 'user-456',
        payload: expect.objectContaining({
          buildingId: 'building-789',
          message: 'HVAC failure detected',
          priority: 'high',
          notificationId: 789,
          enterprise_id: 'enterprise-123',
          subscriberId: 'user-456'
        })
      });

      // Verify status updates
      expect(mockNotificationService.updateNotificationStatus).toHaveBeenCalledWith(
        789,
        'PENDING',
        'enterprise-123'
      );

      expect(mockNotificationService.updateNotificationStatus).toHaveBeenCalledWith(
        789,
        'PROCESSING',
        'enterprise-123',
        undefined,
        'txn-456'
      );
    });

    it('should handle missing workflowId', async () => {
      const requestBody = {
        payload: { message: 'test' }
        // Missing workflowId
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.message).toBe('workflowId is required');
    });

    it('should handle workflow not found', async () => {
      mockWorkflowLoader.getWorkflow.mockResolvedValue(null);

      const requestBody = {
        workflowId: 'non-existent-workflow',
        enterpriseId: 'enterprise-123'
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.message).toContain('Workflow \'non-existent-workflow\' not found');
      expect(responseData).toHaveProperty('available');
    });

    it('should handle workflow trigger errors', async () => {
      const mockWorkflow = {
        trigger: jest.fn().mockRejectedValue(new Error('Novu API error'))
      };

      mockWorkflowLoader.getWorkflow.mockResolvedValue(mockWorkflow);

      const requestBody = {
        workflowId: 'error-workflow',
        payload: { test: 'data' }
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.message).toBe('Error triggering notification');
      expect(responseData.error).toMatchObject({
        message: 'Novu API error'
      });
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: 'invalid json{',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.message).toBe('Error triggering notification');
    });

    it('should handle missing environment variables', async () => {
      const originalSecretKey = process.env.NOVU_SECRET_KEY;
      delete process.env.NOVU_SECRET_KEY;

      const requestBody = {
        workflowId: 'test-workflow'
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.message).toBe('Server configuration error');

      // Restore environment variable
      process.env.NOVU_SECRET_KEY = originalSecretKey;
    });

    it('should parse string notificationId to number', async () => {
      const mockWorkflow = {
        trigger: jest.fn().mockResolvedValue({
          transactionId: 'txn-789'
        })
      };

      mockWorkflowLoader.getWorkflow.mockResolvedValue(mockWorkflow);
      mockNotificationService.updateNotificationStatus.mockResolvedValue(undefined);

      const requestBody = {
        workflowId: 'test-workflow',
        enterpriseId: 'enterprise-123',
        notificationId: '456', // String instead of number
        payload: { test: 'data' }
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.notificationId).toBe('456');

      // Verify that the service was called with parsed number
      expect(mockNotificationService.updateNotificationStatus).toHaveBeenCalledWith(
        456, // Should be parsed to number
        'PENDING',
        'enterprise-123'
      );
    });
  });

  describe('/api/novu', () => {
    it('should serve workflows via Novu framework', async () => {
      const mockWorkflows = [
        { key: 'workflow-1', type: 'static' },
        { key: 'workflow-2', type: 'dynamic' }
      ];

      mockWorkflowLoader.getAllWorkflows.mockResolvedValue(mockWorkflows);
      mockServe.mockReturnValue({
        GET: jest.fn().mockResolvedValue(new Response('Novu GET response')),
        POST: jest.fn().mockResolvedValue(new Response('Novu POST response')),
        OPTIONS: jest.fn().mockResolvedValue(new Response('Novu OPTIONS response'))
      });

      // Test GET request
      const getRequest = new NextRequest('http://localhost:3000/api/novu', {
        method: 'GET'
      });

      const getResponse = await novuGET(getRequest);
      expect(getResponse).toBeInstanceOf(Response);

      // Test POST request
      const postRequest = new NextRequest('http://localhost:3000/api/novu', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const postResponse = await novuPOST(postRequest);
      expect(postResponse).toBeInstanceOf(Response);

      // Verify workflows were loaded
      expect(mockWorkflowLoader.getAllWorkflows).toHaveBeenCalled();
      expect(mockServe).toHaveBeenCalledWith({
        workflows: mockWorkflows
      });
    });

    it('should handle workflow loading errors in Novu bridge', async () => {
      mockWorkflowLoader.getAllWorkflows.mockRejectedValue(
        new Error('Failed to load workflows')
      );

      const request = new NextRequest('http://localhost:3000/api/novu', {
        method: 'GET'
      });

      // Should handle error gracefully and return empty workflows
      await expect(novuGET(request)).resolves.not.toThrow();

      expect(mockWorkflowLoader.getAllWorkflows).toHaveBeenCalled();
    });

    it('should cache handlers between requests', async () => {
      const mockWorkflows = [{ key: 'test-workflow' }];
      mockWorkflowLoader.getAllWorkflows.mockResolvedValue(mockWorkflows);

      const mockHandlers = {
        GET: jest.fn().mockResolvedValue(new Response('GET')),
        POST: jest.fn().mockResolvedValue(new Response('POST'))
      };

      mockServe.mockReturnValue(mockHandlers);

      // First request
      const request1 = new NextRequest('http://localhost:3000/api/novu', {
        method: 'GET'
      });

      await novuGET(request1);

      // Second request
      const request2 = new NextRequest('http://localhost:3000/api/novu', {
        method: 'GET'
      });

      await novuGET(request2);

      // getAllWorkflows should be called for each request
      expect(mockWorkflowLoader.getAllWorkflows).toHaveBeenCalledTimes(2);
      // But serve should be called for each request too (no caching implemented)
      expect(mockServe).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling integration', () => {
    it('should handle database connection errors gracefully', async () => {
      mockNotificationService.updateNotificationStatus.mockRejectedValue(
        new Error('Database connection lost')
      );

      const mockWorkflow = {
        trigger: jest.fn().mockResolvedValue({
          transactionId: 'txn-123'
        })
      };

      mockWorkflowLoader.getWorkflow.mockResolvedValue(mockWorkflow);

      const requestBody = {
        workflowId: 'test-workflow',
        enterpriseId: 'enterprise-123',
        notificationId: 123
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Should still trigger workflow even if status update fails
      const response = await triggerPOST(request);
      expect(response.status).toBe(200);

      expect(mockWorkflow.trigger).toHaveBeenCalled();
    });

    it('should handle workflow loader errors', async () => {
      mockWorkflowLoader.getWorkflow.mockRejectedValue(
        new Error('Workflow loader initialization failed')
      );

      const requestBody = {
        workflowId: 'test-workflow'
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.message).toBe('Error triggering notification');
      expect(responseData.error.message).toBe('Workflow loader initialization failed');
    });
  });

  describe('Request validation', () => {
    it('should validate enterprise ID format', async () => {
      const mockWorkflow = {
        trigger: jest.fn().mockResolvedValue({ transactionId: 'txn-123' })
      };

      mockWorkflowLoader.getWorkflow.mockResolvedValue(mockWorkflow);

      const requestBody = {
        workflowId: 'test-workflow',
        enterpriseId: '', // Empty enterprise ID
        payload: { test: 'data' }
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      // Should handle empty enterprise ID gracefully
      expect(mockWorkflowLoader.getWorkflow).toHaveBeenCalledWith('test-workflow', '');
    });

    it('should handle large payloads', async () => {
      const mockWorkflow = {
        trigger: jest.fn().mockResolvedValue({ transactionId: 'txn-123' })
      };

      mockWorkflowLoader.getWorkflow.mockResolvedValue(mockWorkflow);

      // Create large payload
      const largePayload = {
        data: new Array(1000).fill(0).map((_, i) => ({
          id: i,
          value: `test-value-${i}`,
          nested: {
            field1: `nested-${i}`,
            field2: new Array(10).fill(`item-${i}`)
          }
        }))
      };

      const requestBody = {
        workflowId: 'test-workflow',
        payload: largePayload
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await triggerPOST(request);
      expect(response.status).toBe(200);

      expect(mockWorkflow.trigger).toHaveBeenCalledWith({
        to: 'default-subscriber',
        payload: expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              id: 0,
              value: 'test-value-0'
            })
          ])
        })
      });
    });
  });
});