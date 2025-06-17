# XNovu Template Rendering Guide

## Overview

XNovu's template rendering engine provides a comprehensive, security-focused solution for dynamic content generation in multi-tenant notification workflows. The system has been architected with a modular design featuring enterprise-scoped template isolation, XSS prevention, and channel-specific rendering capabilities.

## Architecture Overview

### Core Components

The template system follows a clean separation of concerns with three main layers:

#### **Template Engine Core** (`app/services/template/core/`)
- **`TemplateEngine`** - Main orchestration engine handling rendering workflows
- **`TemplateParser`** - Parses XNovu render syntax and manages template composition
- **`VariableInterpolator`** - Handles variable substitution and context management

#### **Channel Renderers** (`app/services/template/renderers/`)
- **`BaseChannelRenderer`** - Abstract base class with common functionality
- **`EmailTemplateRenderer`** - Email-specific rendering with HTML-to-text conversion
- **`InAppTemplateRenderer`** - In-app notification rendering with strict sanitization
- **`SmsTemplateRenderer`** - SMS text-only rendering

#### **Data Access Layer** (`app/services/template/loaders/`)
- **`SupabaseTemplateLoader`** - Enterprise-scoped database integration
- **`TemplateLoader`** interface - Abstraction for different data sources

### Template Composition System

The system uses a custom `{{ xnovu_render() }}` syntax enabling powerful template composition:

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

#### Key Features:
- **Template nesting** with recursive rendering (max 10 levels)
- **Variable passing** between templates
- **Enterprise-scoped** template isolation
- **Circular dependency detection** and prevention

## Security Framework

### HTML Sanitization

The system implements comprehensive security measures using the `sanitize-html` library with channel-specific configurations:

#### **Email Channel Security** (`sanitizeConfig.ts`)
```typescript
{
  allowedTags: ['p', 'div', 'span', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                'ul', 'ol', 'li', 'a', 'img', 'br', 'hr', 'table', 'tr', 'td', 'th'],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height', 'style'],
    '*': ['style', 'class', 'id']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    'a': (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer'
      }
    })
  }
}
```

#### **In-App Channel Security**
- More restrictive than email
- Blocks all `style` attributes to prevent CSS injection
- Only allows basic formatting tags
- Adds `data-external-link` attributes for controlled link handling

#### **Text-Only Security**
- Strips all HTML tags completely
- Safely decodes HTML entities
- Prevents any markup injection

### XSS Prevention

Multi-layered XSS protection includes:

1. **Loop-Based Sanitization** - Handles malformed and nested malicious tags
2. **Variable Sanitization** - All variables are sanitized before interpolation
3. **Content Validation** - Templates are scanned for dangerous patterns
4. **Performance Protection** - Prevents infinite loops in sanitization

#### Recent Security Enhancements

The system now includes advanced protection against sophisticated XSS attempts:

```typescript
// EmailTemplateRenderer.ts - Loop-based script removal
do {
  previousText = text;
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script[^>]*>/gi, '');
} while (text !== previousText);

// Handles malformed tags like: </script\t\n bar>, </script disabled>
```

**Security Test Coverage:**
- Malformed script end tags with whitespace
- Nested script tags
- Style tags with malicious CSS
- Incomplete HTML tags
- Mixed content attacks
- Performance stress testing

### Content Safety Validation

Templates are validated for dangerous patterns before and after sanitization:

```typescript
interface SafetyValidation {
  safe: boolean;
  warnings: string[];
}
```

**Detected Threats:**
- Script tags (`<script>`)
- JavaScript protocols (`javascript:`, `vbscript:`)
- Event handlers (`onclick`, `onload`, etc.)
- CSS expressions (`expression()`)
- Document manipulation attempts
- Window object access

### Variable Sanitization

User-provided variables are sanitized before template interpolation:

```typescript
// Variables are sanitized based on channel type before rendering
const sanitizedVariables = sanitizeVariables(userVariables, channelType);
```

Features:
- **Recursive Sanitization** - Handles nested objects and arrays
- **Type Preservation** - Non-string values (numbers, booleans) are preserved
- **Channel-Specific** - Uses appropriate sanitization rules per channel

### Security Dependencies

