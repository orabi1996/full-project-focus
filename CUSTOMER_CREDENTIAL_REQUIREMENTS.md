# MadarX Enterprise Workforce Platform
# Customer Credential Requirements & Provider Activation Contract
**Document Reference:** `CUSTOMER_CREDENTIAL_REQUIREMENTS.md`  
**Release Target:** `v1.0.0-enterprise`  
**Security Invariant:** Zero plaintext secrets, private keys, or actual credentials may ever be stored in repository files.

---

## 1. Overview & Security Architecture

MadarX connects to regulatory and government authorities across Egypt, Saudi Arabia, Qatar, Oman, and Bahrain using a secure, decoupled credential management model.

- **Storage Location:** All credentials and mutual TLS (mTLS) certificates are managed in secure server-side vaults (e.g., Supabase Vault, AWS Secrets Manager, or Azure Key Vault) and injected into trusted server runtimes via environment variables.
- **Client Security:** No external authority credential or government signing secret is ever transmitted to, or bundled within, the browser application.
- **Fail-Safe Invariant:** If credentials for an external authority are missing or pending verification, the corresponding connector operates in `WAITING_FOR_CUSTOMER_CREDENTIALS` mode (`fail-closed`). The core MadarX Human Capital Management, Payroll, and Attendance engines remain 100% operational without data corruption or synthetic fabrication.

---

## 2. External Provider Credential Catalog by Country

### 2.1 Saudi Arabia (`SA`)

#### 1. General Organization for Social Insurance (GOSI)
- **Country:** Saudi Arabia (`SA`)
- **Purpose:** Monthly wage declaration, contributor registration, and electronic contribution reconciliation.
- **Credentials Required:**
  - `MADARX_SA_GOSI_CLIENT_ID`: OAuth 2.0 Client ID.
  - `MADARX_SA_GOSI_CLIENT_SECRET`: OAuth 2.0 Client Secret.
  - `MADARX_SA_GOSI_MTLS_CERT_REF`: Vault reference to client digital certificate (PEM format) for mTLS.
- **Where Customer Obtains:** GOSI Business Portal (بوابة أعمال التأمينات) $\rightarrow$ Developer & Partner Integration Services.
- **Where MadarX Receives:** Tenant Admin Settings $\rightarrow$ Integrations $\rightarrow$ GOSI Connector (Server Vault Storage).
- **Test Procedure:** Dispatch pre-flight sandbox ping to GOSI sandbox endpoint using test establishment number.
- **Production Activation:** Upload verified production client certificate; execute preflight schema check; switch connector status to `connected`.

#### 2. Mudad Wage Protection System (MUDAD / مدد)
- **Country:** Saudi Arabia (`SA`)
- **Purpose:** Salary file upload, WPS compliance certification, and bank processing validation.
- **Credentials Required:**
  - `MADARX_SA_MUDAD_CLIENT_ID`: Corporate Establishment API Identifier.
  - `MADARX_SA_MUDAD_API_SECRET`: API Secret Token.
- **Where Customer Obtains:** Mudad Business Portal (منصة مدد لأنظمة الأجور).
- **Where MadarX Receives:** Tenant Admin Settings $\rightarrow$ Integrations $\rightarrow$ Mudad Connector.
- **Test Procedure:** Generate a standard test salary file (WPS CSV format) and submit to Mudad Validation Sandbox.
- **Production Activation:** Confirm corporate authorization in Mudad portal; enable automated payroll batch dispatch.

#### 3. Qiwa Platform (QIWA / قوى)
- **Country:** Saudi Arabia (`SA`)
- **Purpose:** Labor contract compliance, work permit status tracking, and Saudization (Nitaqat) monitoring.
- **Credentials Required:**
  - `MADARX_SA_QIWA_ESTABLISHMENT_TOKEN`: Secure Establishment Bearer Token.
- **Where Customer Obtains:** Ministry of Human Resources & Social Development (Qiwa Corporate Portal).
- **Where MadarX Receives:** Tenant Admin Settings $\rightarrow$ Integrations $\rightarrow$ Qiwa Connector.
- **Test Procedure:** Query sandbox employee contract status by test National ID.
- **Production Activation:** Authorize MadarX OAuth delegation on Qiwa business account; activate daily contract synchronization.

#### 4. Muqeem Portal (MUQEEM / مقيم)
- **Country:** Saudi Arabia (`SA`)
- **Purpose:** Expatriate residency (Iqama) validity tracking, visa exit/re-entry queries, and profession verification.
- **Credentials Required:**
  - `MADARX_SA_MUQEEM_PORTAL_REF`: Corporate Account Identifier & Web Service Key.
