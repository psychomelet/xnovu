# XNovu Template Rendering Guide

## Overview

XNovu's template rendering engine enables dynamic content generation using a custom `{{ xnovu_render() }}` syntax. This system allows templates to reference other templates, creating a powerful composition system for multi-tenant notification workflows.

## Core Concepts

### Template Keys
Templates are identified by semantic keys rather than numeric IDs:
- Format: `kebab-case-template-name`
- Examples: `welcome-email`, `password-reset`, `maintenance-alert`
- Must be unique within an enterprise scope

### Enterprise Scoping
All templates are scoped to specific enterprises, ensuring complete tenant isolation:
```typescript
// Templates are always loaded with enterprise context
const template = await renderer.loadTemplate('welcome-email', 'enterprise-123');
```

### XNovu Render Syntax
The custom template syntax enables template composition and variable interpolation:

```html
<!-- Basic template reference -->
{{ xnovu_render("shared-header", { companyName: "Acme Corp" }) }}

<!-- Template with multiple variables -->
{{ xnovu_render("user-details", { 
  userName: "John Doe", 
  userEmail: "john@example.com",
  role: "admin" 
}) }}

<!-- Nested template rendering -->
{{ xnovu_render("email-layout", { 
  content: "{{ xnovu_render('alert-content', { severity: 'high' }) }}"
}) }}
```

## Template Structure

### Database Schema
Templates are stored in the `notify.ent_notification_template` table:

```sql
CREATE TABLE notify.ent_notification_template (
  id uuid PRIMARY KEY,
  template_key text NOT NULL,
  enterprise_id uuid NOT NULL,
  channel_type notification_channel_type NOT NULL,
  name text NOT NULL,
  description text,
  subject text,
  content text NOT NULL,
  variables_description jsonb,
  publish_status template_publish_status DEFAULT 'DRAFT',
  deactivated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(template_key, enterprise_id, channel_type)
);
```

### Template Content Examples

#### Email Template
```html
<!-- template_key: "welcome-email" -->
<div style="font-family: Arial, sans-serif;">
  {{ xnovu_render("email-header", { logoUrl: "{{logoUrl}}" }) }}
  
  <h1>Welcome {{userName}}!</h1>
  <p>Thank you for joining {{companyName}}. Your account has been created successfully.</p>
  
  {{ xnovu_render("email-footer", { 
    companyName: "{{companyName}}",
    unsubscribeUrl: "{{unsubscribeUrl}}"
  }) }}
</div>
```

#### Shared Header Template
```html
<!-- template_key: "email-header" -->
<div style="background: #f8f9fa; padding: 20px; text-align: center;">
  <img src="{{logoUrl}}" alt="Company Logo" style="max-height: 60px;">
</div>
```

#### In-App Notification Template
```html
<!-- template_key: "maintenance-alert" -->
<div class="alert alert-warning">
  <strong>Scheduled Maintenance</strong>
  <p>{{buildingName}} will undergo maintenance on {{maintenanceDate}} from {{startTime}} to {{endTime}}.</p>
  {{ xnovu_render("contact-info", { supportEmail: "{{supportEmail}}" }) }}
</div>
```

## Using the Template Renderer

### Basic Usage

```typescript
import { TemplateRenderer } from '@/app/services/template/TemplateRenderer';

const renderer = new TemplateRenderer();

// Render a template with variables
const result = await renderer.renderTemplate(
  'welcome-email',
  'enterprise-123',
  {
    userName: 'John Doe',
    companyName: 'Acme Corp',
    logoUrl: 'https://example.com/logo.png'
  }
);

console.log(result.content); // Fully rendered HTML
console.log(result.subject); // Rendered subject line
```

### Advanced Usage with Caching

```typescript
// The renderer automatically caches templates for 5 minutes
// Subsequent requests within the TTL will use cached templates

const renderer = new TemplateRenderer();

// First call - loads from database
const result1 = await renderer.renderTemplate('welcome-email', 'enterprise-123', variables);

// Second call - uses cached template
const result2 = await renderer.renderTemplate('welcome-email', 'enterprise-123', variables);
```

### Error Handling

```typescript
try {
  const result = await renderer.renderTemplate('non-existent-template', 'enterprise-123', {});
} catch (error) {
  if (error.message.includes('Template not found')) {
    // Handle missing template
    console.log('Template does not exist or is not published');
  } else if (error.message.includes('Circular dependency')) {
    // Handle circular template references
    console.log('Templates have circular dependencies');
  }
}
```

## Workflow Integration

### Email Workflows

