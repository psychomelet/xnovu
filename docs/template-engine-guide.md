# XNovu Template Engine Guide

## Overview

The XNovu template engine is a powerful, secure, and flexible system for rendering dynamic content across multiple notification channels (email, SMS, in-app notifications). Built on top of [Liquid.js](https://liquidjs.com/), it provides enterprise-grade template rendering with security features, custom filters, and channel-specific optimizations.

## Core Architecture

### Template Engine Components

```typescript
// Core engine interface
import { TemplateEngine, LiquidTemplateEngine } from '@/app/services/template'

// Template loading and caching
import { SupabaseTemplateLoader } from '@/app/services/template'

// Channel-specific renderers
import { 
  EmailTemplateRenderer, 
  InAppTemplateRenderer, 
  SmsTemplateRenderer 
} from '@/app/services/template'
```

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    XNovu Template System                    │
├─────────────────────────────────────────────────────────────┤
│ WorkflowTemplateIntegration (Main Entry Point)             │
├─────────────────────────────────────────────────────────────┤
│ Channel Renderers                                           │
│ ├── EmailTemplateRenderer   (HTML + Text)                  │
│ ├── InAppTemplateRenderer   (HTML + Markdown)              │
│ └── SmsTemplateRenderer     (Plain Text)                   │
├─────────────────────────────────────────────────────────────┤
│ Core Template Engine                                        │
│ ├── LiquidTemplateEngine    (Liquid.js + Custom Filters)   │
│ ├── TemplateEngine          (Wrapper + API)                │
│ └── SupabaseTemplateLoader  (Database Integration)         │
├─────────────────────────────────────────────────────────────┤
│ Security & Utilities                                        │
│ ├── HTML Sanitization      (XSS Prevention)                │
│ ├── Channel Sanitization   (Channel-specific Safety)       │
│ └── Input Validation       (Schema Validation)             │
└─────────────────────────────────────────────────────────────┘
```

## Template Syntax

### Basic Liquid Syntax

XNovu uses standard Liquid template syntax with custom extensions:

```liquid
<!-- Variables -->
Hello {{ user.name }}!

<!-- Conditionals -->
{% if user.isPremium %}
  <p>Welcome, premium member!</p>
{% else %}
  <p>Welcome!</p>
{% endif %}

<!-- Loops -->
{% for item in items %}
  <li>{{ item.name }}: {{ item.price | currency }}</li>
{% endfor %}

<!-- Filters -->
{{ content | markdown_to_html | sanitize_email }}
```

### XNovu Template Includes

Use the `xnovu_render` tag to include other templates:

```liquid
<!-- Include header template -->
{% xnovu_render "email-header", 
  companyName: company.name,
  logoUrl: company.logoUrl 
%}

<!-- Include with conditional data -->
{% if user.preferences.includeFooter %}
  {% xnovu_render "email-footer", 
    unsubscribeUrl: unsubscribeUrl,
    currentYear: "now" | date: "%Y" 
  %}
{% endif %}
```

## Custom Liquid Filters

### Content Transformation Filters

#### `html_to_text`
Converts HTML content to plain text, preserving structure:

```liquid
<!-- Input: "<h1>Hello</h1><p>World</p>" -->
{{ htmlContent | html_to_text }}
<!-- Output: "Hello\n\nWorld" -->
```

#### `markdown_to_html`
Converts Markdown to HTML with security sanitization:

```liquid
<!-- Input: "# Hello\n\n**Bold** text" -->
{{ markdownContent | markdown_to_html }}
<!-- Output: "<h1>Hello</h1><p><strong>Bold</strong> text</p>" -->
```

#### `strip_html`
Removes all HTML tags, leaving only text content:

```liquid
<!-- Input: "<p>Hello <strong>world</strong>!</p>" -->
{{ htmlContent | strip_html }}
<!-- Output: "Hello world!" -->
```

### Channel-Specific Sanitization Filters

#### `sanitize_email`
Sanitizes content for email channels (allows safe HTML):

```liquid
{{ content | sanitize_email }}
<!-- Allows: p, h1-h6, strong, em, a, img, ul, ol, li -->
<!-- Removes: script, style, iframe, object, embed -->
```

#### `sanitize_inapp`
Sanitizes content for in-app notifications (basic HTML):

```liquid
{{ content | sanitize_inapp }}
<!-- Allows: p, span, strong, em, a, br -->
<!-- Removes: Complex HTML structures -->
```

#### `sanitize_sms`
Sanitizes content for SMS (text only):

```liquid
{{ content | sanitize_sms }}
<!-- Strips all HTML tags and converts to plain text -->
```

### Email-Specific Filters

#### `extract_subject`
Extracts subject and body from email content:

```liquid
{% assign emailData = content | extract_subject %}
Subject: {{ emailData.subject }}
Body: {{ emailData.body }}
```

### Utility Filters

#### `json`
Safely converts objects to JSON strings:

```liquid
<script>
  const userData = {{ user | json }};
</script>
```

#### `default`
Provides fallback values for empty/null variables:

```liquid
Hello {{ user.name | default: "Guest" }}!
Company: {{ company.name | default: "XNovu" }}
```

## Complete Template Examples

### Email Template

```liquid
{% comment %} 
Email template with full feature set 
{% endcomment %}

{% assign emailContent = content | extract_subject %}

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ emailContent.subject | default: "Notification" }}</title>
</head>
<body>
  <!-- Header with branding -->
  {% xnovu_render "email-header", 
    companyName: company.name | default: "XNovu",
    logoUrl: company.logoUrl 
  %}
  
  <!-- Main content -->
  <div class="content" style="padding: 20px;">
    <h1>{{ emailContent.subject | escape }}</h1>
    
    <!-- Convert markdown to HTML and sanitize for email -->
    {{ emailContent.body | markdown_to_html | sanitize_email }}
    
    <!-- Dynamic action button -->
    {% if actionUrl %}
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{ actionUrl }}" 
           style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
          {{ actionText | default: "Take Action" }}
        </a>
      </div>
    {% endif %}
  </div>
  
  <!-- Footer with unsubscribe -->
  {% xnovu_render "email-footer", 
    unsubscribeUrl: unsubscribeUrl,
    currentYear: "now" | date: "%Y",
    companyAddress: company.address 
  %}
