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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          employee_id: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          work_date: string
          worked_hours: number
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          work_date: string
          worked_hours?: number
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          work_date?: string
          worked_hours?: number
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
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          changes_summary: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          changes_summary?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          changes_summary?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          job_id: string | null
          phone: string | null
          rating_score: number | null
          source: string | null
          stage: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          job_id?: string | null
          phone?: string | null
          rating_score?: number | null
          source?: string | null
          stage?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_id?: string | null
          phone?: string | null
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
          cr_number: string | null
          created_at: string
          currency: string
          headquarters_address: string | null
          id: string
          legal_name_ar: string
          legal_name_en: string
          tax_number: string | null
          timezone: string
        }
        Insert: {
          cr_number?: string | null
          created_at?: string
          currency?: string
          headquarters_address?: string | null
          id?: string
          legal_name_ar: string
          legal_name_en: string
          tax_number?: string | null
          timezone?: string
        }
        Update: {
          cr_number?: string | null
          created_at?: string
          currency?: string
          headquarters_address?: string | null
          id?: string
          legal_name_ar?: string
          legal_name_en?: string
          tax_number?: string | null
          timezone?: string
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          acknowledged_count: number
          category: string
          created_at: string
          file_url: string
          id: string
          title_ar: string
          title_en: string
          version: string
        }
        Insert: {
          acknowledged_count?: number
          category: string
          created_at?: string
          file_url: string
          id?: string
          title_ar: string
          title_en: string
          version?: string
        }
        Update: {
          acknowledged_count?: number
          category?: string
          created_at?: string
          file_url?: string
          id?: string
          title_ar?: string
          title_en?: string
          version?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          basic_salary: number
          created_at: string
          department_id: string | null
          email: string | null
          employee_no: string
          full_name: string
          hire_date: string
          id: string
          job_title: string
          phone: string | null
          status: Database["public"]["Enums"]["employee_status"]
          user_id: string | null
        }
        Insert: {
          basic_salary?: number
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_no: string
          full_name: string
          hire_date?: string
          id?: string
          job_title?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          user_id?: string | null
        }
        Update: {
          basic_salary?: number
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_no?: string
          full_name?: string
          hire_date?: string
          id?: string
          job_title?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          max_limit_block: number
          max_limit_warning: number
          name_ar: string
          name_en: string
          requires_receipt: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          max_limit_block?: number
          max_limit_warning?: number
          name_ar: string
          name_en: string
          requires_receipt?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          max_limit_block?: number
          max_limit_warning?: number
          name_ar?: string
          name_en?: string
          requires_receipt?: boolean | null
        }
        Relationships: []
      }
      expense_claims: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          employee_id: string | null
          id: string
          merchant_name: string
          receipt_url: string | null
          spent_at: string
          status: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          employee_id?: string | null
          id?: string
          merchant_name: string
          receipt_url?: string | null
          spent_at: string
          status?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          employee_id?: string | null
          id?: string
          merchant_name?: string
          receipt_url?: string | null
          spent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_claims_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claims_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hardware_assets: {
        Row: {
          asset_tag: string
          assigned_to_employee_id: string | null
          category: string
          created_at: string
          id: string
          name_ar: string
          name_en: string
          serial_number: string
          status: string
        }
        Insert: {
          asset_tag: string
          assigned_to_employee_id?: string | null
          category: string
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
          serial_number: string
          status?: string
        }
        Update: {
          asset_tag?: string
          assigned_to_employee_id?: string | null
          category?: string
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          serial_number?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hardware_assets_assigned_to_employee_id_fkey"
            columns: ["assigned_to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      job_openings: {
        Row: {
          created_at: string
          department_id: string | null
          description_ar: string | null
          filled_count: number
          id: string
          openings_count: number
          published_status: string
          salary_max: number | null
          salary_min: number | null
          title_ar: string
          title_en: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description_ar?: string | null
          filled_count?: number
          id?: string
          openings_count?: number
          published_status?: string
          salary_max?: number | null
          salary_min?: number | null
          title_ar: string
          title_en: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description_ar?: string | null
          filled_count?: number
          id?: string
          openings_count?: number
          published_status?: string
          salary_max?: number | null
          salary_min?: number | null
          title_ar?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_openings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          accrued_days: number
          annual_entitlement: number
          carried_over_days: number
          employee_id: string | null
          id: string
          leave_type_id: string | null
          reserved_days: number
          updated_at: string
          used_days: number
        }
        Insert: {
          accrued_days?: number
          annual_entitlement?: number
          carried_over_days?: number
          employee_id?: string | null
          id?: string
          leave_type_id?: string | null
          reserved_days?: number
          updated_at?: string
          used_days?: number
        }
        Update: {
          accrued_days?: number
          annual_entitlement?: number
          carried_over_days?: number
          employee_id?: string | null
          id?: string
          leave_type_id?: string | null
          reserved_days?: number
          updated_at?: string
          used_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          accrual_method: string | null
          allow_half_day: boolean | null
          code: string
          color: string | null
          created_at: string
          deduct_working_days_only: boolean | null
          id: string
          is_paid: boolean | null
          max_days_per_year: number | null
          name_ar: string
          name_en: string
          status: string | null
        }
        Insert: {
          accrual_method?: string | null
          allow_half_day?: boolean | null
          code: string
          color?: string | null
          created_at?: string
          deduct_working_days_only?: boolean | null
          id?: string
          is_paid?: boolean | null
          max_days_per_year?: number | null
          name_ar: string
          name_en: string
          status?: string | null
        }
        Update: {
          accrual_method?: string | null
          allow_half_day?: boolean | null
          code?: string
          color?: string | null
          created_at?: string
          deduct_working_days_only?: boolean | null
          id?: string
          is_paid?: boolean | null
          max_days_per_year?: number | null
          name_ar?: string
          name_en?: string
          status?: string | null
        }
        Relationships: []
      }
      loans: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          loan_type: string
          monthly_installment: number
          paid_installments: number
          principal_amount: number
          remaining_balance: number
          status: string
          total_installments: number
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          loan_type?: string
          monthly_installment: number
          paid_installments?: number
          principal_amount: number
          remaining_balance: number
          status?: string
          total_installments: number
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          loan_type?: string
          monthly_installment?: number
          paid_installments?: number
          principal_amount?: number
          remaining_balance?: number
          status?: string
          total_installments?: number
        }
        Relationships: [
          {
            foreignKeyName: "loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_inbox: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message_ar: string
          message_en: string
          recipient_id: string | null
          title_ar: string
          title_en: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message_ar: string
          message_en: string
          recipient_id?: string | null
          title_ar: string
          title_en: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message_ar?: string
          message_en?: string
          recipient_id?: string | null
          title_ar?: string
          title_en?: string
          type?: string
        }
        Relationships: []
      }
      payroll_groups: {
        Row: {
          calculation_basis: string
          created_at: string
          currency: string
          cutoff_day: number
          id: string
          name_ar: string
          name_en: string
          payday: number
        }
        Insert: {
          calculation_basis?: string
          created_at?: string
          currency?: string
          cutoff_day?: number
          id?: string
          name_ar: string
          name_en: string
          payday?: number
        }
        Update: {
          calculation_basis?: string
          created_at?: string
          currency?: string
          cutoff_day?: number
          id?: string
          name_ar?: string
          name_en?: string
          payday?: number
        }
        Relationships: []
      }
      payroll_runs: {
        Row: {
          created_at: string
          id: string
          locked_at: string | null
          paid_at: string | null
          payroll_group_id: string | null
          period_month: number
          period_year: number
          status: string
          total_allowances: number
          total_basic_salary: number
          total_deductions: number
          total_employees: number
          total_employer_gosi: number
          total_net_salary: number
          total_overtime_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          locked_at?: string | null
          paid_at?: string | null
          payroll_group_id?: string | null
          period_month: number
          period_year: number
          status?: string
          total_allowances?: number
          total_basic_salary?: number
          total_deductions?: number
          total_employees?: number
          total_employer_gosi?: number
          total_net_salary?: number
          total_overtime_amount?: number
        }
        Update: {
          created_at?: string
          id?: string
          locked_at?: string | null
          paid_at?: string | null
          payroll_group_id?: string | null
          period_month?: number
          period_year?: number
          status?: string
          total_allowances?: number
          total_basic_salary?: number
          total_deductions?: number
          total_employees?: number
          total_employer_gosi?: number
          total_net_salary?: number
          total_overtime_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_payroll_group_id_fkey"
            columns: ["payroll_group_id"]
            isOneToOne: false
            referencedRelation: "payroll_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      punches: {
        Row: {
          created_at: string
          device_id: string | null
          employee_id: string | null
          geofence_valid: boolean | null
          id: string
          latitude: number | null
          longitude: number | null
          punch_time: string
          punch_type: string
          source: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          employee_id?: string | null
          geofence_valid?: boolean | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          punch_time: string
          punch_type?: string
          source?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          employee_id?: string | null
          geofence_valid?: boolean | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          punch_time?: string
          punch_type?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "punches_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string | null
          days: number | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          employee_id: string
          end_date: string | null
          id: string
          reason: string | null
          reference: string
          start_date: string | null
          status: Database["public"]["Enums"]["request_status"]
          type: Database["public"]["Enums"]["request_type"]
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
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
          type: Database["public"]["Enums"]["request_type"]
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
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
          code: string
          color: string | null
          created_at: string
          end_time: string
          grace_minutes_arrival: number | null
          grace_minutes_departure: number | null
          id: string
          name_ar: string
          name_en: string
          overtime_eligible: boolean | null
          start_time: string
          type: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          end_time: string
          grace_minutes_arrival?: number | null
          grace_minutes_departure?: number | null
          id?: string
          name_ar: string
          name_en: string
          overtime_eligible?: boolean | null
          start_time: string
          type?: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          end_time?: string
          grace_minutes_arrival?: number | null
          grace_minutes_departure?: number | null
          id?: string
          name_ar?: string
          name_en?: string
          overtime_eligible?: boolean | null
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_hr: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "org_admin" | "hr_manager" | "line_manager" | "employee"
      attendance_status: "present" | "late" | "absent" | "leave" | "remote"
      employee_status: "active" | "on_leave" | "suspended" | "terminated"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["org_admin", "hr_manager", "line_manager", "employee"],
      attendance_status: ["present", "late", "absent", "leave", "remote"],
      employee_status: ["active", "on_leave", "suspended", "terminated"],
      request_status: ["draft", "pending", "approved", "rejected", "returned"],
      request_type: ["leave", "attendance_fix", "advance", "expense"],
    },
  },
} as const
