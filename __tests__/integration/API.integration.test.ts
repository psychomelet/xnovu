import { NextRequest } from 'next/server';
import { POST as triggerPOST } from '../../app/api/trigger/route';
import { GET as novuGET, POST as novuPOST } from '../../app/api/novu/route';
import { WorkflowService } from '../../app/services/database/WorkflowService';
import { NotificationService } from '../../app/services/database/NotificationService';
import { WorkflowRegistry } from '../../app/services/workflow/WorkflowRegistry';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/supabase/database.types';
import { randomUUID } from 'crypto';

// Types
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];
type SupabaseClient = ReturnType<typeof createClient<Database>>;

// Mock environment variables for testing
process.env.NOVU_SECRET_KEY = 'test-secret-key-123456789';
process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID = 'default-subscriber';

// Mock @novu/framework since we're testing API layer, not Novu integration
jest.mock('@novu/framework', () => ({
  serve: jest.fn(() => ({
    GET: jest.fn().mockResolvedValue(new Response('Novu GET response')),
    POST: jest.fn().mockResolvedValue(new Response('Novu POST response')),
    OPTIONS: jest.fn().mockResolvedValue(new Response('Novu OPTIONS response'))
  }))
}));

// Mock workflow creation for API tests
const mockCreateDynamicWorkflow = jest.fn();
jest.mock('../../app/services/workflow/DynamicWorkflowFactory', () => ({
  DynamicWorkflowFactory: {
    createDynamicWorkflow: mockCreateDynamicWorkflow,
    validateWorkflowConfig: jest.fn().mockReturnValue(true)
  }
}));

