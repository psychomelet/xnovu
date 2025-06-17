# Test Migration Note

The following test files have been removed as part of the template engine simplification:

- `TemplateParser.test.ts` - Tests for the removed TemplateParser class
- `VariableInterpolator.test.ts` - Tests for the removed VariableInterpolator class

These have been replaced with:

- `LiquidFilters.test.ts` - Tests for the new Liquid filters that replace the old functionality

The existing tests in `TemplateEngine.test.ts` continue to work and verify backward compatibility.

## What's Tested Now

1. **Liquid Filters** (`LiquidFilters.test.ts`)
   - `html_to_text` filter
   - `markdown_to_html` filter
   - `sanitize_email`, `sanitize_inapp`, `sanitize_sms` filters
   - `extract_subject` filter
   - `json` and `default` utility filters
   - Filter chaining

2. **Template Engine** (`TemplateEngine.test.ts`)
   - Template rendering with Liquid
   - Variable interpolation
   - xnovu_render tag functionality
   - Error handling
   - Backward compatibility

3. **Integration Tests**
   - End-to-end template rendering
   - Channel-specific rendering
   - Security and sanitization

The functionality previously tested in the removed files is now covered by Liquid's own test suite and our integration tests.