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
          email: string
          full_name: string
          full_name_ar: string | null
          id: string
          job_id: string | null
          phone: string | null
          rating: number | null
          rating_score: number | null
          source: string | null
          stage: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          full_name_ar?: string | null
          id?: string
          job_id?: string | null
          phone?: string | null
          rating?: number | null
          rating_score?: number | null
          source?: string | null
          stage?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          full_name_ar?: string | null
          id?: string
          job_id?: string | null
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
          code: string | null
          cr_number: string | null
          created_at: string
          currency: string
          headquarters_address: string | null
          id: string
          legal_name: string | null
          legal_name_ar: string
          legal_name_en: string
          name: string | null
          subsidiary_id: string | null
          tax_number: string | null
          timezone: string
        }
        Insert: {
          code?: string | null
          cr_number?: string | null
          created_at?: string
          currency?: string
          headquarters_address?: string | null
          id?: string
          legal_name?: string | null
          legal_name_ar: string
          legal_name_en: string
          name?: string | null
          subsidiary_id?: string | null
          tax_number?: string | null
          timezone?: string
        }
        Update: {
          code?: string | null
          cr_number?: string | null
          created_at?: string
          currency?: string
          headquarters_address?: string | null
          id?: string
          legal_name?: string | null
          legal_name_ar?: string
          legal_name_en?: string
          name?: string | null
          subsidiary_id?: string | null
          tax_number?: string | null
          timezone?: string
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
      company_documents: {
        Row: {
          acknowledged_count: number
          body_ar: string | null
          category: string
          created_at: string
          file_url: string
          id: string
          requires_ack: boolean | null
          title: string | null
          title_ar: string
          title_en: string
          version: string
        }
        Insert: {
          acknowledged_count?: number
          body_ar?: string | null
          category: string
          created_at?: string
          file_url: string
          id?: string
          requires_ack?: boolean | null
          title?: string | null
          title_ar: string
          title_en: string
          version?: string
        }
        Update: {
          acknowledged_count?: number
          body_ar?: string | null
          category?: string
          created_at?: string
          file_url?: string
          id?: string
          requires_ack?: boolean | null
          title?: string | null
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
      document_acknowledgments: {
        Row: {
          acknowledged_at: string
          document_id: string
          employee_id: string
          id: string
        }
        Insert: {
          acknowledged_at?: string
          document_id: string
          employee_id: string
          id?: string
        }
        Update: {
          acknowledged_at?: string
          document_id?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_acknowledgments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "company_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string
          created_by: string | null
          doc_number: string | null
          doc_type: string
          employee_id: string
          expires_at: string | null
          file_url: string | null
          id: string
          issued_at: string | null
          notes: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doc_number?: string | null
          doc_type: string
          employee_id: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doc_number?: string | null
          doc_type?: string
          employee_id?: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          basic_salary: number
          company_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          email: string | null
          employee_no: string
          full_name: string
          hire_date: string
          id: string
          job_title: string
          location_id: string | null
          manager_id: string | null
          payroll_group_id: string | null
          phone: string | null
          position_title: string | null
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string | null
          user_id: string | null
          work_email: string | null
          work_location_id: string | null
        }
        Insert: {
          basic_salary?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          employee_no: string
          full_name: string
          hire_date?: string
          id?: string
          job_title?: string
          location_id?: string | null
          manager_id?: string | null
          payroll_group_id?: string | null
          phone?: string | null
          position_title?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string | null
          user_id?: string | null
          work_email?: string | null
          work_location_id?: string | null
        }
        Update: {
          basic_salary?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          employee_no?: string
          full_name?: string
          hire_date?: string
          id?: string
          job_title?: string
          location_id?: string | null
          manager_id?: string | null
          payroll_group_id?: string | null
          phone?: string | null
          position_title?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string | null
          user_id?: string | null
          work_email?: string | null
          work_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_payroll_group_id_fkey"
            columns: ["payroll_group_id"]
            isOneToOne: false
            referencedRelation: "payroll_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_work_location_id_fkey"
            columns: ["work_location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
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
          claim_no: string | null
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          description: string | null
          employee_id: string | null
          expense_date: string | null
          id: string
          merchant: string | null
          merchant_name: string
          notes: string | null
          policy_category_id: string | null
          receipt_attached: boolean | null
          receipt_url: string | null
          report_no: string | null
          spent_at: string
          status: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          claim_no?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          employee_id?: string | null
          expense_date?: string | null
          id?: string
          merchant?: string | null
          merchant_name: string
          notes?: string | null
          policy_category_id?: string | null
          receipt_attached?: boolean | null
          receipt_url?: string | null
          report_no?: string | null
          spent_at: string
          status?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          claim_no?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          employee_id?: string | null
          expense_date?: string | null
          id?: string
          merchant?: string | null
          merchant_name?: string
          notes?: string | null
          policy_category_id?: string | null
          receipt_attached?: boolean | null
          receipt_url?: string | null
          report_no?: string | null
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
      expense_reports: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          report_no: string
          status: string
          title: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          report_no?: string
          status?: string
          title?: string | null
          total_amount?: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          report_no?: string
          status?: string
          title?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_reports_employee_id_fkey"
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
          assigned_to: string | null
          assigned_to_employee_id: string | null
          category: string
          created_at: string
          id: string
          name: string | null
          name_ar: string
          name_en: string
          serial_number: string
          status: string
        }
        Insert: {
          asset_tag: string
          assigned_to?: string | null
          assigned_to_employee_id?: string | null
          category: string
          created_at?: string
          id?: string
          name?: string | null
          name_ar: string
          name_en: string
          serial_number: string
          status?: string
        }
        Update: {
          asset_tag?: string
          assigned_to?: string | null
          assigned_to_employee_id?: string | null
          category?: string
          created_at?: string
          id?: string
          name?: string | null
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
          {
            foreignKeyName: "hardware_assets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      job_offers: {
        Row: {
          candidate_id: string
          created_at: string
          created_by: string | null
          id: string
          offered_salary: number | null
          start_date: string | null
          status: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          offered_salary?: number | null
          start_date?: string | null
          status?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          offered_salary?: number | null
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      job_openings: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          description_ar: string | null
          employment_type: string | null
          filled_count: number
          headcount: number | null
          id: string
          location_id: string | null
          openings_count: number
          published_status: string
          salary_max: number | null
          salary_min: number | null
          status: string | null
          title: string | null
          title_ar: string
          title_en: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          description_ar?: string | null
          employment_type?: string | null
          filled_count?: number
          headcount?: number | null
          id?: string
          location_id?: string | null
          openings_count?: number
          published_status?: string
          salary_max?: number | null
          salary_min?: number | null
          status?: string | null
          title?: string | null
          title_ar: string
          title_en: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          description_ar?: string | null
          employment_type?: string | null
          filled_count?: number
          headcount?: number | null
          id?: string
          location_id?: string | null
          openings_count?: number
          published_status?: string
          salary_max?: number | null
          salary_min?: number | null
          status?: string | null
          title?: string | null
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
          {
            foreignKeyName: "job_openings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          accrued_days: number
          annual_entitlement: number
          balance: number | null
          carried_over_days: number
          employee_id: string | null
          id: string
          leave_type_id: string | null
          reserved_days: number
          updated_at: string
          used_days: number
          year: number | null
        }
        Insert: {
          accrued_days?: number
          annual_entitlement?: number
          balance?: number | null
          carried_over_days?: number
          employee_id?: string | null
          id?: string
          leave_type_id?: string | null
          reserved_days?: number
          updated_at?: string
          used_days?: number
          year?: number | null
        }
        Update: {
          accrued_days?: number
          annual_entitlement?: number
          balance?: number | null
          carried_over_days?: number
          employee_id?: string | null
          id?: string
          leave_type_id?: string | null
          reserved_days?: number
          updated_at?: string
          used_days?: number
          year?: number | null
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
          is_active: boolean | null
          is_paid: boolean | null
          max_days: number | null
          max_days_per_year: number | null
          name: string | null
          name_ar: string
          name_en: string
          requires_attachment: boolean | null
          sort_order: number | null
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
          is_active?: boolean | null
          is_paid?: boolean | null
          max_days?: number | null
          max_days_per_year?: number | null
          name?: string | null
          name_ar: string
          name_en: string
          requires_attachment?: boolean | null
          sort_order?: number | null
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
          is_active?: boolean | null
          is_paid?: boolean | null
          max_days?: number | null
          max_days_per_year?: number | null
          name?: string | null
          name_ar?: string
          name_en?: string
          requires_attachment?: boolean | null
          sort_order?: number | null
          status?: string | null
        }
        Relationships: []
      }
      loans: {
        Row: {
          approved_amount: number | null
          approved_by: string | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          employee_id: string | null
          id: string
          installment_amount: number | null
          installments_paid: number
          installments_total: number | null
          loan_type: string
          monthly_installment: number
          outstanding_amount: number | null
          paid_installments: number
          principal_amount: number
          reason: string | null
          remaining_balance: number
          requested_at: string | null
          status: string
          total_installments: number
          total_paid: number
        }
        Insert: {
          approved_amount?: number | null
          approved_by?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          employee_id?: string | null
          id?: string
          installment_amount?: number | null
          installments_paid?: number
          installments_total?: number | null
          loan_type?: string
          monthly_installment: number
          outstanding_amount?: number | null
          paid_installments?: number
          principal_amount: number
          reason?: string | null
          remaining_balance: number
          requested_at?: string | null
          status?: string
          total_installments: number
          total_paid?: number
        }
        Update: {
          approved_amount?: number | null
          approved_by?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          employee_id?: string | null
          id?: string
          installment_amount?: number | null
          installments_paid?: number
          installments_total?: number | null
          loan_type?: string
          monthly_installment?: number
          outstanding_amount?: number | null
          paid_installments?: number
          principal_amount?: number
          reason?: string | null
          remaining_balance?: number
          requested_at?: string | null
          status?: string
          total_installments?: number
          total_paid?: number
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
          body_ar: string | null
          body_en: string | null
          created_at: string
          id: string
          is_read: boolean
          link_path: string | null
          message_ar: string
          message_en: string
          read_at: string | null
          recipient_id: string | null
          title_ar: string
          title_en: string
          type: string
        }
        Insert: {
          body_ar?: string | null
          body_en?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_path?: string | null
          message_ar: string
          message_en: string
          read_at?: string | null
          recipient_id?: string | null
          title_ar: string
          title_en: string
          type?: string
        }
        Update: {
          body_ar?: string | null
          body_en?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_path?: string | null
          message_ar?: string
          message_en?: string
          read_at?: string | null
          recipient_id?: string | null
          title_ar?: string
          title_en?: string
          type?: string
        }
        Relationships: []
      }
      org_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: []
      }
      payroll_details: {
        Row: {
          absence_deductions: number
          absent_days: number
          basic_salary: number
          created_at: string
          employee_id: string
          gosi_employee: number
          gosi_employer: number
          gross_salary: number
          housing_allowance: number
          id: string
          loan_deductions: number
          net_salary: number
          other_allowances: number
          other_deductions: number
          overtime_amount: number
          payroll_run_id: string
          transport_allowance: number
          working_days: number
        }
        Insert: {
          absence_deductions?: number
          absent_days?: number
          basic_salary?: number
          created_at?: string
          employee_id: string
          gosi_employee?: number
          gosi_employer?: number
          gross_salary?: number
          housing_allowance?: number
          id?: string
          loan_deductions?: number
          net_salary?: number
          other_allowances?: number
          other_deductions?: number
          overtime_amount?: number
          payroll_run_id: string
          transport_allowance?: number
          working_days?: number
        }
        Update: {
          absence_deductions?: number
          absent_days?: number
          basic_salary?: number
          created_at?: string
          employee_id?: string
          gosi_employee?: number
          gosi_employer?: number
          gross_salary?: number
          housing_allowance?: number
          id?: string
          loan_deductions?: number
          net_salary?: number
          other_allowances?: number
          other_deductions?: number
          overtime_amount?: number
          payroll_run_id?: string
          transport_allowance?: number
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_details_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_details_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
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
      performance_criteria: {
        Row: {
          created_at: string
          cycle_id: string | null
          id: string
          name_ar: string
          weight: number
        }
        Insert: {
          created_at?: string
          cycle_id?: string | null
          id?: string
          name_ar: string
          weight?: number
        }
        Update: {
          created_at?: string
          cycle_id?: string | null
          id?: string
          name_ar?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_criteria_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_cycles: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          name_ar: string
          name_en: string | null
          start_date: string | null
          status: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name_ar: string
          name_en?: string | null
          start_date?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name_ar?: string
          name_en?: string | null
          start_date?: string | null
          status?: string
        }
        Relationships: []
      }
      performance_reviews: {
        Row: {
          comments: string | null
          created_at: string
          cycle_id: string | null
          employee_id: string | null
          id: string
          overall_score: number | null
          review_type: string
          reviewer_id: string | null
          status: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          cycle_id?: string | null
          employee_id?: string | null
          id?: string
          overall_score?: number | null
          review_type?: string
          reviewer_id?: string | null
          status?: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          cycle_id?: string | null
          employee_id?: string | null
          id?: string
          overall_score?: number | null
          review_type?: string
          reviewer_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string | null
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
          work_location_id: string | null
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
          work_location_id?: string | null
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
          work_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punches_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punches_work_location_id_fkey"
            columns: ["work_location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_lists: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          list_type: string
          name_ar: string
          name_en: string | null
          sort_order: number | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          list_type: string
          name_ar: string
          name_en?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          list_type?: string
          name_ar?: string
          name_en?: string | null
          sort_order?: number | null
        }
        Relationships: []
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
      role_definitions: {
        Row: {
          created_at: string
          description: string | null
          display_name_ar: string
          display_name_en: string
          id: string
          is_active: boolean
          role_key: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name_ar: string
          display_name_en: string
          id?: string
          is_active?: boolean
          role_key: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name_ar?: string
          display_name_en?: string
          id?: string
          is_active?: boolean
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
      current_employee_id: { Args: never; Returns: string }
      current_user_is_hr: { Args: never; Returns: boolean }
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
      employee_status: ["active", "on_leave", "suspended", "terminated"],
      request_status: ["draft", "pending", "approved", "rejected", "returned"],
      request_type: ["leave", "attendance_fix", "advance", "expense"],
    },
  },
} as const
