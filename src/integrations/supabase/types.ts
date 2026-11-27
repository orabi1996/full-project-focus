Warning: truncated output (original token count: 35347)
Total output lines: 4609

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      accounting_journals: {
        Row: {
          created_at: string
          erp_integration_type: string | null
          id: string
          journal_date: string
          journal_no: string
          source_reference: string
          source_type: string
          status: string
          total_credit: number
          total_debit: number
        }
        Insert: {
          created_at?: string
          erp_integration_type?: string | null
          id?: string
          journal_date?: string
          journal_no?: string
          source_reference?: string
          source_type?: string
          status?: string
          total_credit?: number
          total_debit?: number
        }
        Update: {
          created_at?: string
          erp_integration_type?: string | null
          id?: string
          journal_date?: string
          journal_no?: string
          source_reference?: string
          source_type?: string
          status?: string
          total_credit?: number
          total_debit?: number
        }
        Relationships: []
      }
      approval_chains: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name_ar: string
          name_en: string
          request_type: string
          scope_type: string
          scope_values: Json
          status: string
          steps: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name_ar: string
          name_en?: string
          request_type: string
          scope_type?: string
          scope_values?: Json
          status?: string
          steps?: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name_ar?: string
          name_en?: string
          request_type?: string
          scope_type?: string
          scope_values?: Json
          status?: string
          steps?: Json
        }
        Relationships: []
      }
      approval_steps: {
        Row: {
          acted_at: string | null
          acted_by: string | null
          approver_role: string | null
          approver_user_id: string | null
          created_at: string
          id: string
          note: string | null
          request_id: string
          status: string
          step_order: number
        }
        Insert: {
          acted_at?: string | null
          acted_by?: string | null
          approver_role?: string | null
          approver_user_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id: string
          status?: string
          step_order: number
        }
        Update: {
          acted_at?: string | null
          acted_by?: string | null
          approver_role?: string | null
          approver_user_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id?: string
          status?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_assignments: {
        Row: {
          asset_id: string | null
          assigned_at: string
          assigned_by: string | null
          condition_on_assign: string | null
          condition_on_return: string | null
          employee_id: string | null
          id: string
          returned_at: string | null
        }
        Insert: {
          asset_id?: string | null
          assigned_at?: string
          assigned_by?: string | null
          condition_on_assign?: string | null
          condition_on_return?: string | null
          employee_id?: string | null
          id?: string
          returned_at?: string | null
        }
        Update: {
          asset_id?: string | null
          assigned_at?: string
          assigned_by?: string | null
          condition_on_assign?: string | null
          condition_on_return?: string | null
          employee_id?: string | null
          id?: string
          returned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "hardware_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          employee_id: string
          id: string
          is_manual: boolean
          late_minutes: number | null
          note: string | null
          overtime_minutes: number | null
          status: Database["public"]["Enums"]["attendance_status"]
          work_date: string
          worked_hours: number
          worked_minutes: number | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          is_manual?: boolean
          late_minutes?: number | null
          note?: string | null
          overtime_minutes?: number | null
          status?: Database["public"]["Enums"]["attendance_status"]
          work_date: string
          worked_hours?: number
          worked_minutes?: number | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          is_manual?: boolean
          late_minutes?: number | null
          note?: string | null
          overtime_minutes?: number | null
          status?: Database["public"]["Enums"]["attendance_status"]
          work_date?: string
          worked_hours?: number
          worked_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          action_type: string | null
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          actor_user_id: string | null
          changes_summary: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          severity: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          action_type?: string | null
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          changes_summary?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          severity?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          action_type?: string | null
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          changes_summary?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          severity?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      biometric_devices: {
        Row: {
          auto_approve: boolean
          created_at: string
          device_id: string
          device_token: string
          id: string
          last_seen_at: string | null
          name_ar: string
          status: string
          total_punches: number
          updated_at: string
          work_location_id: string | null
        }
        Insert: {
          auto_approve?: boolean
          created_at?: string
          device_id: string
          device_token: string
          id?: string
          last_seen_at?: string | null
          name_ar: string
          status?: string
          total_punches?: number
          updated_at?: string
          work_location_id?: string | null
        }
        Update: {
          auto_approve?: boolean
          created_at?: string
          device_id?: string
          device_token?: string
          id?: string
          last_seen_at?: string | null
          name_ar?: string
          status?: string
          total_punches?: number
          updated_at?: string
          work_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biometric_devices_work_location_id_fkey"
            columns: ["work_location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_adjustments: {
        Row: {
          adjusted_at: string
          adjusted_by: string | null
          adjusted_by_name: string | null
          calibrated_rating_label: string | null
          calibrated_score: number
          calibration_reason: string | null
          employee_id: string | null
          employee_name: string | null
          id: string
          original_rating_label: string | null
          original_score: number | null
          participant_id: string | null
          session_id: string
        }
        Insert: {
          adjusted_at?: string
          adjusted_by?: string | null
          adjusted_by_name?: string | null
          calibrated_rating_label?: string | null
          calibrated_score: number
          calibration_reason?: string | null
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          original_rating_label?: string | null
          original_score?: number | null
          participant_id?: string | null
          session_id: string
        }
        Update: {
          adjusted_at?: string
          adjusted_by?: string | null
          adjusted_by_name?: string | null
          calibrated_rating_label?: string | null
          calibrated_score?: number
          calibration_reason?: string | null
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          original_rating_label?: string | null
          original_score?: number | null
          participant_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calibration_adjustments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "performance_cycle_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_adjustments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "calibration_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_sessions: {
        Row: {
          actual_distribution: Json | null
          company_id: string | null
          created_at: string
          cycle_id: string
          department_id: string | null
          department_name: string | null
          id: string
          moderator_employee_id: string | null
          moderator_name: string | null
          notes: string | null
          session_date: string | null
          status: string
          target_distribution: Json | null
          title_ar: string
          title_en: string | null
        }
        Insert: {
          actual_distribution?: Json | null
          company_id?: string | null
          created_at?: string
          cycle_id: string
          department_id?: string | null
          department_name?: string | null
          id?: string
          moderator_employee_id?: string | null
          moderator_name?: string | null
          notes?: string | null
          session_date?: string | null
          status?: string
          target_distribution?: Json | null
          title_ar: string
          title_en?: string | null
        }
        Update: {
          actual_distribution?: Json | null
          company_id?: string | null
          created_at?: string
          cycle_id?: string
          department_id?: string | null
          department_name?: string | null
          id?: string
          moderator_employee_id?: string | null
          moderator_name?: string | null
          notes?: string | null
          session_date?: string | null
          status?: string
          target_distribution?: Json | null
          title_ar?: string
          title_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calibration_sessions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_stages: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          moved_by: string | null
          note: string | null
          stage: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          moved_by?: string | null
          note?: string | null
          stage: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          moved_by?: string | null
          note?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_stages_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string
          cv_url: string | null
          email: string
          full_name: string
          full_name_ar: string | null
          id: string
          job_id: string | null
          notes_count: number
          phone: string | null
          rating: number | null
          rating_score: number | null
          source: string | null
          stage: string
        }
        Insert: {
          created_at?: string
          cv_url?: string | null
          email: string
          full_name: string
          full_name_ar?: string | null
          id?: string
          job_id?: string | null
          notes_count?: number
          phone?: string | null
          rating?: number | null
          rating_score?: number | null
          source?: string | null
          stage?: string
        }
        Update: {
          created_at?: string
          cv_url?: string | null
          email?: string
          full_name?: string
          full_name_ar?: string | null
          id?: string
          job_id?: string | null
          notes_count?: number
          phone?: string | null
          rating?: number | null
          rating_score?: number | null
          source?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_openings"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          code: string | null
          country: string | null
          cr_number: string | null
          created_at: string
          currency: string
          email: string | null
          entity_type: string | null
          fiscal_year_start_month: number | null
          gosi_number: string | null
          headquarters_address: string | null
          id: string
          industry: string | null
          labor_office_number: string | null
          legal_name: string | null
          legal_name_ar: string
          legal_name_en: string
          logo_url: string | null
          name: string | null
          phone: string | null
          postal_code: string | null
          setup_status: string | null
          subsidiary_id: string | null
          tax_number: string | null
          timezone: string
          unified_number: string | null
          website: string | null
        }
        Insert: {
          city?: string | null
          code?: string | null
          country?: string | null
          cr_number?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          entity_type?: string | null
          fiscal_year_start_month?: number | null
          gosi_number?: string | null
          headquarters_address?: string | null
          id?: string
          industry?: string | null
          labor_office_number?: string | null
          legal_name?: string | null
          legal_name_ar: string
          legal_name_en: string
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          postal_code?: string | null
          setup_status?: string | null
          subsidiary_id?: string | null
          tax_number?: string | null
          timezone?: string
          unified_number?: string | null
          website?: string | null
        }
        Update: {
          city?: string | null
          code?: string | null
          country?: string | null
          cr_number?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          entity_type?: string | null
          fiscal_year_start_month?: number | null
          gosi_number?: string | null
          headquarters_address?: string | null
          id?: string
          industry?: string | null
          labor_office_number?: string | null
          legal_name?: string | null
          legal_name_ar?: string
          legal_name_en?: string
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          postal_code?: string | null
          setup_status?: string | null
          subsidiary_id?: string | null
          tax_number?: string | null
          timezone?: string
          unified_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_subsidiary_id_fkey"
            columns: ["subsidiary_id"]
            isOneToOne: false
            referencedRelation: "subsidiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      company_bank_accounts: {
        Row: {
          account_name: string
          bank_name: string
          created_at: string
          currency: string
          current_balance: number
          iban: string
          id: string
          is_primary: boolean
          updated_at: string
        }
        Insert: {
          account_name: string
          bank_name: string
          created_at?: string
          currency?: string
          current_balance?: number
          iban: string
          id?: string
          is_primary?: boolean
          updated_at?: string
        }
        Update: {
          account_name?: string
          bank_name?: string
          created_at?: string
          currency?: string
          current_balance?: number
          iban?: string
          id?: string
          is_primary?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          acknowledged_count: number
          body_ar: string | null
          category: string
          created_at: string
          department_id: string | null
          expiry_date: string | null
          file_id: string | null
          file_url: string
          id: string
          requires_ack: boolean | null
          requires_acknowledgment: boolean
          status: string
          subsidiary_id: string | null
          title: string | null
          title_ar: string
          title_en: string
          version: string
          visibility_scope: string
        }
        Insert: {
          acknowledged_count?: number
          body_ar?: string | null
          category: string
          created_at?: string
          department_id?: string | null
          expiry_date?: string | null
          file_id?: string | null
          file_url: string
          id?: string
          requires_ack?: boolean | null
          requires_acknowledgment?: boolean
          status?: string
          subsidiary_id?: string | null
          title?: string | null
          title_ar: string
          title_en: string
          version?: string
          visibility_scope?: string
        }
        Update: {
          acknowledged_count?: number
          body_ar?: string | null
          category?: string
          created_at?: string
          department_id?: string | null
          expiry_date?: string | null
          file_id?: string | null
          file_url?: string
          id?: string
          requires_ack?: boolean | null
          requires_acknowledgment?: boolean
          status?: string
          subsidiary_id?: string | null
          title?: string | null
          title_ar?: string
          title_en?: string
          version?: string
          visibility_scope?: string
        }
        Relationships: []
      }
      competencies: {
        Row: {
          behavioral_indicators: Json
          category: string | null
          code: string | null
          company_id: string | null
          description_ar: string | null
          description_en: string | null
          framework_id: string | null
          id: string
          is_active: boolean
          target_proficiency_level: number
          title_ar: string
          title_en: string | null
          weight_pct: number
        }
        Insert: {
          behavioral_indicators?: Json
          category?: string | null
          code?: string | null
          company_id?: string | null
          description_ar?: string | null
          description_en?: string | null
          framework_id?: string | null
          id?: string
          is_active?: boolean
          target_proficiency_level?: number
          title_ar: string
          title_en?: string | null
          weight_pct?: number
        }
        Update: {
          behavioral_indicators?: Json
          category?: string | null
          code?: string | null
          company_id?: string | null
          description_ar?: string | null
          description_en?: string | null
          framework_id?: string | null
          id?: string
          is_active?: boolean
          target_proficiency_level?: number
          title_ar?: string
          title_en?: string | null
          weight_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "competencies_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "competency_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      competency_frameworks: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          title_ar: string
          title_en: string | null
          version: string
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          title_ar: string
          title_en?: string | null
          version?: string
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          title_ar?: string
          title_en?: string | null
          version?: string
        }
        Relationships: []
      }
      delegation_rules: {
        Row: {
          created_at: string
          created_by: string | null
          delegate_id: string
          delegator_id: string
          end_date: string
          id: string
          reason: string
          scope: string
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delegate_id: string
          delegator_id: string
          end_date: string
          id?: string
          reason?: string
          scope?: string
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delegate_id?: string
          delegator_id?: string
          end_date?: string
          id?: string
          reason?: string
          scope?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegation_rules_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegation_rules_delegator_id_fkey"
            columns: ["delegator_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          company_id: string | null
          created_at: string
          id: string
          manager_employee_id: string | null
          name: string
          name_en: string | null
          parent_id: string | null
          status: string
          unit_type: string
        }
        Insert: {
          code: string
          company_id?: string | null
          created_at?: string
          id?: string
          manager_employee_id?: string | null
          name: string
          name_en?: string | null
          parent_id?: string | null
          status?: string
          unit_type?: string
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string
          id?: string
          manager_employee_id?: string | null
          name?: string
          name_en?: string | null
          parent_id?: string | null
          status?: string
          unit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      development_plan_items: {
        Row: {
          action_type: string
          activity_description: string | null
          competency_id: string | null
          id: string
          objective_ar: string
          plan_id: string
          progress_pct: number
          status: string
          success_metric: string | null
          target_date: string | null
        }
        Insert: {
          action_type?: string
          activity_description?: string | null
          competency_id?: string | null
          id?: string
          objective_ar: string
          plan_id: string
          progress_pct?: number
          status?: string
          success_metric?: string | null
          target_date?: string | null
        }
        Update: {
          action_type?: string
          activity_description?: string | null
          competency_id?: string | null
          id?: string
          objective_ar?: string
          plan_id?: string
          progress_pct?: number
          status?: string
          success_metric?: string | null
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_plan_items_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_plan_items_plan_id_fkey"
            colum…20347 tokens truncated…        employee_id: string
          end_date: string | null
          id: string
          reason: string | null
          reference: string
          start_date: string | null
          status: Database["public"]["Enums"]["request_status"]
          total_steps: number
          type: Database["public"]["Enums"]["request_type"]
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          current_approver_role?: string | null
          current_step_index?: number
          days?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          reason?: string | null
          reference?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          total_steps?: number
          type: Database["public"]["Enums"]["request_type"]
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          current_approver_role?: string | null
          current_step_index?: number
          days?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          reason?: string | null
          reference?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          total_steps?: number
          type?: Database["public"]["Enums"]["request_type"]
        }
        Relationships: [
          {
            foreignKeyName: "requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      review_template_items: {
        Row: {
          competency_id: string | null
          custom_title_ar: string | null
          custom_title_en: string | null
          display_order: number
          id: string
          item_type: string
          template_id: string
          weight_pct: number
        }
        Insert: {
          competency_id?: string | null
          custom_title_ar?: string | null
          custom_title_en?: string | null
          display_order?: number
          id?: string
          item_type?: string
          template_id: string
          weight_pct?: number
        }
        Update: {
          competency_id?: string | null
          custom_title_ar?: string | null
          custom_title_en?: string | null
          display_order?: number
          id?: string
          item_type?: string
          template_id?: string
          weight_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_template_items_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "review_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      review_templates: {
        Row: {
          code: string | null
          company_id: string | null
          competencies_weight_pct: number
          created_at: string
          framework_id: string | null
          goals_weight_pct: number
          id: string
          include_360_peer_review: boolean
          is_active: boolean
          target_department_id: string | null
          target_job_title: string | null
          title_ar: string
          title_en: string | null
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          competencies_weight_pct?: number
          created_at?: string
          framework_id?: string | null
          goals_weight_pct?: number
          id?: string
          include_360_peer_review?: boolean
          is_active?: boolean
          target_department_id?: string | null
          target_job_title?: string | null
          title_ar: string
          title_en?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string | null
          competencies_weight_pct?: number
          created_at?: string
          framework_id?: string | null
          goals_weight_pct?: number
          id?: string
          include_360_peer_review?: boolean
          is_active?: boolean
          target_department_id?: string | null
          target_job_title?: string | null
          title_ar?: string
          title_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_templates_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "competency_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      role_definitions: {
        Row: {
          code: string | null
          created_at: string
          data_scope: string
          description: string | null
          description_ar: string | null
          description_en: string | null
          display_name_ar: string
          display_name_en: string
          id: string
          is_active: boolean
          is_system: boolean
          name_ar: string | null
          name_en: string | null
          role_key: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          code?: string | null
          created_at?: string
          data_scope?: string
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_name_ar: string
          display_name_en: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name_ar?: string | null
          name_en?: string | null
          role_key: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          code?: string | null
          created_at?: string
          data_scope?: string
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_name_ar?: string
          display_name_en?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name_ar?: string | null
          name_en?: string | null
          role_key?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          data_scope: string
          id: string
          module: string
          permission: string
          role_key: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          data_scope?: string
          id?: string
          module: string
          permission: string
          role_key: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          data_scope?: string
          id?: string
          module?: string
          permission?: string
          role_key?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      salary_profiles: {
        Row: {
          basic_salary: number
          created_at: string
          created_by: string | null
          effective_from: string
          employee_id: string
          gosi_registered: boolean
          housing_allowance: number
          id: string
          notes: string | null
          other_allowances: number
          transport_allowance: number
        }
        Insert: {
          basic_salary?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          employee_id: string
          gosi_registered?: boolean
          housing_allowance?: number
          id?: string
          notes?: string | null
          other_allowances?: number
          transport_allowance?: number
        }
        Update: {
          basic_salary?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          employee_id?: string
          gosi_registered?: boolean
          housing_allowance?: number
          id?: string
          notes?: string | null
          other_allowances?: number
          transport_allowance?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_assignments: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          is_rest_day: boolean | null
          shift_id: string | null
          status: string
          work_date: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          is_rest_day?: boolean | null
          shift_id?: string | null
          status?: string
          work_date: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          is_rest_day?: boolean | null
          shift_id?: string | null
          status?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          created_at: string
          employee_id: string | null
          eosb_amount: number
          id: string
          leave_payout_amount: number
          net_settlement_amount: number
          service_months: number
          service_years: number
          status: string
          termination_date: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          eosb_amount?: number
          id?: string
          leave_payout_amount?: number
          net_settlement_amount?: number
          service_months?: number
          service_years?: number
          status?: string
          termination_date: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          eosb_amount?: number
          id?: string
          leave_payout_amount?: number
          net_settlement_amount?: number
          service_months?: number
          service_years?: number
          status?: string
          termination_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          allow_single_punch: boolean
          code: string
          color: string | null
          created_at: string
          end_time: string
          flexible_hours: number | null
          grace_minutes_arrival: number | null
          grace_minutes_departure: number | null
          id: string
          name_ar: string
          name_en: string
          overtime_eligible: boolean | null
          split_second_end_time: string | null
          split_second_start_time: string | null
          start_time: string
          type: string
        }
        Insert: {
          allow_single_punch?: boolean
          code: string
          color?: string | null
          created_at?: string
          end_time: string
          flexible_hours?: number | null
          grace_minutes_arrival?: number | null
          grace_minutes_departure?: number | null
          id?: string
          name_ar: string
          name_en: string
          overtime_eligible?: boolean | null
          split_second_end_time?: string | null
          split_second_start_time?: string | null
          start_time: string
          type?: string
        }
        Update: {
          allow_single_punch?: boolean
          code?: string
          color?: string | null
          created_at?: string
          end_time?: string
          flexible_hours?: number | null
          grace_minutes_arrival?: number | null
          grace_minutes_departure?: number | null
          id?: string
          name_ar?: string
          name_en?: string
          overtime_eligible?: boolean | null
          split_second_end_time?: string | null
          split_second_start_time?: string | null
          start_time?: string
          type?: string
        }
        Relationships: []
      }
      subsidiaries: {
        Row: {
          code: string
          company_id: string | null
          cr_number: string | null
          created_at: string
          id: string
          manager_employee_id: string | null
          name_ar: string
          name_en: string
          status: string
        }
        Insert: {
          code: string
          company_id?: string | null
          cr_number?: string | null
          created_at?: string
          id?: string
          manager_employee_id?: string | null
          name_ar: string
          name_en: string
          status?: string
        }
        Update: {
          code?: string
          company_id?: string | null
          cr_number?: string | null
          created_at?: string
          id?: string
          manager_employee_id?: string | null
          name_ar?: string
          name_en?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subsidiaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subsidiaries_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_locations: {
        Row: {
          address: string | null
          code: string
          company_id: string | null
          created_at: string
          default_shift_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name_ar: string
          name_en: string
          radius_meters: number
          status: string
        }
        Insert: {
          address?: string | null
          code: string
          company_id?: string | null
          created_at?: string
          default_shift_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name_ar: string
          name_en: string
          radius_meters?: number
          status?: string
        }
        Update: {
          address?: string | null
          code?: string
          company_id?: string | null
          created_at?: string
          default_shift_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name_ar?: string
          name_en?: string
          radius_meters?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_locations_default_shift_id_fkey"
            columns: ["default_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_plans: {
        Row: {
          created_at: string
          current_budget: number
          current_headcount: number
          department_id: string | null
          id: string
          plan_year: number
          planned_exits: number
          planned_hires: number
          projected_cost: number
          status: string
          target_headcount: number
          title_ar: string
          title_en: string
        }
        Insert: {
          created_at?: string
          current_budget?: number
          current_headcount?: number
          department_id?: string | null
          id?: string
          plan_year: number
          planned_exits?: number
          planned_hires?: number
          projected_cost?: number
          status?: string
          target_headcount?: number
          title_ar: string
          title_en?: string
        }
        Update: {
          created_at?: string
          current_budget?: number
          current_headcount?: number
          department_id?: string | null
          id?: string
          plan_year?: number
          planned_exits?: number
          planned_hires?: number
          projected_cost?: number
          status?: string
          target_headcount?: number
          title_ar?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "workforce_plans_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_calibration_atomic: {
        Args: {
          p_calibrated_rating_label: string
          p_calibrated_score: number
          p_calibration_reason: string
          p_participant_id: string
          p_session_id: string
        }
        Returns: Json
      }
      approve_attendance_correction: {
        Args: { p_request_id: string }
        Returns: Json
      }
      approve_overtime_request: {
        Args: { p_overtime_id: string }
        Returns: Json
      }
      archive_business_document: {
        Args: { p_document_id: string; p_document_type: string }
        Returns: Json
      }
      archive_file_object: { Args: { p_file_id: string }; Returns: Json }
      assess_potential_atomic: {
        Args: {
          p_critical_role_readiness?: string
          p_cycle_id: string
          p_flight_risk?: string
          p_leadership_potential_score?: number
          p_learning_agility_score?: number
          p_participant_id: string
          p_potential_level: string
          p_rationale?: string
          p_retention_priority?: string
        }
        Returns: Json
      }
      assign_peer_reviewers_atomic: {
        Args: {
          p_cycle_id: string
          p_is_anonymous?: boolean
          p_peer_employee_ids: string[]
          p_target_employee_id: string
        }
        Returns: Json
      }
      can_access_core_company: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      finalize_file_replacement: {
        Args: { p_new_file_id: string; p_previous_file_id: string }
        Returns: Json
      }
      finalize_performance_cycle_atomic: {
        Args: { p_cycle_id: string }
        Returns: Json
      }
      get_dashboard_attendance_trend: {
        Args: { p_anchor_date: string; p_days: number }
        Returns: Json
      }
      get_dashboard_integration_health: { Args: never; Returns: Json }
      get_dashboard_summary: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_employee_directory: {
        Args: {
          p_contract_type?: string
          p_department_id?: string
          p_gender?: string
          p_location_id?: string
          p_max_salary?: number
          p_min_salary?: number
          p_nationality?: string
          p_page?: number
          p_page_size?: number
          p_quick_preset?: string
          p_search?: string
          p_sort?: string
          p_status?: string
          p_subsidiary_id?: string
        }
        Returns: Json
      }
      get_employee_directory_kpis: { Args: never; Returns: Json }
      get_performance_kpis_atomic: {
        Args: { p_cycle_id?: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_hr: { Args: { _user_id: string }; Returns: boolean }
      launch_performance_cycle_atomic: {
        Args: { p_cycle_id: string; p_target_department_ids?: string[] }
        Returns: Json
      }
      log_file_download_access: {
        Args: { p_access_type: string; p_file_id: string }
        Returns: Json
      }
      record_self_punch: {
        Args: {
          p_accuracy?: number
          p_client_event_id?: string
          p_latitude?: number
          p_longitude?: number
          p_punch_type: string
        }
        Returns: Json
      }
      reject_attendance_correction: {
        Args: { p_request_id: string }
        Returns: Json
      }
      reject_overtime_request: {
        Args: { p_overtime_id: string }
        Returns: Json
      }
      revoke_delegation_rule: {
        Args: { p_delegation_id: string }
        Returns: Json
      }
      run_leave_accrual: {
        Args: {
          p_company_id?: string
          p_leave_type_id?: string
          p_period_month?: number
          p_year?: number
        }
        Returns: Json
      }
      save_country_payroll_policy: {
        Args: {
          p_activate: boolean
          p_company: string
          p_country: string
          p_policy: Json
        }
        Returns: string
      }
      save_payroll_run_atomic: {
        Args: { p_allocations: Json; p_details: Json; p_run: Json }
        Returns: string
      }
      set_payroll_run_status_atomic: {
        Args: { p_run_id: string; p_status: string }
        Returns: undefined
      }
      submit_performance_goal_atomic: {
        Args: {
          p_category: string
          p_cycle_id: string
          p_description: string
          p_employee_id: string
          p_level: string
          p_metric_type: string
          p_parent_goal_id: string
          p_start_value: number
          p_target_value: number
          p_title_ar: string
          p_title_en: string
          p_weight: number
        }
        Returns: Json
      }
      submit_performance_review_atomic: {
        Args: {
          p_assignment_id: string
          p_general_feedback?: string
          p_growth_areas_summary?: string
          p_scores: Json
          p_strengths_summary?: string
        }
        Returns: Json
      }
      update_goal_progress_atomic: {
        Args: {
          p_goal_id: string
          p_new_value: number
          p_note?: string
          p_percentage: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "org_admin"
        | "hr_manager"
        | "line_manager"
        | "employee"
        | "super_admin"
        | "payroll_officer"
        | "attendance_officer"
        | "recruiter"
        | "finance_officer"
        | "performance_lead"
        | "auditor"
      attendance_status: "present" | "late" | "absent" | "leave" | "remote"
      employee_status:
        | "active"
        | "on_leave"
        | "suspended"
        | "terminated"
        | "draft"
      request_status: "draft" | "pending" | "approved" | "rejected" | "returned"
      request_type: "leave" | "attendance_fix" | "advance" | "expense"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "org_admin",
        "hr_manager",
        "line_manager",
        "employee",
        "super_admin",
        "payroll_officer",
        "attendance_officer",
        "recruiter",
        "finance_officer",
        "performance_lead",
        "auditor",
      ],
      attendance_status: ["present", "late", "absent", "leave", "remote"],
      employee_status: [
        "active",
        "on_leave",
        "suspended",
        "terminated",
        "draft",
      ],
      request_status: ["draft", "pending", "approved", "rejected", "returned"],
      request_type: ["leave", "attendance_fix", "advance", "expense"],
    },
  },
} as const
