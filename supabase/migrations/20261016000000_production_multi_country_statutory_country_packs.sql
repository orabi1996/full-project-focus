-- ============================================================================
-- MADARX ENTERPRISE WORKFORCE PLATFORM
-- PROMPT 34: PRODUCTION MULTI-COUNTRY STATUTORY COUNTRY PACKS & COMPLIANCE ENGINE
-- supabase/migrations/20261016000000_production_multi_country_statutory_country_packs.sql
-- ============================================================================

-- 1. COUNTRY PACKS REGISTRY
CREATE TABLE IF NOT EXISTS country_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL UNIQUE, -- EG, SA, QA, OM, BH
  country_name_ar VARCHAR(100) NOT NULL,
  country_name_en VARCHAR(100) NOT NULL,
  currency_code VARCHAR(3) NOT NULL, -- EGP, SAR, QAR, OMR, BHD
  primary_language VARCHAR(5) NOT NULL DEFAULT 'ar',
  is_active BOOLEAN NOT NULL DEFAULT true,
  wps_supported BOOLEAN NOT NULL DEFAULT true,
  income_tax_supported BOOLEAN NOT NULL DEFAULT false,
  social_insurance_supported BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 2. STATUTORY LEGAL RULE SOURCES REGISTER
CREATE TABLE IF NOT EXISTS statutory_rule_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE CASCADE,
  source_code VARCHAR(50) NOT NULL,
  authority_name_ar VARCHAR(255) NOT NULL,
  authority_name_en VARCHAR(255) NOT NULL,
  title_ar VARCHAR(255) NOT NULL,
  title_en VARCHAR(255) NOT NULL,
  publication_ref VARCHAR(255) NOT NULL,
  source_url TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  verifier_user_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_statutory_source UNIQUE (country_code, source_code)
);

-- 3. STATUTORY RULE SETS (VERSIONED CONTAINERS)
CREATE TABLE IF NOT EXISTS statutory_rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE CASCADE,
  version_code VARCHAR(50) NOT NULL, -- e.g. SA-2024-V1, EG-2024-V1
  version_name_ar VARCHAR(255) NOT NULL,
  version_name_en VARCHAR(255) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'verified', 'scheduled', 'active', 'superseded', 'retired')),
  proposed_by UUID REFERENCES auth.users(id),
  verified_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_statutory_rule_set_version UNIQUE (country_code, version_code)
);

-- 4. ATOMIC STATUTORY RULES
CREATE TABLE IF NOT EXISTS statutory_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL REFERENCES statutory_rule_sets(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE CASCADE,
  rule_group VARCHAR(50) NOT NULL
    CHECK (rule_group IN (
      'social_insurance', 'income_tax', 'wps', 'leave', 'working_time',
      'overtime', 'end_of_service', 'probation', 'notice', 'public_holidays', 'statutory_identifiers'
    )),
  rule_code VARCHAR(100) NOT NULL,
  source_id UUID REFERENCES statutory_rule_sources(id),
  effective_from DATE NOT NULL,
  effective_to DATE,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  formula_expression TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'superseded', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_statutory_rule_code UNIQUE (rule_set_id, rule_code)
);

-- 5. SOCIAL INSURANCE PROFILES
CREATE TABLE IF NOT EXISTS social_insurance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL REFERENCES statutory_rule_sets(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE CASCADE,
  profile_code VARCHAR(50) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  target_citizenship VARCHAR(20) NOT NULL CHECK (target_citizenship IN ('national', 'non_national', 'all')),
  employee_rate NUMERIC(8, 4) NOT NULL DEFAULT 0.0000,
  employer_rate NUMERIC(8, 4) NOT NULL DEFAULT 0.0000,
  min_wage_basis NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  max_wage_basis NUMERIC(14, 2), -- NULL means uncapped
  special_deduction_rate NUMERIC(8, 4) NOT NULL DEFAULT 0.0000, -- e.g. Martyrs fund, Unemployment
  special_employer_rate NUMERIC(8, 4) NOT NULL DEFAULT 0.0000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 6. STATUTORY TAX BRACKETS (FOR JURISDICTIONS WITH PAYROLL TAX)
CREATE TABLE IF NOT EXISTS statutory_tax_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL REFERENCES statutory_rule_sets(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE CASCADE,
  bracket_order INT NOT NULL,
  lower_bound NUMERIC(14, 2) NOT NULL,
  upper_bound NUMERIC(14, 2), -- NULL means infinity
  rate_percentage NUMERIC(6, 4) NOT NULL, -- e.g. 0.1000 for 10%
  fixed_base_tax NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 7. EMPLOYEE STATUTORY PROFILES
CREATE TABLE IF NOT EXISTS employee_statutory_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE CASCADE,
  social_insurance_number VARCHAR(100),
  tax_identifier VARCHAR(100),
  residency_or_national_id VARCHAR(100) NOT NULL,
  civil_or_cpr_or_qid VARCHAR(100),
  labor_office_id VARCHAR(100),
  enrollment_status VARCHAR(20) NOT NULL DEFAULT 'registered'
    CHECK (enrollment_status IN ('registered', 'pending', 'exempt', 'not_applicable')),
  is_exempt BOOLEAN NOT NULL DEFAULT false,
  exemption_reason TEXT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_employee_statutory_profile UNIQUE (company_id, employee_id, country_code)
);

-- 8. WAGE PROTECTION SYSTEM (WPS) BATCHES
CREATE TABLE IF NOT EXISTS wps_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE CASCADE,
  batch_reference VARCHAR(50) NOT NULL, -- e.g. WPS-SA-2026-0001
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  total_salaries NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  employee_count INT NOT NULL DEFAULT 0,
  file_format VARCHAR(20) NOT NULL CHECK (file_format IN ('sif', 'txt', 'csv', 'cbe_card')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'validated', 'exported', 'submitted', 'rejected')),
  validation_passed BOOLEAN NOT NULL DEFAULT false,
  validation_errors_count INT NOT NULL DEFAULT 0,
  file_storage_path TEXT,
  generated_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  exported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_wps_batch_reference UNIQUE (company_id, batch_reference)
);

