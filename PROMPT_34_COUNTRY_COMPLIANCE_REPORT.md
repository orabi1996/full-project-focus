# MADARX ENTERPRISE WORKFORCE PLATFORM
# PROMPT 34 — MULTI-COUNTRY HR / PAYROLL LOCALIZATION, STATUTORY COMPLIANCE & COUNTRY PACK REPORT

## 1. Executive Summary
Prompt 34 delivers production-grade, configuration-driven, effective-dated Country Packs and statutory compliance engines for **Egypt (`EG`), Saudi Arabia (`SA`), Qatar (`QA`), Oman (`OM`), and Bahrain (`BH`)** layered cleanly on top of MadarX's unified Employee Master, Organization, Payroll, Compensation, Attendance, Leave, EOS, Movements, Workflow, Reporting, Notifications, Tasks, Documents, and ESS/MSS engines.

---

## 2. Country Readiness Matrix (Section 106)

Status legend:
- `READY` — Production rule engine, database tables/RPCs, validation, UI, and tests verified.
- `CONFIGURATION REQUIRED` — Software adapter and export/connector pipeline ready; requires tenant-specific live government gateway credentials / establishment certificates for direct host-to-host transmission.
- `NOT APPLICABLE` — Statutory domain does not apply to personal employment payroll in this jurisdiction.
- `BLOCKED` — Blocked by missing implementation (None: `0`).

| Domain / Capability | Egypt (`EG`) | Saudi Arabia (`SA`) | Qatar (`QA`) | Oman (`OM`) | Bahrain (`BH`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Country Pack Engine** | `READY` | `READY` | `READY` | `READY` | `READY` |
| **Legal Entity Localization** | `READY` | `READY` | `READY` | `READY` | `READY` |
| **Employee Identifiers** | `READY` | `READY` | `READY` | `READY` | `READY` |
| **Payroll Statutory Rules** | `READY` | `READY` | `READY` | `READY` | `READY` |
| **Income Tax** | `READY` | `NOT APPLICABLE` | `NOT APPLICABLE` | `NOT APPLICABLE` | `NOT APPLICABLE` |
| **Social Insurance** | `READY` | `READY` | `READY` | `READY` | `READY` |
| **WPS / Salary File** | `READY` | `READY` | `READY` | `READY` | `READY` |
| **Leave Localization** | `READY` | `READY` | `READY` | `READY` | `READY` |
| **Attendance / Overtime** | `READY` | `READY` | `READY` | `READY` | `READY` |
| **Public Holidays** | `READY` | `READY` | `READY` | `READY` | `READY` |
| **EOS / Gratuity** | `READY` | `READY` | `READY` | `READY` | `READY` |
| **Statutory Reports** | `READY` | `READY` | `READY` | `READY` | `READY` |
| **Compliance Validation** | `READY` | `READY` | `READY` | `READY` | `READY` |
| **External Government Connectors** | `CONFIGURATION REQUIRED` | `CONFIGURATION REQUIRED` | `CONFIGURATION REQUIRED` | `CONFIGURATION REQUIRED` | `CONFIGURATION REQUIRED` |

---

## 3. Authoritative Statutory Sources & Currency Precision

| Country | Currency | Decimal Precision | Rounding Policy | Primary Statutory Authorities & References |
| :--- | :--- | :--- | :--- | :--- |
| **Egypt (`EG`)** | `EGP` | `2` decimals | `HALF_UP` | NOSI Social Insurance Law No. 148 of 2019 (`11%` employee + `0.05%` Martyrs Fund, `18.75%` employer + `1%` Emergency Fund, floor `2,000 EGP`, cap `12,600 EGP`); ETA Income Tax Law No. 7 of 2024 (`20,000 EGP` annual personal exemption + 7 progressive brackets `0%` to `27.5%`); Egyptian Labor Law No. 12 of 2003. |
| **Saudi Arabia (`SA`)** | `SAR` | `2` decimals | `HALF_UP` | GOSI Royal Decree M/33 & SANED (`9.75%` Saudi employee, `11.75%` Saudi employer, `2.00%` non-Saudi employer occupational hazards, floor `1,500`/`400 SAR`, cap `45,000 SAR`); MHRSD Saudi Labor Law M/51 (Articles 84 & 85 EOS, `1.5x` overtime, `90`/`180` day probation, `48h`/`36h` Ramadan); SAMA / Mudad WPS. |
| **Qatar (`QA`)** | `QAR` | `2` decimals | `HALF_UP` | GRSIA Law No. 1 of 2022 (`7%` Qatari employee, `14%` Qatari employer, `0%` non-Qatari); Qatar Labor Law No. 14 of 2004 (Article 54 EOS minimum 3 weeks/year, `1.25x`/`1.5x` overtime); QCB & MOL WPS SIF (`SCR`/`EDR`) specification. |
| **Oman (`OM`)** | `OMR` | `3` decimals | `HALF_UP` | Social Protection Fund (SPF) Royal Decree No. 52/2023 (`8%` Omani employee, `14%` Omani employer, `1%` non-Omani work injury employer, cap `3,000.000 OMR`); Oman Labor Law Royal Decree No. 53/2023 (Article 61 EOS 1 month/year, `40h` week / `30h` Ramadan, 30 days annual leave); CBO / MOL WPS. |
| **Bahrain (`BH`)** | `BHD` | `3` decimals | `HALF_UP` | Social Insurance Organization (SIO) Law No. 24 of 1976 & Unemployment Law No. 78 of 2006 (`8%` Bahraini employee, `16%` Bahraini employer, `1%` non-Bahraini employee unemployment, `3%` non-Bahraini employer work injury, cap `4,000.000 BHD`); Private Sector Labor Law No. 36 of 2012 (Article 116 EOS: `0.5` month first 3 years, `1` month thereafter); LMRA / CBB WPS. |

---

## 4. Governance, Immutability & Honesty Controls
1. **Effective-Dated Versioning & Four-Eyes Rule Activation:** Statutory rule sets follow `draft -> verified -> scheduled -> active -> superseded -> retired` with mandatory four-eyes approval (`proposed_by != approved_by`) enforced in both TypeScript (`validateFourEyesRuleActivation`) and PostgreSQL (`activate_statutory_rule_set_four_eyes_atomic`).
2. **Historical Payroll Immutability:** Finalized payroll runs persist immutable statutory snapshots (`payroll_statutory_snapshots`) protected by database trigger `trg_prevent_locked_statutory_snapshot_mutation`, guaranteeing that activating 2027 statutory rules never alters finalized 2026 payroll runs.
3. **External Government Connector Honesty:** No live government submission (`GOSI`, `Mudad`, `Qiwa`, `NOSI`, `ETA`, `GRSIA`, `SPF`, `SIO`, `LMRA`) is ever fabricated as `submitted` or `accepted` without real tenant credentials and external authority confirmation.
