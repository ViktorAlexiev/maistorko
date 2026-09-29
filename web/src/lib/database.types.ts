
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "availability_exceptions": {
                  Row: {
                    "craftsman_id": string,"created_at": string,"end_date": string,"end_time": string | null,"id": string,"kind": Database["public"]['Enums']["exception_kind"],"note": string | null,"start_date": string,"start_time": string | null
                  }
                  Insert: {
                    "craftsman_id": string,"created_at"?: string,"end_date": string,"end_time"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["exception_kind"],"note"?: string | null,"start_date": string,"start_time"?: string | null
                  }
                  Update: {
                    "craftsman_id"?: string,"created_at"?: string,"end_date"?: string,"end_time"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["exception_kind"],"note"?: string | null,"start_date"?: string,"start_time"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_exceptions_craftsman_id_fkey"
      columns: ["craftsman_id"]
isOneToOne: false
      referencedRelation: "craftsman_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"availability_rules": {
                  Row: {
                    "craftsman_id": string,"end_time": string,"id": string,"start_time": string,"weekday": number
                  }
                  Insert: {
                    "craftsman_id": string,"end_time": string,"id"?: string,"start_time": string,"weekday": number
                  }
                  Update: {
                    "craftsman_id"?: string,"end_time"?: string,"id"?: string,"start_time"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_rules_craftsman_id_fkey"
      columns: ["craftsman_id"]
isOneToOne: false
      referencedRelation: "craftsman_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "booking_date": string,"client_id": string,"conversation_id": string,"craftsman_id": string,"created_at": string,"end_time": string | null,"id": string,"kind": string,"note": string | null,"proposed_by": string,"responded_by": string | null,"start_time": string | null,"status": string,"updated_at": string,"booking_label": string | null,"booking_overlaps": boolean | null
                  }
                  Insert: {
                    "booking_date": string,"client_id": string,"conversation_id": string,"craftsman_id": string,"created_at"?: string,"end_time"?: string | null,"id"?: string,"kind": string,"note"?: string | null,"proposed_by": string,"responded_by"?: string | null,"start_time"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "booking_date"?: string,"client_id"?: string,"conversation_id"?: string,"craftsman_id"?: string,"created_at"?: string,"end_time"?: string | null,"id"?: string,"kind"?: string,"note"?: string | null,"proposed_by"?: string,"responded_by"?: string | null,"start_time"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_craftsman_id_fkey"
      columns: ["craftsman_id"]
isOneToOne: false
      referencedRelation: "craftsman_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_responded_by_fkey"
      columns: ["responded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string | null,"icon": string | null,"id": number,"is_active": boolean,"keywords": (string)[],"name": string,"parent_id": number | null,"slug": string,"sort": number
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"icon"?: string | null,"id"?: never,"is_active"?: boolean,"keywords"?: (string)[],"name": string,"parent_id"?: number | null,"slug": string,"sort"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"icon"?: string | null,"id"?: never,"is_active"?: boolean,"keywords"?: (string)[],"name"?: string,"parent_id"?: number | null,"slug"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"cities": {
                  Row: {
                    "id": number,"is_major": boolean,"name": string,"region": string,"slug": string,"sort": number
                  }
                  Insert: {
                    "id"?: never,"is_major"?: boolean,"name": string,"region": string,"slug": string,"sort"?: number
                  }
                  Update: {
                    "id"?: never,"is_major"?: boolean,"name"?: string,"region"?: string,"slug"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"conversations": {
                  Row: {
                    "category_id": number | null,"client_id": string,"client_last_read_at": string,"craftsman_id": string,"craftsman_last_read_at": string,"created_at": string,"id": string,"last_message_at": string,"last_message_preview": string,"last_sender_id": string | null,"requested_date": string | null
                  }
                  Insert: {
                    "category_id"?: number | null,"client_id": string,"client_last_read_at"?: string,"craftsman_id": string,"craftsman_last_read_at"?: string,"created_at"?: string,"id"?: string,"last_message_at"?: string,"last_message_preview"?: string,"last_sender_id"?: string | null,"requested_date"?: string | null
                  }
                  Update: {
                    "category_id"?: number | null,"client_id"?: string,"client_last_read_at"?: string,"craftsman_id"?: string,"craftsman_last_read_at"?: string,"created_at"?: string,"id"?: string,"last_message_at"?: string,"last_message_preview"?: string,"last_sender_id"?: string | null,"requested_date"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_craftsman_id_fkey"
      columns: ["craftsman_id"]
isOneToOne: false
      referencedRelation: "craftsman_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"craftsman_categories": {
                  Row: {
                    "category_id": number,"craftsman_id": string
                  }
                  Insert: {
                    "category_id": number,"craftsman_id": string
                  }
                  Update: {
                    "category_id"?: number,"craftsman_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "craftsman_categories_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "craftsman_categories_craftsman_id_fkey"
      columns: ["craftsman_id"]
isOneToOne: false
      referencedRelation: "craftsman_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"craftsman_profiles": {
                  Row: {
                    "avatar_url": string | null,"bio": string,"business_name": string | null,"callout_fee": number | null,"city_id": number | null,"contact_hours": string | null,"created_at": string,"display_name": string,"hourly_rate": number | null,"id": string,"inspection_fee": number | null,"inspection_policy": string | null,"is_hidden": boolean,"is_verified": boolean,"languages": (string)[],"last_confirmed_at": string,"materials_included": boolean,"other_services": string | null,"phone_visibility": string,"price_from": number | null,"price_from_unit": Database["public"]['Enums']["price_unit"] | null,"quote_on_inspection": boolean,"rating_avg": number,"rating_count": number,"search_text": string,"search_vector": unknown,"short_notice": boolean,"slug": string,"terms_note": string | null,"travel_fee": number | null,"updated_at": string,"years_experience": number | null
                  }
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string,"business_name"?: string | null,"callout_fee"?: number | null,"city_id"?: number | null,"contact_hours"?: string | null,"created_at"?: string,"display_name": string,"hourly_rate"?: number | null,"id": string,"inspection_fee"?: number | null,"inspection_policy"?: string | null,"is_hidden"?: boolean,"is_verified"?: boolean,"languages"?: (string)[],"last_confirmed_at"?: string,"materials_included"?: boolean,"other_services"?: string | null,"phone_visibility"?: string,"price_from"?: number | null,"price_from_unit"?: Database["public"]['Enums']["price_unit"] | null,"quote_on_inspection"?: boolean,"rating_avg"?: number,"rating_count"?: number,"search_text"?: string,"search_vector"?: unknown,"short_notice"?: boolean,"slug": string,"terms_note"?: string | null,"travel_fee"?: number | null,"updated_at"?: string,"years_experience"?: number | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string,"business_name"?: string | null,"callout_fee"?: number | null,"city_id"?: number | null,"contact_hours"?: string | null,"created_at"?: string,"display_name"?: string,"hourly_rate"?: number | null,"id"?: string,"inspection_fee"?: number | null,"inspection_policy"?: string | null,"is_hidden"?: boolean,"is_verified"?: boolean,"languages"?: (string)[],"last_confirmed_at"?: string,"materials_included"?: boolean,"other_services"?: string | null,"phone_visibility"?: string,"price_from"?: number | null,"price_from_unit"?: Database["public"]['Enums']["price_unit"] | null,"quote_on_inspection"?: boolean,"rating_avg"?: number,"rating_count"?: number,"search_text"?: string,"search_vector"?: unknown,"short_notice"?: boolean,"slug"?: string,"terms_note"?: string | null,"travel_fee"?: number | null,"updated_at"?: string,"years_experience"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "craftsman_profiles_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "craftsman_profiles_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"craftsman_service_areas": {
                  Row: {
                    "city_id": number,"craftsman_id": string
                  }
                  Insert: {
                    "city_id": number,"craftsman_id": string
                  }
                  Update: {
                    "city_id"?: number,"craftsman_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "craftsman_service_areas_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "craftsman_service_areas_craftsman_id_fkey"
      columns: ["craftsman_id"]
isOneToOne: false
      referencedRelation: "craftsman_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"conversation_id": string,"created_at": string,"id": number,"meta": NonNullable<Json>,"sender_id": string
                  }
                  Insert: {
                    "body": string,"conversation_id": string,"created_at"?: string,"id"?: never,"meta"?: NonNullable<Json>,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: never,"meta"?: NonNullable<Json>,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"city_id": number | null,"created_at": string,"full_name": string,"id": string,"is_banned": boolean,"phone": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"city_id"?: number | null,"created_at"?: string,"full_name"?: string,"id": string,"is_banned"?: boolean,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"city_id"?: number | null,"created_at"?: string,"full_name"?: string,"id"?: string,"is_banned"?: boolean,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "body": string,"client_id": string,"craftsman_id": string,"created_at": string,"id": string,"is_hidden": boolean,"rating": number,"updated_at": string
                  }
                  Insert: {
                    "body"?: string,"client_id": string,"craftsman_id": string,"created_at"?: string,"id"?: string,"is_hidden"?: boolean,"rating": number,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"client_id"?: string,"craftsman_id"?: string,"created_at"?: string,"id"?: string,"is_hidden"?: boolean,"rating"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_craftsman_id_fkey"
      columns: ["craftsman_id"]
isOneToOne: false
      referencedRelation: "craftsman_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_craftsmen": {
                  Row: {
                    "client_id": string,"craftsman_id": string,"created_at": string
                  }
                  Insert: {
                    "client_id": string,"craftsman_id": string,"created_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"craftsman_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_craftsmen_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_craftsmen_craftsman_id_fkey"
      columns: ["craftsman_id"]
isOneToOne: false
      referencedRelation: "craftsman_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"search_synonyms": {
                  Row: {
                    "expands_to": string,"term": string
                  }
                  Insert: {
                    "expands_to": string,"term": string
                  }
                  Update: {
                    "expands_to"?: string,"term"?: string
                  }
                  Relationships: [
                    
                  ]
                },"services": {
                  Row: {
                    "category_id": number | null,"craftsman_id": string,"created_at": string,"description": string | null,"id": string,"name": string,"price": number | null,"price_kind": Database["public"]['Enums']["price_kind"],"sort": number,"unit": Database["public"]['Enums']["price_unit"]
                  }
                  Insert: {
                    "category_id"?: number | null,"craftsman_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"price"?: number | null,"price_kind"?: Database["public"]['Enums']["price_kind"],"sort"?: number,"unit"?: Database["public"]['Enums']["price_unit"]
                  }
                  Update: {
                    "category_id"?: number | null,"craftsman_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"price"?: number | null,"price_kind"?: Database["public"]['Enums']["price_kind"],"sort"?: number,"unit"?: Database["public"]['Enums']["price_unit"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "services_craftsman_id_fkey"
      columns: ["craftsman_id"]
isOneToOne: false
      referencedRelation: "craftsman_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"work_photos": {
                  Row: {
                    "caption": string | null,"craftsman_id": string,"created_at": string,"id": string,"path": string,"sort": number
                  }
                  Insert: {
                    "caption"?: string | null,"craftsman_id": string,"created_at"?: string,"id"?: string,"path": string,"sort"?: number
                  }
                  Update: {
                    "caption"?: string | null,"craftsman_id"?: string,"created_at"?: string,"id"?: string,"path"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_photos_craftsman_id_fkey"
      columns: ["craftsman_id"]
isOneToOne: false
      referencedRelation: "craftsman_profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_list_users":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_q"?: string,"p_role"?: Database["public"]['Enums']["user_role"] }; Returns: {
              "craftsman_slug": string,"created_at": string,"email": string,"full_name": string,"id": string,"is_banned": boolean,"is_hidden": boolean,"is_verified": boolean,"role": Database["public"]['Enums']["user_role"],"total_count": number
            }[]
                           },
"availability_days":
{ Args: { "p_craftsman": string,"p_days": number,"p_from": string }; Returns: {
              "day": string,"free_hours": number,"ranges": Json,"status": string
            }[]
                           },
"availability_strip":
{ Args: { "p_craftsman": string,"p_days"?: number,"p_from": string }; Returns: string
                           },
"become_craftsman":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"bg_translit":
{ Args: { "input": string }; Returns: string
                           },
"booking_label":
{ Args: { "b": Database["public"]['Tables']["bookings"]['Row'] }; Returns: string
                           },
"booking_overlaps":
{ Args: { "b": Database["public"]['Tables']["bookings"]['Row'] }; Returns: boolean
                           },
"build_search_query":
{ Args: { "p_any"?: boolean,"p_q": string }; Returns: unknown
                           },
"calendar_freshness":
{ Args: { "p_confirmed": string }; Returns: string
                           },
"can_review":
{ Args: { "p_craftsman": string }; Returns: boolean
                           },
"category_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "craftsmen": number,"slug": string
            }[]
                           },
"category_price_guide":
{ Args: { "p_category": number }; Returns: {
              "hourly_count": number,"hourly_median": number,"hourly_p25": number,"hourly_p75": number,"job_count": number,"job_median": number,"job_p25": number,"job_p75": number
            }[]
                           },
"confirm_calendar":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"conversation_partner_phone":
{ Args: { "p_conversation": string }; Returns: string
                           },
"craftsman_contact_info":
{ Args: { "p_craftsman": string }; Returns: {
              "has_phone": boolean,"visibility": string
            }[]
                           },
"craftsman_is_listed":
{ Args: { "p_id": string }; Returns: boolean
                           },
"craftsman_is_public":
{ Args: { "p_id": string }; Returns: boolean
                           },
"craftsman_phone":
{ Args: { "p_craftsman": string }; Returns: string
                           },
"craftsman_reviews":
{ Args: { "p_craftsman": string,"p_limit"?: number }; Returns: {
              "author": string,"body": string,"created_at": string,"id": string,"is_mine": boolean,"rating": number
            }[]
                           },
"day_free_ranges":
{ Args: { "p_craftsman": string,"p_day": string }; Returns: unknown
                           },
"day_status":
{ Args: { "ranges": unknown }; Returns: string
                           },
"free_hours":
{ Args: { "ranges": unknown }; Returns: number
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_api_request":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_banned":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_conversation_read":
{ Args: { "p_conversation": string }; Returns: undefined
                           },
"my_bookings":
{ Args: { "p_from"?: string }; Returns: {
              "booking_date": string,"conversation_id": string,"end_time": string,"i_am": string,"id": string,"kind": string,"note": string,"partner_name": string,"partner_slug": string,"proposed_by_me": boolean,"start_time": string,"status": string
            }[]
                           },
"my_conversations":
{ Args: Record<PropertyKey, never>; Returns: {
              "category_name": string,"i_am": string,"id": string,"last_from_me": boolean,"last_message_at": string,"last_message_preview": string,"partner_avatar": string,"partner_id": string,"partner_name": string,"partner_slug": string,"requested_date": string,"unread_count": number
            }[]
                           },
"next_free_date":
{ Args: { "p_craftsman": string,"p_from": string,"p_horizon"?: number,"p_slot"?: string }; Returns: string
                           },
"owns_craftsman":
{ Args: { "p_id": string }; Returns: boolean
                           },
"propose_booking":
{ Args: { "p_conversation": string,"p_date": string,"p_end"?: string,"p_kind"?: string,"p_note"?: string,"p_start"?: string }; Returns: string
                           },
"refresh_craftsman_price":
{ Args: { "p_id": string }; Returns: undefined
                           },
"refresh_craftsman_search":
{ Args: { "p_id": string }; Returns: undefined
                           },
"respond_booking":
{ Args: { "p_action": string,"p_booking": string }; Returns: string
                           },
"search_craftsmen":
{ Args: { "p_any"?: boolean,"p_category"?: string,"p_city"?: string,"p_date_from"?: string,"p_date_to"?: string,"p_ids"?: (string)[],"p_limit"?: number,"p_min_rating"?: number,"p_offset"?: number,"p_price_max"?: number,"p_price_min"?: number,"p_q"?: string,"p_sort"?: string,"p_time"?: string,"p_verified"?: boolean }; Returns: {
              "avatar_url": string,"business_name": string,"category_names": (string)[],"city_name": string,"city_slug": string,"created_at": string,"display_name": string,"freshness": string,"id": string,"is_verified": boolean,"matched_date": string,"next_free": string,"price_from": number,"price_from_unit": Database["public"]['Enums']["price_unit"],"quote_on_inspection": boolean,"rating_avg": number,"rating_count": number,"short_notice": boolean,"slug": string,"strip": string,"total_count": number,"years_experience": number
            }[]
                           },
"search_stem":
{ Args: { "token": string }; Returns: string
                           },
"slugify":
{ Args: { "input": string }; Returns: string
                           },
"start_conversation":
{ Args: { "p_body": string,"p_category"?: number,"p_craftsman": string,"p_date"?: string,"p_service"?: string,"p_slot"?: string }; Returns: string
                           },
"time_window":
{ Args: { "p_day": string,"p_slot": string }; Returns: unknown
                           },
"unique_craftsman_slug":
{ Args: { "base": string,"self_id"?: string }; Returns: string
                           },
"unread_total":
{ Args: Record<PropertyKey, never>; Returns: number
                           }
          }
          Enums: {
            "exception_kind": "free"|"busy","price_kind": "fixed"|"from"|"quote","price_unit": "job"|"hour"|"m2"|"piece"|"meter"|"day","user_role": "client"|"craftsman"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "exception_kind": ["free", "busy"],"price_kind": ["fixed", "from", "quote"],"price_unit": ["job", "hour", "m2", "piece", "meter", "day"],"user_role": ["client", "craftsman", "admin"]
          }
        }
} as const