- **sanitize-html**: ^2.17.0 - Core HTML sanitization library
- **@types/sanitize-html**: ^2.16.0 - TypeScript definitions

### Security Configuration Files

- `app/services/template/utils/sanitizeConfig.ts` - Main configuration
- `app/services/template/renderers/BaseChannelRenderer.ts` - Base sanitization logic
- Channel-specific renderers implement sanitization overrides

## Channel-Specific Rendering

### Email Template Renderer

Features specialized for email delivery:

```typescript
import { EmailTemplateRenderer } from '@/app/services/template/renderers/EmailTemplateRenderer';

const renderer = new EmailTemplateRenderer(templateLoader);

const result = await renderer.renderByKey(
  'welcome-email',
  {
    userName: 'John Doe',
    companyName: 'Acme Corp',
    logoUrl: 'https://example.com/logo.png'
  },
  {
    includeTextVersion: true,
    subjectPrefix: '[Important]'
  }
);

console.log(result.subject);    // Email subject line
console.log(result.body);       // HTML body content
console.log(result.textBody);   // Plain text version
```

#### Email-Specific Features:
- **Subject extraction** from content or metadata
- **HTML-to-text conversion** for plain text versions
- **Email variable defaults** (unsubscribeUrl, currentYear, preferencesUrl)
- **Size validation** (100KB limit)
- **Subject prefix support** for categorization

### In-App Template Renderer

Optimized for UI integration:

```typescript
import { InAppTemplateRenderer } from '@/app/services/template/renderers/InAppTemplateRenderer';

const renderer = new InAppTemplateRenderer(templateLoader);

const result = await renderer.renderByKey(
  'maintenance-alert',
  {
    buildingName: 'North Tower',
    maintenanceDate: '2024-03-15',
    startTime: '2:00 AM',
    endTime: '6:00 AM'
  }
);

console.log(result.body);       // Sanitized HTML for UI display
```

#### In-App-Specific Features:
- **Stricter sanitization** for UI safety
- **Class-based styling** support for theme integration
- **External link handling** with data attributes
- **Notification-specific defaults** (timestamp, priority indicators)

### SMS Template Renderer

Text-only rendering for mobile delivery:

```typescript
import { SmsTemplateRenderer } from '@/app/services/template/renderers/SmsTemplateRenderer';

const renderer = new SmsTemplateRenderer(templateLoader);

const result = await renderer.renderByKey(
  'alert-sms',
  {
    alertType: 'Security',
    building: 'Main Building',
    timestamp: '2024-03-15 14:30'
  }
);

console.log(result.body);       // Plain text content
```

#### SMS-Specific Features:
- **Complete HTML stripping** for text-only output
- **Length validation** for SMS limits
- **URL shortening** compatibility
- **Character encoding** safety

## Workflow Integration

### Direct Integration with Novu Workflows

```typescript
import { renderEmailTemplate, renderInAppTemplate, renderSmsTemplate } from '@/app/services/template/WorkflowTemplateIntegration';

export const alertWorkflow = workflow(
  'building-alert',
  async ({ step, payload }) => {
    // Email notification with template
    await step.email('alert-email', async () => {
      const { subject, body } = await renderEmailTemplate(
        payload.enterpriseId,
        'emergency-alert-email',
        {
          alertType: payload.alertType,
          buildingName: payload.buildingName,
          severity: payload.severity,
          instructions: payload.instructions
        }
      );
      return { subject, body };
    });

    // In-app notification
    await step.inApp('alert-notification', async () => {
      const { body } = await renderInAppTemplate(
        payload.enterpriseId,
        'emergency-alert-inapp',
        payload
      );
      return { body };
    });

    // SMS for critical alerts
    if (payload.severity === 'critical') {
      await step.sms('alert-sms', async () => {
        const { body } = await renderSmsTemplate(
          payload.enterpriseId,
          'emergency-alert-sms',
          payload
        );
        return { body };
      });
    }
  }
);
```

### Template Validation in Workflows

```typescript
import { WorkflowTemplateIntegration } from '@/app/services/template/WorkflowTemplateIntegration';

const integration = new WorkflowTemplateIntegration();

// Validate template before rendering
const isValid = await integration.validateTemplate(
  'welcome-email',
  'enterprise-123',
  'EMAIL'
);

if (isValid) {
  // Proceed with rendering
  const result = await integration.renderEmailTemplate(
    'enterprise-123',
    'welcome-email',
    variables
  );
}
```

