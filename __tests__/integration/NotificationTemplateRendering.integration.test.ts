import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { triggerNotificationById } from '@/lib/notifications/trigger';
import { getTemplateRenderer } from '@/app/services/template/TemplateRenderer';
import { Novu } from '@novu/api';
import { randomUUID } from 'crypto';

// Mock Novu to prevent actual API calls
jest.mock('@novu/api');

describe('Notification Template Rendering Integration', () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const novuSecretKey = process.env.NOVU_SECRET_KEY || '';

  // Validate that we have real credentials
  beforeAll(() => {
    if (!supabaseUrl || !supabaseServiceKey || !supabaseUrl.includes('supabase.co') || supabaseServiceKey.length <= 50) {
      throw new Error('Real Supabase credentials required. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }
    if (!novuSecretKey || novuSecretKey.length <= 20) {
      throw new Error('Real Novu credentials required. Set NOVU_SECRET_KEY environment variable.');
    }
  });

  let supabase: ReturnType<typeof createClient<Database>>;
  let testEnterpriseId: string;
  let testWorkflowId: number;
  let testTemplateId: number;
  let mockNovuTrigger: jest.Mock;

  beforeEach(() => {
    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Set up mock Novu trigger
    mockNovuTrigger = jest.fn().mockResolvedValue({
      result: { acknowledged: true, transactionId: 'mock-transaction-123' }
    });
    (Novu as jest.MockedClass<typeof Novu>).mockImplementation(() => ({
      trigger: mockNovuTrigger
    } as any));

    // Clear template cache before each test
    const templateRenderer = getTemplateRenderer();
    templateRenderer.clearCache();
  });

  afterEach(async () => {
    // Clean up test data
    if (testEnterpriseId) {
      await supabase
        .schema('notify')
        .from('ent_notification')
        .delete()
        .eq('enterprise_id', testEnterpriseId);

      await supabase
        .schema('notify')
        .from('ent_notification_template')
        .delete()
        .eq('enterprise_id', testEnterpriseId);

      await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .delete()
        .eq('enterprise_id', testEnterpriseId);
    }
  });

  describe('Template Rendering in Notification Overrides', () => {
    beforeEach(async () => {
      // Create test enterprise ID (must be valid UUID)
      testEnterpriseId = randomUUID();

      // Create a test workflow
      const { data: workflow, error: workflowError } = await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .insert({
          name: 'Test Template Workflow',
          workflow_key: `test-workflow-${Date.now()}`,
          workflow_type: 'DYNAMIC',
          default_channels: ['EMAIL', 'IN_APP'],
          description: 'Test workflow for template rendering',
          enterprise_id: testEnterpriseId
        })
        .select()
        .single();

      if (workflowError || !workflow) {
        throw new Error(`Failed to create test workflow: ${workflowError?.message}`);
      }
      testWorkflowId = workflow.id;
    });

    it('should render simple variable interpolation in notification overrides', async () => {
      // Create notification with template syntax in overrides
      const { data: notification, error } = await supabase
        .schema('notify')
        .from('ent_notification')
        .insert({
          name: 'Test Notification with Templates',
          payload: {
            userName: 'John Doe',
            buildingName: 'Tower A',
            temperature: 25.5
          },
          recipients: [randomUUID()],
          notification_workflow_id: testWorkflowId,
          enterprise_id: testEnterpriseId,
          notification_status: 'PENDING',
          publish_status: 'PUBLISH',
          overrides: {
            email: {
              subject: 'Alert for {{userName}}',
              body: 'Building {{buildingName}} temperature is {{temperature}}°C'
            },
            inApp: {
              content: 'Quick alert: {{buildingName}} needs attention!'
            }
          }
        })
        .select()
        .single();

      if (error || !notification) {
        throw new Error(`Failed to create test notification: ${error?.message}`);
      }

      // Trigger the notification
      const result = await triggerNotificationById(notification.id);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.notificationId).toBe(notification.id);
      expect(mockNovuTrigger).toHaveBeenCalledTimes(1);

      // Verify that templates were rendered in the overrides
      const [triggerCall] = mockNovuTrigger.mock.calls;
      expect(triggerCall[0].overrides.email.subject).toBe('Alert for John Doe');
      expect(triggerCall[0].overrides.email.body).toBe('Building Tower A temperature is 25.5°C');
      expect(triggerCall[0].overrides.inApp.content).toBe('Quick alert: Tower A needs attention!');
    });

    it('should render nested object access in templates', async () => {
      const { data: notification, error } = await supabase
        .schema('notify')
        .from('ent_notification')
        .insert({
          name: 'Test Nested Template',
          payload: {
            user: {
              profile: {
                firstName: 'Jane',
                lastName: 'Smith'
              },
              preferences: {
                language: 'en-US'
              }
            },
            alert: {
              severity: 'HIGH',
              location: {
                building: 'Building B',
                floor: 3
              }
            }
          },
          recipients: [randomUUID()],
          notification_workflow_id: testWorkflowId,
          enterprise_id: testEnterpriseId,
          notification_status: 'PENDING',
          publish_status: 'PUBLISH',
          overrides: {
            email: {
              subject: '{{alert.severity}} Alert - {{alert.location.building}}',
              body: 'Dear {{user.profile.firstName}} {{user.profile.lastName}}, alert on floor {{alert.location.floor}}'
            }
          }
        })
        .select()
        .single();

      if (error || !notification) {
        throw new Error(`Failed to create test notification: ${error?.message}`);
      }

      const result = await triggerNotificationById(notification.id);

      expect(result.success).toBe(true);
      const [triggerCall] = mockNovuTrigger.mock.calls;
      expect(triggerCall[0].overrides.email.subject).toBe('HIGH Alert - Building B');
      expect(triggerCall[0].overrides.email.body).toBe('Dear Jane Smith, alert on floor 3');
    });

    it('should render array access in templates', async () => {
      const { data: notification, error } = await supabase
        .schema('notify')
        .from('ent_notification')
        .insert({
          name: 'Test Array Template',
          payload: {
            devices: [
              { id: 'dev-001', status: 'offline' },
              { id: 'dev-002', status: 'online' }
            ],
            alerts: ['Temperature spike', 'Door left open', 'Motion detected']
          },
          recipients: [randomUUID()],
          notification_workflow_id: testWorkflowId,
          enterprise_id: testEnterpriseId,
          notification_status: 'PENDING',
          publish_status: 'PUBLISH',
          overrides: {
            sms: {
              content: 'Device {{devices[0].id}} is {{devices[0].status}}. Primary alert: {{alerts[0]}}'
            }
          }
        })
        .select()
        .single();

      if (error || !notification) {
        throw new Error(`Failed to create test notification: ${error?.message}`);
      }

      const result = await triggerNotificationById(notification.id);

      expect(result.success).toBe(true);
      const [triggerCall] = mockNovuTrigger.mock.calls;
      expect(triggerCall[0].overrides.sms.content).toBe('Device dev-001 is offline. Primary alert: Temperature spike');
    });


    it('should handle missing variables gracefully', async () => {
      const { data: notification, error } = await supabase
        .schema('notify')
        .from('ent_notification')
        .insert({
          name: 'Test Missing Variables',
          payload: {
            userName: 'Test User'
            // Missing: buildingName, temperature
          },
          recipients: [randomUUID()],
          notification_workflow_id: testWorkflowId,
          enterprise_id: testEnterpriseId,
          notification_status: 'PENDING',
          publish_status: 'PUBLISH',
          overrides: {
            email: {
              subject: 'Alert for {{userName}}',
              body: 'Building {{buildingName}} temperature is {{temperature}}°C'
            }
          }
        })
        .select()
        .single();

      if (error || !notification) {
        throw new Error(`Failed to create test notification: ${error?.message}`);
      }

      const result = await triggerNotificationById(notification.id);

      expect(result.success).toBe(true);
      const [triggerCall] = mockNovuTrigger.mock.calls;
      expect(triggerCall[0].overrides.email.subject).toBe('Alert for Test User');
      // Missing variables should remain as placeholders
      expect(triggerCall[0].overrides.email.body).toBe('Building {{buildingName}} temperature is {{temperature}}°C');
    });


  });


  describe('Multi-Channel Template Rendering', () => {
    beforeEach(async () => {
      // Create test enterprise ID (must be valid UUID)
      testEnterpriseId = randomUUID();

      // Create a test workflow
      const { data: workflow, error: workflowError } = await supabase
        .schema('notify')
        .from('ent_notification_workflow')
        .insert({
          name: 'Test Multi-Channel Workflow',
          workflow_key: `test-multi-workflow-${Date.now()}`,
          workflow_type: 'DYNAMIC',
          default_channels: ['EMAIL', 'IN_APP', 'SMS', 'PUSH'],
          description: 'Test workflow for multi-channel template rendering',
          enterprise_id: testEnterpriseId
        })
        .select()
        .single();

      if (workflowError || !workflow) {
        throw new Error(`Failed to create test workflow: ${workflowError?.message}`);
      }
      testWorkflowId = workflow.id;
    });

    it('should render templates across different channels', async () => {
      const { data: notification, error } = await supabase
        .schema('notify')
        .from('ent_notification')
        .insert({
          name: 'Multi-Channel Test',
          payload: {
            message: 'Temperature exceeded',
            location: 'Server Room A',
            title: 'Critical Alert',
            description: 'Immediate action required',
            userName: 'Operations Team',
            year: 2024,
            company: 'XNovu'
          },
          recipients: [randomUUID()], // Use valid UUID for recipient
          notification_workflow_id: testWorkflowId,
          enterprise_id: testEnterpriseId,
          notification_status: 'PENDING',
          publish_status: 'PUBLISH',
          overrides: {
            email: {
              subject: 'Alert: {{title}}',
              body: 'Dear {{userName}},\n\n{{message}} at {{location}}.\n\nCopyright © {{year}} {{company}}. All rights reserved.'
            },
            sms: {
              content: 'Alert: {{message}} at {{location}}'
            },
            push: {
              content: '🔔 {{title}}: {{description}}'
            }
          }
        })
        .select()
        .single();

      if (error || !notification) {
        throw new Error(`Failed to create multi-channel notification: ${error?.message}`);
      }

      const result = await triggerNotificationById(notification.id);

      expect(result.success).toBe(true);
      const [triggerCall] = mockNovuTrigger.mock.calls;
      
      // Verify all channels were rendered correctly
      expect(triggerCall[0].overrides.email.subject).toBe('Alert: Critical Alert');
      expect(triggerCall[0].overrides.email.body).toContain('Dear Operations Team');
      expect(triggerCall[0].overrides.email.body).toContain('Temperature exceeded at Server Room A');
      expect(triggerCall[0].overrides.email.body).toContain('Copyright © 2024 XNovu. All rights reserved.');
      expect(triggerCall[0].overrides.sms.content).toBe('Alert: Temperature exceeded at Server Room A');
      expect(triggerCall[0].overrides.push.content).toBe('🔔 Critical Alert: Immediate action required');
    });
  });
});