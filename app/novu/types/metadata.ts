import type { Database } from '@/lib/supabase/database.types';

export type NotificationChannelType = Database['shared_types']['Enums']['notification_channel_type'];
export type NotificationWorkflowType = Database['shared_types']['Enums']['notification_workflow_type'];
export type PublishStatus = "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED";

/**
 * Metadata for a Novu workflow that will be synced to the database
 */
export interface WorkflowMetadata {
  /**
   * Unique identifier for the workflow (must match the Novu workflow ID)
   */
  workflow_key: string;
  
  /**
   * Human-readable name for the workflow
   */
  name: string;
  
  /**
   * Description of what this workflow does
   */
  description: string;
  
  /**
   * Internationalization support for workflow name and description
   */
  i18n?: {
    zh?: {
      name: string;
      description: string;
    };
    // Extensible for other languages
    [locale: string]: {
      name: string;
      description: string;
    } | undefined;
  };
  
  /**
   * Type of workflow - STATIC for system workflows, DYNAMIC for user-configurable
   */
  workflow_type: NotificationWorkflowType;
  
  /**
   * Default channels this workflow uses (extracted from workflow steps)
   * e.g., ['EMAIL', 'IN_APP'] if the workflow has email and in-app steps
   */
  default_channels: NotificationChannelType[];
  
  /**
   * JSON Schema for payload validation (generated from Zod schema)
   */
  payload_schema: Record<string, any> | null;
  
  /**
   * JSON Schema for workflow controls (generated from Zod schema)
   */
  control_schema: Record<string, any> | null;
  
  /**
   * Channel-specific template overrides
   */
  template_overrides?: Record<string, any> | null;
  
  /**
   * Category ID reference (optional)
   */
  typ_notification_category_id?: number | null;
  
  /**
   * Publish status - typically "PUBLISH" for active workflows
   */
  publish_status: PublishStatus;
  
  /**
   * Whether this workflow is deactivated
   */
  deactivated: boolean;
  
  /**
   * Business ID (optional, for multi-tenant scenarios)
   */
  business_id?: string | null;
  
  /**
   * Enterprise ID (optional, for multi-tenant scenarios)
   */
  enterprise_id?: string | null;
}

/**
 * Helper function to create workflow metadata with proper defaults
 */
export function createWorkflowMetadata(
  metadata: Omit<WorkflowMetadata, 'publish_status' | 'deactivated'> & 
  Partial<Pick<WorkflowMetadata, 'publish_status' | 'deactivated'>>
): WorkflowMetadata {
  return {
    publish_status: 'PUBLISH',
    deactivated: false,
    template_overrides: null,
    typ_notification_category_id: null,
    business_id: null,
    enterprise_id: null,
    ...metadata,
  };
}