</body>
</html>
```

### In-App Notification Template

```liquid
{% comment %} 
In-app notification with rich content 
{% endcomment %}

<div class="notification-card">
  <!-- Notification header -->
  <div class="notification-header">
    {% if iconUrl %}
      <img src="{{ iconUrl }}" alt="Icon" class="notification-icon">
    {% endif %}
    <h3 class="notification-title">{{ title | escape }}</h3>
    <span class="notification-time">{{ timestamp | date: "%B %d, %Y at %I:%M %p" }}</span>
  </div>
  
  <!-- Notification content -->
  <div class="notification-content">
    <!-- Convert markdown and sanitize for in-app display -->
    {{ message | markdown_to_html | sanitize_inapp }}
    
    <!-- Metadata display -->
    {% if metadata %}
      <div class="notification-metadata">
        {% for item in metadata %}
          <span class="metadata-item">
            <strong>{{ item.label }}:</strong> {{ item.value | escape }}
          </span>
        {% endfor %}
      </div>
    {% endif %}
  </div>
  
  <!-- Action buttons -->
  {% if actions %}
    <div class="notification-actions">
      {% for action in actions %}
        <button class="action-button" data-action="{{ action.type }}">
          {{ action.label | escape }}
        </button>
      {% endfor %}
    </div>
  {% endif %}
</div>
```

### SMS Template

```liquid
{% comment %} 
SMS template - plain text only 
{% endcomment %}

{{ greeting | default: "Hi" }} {{ user.name | default: "there" }},

{{ message | strip_html }}

{% if includeDetails and details %}
Details:
{% for detail in details %}
- {{ detail.name }}: {{ detail.value }}
{% endfor %}

{% endif %}
{% if replyInstructions %}
{{ replyInstructions }}
{% endif %}

{% if unsubscribeText %}
{{ unsubscribeText }}
{% endif %}
```

## Channel Renderers

### Email Renderer

The EmailTemplateRenderer handles both HTML and text versions:

```typescript
import { EmailTemplateRenderer } from '@/app/services/template'

const renderer = new EmailTemplateRenderer(templateLoader)

const result = await renderer.render(template, context, {
  generateTextVersion: true,
  sanitizeHtml: true
})

console.log(result.content)     // HTML version
console.log(result.textContent) // Plain text version
```

### In-App Renderer  

The InAppTemplateRenderer optimizes for web display:

```typescript
import { InAppTemplateRenderer } from '@/app/services/template'

