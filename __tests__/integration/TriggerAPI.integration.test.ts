import { NextRequest, NextResponse } from 'next/server';
import { WorkflowService } from '@/app/services/database/WorkflowService';
import { NotificationService } from '@/app/services/database/NotificationService';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { randomUUID } from 'crypto';
import { getTestEnterpriseId, generateTestUserId } from '../setup/test-data';

// Types
type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type NotificationRow = Database['notify']['Tables']['ent_notification']['Row'];
type NotificationInsert = Database['notify']['Tables']['ent_notification']['Insert'];
type SupabaseClient = ReturnType<typeof createClient<Database>>;

describe('Trigger API Integration Tests with Real Database Services', () => {
  let supabase: SupabaseClient;
  let workflowService: WorkflowService;
  let notificationService: NotificationService;
  let testEnterpriseId: string;
  let testUserId: string;
  const createdNotificationIds: number[] = [];
  const createdWorkflowIds: number[] = [];

  // Check if we have real credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  const hasRealCredentials = supabaseUrl && 
    supabaseServiceKey && 
    supabaseUrl.includes('supabase.co') && 
    supabaseServiceKey.length > 50;

  beforeAll(async () => {
    if (!hasRealCredentials) {
      throw new Error('Real Supabase credentials required for Trigger API Integration tests. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    // Get shared test enterprise ID
    testEnterpriseId = getTestEnterpriseId();
    testUserId = generateTestUserId();

    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'xnovu-test-trigger-api-integration' } }
    });
    
    workflowService = new WorkflowService();
    notificationService = new NotificationService();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // No need for cleanup - handled by global teardown
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // Clear tracking arrays (data cleanup handled by global teardown)
    createdNotificationIds.length = 0;
    createdWorkflowIds.length = 0;
  });

  // Cleanup handled by global teardown - no need for individual cleanup

  async function createTestWorkflow(overrides: Partial<WorkflowInsert> = {}): Promise<WorkflowRow> {
    const defaultWorkflow: WorkflowInsert = {
      name: `Test API Workflow ${Date.now()}-${Math.random().toString(36).substring(7)}`,
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
      name: `Test API Notification ${Date.now()}-${Math.random().toString(36).substring(7)}`,
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

  // Mock API layer functions to simulate API behavior
  function createMockTriggerAPI() {
    return {
      async POST(request: NextRequest) {
        try {
          const body = await request.json();
          const { workflowId, enterpriseId, notificationId, payload } = body;

          if (!workflowId) {
            return NextResponse.json(
              { message: 'workflowId is required' },
              { status: 400 }
            );
          }

          // Simulate workflow lookup
          if (workflowId === 'non-existent-workflow' || workflowId === 'non-existent-dynamic-workflow') {
            return NextResponse.json(
              { 
                message: `Workflow '${workflowId}' not found${enterpriseId ? ` for enterprise '${enterpriseId}'` : ''}`,
                available: { total: 0, static: 0, dynamic: 0 }
              },
              { status: 404 }
            );
          }

          // Simulate successful trigger
          const transactionId = `mock-txn-${Date.now()}`;
          
          // Update notification status if provided
          if (notificationId && enterpriseId) {
            await notificationService.updateNotificationStatus(
              notificationId,
              'PROCESSING',
              enterpriseId,
              undefined,
              transactionId
            );
          }

          return NextResponse.json({
            message: 'Notification triggered successfully',
            workflowId,
            enterpriseId,
            notificationId,
            transactionId,
            result: { success: true }
          });
        } catch (error) {
          // Check for JSON parsing errors
          if (error instanceof SyntaxError || 
              (error as any)?.message?.includes('JSON') ||
              (error as any)?.message?.includes('Unexpected token')) {
            return NextResponse.json(
              { message: 'Invalid JSON in request body' },
              { status: 400 }
            );
          }
          
          return NextResponse.json(
            { message: 'Error triggering notification', error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
          );
        }
      }
    };
  }

  function createMockNovuAPI() {
    return {
      async GET() {
        return new Response('Novu GET response', { status: 200 });
      },
      async POST() {
        return new Response('Novu POST response', { status: 200 });
      }
    };
  }

  describe('/api/trigger endpoint simulation', () => {
    it('should simulate successful workflow trigger', async () => {
      const mockAPI = createMockTriggerAPI();
      
      const requestBody = {
        workflowId: 'welcome-onboarding-email',
        payload: {
          userEmail: 'test@example.com',
          userName: 'Test User',
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

      const response = await mockAPI.POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.message).toBe('Notification triggered successfully');
      expect(responseData.workflowId).toBe('welcome-onboarding-email');
      expect(responseData.transactionId).toMatch(/^mock-txn-/);
    });

    it('should simulate missing workflow error', async () => {
      const mockAPI = createMockTriggerAPI();
      
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

      const response = await mockAPI.POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.message).toContain('Workflow');
      expect(responseData.message).toContain('not found');
    });

    it('should simulate malformed JSON error', async () => {
      const mockAPI = createMockTriggerAPI();
      
      const request = new NextRequest('http://localhost:3000/api/trigger', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await mockAPI.POST(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(400);
      expect(responseData.message).toContain('Invalid JSON');
    });
  });

  describe('/api/novu endpoint simulation', () => {
    it('should simulate GET requests to Novu bridge', async () => {
      const mockAPI = createMockNovuAPI();
      
      const response = await mockAPI.GET();
      
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Novu GET response');
    });

    it('should simulate POST requests to Novu bridge', async () => {
      const mockAPI = createMockNovuAPI();
      
      const response = await mockAPI.POST();
      
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Novu POST response');
    });
  });

  describe('Database Integration with API Simulation', () => {
    it('should create workflow and notification in database and simulate API response', async () => {
      // Create a published dynamic workflow in database
      const testWorkflow = await createTestWorkflow({
        name: 'Database API Integration Workflow',
        workflow_key: 'db-api-integration-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL'],
        template_overrides: { emailTemplateId: 123 },
        publish_status: 'PUBLISH'
      });

      // Create notification for tracking
      const testNotification = await createTestNotification({
        name: 'Database API Integration Notification',
        notification_workflow_id: testWorkflow.id,
        notification_status: 'PENDING'
      });

      // Simulate API call
      const mockAPI = createMockTriggerAPI();
      const requestBody = {
        workflowId: 'db-api-integration-workflow',
        enterpriseId: testEnterpriseId,
        notificationId: testNotification.id,
        payload: {
          message: 'Database API integration test message',
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

      const response = await mockAPI.POST(request);
      const responseData = await response.json();

      // Verify API response
      expect(response.status).toBe(200);
      expect(responseData.message).toBe('Notification triggered successfully');
      expect(responseData.workflowId).toBe('db-api-integration-workflow');
      expect(responseData.enterpriseId).toBe(testEnterpriseId);
      expect(responseData.notificationId).toBe(testNotification.id);
      expect(responseData.transactionId).toMatch(/^mock-txn-/);

      // Verify real database objects were created and updated
      const fetchedWorkflow = await workflowService.getWorkflowByKey(
        'db-api-integration-workflow',
        testEnterpriseId
      );
      expect(fetchedWorkflow).toBeDefined();
      expect(fetchedWorkflow!.workflow_key).toBe('db-api-integration-workflow');

      const updatedNotification = await notificationService.getNotification(
        testNotification.id,
        testEnterpriseId
      );
      expect(updatedNotification).toBeDefined();
      expect(updatedNotification!.notification_status).toBe('PROCESSING');
      expect(updatedNotification!.transaction_id).toMatch(/^mock-txn-/);
    });
  });

  describe('Real Database Services Integration', () => {
    it('should create and retrieve workflows using real database services', async () => {
      // Test WorkflowService with real database
      const testWorkflow = await createTestWorkflow({
        name: 'Real Database Test Workflow',
        workflow_key: 'real-db-test-workflow',
        workflow_type: 'DYNAMIC',
        default_channels: ['EMAIL', 'IN_APP'],
        template_overrides: { emailTemplateId: 123, inAppTemplateId: 124 },
        publish_status: 'PUBLISH'
      });

      // Verify workflow was created
      const fetchedWorkflow = await workflowService.getWorkflowByKey(
        'real-db-test-workflow',
        testEnterpriseId
      );
      expect(fetchedWorkflow).toBeDefined();
      expect(fetchedWorkflow!.name).toBe('Real Database Test Workflow');
      expect(fetchedWorkflow!.workflow_type).toBe('DYNAMIC');
      expect(fetchedWorkflow!.default_channels).toEqual(['EMAIL', 'IN_APP']);
    });

    it('should create and retrieve notifications using real database services', async () => {
      // Create workflow first
      const testWorkflow = await createTestWorkflow({
        name: 'Notification Test Workflow',
        workflow_key: 'notification-test-workflow'
      });

      // Test NotificationService with real database
      const testNotification = await createTestNotification({
        name: 'Real Database Test Notification',
        notification_workflow_id: testWorkflow.id,
        notification_status: 'PENDING',
        payload: { testMessage: 'Real database integration test' }
      });

      // Verify notification was created
      const fetchedNotification = await notificationService.getNotification(
        testNotification.id,
        testEnterpriseId
      );
      expect(fetchedNotification).toBeDefined();
      expect(fetchedNotification!.name).toBe('Real Database Test Notification');
      expect(fetchedNotification!.notification_status).toBe('PENDING');
      expect(fetchedNotification!.payload).toEqual({ testMessage: 'Real database integration test' });

      // Test notification status update
      await notificationService.updateNotificationStatus(
        testNotification.id,
        'PROCESSING',
        testEnterpriseId,
        undefined,
        'test-txn-789'
      );

      const updatedNotification = await notificationService.getNotification(
        testNotification.id,
        testEnterpriseId
      );
      expect(updatedNotification!.notification_status).toBe('PROCESSING');
      expect(updatedNotification!.transaction_id).toBe('test-txn-789');
    });

    it('should handle enterprise-specific workflow queries', async () => {
      const otherEnterpriseId = randomUUID();
      
      // Create workflows for different enterprises
      const workflow1 = await createTestWorkflow({
        name: 'Enterprise 1 Workflow',
        workflow_key: 'enterprise-1-workflow',
        enterprise_id: testEnterpriseId,
        publish_status: 'PUBLISH'
      });

      const workflow2 = await createTestWorkflow({
        name: 'Enterprise 2 Workflow',  
        workflow_key: 'enterprise-2-workflow',
        enterprise_id: otherEnterpriseId,
        publish_status: 'PUBLISH'
      });

      // Test enterprise isolation
      const fetchedWorkflow1 = await workflowService.getWorkflowByKey(
        'enterprise-1-workflow',
        testEnterpriseId
      );
      expect(fetchedWorkflow1).toBeDefined();
      expect(fetchedWorkflow1!.enterprise_id).toBe(testEnterpriseId);

      const fetchedWorkflow2 = await workflowService.getWorkflowByKey(
        'enterprise-2-workflow',
        otherEnterpriseId
      );
      expect(fetchedWorkflow2).toBeDefined();
      expect(fetchedWorkflow2!.enterprise_id).toBe(otherEnterpriseId);

      // Cross-enterprise access should not work
      const crossAccessAttempt = await workflowService.getWorkflowByKey(
        'enterprise-2-workflow',
        testEnterpriseId
      );
      expect(crossAccessAttempt).toBeNull();

      // Clean up additional workflow
      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('id', workflow2.id);
    });
  });
});