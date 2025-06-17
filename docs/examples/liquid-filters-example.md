# Liquid Filters Example

This document demonstrates how to use the new Liquid filters in XNovu templates.

## Available Filters

### 1. HTML to Text Conversion
```liquid
{{ htmlContent | html_to_text }}
```

### 2. Markdown to HTML Conversion
```liquid
{{ markdownContent | markdown_to_html }}
```

### 3. Channel-Specific Sanitization
```liquid
<!-- For email -->
{{ content | sanitize_email }}

<!-- For in-app notifications -->
{{ content | sanitize_inapp }}

<!-- For SMS (strips all HTML) -->
{{ content | sanitize_sms }}
<!-- or -->
{{ content | strip_html }}
```

### 4. Extract Email Subject
```liquid
{% assign emailData = content | extract_subject %}
Subject: {{ emailData.subject }}
Body: {{ emailData.body }}
```

### 5. JSON Stringify
```liquid
{{ myObject | json }}
```

### 6. Default Values
```liquid
{{ userName | default: "Guest" }}
{{ companyName | default: "Your Company" }}
```

## Complete Email Template Example

```liquid
{% comment %} Email template with all features {% endcomment %}

{% assign emailContent = content | extract_subject %}

<!DOCTYPE html>
<html>
<head>
  <title>{{ emailContent.subject | default: "Notification" }}</title>
</head>
<body>
  {% comment %} Render header template {% endcomment %}
  {% xnovu_render "email-header", companyName: company.name %}
  
  <div class="content">
    {% comment %} Convert markdown to HTML and sanitize {% endcomment %}
    {{ emailContent.body | markdown_to_html | sanitize_email }}
  </div>
  
  {% comment %} Include footer {% endcomment %}
  {% xnovu_render "email-footer", 
    unsubscribeUrl: unsubscribeUrl,
    currentYear: "now" | date: "%Y"
  %}
</body>
</html>
```

## In-App Notification Example

```liquid
{% comment %} In-app notification with markdown support {% endcomment %}

<div class="notification">
  <h3>{{ title | escape }}</h3>
  
  {% comment %} Convert markdown and sanitize for in-app display {% endcomment %}
  {{ message | markdown_to_html | sanitize_inapp }}
  
  {% if actionUrl %}
    <a href="{{ actionUrl }}" target="_blank" rel="noopener">
      {{ actionText | default: "View Details" }}
    </a>
  {% endif %}
</div>
```

## SMS Template Example

```liquid
{% comment %} SMS template - text only {% endcomment %}
{{ greeting | default: "Hello" }} {{ user.name }},

{{ message | strip_html }}

{% if includeLink %}
Reply STOP to unsubscribe.
{% endif %}
```

## Migration Guide

### Before (Old System):
```javascript
// Email renderer with manual HTML to text conversion
const textBody = this.htmlToText(htmlBody);

// Manual markdown conversion
const html = this.markdownToHtml(markdown);

// Manual sanitization
const safe = sanitizeForChannel(content, 'email');
```

### After (Using Liquid Filters):
```liquid
<!-- Email with automatic text version -->
Text version: {{ htmlBody | html_to_text }}

<!-- Markdown to HTML -->
{{ markdown | markdown_to_html }}

<!-- Automatic sanitization -->
{{ content | sanitize_email }}
```

## Benefits

1. **Cleaner Templates**: Logic is in filters, not in renderer code
2. **Reusable**: Filters can be used in any template
3. **Chainable**: Multiple filters can be applied in sequence
4. **Secure**: Sanitization is built into the filters
5. **Maintainable**: All filter logic is in one place (LiquidTemplateEngine)