export class VariableInterpolator {
  /**
   * Interpolate template variables
   * Supports: {{variable}}, {{object.property}}, {{array[0]}}
   */
  interpolate(template: string, variables: Record<string, any>): string {
    // Simple variable interpolation regex
    const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;

    return template.replace(variableRegex, (match, variablePath) => {
      try {
        const value = this.getNestedValue(variables, variablePath.trim());
        return value !== undefined ? String(value) : match;
      } catch (error) {
        console.warn(`[VariableInterpolator] Failed to interpolate variable: ${variablePath}`, error);
        return match;
      }
    });
  }

  /**
   * Get nested value from object using dot notation
   * Example: getNestedValue(obj, 'user.profile.name')
   * Also supports array access: 'items[0].name'
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      // Handle array access like [0]
      const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        return current?.[arrayKey]?.[parseInt(index)];
      }
      return current?.[key];
    }, obj);
  }

  /**
   * Set nested value in object using dot notation
   * Creates intermediate objects as needed
   */
  setNestedValue(obj: Record<string, any>, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    let current = obj;
    for (const key of keys) {
      // Handle array access
      const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        if (!current[arrayKey]) {
          current[arrayKey] = [];
        }
        if (!current[arrayKey][parseInt(index)]) {
          current[arrayKey][parseInt(index)] = {};
        }
        current = current[arrayKey][parseInt(index)];
      } else {
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
    }
    
    // Handle last key
    const lastArrayMatch = lastKey.match(/^(.+)\[(\d+)\]$/);
    if (lastArrayMatch) {
      const [, arrayKey, index] = lastArrayMatch;
      if (!current[arrayKey]) {
        current[arrayKey] = [];
      }
      current[arrayKey][parseInt(index)] = value;
    } else {
      current[lastKey] = value;
    }
  }

  /**
   * Check if a variable path exists in the given context
   */
  hasVariable(obj: any, path: string): boolean {
    try {
      const value = this.getNestedValue(obj, path);
      return value !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Extract variable value with type preservation
   * Returns the actual value without string conversion
   */
  extractValue(obj: any, path: string): any {
    return this.getNestedValue(obj, path);
  }

  /**
   * Interpolate with custom value formatter
   */
  interpolateWithFormatter(
    template: string, 
    variables: Record<string, any>,
    formatter?: (value: any, path: string) => string
  ): string {
    const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;

    return template.replace(variableRegex, (match, variablePath) => {
      try {
        const trimmedPath = variablePath.trim();
        const value = this.getNestedValue(variables, trimmedPath);
        
        if (value === undefined) {
          return match;
        }

        if (formatter) {
          return formatter(value, trimmedPath);
        }

        return String(value);
      } catch (error) {
        console.warn(`[VariableInterpolator] Failed to interpolate variable: ${variablePath}`, error);
        return match;
      }
    });
  }

  /**
   * Get all variable paths from an object recursively
   */
  getAllPaths(obj: any, prefix = ''): string[] {
    const paths: string[] = [];

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const currentPath = prefix ? `${prefix}.${key}` : key;

        if (value !== null && typeof value === 'object') {
          if (Array.isArray(value)) {
            // For arrays, include the array path and indexed paths
            paths.push(currentPath);
            value.forEach((item, index) => {
              const indexedPath = `${currentPath}[${index}]`;
              paths.push(indexedPath);
              if (item !== null && typeof item === 'object') {
                paths.push(...this.getAllPaths(item, indexedPath));
              }
            });
          } else {
            // For objects, recursively get paths
            paths.push(currentPath);
            paths.push(...this.getAllPaths(value, currentPath));
          }
        } else {
          // For primitive values
          paths.push(currentPath);
        }
      }
    }

    return paths;
  }
}