## Database Schema

Templates are stored in the `notify.ent_notification_template` table with enterprise scoping:

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

### Key Schema Features:
- **Enterprise isolation** via `enterprise_id`
- **Channel-specific** templates via `channel_type`
- **Semantic keys** for human-readable template identification
- **Publish status** control for template lifecycle
- **Variable documentation** via `variables_description` JSON field

## Caching & Performance

### Intelligent Caching System

The template system includes enterprise-scoped caching for optimal performance:

```typescript
// Cache configuration
{
  defaultTTL: 300000,    // 5 minutes
  keyPrefix: 'template:',
  enterpriseScoped: true  // Prevents cross-tenant cache leaks
}

// Cache key format: template:{enterpriseId}:{templateKey}:{channelType}
```

#### Caching Features:
- **5-minute default TTL** with configurable expiration
- **Enterprise-scoped keys** for tenant isolation  
- **Cache statistics** tracking (hits, misses, expired entries)
- **Automatic cleanup** of expired entries
- **Memory-efficient** LRU eviction policy

### Performance Optimizations

1. **Template Preloading** - Bulk load frequently used templates
2. **Recursive Depth Limiting** - Prevents infinite template loops
3. **Variable Context Reuse** - Minimize object creation
4. **Sanitization Caching** - Cache sanitized content when safe

## Error Handling & Debugging

### Comprehensive Error Reporting

```typescript
try {
  const result = await renderer.renderByKey('template-key', context);
} catch (error) {
  if (error.message.includes('Template not found')) {
    // Handle missing template
    console.log('Template does not exist or is not published');
  } else if (error.message.includes('Circular dependency')) {
    // Handle circular template references
    console.log('Templates have circular dependencies');
  } else if (error.message.includes('Variable interpolation failed')) {
    // Handle variable substitution errors
    console.log('Required variables missing or invalid');
  }
}
```

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
const renderer = new EmailTemplateRenderer(loader, { debug: true });

// Will log:
// - Template loading operations
// - Cache hits/misses
// - Variable interpolation steps
// - Sanitization operations
// - Render timing metrics
```

### Render Metadata

All renderers provide detailed metadata:

```typescript
const result = await renderer.renderByKey('template-key', context);

