# PART 16 — Product Roadmap

**الحالة:** خارطة طريق مبدئية قابلة للتنفيذ والمراجعة؛ التواريخ أهداف تخطيط وليست التزامًا قبل تحقق الاكتشاف.  
**تاريخ الإصدار:** 8 سبتمبر 2026  
**المرجع:** PART 1–15، `docs/DEVELOPMENT_ROADMAP.md`، وbaseline الكود الحالي.

هذه الخطة تنقل المشروع من واجهة وmigrations ونواة server functions إلى منتج HR SaaS قابل للبيع. كل مرحلة لها هدف تجاري، نطاق تقني، شاشات، عقود API، تغييرات DB، اختبارات، وبوابة خروج. لا نفتح مرحلة لاحقة لمجرد مرور الوقت؛ نفتحها عند تحقق exit criteria والدليل.

## 1. مبادئ التخطيط

- **القيمة قبل الاتساع:** نغلق مسار الموظف → الحضور → الإجازة → payroll preview/lock قبل إضافة ميزات كثيرة.
- **البيانات قبل الواجهة:** tenant context وRLS وledger وaudit تسبق claims التسويقية أو التقارير المتقدمة.
- **قابلية التراجع:** كل feature flag وmigration وjob له owner وrollback/compensation.
- **سوق افتراضي معلن:** السعودية وشركات 100–500 موظف فرضية عمل من PART 1؛ لا نثبت country payroll أو السعر قبل validation.
- **عربي أولًا:** RTL/Arabic/English وtimezone/currency تدخل في كل مرحلة، لا تُرحّل إلى النهاية.
- **دليل قابل للقياس:** كل gate يرتبط بـKPI أو test evidence أو مقابلات/تجارب موثقة؛ لا نخترع traction.

## 2. الملخص

| المرحلة              | الهدف                                 | مخرجات القرار                                               |
| -------------------- | ------------------------------------- | ----------------------------------------------------------- |
| Phase 0 — Discovery  | إثبات المشكلة والمشتري والحدود        | ICP، مقابلات، policy country، pilot design                  |
| Phase 1 — MVP        | أول قيمة قابلة للبيع لمسار HR الأساسي | tenant، الموظفون، الحضور، الإجازة، payroll preview، audit   |
| Phase 2 — Beta       | تشغيل محدود مع عملاء حقيقيين ومطابقة  | payroll lock/payment sandbox، approvals، documents، support |
| Phase 3 — Production | إطلاق مدفوع مضبوط                     | billing، security/DR، UAT، runbooks، SLA                    |
| Phase 4 — Growth     | توسع الاستخدام والإيراد والتكاملات    | ATS/performance/assets، integrations، analytics، PWA        |
| Phase 5 — Enterprise | عزل وسياسات وعقود مؤسسية              | SSO/SCIM، residency، advanced controls، scale 100K+         |

## 3. Phase 0 — Discovery (0–4 أسابيع هدفية)

**Business goal:** إثبات أن HR/finance في الشريحة المستهدفة مستعدون لدفع ثمن تقليل أخطاء الحضور والرواتب، وتحديد البلد والسياسات قبل تثبيت architecture مكلفة.

**Features وscreens:** landing/message test، discovery interview workspace، ICP/ROI worksheet، policy-country matrix، pilot charter، pricing interview، risk register. لا نضيف شاشة تشغيلية جديدة لمجرد إكمال الجرد.

**APIs/contracts:** research notes schema، anonymized interview outcome، feature hypothesis، pilot consent؛ لا API إنتاجية أو salary ingestion حقيقي.

**Database:** لا migration تشغيلية؛ تحفظ قوالب/نتائج مجمعة خارج بيانات العملاء. تثبت assumptions H01–H12 وdecision log.

**Testing/evidence:** 16 مقابلة في 8 منشآت مستهدفة، 3 design-partner sessions، usability tasks، willingness-to-pay test، competitor evidence، policy/legal review، وsecurity threat-model delta.

**Exit criteria:**

- persona وbuyer وtop-3 pains مثبتة بعينة مكتوبة، مع نسبة عدم يقين.
- بلد pilot وcalendar/payroll policy owner وdata residency assumptions محددة.
- 2–3 design partners يوافقون على pilot criteria وبيانات synthetic/real boundaries.
- north-star metric وbaseline وخطة قياس؛ لا ادعاء revenue/traction بلا فواتير.
- قرار Go/Refine/Stop موثق من product وfinance/security.

