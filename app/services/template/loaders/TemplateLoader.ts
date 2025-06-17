export interface Template {
  id: string | number;
  templateKey: string;
  name: string;
  bodyTemplate: string;
  subjectTemplate?: string | null;
  variablesDescription?: Record<string, any> | null;
  channelType?: string;
  enterpriseId?: string;
}

export interface TemplateLoadResult {
  template: Template;
  metadata?: {
    loadedAt: Date;
    source: string;
    [key: string]: any;
  };
}

export interface TemplateLoaderOptions {
  cache?: boolean;
  cacheTTL?: number;
}

/**
 * Abstract interface for loading templates from various sources
 */
export interface TemplateLoader {
  /**
   * Load a template by its key
   */
  loadTemplate(
    templateKey: string,
    context?: Record<string, any>
  ): Promise<TemplateLoadResult>;

  /**
   * Load multiple templates at once
   */
  loadTemplates(
    templateKeys: string[],
    context?: Record<string, any>
  ): Promise<Map<string, TemplateLoadResult>>;

  /**
   * Check if a template exists
   */
  templateExists(
    templateKey: string,
    context?: Record<string, any>
  ): Promise<boolean>;

  /**
   * List available templates
   */
  listTemplates(
    filter?: Record<string, any>
  ): Promise<Template[]>;

  /**
   * Clear any internal cache
   */
  clearCache?(): void;

  /**
   * Get loader statistics
   */
  getStats?(): {
    totalLoaded: number;
    cacheHits?: number;
    cacheMisses?: number;
    [key: string]: any;
  };
}

/**
 * Error thrown when a template cannot be found
 */
export class TemplateNotFoundError extends Error {
  constructor(
    public templateKey: string,
    public context?: Record<string, any>
  ) {
    super(`Template not found: ${templateKey}`);
    this.name = 'TemplateNotFoundError';
  }
}

/**
 * Error thrown when template loading fails
 */
export class TemplateLoadError extends Error {
  constructor(
    message: string,
    public templateKey: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'TemplateLoadError';
  }
}