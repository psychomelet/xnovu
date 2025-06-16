export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  notify: {
    Tables: {
      deleted_record: {
        Row: {
          created_by: string | null
          data: Json
          deleted_at: string
          id: string
          object_id: number
          table_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_by?: string | null
          data: Json
          deleted_at?: string
          id?: string
          object_id: number
          table_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_by?: string | null
          data?: Json
          deleted_at?: string
          id?: string
          object_id?: number
          table_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ent_notification: {
        Row: {
          business_id: string | null
          channels:
            | Database["shared_types"]["Enums"]["notification_channel_type"][]
            | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          error_details: Json | null
          id: number
          name: string
          notification_rule_id: number | null
          notification_status: Database["shared_types"]["Enums"]["notification_status"]
          notification_workflow_id: number | null
          overrides: Json | null
          payload: Json
          processed_at: string | null
          publish_status: Database["shared_types"]["Enums"]["publish_status"]
          recipients: string[]
          repr: string | null
          retracted_at: string | null
          retraction_reason: string | null
          scheduled_for: string | null
          tags: string[] | null
          transaction_id: string | null
          typ_notification_category_id: number | null
          typ_notification_priority_id: number | null
          updated_at: string
          updated_by: string | null
          workflow_version: number | null
        }
        Insert: {
          business_id?: string | null
          channels?:
            | Database["shared_types"]["Enums"]["notification_channel_type"][]
            | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          error_details?: Json | null
          id?: never
          name: string
          notification_rule_id?: number | null
          notification_status?: Database["shared_types"]["Enums"]["notification_status"]
          notification_workflow_id?: number | null
          overrides?: Json | null
          payload: Json
          processed_at?: string | null
          publish_status?: Database["shared_types"]["Enums"]["publish_status"]
          recipients: string[]
          repr?: string | null
          retracted_at?: string | null
          retraction_reason?: string | null
          scheduled_for?: string | null
          tags?: string[] | null
          transaction_id?: string | null
          typ_notification_category_id?: number | null
          typ_notification_priority_id?: number | null
          updated_at?: string
          updated_by?: string | null
          workflow_version?: number | null
        }
        Update: {
          business_id?: string | null
          channels?:
            | Database["shared_types"]["Enums"]["notification_channel_type"][]
            | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          error_details?: Json | null
          id?: never
          name?: string
          notification_rule_id?: number | null
          notification_status?: Database["shared_types"]["Enums"]["notification_status"]
          notification_workflow_id?: number | null
          overrides?: Json | null
          payload?: Json
          processed_at?: string | null
          publish_status?: Database["shared_types"]["Enums"]["publish_status"]
          recipients?: string[]
          repr?: string | null
          retracted_at?: string | null
          retraction_reason?: string | null
          scheduled_for?: string | null
          tags?: string[] | null
          transaction_id?: string | null
          typ_notification_category_id?: number | null
          typ_notification_priority_id?: number | null
          updated_at?: string
          updated_by?: string | null
          workflow_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_notification_notification_rule_id_fkey"
            columns: ["notification_rule_id"]
            isOneToOne: false
            referencedRelation: "ent_notification_rule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_notification_notification_workflow_id_fkey"
            columns: ["notification_workflow_id"]
            isOneToOne: false
            referencedRelation: "ent_notification_workflow"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_notification_typ_notification_category_id_fkey"
            columns: ["typ_notification_category_id"]
            isOneToOne: false
            referencedRelation: "typ_notification_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_notification_typ_notification_priority_id_fkey"
            columns: ["typ_notification_priority_id"]
            isOneToOne: false
            referencedRelation: "typ_notification_priority"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_notification_rule: {
        Row: {
          business_id: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: number
          name: string
          notification_workflow_id: number
          publish_status: Database["shared_types"]["Enums"]["publish_status"]
          repr: string | null
          rule_payload: Json | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name: string
          notification_workflow_id: number
          publish_status?: Database["shared_types"]["Enums"]["publish_status"]
          repr?: string | null
          rule_payload?: Json | null
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name?: string
          notification_workflow_id?: number
          publish_status?: Database["shared_types"]["Enums"]["publish_status"]
          repr?: string | null
          rule_payload?: Json | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_notification_rule_notification_workflow_id_fkey"
            columns: ["notification_workflow_id"]
            isOneToOne: false
            referencedRelation: "ent_notification_workflow"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_notification_template: {
        Row: {
          body_template: string
          business_id: string | null
          channel_type: Database["shared_types"]["Enums"]["notification_channel_type"]
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: number
          name: string
          publish_status: Database["shared_types"]["Enums"]["publish_status"]
          repr: string | null
          subject_template: string | null
          typ_notification_category_id: number | null
          updated_at: string
          updated_by: string | null
          variables_description: Json | null
        }
        Insert: {
          body_template: string
          business_id?: string | null
          channel_type: Database["shared_types"]["Enums"]["notification_channel_type"]
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: Database["shared_types"]["Enums"]["publish_status"]
          repr?: string | null
          subject_template?: string | null
          typ_notification_category_id?: number | null
          updated_at?: string
          updated_by?: string | null
          variables_description?: Json | null
        }
        Update: {
          body_template?: string
          business_id?: string | null
          channel_type?: Database["shared_types"]["Enums"]["notification_channel_type"]
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: Database["shared_types"]["Enums"]["publish_status"]
          repr?: string | null
          subject_template?: string | null
          typ_notification_category_id?: number | null
          updated_at?: string
          updated_by?: string | null
          variables_description?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_notification_template_typ_notification_category_id_fkey"
            columns: ["typ_notification_category_id"]
            isOneToOne: false
            referencedRelation: "typ_notification_category"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_notification_workflow: {
        Row: {
          business_id: string | null
          control_schema: Json | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          default_channels:
            | Database["shared_types"]["Enums"]["notification_channel_type"][]
            | null
          description: string | null
          enterprise_id: string | null
          id: number
          name: string
          payload_schema: Json | null
          publish_status: Database["shared_types"]["Enums"]["publish_status"]
          repr: string | null
          template_overrides: Json | null
          typ_notification_category_id: number | null
          updated_at: string
          updated_by: string | null
          workflow_key: string
          workflow_type: Database["shared_types"]["Enums"]["notification_workflow_type"]
        }
        Insert: {
          business_id?: string | null
          control_schema?: Json | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          default_channels?:
            | Database["shared_types"]["Enums"]["notification_channel_type"][]
            | null
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name: string
          payload_schema?: Json | null
          publish_status?: Database["shared_types"]["Enums"]["publish_status"]
          repr?: string | null
          template_overrides?: Json | null
          typ_notification_category_id?: number | null
          updated_at?: string
          updated_by?: string | null
          workflow_key: string
          workflow_type: Database["shared_types"]["Enums"]["notification_workflow_type"]
        }
        Update: {
          business_id?: string | null
          control_schema?: Json | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          default_channels?:
            | Database["shared_types"]["Enums"]["notification_channel_type"][]
            | null
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name?: string
          payload_schema?: Json | null
          publish_status?: Database["shared_types"]["Enums"]["publish_status"]
          repr?: string | null
          template_overrides?: Json | null
          typ_notification_category_id?: number | null
          updated_at?: string
          updated_by?: string | null
          workflow_key?: string
          workflow_type?: Database["shared_types"]["Enums"]["notification_workflow_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ent_notification_workflow_typ_notification_category_id_fkey"
            columns: ["typ_notification_category_id"]
            isOneToOne: false
            referencedRelation: "typ_notification_category"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_notification_category: {
        Row: {
          business_id: string | null
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: number
          name: string
          path: unknown | null
          path_text: string | null
          publish_status: Database["shared_types"]["Enums"]["publish_status"]
          repr: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name: string
          path?: unknown | null
          path_text?: string | null
          publish_status?: Database["shared_types"]["Enums"]["publish_status"]
          repr?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name?: string
          path?: unknown | null
          path_text?: string | null
          publish_status?: Database["shared_types"]["Enums"]["publish_status"]
          repr?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_notification_priority: {
        Row: {
          business_id: string | null
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: number
          name: string
          publish_status: Database["shared_types"]["Enums"]["publish_status"]
          repr: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: Database["shared_types"]["Enums"]["publish_status"]
          repr?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: Database["shared_types"]["Enums"]["publish_status"]
          repr?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  shared_types: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_enum_if_not_exists: {
        Args: { enum_name: string; enum_values: string[] }
        Returns: undefined
      }
      create_result_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      ensure_enum_values: {
        Args: { enum_name: string; enum_values: string[] }
        Returns: undefined
      }
    }
    Enums: {
      action_type:
        | "NONE"
        | "INPUT_TEXT"
        | "RADIO"
        | "CHECKBOX"
        | "FILE"
        | "MEDIA"
      activity_status:
        | "CREATED"
        | "IN_PROGRESS"
        | "SUSPENDED"
        | "DONE"
        | "FAILED"
      alarm_status:
        | "UNPROCESSED"
        | "ACKNOWLEDGED"
        | "PROCESSING"
        | "VERIFIED"
        | "EMERGENCY RESPONSE"
        | "RESOLVED"
        | "CLOSED"
        | "CANCELLED"
        | "ESCALATED"
      connection_status: "ONLINE" | "OFFLINE"
      equipment_status_type:
        | "OPERATIONAL"
        | "UNDER_MAINTENANCE"
        | "DECOMMISSIONED"
        | "OUT_OF_STOCK"
      gender_type: "MALE" | "FEMALE" | "OTHER"
      hazard_status:
        | "DRAFT"
        | "REPORTED"
        | "INVESTIGATING"
        | "RECTIFICATION_PENDING"
        | "RECTIFICATION_IN_PROGRESS"
        | "CLOSED_VERIFIED"
        | "CLOSED_UNVERIFIED"
        | "CANCELLED"
      hazard_target_type: "SPACE" | "DEVICE" | "POINT" | "DOOR" | "ACCESS"
      health_status:
        | "NORMAL"
        | "FAULT"
        | "LOW_BATTERY"
        | "MAINTENANCE_REQUIRED"
        | "CONTAMINATION"
        | "END_OF_LIFE"
        | "HARDWARE_FAULT"
      location_history_entity_type: "USER" | "DEVICE"
      notification_channel_type: "IN_APP" | "EMAIL" | "SMS" | "CHAT" | "PUSH"
      notification_status:
        | "PENDING"
        | "PROCESSING"
        | "SENT"
        | "FAILED"
        | "RETRACTED"
      notification_workflow_type: "STATIC" | "DYNAMIC"
      operational_status:
        | "NORMAL"
        | "OPERATIONALWARNING"
        | "ALARM"
        | "Acknowledged"
      order_status: "OPEN" | "COMPLETED" | "FAILED" | "CANCELED"
      patrol_level_type: "LOW" | "MEDIUM" | "HIGH"
      permission_type: "SELECT" | "INSERT" | "UPDATE" | "DELETE"
      publish_status:
        | "NONE"
        | "DRAFT"
        | "DISCARD"
        | "PUBLISH"
        | "DELETED"
        | "REVIEW"
      register_status: "NOT_REGISTERED" | "REGISTERED" | "VERIFIED" | "REJECTED"
      role_type: "SYSTEM" | "ENTERPRISE" | "ENTERPRISE_CUSTOM"
      route_status_type:
        | "OPERATIONAL"
        | "BLOCKED"
        | "UNDER_MAINTENANCE"
        | "HAZARDOUS"
        | "RESTRICTED_ACCESS"
      route_type: "STANDARD" | "EVACUATION" | "RESCUE" | "PATROL"
      staff_type: "USER" | "ROBOT" | "CELL"
      ticket_state:
        | "CREATED"
        | "WAITING_FOR_SUBTICKETS"
        | "COMPLETED_SUCCESS"
        | "COMPLETED_FAIL"
        | "CANCELED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  notify: {
    Enums: {},
  },
  shared_types: {
    Enums: {
      action_type: ["NONE", "INPUT_TEXT", "RADIO", "CHECKBOX", "FILE", "MEDIA"],
      activity_status: [
        "CREATED",
        "IN_PROGRESS",
        "SUSPENDED",
        "DONE",
        "FAILED",
      ],
      alarm_status: [
        "UNPROCESSED",
        "ACKNOWLEDGED",
        "PROCESSING",
        "VERIFIED",
        "EMERGENCY RESPONSE",
        "RESOLVED",
        "CLOSED",
        "CANCELLED",
        "ESCALATED",
      ],
      connection_status: ["ONLINE", "OFFLINE"],
      equipment_status_type: [
        "OPERATIONAL",
        "UNDER_MAINTENANCE",
        "DECOMMISSIONED",
        "OUT_OF_STOCK",
      ],
      gender_type: ["MALE", "FEMALE", "OTHER"],
      hazard_status: [
        "DRAFT",
        "REPORTED",
        "INVESTIGATING",
        "RECTIFICATION_PENDING",
        "RECTIFICATION_IN_PROGRESS",
        "CLOSED_VERIFIED",
        "CLOSED_UNVERIFIED",
        "CANCELLED",
      ],
      hazard_target_type: ["SPACE", "DEVICE", "POINT", "DOOR", "ACCESS"],
      health_status: [
        "NORMAL",
        "FAULT",
        "LOW_BATTERY",
        "MAINTENANCE_REQUIRED",
        "CONTAMINATION",
        "END_OF_LIFE",
        "HARDWARE_FAULT",
      ],
      location_history_entity_type: ["USER", "DEVICE"],
      notification_channel_type: ["IN_APP", "EMAIL", "SMS", "CHAT", "PUSH"],
      notification_status: [
        "PENDING",
        "PROCESSING",
        "SENT",
        "FAILED",
        "RETRACTED",
      ],
      notification_workflow_type: ["STATIC", "DYNAMIC"],
      operational_status: [
        "NORMAL",
        "OPERATIONALWARNING",
        "ALARM",
        "Acknowledged",
      ],
      order_status: ["OPEN", "COMPLETED", "FAILED", "CANCELED"],
      patrol_level_type: ["LOW", "MEDIUM", "HIGH"],
      permission_type: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      publish_status: [
        "NONE",
        "DRAFT",
        "DISCARD",
        "PUBLISH",
        "DELETED",
        "REVIEW",
      ],
      register_status: ["NOT_REGISTERED", "REGISTERED", "VERIFIED", "REJECTED"],
      role_type: ["SYSTEM", "ENTERPRISE", "ENTERPRISE_CUSTOM"],
      route_status_type: [
        "OPERATIONAL",
        "BLOCKED",
        "UNDER_MAINTENANCE",
        "HAZARDOUS",
        "RESTRICTED_ACCESS",
      ],
      route_type: ["STANDARD", "EVACUATION", "RESCUE", "PATROL"],
      staff_type: ["USER", "ROBOT", "CELL"],
      ticket_state: [
        "CREATED",
        "WAITING_FOR_SUBTICKETS",
        "COMPLETED_SUCCESS",
        "COMPLETED_FAIL",
        "CANCELED",
      ],
    },
  },
} as const