console.log(result.metadata);
// {
//   renderTimeMs: 45,
//   templatesLoaded: ['header', 'footer', 'content'],
//   cacheHits: 2,
//   cacheMisses: 1,
//   safetyValidation: {
//     safe: true,
//     warnings: []
//   }
// }
```

## Testing Framework

### Security Testing

The system includes comprehensive security test coverage:

```typescript
// SecurityFixes.test.ts example
describe('Security Fixes for GitHub Actions Bot Recommendations', () => {
  it('should handle malformed script end tags with various whitespace', async () => {
    const maliciousHtml = `
      <script>alert('xss')</script >
      <script>alert('mixed')</script\t\n bar>
      <script>alert('attrs')</script disabled class="test">
    `;

    const result = renderer.htmlToText(maliciousHtml);
    
    expect(result).not.toContain('alert');
    expect(result).not.toContain('xss');
  });
});
```

### Template Rendering Tests

```typescript
describe('Template Rendering', () => {
  it('should render nested templates correctly', async () => {
    const result = await renderer.renderByKey(
      'parent-template',
      { headerTitle: 'Welcome', userName: 'John' }
    );

    expect(result.content).toContain('Welcome');
    expect(result.content).toContain('John');
    expect(result.metadata.templatesLoaded).toContain('header');
  });

  it('should prevent circular template dependencies', async () => {
    await expect(
      renderer.renderByKey('circular-template', {})
    ).rejects.toThrow('Circular dependency detected');
  });
});
```

## Best Practices

### Template Design

1. **Use Semantic Keys**
   ```
   ✅ Good: welcome-email, password-reset, maintenance-alert
   ❌ Bad: template1, email_temp, WelcomeEmail
   ```

2. **Create Reusable Components**
   ```html
   <!-- Shared components -->
   {{ xnovu_render("email-header", { logoUrl: "{{logoUrl}}" }) }}
   {{ xnovu_render("email-footer", { companyName: "{{companyName}}" }) }}
   ```

3. **Variable Naming Consistency**
   ```html
   ✅ Good: {{userName}}, {{companyName}}, {{buildingName}}
   ❌ Bad: {{user_name}}, {{company}}, {{building}}
   ```

### Security Best Practices

1. **Always Sanitize Variables**
   ```typescript
   // Variables are automatically sanitized, but validate input
   const safeVariables = validateVariables(userInput);
   const result = await renderer.renderByKey('template', safeVariables);
   ```

2. **Enterprise Isolation**
   ```typescript
   // Never allow cross-enterprise template access
   const result = await renderer.renderByKey(
     templateKey,
     currentUserEnterpriseId,  // Always use authenticated user's enterprise
     variables
   );
   ```

3. **Template Content Validation**
   ```typescript
   // Validate templates before publishing
   const validation = renderer.validateTemplate(templateContent);
   if (!validation.safe) {
     console.warn('Template contains unsafe content:', validation.warnings);
   }
   ```

4. **Input Validation**
   - Always sanitize user-provided variables
   - Validate template content before storage
   - Use enterprise isolation for templates

5. **Template Development**
   - Avoid inline JavaScript or event handlers
   - Use semantic HTML elements when possible
   - Test templates with malicious input

6. **Channel Selection**
   - Use most restrictive channel (In-App) when possible
   - Reserve Email templates for rich formatting needs
   - Use SMS/Push for text-only communications

7. **Monitoring**
   - Monitor safety validation warnings
   - Log XSS attempt patterns
   - Review failed sanitization reports

### Advanced Security Options

```typescript
// For trusted content only - use with extreme caution
const result = await renderer.render(template, context, {
  sanitize: false,
  validateSafety: false
});

// Safety validation is included in result
console.log(result.safetyValidation.safe); // true/false
console.log(result.safetyValidation.warnings); // Array of warnings
```

### Security Compliance

This implementation helps meet security requirements for:
- XSS prevention
- Content Security Policy (CSP) compliance  
- Input validation standards
- Template injection prevention

### Performance Guidelines

1. **Leverage Caching**
   - Templates are cached for 5 minutes by default
   - Use template keys consistently to maximize cache hits

2. **Minimize Template Depth**
   - Limit nesting to 3-4 levels for optimal performance
   - Avoid deeply recursive template structures

3. **Monitor Render Performance**
   ```typescript
   const result = await renderer.renderByKey('template', variables);
   if (result.metadata.renderTimeMs > 1000) {
     console.warn('Slow template render detected:', result.metadata);
   }
   ```

## Migration Guide

### From Legacy Template System

For systems migrating from numeric ID-based templates:

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
   .eq('channel_type', channelType)
   ```

3. **Update Workflow Integration**
   ```typescript
   // Old approach
   await step.email('step', async () => {
     const template = await loadTemplateById(templateId);
     return { subject: template.subject, body: template.content };
   });
   
   // New approach
   await step.email('step', async () => {
     return await renderEmailTemplate(
       enterpriseId,
       'welcome-email',
       variables
     );
   });
   ```

## API Reference

### Core Classes

#### TemplateEngine
```typescript
class TemplateEngine {
  constructor(
    loader: TemplateLoader,
    options?: { maxDepth?: number; debug?: boolean }
  );
  
  async render(
    template: NotificationTemplate,
    context: TemplateContext,
    options?: RenderOptions
  ): Promise<RenderResult>;
  
  async validateTemplate(
    template: NotificationTemplate,
    context?: Partial<TemplateContext>
  ): Promise<ValidationResult>;
}
```

#### Channel Renderers
```typescript
// Base renderer interface
interface ChannelRenderer {
  render(template: string, context: TemplateContext, options?: ChannelRenderOptions): Promise<ChannelRenderResult>;
  renderByKey(templateKey: string, context: TemplateContext, options?: ChannelRenderOptions): Promise<ChannelRenderResult>;
}

// Email-specific renderer
class EmailTemplateRenderer extends BaseChannelRenderer {
  constructor(templateLoader: TemplateLoader, options?: { debug?: boolean });
  
  async render(
    template: string,
    context: TemplateContext,
    options?: EmailRenderOptions
  ): Promise<EmailRenderResult>;
}
```

