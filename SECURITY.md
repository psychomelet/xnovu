# XNovu Template Security

## Overview

XNovu has been enhanced with comprehensive security measures using `sanitize-html` to protect against XSS attacks and other HTML injection vulnerabilities in template rendering.

## Security Features

### 1. HTML Sanitization

All template content is sanitized using `sanitize-html` with channel-specific configurations:

#### Email Templates
- **Allowed Elements**: Headers, paragraphs, formatting tags, lists, links, images, tables, semantic HTML5 elements
- **Blocked Elements**: Script tags, event handlers, dangerous protocols (javascript:, vbscript:)
- **Security Measures**: External links get `target="_blank"` and `rel="noopener noreferrer"`
- **CSS Filtering**: Removes CSS expressions and dangerous style attributes

#### In-App Notifications  
- **Allowed Elements**: Basic formatting, headers (h3-h6), lists, links, code blocks
- **Blocked Elements**: Tables, images, iframes, forms, script tags, style attributes
- **Security Measures**: External links marked with `data-external-link="true"`
- **Restrictive Policy**: More restrictive than email to prevent app-based XSS

#### SMS/Push Notifications
- **Text Only**: All HTML tags are stripped completely
- **Entity Decoding**: HTML entities decoded to plain text
- **Character Validation**: Checks for GSM-compatible characters

### 2. Variable Sanitization

User-provided variables are sanitized before template interpolation:

```typescript
// Variables are sanitized based on channel type before rendering
const sanitizedVariables = sanitizeVariables(userVariables, channelType);
```

- **Recursive Sanitization**: Handles nested objects and arrays
- **Type Preservation**: Non-string values (numbers, booleans) are preserved
- **Channel-Specific**: Uses appropriate sanitization rules per channel

### 3. Content Safety Validation

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

### 4. Sanitization Configuration

#### Channel-Specific Configs

**Email (`emailSanitizeConfig`)**:
```typescript
{
  allowedTags: ['p', 'strong', 'a', 'img', 'table', 'header', 'main', ...],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height']
  },
  disallowedTagsMode: 'discard'
}
```

**In-App (`inAppSanitizeConfig`)**:
```typescript
{
  allowedTags: ['p', 'strong', 'a', 'code', 'h3', 'h4', 'h5', 'h6', ...],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel', 'data-external-link']
  },
  transformTags: {
    'a': (tagName, attribs) => ({ /* security attributes */ })
  }
}
```

**Text-Only (`textOnlySanitizeConfig`)**:
```typescript
{
  allowedTags: [],
  allowedAttributes: {},
  textFilter: (text) => /* HTML entity decoding */
}
```

## Usage

### Basic Sanitization

```typescript
import { sanitizeForChannel } from '@/app/services/template/utils/sanitizeConfig';

// Sanitize content for specific channel
const safeContent = sanitizeForChannel(userContent, 'email');
```

### Template Rendering with Sanitization

```typescript
// Email renderer with automatic sanitization
const emailRenderer = new EmailTemplateRenderer(templateLoader);
const result = await emailRenderer.render(template, {
  variables: userProvidedData,
  enterpriseId: 'ent-123'
});

// Safety validation is included in result
console.log(result.safetyValidation.safe); // true/false
console.log(result.safetyValidation.warnings); // Array of warnings
```

### Disabling Sanitization (Advanced)

```typescript
// For trusted content only - use with extreme caution
const result = await renderer.render(template, context, {
  sanitize: false,
  validateSafety: false
});
```

## Security Best Practices

### 1. Input Validation
- Always sanitize user-provided variables
- Validate template content before storage
- Use enterprise isolation for templates

### 2. Template Development
- Avoid inline JavaScript or event handlers
- Use semantic HTML elements when possible
- Test templates with malicious input

### 3. Channel Selection
- Use most restrictive channel (In-App) when possible
- Reserve Email templates for rich formatting needs
- Use SMS/Push for text-only communications

### 4. Monitoring
- Monitor safety validation warnings
- Log XSS attempt patterns
- Review failed sanitization reports

## Testing

Comprehensive test coverage includes:

- **XSS Prevention**: Script tags, event handlers, dangerous protocols
- **Content Preservation**: Safe HTML elements and attributes
- **Variable Sanitization**: Nested objects, arrays, type preservation
- **Safety Validation**: Threat detection and warning generation
- **Channel Restrictions**: Channel-specific filtering rules
- **Edge Cases**: Malformed HTML, Unicode characters, nested attacks

## Dependencies

- **sanitize-html**: ^2.17.0 - Core HTML sanitization library
- **@types/sanitize-html**: ^2.16.0 - TypeScript definitions

## Configuration Files

- `app/services/template/utils/sanitizeConfig.ts` - Main configuration
- `app/services/template/renderers/BaseChannelRenderer.ts` - Base sanitization logic
- Channel-specific renderers implement sanitization overrides

## Compliance

This implementation helps meet security requirements for:
- XSS prevention
- Content Security Policy (CSP) compliance  
- Input validation standards
- Template injection prevention