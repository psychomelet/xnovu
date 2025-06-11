export interface Database {
  public: {
    Tables: {
      ent_notification: {
        Row: {
          id: string
          enterprise_id: string
          workflow_key: string
          subscriber_id: string
          payload: any
          status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRACTED'
          transaction_id: string | null
          created_at: string
          updated_at: string
          error_details: string | null
        }
        Insert: {
          id?: string
          enterprise_id: string
          workflow_key: string
          subscriber_id: string
          payload: any
          status?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRACTED'
          transaction_id?: string | null
          created_at?: string
          updated_at?: string
          error_details?: string | null
        }
        Update: {
          id?: string
          enterprise_id?: string
          workflow_key?: string
          subscriber_id?: string
          payload?: any
          status?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRACTED'
          transaction_id?: string | null
          created_at?: string
          updated_at?: string
          error_details?: string | null
        }
      }
      ent_notification_workflow: {
        Row: {
          id: string
          enterprise_id: string
          workflow_key: string
          workflow_name: string
          workflow_type: 'STATIC' | 'DYNAMIC'
          channels: ('EMAIL' | 'SMS' | 'PUSH' | 'IN_APP' | 'CHAT')[]
          publish_status: 'DRAFT' | 'PUBLISHED'
          deactivated: boolean
          config: any
          payload_schema: any
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          enterprise_id: string
          workflow_key: string
          workflow_name: string
          workflow_type: 'STATIC' | 'DYNAMIC'
          channels: ('EMAIL' | 'SMS' | 'PUSH' | 'IN_APP' | 'CHAT')[]
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          config?: any
          payload_schema?: any
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          enterprise_id?: string
          workflow_key?: string
          workflow_name?: string
          workflow_type?: 'STATIC' | 'DYNAMIC'
          channels?: ('EMAIL' | 'SMS' | 'PUSH' | 'IN_APP' | 'CHAT')[]
          publish_status?: 'DRAFT' | 'PUBLISHED'
          deactivated?: boolean
          config?: any
          payload_schema?: any
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      ent_notification_template: {
        Row: {
          id: string
          enterprise_id: string
          template_name: string
          template_type: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP' | 'CHAT'
          subject_template: string | null
          body_template: string
          metadata: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          enterprise_id: string
          template_name: string
          template_type: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP' | 'CHAT'
          subject_template?: string | null
          body_template: string
          metadata?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          enterprise_id?: string
          template_name?: string
          template_type?: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP' | 'CHAT'
          subject_template?: string | null
          body_template?: string
          metadata?: any
          created_at?: string
          updated_at?: string
        }
      }
      ent_notification_rule: {
        Row: {
          id: string
          enterprise_id: string
          rule_name: string
          trigger_type: 'EVENT' | 'SCHEDULE'
          trigger_config: {
            event_name?: string
            cron?: string
            conditions?: any
          }
          rule_payload: string
          workflow_key: string
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          enterprise_id: string
          rule_name: string
          trigger_type: 'EVENT' | 'SCHEDULE'
          trigger_config: {
            event_name?: string
            cron?: string
            conditions?: any
          }
          rule_payload: string
          workflow_key: string
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          enterprise_id?: string
          rule_name?: string
          trigger_type?: 'EVENT' | 'SCHEDULE'
          trigger_config?: {
            event_name?: string
            cron?: string
            conditions?: any
          }
          rule_payload?: string
          workflow_key?: string
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}