## 4. Phase 1 — MVP (6–12 أسابيع هدفية)

**Business goal:** تقديم أول قيمة منتهيّة لمسؤول HR وموظف: تهيئة مؤسسة، سجل موظفين، جداول وحضور، إجازة، طلب/اعتماد، payroll preview، وتدقيق.

**Features:**

- auth/invite/membership وtenant settings واللغة/timezone/currency.
- organization hierarchy، employee lifecycle الأساسي، documents metadata + private upload.
- shifts/schedules، punches/import، late/early/absence، correction request.
- leave types/balance reservation/approval/cancel.
- salary profile effective-dated، payroll calculate/review (بدون live payment)، payslip preview مقنع.
- approval inbox، notification in-app/email أساسي، audit، dashboard role-based.

**Screens:** S001–S020 shell/auth/onboarding، S021–S045 organization/employee، S060–S090 attendance/leave، S100–S118 payroll/approval، S145/S150 audit/reports smoke؛ subset معتمد من PART 7.

**APIs:** `/me`, tenant settings, employees/documents, shifts/schedules, attendance punches/import/corrections, leave requests/balances, payroll runs calculate/review, approvals, notifications, audit؛ عقود API-A01–A20 الأساسية.

**Database:** tenant registry/membership، tenant_id backfill للـMVP tables، RLS/composite keys، attendance/leave ledgers، payroll input snapshot/lines، outbox/audit؛ لا payment provider production.

**Testing:** unit calculators/RBAC، migration from zero، RLS cross-tenant، API contract، Playwright demo + staging smoke، RTL/mobile، SEC-A01–08 وDB-A01–14.

**Exit criteria:**

- 100% critical CRUD محفوظ بعد refresh ولا Mock في live mode.
- tenant/RLS tests خضراء، payroll preview reproducible، leave لا ينزل رصيدًا سالبًا.
- p95 dashboard/API ضمن أهداف PART 13 على dataset MVP.
- design partner يستطيع إكمال onboarding وemployee وattendance وleave وpayroll preview دون تدخل مطور.
- لا P0/P1 مفتوح؛ pilot data boundary وsupport channel جاهزان.

## 5. Phase 2 — Beta (8–16 أسبوعًا هدفية)

**Business goal:** تشغيل 3–10 عملاء design partners على مسيرات تجريبية متكررة، وإثبات المطابقة والاعتمادات والدعم قبل تحصيل واسع.

**Features:** payroll lock وpayslip PDF، payment provider sandbox وreconciliation، salary advances/installments، expenses/early payout، settlement draft، approval SLA/delegation، document expiry، report exports، support tickets، feature flags.

**Screens:** payroll run detail/lock/payment/reconciliation، advances/expenses/settlement، inbox/SLA، documents expiry، report jobs، support؛ S091–S144 وS151–S160 حسب subset.

**APIs:** payroll lock/adjustment، payment batch/provider callbacks/reconcile، advances/disburse، expense submit/approve، settlement versions/sign، reports/jobs، support/break-glass audit.

**Database:** payroll/payments/settlement/deduction ledgers، journal_lines، provider callbacks/outbox/inbox، jobs/DLQ، document storage metadata، tenant-scoped reporting projections.

**Testing:** golden payroll datasets، concurrency/idempotency، provider sandbox/replay، restore drill أولي، visual/a11y، k6 smoke، SEC-A09–20 وWF-A01–20 critical paths.

**Exit criteria:**

- دورتان payroll متتاليتان لكل design partner دون double payment أو فقد ledger.
- payment sandbox وreconciliation exceptions موثقة ومطابقة bank fixture.
- first-response support وSLA وrunbooks يعملون؛ health dashboard لا يعتمد salary raw.
- 70% من المستخدمين المدعوين يحققون activation definition أو يوجد سبب موثق.
- willingness-to-pay/price test وتكلفة التشغيل يعيدان قرار packaging.

## 6. Phase 3 — Production (12–24 أسبوعًا هدفية)

**Business goal:** إطلاق مدفوع آمن لعملاء مختارين، مع فوترة ودعم وامتثال وموثوقية يمكن الدفاع عنها.