```typescript
import { renderEmailTemplate } from '@/app/services/template/WorkflowTemplateIntegration';

export const templateDemoWorkflow = workflow(
  'template-demo',
  async ({ step, payload }) => {
    await step.email('templated-email', async () => {
      const { subject, body } = await renderEmailTemplate(
        payload.enterpriseId,
        'welcome-email',
        {
          userName: payload.userName,
          companyName: payload.companyName,
          logoUrl: payload.logoUrl
        }
      );

      return { subject, body };
    });
  },
  {
    payloadSchema: z.object({
      enterpriseId: z.string(),
      userName: z.string(),
      companyName: z.string(),
      logoUrl: z.string()
    })
  }
);
```

### Multi-Channel Workflows

```typescript
export const alertWorkflow = workflow(
  'building-alert',
  async ({ step, payload }) => {
    // Email notification
    await step.email('alert-email', async () => {
      const { subject, body } = await renderEmailTemplate(
        payload.enterpriseId,
        'alert-email',
        payload.alertData
      );
      return { subject, body };
    });

    // In-app notification
    await step.inApp('alert-in-app', async () => {
      const { body } = await renderInAppTemplate(
        payload.enterpriseId,
        'alert-in-app',
        payload.alertData
      );
      return { body };
    });

    // SMS for critical alerts
    if (payload.priority === 'critical') {
      await step.sms('alert-sms', async () => {
        const { body } = await renderSmsTemplate(
          payload.enterpriseId,
          'alert-sms',
          payload.alertData
        );
        return { body };
      });
    }
  }
);
```

## React Email Integration

### Template-Aware Email Components

```tsx
import { TemplateAwareEmail } from '@/app/services/template/TemplateAwareEmail';

// Use in workflow
await step.email('templated-email', async () => {
  const emailHtml = await renderTemplateAwareEmail(
    'welcome-email',
    'enterprise-123',
    {
      userName: 'John Doe',
      companyName: 'Acme Corp'
    }
  );

  return {
    subject: 'Welcome to Our Platform',
    body: emailHtml
  };
});
```

### Creating Template-Aware Components

```tsx
import React from 'react';
import { Html, Body, Container } from '@react-email/components';

interface CustomEmailProps {
  enterpriseId: string;
  templateKey: string;
  variables: Record<string, any>;
}

export const CustomTemplateEmail: React.FC<CustomEmailProps> = ({
  enterpriseId,
  templateKey,
  variables
}) => {
  return (
    <Html>
      <Body>
        <Container>
          <TemplateAwareEmail
            enterpriseId={enterpriseId}
            templateKey={templateKey}
            variables={variables}
          />
        </Container>
      </Body>
    </Html>
  );
};
```

## Best Practices

### Template Organization

1. **Use Semantic Keys**: Choose descriptive, kebab-case template keys
   ```
   ✅ Good: welcome-email, password-reset, maintenance-alert
   ❌ Bad: template1, email_temp, WelcomeEmail
   ```

2. **Create Reusable Components**: Break common elements into shared templates
   ```html
   <!-- Shared header -->
   {{ xnovu_render("email-header", { logoUrl: "{{logoUrl}}" }) }}
   
   <!-- Shared footer -->
   {{ xnovu_render("email-footer", { companyName: "{{companyName}}" }) }}
   ```

3. **Use Consistent Variable Names**: Maintain naming conventions across templates
   ```html
   ✅ Good: {{userName}}, {{companyName}}, {{buildingName}}
   ❌ Bad: {{user_name}}, {{company}}, {{building}}
   ```

### Performance Optimization

1. **Leverage Caching**: Templates are cached for 5 minutes by default
2. **Minimize Template Depth**: Avoid deeply nested template references
3. **Use Batch Operations**: When rendering multiple templates, consider batching

### Error Prevention

1. **Validate Template References**: Ensure referenced templates exist
2. **Handle Missing Variables**: Provide default values or error handling
3. **Test Template Rendering**: Include template rendering in your test suite

### Security Considerations

1. **Sanitize Variables**: Always sanitize user input before template rendering
2. **Enterprise Isolation**: Never allow cross-enterprise template access
3. **Validate Template Content**: Ensure templates don't contain malicious code

## Testing Templates

### Unit Testing Template Rendering