#### Template Loader
```typescript
interface TemplateLoader {
  loadTemplate(templateKey: string, enterpriseId: string, channelType: string): Promise<NotificationTemplate>;
  clearCache(templateKey?: string, enterpriseId?: string): void;
  getStats(): CacheStats;
}

class SupabaseTemplateLoader implements TemplateLoader {
  constructor(supabaseClient: SupabaseClient, options?: CacheOptions);
}
```

### Workflow Integration Functions

```typescript
// Email rendering
export async function renderEmailTemplate(
  enterpriseId: string,
  templateKey: string,
  variables: Record<string, any>,
  options?: EmailRenderOptions
): Promise<{ subject: string; body: string }>;

// In-app rendering
export async function renderInAppTemplate(
  enterpriseId: string,
  templateKey: string,
  variables: Record<string, any>
): Promise<{ body: string }>;

// SMS rendering
export async function renderSmsTemplate(
  enterpriseId: string,
  templateKey: string,
  variables: Record<string, any>
): Promise<{ body: string }>;

// Template validation
export async function validateTemplate(
  templateKey: string,
  enterpriseId: string,
  channelType: string
): Promise<boolean>;
```

### Type Definitions

```typescript
interface TemplateContext {
  enterpriseId: string;
  variables: Record<string, any>;
  channelType: 'EMAIL' | 'IN_APP' | 'SMS' | 'PUSH' | 'CHAT';
  metadata?: Record<string, any>;
}

interface RenderResult {
  content: string;
  subject?: string;
  metadata?: {
    renderTimeMs: number;
    templatesLoaded: string[];
    cacheHits: number;
    cacheMisses: number;
    safetyValidation?: {
      safe: boolean;
      warnings: string[];
    };
  };
}

interface NotificationTemplate {
  id: string;
  template_key: string;
  enterprise_id: string;
  channel_type: string;
  name: string;
  description?: string;
  subject?: string;
  content: string;
  variables_description?: Record<string, any>;
  publish_status: 'DRAFT' | 'PUBLISHED';
  deactivated: boolean;
}
```

## Troubleshooting

### Common Issues

1. **Template Not Found**
   ```
   Error: Template 'template-key' not found for enterprise 'enterprise-id'
   ```
   - Verify template exists in database
   - Check `publish_status` is 'PUBLISHED'
   - Ensure `deactivated` is false
   - Confirm `channel_type` matches request

2. **Circular Dependency**
   ```
   Error: Circular dependency detected in template chain
   ```
   - Review template references for loops
   - Use dependency visualization tools
   - Implement template hierarchy validation

3. **Variable Interpolation Issues**
   ```
   Error: Variable 'variableName' not found in template context
   ```
   - Check variable names match exactly (case-sensitive)
   - Ensure all required variables are provided
   - Review template variable documentation

4. **Security Validation Failures**
   ```
   Warning: Template contains potentially unsafe content
   ```
   - Review template for blocked HTML tags
   - Check for dangerous CSS expressions
   - Validate external URLs and links

5. **Performance Issues**
   ```
   Warning: Template render time exceeded threshold
   ```
   - Check template nesting depth
   - Review cache hit rates
   - Monitor template complexity

### Debug Mode Output

When debug mode is enabled, you'll see detailed logging:

```
[Template Debug] Loading template: welcome-email (enterprise: ent-123)
[Template Debug] Cache miss - loading from database
[Template Debug] Parsing xnovu_render syntax: found 3 references
[Template Debug] Loading nested template: email-header
[Template Debug] Cache hit - using cached template
[Template Debug] Variable interpolation: 5 variables processed
[Template Debug] Sanitization: email channel config applied
[Template Debug] Render complete: 87ms total
```

## Conclusion

XNovu's template rendering system provides enterprise-grade functionality with comprehensive security, performance optimization, and developer-friendly APIs. The modular architecture enables flexible content generation while maintaining strict tenant isolation and XSS prevention.

For additional examples and working implementations, refer to the test files in `__tests__/unit/template/` and the workflow examples in `app/novu/workflows/`.