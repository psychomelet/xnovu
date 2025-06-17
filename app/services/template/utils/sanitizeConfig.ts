import sanitizeHtml, { IOptions } from 'sanitize-html';

/**
 * Default sanitization configuration for email templates
 * Allows most formatting tags but blocks dangerous elements
 */
export const emailSanitizeConfig: IOptions = {
  allowedTags: [
    // Text formatting
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
    // Headers
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Lists
    'ul', 'ol', 'li',
    // Links and images
    'a', 'img',
    // Tables
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    // Other structural elements
    'blockquote', 'pre', 'code', 'hr',
    // Semantic HTML5 elements
    'header', 'footer', 'main', 'section', 'article', 'aside', 'nav',
    // Email-specific
    'center', 'font'
  ],
  disallowedTagsMode: 'discard',
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height', 'style'],
    'table': ['border', 'cellpadding', 'cellspacing', 'width', 'style'],
    'td': ['colspan', 'rowspan', 'width', 'height', 'style', 'align', 'valign'],
    'th': ['colspan', 'rowspan', 'width', 'height', 'style', 'align', 'valign'],
    'tr': ['style'],
    'div': ['style', 'align'],
    'p': ['style', 'align'],
    'span': ['style'],
    'font': ['color', 'size', 'face'],
    '*': ['class', 'id'] // Allow class and id on all elements for styling
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
    a: ['http', 'https', 'mailto', 'tel']
  },
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  transformTags: {
    // Ensure external links open in new tab and have security attributes
    'a': (tagName, attribs) => {
      const href = attribs.href;
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        };
      }
      return { tagName, attribs };
    }
  },
  // Remove dangerous protocols and content
  exclusiveFilter: (frame) => {
    const tag = frame.tag;
    const attribs = frame.attribs || {};
    
    // Block javascript: and data: URIs in href (except data: in img src)
    if (tag === 'a' && attribs.href) {
      const href = attribs.href.toLowerCase().trim();
      if (href.startsWith('javascript:') || href.startsWith('vbscript:') || href.startsWith('data:')) {
        return true; // Exclude this element
      }
    }
    
    // Block CSS expressions
    if (attribs.style && /expression\s*\(/i.test(attribs.style)) {
      return true;
    }
    
    return false;
  }
};

/**
 * Strict sanitization configuration for in-app notifications
 * More restrictive to prevent any potential XSS in the app
 */
export const inAppSanitizeConfig: IOptions = {
  allowedTags: [
    // Basic formatting only
    'p', 'br', 'strong', 'b', 'em', 'i', 'span', 'div',
    // Headers (smaller subset)
    'h3', 'h4', 'h5', 'h6',
    // Lists
    'ul', 'ol', 'li',
    // Links (but will be processed further)
    'a',
    // Code formatting
    'code', 'pre'
  ],
  disallowedTagsMode: 'discard',
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel', 'data-external-link'],
    'span': ['class'],
    'div': ['class'],
    'p': ['class'],
    'code': ['class'],
    'pre': ['class']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    // Transform all links to be safe for in-app display
    'a': (tagName, attribs) => {
      return {
        tagName: 'a',
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer',
          // Add data attribute for in-app link handling
          'data-external-link': 'true'
        }
      };
    }
  },
  // Very strict filtering for in-app
  exclusiveFilter: (frame) => {
    const tag = frame.tag;
    const attribs = frame.attribs || {};
    
    // Block any javascript: or data: URIs
    if (attribs.href) {
      const href = attribs.href.toLowerCase().trim();
      if (href.startsWith('javascript:') || href.startsWith('vbscript:') || href.startsWith('data:')) {
        return true;
      }
    }
    
    // Block any style attributes (use classes instead)
    if (attribs.style) {
      return true;
    }
    
    return false;
  }
};

/**
 * Very strict configuration for plain text contexts
 * Strips all HTML and only allows basic text formatting
 */
export const textOnlySanitizeConfig: IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  textFilter: (text) => {
    // Decode common HTML entities but preserve the text
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
};

/**
 * Utility function to sanitize content based on channel type
 */
export function sanitizeForChannel(content: string, channelType: string): string {
  switch (channelType.toLowerCase()) {
    case 'email':
      return sanitizeHtml(content, emailSanitizeConfig);
    case 'in_app':
    case 'inapp':
      return sanitizeHtml(content, inAppSanitizeConfig);
    case 'sms':
    case 'push':
      return sanitizeHtml(content, textOnlySanitizeConfig);
    default:
      // Default to in-app (most restrictive with HTML support)
      return sanitizeHtml(content, inAppSanitizeConfig);
  }
}

/**
 * Sanitize user variables before template interpolation
 * This prevents XSS from user-provided data
 */
export function sanitizeVariables(variables: Record<string, any>, channelType: string): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'string') {
      // Sanitize string values based on channel type
      sanitized[key] = sanitizeForChannel(value, channelType);
    } else if (Array.isArray(value)) {
      // Handle arrays separately to preserve array structure
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeForChannel(item, channelType) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize object values
      sanitized[key] = sanitizeVariables(value, channelType);
    } else {
      // Keep non-string, non-object values as-is (numbers, booleans, etc.)
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Additional validation for potentially dangerous content patterns
 */
export function validateContentSafety(content: string): { safe: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const lowerContent = content.toLowerCase();
  
  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    { pattern: /<script\b/i, message: 'Contains script tags' },
    { pattern: /javascript:/i, message: 'Contains javascript: protocol' },
    { pattern: /vbscript:/i, message: 'Contains vbscript: protocol' },
    { pattern: /on\w+\s*=/i, message: 'Contains event handlers (onclick, onload, etc.)' },
    { pattern: /expression\s*\(/i, message: 'Contains CSS expressions' },
    { pattern: /@import/i, message: 'Contains CSS @import directives' },
    { pattern: /document\.(cookie|domain|location)/i, message: 'Attempts to access sensitive document properties' },
    { pattern: /window\.(location|open)/i, message: 'Attempts to manipulate window object' }
  ];
  
  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(content)) {
      warnings.push(message);
    }
  }
  
  return {
    safe: warnings.length === 0,
    warnings
  };
}