const renderer = new InAppTemplateRenderer(templateLoader)

const result = await renderer.render(template, context, {
  enableMarkdown: true,
  sanitizeHtml: true
})
```

### SMS Renderer

The SmsTemplateRenderer ensures text-only output:

```typescript
import { SmsTemplateRenderer } from '@/app/services/template'

const renderer = new SmsTemplateRenderer(templateLoader)

const result = await renderer.render(template, context, {
  maxLength: 160, // Optional SMS length limit
  stripHtml: true
})
```

## Security Features

### XSS Prevention

All content is automatically sanitized based on channel requirements:

```liquid
<!-- Automatically sanitized for the target channel -->
{{ userContent | sanitize_email }}
{{ userContent | sanitize_inapp }}
{{ userContent | sanitize_sms }}
```

### Content Security Policy

Templates are processed with strict CSP headers:

- No inline JavaScript execution
- Sanitized HTML attributes
- Safe URL validation
- Content type validation

### Input Validation

All template variables are validated:

```typescript
// Schema validation for template context
const context = {
  user: { name: string, email: string },
  company: { name: string, logoUrl?: string },
  content: string,
  metadata?: Record<string, any>
}
```

## Template Loading and Caching

### Supabase Template Loader

Templates are loaded from Supabase with automatic caching:

```typescript
import { SupabaseTemplateLoader } from '@/app/services/template'

const loader = new SupabaseTemplateLoader({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_ANON_KEY,
  cacheTimeMs: 300000 // 5 minutes
})

// Templates are automatically cached
const template = await loader.load('email-welcome', 'EMAIL')
```

### Template Caching Strategy

- **In-Memory Cache**: Templates cached for 5 minutes by default
- **Cache Invalidation**: Automatic cache refresh on template updates
- **Performance**: Sub-millisecond template retrieval after caching

## Integration with Novu Workflows

### Workflow Template Integration

```typescript
import { renderTemplateForStep } from '@/app/services/template'

// In a Novu workflow step
const emailStep = await step.email('send-welcome', async () => {
  const result = await renderTemplateForStep(
    'welcome-email',
    'EMAIL',
    subscriber,
    payload
  )
  
  return {
    subject: result.subject,
    body: result.content
  }
})
```

### Dynamic Workflow Templates

Templates can be dynamically selected based on workflow context:

```typescript
// Template selection based on user preferences
const templateKey = payload.user.isPremium 
  ? 'premium-welcome-email' 
  : 'standard-welcome-email'

const result = await renderTemplateForStep(
  templateKey,
  'EMAIL', 
  subscriber,
  payload
)
```

## Performance Optimization

### Template Compilation

Templates are pre-compiled for optimal performance:

```typescript
// Templates are compiled once and cached
const compiledTemplate = liquid.parse(templateContent)
const result = liquid.renderSync(compiledTemplate, context)
```

### Rendering Performance

- **Cold Start**: ~10-50ms for first render
- **Warm Cache**: ~1-5ms for subsequent renders
- **Memory Usage**: ~2-10MB per template depending on complexity

### Best Practices

1. **Template Size**: Keep templates under 100KB for optimal performance
2. **Variable Count**: Limit context variables to <100 for best performance  
3. **Nested Includes**: Limit `xnovu_render` nesting to 3 levels
4. **Filter Chaining**: Chain filters efficiently (`content | markdown_to_html | sanitize_email`)

## Error Handling

### Template Errors

```typescript
try {
  const result = await renderer.render(template, context)
} catch (error) {
  if (error instanceof TemplateNotFoundError) {
    // Handle missing template
  } else if (error instanceof TemplateRenderError) {
    // Handle rendering error
  }
}
```

### Common Error Types

- **TemplateNotFoundError**: Template key not found in database
- **TemplateLoadError**: Database connection or query error
- **TemplateRenderError**: Liquid syntax or rendering error
- **ValidationError**: Invalid context data

## Testing Templates

### Unit Testing

```typescript
import { LiquidTemplateEngine } from '@/app/services/template'