- **Where Customer Obtains:** Elm / Muqeem Business Portal.
- **Where MadarX Receives:** Tenant Admin Settings $\rightarrow$ Integrations $\rightarrow$ Muqeem Connector.
- **Test Procedure:** Run residency verification probe on test Iqama number.
- **Production Activation:** Bind corporate establishment number to live Muqeem gateway; enable weekly expiry warnings.

---

### 2.2 Egypt (`EG`)

#### 1. National Organization for Social Insurance (NOSI / الهيئة القومية للتأمين الاجتماعي)
- **Country:** Egypt (`EG`)
- **Purpose:** Form 1 (Registration), Form 2 (Annual Wage Declaration), and Form 6 (Termination) statutory filing.
- **Credentials Required:**
  - `MADARX_EG_NOSI_ESTABLISHMENT_REF`: Official Establishment Insurance Registration Number (الرقم التأميني للمنشأة).
- **Where Customer Obtains:** NOSI District Office (مكتب التأمينات الاجتماعية المختص) / Digital Insurance Portal.
- **Where MadarX Receives:** Tenant Admin Settings $\rightarrow$ Country Packs $\rightarrow$ Egypt Statutory Configuration.
- **Test Procedure:** Generate Form 2 electronic file export and validate against official NOSI schema validator.
- **Production Activation:** Register establishment number; enable automated monthly insurance deduction ledger generation.

#### 2. Egyptian Tax Authority (ETA / مصلحة الضرائب المصرية)
- **Country:** Egypt (`EG`)
- **Purpose:** Payroll tax withholding returns, e-payroll reconciliation, and Form 4 quarterly filings.
- **Credentials Required:**
  - `MADARX_EG_ETA_CLIENT_ID`: Taxpayer E-Service Client ID.
  - `MADARX_EG_ETA_CLIENT_SECRET`: Taxpayer E-Service Secret.
  - `MADARX_EG_ETA_SIGNING_CERT_REF`: Electronic Seal / Hardware Security Token (Egypt Trust or Misr Meqassa PKI token).
- **Where Customer Obtains:** Egyptian Tax Authority Electronic Portal (منظومة توحيد أسس ومعايير ضريبة الأجور والمرتبات).
- **Where MadarX Receives:** Server Secure Hardware Cryptographic Store / Secrets Manager.
- **Test Procedure:** Dispatch sample monthly payroll tax return to ETA Pre-Production Environment.
- **Production Activation:** Complete taxpayer compliance certificate enrollment; switch to live e-payroll gateway.

---

### 2.3 Qatar (`QA`)

#### 1. General Retirement & Social Insurance Authority (GRSIA / الهيئة العامة للتقاعد والتأمينات الاجتماعية)
- **Country:** Qatar (`QA`)
- **Purpose:** Qatari national pension contributions and statutory retirement declarations.
- **Credentials Required:**
  - `MADARX_QA_GRSIA_EMPLOYER_REF`: GRSIA Employer Registration Code (رقم جهة العمل).
- **Where Customer Obtains:** GRSIA Portal (بوابة جهات العمل).
- **Where MadarX Receives:** Tenant Admin Settings $\rightarrow$ Country Packs $\rightarrow$ Qatar Configuration.
- **Test Procedure:** Run preflight validation on Qatari contributor records (validate 11-digit QID format).
- **Production Activation:** Activate automated GRSIA monthly deduction file export.

#### 2. Ministry of Administrative Development, Labour and Social Affairs (MADLSA WPS / وزارة العمل)
- **Country:** Qatar (`QA`)
- **Purpose:** Wage Protection System (WPS) Standard SIF file generation and banking clearing compliance.
- **Credentials Required:**
  - `MADARX_QA_MADLSA_WPS_ESTABLISHMENT_ID`: Ministry Establishment Code (رقم قيد المنشأة).
- **Where Customer Obtains:** Qatar Central Bank (QCB) & Ministry of Labour Corporate Portal.
- **Where MadarX Receives:** Tenant Admin Settings $\rightarrow$ Payroll Settings $\rightarrow$ Qatar WPS.
- **Test Procedure:** Generate test SIF file and inspect format compliance (employer QID, currency QAR, 2-decimal precision).
- **Production Activation:** Link approved corporate clearing bank; enable one-click WPS SIF export.

---

### 2.4 Oman (`OM`)

#### 1. Social Protection Fund (SPF / صندوق الحماية الاجتماعية)
- **Country:** Oman (`OM`)
- **Purpose:** Royal Decree 52/2023 pension, work injury, and job security scheme contributions.
- **Credentials Required:**
  - `MADARX_OM_SPF_EMPLOYER_REF`: SPF Unified Employer Identifier (رقم صاحب العمل الموحد).
