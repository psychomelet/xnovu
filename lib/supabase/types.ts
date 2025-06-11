export interface Database {
  public: {
    Tables: {}
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
  notify: {
    Tables: {
      typ_notification_category: {
        Row: {
          id: number
          name: string
          description: string | null
          code: string | null
          publish_status: 'DRAFT' | 'PUBLISHED'
          deactivated: boolean
          path: string | null
          path_text: string | null
          sort_order: number
          business_id: string | null
          repr: string | null
          enterprise_id: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          name: string
          description?: string | null
          code?: string | null
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          path?: string | null
          sort_order?: number
          business_id?: string | null
          enterprise_id?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          code?: string | null
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          path?: string | null
          sort_order?: number
          business_id?: string | null
          enterprise_id?: string | null
          updated_by?: string | null
        }
      }
      typ_notification_priority: {
        Row: {
          id: number
          name: string
          description: string | null
          code: string | null
          publish_status: 'DRAFT' | 'PUBLISHED'
          deactivated: boolean
          sort_order: number
          business_id: string | null
          repr: string | null
          enterprise_id: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          name: string
          description?: string | null
          code?: string | null
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          sort_order?: number
          business_id?: string | null
          enterprise_id?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          code?: string | null
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          sort_order?: number
          business_id?: string | null
          enterprise_id?: string | null
          updated_by?: string | null
        }
      }
      ent_notification_template: {
        Row: {
          id: number
          name: string
          description: string | null
          publish_status: 'DRAFT' | 'PUBLISHED'
          deactivated: boolean
          typ_notification_category_id: number | null
          business_id: string | null
          channel_type: 'IN_APP' | 'EMAIL' | 'SMS' | 'CHAT' | 'PUSH'
          subject_template: string | null
          body_template: string
          variables_description: any | null
          repr: string | null
          enterprise_id: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          name: string
          description?: string | null
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          typ_notification_category_id?: number | null
          business_id?: string | null
          channel_type: 'IN_APP' | 'EMAIL' | 'SMS' | 'CHAT' | 'PUSH'
          subject_template?: string | null
          body_template: string
          variables_description?: any | null
          enterprise_id?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          typ_notification_category_id?: number | null
          business_id?: string | null
          channel_type?: 'IN_APP' | 'EMAIL' | 'SMS' | 'CHAT' | 'PUSH'
          subject_template?: string | null
          body_template?: string
          variables_description?: any | null
          enterprise_id?: string | null
          updated_by?: string | null
        }
      }
      ent_notification_workflow: {
        Row: {
          id: number
          name: string
          description: string | null
          publish_status: 'DRAFT' | 'PUBLISHED'
          deactivated: boolean
          typ_notification_category_id: number | null
          business_id: string | null
          workflow_type: 'STATIC' | 'DYNAMIC'
          workflow_key: string
          default_channels: ('IN_APP' | 'EMAIL' | 'SMS' | 'CHAT' | 'PUSH')[] | null
          payload_schema: any | null
          control_schema: any | null
          template_overrides: any | null
          repr: string | null
          enterprise_id: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          name: string
          description?: string | null
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          typ_notification_category_id?: number | null
          business_id?: string | null
          workflow_type: 'STATIC' | 'DYNAMIC'
          workflow_key: string
          default_channels?: ('IN_APP' | 'EMAIL' | 'SMS' | 'CHAT' | 'PUSH')[] | null
          payload_schema?: any | null
          control_schema?: any | null
          template_overrides?: any | null
          enterprise_id?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          typ_notification_category_id?: number | null
          business_id?: string | null
          workflow_type?: 'STATIC' | 'DYNAMIC'
          workflow_key?: string
          default_channels?: ('IN_APP' | 'EMAIL' | 'SMS' | 'CHAT' | 'PUSH')[] | null
          payload_schema?: any | null
          control_schema?: any | null
          template_overrides?: any | null
          enterprise_id?: string | null
          updated_by?: string | null
        }
      }
      ent_notification_rule: {
        Row: {
          id: number
          name: string
          description: string | null
          publish_status: 'DRAFT' | 'PUBLISHED'
          deactivated: boolean
          notification_workflow_id: number
          business_id: string | null
          trigger_type: string
          trigger_config: any | null
          rule_payload: any | null
          repr: string | null
          enterprise_id: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          name: string
          description?: string | null
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          notification_workflow_id: number
          business_id?: string | null
          trigger_type: string
          trigger_config?: any | null
          rule_payload?: any | null
          enterprise_id?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          notification_workflow_id?: number
          business_id?: string | null
          trigger_type?: string
          trigger_config?: any | null
          rule_payload?: any | null
          enterprise_id?: string | null
          updated_by?: string | null
        }
      }
      ent_notification: {
        Row: {
          id: number
          name: string
          description: string | null
          publish_status: 'DRAFT' | 'PUBLISHED'
          deactivated: boolean
          typ_notification_category_id: number | null
          typ_notification_priority_id: number | null
          notification_workflow_id: number | null
          notification_rule_id: number | null
          notification_status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRACTED'
          business_id: string | null
          payload: any
          recipients: string[]
          channels: ('IN_APP' | 'EMAIL' | 'SMS' | 'CHAT' | 'PUSH')[] | null
          overrides: any | null
          tags: string[] | null
          transaction_id: string | null
          scheduled_for: string | null
          processed_at: string | null
          retracted_at: string | null
          retraction_reason: string | null
          error_details: any | null
          workflow_version: number | null
          repr: string | null
          enterprise_id: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          name: string
          description?: string | null
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          typ_notification_category_id?: number | null
          typ_notification_priority_id?: number | null
          notification_workflow_id?: number | null
          notification_rule_id?: number | null
          notification_status?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRACTED'
          business_id?: string | null
          payload: any
          recipients: string[]
          channels?: ('IN_APP' | 'EMAIL' | 'SMS' | 'CHAT' | 'PUSH')[] | null
          overrides?: any | null
          tags?: string[] | null
          transaction_id?: string | null
          scheduled_for?: string | null
          processed_at?: string | null
          retracted_at?: string | null
          retraction_reason?: string | null
          error_details?: any | null
          workflow_version?: number | null
          enterprise_id?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          typ_notification_category_id?: number | null
          typ_notification_priority_id?: number | null
          notification_workflow_id?: number | null
          notification_rule_id?: number | null
          notification_status?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRACTED'
          business_id?: string | null
          payload?: any
          recipients?: string[]
          channels?: ('IN_APP' | 'EMAIL' | 'SMS' | 'CHAT' | 'PUSH')[] | null
          overrides?: any | null
          tags?: string[] | null
          transaction_id?: string | null
          scheduled_for?: string | null
          processed_at?: string | null
          retracted_at?: string | null
          retraction_reason?: string | null
          error_details?: any | null
          workflow_version?: number | null
          enterprise_id?: string | null
          updated_by?: string | null
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {
      notification_channel_type: 'IN_APP' | 'EMAIL' | 'SMS' | 'CHAT' | 'PUSH'
      notification_workflow_type: 'STATIC' | 'DYNAMIC'
      notification_status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRACTED'
    }
    CompositeTypes: {}
  }
}