# MadarX Multi-Country Statutory Compliance Matrix (`COUNTRY_PACK_MATRIX.md`)

**Release:** `v1.0.0-enterprise-rc`  
**Engine:** Versioned Country Pack & Statutory Rule Engine (`src/lib/domains/country-packs/index.ts`)  
**Database Migration:** `supabase/migrations/20261018000000_production_multi_country_localization_and_country_packs.sql`

---

## 1. Supported Target Countries & Currencies

| Country Code | Country Name (EN / AR) | Currency | Minor Units | Standard Workweek | Weekend Days | Legislation Version Code |
|---|---|---|---|---|---|---|
| `EG` | Egypt / جمهورية مصر العربية | `EGP` | 2 | 48h (8h/day) | Fri, Sat | `EG-LABOR-2026.1` |
| `SA` | Saudi Arabia / المملكة العربية السعودية | `SAR` | 2 | 48h (8h/day, 6h Ramadan) | Fri, Sat | `SA-LABOR-2026.1` |
| `QA` | Qatar / دولة قطر | `QAR` | 2 | 48h (8h/day, 6h Ramadan) | Fri, Sat | `QA-LABOR-2026.1` |
| `OM` | Oman / سلطنة عُمان | `OMR` | **3** | 45h (9h/day, 6h Ramadan) | Fri, Sat | `OM-LABOR-2026.1` |
| `BH` | Bahrain / مملكة البحرين | `BHD` | **3** | 48h (8h/day, 6h Ramadan) | Fri, Sat | `BH-LABOR-2026.1` |

---

## 2. Statutory Pillars by Country

### 2.1 Social Insurance & Pension
- **Egypt (`EG` — NOSI Law 148/2019):** Insured Egyptians: `11%` employee / `18.75%` employer on insurable wage bounded by configured `wageFloor` (`2,300 EGP`) and `wageCeiling` (`14,500 EGP`).
- **Saudi Arabia (`SA` — GOSI):** Saudi nationals: `9.75%` employee / `11.75%` employer (Annuities + SANED + Occupational Hazards) up to `45,000 SAR` cap; Non-Saudi: `0%` employee / `2%` employer occupational hazards.
- **Qatar (`QA` — GRSIA):** Qatari nationals: `7%` employee / `14%` employer up to `100,000 QAR` cap; Non-Qatari: `0%` social insurance.
- **Oman (`OM` — SPF):** Omani nationals: `8%` employee / `12.5%` employer (Pension + Job Security + Work Injury) up to `3,000 OMR` cap; Non-Omani: `0%` social insurance.
- **Bahrain (`BH` — SIO):** Bahraini nationals: `8%` employee / `17%` employer up to `4,000 BHD` cap; Non-Bahraini: `1%` employee (Unemployment Insurance) / `3%` employer.

### 2.2 Income Tax & Solidarity Contributions
- **Egypt (`EG` — ETA):** Annualized personal exemption (`20,000 EGP`), 7 progressive annual brackets (`0%` up to `40,000 EGP` through `27.5%` above `1,200,000 EGP`) plus emergency/martyrs solidarity contribution (`0.05%`), converted to monthly withholding.
- **Saudi Arabia (`SA`), Qatar (`QA`), Oman (`OM`), Bahrain (`BH`):** `0%` personal employment income tax under current active pack versions; engine supports effective-dated bracket activation without code changes.

### 2.3 End-of-Service (EOS) / Gratuity
- **Egypt (`EG`):** `0.5` month per year for first 5 years, `1.0` month per year thereafter; resignation vesting scaling (`0%` < 2 yrs, `33.33%` 2–5 yrs, `66.67%` 5–10 yrs, `100%` >= 10 yrs).
- **Saudi Arabia (`SA` — Art. 84/85):** `0.5` month per year for first 5 years, `1.0` month per year thereafter; resignation vesting (`0%` < 2 yrs, `33.33%` 2–5 yrs, `66.67%` 5–10 yrs, `100%` >= 10 yrs).
- **Qatar (`QA`):** `21` calendar days (`0.7` month) per year after `12` months minimum service (`100%` vesting after 1 year).
- **Oman (`OM`):** `1.0` month per year across all service tiers after `12` months minimum service (`100%` vesting after 1 year).
- **Bahrain (`BH`):** `0.5` month per year for first 3 years, `1.0` month per year thereafter (`100%` vesting after 1 year).

### 2.4 Wage Protection System (WPS) & Payment Readiness
- **Saudi Arabia:** Mudad / SARIE WPS CSV (`SA` 24-char IBAN, 10-digit National ID / Iqama starting with `1` or `2`).
- **Qatar:** QCB WPS SIF (`QA` 29-char IBAN, 11-digit QID).
- **Oman:** CBO WPS SIF (`OM` 23-char IBAN, 8–9 digit Civil Number).
- **Bahrain:** LMRA / Benefit WPS (`BH` 22-char IBAN, 9-digit CPR).
- **Egypt:** Local Bank Transfer & Payroll Register (`EG` 29-char IBAN, 14-digit National ID).

---

## 3. External Government Portal Connector Classification

All external government submission connectors (`NOSI`, `ETA`, `Mudad`, `GOSI`, `Qiwa`, `Muqeem`, `QCB WPS`, `SPF`, `SIO`, `LMRA`) are classified honestly as:

> **`PRODUCTION READY — CONFIGURATION REQUIRED`** (`WAITING_FOR_CUSTOMER_CREDENTIALS`)

No live government submission is fabricated when customer credentials/certificates are not configured.