-- 9. WPS BATCH EMPLOYEE RECORDS
CREATE TABLE IF NOT EXISTS wps_batch_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES wps_batches(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  national_or_resident_id VARCHAR(50) NOT NULL,
  iban VARCHAR(50) NOT NULL,
  bank_code VARCHAR(20) NOT NULL,
  basic_salary NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  housing_allowance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  other_allowances NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  deductions NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  net_salary NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  validation_status VARCHAR(20) NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'warning', 'blocked')),
  validation_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 10. PUBLIC HOLIDAY CALENDARS
CREATE TABLE IF NOT EXISTS public_holiday_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE CASCADE,
  year_val INT NOT NULL,
  holiday_name_ar VARCHAR(255) NOT NULL,
  holiday_name_en VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  day_count INT NOT NULL DEFAULT 1,
  is_religious BOOLEAN NOT NULL DEFAULT false,
  source_decree VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('tentative', 'confirmed', 'amended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 11. STATUTORY COMPLIANCE PRE-CLOSE CHECKS
CREATE TABLE IF NOT EXISTS statutory_compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE CASCADE,
  rule_group VARCHAR(50) NOT NULL,
  check_type VARCHAR(20) NOT NULL CHECK (check_type IN ('BLOCK', 'WARNING', 'INFO')),
  check_code VARCHAR(100) NOT NULL,
  title_ar VARCHAR(255) NOT NULL,
  title_en VARCHAR(255) NOT NULL,
  message_ar TEXT NOT NULL,
  affected_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 12. STATUTORY OVERRIDES AUDIT TRAIL
CREATE TABLE IF NOT EXISTS statutory_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL REFERENCES country_packs(country_code) ON DELETE CASCADE,
  rule_group VARCHAR(50) NOT NULL,
  period_date DATE NOT NULL,
  original_amount NUMERIC(14, 2) NOT NULL,
  overridden_amount NUMERIC(14, 2) NOT NULL,
  override_reason TEXT NOT NULL,
  authorized_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE & SECURITY
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_country_packs_active ON country_packs(is_active);
CREATE INDEX IF NOT EXISTS idx_statutory_rule_sets_country ON statutory_rule_sets(country_code, status, effective_from);
CREATE INDEX IF NOT EXISTS idx_statutory_rules_lookup ON statutory_rules(country_code, rule_group, status);
CREATE INDEX IF NOT EXISTS idx_employee_statutory_profiles_emp ON employee_statutory_profiles(company_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_wps_batches_company ON wps_batches(company_id, country_code, period_start);
CREATE INDEX IF NOT EXISTS idx_public_holiday_calendars ON public_holiday_calendars(country_code, year_val);
CREATE INDEX IF NOT EXISTS idx_statutory_compliance_checks ON statutory_compliance_checks(company_id, payroll_run_id);

-- ============================================================================
-- SEED CANONICAL COUNTRY PACKS & VERIFIED SOURCES
-- ============================================================================

INSERT INTO country_packs (country_code, country_name_ar, country_name_en, currency_code, wps_supported, income_tax_supported, social_insurance_supported)
VALUES
  ('EG', 'جمهورية مصر العربية', 'Arab Republic of Egypt', 'EGP', true, true, true),
  ('SA', 'المملكة العربية السعودية', 'Kingdom of Saudi Arabia', 'SAR', true, false, true),
  ('QA', 'دولة قطر', 'State of Qatar', 'QAR', true, false, true),
  ('OM', 'سلطنة عمان', 'Sultanate of Oman', 'OMR', true, false, true),
  ('BH', 'مملكة البحرين', 'Kingdom of Bahrain', 'BHD', true, false, true)
ON CONFLICT (country_code) DO UPDATE
SET
  country_name_ar = EXCLUDED.country_name_ar,
  country_name_en = EXCLUDED.country_name_en,
  currency_code = EXCLUDED.currency_code,
  wps_supported = EXCLUDED.wps_supported,
  income_tax_supported = EXCLUDED.income_tax_supported,
  social_insurance_supported = EXCLUDED.social_insurance_supported;

-- Seed Legal Sources
INSERT INTO statutory_rule_sources (country_code, source_code, authority_name_ar, authority_name_en, title_ar, title_en, publication_ref, effective_from)
VALUES
  -- Egypt
  ('EG', 'EG_NOSI_LAW_148', 'الهيئة القومية للتأمين الاجتماعي', 'National Organization for Social Insurance', 'قانون التأمينات الاجتماعية والمعاشات', 'Social Insurance and Pensions Law', 'Law No. 148 of 2019', '2020-01-01'),
  ('EG', 'EG_ETA_LAW_7', 'مصلحة الضرائب المصرية', 'Egyptian Tax Authority', 'تعديلات قانون الضريبة على الدخل', 'Income Tax Law Amendments', 'Law No. 7 of 2024', '2024-03-01'),
  ('EG', 'EG_MOL_LAW_12', 'وزارة العمل المصرية', 'Ministry of Labour', 'قانون العمل المصري الموحد', 'Unified Egyptian Labor Law', 'Law No. 12 of 2003', '2003-07-01'),
  -- Saudi Arabia
  ('SA', 'SA_GOSI_RD_M33', 'المؤسسة العامة للتأمينات الاجتماعية', 'General Organization for Social Insurance', 'نظام التأمينات الاجتماعية ولوائح ساند', 'Social Insurance Law & SANED', 'Royal Decree No. M/33', '2000-11-29'),
  ('SA', 'SA_MHRSD_RD_M51', 'وزارة الموارد البشرية والتنمية الاجتماعية', 'Ministry of Human Resources and Social Development', 'نظام العمل السعودي ولوائحه التنفيذية', 'Saudi Labor Law', 'Royal Decree No. M/51', '2006-04-23'),
  ('SA', 'SA_SAMA_MUDAD_WPS', 'البنك المركزي السعودي ومنصة مدد', 'SAMA & Mudad WPS', 'ضوابط نظام حماية الأجور السعودي', 'Wage Protection System Regulations', 'MHRSD Ministerial Resolution 2020', '2020-10-01'),
  -- Qatar
  ('QA', 'QA_GRSIA_LAW_1', 'الهيئة العامة للتقاعد والتأمينات الاجتماعية', 'General Retirement and Social Insurance Authority', 'قانون التأمينات الاجتماعية القطري', 'Qatar Social Insurance Law', 'Law No. 1 of 2022', '2023-01-03'),
  ('QA', 'QA_MOL_LAW_14', 'وزارة العمل القطرية', 'Ministry of Labour', 'قانون العمل القطري وتعديلاته', 'Qatar Labor Law', 'Law No. 14 of 2004', '2004-05-19'),
  ('QA', 'QA_QCB_WPS', 'مصرف قطر المركزي ووزارة العمل', 'Qatar Central Bank & Ministry of Labour', 'نظام حماية الأجور SIF', 'Wage Protection System SIF Standard', 'Law No. 1 of 2015', '2015-11-02'),
  -- Oman
  ('OM', 'OM_SPF_RD_52', 'صندوق الحماية الاجتماعية', 'Social Protection Fund', 'قانون الحماية الاجتماعية العماني', 'Oman Social Protection Law', 'Royal Decree No. 52/2023', '2024-01-01'),
  ('OM', 'OM_MOL_RD_53', 'وزارة العمل سلطنة عمان', 'Ministry of Labour', 'قانون العمل العماني الجديد', 'Oman Labor Law', 'Royal Decree No. 53/2023', '2023-07-31'),
  -- Bahrain
  ('BH', 'BH_SIO_LAW_24', 'الهيئة العامة للتأمين الاجتماعي', 'Social Insurance Organization', 'قانون التأمين الاجتماعي وقانون التأمين ضد التعطل', 'Social Insurance Law & Unemployment Law', 'Law No. 24 of 1976 & Law 78/2006', '2006-12-01'),
  ('BH', 'BH_LMRA_LAW_36', 'هيئة تنظيم سوق العمل ووزارة العمل', 'LMRA & Ministry of Labour', 'قانون العمل في القطاع الأهلي ونظام حماية الأجور', 'Private Sector Labor Law & WPS', 'Law No. 36 of 2012', '2012-09-02')
ON CONFLICT (country_code, source_code) DO NOTHING;

-- Seed Rule Sets for 2024-2026
INSERT INTO statutory_rule_sets (country_code, version_code, version_name_ar, version_name_en, effective_from, status)
VALUES
  ('EG', 'EG-2024-V1', 'حزمة القوانين والضرائب المصرية 2024-2026', 'Egypt Statutory & Tax Pack 2024-2026', '2024-01-01', 'active'),
  ('SA', 'SA-2024-V1', 'حزمة التأمينات وحماية الأجور السعودية 2024-2026', 'Saudi Statutory & GOSI Pack 2024-2026', '2024-01-01', 'active'),
  ('QA', 'QA-2024-V1', 'حزمة العمل والتقاعد وحماية الأجور القطرية 2024-2026', 'Qatar Statutory & WPS Pack 2024-2026', '2024-01-01', 'active'),
  ('OM', 'OM-2024-V1', 'حزمة الحماية الاجتماعية وقانون العمل العماني 2024-2026', 'Oman Social Protection Pack 2024-2026', '2024-01-01', 'active'),
  ('BH', 'BH-2024-V1', 'حزمة التأمينات وحماية الأجور البحرينية 2024-2026', 'Bahrain SIO & Labor Pack 2024-2026', '2024-01-01', 'active')
ON CONFLICT (country_code, version_code) DO NOTHING;

-- Seed Social Insurance Profiles
-- Egypt: 11% employee, 18.75% employer, min 2000, max 12600. Martyrs fund 0.05% employee, Emergency fund 1% employer.
INSERT INTO social_insurance_profiles (rule_set_id, country_code, profile_code, name_ar, name_en, target_citizenship, employee_rate, employer_rate, min_wage_basis, max_wage_basis, special_deduction_rate, special_employer_rate)
SELECT id, 'EG', 'EG_NOSI_STD', 'التأمينات الاجتماعية المصرية العامة', 'Egypt NOSI Standard', 'all', 0.1100, 0.1875, 2000.00, 12600.00, 0.0005, 0.0100
FROM statutory_rule_sets WHERE version_code = 'EG-2024-V1';

-- Saudi Arabia: Saudi 9.75% emp (9% pension + 0.75% saned), 11.75% emplyr (9% pension + 0.75% saned + 2% hazards). Max 45000, min 1500. Non-Saudi: 2% hazards employer only.
INSERT INTO social_insurance_profiles (rule_set_id, country_code, profile_code, name_ar, name_en, target_citizenship, employee_rate, employer_rate, min_wage_basis, max_wage_basis, special_deduction_rate, special_employer_rate)
SELECT id, 'SA', 'SA_GOSI_NAT', 'تأمينات اجتماعية سعوديين (معاشات + ساند + مخاطر)', 'Saudi National GOSI + SANED', 'national', 0.0975, 0.1175, 1500.00, 45000.00, 0.0000, 0.0000
FROM statutory_rule_sets WHERE version_code = 'SA-2024-V1';

INSERT INTO social_insurance_profiles (rule_set_id, country_code, profile_code, name_ar, name_en, target_citizenship, employee_rate, employer_rate, min_wage_basis, max_wage_basis, special_deduction_rate, special_employer_rate)
SELECT id, 'SA', 'SA_GOSI_EXP', 'أخطار مهنية لغير السعوديين', 'Non-Saudi Occupational Hazards', 'non_national', 0.0000, 0.0200, 400.00, 45000.00, 0.0000, 0.0000
FROM statutory_rule_sets WHERE version_code = 'SA-2024-V1';

-- Qatar: Qatari 7% emp, 14% emplyr. Non-Qatari 0%.
INSERT INTO social_insurance_profiles (rule_set_id, country_code, profile_code, name_ar, name_en, target_citizenship, employee_rate, employer_rate, min_wage_basis, max_wage_basis, special_deduction_rate, special_employer_rate)
SELECT id, 'QA', 'QA_GRSIA_NAT', 'صندوق التقاعد للمواطنين القطريين', 'Qatar GRSIA National Pension', 'national', 0.0700, 0.1400, 1000.00, NULL, 0.0000, 0.0000
FROM statutory_rule_sets WHERE version_code = 'QA-2024-V1';

-- Oman: Omani 8% emp, 14% emplyr (cap 3000 OMR). Non-Omani 1% work injury employer.
INSERT INTO social_insurance_profiles (rule_set_id, country_code, profile_code, name_ar, name_en, target_citizenship, employee_rate, employer_rate, min_wage_basis, max_wage_basis, special_deduction_rate, special_employer_rate)
SELECT id, 'OM', 'OM_SPF_NAT', 'صندوق الحماية الاجتماعية للعمانيين', 'Oman SPF National Scheme', 'national', 0.0800, 0.1400, 100.00, 3000.00, 0.0000, 0.0000
FROM statutory_rule_sets WHERE version_code = 'OM-2024-V1';

INSERT INTO social_insurance_profiles (rule_set_id, country_code, profile_code, name_ar, name_en, target_citizenship, employee_rate, employer_rate, min_wage_basis, max_wage_basis, special_deduction_rate, special_employer_rate)
SELECT id, 'OM', 'OM_SPF_EXP', 'إصابات العمل لغير العمانيين', 'Non-Omani Work Injury', 'non_national', 0.0000, 0.0100, 50.00, 3000.00, 0.0000, 0.0000
FROM statutory_rule_sets WHERE version_code = 'OM-2024-V1';

-- Bahrain: Bahraini 8% emp, 16% emplyr (cap 4000 BHD). Non-Bahraini: 1% emp, 3% emplyr.
INSERT INTO social_insurance_profiles (rule_set_id, country_code, profile_code, name_ar, name_en, target_citizenship, employee_rate, employer_rate, min_wage_basis, max_wage_basis, special_deduction_rate, special_employer_rate)
SELECT id, 'BH', 'BH_SIO_NAT', 'التأمينات الاجتماعية للبحرينيين + التعطل', 'Bahrain SIO National + Unemployment', 'national', 0.0800, 0.1600, 100.00, 4000.00, 0.0000, 0.0000
FROM statutory_rule_sets WHERE version_code = 'BH-2024-V1';

INSERT INTO social_insurance_profiles (rule_set_id, country_code, profile_code, name_ar, name_en, target_citizenship, employee_rate, employer_rate, min_wage_basis, max_wage_basis, special_deduction_rate, special_employer_rate)
SELECT id, 'BH', 'BH_SIO_EXP', 'إصابات العمل والتأمين ضد التعطل للوافدين', 'Non-Bahraini Work Injury + Unemployment', 'non_national', 0.0100, 0.0300, 50.00, 4000.00, 0.0000, 0.0000
FROM statutory_rule_sets WHERE version_code = 'BH-2024-V1';

-- Seed Egypt Tax Brackets (Law 7 of 2024: Exemption 20,000 + Brackets up to 1,200,000+)
INSERT INTO statutory_tax_brackets (rule_set_id, country_code, bracket_order, lower_bound, upper_bound, rate_percentage, fixed_base_tax)
SELECT id, 'EG', 1, 0.00, 40000.00, 0.0000, 0.00 FROM statutory_rule_sets WHERE version_code = 'EG-2024-V1';
INSERT INTO statutory_tax_brackets (rule_set_id, country_code, bracket_order, lower_bound, upper_bound, rate_percentage, fixed_base_tax)
SELECT id, 'EG', 2, 40000.00, 55000.00, 0.1000, 0.00 FROM statutory_rule_sets WHERE version_code = 'EG-2024-V1';
INSERT INTO statutory_tax_brackets (rule_set_id, country_code, bracket_order, lower_bound, upper_bound, rate_percentage, fixed_base_tax)
SELECT id, 'EG', 3, 55000.00, 70000.00, 0.1500, 1500.00 FROM statutory_rule_sets WHERE version_code = 'EG-2024-V1';
INSERT INTO statutory_tax_brackets (rule_set_id, country_code, bracket_order, lower_bound, upper_bound, rate_percentage, fixed_base_tax)
SELECT id, 'EG', 4, 70000.00, 200000.00, 0.2000, 3750.00 FROM statutory_rule_sets WHERE version_code = 'EG-2024-V1';
INSERT INTO statutory_tax_brackets (rule_set_id, country_code, bracket_order, lower_bound, upper_bound, rate_percentage, fixed_base_tax)
SELECT id, 'EG', 5, 200000.00, 400000.00, 0.2250, 29750.00 FROM statutory_rule_sets WHERE version_code = 'EG-2024-V1';
INSERT INTO statutory_tax_brackets (rule_set_id, country_code, bracket_order, lower_bound, upper_bound, rate_percentage, fixed_base_tax)
SELECT id, 'EG', 6, 400000.00, 1200000.00, 0.2500, 74750.00 FROM statutory_rule_sets WHERE version_code = 'EG-2024-V1';
INSERT INTO statutory_tax_brackets (rule_set_id, country_code, bracket_order, lower_bound, upper_bound, rate_percentage, fixed_base_tax)
SELECT id, 'EG', 7, 1200000.00, NULL, 0.2750, 274750.00 FROM statutory_rule_sets WHERE version_code = 'EG-2024-V1';

-- Seed Public Holidays 2026 for all 5 countries
INSERT INTO public_holiday_calendars (country_code, year_val, holiday_name_ar, holiday_name_en, start_date, end_date, day_count, is_religious, source_decree)
VALUES
  -- Egypt
  ('EG', 2026, 'عيد الفطر المبارك', 'Eid Al-Fitr', '2026-03-20', '2026-03-23', 4, true, 'رئاسة مجلس الوزراء المصري'),
  ('EG', 2026, 'عيد الأضحى المبارك', 'Eid Al-Adha', '2026-05-27', '2026-05-31', 5, true, 'رئاسة مجلس الوزراء المصري'),
  ('EG', 2026, 'عيد ثورة 23 يوليو', 'Revolution Day', '2026-07-23', '2026-07-23', 1, false, 'قرار وزاري رسمي'),
  ('EG', 2026, 'عيد القوات المسلحة (6 أكتوبر)', 'Armed Forces Day', '2026-10-06', '2026-10-06', 1, false, 'قرار وزاري رسمي'),
  -- Saudi Arabia
  ('SA', 2026, 'يوم التأسيس السعودي', 'Saudi Founding Day', '2026-02-22', '2026-02-22', 1, false, 'أمر ملكي أ/371'),
  ('SA', 2026, 'عيد الفطر المبارك', 'Eid Al-Fitr', '2026-03-20', '2026-03-24', 5, true, 'وزارة الموارد البشرية'),
  ('SA', 2026, 'عيد الأضحى المبارك', 'Eid Al-Adha', '2026-05-27', '2026-05-31', 5, true, 'وزارة الموارد البشرية'),
  ('SA', 2026, 'اليوم الوطني للمملكة', 'Saudi National Day', '2026-09-23', '2026-09-23', 1, false, 'مرسوم ملكي'),
  -- Qatar
  ('QA', 2026, 'اليوم الرياضي للدولة', 'National Sports Day', '2026-02-10', '2026-02-10', 1, false, 'مرسوم أميري رقم 80/2011'),
  ('QA', 2026, 'عيد الفطر المبارك', 'Eid Al-Fitr', '2026-03-20', '2026-03-23', 4, true, 'الديوان الأميري القطري'),
  ('QA', 2026, 'عيد الأضحى المبارك', 'Eid Al-Adha', '2026-05-27', '2026-05-30', 4, true, 'الديوان الأميري القطري'),
  ('QA', 2026, 'اليوم الوطني لدولة قطر', 'Qatar National Day', '2026-12-18', '2026-12-18', 1, false, 'قانون رقم 11 لسنة 2007'),
  -- Oman
  ('OM', 2026, 'يوم تولي السلطان مقاليد الحكم', 'Sultan Accession Day', '2026-01-11', '2026-01-11', 1, false, 'أوامر سامية'),
  ('OM', 2026, 'عيد الفطر المبارك', 'Eid Al-Fitr', '2026-03-20', '2026-03-23', 4, true, 'وزارة العمل العمانية'),
  ('OM', 2026, 'عيد الأضحى المبارك', 'Eid Al-Adha', '2026-05-27', '2026-05-30', 4, true, 'وزارة العمل العمانية'),
  ('OM', 2026, 'اليوم الوطني لسلطنة عمان', 'Oman National Day', '2026-11-18', '2026-11-19', 2, false, 'مرسوم سلطاني 88/2022'),
  -- Bahrain
  ('BH', 2026, 'عيد العمال العالمي', 'Labour Day', '2026-05-01', '2026-05-01', 1, false, 'وزارة العمل البحرين'),
  ('BH', 2026, 'عيد الفطر المبارك', 'Eid Al-Fitr', '2026-03-20', '2026-03-22', 3, true, 'ديوان الخدمة المدنية البحرين'),
  ('BH', 2026, 'عيد الأضحى المبارك', 'Eid Al-Adha', '2026-05-27', '2026-05-29', 3, true, 'ديوان الخدمة المدنية البحرين'),
  ('BH', 2026, 'اليوم الوطني لمملكة البحرين', 'Bahrain National Day', '2026-12-16', '2026-12-17', 2, false, 'مرسوم ملكي');

-- ============================================================================
-- 13. ATOMIC STATUTORY PROCEDURES
-- ============================================================================

-- A. SOCIAL INSURANCE CALCULATION ENGINE
CREATE OR REPLACE FUNCTION calculate_statutory_social_insurance_atomic(
  p_country_code VARCHAR(2),
  p_is_national BOOLEAN,
  p_gross_wage NUMERIC,
  p_basic_wage NUMERIC,
  p_effective_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile social_insurance_profiles%ROWTYPE;
  v_insurable_wage NUMERIC;
  v_employee_contrib NUMERIC := 0.00;
  v_employer_contrib NUMERIC := 0.00;
  v_special_emp_deduction NUMERIC := 0.00;
  v_special_emplyr_cost NUMERIC := 0.00;
  v_target_category VARCHAR(20);
BEGIN
  v_target_category := CASE WHEN p_is_national THEN 'national' ELSE 'non_national' END;

  -- Locate matching profile from active rule set
  SELECT sip.* INTO v_profile
  FROM social_insurance_profiles sip
  JOIN statutory_rule_sets srs ON srs.id = sip.rule_set_id
  WHERE sip.country_code = p_country_code
    AND (sip.target_citizenship = v_target_category OR sip.target_citizenship = 'all')
    AND srs.status = 'active'
    AND srs.effective_from <= p_effective_date
    AND (srs.effective_to IS NULL OR srs.effective_to >= p_effective_date)
  ORDER BY srs.effective_from DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'country_code', p_country_code,
      'insurable_wage', 0.00,
      'employee_contribution', 0.00,
      'employer_contribution', 0.00,
      'special_deductions', 0.00,
      'total_deduction', 0.00,
      'rule_profile', 'NONE_APPLICABLE'
    );
  END IF;

  -- Determine insurable wage basis
  v_insurable_wage := COALESCE(p_gross_wage, p_basic_wage, 0.00);

  -- Apply min basis floor
  IF v_insurable_wage < v_profile.min_wage_basis THEN
    v_insurable_wage := v_profile.min_wage_basis;
  END IF;

  -- Apply max basis ceiling if present
  IF v_profile.max_wage_basis IS NOT NULL AND v_insurable_wage > v_profile.max_wage_basis THEN
    v_insurable_wage := v_profile.max_wage_basis;
  END IF;

  -- Calculate contributions
  v_employee_contrib := ROUND(v_insurable_wage * v_profile.employee_rate, 2);
  v_employer_contrib := ROUND(v_insurable_wage * v_profile.employer_rate, 2);
  v_special_emp_deduction := ROUND(v_insurable_wage * v_profile.special_deduction_rate, 2);
  v_special_emplyr_cost := ROUND(v_insurable_wage * v_profile.special_employer_rate, 2);

  RETURN jsonb_build_object(
    'ok', true,
    'country_code', p_country_code,
    'profile_code', v_profile.profile_code,
    'profile_name_ar', v_profile.name_ar,
    'profile_name_en', v_profile.name_en,
    'insurable_wage', v_insurable_wage,
    'employee_rate', v_profile.employee_rate,
    'employer_rate', v_profile.employer_rate,
    'employee_contribution', v_employee_contrib,
    'employer_contribution', v_employer_contrib,
    'special_deductions', v_special_emp_deduction,
    'special_employer_cost', v_special_emplyr_cost,
    'total_deduction', (v_employee_contrib + v_special_emp_deduction)
  );
END;
$$;

-- B. INCOME TAX CALCULATION ENGINE (PROGRESSIVE BRACKETS)
CREATE OR REPLACE FUNCTION calculate_statutory_income_tax_atomic(
  p_country_code VARCHAR(2),
  p_monthly_taxable_earnings NUMERIC,
  p_effective_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule_set_id UUID;
  v_annual_earnings NUMERIC;
  v_personal_exemption NUMERIC := 0.00;
  v_net_annual_taxable NUMERIC := 0.00;
  v_total_annual_tax NUMERIC := 0.00;
  v_bracket RECORD;
  v_taxable_in_bracket NUMERIC;
  v_monthly_tax NUMERIC := 0.00;
BEGIN
  IF p_country_code != 'EG' THEN
    -- SA, QA, OM, BH have 0% personal employment tax
    RETURN jsonb_build_object(
      'ok', true,
      'country_code', p_country_code,
      'taxable_earnings_monthly', p_monthly_taxable_earnings,
      'annual_taxable_income', 0.00,
      'annual_tax', 0.00,
      'monthly_tax', 0.00,
      'effective_rate', 0.00,
      'notes', 'No personal payroll income tax in this jurisdiction'
    );
  END IF;

  -- Egypt: Law 7 of 2024 (20,000 annual personal exemption)
  v_personal_exemption := 20000.00;
  v_annual_earnings := COALESCE(p_monthly_taxable_earnings, 0.00) * 12.0;

  v_net_annual_taxable := v_annual_earnings - v_personal_exemption;
  IF v_net_annual_taxable <= 0.00 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'country_code', 'EG',
      'annual_earnings', v_annual_earnings,
      'personal_exemption', v_personal_exemption,
      'net_annual_taxable', 0.00,
      'annual_tax', 0.00,
      'monthly_tax', 0.00,
      'effective_rate', 0.00
    );
  END IF;

  -- Fetch active rule set
  SELECT id INTO v_rule_set_id
  FROM statutory_rule_sets
  WHERE country_code = 'EG' AND status = 'active'
    AND effective_from <= p_effective_date
    AND (effective_to IS NULL OR effective_to >= p_effective_date)
  ORDER BY effective_from DESC
  LIMIT 1;

  -- Iterate brackets
  FOR v_bracket IN
    SELECT * FROM statutory_tax_brackets
    WHERE rule_set_id = v_rule_set_id
    ORDER BY bracket_order ASC
  LOOP
    IF v_net_annual_taxable > v_bracket.lower_bound THEN
      IF v_bracket.upper_bound IS NULL OR v_net_annual_taxable <= v_bracket.upper_bound THEN
        v_taxable_in_bracket := v_net_annual_taxable - v_bracket.lower_bound;
      ELSE
        v_taxable_in_bracket := v_bracket.upper_bound - v_bracket.lower_bound;
      END IF;
      v_total_annual_tax := v_total_annual_tax + (v_taxable_in_bracket * v_bracket.rate_percentage);
    END IF;
  END LOOP;

  v_monthly_tax := ROUND(v_total_annual_tax / 12.0, 2);

  RETURN jsonb_build_object(
    'ok', true,
    'country_code', 'EG',
    'monthly_earnings', p_monthly_taxable_earnings,
    'annual_earnings', v_annual_earnings,
    'personal_exemption', v_personal_exemption,
    'net_annual_taxable', v_net_annual_taxable,
    'annual_tax', ROUND(v_total_annual_tax, 2),
    'monthly_tax', v_monthly_tax,
    'effective_rate', CASE WHEN v_annual_earnings > 0 THEN ROUND((v_total_annual_tax / v_annual_earnings) * 100.0, 2) ELSE 0.00 END
  );
END;
$$;

-- C. STATUTORY END OF SERVICE (EOS) ENGINE FOR ALL 5 COUNTRIES
CREATE OR REPLACE FUNCTION calculate_statutory_eos_atomic(
  p_country_code VARCHAR(2),
  p_service_start DATE,
  p_service_end DATE,
  p_unpaid_days INT DEFAULT 0,
  p_last_wage NUMERIC DEFAULT 0.00,
  p_separation_type VARCHAR(50) DEFAULT 'termination_by_employer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days_total INT;
  v_net_days INT;
  v_years_decimal NUMERIC;
  v_base_eos NUMERIC := 0.00;
  v_final_eos NUMERIC := 0.00;
  v_multiplier NUMERIC := 1.0;
  v_rule_desc TEXT;
BEGIN
  IF p_service_end < p_service_start THEN
    RAISE EXCEPTION 'Service end date cannot precede start date';
  END IF;

  v_days_total := (p_service_end - p_service_start);
  v_net_days := v_days_total - COALESCE(p_unpaid_days, 0);
  IF v_net_days < 0 THEN v_net_days := 0; END IF;
  v_years_decimal := EXTRACT(YEAR FROM age(p_service_end, p_service_start))
    + (EXTRACT(MONTH FROM age(p_service_end, p_service_start)) / 12.0)
    + (GREATEST(0, EXTRACT(DAY FROM age(p_service_end, p_service_start)) - COALESCE(p_unpaid_days, 0)) / 365.25);

  CASE p_country_code
    WHEN 'SA' THEN
      -- Saudi Labor Law Art 84 & 85
      -- First 5 years: 0.5 month per year; beyond 5 years: 1 month per year
      IF v_years_decimal <= 5.0 THEN
        v_base_eos := v_years_decimal * (p_last_wage * 0.5);
      ELSE
        v_base_eos := (5.0 * (p_last_wage * 0.5)) + ((v_years_decimal - 5.0) * p_last_wage);
      END IF;
      -- Resignation scale
      IF p_separation_type = 'resignation' THEN
        IF v_years_decimal < 2.0 THEN
          v_multiplier := 0.0;
        ELSIF v_years_decimal < 5.0 THEN
          v_multiplier := 0.3333;
        ELSIF v_years_decimal < 10.0 THEN
          v_multiplier := 0.6667;
        ELSE
          v_multiplier := 1.0;
        END IF;
      END IF;
      v_rule_desc := 'Saudi Labor Law (Articles 84 & 85)';

    WHEN 'EG' THEN
      -- Egypt Labor Law Art 126 (At age 60: 0.5 month first 5 yrs, 1 month thereafter)
      IF v_years_decimal <= 5.0 THEN
        v_base_eos := v_years_decimal * (p_last_wage * 0.5);
      ELSE
        v_base_eos := (5.0 * (p_last_wage * 0.5)) + ((v_years_decimal - 5.0) * p_last_wage);
      END IF;
      v_multiplier := 1.0;
      v_rule_desc := 'Egypt Labor Law 12/2003 (Article 126)';

    WHEN 'QA' THEN
      -- Qatar Labor Law Art 54: Min 3 weeks (0.5769 month) basic wage per year
      v_base_eos := v_years_decimal * (p_last_wage * (21.0 / 30.0));
      IF p_separation_type = 'resignation' AND v_years_decimal < 2.0 THEN
        v_multiplier := 0.0;
      ELSE
        v_multiplier := 1.0;
      END IF;
      v_rule_desc := 'Qatar Labor Law 14/2004 (Article 54)';

    WHEN 'OM' THEN
      -- Oman Labor Law (RD 53/2023 Art 61): 1 full month basic salary per year
      v_base_eos := v_years_decimal * p_last_wage;
      v_multiplier := 1.0;
      v_rule_desc := 'Oman Labor Law RD 53/2023 (Article 61)';

    WHEN 'BH' THEN
      -- Bahrain Labor Law Art 116: 0.5 month per year for first 3 years, 1 month thereafter
      IF v_years_decimal <= 3.0 THEN
        v_base_eos := v_years_decimal * (p_last_wage * 0.5);
      ELSE
        v_base_eos := (3.0 * (p_last_wage * 0.5)) + ((v_years_decimal - 3.0) * p_last_wage);
      END IF;
      v_multiplier := 1.0;
      v_rule_desc := 'Bahrain Labor Law 36/2012 (Article 116)';

    ELSE
      v_base_eos := v_years_decimal * (p_last_wage * 0.5);
      v_rule_desc := 'Generic Standard EOS';
  END CASE;

  v_final_eos := ROUND(v_base_eos * v_multiplier, 2);

  RETURN jsonb_build_object(
    'ok', true,
    'country_code', p_country_code,
    'rule_reference', v_rule_desc,
    'service_years_decimal', v_years_decimal,
    'net_service_days', v_net_days,
    'last_wage_basis', p_last_wage,
    'base_eos', ROUND(v_base_eos, 2),
    'resignation_multiplier', v_multiplier,
    'final_eos_amount', v_final_eos
  );
END;
$$;

-- D. PRE-CLOSE COMPLIANCE CHECK FOR MULTI-COUNTRY PAYROLL
CREATE OR REPLACE FUNCTION run_payroll_preclose_compliance_check_atomic(
  p_company_id UUID,
  p_payroll_run_id UUID,
  p_country_code VARCHAR(2)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_missing_ids INT := 0;
  v_missing_ibans INT := 0;
  v_zero_salary_count INT := 0;
  v_missing_profiles INT := 0;
  v_results JSONB := '[]'::jsonb;
BEGIN
  -- Delete prior checks for this payroll run
  DELETE FROM statutory_compliance_checks
  WHERE company_id = p_company_id AND payroll_run_id = p_payroll_run_id;

  -- 1. Check missing IBANs (Hard blocker for WPS)
  SELECT COUNT(*) INTO v_missing_ibans
  FROM payroll_details pd
  JOIN employees e ON e.id = pd.employee_id
  WHERE pd.payroll_run_id = p_payroll_run_id
    AND (e.iban IS NULL OR LENGTH(TRIM(e.iban)) < 15);

  IF v_missing_ibans > 0 THEN
    INSERT INTO statutory_compliance_checks (company_id, payroll_run_id, country_code, rule_group, check_type, check_code, title_ar, title_en, message_ar, affected_count)
    VALUES (p_company_id, p_payroll_run_id, p_country_code, 'wps', 'BLOCK', 'WPS_MISSING_IBAN',
      'حسابات بنكية / IBAN غير مكتملة', 'Missing Bank IBANs for WPS',
      'يوجد موظفون مدرجون في مسير الرواتب لا يملكون رقم آيبان بنكي معتمد، وهو شرط إلزامي لتوليد ملف حماية الأجور.', v_missing_ibans);
  END IF;

  -- 2. Check missing National/Residency/CPR/QID IDs
  SELECT COUNT(*) INTO v_missing_ids
  FROM payroll_details pd
  JOIN employees e ON e.id = pd.employee_id
  WHERE pd.payroll_run_id = p_payroll_run_id
    AND (e.national_id IS NULL OR LENGTH(TRIM(e.national_id)) < 8);

  IF v_missing_ids > 0 THEN
    INSERT INTO statutory_compliance_checks (company_id, payroll_run_id, country_code, rule_group, check_type, check_code, title_ar, title_en, message_ar, affected_count)
    VALUES (p_company_id, p_payroll_run_id, p_country_code, 'statutory_identifiers', 'BLOCK', 'STAT_ID_MISSING',
      'أرقام الهوية / الإقامة مفقودة', 'Missing National / Residency Identifiers',
      'يوجد موظفون بدون رقم هوية وطنية أو إقامة أو رقم مدني رسمي.', v_missing_ids);
  END IF;

  -- 3. Check zero or negative net salaries (Warning)
  SELECT COUNT(*) INTO v_zero_salary_count
  FROM payroll_details pd
  WHERE pd.payroll_run_id = p_payroll_run_id AND pd.net_salary <= 0;

  IF v_zero_salary_count > 0 THEN
    INSERT INTO statutory_compliance_checks (company_id, payroll_run_id, country_code, rule_group, check_type, check_code, title_ar, title_en, message_ar, affected_count)
    VALUES (p_company_id, p_payroll_run_id, p_country_code, 'social_insurance', 'WARNING', 'PAYROLL_ZERO_NET',
      'صافي راتب صفري أو سالب', 'Zero or Negative Net Salary',
      'تم رصد استقطاعات تفوق إجمالي الراتب لبعض الموظفين مما قد يرفضه نظام حماية الأجور.', v_zero_salary_count);
  END IF;

  -- Return list of checks
  SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb) INTO v_results
  FROM statutory_compliance_checks c
  WHERE c.company_id = p_company_id AND c.payroll_run_id = p_payroll_run_id;

  RETURN jsonb_build_object(
    'ok', true,
    'country_code', p_country_code,
    'total_checks', jsonb_array_length(v_results),
    'blocks_count', (SELECT COUNT(*) FROM statutory_compliance_checks WHERE company_id = p_company_id AND payroll_run_id = p_payroll_run_id AND check_type = 'BLOCK'),
    'warnings_count', (SELECT COUNT(*) FROM statutory_compliance_checks WHERE company_id = p_company_id AND payroll_run_id = p_payroll_run_id AND check_type = 'WARNING'),
    'checks', v_results
  );
END;
$$;

-- E. WPS BATCH GENERATION ENGINE
CREATE OR REPLACE FUNCTION generate_wps_batch_atomic(
  p_company_id UUID,
  p_payroll_run_id UUID,
  p_country_code VARCHAR(2),
  p_file_format VARCHAR(20) DEFAULT 'txt',
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id UUID;
  v_batch_ref VARCHAR(50);
  v_run RECORD;
  v_total_salaries NUMERIC := 0.00;
  v_emp_count INT := 0;
  v_error_count INT := 0;
  v_detail RECORD;
  v_val_status VARCHAR(20);
  v_val_msg TEXT;
BEGIN
  -- Verify payroll run
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_payroll_run_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll run not found for company';
  END IF;

  -- Generate sequential batch reference
  v_batch_ref := 'WPS-' || p_country_code || '-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');

  -- Create batch header
  INSERT INTO wps_batches (
    company_id, country_code, batch_reference, payroll_run_id,
    period_start, period_end, currency_code, file_format, generated_by
  )
  VALUES (
    p_company_id, p_country_code, v_batch_ref, p_payroll_run_id,
    COALESCE(v_run.period_start, CURRENT_DATE - 30),
    COALESCE(v_run.period_end, CURRENT_DATE),
    COALESCE(v_run.currency, 'SAR'),
    p_file_format, p_user_id
  )
  RETURNING id INTO v_batch_id;

  -- Process and insert each payroll detail record into WPS batch
  FOR v_detail IN
    SELECT pd.*, e.national_id, e.iban, e.bank_name
    FROM payroll_details pd
    JOIN employees e ON e.id = pd.employee_id
    WHERE pd.payroll_run_id = p_payroll_run_id
  LOOP
    v_val_status := 'valid';
    v_val_msg := NULL;

    IF v_detail.iban IS NULL OR LENGTH(TRIM(v_detail.iban)) < 15 THEN
      v_val_status := 'blocked';
      v_val_msg := 'رقم الآيبان البنكي مفقود أو غير صالح';
      v_error_count := v_error_count + 1;
    ELSIF v_detail.national_id IS NULL OR LENGTH(TRIM(v_detail.national_id)) < 8 THEN
      v_val_status := 'blocked';
      v_val_msg := 'رقم الهوية الوطنية أو الإقامة مفقود';
      v_error_count := v_error_count + 1;
    ELSIF v_detail.net_salary <= 0 THEN
      v_val_status := 'warning';
      v_val_msg := 'صافي الراتب صفري أو سالب';
    END IF;

    INSERT INTO wps_batch_records (
      batch_id, employee_id, national_or_resident_id, iban, bank_code,
      basic_salary, housing_allowance, other_allowances, deductions, net_salary,
      validation_status, validation_message
    )
    VALUES (
      v_batch_id, v_detail.employee_id,
      COALESCE(v_detail.national_id, 'UNKNOWN'),
      COALESCE(v_detail.iban, 'MISSING_IBAN'),
      COALESCE(v_detail.bank_name, 'BANK'),
      COALESCE(v_detail.basic_salary, 0.00),
      COALESCE(v_detail.housing_allowance, 0.00),
      COALESCE(v_detail.transport_allowance + v_detail.other_allowances, 0.00),
      COALESCE(v_detail.total_deductions, 0.00),
      COALESCE(v_detail.net_salary, 0.00),
      v_val_status, v_val_msg
    );

    v_total_salaries := v_total_salaries + COALESCE(v_detail.net_salary, 0.00);
    v_emp_count := v_emp_count + 1;
  END LOOP;

  -- Update batch summary
  UPDATE wps_batches
  SET
    total_salaries = v_total_salaries,
    employee_count = v_emp_count,
    validation_passed = (v_error_count = 0),
    validation_errors_count = v_error_count,
    status = CASE WHEN v_error_count = 0 THEN 'validated' ELSE 'draft' END,
    updated_at = clock_timestamp()
  WHERE id = v_batch_id;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'batch_reference', v_batch_ref,
    'employee_count', v_emp_count,
    'total_salaries', v_total_salaries,
    'validation_passed', (v_error_count = 0),
    'validation_errors_count', v_error_count
  );
END;
$$;

-- F. COUNTRY PACK DASHBOARD KPIS ENGINE
CREATE OR REPLACE FUNCTION get_country_pack_dashboard_kpis_atomic(
  p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_packs INT := 0;
  v_rule_sets_count INT := 0;
  v_total_wps_batches INT := 0;
  v_statutory_profiles_count INT := 0;
  v_pending_blocks_count INT := 0;
  v_holidays_count INT := 0;
BEGIN
  SELECT COUNT(*) INTO v_active_packs FROM country_packs WHERE is_active = true;
  SELECT COUNT(*) INTO v_rule_sets_count FROM statutory_rule_sets WHERE status = 'active';
  SELECT COUNT(*) INTO v_total_wps_batches FROM wps_batches WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_statutory_profiles_count FROM employee_statutory_profiles WHERE company_id = p_company_id;
  SELECT COUNT(*) INTO v_pending_blocks_count FROM statutory_compliance_checks WHERE company_id = p_company_id AND check_type = 'BLOCK';
  SELECT COUNT(*) INTO v_holidays_count FROM public_holiday_calendars WHERE year_val = EXTRACT(YEAR FROM CURRENT_DATE)::INT;

  RETURN jsonb_build_object(
    'active_country_packs', v_active_packs,
    'active_rule_sets', v_rule_sets_count,
    'total_wps_batches', v_total_wps_batches,
    'enrolled_statutory_profiles', v_statutory_profiles_count,
    'compliance_blocks_count', v_pending_blocks_count,
    'current_year_public_holidays', v_holidays_count
  );
END;
$$;
