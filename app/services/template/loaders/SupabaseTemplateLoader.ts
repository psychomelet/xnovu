import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../lib/supabase/database.types';
import { 
  TemplateLoader, 
  Template, 
  TemplateLoadResult, 
  TemplateNotFoundError,
  TemplateLoadError,
  TemplateLoaderOptions 
} from './TemplateLoader';

type NotificationTemplate = Database['notify']['Tables']['ent_notification_template']['Row'];
type ChannelType = Database['shared_types']['Enums']['notification_channel_type'];

interface CachedTemplate {
  template: Template;
  loadedAt: Date;
}

export class SupabaseTemplateLoader implements TemplateLoader {
  private supabase: ReturnType<typeof createClient<Database>>;
  private cache = new Map<string, CachedTemplate>();
  private readonly cacheTTL: number;
  private readonly useCache: boolean;
  private stats = {
    totalLoaded: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    options: TemplateLoaderOptions = {}
  ) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
    this.useCache = options.cache !== false;
    this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes default
  }

  async loadTemplate(
    templateKey: string,
    context?: Record<string, any>
  ): Promise<TemplateLoadResult> {
    const enterpriseId = context?.enterpriseId;
    const cacheKey = this.getCacheKey(templateKey, enterpriseId);

    // Check cache first
    if (this.useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && this.isCacheValid(cached.loadedAt)) {
        this.stats.cacheHits++;
        return {
          template: cached.template,
          metadata: {
            loadedAt: cached.loadedAt,
            source: 'cache',
            cacheKey
          }
        };
      }
    }

    this.stats.cacheMisses++;
    this.stats.totalLoaded++;

    try {
      // Build query
      let query = this.supabase
        .schema('notify')
        .from('ent_notification_template')
        .select('*')
        .eq('template_key', templateKey)
        .eq('publish_status', 'PUBLISH')
        .eq('deactivated', false);

      // Add enterprise filter if provided
      if (enterpriseId) {
        query = query.eq('enterprise_id', enterpriseId);
      }

      const { data: dbTemplate, error } = await query.single();

      if (error || !dbTemplate) {
        throw new TemplateNotFoundError(templateKey, context);
      }

      const template = this.mapDbTemplateToTemplate(dbTemplate);
      const loadedAt = new Date();

      // Cache the result
      if (this.useCache) {
        this.cache.set(cacheKey, { template, loadedAt });
      }

      return {
        template,
        metadata: {
          loadedAt,
          source: 'database',
          enterpriseId: dbTemplate.enterprise_id,
          channelType: dbTemplate.channel_type
        }
      };
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        throw error;
      }
      throw new TemplateLoadError(
        `Failed to load template: ${templateKey}`,
        templateKey,
        error instanceof Error ? error : undefined
      );
    }
  }

  async loadTemplates(
    templateKeys: string[],
    context?: Record<string, any>
  ): Promise<Map<string, TemplateLoadResult>> {
    const results = new Map<string, TemplateLoadResult>();
    
    // Process templates in parallel
    const promises = templateKeys.map(async (key) => {
      try {
        const result = await this.loadTemplate(key, context);
        results.set(key, result);
      } catch (error) {
        // Log error but continue loading other templates
        console.error(`Failed to load template ${key}:`, error);
      }
    });

    await Promise.all(promises);
    return results;
  }

  async templateExists(
    templateKey: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    try {
      await this.loadTemplate(templateKey, context);
      return true;
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        return false;
      }
      throw error;
    }
  }

  async listTemplates(
    filter?: Record<string, any>
  ): Promise<Template[]> {
    try {
      let query = this.supabase
        .schema('notify')
        .from('ent_notification_template')
        .select('*')
        .eq('publish_status', 'PUBLISH')
        .eq('deactivated', false);

      // Apply filters
      if (filter?.enterpriseId) {
        query = query.eq('enterprise_id', filter.enterpriseId);
      }
      if (filter?.channelType) {
        query = query.eq('channel_type', filter.channelType);
      }
      if (filter?.categoryId) {
        query = query.eq('typ_notification_category_id', filter.categoryId);
      }

      const { data: templates, error } = await query;

      if (error) {
        throw new Error(`Failed to list templates: ${error.message}`);
      }

      return (templates || []).map(this.mapDbTemplateToTemplate);
    } catch (error) {
      throw new TemplateLoadError(
        'Failed to list templates',
        '',
        error instanceof Error ? error : undefined
      );
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.loadedAt.getTime() >= this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    const now = Date.now();
    let validCached = 0;
    let expiredCached = 0;

    for (const cached of this.cache.values()) {
      if (now - cached.loadedAt.getTime() < this.cacheTTL) {
        validCached++;
      } else {
        expiredCached++;
      }
    }

    return {
      ...this.stats,
      totalCached: this.cache.size,
      validCached,
      expiredCached
    };
  }

  private mapDbTemplateToTemplate(dbTemplate: NotificationTemplate): Template {
    return {
      id: dbTemplate.id,
      templateKey: dbTemplate.template_key,
      name: dbTemplate.name,
      bodyTemplate: dbTemplate.body_template,
      subjectTemplate: dbTemplate.subject_template,
      variablesDescription: dbTemplate.variables_description as Record<string, any> | null,
      channelType: dbTemplate.channel_type,
      enterpriseId: dbTemplate.enterprise_id || undefined
    };
  }

  private getCacheKey(templateKey: string, enterpriseId?: string): string {
    return enterpriseId ? `${enterpriseId}:${templateKey}` : templateKey;
  }

  private isCacheValid(loadedAt: Date): boolean {
    return Date.now() - loadedAt.getTime() < this.cacheTTL;
  }
}