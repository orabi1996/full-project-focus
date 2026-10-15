# MADARX ENTERPRISE WORKFORCE PLATFORM
# COUNTRY PACK ADMINISTRATOR RUNBOOK (PROMPT 34)

## 1. Overview
This runbook guides HR Administrators, Payroll Officers, and Compliance Officers on managing multi-country statutory packs across Egypt, Saudi Arabia, Qatar, Oman, and Bahrain.

---

## 2. Managing Country Packs & Statutory Rule Sets
1. **Accessing the Console**: Navigate to `/country-packs` via the sidebar navigation under *البيئة المؤسسية والحوكمة* or *System Setup*.
2. **Reviewing Active Rule Sets**:
   - Inspect the `statutory_rule_sets` tab.
   - Verify that each operating country has an `active` rule set version corresponding to the current legislative year (e.g., `SA-2024-V1`, `EG-2024-V1`).
3. **Four-Eyes Verification Protocol**:
   - Creating or amending statutory rules requires maker/checker workflow:
     1. **Proposal**: Payroll Officer submits draft statutory update with official decree reference and effective date.
     2. **Verification**: Compliance Officer reviews publication reference and verifies against official gazette.
     3. **Activation**: Super Admin or Authorized Legal Officer approves the rule set.

---

## 3. Payroll Pre-Close Compliance Checks
Before finalizing any payroll run:
1. Open `/country-packs` and click **فحص الامتثال للرواتب (Run Compliance Check)**.
2. The engine executes `run_payroll_preclose_compliance_check_atomic`:
   - **BLOCK**: Must be resolved before payroll finalization (e.g., Missing IBANs, missing national IDs/residency permits).
   - **WARNING**: Review items (e.g., negative/zero net salary resulting from excessive statutory deductions).
   - **INFO**: Informational notices regarding seasonal adjustments (e.g., Ramadan reduced hours).

---

## 4. Wage Protection System (WPS) Batch Generation
1. Click **توليد دفعة حماية أجور (Generate WPS Batch)**.
2. Select target jurisdiction (`SA`, `EG`, `QA`, `OM`, `BH`).
3. Choose the target payroll run and desired bank file format (`txt`, `sif`, `csv`, `cbe_card`).
4. Click **فحص وتوليد الدفعة**.
5. The system performs row-level pre-validation of all employee records, generates a unique audit reference (`WPS-XX-YYYY-XXXXXX`), and produces the bank-compliant file for secure download.
