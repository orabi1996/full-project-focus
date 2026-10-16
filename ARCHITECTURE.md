# MADARX ENTERPRISE WORKFORCE PLATFORM
# ARCHITECTURE MANIFESTO & SYSTEM DESIGN (v1.0.0-enterprise)

## 1. System Overview & Core Philosophy
MadarX is an enterprise-grade Human Capital Management (HCM) and Workforce Intelligence platform. It is engineered as a unified, multi-tenant SaaS architecture supporting 5 operating countries (Egypt, Saudi Arabia, Qatar, Oman, and Bahrain).

```
+-----------------------------------------------------------------------------------+
|                           MadarX Presentation Layer                              |
|           React 18 + Vite + TanStack Router + TailwindCSS + Radix UI             |
|                  Arabic (RTL) & English (LTR) Unified Interface                   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        Enterprise AI & Copilot Layer                             |
|  Grounded Natural Language Assistant (Screen M29) + RAG Knowledge + Tools + Safety|
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             Business Domain Layer                                 |
|  29 Enterprise Screens (M01-M29): Employees, Org, Leaves, Attendance, Shifts,     |
|  Payroll, Loans, ATS, Performance, Talent, Learning, Engagement, ER, Country Packs|
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                      Authoritative Data & Governance Layer                        |
|  PostgreSQL 16 + Supabase Auth + RLS Scoping + Atomic RPC Stored Procedures       |
|  Effective-Dated History + Monotonic Audit Logs + Real-time Biometric Ingestion   |
+-----------------------------------------------------------------------------------+
```

## 2. Key Architectural Tenets
1. **Zero Hallucination / Zero Fake Data:** The system and AI Copilot never fabricate facts, employees, balances, or salaries. All data derives from authoritative repositories and PostgreSQL stored procedures.
2. **Effective-Dated Temporal Truth:** Changes to compensation, organizational hierarchies, job titles, or legal statutory rules are effective-dated (`effective_from`, `effective_to`). Historical calculations remain immutable.
3. **Multi-Country Sovereign Compliance:** Country Packs (Egypt NOSI/Law 7, Saudi GOSI/SANED, Qatar GRSIA, Oman SPF, Bahrain SIO) run natively within a single platform core without cross-country contamination.
4. **Governed AI Mutation Gates:** AI assistants may execute read tools immediately, but write/mutation tools strictly require explicit human preview and confirmation (`Preview -> Confirm -> Execute -> Verify`).
5. **Strict Row-Level Security (RLS):** Every database entity enforces multi-tenant boundary isolation based on server-verified JWT claims (`company_id`).

## 3. Screen & Capability Catalog (M01–M29)
- **M01–M05:** Dashboard, System Setup, Organization Structure, Employee Master Directory, Document Vault.
- **M06–M09:** Multi-level Approvals & Workflow, Leaves & Absence Balances, Attendance & Biometrics, Shifts & Rostering.
- **M10–M12:** Payroll Runs & WPS SIF Engine, Employee Loans & End-of-Service, Petty Cash & Expense Reimbursements.
- **M13–M16:** Recruitment ATS & Applicant Tracking, Performance Management & 360 Reviews, Workforce Planning & Headcount, IT & Hardware Asset Management.
- **M17–M19:** Enterprise BI Reports & Governed Metric Studio, Integrations & Webhooks Hub, Immutable Audit Trail & Security Log.
- **M20–M24:** Employee Self-Service (ESS), Onboarding & Statutory Probation, Employee Movements & Promotion Lifecycle, Learning Management & Certifications, Talent & Succession Planning.
- **M25–M28:** Employee Engagement & Pulse Recognition, Employee Relations & Disciplinary Cases, Compensation & Total Rewards Engine, Multi-Country Statutory Compliance & WPS Packs.
- **M29:** MadarX AI Copilot, Proactive Insights Center, RAG Policy Knowledge Base, and Enterprise Intelligence Operations.
