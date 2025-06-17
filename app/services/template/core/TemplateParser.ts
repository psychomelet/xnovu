export interface XNovuRenderMatch {
  fullMatch: string;
  templateKey: string;
  variables: Record<string, any>;
  startIndex: number;
  endIndex: number;
}

export class TemplateParser {
  /**
   * Parse xnovu_render syntax from template string
   * Syntax: {{ xnovu_render('template_key', { variable: 'value' }) }}
   */
  parseXNovuRenderSyntax(template: string): XNovuRenderMatch[] {
    const regex = /\{\{\s*xnovu_render\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\{(?:[^{}]|\{[^}]*\})*\})\s*\)\s*\}\}/g;
    const matches: XNovuRenderMatch[] = [];
    let match;

    while ((match = regex.exec(template)) !== null) {
      try {
        const [fullMatch, templateKey, variablesJson] = match;
        const variables = this.parseVariablesJson(variablesJson);

        matches.push({
          fullMatch,
          templateKey,
          variables,
          startIndex: match.index,
          endIndex: match.index + fullMatch.length
        });
      } catch (error) {
        console.error('[TemplateParser] Failed to parse xnovu_render match:', error);
        // Continue processing other matches
      }
    }

    return matches;
  }

  /**
   * Safely parse variables JSON with error handling
   */
  private parseVariablesJson(variablesJson: string): Record<string, any> {
    try {
      // Handle simple cases first
      if (variablesJson.trim() === '{}') {
        return {};
      }

      // Use Function constructor for safer evaluation than eval
      // This allows for more complex object syntax while being safer than eval
      const result = new Function('return ' + variablesJson)();

      if (typeof result !== 'object' || result === null) {
        throw new Error('Variables must be an object');
      }

      return result;
    } catch (error) {
      console.error('[TemplateParser] Failed to parse variables JSON:', variablesJson, error);
      return {};
    }
  }

  /**
   * Extract all variable placeholders from a template
   * Returns array of unique variable paths (e.g., ['user.name', 'product.price'])
   */
  extractVariablePlaceholders(template: string): string[] {
    const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      const variablePath = match[1].trim();
      // Skip xnovu_render calls
      if (!variablePath.startsWith('xnovu_render')) {
        variables.add(variablePath);
      }
    }

    return Array.from(variables);
  }

  /**
   * Validate template syntax without rendering
   */
  validateSyntax(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Check xnovu_render syntax
      const xnovuMatches = this.parseXNovuRenderSyntax(template);

      // Check for basic syntax errors in variable interpolation
      const variableRegex = /\{\{\s*([^}]*)\s*\}\}/g;
      let match;
      while ((match = variableRegex.exec(template)) !== null) {
        const content = match[1].trim();
        // Skip xnovu_render calls in validation
        if (!content && !match[0].includes('xnovu_render')) {
          errors.push(`Empty variable placeholder at position ${match.index}`);
        }
      }

      // Check for unclosed brackets
      const openBrackets = (template.match(/\{\{/g) || []).length;
      const closeBrackets = (template.match(/\}\}/g) || []).length;
      if (openBrackets !== closeBrackets) {
        errors.push(`Mismatched brackets: ${openBrackets} opening, ${closeBrackets} closing`);
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        valid: false,
        errors
      };
    }
  }
}