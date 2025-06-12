import { NextRequest } from 'next/server';
import { POST as triggerPOST } from '../app/api/trigger/route';
import { GET as novuGET, POST as novuPOST } from '../app/api/novu/route';
import { WorkflowService } from '../app/services/database/WorkflowService';
import { NotificationService } from '../app/services/database/NotificationService';
import { WorkflowRegistry } from '../app/services/workflow/WorkflowRegistry';
import { DynamicWorkflowFactory } from '../app/services/workflow/DynamicWorkflowFactory';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/supabase/database.types';
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
jest.mock('../app/services/workflow/DynamicWorkflowFactory', () => ({
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
      name: 'Test Workflow',
      workflow_key: `test-workflow-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      workflow_type: 'DYNAMIC',
      default_channels: ['EMAIL'],
      enterprise_id: testEnterpriseId,
      publish_status: 'PUBLISH',
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

  describe('/api/trigger with Real Database', () => {
    it('should trigger static workflow successfully', async () => {
      // Register a static workflow in the registry
      const mockStaticWorkflow = {
        trigger: jest.fn().mockResolvedValue({
          transactionId: 'txn-123',
          success: true
        })
      };

      workflowRegistry.registerStaticWorkflow('user-signup', mockStaticWorkflow);

      const requestBody = {
        workflowId: 'user-signup',
        payload: {
          userId: testUserId,
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

      // Mock the workflow loader to use our registry
      const originalWorkflowLoader = require('../app/services/workflow').workflowLoader;
      require('../app/services/workflow').workflowLoader = {
        getWorkflow: (workflowId: string, enterpriseId?: string) => 
          workflowRegistry.getWorkflow(workflowId, enterpriseId)?.instance || null,
        getAllWorkflows: () => workflowRegistry.getEnterpriseWorkflows('default').map(w => w.instance)
      };

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toMatchObject({
        message: 'Notification triggered successfully',
        workflowId: 'user-signup',
        transactionId: 'txn-123'
      });

      expect(mockStaticWorkflow.trigger).toHaveBeenCalledWith({
        to: 'default-subscriber',
        payload: expect.objectContaining({
          userId: testUserId,
          email: 'user@example.com',
          subscriberId: 'default-subscriber',
          timestamp: expect.any(String)
        })
      });

      // Restore original workflow loader
      require('../app/services/workflow').workflowLoader = originalWorkflowLoader;
    });

    it('should trigger dynamic workflow with real database notification tracking', async () => {
      // Create workflow and notification in database
      const workflowData = await createTestWorkflow({
        name: 'API Test Workflow',
        workflow_key: 'api-test-workflow',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 123 }
      });

      const notification = await createTestNotification({
        name: 'API Test Notification',
        notification_workflow_id: workflowData.id,
        notification_status: 'PENDING'
      });

      // Register dynamic workflow in registry
      const config = await workflowService.parseWorkflowConfig(workflowData);
      workflowRegistry.registerDynamicWorkflow('api-test-workflow', config, testEnterpriseId);

      const requestBody = {
        workflowId: 'api-test-workflow',
        enterpriseId: testEnterpriseId,
        notificationId: notification.id,
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

      // Mock the workflow loader and notification service
      const originalWorkflowLoader = require('../app/services/workflow').workflowLoader;
      const originalNotificationService = require('../app/services/database').notificationService;

      require('../app/services/workflow').workflowLoader = {
        getWorkflow: (workflowId: string, enterpriseId?: string) => 
          workflowRegistry.getWorkflow(workflowId, enterpriseId)?.instance || null,
        getAllWorkflows: () => workflowRegistry.getEnterpriseWorkflows(testEnterpriseId).map(w => w.instance),
        getStats: () => ({ total: 1, static: 0, dynamic: 1 })
      };

      require('../app/services/database').notificationService = notificationService;

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toMatchObject({
        message: 'Notification triggered successfully',
        workflowId: 'api-test-workflow',
        enterpriseId: testEnterpriseId,
        notificationId: notification.id,
        transactionId: 'mock-txn-123'
      });

      // Verify mock workflow was called
      expect(mockCreateDynamicWorkflow).toHaveBeenCalled();

      // Verify notification was updated in database
      const updatedNotification = await notificationService.getNotification(notification.id, testEnterpriseId);
      expect(updatedNotification).toBeDefined();
      expect(['PENDING', 'PROCESSING']).toContain(updatedNotification!.notification_status);

      // Restore original services
      require('../app/services/workflow').workflowLoader = originalWorkflowLoader;
      require('../app/services/database').notificationService = originalNotificationService;
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
      const requestBody = {
        workflowId: 'non-existent-workflow',
        enterpriseId: testEnterpriseId
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Mock empty workflow loader
      const originalWorkflowLoader = require('../app/services/workflow').workflowLoader;
      require('../app/services/workflow').workflowLoader = {
        getWorkflow: () => null,
        getStats: () => ({ total: 0, static: 0, dynamic: 0 })
      };

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.message).toContain('Workflow \'non-existent-workflow\' not found');
      expect(responseData).toHaveProperty('available');

      // Restore original workflow loader
      require('../app/services/workflow').workflowLoader = originalWorkflowLoader;
    });

    it('should handle workflow trigger errors', async () => {
      const mockWorkflow = {
        trigger: jest.fn().mockRejectedValue(new Error('Novu API error'))
      };

      workflowRegistry.registerStaticWorkflow('error-workflow', mockWorkflow);

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

      // Mock the workflow loader
      const originalWorkflowLoader = require('../app/services/workflow').workflowLoader;
      require('../app/services/workflow').workflowLoader = {
        getWorkflow: (workflowId: string) => 
          workflowRegistry.getWorkflow(workflowId)?.instance || null
      };

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.message).toBe('Error triggering notification');
      expect(responseData.error).toMatchObject({
        message: 'Novu API error'
      });

      // Restore original workflow loader
      require('../app/services/workflow').workflowLoader = originalWorkflowLoader;
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
      expect(responseData.message).toBe('Configuration error: NOVU_SECRET_KEY is missing');

      // Restore environment variable
      process.env.NOVU_SECRET_KEY = originalSecretKey;
    });

    it('should parse string notificationId to number for database operations', async () => {
      // Create workflow and notification in database
      const workflowData = await createTestWorkflow({
        name: 'String ID Test Workflow',
        workflow_key: 'string-id-test-workflow'
      });

      const notification = await createTestNotification({
        name: 'String ID Test Notification',
        notification_workflow_id: workflowData.id,
        notification_status: 'PENDING'
      });

      // Register workflow
      const config = await workflowService.parseWorkflowConfig(workflowData);
      workflowRegistry.registerDynamicWorkflow('string-id-test-workflow', config, testEnterpriseId);

      const requestBody = {
        workflowId: 'string-id-test-workflow',
        enterpriseId: testEnterpriseId,
        notificationId: notification.id.toString(), // String instead of number
        payload: { test: 'data' }
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Mock services
      const originalWorkflowLoader = require('../app/services/workflow').workflowLoader;
      const originalNotificationService = require('../app/services/database').notificationService;

      require('../app/services/workflow').workflowLoader = {
        getWorkflow: (workflowId: string, enterpriseId?: string) => 
          workflowRegistry.getWorkflow(workflowId, enterpriseId)?.instance || null
      };

      require('../app/services/database').notificationService = notificationService;

      const response = await triggerPOST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.notificationId).toBe(notification.id.toString());

      // Verify that the notification service was called with parsed number
      const updatedNotification = await notificationService.getNotification(notification.id, testEnterpriseId);
      expect(updatedNotification).toBeDefined();

      // Restore original services
      require('../app/services/workflow').workflowLoader = originalWorkflowLoader;
      require('../app/services/database').notificationService = originalNotificationService;
    });
  });

  describe('/api/novu with Real Services', () => {
    it('should serve workflows via Novu framework', async () => {
      // Create some workflows in the registry
      const staticWorkflow = { key: 'static-workflow', type: 'static' };
      const dynamicWorkflow = { key: 'dynamic-workflow', type: 'dynamic' };

      workflowRegistry.registerStaticWorkflow('static-workflow', staticWorkflow);
      
      // Create dynamic workflow in database and register it
      const workflowData = await createTestWorkflow({
        name: 'Novu API Test Workflow',
        workflow_key: 'novu-api-test-workflow'
      });

      const config = await workflowService.parseWorkflowConfig(workflowData);
      workflowRegistry.registerDynamicWorkflow('novu-api-test-workflow', config, testEnterpriseId);

      // Mock the workflow loader
      const originalWorkflowLoader = require('../app/services/workflow').workflowLoader;
      require('../app/services/workflow').workflowLoader = {
        getAllWorkflows: () => [
          staticWorkflow,
          workflowRegistry.getWorkflow('novu-api-test-workflow', testEnterpriseId)?.instance
        ].filter(Boolean)
      };

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

      // Verify serve was called with workflows
      const { serve } = require('@novu/framework');
      expect(serve).toHaveBeenCalledWith({
        workflows: expect.arrayContaining([
          staticWorkflow,
          expect.any(Object)
        ])
      });

      // Restore original workflow loader
      require('../app/services/workflow').workflowLoader = originalWorkflowLoader;
    });

    it('should handle workflow loading errors in Novu bridge gracefully', async () => {
      // Mock workflow loader to throw error
      const originalWorkflowLoader = require('../app/services/workflow').workflowLoader;
      require('../app/services/workflow').workflowLoader = {
        getAllWorkflows: () => {
          throw new Error('Failed to load workflows');
        }
      };

      const request = new NextRequest('http://localhost:3000/api/novu', {
        method: 'GET'
      });

      // Should handle error gracefully and return response
      await expect(novuGET(request)).resolves.not.toThrow();

      // Restore original workflow loader
      require('../app/services/workflow').workflowLoader = originalWorkflowLoader;
    });
  });

  describe('Error handling with real database integration', () => {
    it('should handle database connection errors gracefully', async () => {
      // Create workflow but use invalid enterprise ID for notification service
      const workflowData = await createTestWorkflow({
        name: 'DB Error Test Workflow',
        workflow_key: 'db-error-test-workflow'
      });

      const config = await workflowService.parseWorkflowConfig(workflowData);
      workflowRegistry.registerDynamicWorkflow('db-error-test-workflow', config, testEnterpriseId);

      const requestBody = {
        workflowId: 'db-error-test-workflow',
        enterpriseId: testEnterpriseId,
        notificationId: 999999 // Non-existent notification ID
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Mock services with real notification service that will fail on non-existent ID
      const originalWorkflowLoader = require('../app/services/workflow').workflowLoader;
      const originalNotificationService = require('../app/services/database').notificationService;

      require('../app/services/workflow').workflowLoader = {
        getWorkflow: (workflowId: string, enterpriseId?: string) => 
          workflowRegistry.getWorkflow(workflowId, enterpriseId)?.instance || null
      };

      require('../app/services/database').notificationService = notificationService;

      const response = await triggerPOST(request);

      // Should still trigger workflow even if some status updates fail
      expect(response.status).toBe(200);

      // Restore original services
      require('../app/services/workflow').workflowLoader = originalWorkflowLoader;
      require('../app/services/database').notificationService = originalNotificationService;
    });

    it('should handle enterprise isolation in API calls', async () => {
      const otherEnterpriseId = `other-enterprise-${Date.now()}`;

      // Create workflows for different enterprises
      const testEnterpriseWorkflow = await createTestWorkflow({
        name: 'Test Enterprise API Workflow',
        workflow_key: 'test-enterprise-api-workflow',
        enterprise_id: testEnterpriseId
      });

      const otherEnterpriseWorkflow = await createTestWorkflow({
        name: 'Other Enterprise API Workflow',
        workflow_key: 'other-enterprise-api-workflow',
        enterprise_id: otherEnterpriseId
      });

      // Register workflows
      const testConfig = await workflowService.parseWorkflowConfig(testEnterpriseWorkflow);
      const otherConfig = await workflowService.parseWorkflowConfig(otherEnterpriseWorkflow);

      workflowRegistry.registerDynamicWorkflow('test-enterprise-api-workflow', testConfig, testEnterpriseId);
      workflowRegistry.registerDynamicWorkflow('other-enterprise-api-workflow', otherConfig, otherEnterpriseId);

      // Try to access other enterprise's workflow from test enterprise
      const requestBody = {
        workflowId: 'other-enterprise-api-workflow',
        enterpriseId: testEnterpriseId // Wrong enterprise ID
      };

      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Mock workflow loader
      const originalWorkflowLoader = require('../app/services/workflow').workflowLoader;
      require('../app/services/workflow').workflowLoader = {
        getWorkflow: (workflowId: string, enterpriseId?: string) => 
          workflowRegistry.getWorkflow(workflowId, enterpriseId)?.instance || null,
        getStats: () => workflowRegistry.getStats()
      };

      const response = await triggerPOST(request);
      const responseData = await response.json();

      // Should not find the workflow due to enterprise isolation
      expect(response.status).toBe(404);
      expect(responseData.message).toContain('Workflow \'other-enterprise-api-workflow\' not found');

      // Clean up additional workflow
      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('id', otherEnterpriseWorkflow.id);

      // Restore original workflow loader
      require('../app/services/workflow').workflowLoader = originalWorkflowLoader;
    });
  });
});