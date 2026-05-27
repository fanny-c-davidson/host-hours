/**
 * Auto-generated Supabase database types.
 *
 * This file is a typed stub based on the migration schema.
 * Replace it with the real generated output before deploying:
 *
 *   npx supabase gen types typescript --project-id <your-project-id> > types/database.ts
 *
 * Or with the local CLI (after `supabase start`):
 *
 *   npx supabase gen types typescript --local > types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          updated_at?: string;
        };
      };
      subscription_tiers: {
        Row: {
          id: string;
          display_name: string;
          max_properties: number | null;
          has_live_timer: boolean;
          has_csv_export: boolean;
          has_geo_autostart: boolean;
          has_team_members: boolean;
          monthly_price_cents: number;
          yearly_price_cents: number;
          stripe_monthly_price_id: string | null;
          stripe_yearly_price_id: string | null;
          is_active: boolean;
          sort_order: number;
        };
        Insert: {
          id: string;
          display_name: string;
          max_properties?: number | null;
          has_live_timer?: boolean;
          has_csv_export?: boolean;
          has_geo_autostart?: boolean;
          has_team_members?: boolean;
          monthly_price_cents: number;
          yearly_price_cents: number;
          stripe_monthly_price_id?: string | null;
          stripe_yearly_price_id?: string | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          display_name?: string;
          max_properties?: number | null;
          has_live_timer?: boolean;
          has_csv_export?: boolean;
          has_geo_autostart?: boolean;
          has_team_members?: boolean;
          monthly_price_cents?: number;
          yearly_price_cents?: number;
          stripe_monthly_price_id?: string | null;
          stripe_yearly_price_id?: string | null;
          is_active?: boolean;
          sort_order?: number;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          status: Database['public']['Enums']['subscription_status'] | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          trial_end: string | null;
          canceled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          status?: Database['public']['Enums']['subscription_status'] | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          trial_end?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tier_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          status?: Database['public']['Enums']['subscription_status'] | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          trial_end?: string | null;
          canceled_at?: string | null;
          updated_at?: string;
        };
      };
      properties: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          address: string | null;
          description: string | null;
          color: string;
          latitude: number | null;
          longitude: number | null;
          geo_radius_meters: number;
          is_archived: boolean;
          archived_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          address?: string | null;
          description?: string | null;
          color?: string;
          latitude?: number | null;
          longitude?: number | null;
          geo_radius_meters?: number;
          is_archived?: boolean;
          archived_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          address?: string | null;
          description?: string | null;
          color?: string;
          latitude?: number | null;
          longitude?: number | null;
          geo_radius_meters?: number;
          is_archived?: boolean;
          archived_at?: string | null;
          deleted_at?: string | null;
          updated_at?: string;
        };
      };
      time_logs: {
        Row: {
          id: string;
          user_id: string;
          property_id: string;
          title: string;
          description: string | null;
          category: Database['public']['Enums']['time_log_category'];
          started_at: string;
          ended_at: string;
          duration_secs: number;
          is_billable: boolean;
          source: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          property_id: string;
          title: string;
          description?: string | null;
          category?: Database['public']['Enums']['time_log_category'];
          started_at: string;
          ended_at: string;
          // duration_secs is GENERATED ALWAYS AS — never pass this in Insert
          is_billable?: boolean;
          source?: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          category?: Database['public']['Enums']['time_log_category'];
          started_at?: string;
          ended_at?: string;
          is_billable?: boolean;
          deleted_at?: string | null;
          updated_at?: string;
        };
      };
      active_timers: {
        Row: {
          id: string;
          user_id: string;
          property_id: string;
          title: string;
          description: string | null;
          category: Database['public']['Enums']['time_log_category'];
          is_billable: boolean;
          started_at: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          property_id: string;
          title: string;
          description?: string | null;
          category?: Database['public']['Enums']['time_log_category'];
          is_billable?: boolean;
          started_at?: string;
          source?: string;
          created_at?: string;
        };
        Update: never; // active_timers rows are only created or deleted
      };
      team_members: {
        Row: {
          id: string;
          owner_id: string;
          member_id: string | null;
          email: string;
          role: Database['public']['Enums']['team_role'];
          status: Database['public']['Enums']['team_member_status'];
          invited_at: string;
          joined_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          member_id?: string | null;
          email: string;
          role: Database['public']['Enums']['team_role'];
          status?: Database['public']['Enums']['team_member_status'];
          invited_at?: string;
          joined_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          member_id?: string | null;
          role?: Database['public']['Enums']['team_role'];
          status?: Database['public']['Enums']['team_member_status'];
          joined_at?: string | null;
          updated_at?: string;
        };
      };
      property_assignments: {
        Row: {
          id: string;
          team_member_id: string;
          property_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_member_id: string;
          property_id: string;
          created_at?: string;
        };
        Update: never;
      };
      invitations: {
        Row: {
          id: string;
          team_member_id: string;
          token: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_member_id: string;
          token?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          used_at?: string | null;
        };
      };
      webhook_events: {
        Row: {
          id: string;
          stripe_event_id: string;
          event_type: string;
          payload: Json;
          status: string;
          processed_at: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          stripe_event_id: string;
          event_type: string;
          payload: Json;
          status?: string;
          processed_at?: string | null;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          status?: string;
          processed_at?: string | null;
          error?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      stop_timer: {
        Args: { p_timer_id: string; p_user_id: string };
        Returns: Database['public']['Tables']['time_logs']['Row'];
      };
    };
    Enums: {
      subscription_status:
        | 'trialing'
        | 'active'
        | 'incomplete'
        | 'incomplete_expired'
        | 'past_due'
        | 'canceled'
        | 'unpaid'
        | 'paused';
      time_log_category:
        | 'cleaning'
        | 'maintenance'
        | 'guest_communication'
        | 'admin'
        | 'inspection'
        | 'staging'
        | 'other';
      team_role: 'manager' | 'employee';
      team_member_status: 'pending' | 'active' | 'suspended';
    };
  };
};
