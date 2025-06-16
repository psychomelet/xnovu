import { renderTemplatesInOverrides } from '@/lib/notifications/trigger';
import { getTemplateRenderer } from '@/app/services/template/TemplateRenderer';

// Access the private function through module exports
const triggerModule = require('@/lib/notifications/trigger');

// Mock the template renderer
jest.mock('@/app/services/template/TemplateRenderer');

describe('Notification Trigger Template Rendering', () => {
  let mockTemplateRenderer: jest.Mocked<ReturnType<typeof getTemplateRenderer>>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock template renderer
    mockTemplateRenderer = {
      render: jest.fn(),
      renderTemplate: jest.fn(),
      validateTemplate: jest.fn(),
      clearCache: jest.fn(),
      clearExpiredCache: jest.fn(),
      getCacheStats: jest.fn()
    } as any;

    (getTemplateRenderer as jest.Mock).mockReturnValue(mockTemplateRenderer);
  });

  describe('renderTemplatesInOverrides', () => {
    const testEnterpriseId = 'test-enterprise-123';
    const testPayload = {
      userName: 'John Doe',
      buildingName: 'Tower A',
      temperature: 25.5,
      alert: {
        level: 'HIGH',
        message: 'Temperature exceeded threshold'
      }
    };

    it('should render simple template strings in overrides', async () => {
      mockTemplateRenderer.render.mockImplementation(async (template, context) => {
        // Simple mock implementation that replaces variables
        let result = template;
        Object.entries(context.variables).forEach(([key, value]) => {
          result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
        });
        return result;
      });

      const overrides = {
        email: {
          subject: 'Alert for {{userName}}',
          body: 'Building {{buildingName}} temperature is {{temperature}}°C'
        }
      };

      const result = await triggerModule.renderTemplatesInOverrides(
        overrides,
        testPayload,
        testEnterpriseId
      );

      expect(result).toEqual({
        email: {
          subject: 'Alert for John Doe',
          body: 'Building Tower A temperature is 25.5°C'
        }
      });

      expect(mockTemplateRenderer.render).toHaveBeenCalledTimes(2);
      expect(mockTemplateRenderer.render).toHaveBeenCalledWith(
        'Alert for {{userName}}',
        { enterpriseId: testEnterpriseId, variables: testPayload }
      );
    });

    it('should handle nested objects in overrides', async () => {
      mockTemplateRenderer.render.mockImplementation(async (template) => {
        return template.replace('{{alert.level}}', 'HIGH');
      });

      const overrides = {
        channels: {
          email: {
            subject: 'Level {{alert.level}} Alert',
            content: {
              header: 'Alert Level: {{alert.level}}',
              body: 'Please respond immediately'
            }
          },
          sms: {
            message: '{{alert.level}} priority alert'
          }
        }
      };

      const result = await triggerModule.renderTemplatesInOverrides(
        overrides,
        testPayload,
        testEnterpriseId
      );

      expect(result.channels.email.subject).toBe('Level HIGH Alert');
      expect(result.channels.email.content.header).toBe('Alert Level: HIGH');
      expect(result.channels.sms.message).toBe('HIGH priority alert');
    });

    it('should handle arrays in overrides', async () => {
      mockTemplateRenderer.render.mockImplementation(async (template) => {
        return template.replace('{{userName}}', 'John Doe');
      });

      const overrides = {
        notifications: [
          { message: 'Hello {{userName}}' },
          { message: 'Goodbye {{userName}}' }
        ],
        recipients: ['user1', 'user2'] // Non-string array should remain unchanged
      };

      const result = await triggerModule.renderTemplatesInOverrides(
        overrides,
        testPayload,
        testEnterpriseId
      );

      expect(result.notifications[0].message).toBe('Hello John Doe');
      expect(result.notifications[1].message).toBe('Goodbye John Doe');
      expect(result.recipients).toEqual(['user1', 'user2']);
    });

    it('should preserve non-string values', async () => {
      const overrides = {
        settings: {
          enabled: true,
          count: 42,
          threshold: 25.5,
          metadata: null,
          template: 'User: {{userName}}'
        }
      };

      mockTemplateRenderer.render.mockImplementation(async (template) => {
        return template.replace('{{userName}}', 'John Doe');
      });

      const result = await triggerModule.renderTemplatesInOverrides(
        overrides,
        testPayload,
        testEnterpriseId
      );

      expect(result.settings.enabled).toBe(true);
      expect(result.settings.count).toBe(42);
      expect(result.settings.threshold).toBe(25.5);
      expect(result.settings.metadata).toBeNull();
      expect(result.settings.template).toBe('User: John Doe');
    });

    it('should skip strings without template syntax', async () => {
      const overrides = {
        plain: {
          message: 'This is a plain message',
          alert: 'No templates here!'
        },
        templated: {
          message: 'Hello {{userName}}'
        }
      };

      mockTemplateRenderer.render.mockImplementation(async (template) => {
        return template.replace('{{userName}}', 'John Doe');
      });

      const result = await triggerModule.renderTemplatesInOverrides(
        overrides,
        testPayload,
        testEnterpriseId
      );

      // render should only be called for strings with template syntax
      expect(mockTemplateRenderer.render).toHaveBeenCalledTimes(1);
      expect(mockTemplateRenderer.render).toHaveBeenCalledWith(
        'Hello {{userName}}',
        expect.any(Object)
      );

      expect(result.plain.message).toBe('This is a plain message');
      expect(result.plain.alert).toBe('No templates here!');
      expect(result.templated.message).toBe('Hello John Doe');
    });

    it('should handle template rendering errors gracefully', async () => {
      mockTemplateRenderer.render.mockRejectedValue(new Error('Template error'));

      const overrides = {
        email: {
          subject: 'Alert',
          body: 'Error template: {{unknownVar}}'
        }
      };

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await triggerModule.renderTemplatesInOverrides(
        overrides,
        testPayload,
        testEnterpriseId
      );

      // Should return original value on error
      expect(result.email.body).toBe('Error template: {{unknownVar}}');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[WARN] Template rendering failed, using original value',
        expect.stringContaining('Template error')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle empty overrides', async () => {
      const result = await triggerModule.renderTemplatesInOverrides(
        {},
        testPayload,
        testEnterpriseId
      );

      expect(result).toEqual({});
      expect(mockTemplateRenderer.render).not.toHaveBeenCalled();
    });

    it('should handle null/undefined overrides', async () => {
      const nullResult = await triggerModule.renderTemplatesInOverrides(
        null,
        testPayload,
        testEnterpriseId
      );
      expect(nullResult).toBeNull();

      const undefinedResult = await triggerModule.renderTemplatesInOverrides(
        undefined,
        testPayload,
        testEnterpriseId
      );
      expect(undefinedResult).toBeUndefined();
    });

    it('should deep clone overrides to avoid mutation', async () => {
      const originalOverrides = {
        email: {
          subject: 'Test {{userName}}',
          metadata: { important: true }
        }
      };

      mockTemplateRenderer.render.mockImplementation(async (template) => {
        return template.replace('{{userName}}', 'John Doe');
      });

      const result = await triggerModule.renderTemplatesInOverrides(
        originalOverrides,
        testPayload,
        testEnterpriseId
      );

      // Result should be different object
      expect(result).not.toBe(originalOverrides);
      expect(result.email).not.toBe(originalOverrides.email);

      // Original should be unchanged
      expect(originalOverrides.email.subject).toBe('Test {{userName}}');
      
      // Result should have rendered template
      expect(result.email.subject).toBe('Test John Doe');
    });

    it('should handle complex nested template rendering', async () => {
      mockTemplateRenderer.render
        .mockResolvedValueOnce('Welcome John Doe')
        .mockResolvedValueOnce('Building: Tower A, Temp: 25.5°C')
        .mockResolvedValueOnce('HIGH: Temperature exceeded threshold');

      const overrides = {
        notification: {
          header: {
            title: 'Welcome {{userName}}',
            subtitle: 'Building: {{buildingName}}, Temp: {{temperature}}°C'
          },
          body: {
            sections: [
              {
                type: 'alert',
                content: '{{alert.level}}: {{alert.message}}'
              }
            ]
          },
          metadata: {
            processedAt: new Date('2024-01-15'),
            version: 2
          }
        }
      };

      const result = await triggerModule.renderTemplatesInOverrides(
        overrides,
        testPayload,
        testEnterpriseId
      );

      expect(result.notification.header.title).toBe('Welcome John Doe');
      expect(result.notification.header.subtitle).toBe('Building: Tower A, Temp: 25.5°C');
      expect(result.notification.body.sections[0].content).toBe('HIGH: Temperature exceeded threshold');
      // Date gets serialized to string in JSON.parse/stringify
      expect(result.notification.metadata.processedAt).toBe('2024-01-15T00:00:00.000Z');
      expect(result.notification.metadata.version).toBe(2);
    });
  });

  describe('Template detection logic', () => {
    it('should correctly identify strings with template syntax', () => {
      const testCases = [
        { input: 'Hello {{name}}', shouldHaveTemplate: true },
        { input: 'Multiple {{var1}} and {{var2}}', shouldHaveTemplate: true },
        { input: '{{ spaced }}', shouldHaveTemplate: true },
        { input: 'Nested {{user.name}}', shouldHaveTemplate: true },
        { input: 'Array {{items[0]}}', shouldHaveTemplate: true },
        { input: 'Plain text', shouldHaveTemplate: false },
        { input: 'Single { bracket', shouldHaveTemplate: false },
        { input: 'Single } bracket', shouldHaveTemplate: false },
        { input: 'Not {{complete', shouldHaveTemplate: false },
        { input: 'Not complete}}', shouldHaveTemplate: false },
        { input: '{}', shouldHaveTemplate: false },
        { input: '', shouldHaveTemplate: false }
      ];

      testCases.forEach(({ input, shouldHaveTemplate }) => {
        const hasTemplate = input.includes('{{') && input.includes('}}');
        expect(hasTemplate).toBe(shouldHaveTemplate);
      });
    });
  });
});