- **Where Customer Obtains:** SPF Electronic Portal (بوابة صندوق الحماية الاجتماعية).
- **Where MadarX Receives:** Tenant Admin Settings $\rightarrow$ Country Packs $\rightarrow$ Oman Configuration.
- **Test Procedure:** Validate employee national Civil Number (8–9 digits) and insurable wage basis.
- **Production Activation:** Enable monthly SPF contribution statement generation.

#### 2. Central Bank of Oman Wage Protection System (CBO WPS / البنك المركزي العماني)
- **Country:** Oman (`OM`)
- **Purpose:** Mandatory Wage Protection System salary transfer file generation.
- **Credentials Required:**
  - `MADARX_OM_CBO_WPS_EMPLOYER_CR`: Commercial Registration Number (السجل التجاري).
- **Where Customer Obtains:** Ministry of Commerce, Industry & Investment Promotion / Corporate Bank.
- **Where MadarX Receives:** Tenant Admin Settings $\rightarrow$ Payroll Settings $\rightarrow$ Oman WPS.
- **Test Procedure:** Generate salary transfer file with 3-decimal currency precision (`OMR`) and validate structure.
- **Production Activation:** Verify corporate sponsor bank routing code; activate live salary file export.

---

### 2.5 Bahrain (`BH`)

#### 1. Social Insurance Organization (SIO / الهيئة العامة للتأمين الاجتماعي)
- **Country:** Bahrain (`BH`)
- **Purpose:** Law 24/1976 retirement pension, unemployment insurance, and work injury contributions.
- **Credentials Required:**
  - `MADARX_BH_SIO_EMPLOYER_REF`: SIO Corporate Registration Number (رقم صاحب العمل في التأمينات).
- **Where Customer Obtains:** SIO Bahrain Online Services (البوابة الوطنية لمملكة البحرين).
- **Where MadarX Receives:** Tenant Admin Settings $\rightarrow$ Country Packs $\rightarrow$ Bahrain Configuration.
- **Test Procedure:** Validate Bahraini CPR numbers (9 digits) and monthly gross wage caps (4,000 BHD max basis).
- **Production Activation:** Activate monthly SIO electronic contribution reconciliation.

#### 2. Labour Market Regulatory Authority (LMRA / هيئة تنظيم سوق العمل)
- **Country:** Bahrain (`BH`)
- **Purpose:** Expatriate work permits, Bahranization ratios, and WPS salary clearing.
- **Credentials Required:**
  - `MADARX_BH_LMRA_ESTABLISHMENT_CR`: Commercial Registration (CR) Number & LMRA Client Key.
- **Where Customer Obtains:** LMRA Expat Management System (EMS).
- **Where MadarX Receives:** Tenant Admin Settings $\rightarrow$ Integrations $\rightarrow$ LMRA Connector.
- **Test Procedure:** Run employee work permit expiry status check using test CPR numbers.
- **Production Activation:** Connect corporate CR; activate automated WPS file generation and permit tracking.

---

## 3. Communication & Infrastructure Providers

### 3.1 Transactional Email & Notifications (SMTP Relay)
- **Purpose:** Password resets, multi-factor authentication (MFA) codes, workflow approval alerts, task reminders.
- **Credentials Required:**
  - `SMTP_HOST`: FQDN of corporate SMTP relay (e.g., `smtp.sendgrid.net`, `smtp.mailgun.org`, or corporate Microsoft 365).
  - `SMTP_PORT`: Port (`587` for STARTTLS or `465` for SSL/TLS).
  - `SMTP_USER`: Authorized relay username.
  - `SMTP_PASS`: Authorized relay password / API key.
- **Where Customer Obtains:** Enterprise IT / Email Infrastructure Provider.
- **Where MadarX Receives:** Server Environment Variables (`SMTP_*`).
- **Test Procedure:** Execute transactional test email dispatch to admin address.
- **Production Activation:** Configure DKIM, SPF, and DMARC DNS records for sender domain; enable live notifications.

### 3.2 Enterprise AI Provider (Optional)
- **Purpose:** Assists users with natural language queries, document search, policy explanation, and drafting.
- **Credentials Required:**
  - `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`.
- **Where Customer Obtains:** Enterprise AI Provider console.
- **Where MadarX Receives:** Server-side environment variables (never exposed with `VITE_` prefix).
- **Default Baseline:** If unconfigured, MadarX uses `MockEnterpriseAIProvider` (`madarx-local-v1`), keeping 100% of the platform functional with zero external dependency.
