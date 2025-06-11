export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  base: {
    Tables: {
      app_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string | null
          permission: string
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string | null
          permission: string
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string | null
          permission?: string
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      app_roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          enterprise_id: string | null
          id: string
          name: string | null
          repr: string | null
          role: string
          role_type: Database["shared_types"]["Enums"]["role_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string | null
          repr?: string | null
          role: string
          role_type?: Database["shared_types"]["Enums"]["role_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string | null
          repr?: string | null
          role?: string
          role_type?: Database["shared_types"]["Enums"]["role_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_roles_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      cad_floor_plan: {
        Row: {
          cad_urls: Json
          created_at: string
          created_by: string | null
          geojson: Json
          geom: unknown | null
          height: number | null
          id: string
          import_task_id: string | null
          name: string
          repr: string | null
          space_id: string | null
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cad_urls?: Json
          created_at?: string
          created_by?: string | null
          geojson?: Json
          geom?: unknown | null
          height?: number | null
          id?: string
          import_task_id?: string | null
          name: string
          repr?: string | null
          space_id?: string | null
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cad_urls?: Json
          created_at?: string
          created_by?: string | null
          geojson?: Json
          geom?: unknown | null
          height?: number | null
          id?: string
          import_task_id?: string | null
          name?: string
          repr?: string | null
          space_id?: string | null
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cad_floor_plan_element: {
        Row: {
          created_at: string
          created_by: string | null
          device_slot_id: string | null
          door_id: string | null
          floor_plan_id: string
          geom: unknown
          id: string
          name: string
          point_id: string | null
          properties: Json
          space_id: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_slot_id?: string | null
          door_id?: string | null
          floor_plan_id: string
          geom: unknown
          id?: string
          name: string
          point_id?: string | null
          properties?: Json
          space_id: string
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_slot_id?: string | null
          door_id?: string | null
          floor_plan_id?: string
          geom?: unknown
          id?: string
          name?: string
          point_id?: string | null
          properties?: Json
          space_id?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cad_floor_plan_element_device_slot_id_fkey"
            columns: ["device_slot_id"]
            isOneToOne: false
            referencedRelation: "ent_device_slot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cad_floor_plan_element_door_id_fkey"
            columns: ["door_id"]
            isOneToOne: false
            referencedRelation: "ent_door"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cad_floor_plan_element_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "cad_floor_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cad_floor_plan_element_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "ent_point"
            referencedColumns: ["id"]
          },
        ]
      }
      cad_floor_plan_extracting_task: {
        Row: {
          created_at: string
          created_by: string | null
          error: string
          file_url: string
          id: string
          imported_target_id: string | null
          logs: string[]
          mode: string
          result: Json
          space_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string
          file_url: string
          id?: string
          imported_target_id?: string | null
          logs: string[]
          mode: string
          result: Json
          space_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string
          file_url?: string
          id?: string
          imported_target_id?: string | null
          logs?: string[]
          mode?: string
          result?: Json
          space_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      deleted_record: {
        Row: {
          created_by: string | null
          data: Json
          deleted_at: string
          id: string
          object_id: string
          table_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_by?: string | null
          data: Json
          deleted_at?: string
          id?: string
          object_id: string
          table_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_by?: string | null
          data?: Json
          deleted_at?: string
          id?: string
          object_id?: string
          table_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ent_access: {
        Row: {
          access_type_id: string
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          geom: unknown | null
          id: string
          name: string | null
          repr: string | null
          space_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_type_id: string
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          geom?: unknown | null
          id?: string
          name?: string | null
          repr?: string | null
          space_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_type_id?: string
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          geom?: unknown | null
          id?: string
          name?: string | null
          repr?: string | null
          space_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_access_access_type_id_fkey"
            columns: ["access_type_id"]
            isOneToOne: false
            referencedRelation: "typ_device_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_access_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_alarm_code: {
        Row: {
          alarm_code_category_id: string
          alarm_code_level_id: string
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          id: string
          interval_time: number
          name: string | null
          repr: string | null
          timeout: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alarm_code_category_id: string
          alarm_code_level_id: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          interval_time?: number
          name?: string | null
          repr?: string | null
          timeout?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alarm_code_category_id?: string
          alarm_code_level_id?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          interval_time?: number
          name?: string | null
          repr?: string | null
          timeout?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_alarm_code_alarm_code_category_id_fkey"
            columns: ["alarm_code_category_id"]
            isOneToOne: false
            referencedRelation: "typ_alarm_code_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_alarm_code_alarm_code_level_id_fkey"
            columns: ["alarm_code_level_id"]
            isOneToOne: false
            referencedRelation: "typ_alarm_code_level"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_analysis_config: {
        Row: {
          code: string | null
          config_details: Json
          config_scope: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          config_details: Json
          config_scope?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          config_details?: Json
          config_scope?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_analysis_config_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_archive: {
        Row: {
          archive_type_id: string
          attributes: Json | null
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          device_id: string | null
          enterprise_id: string | null
          id: string
          name: string
          parent_archive_id: string | null
          path: unknown | null
          path_text: string | null
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archive_type_id: string
          attributes?: Json | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          device_id?: string | null
          enterprise_id?: string | null
          id?: string
          name: string
          parent_archive_id?: string | null
          path?: unknown | null
          path_text?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archive_type_id?: string
          attributes?: Json | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          device_id?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string
          parent_archive_id?: string | null
          path?: unknown | null
          path_text?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_archive_archive_type_id_fkey"
            columns: ["archive_type_id"]
            isOneToOne: false
            referencedRelation: "typ_archive_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_archive_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_archive_parent_archive_id_fkey"
            columns: ["parent_archive_id"]
            isOneToOne: false
            referencedRelation: "ent_archive"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_area: {
        Row: {
          area_type: string
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          geom: unknown | null
          id: string
          important_area: boolean
          key_level: string | null
          name: string
          risk_grade: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_type: string
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          geom?: unknown | null
          id?: string
          important_area?: boolean
          key_level?: string | null
          name: string
          risk_grade?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_type?: string
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          geom?: unknown | null
          id?: string
          important_area?: boolean
          key_level?: string | null
          name?: string
          risk_grade?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_area_area_type_fkey"
            columns: ["area_type"]
            isOneToOne: false
            referencedRelation: "typ_area_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_area_key_level_fkey"
            columns: ["key_level"]
            isOneToOne: false
            referencedRelation: "typ_key_level"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_area_risk_grade_fkey"
            columns: ["risk_grade"]
            isOneToOne: false
            referencedRelation: "typ_risk_grade"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_circuit_line: {
        Row: {
          circuit_line_category_id: number | null
          code: string | null
          created_at: string
          created_by: string | null
          current_level_info: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: number
          length_meters: number | null
          max_load_info: string | null
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          status_category_id: number | null
          updated_at: string
          updated_by: string | null
          voltage_level_info: string | null
        }
        Insert: {
          circuit_line_category_id?: number | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          current_level_info?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          length_meters?: number | null
          max_load_info?: string | null
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          status_category_id?: number | null
          updated_at?: string
          updated_by?: string | null
          voltage_level_info?: string | null
        }
        Update: {
          circuit_line_category_id?: number | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          current_level_info?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          length_meters?: number | null
          max_load_info?: string | null
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          status_category_id?: number | null
          updated_at?: string
          updated_by?: string | null
          voltage_level_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_circuit_line_circuit_line_category_id_fkey"
            columns: ["circuit_line_category_id"]
            isOneToOne: false
            referencedRelation: "typ_circuit_line_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_circuit_line_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_circuit_line_status_category_id_fkey"
            columns: ["status_category_id"]
            isOneToOne: false
            referencedRelation: "typ_circuit_line_status_category"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_collection_scheme: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          scheme_details: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          scheme_details: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          scheme_details?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_collection_scheme_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_control_room: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          space_id: string | null
          updated_at: string
          updated_by: string | null
          video_surveillance_info: Json | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          space_id?: string | null
          updated_at?: string
          updated_by?: string | null
          video_surveillance_info?: Json | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          space_id?: string | null
          updated_at?: string
          updated_by?: string | null
          video_surveillance_info?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_control_room_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_danger_source: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          geom: unknown | null
          id: string
          name: string
          space_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          geom?: unknown | null
          id?: string
          name: string
          space_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          geom?: unknown | null
          id?: string
          name?: string
          space_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ent_department: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          head_user_id: string | null
          id: string
          name: string | null
          path: unknown | null
          path_text: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          head_user_id?: string | null
          id?: string
          name?: string | null
          path?: unknown | null
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          head_user_id?: string | null
          id?: string
          name?: string | null
          path?: unknown | null
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_department_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_device_group: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          device_type_id: string
          enterprise_id: string | null
          id: string
          name: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          device_type_id: string
          enterprise_id?: string | null
          id?: string
          name?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          device_type_id?: string
          enterprise_id?: string | null
          id?: string
          name?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_device_group_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "typ_device_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_device_group_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_device_metric_params: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          id: string
          name: string | null
          repr: string | null
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name?: string | null
          repr?: string | null
          unit_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name?: string | null
          repr?: string | null
          unit_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_device_metric_params_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "typ_param_unit"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_device_slot: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          device_type_id: string
          geom: unknown | null
          id: string
          name: string | null
          repr: string | null
          space_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          device_type_id: string
          geom?: unknown | null
          id?: string
          name?: string | null
          repr?: string | null
          space_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          device_type_id?: string
          geom?: unknown | null
          id?: string
          name?: string | null
          repr?: string | null
          space_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_device_slot_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "typ_device_type"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_distribution_box_profile: {
        Row: {
          base_device_id: string
          capacity_info: Json | null
          code: string | null
          contact_person_name: string | null
          contact_phone_number: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: number
          installation_address_text: string | null
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_device_id: string
          capacity_info?: Json | null
          code?: string | null
          contact_person_name?: string | null
          contact_phone_number?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          installation_address_text?: string | null
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_device_id?: string
          capacity_info?: Json | null
          code?: string | null
          contact_person_name?: string | null
          contact_phone_number?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          installation_address_text?: string | null
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_distribution_box_profile_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_distribution_cabinet_profile: {
        Row: {
          base_device_id: string
          code: string | null
          contact_person_name: string | null
          contact_phone_number: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: number
          location_description_text: string | null
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          rated_current_ma: number | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_device_id: string
          code?: string | null
          contact_person_name?: string | null
          contact_phone_number?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          location_description_text?: string | null
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          rated_current_ma?: number | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_device_id?: string
          code?: string | null
          contact_person_name?: string | null
          contact_phone_number?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          location_description_text?: string | null
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          rated_current_ma?: number | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_distribution_cabinet_profile_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_door: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          door_type_id: string
          geom: unknown | null
          id: string
          name: string | null
          repr: string | null
          space_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          door_type_id: string
          geom?: unknown | null
          id?: string
          name?: string | null
          repr?: string | null
          space_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          door_type_id?: string
          geom?: unknown | null
          id?: string
          name?: string | null
          repr?: string | null
          space_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_door_door_type_id_fkey"
            columns: ["door_type_id"]
            isOneToOne: false
            referencedRelation: "typ_device_type"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_enterprise: {
        Row: {
          business_license: Json[] | null
          contact_person: string | null
          contact_phone: string | null
          contract_agreements: Json[] | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          email: string | null
          enterprise_category_id: string | null
          enterprise_type_id: string
          entry_date: string | null
          exit_date: string | null
          id: string
          legal_representative: string | null
          location_details: Json[] | null
          location_names: Json[] | null
          name: string | null
          operating_qualifications: Json[] | null
          organization_images: Json[] | null
          registration_address: string | null
          repr: string | null
          super_admin_name: string | null
          super_admin_phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_license?: Json[] | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_agreements?: Json[] | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          email?: string | null
          enterprise_category_id?: string | null
          enterprise_type_id: string
          entry_date?: string | null
          exit_date?: string | null
          id?: string
          legal_representative?: string | null
          location_details?: Json[] | null
          location_names?: Json[] | null
          name?: string | null
          operating_qualifications?: Json[] | null
          organization_images?: Json[] | null
          registration_address?: string | null
          repr?: string | null
          super_admin_name?: string | null
          super_admin_phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_license?: Json[] | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_agreements?: Json[] | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          email?: string | null
          enterprise_category_id?: string | null
          enterprise_type_id?: string
          entry_date?: string | null
          exit_date?: string | null
          id?: string
          legal_representative?: string | null
          location_details?: Json[] | null
          location_names?: Json[] | null
          name?: string | null
          operating_qualifications?: Json[] | null
          organization_images?: Json[] | null
          registration_address?: string | null
          repr?: string | null
          super_admin_name?: string | null
          super_admin_phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_enterprise_enterprise_category_id_fkey"
            columns: ["enterprise_category_id"]
            isOneToOne: false
            referencedRelation: "typ_enterprise_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_enterprise_enterprise_type_id_fkey"
            columns: ["enterprise_type_id"]
            isOneToOne: false
            referencedRelation: "typ_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_feature_data_rule: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          data_extraction_rule: Json
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          storage_details: Json | null
          target_tag_category_id: string | null
          task_executor_class: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          data_extraction_rule: Json
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          storage_details?: Json | null
          target_tag_category_id?: string | null
          task_executor_class?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          data_extraction_rule?: Json
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          storage_details?: Json | null
          target_tag_category_id?: string | null
          task_executor_class?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_feature_data_rule_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_feature_data_rule_target_tag_category_id_fkey"
            columns: ["target_tag_category_id"]
            isOneToOne: false
            referencedRelation: "typ_tag_category"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_floor_plan: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated: boolean
          geojson: Json
          geom: unknown | null
          height: number
          id: string
          name: string | null
          repr: string | null
          space_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          geojson?: Json
          geom?: unknown | null
          height: number
          id?: string
          name?: string | null
          repr?: string | null
          space_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          geojson?: Json
          geom?: unknown | null
          height?: number
          id?: string
          name?: string | null
          repr?: string | null
          space_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ent_holiday_schedule: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          holiday_date: string
          id: string
          name: string
          schedule_work: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          holiday_date: string
          id?: string
          name: string
          schedule_work?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          holiday_date?: string
          id?: string
          name?: string
          schedule_work?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ent_managed_plan_document: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          file_info: Json | null
          id: number
          managed_plan_category_id: number | null
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          related_space_id: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          file_info?: Json | null
          id?: never
          managed_plan_category_id?: number | null
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          related_space_id?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          file_info?: Json | null
          id?: never
          managed_plan_category_id?: number | null
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          related_space_id?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_managed_plan_document_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_managed_plan_document_managed_plan_category_id_fkey"
            columns: ["managed_plan_category_id"]
            isOneToOne: false
            referencedRelation: "typ_managed_plan_category"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_model_element: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated: boolean
          id: string
          layer: string
          linked_entity_id: string | null
          linked_entity_type: string | null
          model_type: string
          name: string
          position: Json
          properties: Json
          repr: string | null
          rotation: Json
          scale: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          layer: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          model_type: string
          name: string
          position?: Json
          properties?: Json
          repr?: string | null
          rotation?: Json
          scale?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          layer?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          model_type?: string
          name?: string
          position?: Json
          properties?: Json
          repr?: string | null
          rotation?: Json
          scale?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ent_park_area_profile: {
        Row: {
          area_images: Json | null
          base_space_id: string
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: number
          name: string
          park_area_category_id: number | null
          population_count: number | null
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_images?: Json | null
          base_space_id: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name: string
          park_area_category_id?: number | null
          population_count?: number | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_images?: Json | null
          base_space_id?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name?: string
          park_area_category_id?: number | null
          population_count?: number | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_park_area_profile_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_park_area_profile_park_area_category_id_fkey"
            columns: ["park_area_category_id"]
            isOneToOne: false
            referencedRelation: "typ_park_area_category"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_park_building_profile: {
        Row: {
          address_text: string | null
          base_space_id: string
          building_function_id: number | null
          building_height_meters: number | null
          building_images: Json | null
          building_structure_id: number | null
          code: string | null
          combustion_property_id: number | null
          construction_year: number | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          fire_resistance_rating_id: number | null
          id: number
          name: string
          parent_area_profile_id: number | null
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_text?: string | null
          base_space_id: string
          building_function_id?: number | null
          building_height_meters?: number | null
          building_images?: Json | null
          building_structure_id?: number | null
          code?: string | null
          combustion_property_id?: number | null
          construction_year?: number | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          fire_resistance_rating_id?: number | null
          id?: never
          name: string
          parent_area_profile_id?: number | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_text?: string | null
          base_space_id?: string
          building_function_id?: number | null
          building_height_meters?: number | null
          building_images?: Json | null
          building_structure_id?: number | null
          code?: string | null
          combustion_property_id?: number | null
          construction_year?: number | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          fire_resistance_rating_id?: number | null
          id?: never
          name?: string
          parent_area_profile_id?: number | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_park_building_profile_building_function_id_fkey"
            columns: ["building_function_id"]
            isOneToOne: false
            referencedRelation: "typ_building_function"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_park_building_profile_building_structure_id_fkey"
            columns: ["building_structure_id"]
            isOneToOne: false
            referencedRelation: "typ_building_structure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_park_building_profile_combustion_property_id_fkey"
            columns: ["combustion_property_id"]
            isOneToOne: false
            referencedRelation: "typ_combustion_property"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_park_building_profile_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_park_building_profile_fire_resistance_rating_id_fkey"
            columns: ["fire_resistance_rating_id"]
            isOneToOne: false
            referencedRelation: "typ_fire_resistance_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_park_building_profile_parent_area_profile_id_fkey"
            columns: ["parent_area_profile_id"]
            isOneToOne: false
            referencedRelation: "ent_park_area_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_park_floor_profile: {
        Row: {
          base_space_id: string
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          floor_height_meters: number | null
          floor_usage_category_id: number | null
          id: number
          name: string
          parent_building_profile_id: number
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_space_id: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          floor_height_meters?: number | null
          floor_usage_category_id?: number | null
          id?: never
          name: string
          parent_building_profile_id: number
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_space_id?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          floor_height_meters?: number | null
          floor_usage_category_id?: number | null
          id?: never
          name?: string
          parent_building_profile_id?: number
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_park_floor_profile_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_park_floor_profile_floor_usage_category_id_fkey"
            columns: ["floor_usage_category_id"]
            isOneToOne: false
            referencedRelation: "typ_floor_usage_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_park_floor_profile_parent_building_profile_id_fkey"
            columns: ["parent_building_profile_id"]
            isOneToOne: false
            referencedRelation: "ent_park_building_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_park_master_profile: {
        Row: {
          base_enterprise_id: string
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: number
          name: string
          park_address_full_text: string | null
          park_contact_details: Json | null
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_enterprise_id: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name: string
          park_address_full_text?: string | null
          park_contact_details?: Json | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_enterprise_id?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name?: string
          park_address_full_text?: string | null
          park_contact_details?: Json | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_park_master_profile_base_enterprise_id_fkey"
            columns: ["base_enterprise_id"]
            isOneToOne: true
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_park_master_profile_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_park_tenant_profile: {
        Row: {
          base_enterprise_id: string
          business_license_info: Json | null
          code: string | null
          company_images_info: Json | null
          contact_phone_number: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          email_address: string | null
          enterprise_id: string | null
          id: number
          legal_representative_name: string | null
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          registered_address: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_enterprise_id: string
          business_license_info?: Json | null
          code?: string | null
          company_images_info?: Json | null
          contact_phone_number?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          email_address?: string | null
          enterprise_id?: string | null
          id?: never
          legal_representative_name?: string | null
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          registered_address?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_enterprise_id?: string
          business_license_info?: Json | null
          code?: string | null
          company_images_info?: Json | null
          contact_phone_number?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          email_address?: string | null
          enterprise_id?: string | null
          id?: never
          legal_representative_name?: string | null
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          registered_address?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_park_tenant_profile_base_enterprise_id_fkey"
            columns: ["base_enterprise_id"]
            isOneToOne: true
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_park_tenant_profile_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_plan_drawing_element: {
        Row: {
          created_at: string
          created_by: string | null
          custom_data: Json | null
          deactivated: boolean
          description: string | null
          element_type_name: string
          enterprise_id: string | null
          geometry_on_plan_info: Json | null
          id: number
          linked_base_device_id: string | null
          linked_base_space_id: string | null
          managed_plan_document_id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_data?: Json | null
          deactivated?: boolean
          description?: string | null
          element_type_name: string
          enterprise_id?: string | null
          geometry_on_plan_info?: Json | null
          id?: never
          linked_base_device_id?: string | null
          linked_base_space_id?: string | null
          managed_plan_document_id: number
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_data?: Json | null
          deactivated?: boolean
          description?: string | null
          element_type_name?: string
          enterprise_id?: string | null
          geometry_on_plan_info?: Json | null
          id?: never
          linked_base_device_id?: string | null
          linked_base_space_id?: string | null
          managed_plan_document_id?: number
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_plan_drawing_element_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_plan_drawing_element_managed_plan_document_id_fkey"
            columns: ["managed_plan_document_id"]
            isOneToOne: false
            referencedRelation: "ent_managed_plan_document"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_point: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          geom: unknown | null
          id: string
          name: string | null
          point_type_id: string
          qrcode: string | null
          repr: string | null
          space_id: string
          space_name: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          geom?: unknown | null
          id?: string
          name?: string | null
          point_type_id: string
          qrcode?: string | null
          repr?: string | null
          space_id: string
          space_name?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          geom?: unknown | null
          id?: string
          name?: string | null
          point_type_id?: string
          qrcode?: string | null
          repr?: string | null
          space_id?: string
          space_name?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_point_point_type_id_fkey"
            columns: ["point_type_id"]
            isOneToOne: false
            referencedRelation: "typ_device_type"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_power_distribution_room_profile: {
        Row: {
          address_text: string | null
          base_space_id: string
          capacity_info: Json | null
          code: string | null
          construction_date: string | null
          contact_person_name: string | null
          contact_phone_number: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          rated_voltage_info: Json | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_text?: string | null
          base_space_id: string
          capacity_info?: Json | null
          code?: string | null
          construction_date?: string | null
          contact_person_name?: string | null
          contact_phone_number?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          rated_voltage_info?: Json | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_text?: string | null
          base_space_id?: string
          capacity_info?: Json | null
          code?: string | null
          construction_date?: string | null
          contact_person_name?: string | null
          contact_phone_number?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          rated_voltage_info?: Json | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_power_distribution_room_profile_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_profile_group: {
        Row: {
          archive_type_id: string
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          grouping_rule_details: Json | null
          grouping_rule_type: string
          id: string
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archive_type_id: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          grouping_rule_details?: Json | null
          grouping_rule_type: string
          id?: string
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archive_type_id?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          grouping_rule_details?: Json | null
          grouping_rule_type?: string
          id?: string
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_profile_group_archive_type_id_fkey"
            columns: ["archive_type_id"]
            isOneToOne: false
            referencedRelation: "typ_archive_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_profile_group_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_schedule: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          name: string | null
          ref_schedule_id: number
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string | null
          ref_schedule_id: number
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string | null
          ref_schedule_id?: number
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_schedule_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_social_rescue_force: {
        Row: {
          address_text: string | null
          code: string | null
          contact_person_name: string | null
          contact_phone_number: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          equipment_details: Json | null
          force_images: Json | null
          id: number
          location_coordinates: unknown | null
          name: string
          personnel_details: Json | null
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          social_rescue_force_category_id: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_text?: string | null
          code?: string | null
          contact_person_name?: string | null
          contact_phone_number?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          equipment_details?: Json | null
          force_images?: Json | null
          id?: never
          location_coordinates?: unknown | null
          name: string
          personnel_details?: Json | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          social_rescue_force_category_id?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_text?: string | null
          code?: string | null
          contact_person_name?: string | null
          contact_phone_number?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          equipment_details?: Json | null
          force_images?: Json | null
          id?: never
          location_coordinates?: unknown | null
          name?: string
          personnel_details?: Json | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          social_rescue_force_category_id?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_social_rescue_force_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_social_rescue_force_social_rescue_force_category_id_fkey"
            columns: ["social_rescue_force_category_id"]
            isOneToOne: false
            referencedRelation: "typ_social_rescue_force_category"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_tag: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          creation_method: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          tag_category_id: string
          tag_rule_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          creation_method?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          tag_category_id: string
          tag_rule_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          creation_method?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          tag_category_id?: string
          tag_rule_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_tag_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_tag_tag_category_id_fkey"
            columns: ["tag_category_id"]
            isOneToOne: false
            referencedRelation: "typ_tag_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_tag_tag_rule_id_fkey"
            columns: ["tag_rule_id"]
            isOneToOne: false
            referencedRelation: "ent_tag_rule"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_tag_rule: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          rule_details: Json
          rule_type: string
          rule_version: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          rule_details: Json
          rule_type: string
          rule_version?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          rule_details?: Json
          rule_type?: string
          rule_version?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_tag_rule_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_tagging_task: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          feature_data_rule_id: string | null
          id: string
          name: string
          profile_group_id: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          target_tag_category_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          feature_data_rule_id?: string | null
          id?: string
          name: string
          profile_group_id: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          target_tag_category_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          feature_data_rule_id?: string | null
          id?: string
          name?: string
          profile_group_id?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          target_tag_category_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_tagging_task_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_tagging_task_feature_data_rule_id_fkey"
            columns: ["feature_data_rule_id"]
            isOneToOne: false
            referencedRelation: "ent_feature_data_rule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_tagging_task_profile_group_id_fkey"
            columns: ["profile_group_id"]
            isOneToOne: false
            referencedRelation: "ent_profile_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_tagging_task_target_tag_category_id_fkey"
            columns: ["target_tag_category_id"]
            isOneToOne: false
            referencedRelation: "typ_tag_category"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_user_group: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          name: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_user_group_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_user_profile: {
        Row: {
          archive_id: string
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          name: string
          profile_group_id: string | null
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archive_id: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name: string
          profile_group_id?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archive_id?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string
          profile_group_id?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ent_user_profile_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "ent_archive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_user_profile_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ent_user_profile_profile_group_id_fkey"
            columns: ["profile_group_id"]
            isOneToOne: false
            referencedRelation: "ent_profile_group"
            referencedColumns: ["id"]
          },
        ]
      }
      ent_vehicle: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string
          id: string
          name: string
          repr: string | null
          updated_at: string
          updated_by: string | null
          vehicle_brand: string
          vehicle_color: string
          vehicle_license_plate: string
          vehicle_model: string
          vehicle_owner_id: string
          vehicle_type: string
          vehicle_year: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id: string
          id?: string
          name: string
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_brand: string
          vehicle_color: string
          vehicle_license_plate: string
          vehicle_model: string
          vehicle_owner_id: string
          vehicle_type: string
          vehicle_year: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string
          id?: string
          name?: string
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_brand?: string
          vehicle_color?: string
          vehicle_license_plate?: string
          vehicle_model?: string
          vehicle_owner_id?: string
          vehicle_type?: string
          vehicle_year?: string
        }
        Relationships: [
          {
            foreignKeyName: "ent_vehicle_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      evt_collection_activity: {
        Row: {
          activity_time: string
          archive_id: string | null
          collection_scheme_id: string | null
          content: Json | null
          created_at: string
          created_by: string | null
          enterprise_id: string | null
          event_type: string
          id: string
          name: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          activity_time?: string
          archive_id?: string | null
          collection_scheme_id?: string | null
          content?: Json | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          event_type: string
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          activity_time?: string
          archive_id?: string | null
          collection_scheme_id?: string | null
          content?: Json | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          event_type?: string
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evt_collection_activity_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "ent_archive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evt_collection_activity_collection_scheme_id_fkey"
            columns: ["collection_scheme_id"]
            isOneToOne: false
            referencedRelation: "ent_collection_scheme"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evt_collection_activity_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      evt_device_metrics: {
        Row: {
          created_at: string
          created_by: string | null
          device_id: string
          device_metric_params_id: string
          geom: unknown | null
          time: string
          updated_at: string
          updated_by: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_id: string
          device_metric_params_id: string
          geom?: unknown | null
          time: string
          updated_at?: string
          updated_by?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_id?: string
          device_metric_params_id?: string
          geom?: unknown | null
          time?: string
          updated_at?: string
          updated_by?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evt_device_metrics_device_metric_params_id_fkey"
            columns: ["device_metric_params_id"]
            isOneToOne: false
            referencedRelation: "ent_device_metric_params"
            referencedColumns: ["id"]
          },
        ]
      }
      evt_hazard: {
        Row: {
          content: Json | null
          created_at: string
          created_by: string | null
          enterprise_id: string | null
          event_time: string
          event_type: string
          hazard_id: string
          id: number
          name: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          event_time?: string
          event_type: string
          hazard_id: string
          id?: never
          name: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          event_time?: string
          event_type?: string
          hazard_id?: string
          id?: never
          name?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evt_hazard_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      evt_point_environment_metric: {
        Row: {
          content: Json | null
          created_at: string
          created_by: string | null
          device_id: string
          device_metric_params_id: string
          geom: unknown | null
          id: string
          name: string
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string
          created_by?: string | null
          device_id: string
          device_metric_params_id: string
          geom?: unknown | null
          id?: string
          name: string
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string
          created_by?: string | null
          device_id?: string
          device_metric_params_id?: string
          geom?: unknown | null
          id?: string
          name?: string
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evt_point_environment_metric_device_metric_params_id_fkey"
            columns: ["device_metric_params_id"]
            isOneToOne: false
            referencedRelation: "ent_device_metric_params"
            referencedColumns: ["id"]
          },
        ]
      }
      evt_profile_change: {
        Row: {
          archive_id: string
          change_time: string
          content: Json | null
          created_at: string
          created_by: string | null
          enterprise_id: string | null
          event_type: string
          id: string
          name: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          archive_id: string
          change_time?: string
          content?: Json | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          event_type: string
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          archive_id?: string
          change_time?: string
          content?: Json | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          event_type?: string
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evt_profile_change_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "ent_archive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evt_profile_change_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      evt_tag_rule_change: {
        Row: {
          change_time: string
          content: Json | null
          created_at: string
          created_by: string | null
          enterprise_id: string | null
          event_type: string
          id: string
          name: string
          tag_rule_id: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          change_time?: string
          content?: Json | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          event_type: string
          id?: string
          name: string
          tag_rule_id: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          change_time?: string
          content?: Json | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          event_type?: string
          id?: string
          name?: string
          tag_rule_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evt_tag_rule_change_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evt_tag_rule_change_tag_rule_id_fkey"
            columns: ["tag_rule_id"]
            isOneToOne: false
            referencedRelation: "ent_tag_rule"
            referencedColumns: ["id"]
          },
        ]
      }
      evt_tagging_activity: {
        Row: {
          activity_time: string
          content: Json | null
          created_at: string
          created_by: string | null
          enterprise_id: string | null
          event_type: string
          id: string
          name: string
          tagging_task_id: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          activity_time?: string
          content?: Json | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          event_type: string
          id?: string
          name: string
          tagging_task_id: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          activity_time?: string
          content?: Json | null
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          event_type?: string
          id?: string
          name?: string
          tagging_task_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evt_tagging_activity_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evt_tagging_activity_tagging_task_id_fkey"
            columns: ["tagging_task_id"]
            isOneToOne: false
            referencedRelation: "ent_tagging_task"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_area_space: {
        Row: {
          area_id: string
          created_at: string
          created_by: string | null
          sort_order: number
          space_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_id: string
          created_at?: string
          created_by?: string | null
          sort_order?: number
          space_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_id?: string
          created_at?: string
          created_by?: string | null
          sort_order?: number
          space_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_area_space_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "ent_area"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_building_profile_device: {
        Row: {
          base_device_id: string
          building_profile_id: number
          created_at: string
          created_by: string | null
          enterprise_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_device_id: string
          building_profile_id: number
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_device_id?: string
          building_profile_id?: number
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_building_profile_device_building_profile_id_fkey"
            columns: ["building_profile_id"]
            isOneToOne: false
            referencedRelation: "ent_park_building_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_building_profile_device_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_circuit_line_device: {
        Row: {
          base_device_id: string
          circuit_line_id: number
          created_at: string
          created_by: string | null
          enterprise_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_device_id: string
          circuit_line_id: number
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_device_id?: string
          circuit_line_id?: number
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_circuit_line_device_circuit_line_id_fkey"
            columns: ["circuit_line_id"]
            isOneToOne: false
            referencedRelation: "ent_circuit_line"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_circuit_line_device_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_danger_source_space: {
        Row: {
          created_at: string
          created_by: string | null
          danger_source_id: string
          sort_order: number
          space_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          danger_source_id: string
          sort_order?: number
          space_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          danger_source_id?: string
          sort_order?: number
          space_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_danger_source_space_danger_source_id_fkey"
            columns: ["danger_source_id"]
            isOneToOne: false
            referencedRelation: "ent_danger_source"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_department_user: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          ent_user_id: string
          enterprise_id: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          ent_user_id: string
          enterprise_id?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          ent_user_id?: string
          enterprise_id?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_department_user_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "ent_department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_department_user_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_device_group_device: {
        Row: {
          created_at: string
          created_by: string | null
          device_group_id: string
          device_id: string
          enterprise_id: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_group_id: string
          device_id: string
          enterprise_id?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_group_id?: string
          device_id?: string
          enterprise_id?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_device_group_device_device_group_id_fkey"
            columns: ["device_group_id"]
            isOneToOne: false
            referencedRelation: "ent_device_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_device_group_device_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_device_type_device_metric_params: {
        Row: {
          created_at: string
          created_by: string | null
          device_metric_params_id: string
          device_type_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_metric_params_id: string
          device_type_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_metric_params_id?: string
          device_type_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_device_type_device_metric_para_device_metric_params_id_fkey"
            columns: ["device_metric_params_id"]
            isOneToOne: false
            referencedRelation: "ent_device_metric_params"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_device_type_device_metric_params_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "typ_device_type"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_enterprise_space: {
        Row: {
          created_at: string
          created_by: string | null
          enterprise_id: string
          sort_order: number
          space_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enterprise_id: string
          sort_order?: number
          space_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enterprise_id?: string
          sort_order?: number
          space_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_enterprise_space_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_floor_profile_device: {
        Row: {
          base_device_id: string
          created_at: string
          created_by: string | null
          enterprise_id: string | null
          floor_profile_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_device_id: string
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          floor_profile_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_device_id?: string
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          floor_profile_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_floor_profile_device_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_floor_profile_device_floor_profile_id_fkey"
            columns: ["floor_profile_id"]
            isOneToOne: false
            referencedRelation: "ent_park_floor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_plan_document_device_marker: {
        Row: {
          base_device_id: string
          created_at: string
          created_by: string | null
          enterprise_id: string | null
          plan_drawing_element_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_device_id: string
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          plan_drawing_element_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_device_id?: string
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          plan_drawing_element_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_plan_document_device_marker_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_plan_document_device_marker_plan_drawing_element_id_fkey"
            columns: ["plan_drawing_element_id"]
            isOneToOne: false
            referencedRelation: "ent_plan_drawing_element"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_profile_group_member: {
        Row: {
          archive_id: string
          created_at: string
          created_by: string | null
          profile_group_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archive_id: string
          created_at?: string
          created_by?: string | null
          profile_group_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archive_id?: string
          created_at?: string
          created_by?: string | null
          profile_group_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_profile_group_member_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "ent_archive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_profile_group_member_profile_group_id_fkey"
            columns: ["profile_group_id"]
            isOneToOne: false
            referencedRelation: "ent_profile_group"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_route_device_slot: {
        Row: {
          created_at: string
          created_by: string | null
          device_slot_id: string
          enterprise_id: string | null
          route_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_slot_id: string
          enterprise_id?: string | null
          route_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_slot_id?: string
          enterprise_id?: string | null
          route_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_route_device_slot_device_slot_id_fkey"
            columns: ["device_slot_id"]
            isOneToOne: false
            referencedRelation: "ent_device_slot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_route_device_slot_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_route_point: {
        Row: {
          created_at: string
          created_by: string | null
          point_id: string
          route_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          point_id: string
          route_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          point_id?: string
          route_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_route_point_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "ent_point"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_route_space: {
        Row: {
          created_at: string
          created_by: string | null
          route_id: string
          sort_order: number
          space_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          route_id: string
          sort_order?: number
          space_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          route_id?: string
          sort_order?: number
          space_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      rel_tenant_profile_space_lease: {
        Row: {
          created_at: string
          created_by: string | null
          enterprise_id: string | null
          lease_end_date: string | null
          lease_start_date: string | null
          leased_space_id: string
          tenant_profile_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          lease_end_date?: string | null
          lease_start_date?: string | null
          leased_space_id: string
          tenant_profile_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          lease_end_date?: string | null
          lease_start_date?: string | null
          leased_space_id?: string
          tenant_profile_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_tenant_profile_space_lease_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_tenant_profile_space_lease_tenant_profile_id_fkey"
            columns: ["tenant_profile_id"]
            isOneToOne: false
            referencedRelation: "ent_park_tenant_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_user_group_user: {
        Row: {
          created_at: string
          created_by: string | null
          ent_user_id: string
          enterprise_id: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
          user_group_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ent_user_id: string
          enterprise_id?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          user_group_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ent_user_id?: string
          enterprise_id?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          user_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rel_user_group_user_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_user_group_user_user_group_id_fkey"
            columns: ["user_group_id"]
            isOneToOne: false
            referencedRelation: "ent_user_group"
            referencedColumns: ["id"]
          },
        ]
      }
      ret_feature_data: {
        Row: {
          activity_record_id: string | null
          archive_id: string
          calculation_time: string
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          feature_data_rule_id: string | null
          feature_key: string
          feature_value: Json | null
          id: string
          name: string
          order_id: string | null
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          ticket_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_record_id?: string | null
          archive_id: string
          calculation_time?: string
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          feature_data_rule_id?: string | null
          feature_key: string
          feature_value?: Json | null
          id?: string
          name: string
          order_id?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_record_id?: string | null
          archive_id?: string
          calculation_time?: string
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          feature_data_rule_id?: string | null
          feature_key?: string
          feature_value?: Json | null
          id?: string
          name?: string
          order_id?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ret_feature_data_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "ent_archive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ret_feature_data_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ret_feature_data_feature_data_rule_id_fkey"
            columns: ["feature_data_rule_id"]
            isOneToOne: false
            referencedRelation: "ent_feature_data_rule"
            referencedColumns: ["id"]
          },
        ]
      }
      ret_load_analysis_result: {
        Row: {
          activity_record_id: string | null
          analysis_config_id: string | null
          analysis_details: Json | null
          analysis_period_end: string
          analysis_period_start: string
          archive_id: string
          calculation_time: string
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          holiday_intensity: number | null
          id: string
          name: string
          order_id: string | null
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          scl_valley_peak: number | null
          scl_weekend_weekday: number | null
          suspicion_score: number | null
          ticket_id: string | null
          updated_at: string
          updated_by: string | null
          valley_peak_ratio: number | null
          weekday_intensity: number | null
          weekend_intensity: number | null
          weekend_weekday_intensity_ratio: number | null
        }
        Insert: {
          activity_record_id?: string | null
          analysis_config_id?: string | null
          analysis_details?: Json | null
          analysis_period_end: string
          analysis_period_start: string
          archive_id: string
          calculation_time?: string
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          holiday_intensity?: number | null
          id?: string
          name: string
          order_id?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          scl_valley_peak?: number | null
          scl_weekend_weekday?: number | null
          suspicion_score?: number | null
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valley_peak_ratio?: number | null
          weekday_intensity?: number | null
          weekend_intensity?: number | null
          weekend_weekday_intensity_ratio?: number | null
        }
        Update: {
          activity_record_id?: string | null
          analysis_config_id?: string | null
          analysis_details?: Json | null
          analysis_period_end?: string
          analysis_period_start?: string
          archive_id?: string
          calculation_time?: string
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          holiday_intensity?: number | null
          id?: string
          name?: string
          order_id?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          scl_valley_peak?: number | null
          scl_weekend_weekday?: number | null
          suspicion_score?: number | null
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valley_peak_ratio?: number | null
          weekday_intensity?: number | null
          weekend_intensity?: number | null
          weekend_weekday_intensity_ratio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ret_load_analysis_result_analysis_config_id_fkey"
            columns: ["analysis_config_id"]
            isOneToOne: false
            referencedRelation: "ent_analysis_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ret_load_analysis_result_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "ent_archive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ret_load_analysis_result_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ret_meter_reading: {
        Row: {
          activity_record_id: string | null
          archive_id: string
          collection_scheme_id: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          is_current_reading: boolean | null
          name: string
          order_id: string | null
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          reading_time: string
          ticket_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          activity_record_id?: string | null
          archive_id: string
          collection_scheme_id?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          is_current_reading?: boolean | null
          name: string
          order_id?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          reading_time: string
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          activity_record_id?: string | null
          archive_id?: string
          collection_scheme_id?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          is_current_reading?: boolean | null
          name?: string
          order_id?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          reading_time?: string
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ret_meter_reading_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "ent_archive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ret_meter_reading_collection_scheme_id_fkey"
            columns: ["collection_scheme_id"]
            isOneToOne: false
            referencedRelation: "ent_collection_scheme"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ret_meter_reading_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      ret_meter_reading_metric: {
        Row: {
          archive_id: string | null
          device_metric_params_id: string | null
          device_metric_value: number | null
          meter_reading_id: string | null
          reading_time: string
        }
        Insert: {
          archive_id?: string | null
          device_metric_params_id?: string | null
          device_metric_value?: number | null
          meter_reading_id?: string | null
          reading_time: string
        }
        Update: {
          archive_id?: string | null
          device_metric_params_id?: string | null
          device_metric_value?: number | null
          meter_reading_id?: string | null
          reading_time?: string
        }
        Relationships: []
      }
      ret_profile_tag_application: {
        Row: {
          activity_record_id: string | null
          application_time: string
          archive_id: string
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          name: string
          order_id: string | null
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          tag_id: string
          tag_value: string | null
          tagging_task_id: string | null
          ticket_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_record_id?: string | null
          application_time?: string
          archive_id: string
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name: string
          order_id?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          tag_id: string
          tag_value?: string | null
          tagging_task_id?: string | null
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_record_id?: string | null
          application_time?: string
          archive_id?: string
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string
          order_id?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          tag_id?: string
          tag_value?: string | null
          tagging_task_id?: string | null
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ret_profile_tag_application_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "ent_archive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ret_profile_tag_application_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ret_profile_tag_application_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "ent_tag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ret_profile_tag_application_tagging_task_id_fkey"
            columns: ["tagging_task_id"]
            isOneToOne: false
            referencedRelation: "ent_tagging_task"
            referencedColumns: ["id"]
          },
        ]
      }
      ret_tag_category_stats: {
        Row: {
          activity_record_id: string | null
          avg_value: number | null
          calculation_time: string
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          max_value: number | null
          median_value: number | null
          min_value: number | null
          name: string
          order_id: string | null
          other_stats: Json | null
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          std_dev: number | null
          tag_category_id: string
          ticket_id: string | null
          total_count: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_record_id?: string | null
          avg_value?: number | null
          calculation_time?: string
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          max_value?: number | null
          median_value?: number | null
          min_value?: number | null
          name: string
          order_id?: string | null
          other_stats?: Json | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          std_dev?: number | null
          tag_category_id: string
          ticket_id?: string | null
          total_count?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_record_id?: string | null
          avg_value?: number | null
          calculation_time?: string
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          max_value?: number | null
          median_value?: number | null
          min_value?: number | null
          name?: string
          order_id?: string | null
          other_stats?: Json | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          std_dev?: number | null
          tag_category_id?: string
          ticket_id?: string | null
          total_count?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ret_tag_category_stats_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ret_tag_category_stats_tag_category_id_fkey"
            columns: ["tag_category_id"]
            isOneToOne: false
            referencedRelation: "typ_tag_category"
            referencedColumns: ["id"]
          },
        ]
      }
      rlsp_config: {
        Row: {
          enable_creator_ownership: boolean
          enterprise_id_col: string | null
          id: string
          permission: string | null
          permission_type: Database["shared_types"]["Enums"]["permission_type"]
          schema_name: string
          table_name: string
        }
        Insert: {
          enable_creator_ownership?: boolean
          enterprise_id_col?: string | null
          id?: string
          permission?: string | null
          permission_type: Database["shared_types"]["Enums"]["permission_type"]
          schema_name: string
          table_name: string
        }
        Update: {
          enable_creator_ownership?: boolean
          enterprise_id_col?: string | null
          id?: string
          permission?: string | null
          permission_type?: Database["shared_types"]["Enums"]["permission_type"]
          schema_name?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rlsp_config_permission_fkey"
            columns: ["permission"]
            isOneToOne: false
            referencedRelation: "app_permissions"
            referencedColumns: ["permission"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          permission_id: string
          role_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          permission_id: string
          role_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          permission_id?: string
          role_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "app_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_alarm_code_category: {
        Row: {
          created_at: string
          created_by: string | null
          deactivated: boolean
          id: string
          name: string | null
          path: unknown
          path_text: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path?: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_alarm_code_level: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          id: string
          name: string | null
          path: unknown
          path_text: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path?: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_archive_type: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_archive_type_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_area_type: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          id: string
          name: string
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name: string
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name?: string
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_building_category: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          id: string
          name: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_building_function: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          enterprise_id: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_building_function_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_building_nature: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_building_structure: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          enterprise_id: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_building_structure_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_circuit_line_category: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          enterprise_id: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_circuit_line_category_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_circuit_line_status_category: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          enterprise_id: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_circuit_line_status_category_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_combustion_property: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          enterprise_id: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_combustion_property_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_device_type: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          id: string
          name: string | null
          online_device: boolean
          path: unknown
          path_text: string | null
          repr: string | null
          sort_order: number
          type_category: Database["base"]["Enums"]["device_type_category"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name?: string | null
          online_device?: boolean
          path?: unknown
          path_text?: string | null
          repr?: string | null
          sort_order?: number
          type_category?: Database["base"]["Enums"]["device_type_category"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name?: string | null
          online_device?: boolean
          path?: unknown
          path_text?: string | null
          repr?: string | null
          sort_order?: number
          type_category?: Database["base"]["Enums"]["device_type_category"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_enterprise: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          id: string
          name: string | null
          path: unknown
          path_text: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path?: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_enterprise_category: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          id: string
          name: string | null
          path: unknown
          path_text: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path?: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_environment_metric: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          id: string
          name: string | null
          path: unknown
          path_text: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path?: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_equipment_category: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          id: string
          name: string
          path: unknown
          path_text: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name: string
          path: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name?: string
          path?: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_fire_resistance_rating: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          enterprise_id: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_fire_resistance_rating_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_floor_usage_category: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          enterprise_id: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_floor_usage_category_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_hazard_category: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_hazard_category_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_key_level: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          id: string
          name: string
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name: string
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name?: string
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_maintenance_position: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          id: string
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_managed_plan_category: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          enterprise_id: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_managed_plan_category_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_metrics_category: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          id: string
          name: string | null
          path: unknown
          path_text: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path?: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_param_unit: {
        Row: {
          category: Database["base"]["Enums"]["unit_category_type"]
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          id: string
          name: string | null
          name_translation: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: Database["base"]["Enums"]["unit_category_type"]
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          name_translation?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: Database["base"]["Enums"]["unit_category_type"]
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          name_translation?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_park_area_category: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          enterprise_id: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_park_area_category_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_point: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          id: string
          name: string | null
          path: unknown
          path_text: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path?: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_risk_grade: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          id: string
          name: string
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name: string
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: string
          name?: string
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_route_purpose: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_social_rescue_force_category: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          enterprise_id: string | null
          id: number
          name: string
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          enterprise_id?: string | null
          id?: never
          name?: string
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_social_rescue_force_category_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
        ]
      }
      typ_space: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          id: string
          name: string | null
          path: unknown
          path_text: string | null
          repr: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          id?: string
          name?: string | null
          path?: unknown
          path_text?: string | null
          repr?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      typ_tag_category: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deactivated: boolean
          description: string | null
          enterprise_id: string | null
          id: string
          name: string
          parent_id: string | null
          path: unknown
          path_text: string | null
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name: string
          parent_id?: string | null
          path: unknown
          path_text?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated?: boolean
          description?: string | null
          enterprise_id?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          path?: unknown
          path_text?: string | null
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typ_tag_category_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "typ_tag_category_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "typ_tag_category"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          enterprise_id: string | null
          id: string
          role_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          id?: string
          role_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enterprise_id?: string | null
          id?: string
          role_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "ent_enterprise"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      table_schemas: {
        Row: {
          schema_json: Json | null
          table_name: unknown | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_table_info: {
        Args: { p_table: string; p_column: string }
        Returns: {
          v_schema: string
          v_table: string
        }[]
      }
      search_ltree_match: {
        Args: { p_table: string; p_column: string; p_search: string }
        Returns: unknown[]
      }
      search_ltree_prefix: {
        Args: { p_table: string; p_column: string; p_search: string }
        Returns: unknown[]
      }
    }
    Enums: {
      block_status_type: "NORMAL" | "BLOCKED"
      device_type_category: "DEVICE_TYPE" | "DOOR_TYPE" | "MAP_POINT_TYPE"
      sealing_status_type: "NORMAL" | "SEALING"
      unit_category_type:
        | "Misc"
        | "Acceleration"
        | "Angle"
        | "Area"
        | "Computation"
        | "Concentration"
        | "Currency"
        | "Data"
        | "Data rate"
        | "Date & time"
        | "Energy"
        | "Flow"
        | "Force"
        | "Hash rate"
        | "Mass"
        | "Length"
        | "Pressure"
        | "Radiation"
        | "Rotational Speed"
        | "Temperature"
        | "Time"
        | "Throughput"
        | "Velocity"
        | "Volume"
        | "Boolean"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
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
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr: string | null
          subject_template: string | null
          template_key: string | null
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
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          subject_template?: string | null
          template_key?: string | null
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
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          subject_template?: string | null
          template_key?: string | null
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
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
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
          publish_status?: "NONE" | "DRAFT" | "DISCARD" | "PUBLISH" | "DELETED"
          repr?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      table_schemas: {
        Row: {
          schema_json: Json | null
          table_name: unknown | null
        }
        Relationships: []
      }
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
      gender_type: "MALE" | "FEMALE" | "OTHER"
      notification_channel_type: "IN_APP" | "EMAIL" | "SMS" | "CHAT" | "PUSH"
      notification_status:
        | "PENDING"
        | "PROCESSING"
        | "SENT"
        | "FAILED"
        | "RETRACTED"
      notification_workflow_type: "STATIC" | "DYNAMIC"
      order_status: "OPEN" | "COMPLETED" | "FAILED" | "CANCELED"
      permission_type: "SELECT" | "INSERT" | "UPDATE" | "DELETE"
      publish_status:
        | "NONE"
        | "DRAFT"
        | "DISCARD"
        | "PUBLISH"
        | "DELETED"
        | "REVIEW"
      role_type: "SYSTEM" | "ENTERPRISE" | "ENTERPRISE_CUSTOM"
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
  base: {
    Enums: {
      block_status_type: ["NORMAL", "BLOCKED"],
      device_type_category: ["DEVICE_TYPE", "DOOR_TYPE", "MAP_POINT_TYPE"],
      sealing_status_type: ["NORMAL", "SEALING"],
      unit_category_type: [
        "Misc",
        "Acceleration",
        "Angle",
        "Area",
        "Computation",
        "Concentration",
        "Currency",
        "Data",
        "Data rate",
        "Date & time",
        "Energy",
        "Flow",
        "Force",
        "Hash rate",
        "Mass",
        "Length",
        "Pressure",
        "Radiation",
        "Rotational Speed",
        "Temperature",
        "Time",
        "Throughput",
        "Velocity",
        "Volume",
        "Boolean",
      ],
    },
  },
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
      gender_type: ["MALE", "FEMALE", "OTHER"],
      notification_channel_type: ["IN_APP", "EMAIL", "SMS", "CHAT", "PUSH"],
      notification_status: [
        "PENDING",
        "PROCESSING",
        "SENT",
        "FAILED",
        "RETRACTED",
      ],
      notification_workflow_type: ["STATIC", "DYNAMIC"],
      order_status: ["OPEN", "COMPLETED", "FAILED", "CANCELED"],
      permission_type: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      publish_status: [
        "NONE",
        "DRAFT",
        "DISCARD",
        "PUBLISH",
        "DELETED",
        "REVIEW",
      ],
      role_type: ["SYSTEM", "ENTERPRISE", "ENTERPRISE_CUSTOM"],
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