describe('Template Rendering', () => {
  it('should render email template with filters', async () => {
    const template = '{{ content | markdown_to_html | sanitize_email }}'
    const context = { content: '# Hello\n\nWorld' }
    
    const engine = new LiquidTemplateEngine()
    const result = await engine.render(template, context)
    
    expect(result.content).toContain('<h1>Hello</h1>')
    expect(result.content).toContain('<p>World</p>')
  })
})
```

### Integration Testing

```typescript
describe('Template Integration', () => {
  it('should render complete email workflow', async () => {
    const result = await renderTemplateForStep(
      'user-welcome',
      'EMAIL',
      { subscriberId: 'user-123' },
      { user: { name: 'John' } }
    )
    
    expect(result.subject).toBe('Welcome John!')
    expect(result.content).toContain('Welcome to XNovu')
  })
})
```

## Advanced Usage

### Custom Filter Development

Create custom filters for specific business logic:

```typescript
// Register custom filter
const liquid = templateEngine.getLiquidEngine().getLiquid()

liquid.registerFilter('currency', (value: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(value)
})

// Use in template
// {{ price | currency: 'EUR' }}
```

### Template Inheritance

Create reusable template layouts:

```liquid
<!-- Base layout: email-base.liquid -->
<!DOCTYPE html>
<html>
<head>
  <title>{{ title | default: "Notification" }}</title>
</head>
<body>
  {% xnovu_render "email-header" %}
  
  <main>
    {{ content }}
  </main>
  
  {% xnovu_render "email-footer" %}
</body>
</html>
```

```liquid
<!-- Specific template: welcome-email.liquid -->
{% assign title = "Welcome to XNovu" %}
{% assign content %}
  <h1>Welcome {{ user.name }}!</h1>
  <p>Thanks for joining our platform.</p>
{% endassign %}

{% xnovu_render "email-base", title: title, content: content %}
```

### Multi-language Support

Templates support internationalization:

```liquid
<!-- Language-aware template -->
{% assign lang = user.language | default: 'en' %}

{% case lang %}
  {% when 'es' %}
    <h1>¡Bienvenido {{ user.name }}!</h1>
  {% when 'fr' %}
    <h1>Bienvenue {{ user.name }}!</h1>
  {% else %}
    <h1>Welcome {{ user.name }}!</h1>
{% endcase %}

{% xnovu_render "content-" | append: lang, user: user %}
```

## Migration and Upgrade Guide

### From Legacy Systems

If migrating from other template systems:

1. **Convert syntax**: Update template syntax to Liquid format
2. **Update filters**: Replace custom filters with XNovu filters
3. **Test rendering**: Verify output matches expected results
4. **Performance test**: Benchmark rendering performance

### Version Updates

When updating XNovu template engine:

1. **Review changelog**: Check for breaking changes
2. **Update dependencies**: Ensure compatible versions
3. **Test templates**: Run full template test suite
4. **Monitor performance**: Check for performance regressions

## Troubleshooting

### Common Issues

**Template not found**
```
Error: Template 'template-key' not found for channel EMAIL
```
Solution: Verify template exists in database with correct key and channel

**Liquid syntax error**
```
Error: Unexpected token at line 5
```
Solution: Check Liquid syntax, especially closing tags and filter syntax

**Variable not defined**
```
Error: Variable 'user.name' is not defined
```
Solution: Ensure all variables are provided in template context

**Sanitization removing content**
```
Content appears empty after sanitization
```
Solution: Check if content contains only disallowed HTML tags for the channel

### Debug Mode

Enable debug logging for template rendering:

```typescript
const engine = new LiquidTemplateEngine({
  debug: true,
  logLevel: 'debug'
})
```

### Performance Debugging

Monitor template performance:

```typescript
console.time('template-render')
const result = await renderer.render(template, context)
console.timeEnd('template-render')
```

## Best Practices

### Template Design

1. **Keep it simple**: Avoid complex logic in templates
2. **Use filters**: Leverage built-in filters for common operations
3. **Test thoroughly**: Test with various data scenarios
4. **Optimize for channel**: Design for specific channel constraints

### Security Best Practices

1. **Sanitize input**: Always sanitize user-provided content
2. **Validate context**: Ensure template context data is validated
3. **Limit complexity**: Avoid deeply nested template structures
4. **Regular updates**: Keep template engine dependencies updated

### Performance Best Practices

1. **Cache templates**: Utilize template caching effectively
2. **Minimize includes**: Reduce template include depth
3. **Optimize filters**: Use efficient filter chains
4. **Monitor metrics**: Track rendering performance

This guide provides comprehensive coverage of the XNovu template engine. For additional examples and specific use cases, refer to the test files in `__tests__/unit/template/` and the workflow implementations in `app/novu/workflows/`.