describe('API Integration Tests with Real Database Services', () => {
  let supabase: SupabaseClient;
  let workflowService: WorkflowService;
  let notificationService: NotificationService;
  let workflowRegistry: WorkflowRegistry;
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
      throw new Error('Real Supabase credentials required for API Integration tests. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-api-integration' } }
    });
    
    workflowService = new WorkflowService();
    notificationService = new NotificationService();
    workflowRegistry = new WorkflowRegistry();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockCreateDynamicWorkflow.mockReturnValue({
      trigger: jest.fn().mockResolvedValue({
        transactionId: 'mock-txn-123',
        success: true
      })
    });
    
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
      name: 'Test API Workflow',
      workflow_key: `test-api-workflow-${Date.now()}-${Math.random().toString(36).substring(7)}`,
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
      name: 'Test API Notification',
      payload: { message: 'Test API message' },
      recipients: [testUserId],
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

  describe('/api/trigger endpoint integration', () => {
    it('should trigger workflow and create notification in database', async () => {
      // Create a published workflow in database
      const testWorkflow = await createTestWorkflow({
        name: 'API Trigger Test Workflow',
        workflow_key: 'api-trigger-test-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 123 },
        publish_status: 'PUBLISH'
      });

      // Register the workflow in registry
      const mockWorkflowInstance = {
        trigger: jest.fn().mockResolvedValue({
          transactionId: 'api-test-txn-456',
          success: true
        })
      };
      mockCreateDynamicWorkflow.mockReturnValue(mockWorkflowInstance);
      
      // Load the workflow into registry
      await workflowRegistry.loadEnterpriseWorkflows(testEnterpriseId);

      // Create trigger request
      const requestBody = {
        workflowId: 'api-trigger-test-workflow',
        payload: {
          message: 'API trigger test message',
          enterpriseId: testEnterpriseId,
          subscriberId: testUserId
        }
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Call the trigger API
      const response = await triggerPOST(request);
      const responseData = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.transactionId).toBe('api-test-txn-456');

      // Verify workflow trigger was called
      expect(mockWorkflowInstance.trigger).toHaveBeenCalledWith({
        to: { subscriberId: testUserId },
        payload: expect.objectContaining({
          message: 'API trigger test message',
          enterpriseId: testEnterpriseId
        })
      });
    });

    it('should handle missing workflow gracefully', async () => {
      const requestBody = {
        workflowId: 'non-existent-workflow',
        payload: {
          message: 'Test message',
          enterpriseId: testEnterpriseId,
          subscriberId: testUserId
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

      expect(response.status).toBe(404);
      expect(responseData.error).toContain('Workflow not found');
    });

    it('should handle malformed request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await triggerPOST(request);
      
      expect(response.status).toBe(400);
    });
  });

  describe('/api/novu endpoint integration', () => {
    it('should handle GET requests to Novu bridge', async () => {
      const request = new NextRequest('http://localhost:3000/api/novu', {
        method: 'GET'
      });

      const response = await novuGET(request);
      
      // Should delegate to Novu serve function
      expect(response).toBeDefined();
      expect(response.status).toBeLessThan(500); // Should not be server error
    });

    it('should handle POST requests to Novu bridge', async () => {
      const request = new NextRequest('http://localhost:3000/api/novu', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await novuPOST(request);
      
      // Should delegate to Novu serve function
      expect(response).toBeDefined();
      expect(response.status).toBeLessThan(500); // Should not be server error
    });
  });

  describe('End-to-End API Workflow Integration', () => {
    it('should create notification via API and track it in database', async () => {
      // Create a published workflow
      const testWorkflow = await createTestWorkflow({
        name: 'E2E API Workflow',
        workflow_key: 'e2e-api-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 123 },
        publish_status: 'PUBLISH'
      });

      // Setup registry
      const mockWorkflowInstance = {
        trigger: jest.fn().mockImplementation(async ({ payload }) => {
          // Simulate creating a notification in the database during trigger
          const notification = await createTestNotification({
            name: 'E2E API Notification',
            payload: payload,
            notification_workflow_id: testWorkflow.id,
            notification_status: 'PENDING'
          });
          
          return {
            transactionId: `e2e-txn-${notification.id}`,
            success: true
          };
        })
      };
      mockCreateDynamicWorkflow.mockReturnValue(mockWorkflowInstance);
      
      await workflowRegistry.loadEnterpriseWorkflows(testEnterpriseId);

      // Trigger via API
      const requestBody = {
        workflowId: 'e2e-api-workflow',
        payload: {
          message: 'E2E API test message',
          enterpriseId: testEnterpriseId,
          subscriberId: testUserId,
          buildingId: 'building-123',
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

      // Verify API response
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.transactionId).toMatch(/^e2e-txn-/);

      // Verify workflow was triggered with correct payload
      expect(mockWorkflowInstance.trigger).toHaveBeenCalledWith({
        to: { subscriberId: testUserId },
        payload: expect.objectContaining({
          message: 'E2E API test message',
          enterpriseId: testEnterpriseId,
          buildingId: 'building-123',
          priority: 'high'
        })
      });

      // Verify notification was created in database
      const notifications = await notificationService.getNotificationsByWorkflow(
        testWorkflow.id, 
        testEnterpriseId,
        10
      );

      expect(notifications.length).toBeGreaterThan(0);
      const notification = notifications.find(n => n.name === 'E2E API Notification');
      expect(notification).toBeDefined();
      expect(notification!.notification_status).toBe('PENDING');
      expect(notification!.payload).toEqual(expect.objectContaining({
        message: 'E2E API test message',
        enterpriseId: testEnterpriseId,
        buildingId: 'building-123',
        priority: 'high'
      }));
    });
  });

  describe('API Error Handling with Real Services', () => {
    it('should handle database connection errors gracefully', async () => {
      // Create request with invalid enterprise ID that might cause DB issues
      const requestBody = {
        workflowId: 'test-workflow',
        payload: {
          message: 'Test message',
          enterpriseId: '', // Invalid enterprise ID
          subscriberId: testUserId
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
      
      // Should handle error gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });

    it('should handle workflow registry errors during API calls', async () => {
      // Mock workflow registry to throw error
      const originalLoadMethod = workflowRegistry.loadEnterpriseWorkflows;
      workflowRegistry.loadEnterpriseWorkflows = jest.fn().mockRejectedValue(
        new Error('Registry error')
      );

      const requestBody = {
        workflowId: 'error-workflow',
        payload: {
          message: 'Test message',
          enterpriseId: testEnterpriseId,
          subscriberId: testUserId
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
      
      // Should handle registry error
      expect(response.status).toBeGreaterThanOrEqual(400);
      
      // Restore original method
      workflowRegistry.loadEnterpriseWorkflows = originalLoadMethod;
    });
  });
});