**Features:** subscription plans/trial/entitlements، invoice/payment/recovery، WPS/SIF أو provider البلد بعد اعتماد قانوني/مالي، production notification channels، full audit/security events، backup/PITR/restore، status/incident portal.

**Screens:** billing/subscription/invoice، tenant commerce، production health، full admin/security، WPS validation/export، customer success health، help center/tickets.

**APIs:** `/subscriptions`, `/invoices`, `/entitlements`, payment provider production callbacks، WPS export contract، security/admin/audit، support SLA، export/DSAR.

**Database:** commerce schema منفصل منطقيًا، entitlements، invoices، provider secrets vault references، retention/legal hold، aggregate analytics؛ migrations expand/contract.

**Testing:** UAT HR/finance/admin، real-auth E2E staging، production smoke، security review/pen test scope، backup restore/RPO/RTO، load 1K users، accessibility gate، incident/tabletop.

**Exit criteria:**

- عقد/دفع/دعم/سياسة خصوصية وDPA للبلد، وUAT sign-off مكتوب.
- zero P0/P1، SEC/DB/API/QA gates ناجحة أو exceptions سارية.
- canary وrollback وrunbooks مجربة، monitoring/on-call وerror budget فعال.
- billing reconciliation وfailed-payment grace/recovery تعمل في sandbox ثم provider approved.
- أول عملاء مدفوعين يستطيعون الإغلاق والدعم دون تدخل فريق التطوير اليومي.

## 7. Phase 4 — Growth (6–12 شهرًا هدفية)

**Business goal:** رفع adoption والاحتفاظ وARPA عبر وحدات مواهب وتكاملات وتقارير، مع خفض تكلفة الخدمة اليدوية.

**Features:** ATS end-to-end، performance 360/calibration، workforce planning، assets/custody، accounting/ERP connectors، attendance device connectors، scheduled reports، push/PWA offline safe، analytics warehouse، localized countries إضافية بعد validation.

**Screens:** recruitment pipeline/interviews/offers، performance cycle/calibration، workforce scenarios، assets inventory/return، integration mapping/health، report builder/schedule، mobile/PWA states، platform analytics.

**APIs:** candidate/offer-to-hire transaction، performance cycles/reviews، assets، connector framework/webhooks، scheduled reports، event/analytics ingestion، push subscriptions.

**Database:** domain tables المتبقية، connector cursors/mappings، warehouse aggregates، partition large events عند threshold، search indexes، feature entitlements/add-ons.

**Testing:** multi-browser/mobile، load 10K users، connector contract/replay، migration versioning، experiment guardrails، retention/privacy deletion، adoption/NRR analytics.

**Exit criteria:**

- module adoption وretention تتحسن مقابل baseline دون زيادة payroll error/support severity.
- connectors production مع signed webhooks وDLQ/reconciliation، وتكلفة كل tenant ضمن gross-margin target.
- PWA/RTL/a11y لا تكسر critical journeys، وwarehouse data quality ضمن target.
- expansion/add-on pricing وcustomer success playbook مثبتة بعقود أو usage موثق.

## 8. Phase 5 — Enterprise (بعد product/market fit)

**Business goal:** تلبية متطلبات المؤسسات الكبيرة والعزل والسياسات والـscale دون تحويل النظام إلى microservices غير لازمة.

**Features:** SSO/OIDC/SAML، SCIM، advanced approval/SoD، IP/device policies، customer-managed keys، data residency/database isolation tiers، SLA/DR متقدم، audit export/SIEM، sandbox/tenant clone، bulk API/partner SDK، 100K+ employee operations.

**Screens:** enterprise security center، SSO/SCIM، policy/SoD designer، key/residency controls، audit/SIEM export، SLA/DR console، partner API keys/usage، tenant migration.

**APIs:** platform admin guarded APIs، SCIM، enterprise SSO callbacks، bulk import/export، audit stream، tenant move/restore، partner webhook/SDK versioning.

**Database/infrastructure:** separate schema/database option، read replicas، partition/warehouse، regional buckets، KMS/customer keys، event-driven workers، quotas and noisy-neighbor isolation.

**Testing:** load 100K ثم 1M benchmark، tenant isolation penetration، SSO/SCIM conformance، regional restore/DR، chaos/provider failover، contract compatibility، enterprise security review.

**Exit criteria:**