```typescript
import { TemplateRenderer } from '@/app/services/template/TemplateRenderer';

describe('Template Rendering', () => {
  let renderer: TemplateRenderer;

  beforeEach(() => {
    renderer = new TemplateRenderer();
  });

  it('should render basic template with variables', async () => {
    const result = await renderer.renderTemplate(
      'test-template',
      'test-enterprise',
      { userName: 'John Doe' }
    );

    expect(result.content).toContain('John Doe');
  });

  it('should handle nested template rendering', async () => {
    const result = await renderer.renderTemplate(
      'nested-template',
      'test-enterprise',
      { headerTitle: 'Welcome' }
    );

    expect(result.content).toContain('Welcome');
  });

  it('should throw error for circular dependencies', async () => {
    await expect(
      renderer.renderTemplate('circular-template', 'test-enterprise', {})
    ).rejects.toThrow('Circular dependency detected');
  });
});
```

### Integration Testing with Workflows

```typescript
import { serve } from '@novu/framework/next';
import { testWorkflow } from './test-workflow';

describe('Template Workflow Integration', () => {
  it('should render email template in workflow', async () => {
    const result = await testWorkflow.trigger({
      to: { subscriberId: 'test-user' },
      payload: {
        enterpriseId: 'test-enterprise',
        templateKey: 'welcome-email',
        variables: { userName: 'John Doe' }
      }
    });

    expect(result.steps.email.subject).toBeDefined();
    expect(result.steps.email.body).toContain('John Doe');
  });
});
```

## Troubleshooting

### Common Issues

1. **Template Not Found**
   ```
   Error: Template 'template-key' not found for enterprise 'enterprise-id'
   ```
   - Verify template exists in database
   - Check publish_status is 'PUBLISH'
   - Ensure deactivated is false

2. **Circular Dependency**
   ```
   Error: Circular dependency detected in template chain
   ```
   - Review template references for loops
   - Use dependency graph to identify cycles

3. **Variable Interpolation Issues**
   ```
   Error: Variable 'variableName' not found in template context
   ```
   - Check variable names match exactly
   - Ensure all required variables are provided

4. **Caching Issues**
   ```
   Problem: Template changes not reflecting immediately
   ```
   - Templates are cached for 5 minutes
   - For development, consider shorter TTL or cache invalidation

### Debug Mode

Enable debug logging to troubleshoot template rendering:

```typescript
const renderer = new TemplateRenderer({ debug: true });

// Will log template loading, parsing, and rendering steps
const result = await renderer.renderTemplate('template-key', 'enterprise-id', variables);
```

## Migration Guide

### From Legacy Template System

If migrating from a numeric ID-based template system:

1. **Update Template References**
   ```html
   <!-- Old syntax -->
   {{ xnovu_render(123, { vars }) }}
   
   <!-- New syntax -->
   {{ xnovu_render("template-key", { vars }) }}
   ```

2. **Update Database Queries**
   ```typescript
   // Old query
   .eq('id', templateId)
   
   // New query
   .eq('template_key', templateKey)
   .eq('enterprise_id', enterpriseId)
   ```

3. **Update Workflow Payloads**
   ```typescript
   // Old payload
   { templateId: 123, variables: {...} }
   
   // New payload
   { templateKey: 'welcome-email', variables: {...} }
   ```

## Performance Considerations

### Template Caching

- Templates are cached in memory for 5 minutes
- Cache key format: `template:{enterpriseId}:{templateKey}`
- Cache is enterprise-scoped to prevent cross-tenant data leaks

### Optimization Strategies

1. **Minimize Database Queries**: Use caching effectively
2. **Reduce Template Complexity**: Limit nesting depth
3. **Batch Template Loading**: Load multiple templates in single query when possible
4. **Monitor Performance**: Track template rendering times

## API Reference

### TemplateRenderer Class

```typescript
class TemplateRenderer {
  constructor(options?: { debug?: boolean });
  
  async renderTemplate(
    templateKey: string,
    enterpriseId: string,
    variables: Record<string, any>
  ): Promise<{ content: string; subject?: string }>;
  
  async loadTemplate(
    templateKey: string,
    enterpriseId: string
  ): Promise<NotificationTemplate>;
  
  parseXNovuRenderSyntax(content: string): Array<{
    fullMatch: string;
    templateKey: string;
    variables: Record<string, any>;
  }>;
}
```

### WorkflowTemplateIntegration Functions

```typescript
export async function renderEmailTemplate(
  enterpriseId: string,
  templateKey: string,
  variables: Record<string, any>
): Promise<{ subject: string; body: string }>;

export async function renderInAppTemplate(
  enterpriseId: string,
  templateKey: string,
  variables: Record<string, any>
): Promise<{ body: string }>;

export async function renderSmsTemplate(
  enterpriseId: string,
  templateKey: string,
  variables: Record<string, any>
): Promise<{ body: string }>;
```

This guide provides comprehensive coverage of XNovu's template rendering system. For additional support or questions, refer to the test files in `__tests__/` for working examples.