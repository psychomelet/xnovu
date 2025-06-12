import { supabase as supabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type WorkflowRow = Database['notify']['Tables']['ent_notification_workflow']['Row'];
type WorkflowInsert = Database['notify']['Tables']['ent_notification_workflow']['Insert'];
type WorkflowUpdate = Database['notify']['Tables']['ent_notification_workflow']['Update'];
type WorkflowType = Database['shared_types']['Enums']['notification_workflow_type'];
type PublishStatus = Database['shared_types']['Enums']['publish_status'];

export interface WorkflowConfig {
  workflow_key: string;
  workflow_type: WorkflowType;
  channels: string[];
  emailTemplateId?: number;
  inAppTemplateId?: number;
  smsTemplateId?: number;
  pushTemplateId?: number;
  payloadSchema?: any;
  tags?: string[];
  name?: string;
  description?: string;
}

export class WorkflowService {
  private supabase = supabaseClient;

  async getWorkflow(id: number, enterpriseId: string): Promise<WorkflowRow | null> {
    const { data, error } = await this.supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .select('*')
      .eq('id', id)
      .eq('enterprise_id', enterpriseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get workflow: ${error.message}`);
    }

    return data;
  }

  async getWorkflowByKey(workflowKey: string, enterpriseId: string): Promise<WorkflowRow | null> {
    const { data, error } = await this.supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .select('*')
      .eq('workflow_key', workflowKey)
      .eq('enterprise_id', enterpriseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get workflow by key: ${error.message}`);
    }

    return data;
  }

  async getAllWorkflows(enterpriseId: string): Promise<WorkflowRow[]> {
    const { data, error } = await this.supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('deactivated', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get workflows: ${error.message}`);
    }

    return data || [];
  }

  async getPublishedWorkflows(enterpriseId: string): Promise<WorkflowRow[]> {
    const { data, error } = await this.supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('publish_status', 'PUBLISH')
      .eq('deactivated', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get published workflows: ${error.message}`);
    }

    return data || [];
  }

  async getDynamicWorkflows(enterpriseId: string): Promise<WorkflowRow[]> {
    const { data, error } = await this.supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('workflow_type', 'DYNAMIC')
      .eq('publish_status', 'PUBLISH')
      .eq('deactivated', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get dynamic workflows: ${error.message}`);
    }

    return data || [];
  }

  async getStaticWorkflows(enterpriseId: string): Promise<WorkflowRow[]> {
    const { data, error } = await this.supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('workflow_type', 'STATIC')
      .eq('publish_status', 'PUBLISH')
      .eq('deactivated', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get static workflows: ${error.message}`);
    }

    return data || [];
  }

  async createWorkflow(workflow: WorkflowInsert): Promise<WorkflowRow> {
    const { data, error } = await this.supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .insert(workflow)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create workflow: ${error.message}`);
    }

    return data;
  }

  async updateWorkflow(
    id: number,
    updates: WorkflowUpdate,
    enterpriseId: string
  ): Promise<WorkflowRow> {
    const { data, error } = await this.supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .update(updates)
      .eq('id', id)
      .eq('enterprise_id', enterpriseId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update workflow: ${error.message}`);
    }

    return data;
  }

  async publishWorkflow(id: number, enterpriseId: string): Promise<WorkflowRow> {
    return this.updateWorkflow(id, { publish_status: 'PUBLISH' }, enterpriseId);
  }

  async unpublishWorkflow(id: number, enterpriseId: string): Promise<WorkflowRow> {
    return this.updateWorkflow(id, { publish_status: 'DRAFT' }, enterpriseId);
  }

  async deactivateWorkflow(id: number, enterpriseId: string): Promise<WorkflowRow> {
    return this.updateWorkflow(id, { deactivated: true }, enterpriseId);
  }

  async parseWorkflowConfig(workflow: WorkflowRow): Promise<WorkflowConfig> {
    // Parse configuration from database row
    const config: WorkflowConfig = {
      workflow_key: workflow.workflow_key,
      workflow_type: workflow.workflow_type,
      channels: [],
      name: workflow.name || undefined,
      description: workflow.description || undefined,
    };

    // Parse channel configuration from default_channels
    if (workflow.default_channels) {
      config.channels = workflow.default_channels;
    }

    // Parse template overrides
    if (workflow.template_overrides) {
      const templateOverrides = workflow.template_overrides as any;
      
      if (templateOverrides.emailTemplateId) {
        config.emailTemplateId = templateOverrides.emailTemplateId;
      }

      if (templateOverrides.inAppTemplateId) {
        config.inAppTemplateId = templateOverrides.inAppTemplateId;
      }

      if (templateOverrides.smsTemplateId) {
        config.smsTemplateId = templateOverrides.smsTemplateId;
      }

      if (templateOverrides.pushTemplateId) {
        config.pushTemplateId = templateOverrides.pushTemplateId;
      }

      if (templateOverrides.tags) {
        config.tags = templateOverrides.tags;
      }
    }

    // Parse payload schema
    if (workflow.payload_schema) {
      config.payloadSchema = workflow.payload_schema as any;
    }

    // Tags are already parsed from template_overrides above
    // No need to parse tags from workflow directly as they don't exist on the workflow row

    return config;
  }
}

export const workflowService = new WorkflowService();