- عقد enterprise وSLA/RPO/RTO/data residency وDPA معتمد لكل tier.
- capacity evidence 100K+ مع p95/error budget وnoisy tenant isolation.
- SSO/SCIM/audit/SIEM وcustomer key controls مجربة في reference tenant.
- migration tenant بين tiers بدون فقد أو كسر UUID/events، وrestore evidence.

## 9. الاعتماديات وبوابات القرار

- Phase 0 يقرر ICP/country/policy؛ بدونه لا نثبت pricing أو WPS أو residency.
- Phase 1 يعتمد على tenant/RLS/ledger contracts؛ لا يبدأ payment production.
- Phase 2 يعتمد على golden payroll وprovider sandbox وsupport runbooks.
- Phase 3 يعتمد على legal/finance UAT وbilling/DR/observability.
- Phase 4 يفتح integrations/AI فقط إذا adoption/outcome metrics تبرر التكلفة.
- Phase 5 لا يبدأ قبل إثبات unit economics وretention واستقرار platform.

عند فشل gate: نعود إلى Refine، نخفّض scope أو نوقف، ونحدث assumptions؛ لا نعلن مرحلة جديدة حفاظًا على الجدول.

## 10. Capacity path

| المستوى    | قرار تقني                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------- |
| 1K users   | modular monolith، Postgres/RLS، worker واحد، CDN، CI الحالي                               |
| 10K users  | queue منفصل، Redis/cache، read replicas عند query evidence، warehouse aggregates          |
| 100K users | partition events/attendance، horizontal web/workers، connection pool، search/warehouse    |
| 1M+ users  | regional/tenant isolation، event-driven domains وmicroservices انتقائية، DR متعدد المناطق |

لا ننتقل إلى المستوى الأعلى بالعدد وحده؛ نستخدم p95، queue age، DB locks، cost/tenant، وnoise evidence.

## 11. معايير قبول roadmap

1. **RM-A01:** كل مرحلة تحمل business goal وfeatures وscreens وAPIs وDB وtests وexit criteria.
2. **RM-A02:** Phase 0 لا تدعي مقابلات أو traction غير موثقة.
3. **RM-A03:** MVP لا يفتح live payment أو country payroll قبل policy/UAT gate.
4. **RM-A04:** MVP critical paths تعمل بعد refresh على RLS tenant data.
5. **RM-A05:** Beta تثبت دورتين payroll وreconciliation/idempotency قبل المدفوع.
6. **RM-A06:** Production لها billing/privacy/DPA/UAT/rollback/on-call evidence.
7. **RM-A07:** Growth لا يضيف integration/AI دون adoption/outcome guardrail.
8. **RM-A08:** Enterprise يبرر العزل/replica/partition بمقاييس capacity لا بالموضة.
9. **RM-A09:** كل gate يحدد owner وevidence وقرار Go/Refine/Stop.
10. **RM-A10:** feature flags وmigrations لكل مرحلة قابلة للتراجع أو التعويض.
11. **RM-A11:** Arabic RTL/LTR/a11y/security/localization تدخل كل gate.
12. **RM-A12:** خطة السعة 1K/10K/100K/1M+ مرتبطة بأدلة p95/queue/cost.
13. **RM-A13:** لا تبدأ Phase 3 قبل zero P0/P1 أو exception منتهي الصلاحية.
14. **RM-A14:** لا تبدأ Phase 5 قبل retention/unit economics وenterprise design partner.
15. **RM-A15:** roadmap وbacklog وanalytics catalog لها نفس IDs/version.
16. **RM-A16:** أي country-specific policy تسجل owner/review date ومصدرها.
17. **RM-A17:** release evidence يحوي commit SHA وmigration وQA/security artifacts.
18. **RM-A18:** customer success/support readiness جزء من production gate.
19. **RM-A19:** privacy/retention/DSAR وlegal hold لا تؤجل بعد أول بيانات حقيقية.
20. **RM-A20:** عند فشل gate يوثق قرار التعديل ولا يُخفى خلف تغيير status.

## 12. التسليم

تُحوّل كل مرحلة إلى Epics/Stories في PART 17 مع IDs `RM-Px` وowner وacceptance. يراجع product/engineering/finance/security هذا الملف شهريًا أو عند evidence جديد، وتبقى جميع الأرقام والتواريخ قابلة للتعديل دون إعادة كتابة التاريخ المنشور.
