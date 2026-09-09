# PART 6 — INFORMATION ARCHITECTURE

**التاريخ:** 8 سبتمبر 2026. **الإصدار:** 0.1 — بنية معلومات وتنقل مبدئية.

**المرجع:** [PART 3 — Product Architecture](PART_03_PRODUCT_ARCHITECTURE.ar.md)، [PART 4 — User Roles & Permissions](PART_04_USER_ROLES_AND_PERMISSIONS.ar.md)، [PART 5 — User Journeys](PART_05_USER_JOURNEYS.ar.md)، و[جرد المكونات الحالية](../../src/components/layout/AppLayout.tsx).

**الحالة:** مواصفات UX قابلة للتحويل إلى routes وguards وnavigation. لا تغيّر هذه الوثيقة روابط التطبيق الحالي أو صلاحياته تلقائيًا.

## 1. القرار: تنقل هجين بترتيب حسب المهمة

نستخدم **Sidebar مجمّعًا على سطح المكتب + Header عالمي + Bottom actions على الهاتف عند الحاجة**. الـSidebar يثبت الأماكن، والـHeader يختصر البحث والتنبيهات والحساب والسياق، وESS يحتفظ بإجراءات اليوم في مساحة صغيرة.

سبب الاختيار:

- المنتج مؤسسي وفيه مجالات كثيرة؛ تجميعها في ستة أقسام يقلل طول القائمة ويحافظ على الذاكرة المكانية.
- الموافقات والتنبيهات عابرة للوحدات؛ لذلك تبقى في Header وInbox موحد بدل دفنها داخل Payroll أو Leaves.
- الهاتف يحتاج إجراءً سريعًا للحضور والإجازة والمصروف والقسيمة؛ لا يصغّر Sidebar كاملًا إلى قائمة غير قابلة للمس.
- العربية هي الاتجاه الافتراضي؛ نستخدم logical properties ومرآة آمنة للأيقونات بدل نسخ تخطيط منفصل.

الواجهة تعرض فقط ما يحتمل أن ينجح وفق authorization، لكن الخادم يعيد فحص الجلسة وmembership وpermission وscope وentitlement في كل route وcommand. لا نعتمد على ترتيب العناصر لإثبات الأمان.

## 2. ما هو موجود وما يحتاج نقلًا

| السلوك الحالي                                                                       | الدليل                                                     | قرار الانتقال                                                                     |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/login` و`AuthGate` يحميان `/`                                                     | `src/routes/login.tsx`, `src/components/auth/AuthGate.tsx` | نضيف invite، registration، MFA، recovery، وonboarding routes دون كسر redirect     |
| `AppLayout` يعرض Header وSidebar وView body                                         | `src/components/layout/AppLayout.tsx`                      | نحافظ على shell ونفصل page routes وresource panels تدريجيًا                       |
| التبويب محفوظ في `window.location.hash` من قائمة `VALID_TABS`                       | `src/components/layout/AppLayout.tsx`                      | compatibility mapping مؤقت ثم routes typed قابلة للمشاركة والعودة للخلف           |
| Sidebar يقسم الوحدات إلى General وWorkforce وTime وPayroll وTalent وGovernance وESS | `src/components/layout/AppSidebar.tsx`                     | نعتمد هذه الأقسام مع أسماء عربية ثابتة وعدادات inbox مفلترة بالصلاحية             |
| Header فيه command palette وrole pill وlanguage/theme وnotifications وdata status   | `src/components/layout/AppHeader.tsx`                      | نحتفظ بوظائفه، ونمنع role switcher في Live ونربط status بسياق tenant/health حقيقي |
| Command palette يبحث في الشاشات والموظفين                                           | `src/components/layout/CommandPalette.tsx`                 | يصبح بحثًا موحدًا بالموارد والطلبات والتقارير، مع masking وranking حسب permission |
| معظم البيانات والحالة تمر عبر `AppContext`                                          | `src/lib/context/AppContext.tsx`                           | page/feature/query/command boundaries؛ لا نعيد كتابة كل التطبيق في دفعة واحدة     |

## 3. الهرم الوظيفي المستهدف

### 3.1 المساحة العامة والهوية

هذه المسارات لا ترى بيانات عميل قبل وجود جلسة ونطاق:

```text
Public
├─ Landing / Product / Security / Pricing (hypothesis)
├─ Login / SSO / MFA / Password recovery
├─ Accept invitation / Verify email
├─ Terms / Privacy / Data processing
└─ Status / Contact support
```

لا تعرض Landing سعرًا أو شعار عائلة C‑Smarx/Classera كاعتماد نهائي قبل حسم الملكية التجارية؛ تستخدم نسخة قابلة للتبديل من configuration.

### 3.2 مساحة العميل المحمية

```text
Tenant workspace
├─ Home
│  ├─ Role dashboard
│  ├─ My inbox / My requests
│  └─ Announcements and tasks
├─ Workforce & organization
│  ├─ Organization, entities, departments, locations, positions
│  ├─ Employees and employee 360
│  ├─ Documents and policies
│  └─ Roles, members, delegations
├─ Time & daily operations
│  ├─ Requests and approvals
│  ├─ Leaves and balances
│  ├─ Attendance, exceptions, devices
│  └─ Shifts and schedules
├─ Payroll & finance
│  ├─ Payroll runs, details, payslips, WPS/payment
│  ├─ Loans and advances
│  ├─ Expenses and reimbursements
│  └─ Settlement and reconciliation
├─ Talent & growth
│  ├─ Recruitment and candidates
│  ├─ Workforce planning
│  └─ Performance cycles and goals
├─ Governance & ecosystem
│  ├─ Assets and clearance
│  ├─ Reports and analytics
│  ├─ Integrations and connection health
│  └─ Audit and evidence
├─ Employee self-service
│  ├─ Today, attendance, requests, balances
│  ├─ Payslips and documents
│  └─ Profile, acknowledgments, help
└─ Settings
   ├─ Tenant profile and localization
   ├─ Members, roles, scopes, approvals
   ├─ Policies and calendars
   ├─ Notifications and templates
   ├─ Integrations, API keys, webhooks
   ├─ Subscription, usage, invoices
   └─ Security, sessions, audit access
```

### 3.3 مساحة المنصة الداخلية

`/platform` منفصلة بصريًا ومفاهيميًا عن بيانات العميل:

`tenants`، `support tickets`، `plan catalog`، `feature releases`، `billing operations`، `system health`، `audit/security events`، و`break-glass reviews`. الدور الداخلي لا يضاف تلقائيًا إلى tenant membership، وكل وصول لبيانات عميل يحتاج ticket أو policy.

## 4. مجموعات الـSidebar والروابط

| المجموعة     | الاسم العربي             | الروابط الأساسية                                                  | العدادات المسموحة                             |
| ------------ | ------------------------ | ----------------------------------------------------------------- | --------------------------------------------- |
| `home`       | الرئيسية                 | Dashboard، Inbox، My requests                                     | pending approvals، failed jobs الخاصة بالنطاق |
| `workforce`  | شؤون الموظفين والهيكل    | Organization، Employees، Documents، Roles                         | missing documents، invitations                |
| `time`       | الوقت والعمليات اليومية  | Workflow، Leaves، Attendance، Shifts                              | pending requests، late/exceptions             |
| `payroll`    | الرواتب والمالية         | Payroll، Loans، Expenses، Settlement                              | blocked runs، failed payments                 |
| `talent`     | المواهب وتطوير الأداء    | Recruitment، Workforce planning، Performance                      | expiring offers، incomplete reviews           |
| `governance` | البيئة المؤسسية والتكامل | Assets، Reports، Integrations، Audit                              | overdue assets، stale reports، failed sync    |
| `ess`        | الخدمة الذاتية           | Today، My requests، My documents، Payslips                        | personal pending items                        |
| `settings`   | الإعدادات                | Tenant، Members/Roles، Policies، Notifications، Billing، Security | expiring trial، security alerts               |

لا نكرر المورد في مجموعتين إلا إذا كان له entry واضح: `Payroll` يملك الحقيقة المالية، و`ESS → Payslips` يعرض projection مقيدًا؛ `Workflow` يملك حالة الاعتماد، والوحدة الأصلية تعرض تفاصيل المورد.

## 5. مصفوفة ظهور التنقل حسب الدور

الرموز: **L** رابط ظاهر، **I** رابط ظاهر مع inbox محدود، **M** ظاهر مع إدارة، **—** مخفي. الظهور لا يمنح الإذن.

| الدور                | Home |   Workforce |      Time |      Payroll |  Talent |  Governance |       ESS |      Settings |
| -------------------- | ---: | ----------: | --------: | -----------: | ------: | ----------: | --------: | ------------: |
| `super_admin`        |    M |           M |         M |            M |       M |           M |         L |    M/platform |
| `support_agent`      |    I |           — |         — |            — |       — |    I/ticket |         — |             — |
| `billing_admin`      |    I |           — |         — |   I/commerce |       — |           I |         — |     M/billing |
| `org_owner`          |    M |           M |         M |            I |       I |           I |         L |             M |
| `org_admin`          |    M |           M |         M |            I |       I |           I |         L |             M |
| `hr_manager`         |    M |           M |         M |     I/review |       M |           I |         L |      M/policy |
| `hr_operator`        |    I |     M/scope |   I/scope |   L/relevant | I/scope |     L/scope |         L |     L/profile |
| `payroll_officer`    |    I |  L/relevant | L/summary |            M |       — |           I | L/payslip |     L/payroll |
| `finance_officer`    |    I |  L/relevant | L/summary |    M/payment |       — |           I | L/payslip |     L/finance |
| `attendance_officer` |    I |     L/scope |         M |    L/summary |       — |           I |         L |  L/attendance |
| `line_manager`       |    I |      L/team |    I/team |            — |  I/team |      L/team |         L |     L/profile |
| `recruiter`          |    I | L/candidate |         — |            — |       M | L/candidate |         — |     L/profile |
| `performance_lead`   |    I |     L/scope |         — |            — |       M |     L/scope |         L | L/performance |
| `asset_manager`      |    I |     L/scope |         — | L/settlement |       — |           M |         L |      L/assets |
| `auditor`            |    I |      L/read |    L/read |       L/read |  L/read |      M/read |     L/own |       L/audit |
| `employee`           |    L |      L/self |    L/self |    L/payslip |  L/self |       L/own |         M |        L/self |

`org_owner` و`org_admin` و`support_agent` و`billing_admin` تحتاج عقودًا منفصلة عن `UserRole` الحالي؛ لا نعيد استعمال `super_admin` كحل توافق.

## 6. Route taxonomy والـURL contract

### 6.1 القواعد

- public routes في جذر معروف (`/`, `/login`, `/invite`, `/legal`)؛ customer routes تحت `/app`؛ platform routes تحت `/platform`.
- أسماء resources بالإنجليزية الثابتة للروابط وAPI، والعناوين/labels من translation keys.
- معرف المورد opaque أو UUID؛ لا نضع راتبًا، IBAN، token، أو PII في query أو hash.
- route loader يجلب `tenant_context` و`authorization` قبل البيانات؛ access denied لا يتحول إلى 404 إذا كانت الرسالة ستكشف وجود سجل حساس.
- query filters قابلة للمشاركة فقط إذا كانت غير حساسة: `status`, `from`, `to`, `department`, `location`, `page`, `sort`; validation تمنع قائمة IDs عابرة للـtenant.
- كل mutation يعود إلى canonical URL مع flash/status reference، وback يحافظ على filter/page لا على قرار صلاحية قديم.

### 6.2 المسارات الأساسية

| الغرض          | المسار المستهدف                                           | مستوى الحماية                      |
| -------------- | --------------------------------------------------------- | ---------------------------------- |
| تسجيل الدخول   | `/login`                                                  | public + rate limit                |
| دعوة           | `/invite/:token`                                          | token opaque + expiry              |
| تهيئة          | `/app/onboarding/:step`                                   | authenticated + owner/admin        |
| لوحة الدور     | `/app` أو `/app/dashboard`                                | authenticated + membership         |
| inbox          | `/app/inbox`, `/app/requests`                             | role/scope                         |
| موظفون         | `/app/people/employees`, `/app/people/employees/:id`      | people permission + scope          |
| حضور           | `/app/time/attendance`, `/app/time/exceptions/:id`        | time permission + location/team    |
| إجازات         | `/app/time/leaves`, `/app/time/leaves/:id`                | leave permission + scope           |
| الرواتب        | `/app/payroll/runs`, `/app/payroll/runs/:id`              | payroll permission + period status |
| الخدمة الذاتية | `/app/self-service`, `/app/self-service/payslips/:period` | employee link + masked fields      |
| التقارير       | `/app/reports`, `/app/reports/:run_id`                    | report permission + export rules   |
| الإعدادات      | `/app/settings/:section`                                  | settings permission + entitlement  |
| المنصة         | `/platform/:section`                                      | platform role + internal boundary  |

### 6.3 توافق hash الحالي

| hash الحالي           | route target                               | سياسة الرجوع                            |
| --------------------- | ------------------------------------------ | --------------------------------------- |
| `#dashboard`          | `/app`                                     | canonical redirect مع الحفاظ على locale |
| `#employees`          | `/app/people/employees`                    | list state في query آمن                 |
| `#attendance`         | `/app/time/attendance`                     | إذا لا scope يعاد إلى inbox             |
| `#leaves`             | `/app/time/leaves`                         | يعاد إلى my requests للموظف             |
| `#payroll` / `#loans` | `/app/payroll/runs` / `/app/payroll/loans` | لا يكشف أي run غير مسموح                |
| `#reports` / `#audit` | `/app/reports` / `/app/governance/audit`   | export guard قبل job                    |
| `#ess`                | `/app/self-service`                        | إذا الحساب غير مربوط تظهر شاشة الربط    |

يعمل mapping مؤقتًا في طبقة router، ثم يزال بعد نجاح telemetry للروابط القديمة. لا ننشئ redirect يفتح route من hash بلا إعادة authorization.

## 7. مناطق الـApp Shell

| المنطقة        | المحتوى                                                                                  | سلوك RTL/LTR وresponsive                                  |
| -------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Skip link      | «تخطي إلى المحتوى»                                                                       | أول focus، يعمل في الاتجاهين                              |
| Sidebar        | شعار، workspace switcher، groups، active indicator، collapse                             | start/end logical؛ drawer على الهاتف؛ لا يعتمد اللون وحده |
| Header         | breadcrumb مختصر، search/command، data health، language، theme، notifications، user menu | يختصر الأزرار حسب العرض؛ لا يكرر عنوان الصفحة على الهاتف  |
| Context bar    | اسم tenant/entity، period، scope، last refresh                                           | ثابت أثناء التصفية؛ يمنع query من اختيار tenant غير مصرح  |
| Main           | page header، description، primary action، content                                        | `main` له landmark وheading واحد؛ tabs قابلة للوصول       |
| Action footer  | Save/Submit/Approve/Cancel وdirty state                                                  | sticky في form؛ يعكس ترتيب الأزرار في RTL دون عكس المعنى  |
| Status surface | toast، inline alert، job progress، empty/error                                           | رسائل ثنائية اللغة ومحددة الإجراء، لا تفاصيل سرية         |

## 8. Breadcrumbs وcontext وback behavior

العنوان يوضح: `المجموعة / المورد / السجل / الإجراء`. مثال: `الرواتب / مسيرات الشهر / مارس 2026 / مراجعة`. لا نستخدم رقم الموظف أو IBAN في breadcrumb.

- list → detail يحتفظ بـ`return_to` داخليًا أو history state آمن.
- detail → action يفتح route فرعيًا أو drawer عند مهمة قصيرة؛ العمليات المالية الكبيرة لها صفحة مستقلة مع URL قابل للتدقيق.
- بعد approve/reject يعود المستخدم إلى inbox مع filter `status=processed` ورسالة رقم المرجع.
- بعد انتهاء session أو scope نعيد إلى route العام المسموح، ونحتفظ بعنوان النية فقط إذا كان غير حساس.

## 9. البحث وCommand Palette

النسخة المستهدفة توسع `Ctrl/Cmd + K` الحالية إلى بحث موحد:

1. يكتب المستخدم نصًا بالعربية أو الإنجليزية أو رقمًا وظيفيًا؛ debounced query لا ترسل نصًا حساسًا إلى analytics.
2. الخادم يرشح النتائج أولًا بالصلاحية والنطاق والـtenant ثم يرتب exact ID، الاسم، العنوان، الإجراء، والحداثة.
3. الأقسام: `شاشات`، `موظفون`، `طلبات`، `مسيرات`، `تقارير`، `إجراءات سريعة`. لا يظهر salary/IBAN في preview؛ الاسم المقنع يكفي.
4. keyboard navigation: arrows، Enter، Esc، Ctrl/Cmd+K، مع focus trap وإعلان count لقارئ الشاشة.
5. نتيجة access denied لا تشرح وجود سجل؛ تعرض «لا توجد نتائج ضمن نطاقك».
6. الإجراءات السريعة تنفذ navigation فقط أو تفتح form؛ لا تنفذ approve/payment من نتيجة بحث بلا confirmation وSoD.

## 10. مركز الإشعارات والـInbox

`Inbox` ليس مجرد badge. لكل عنصر: النوع، المصدر، النطاق، الأولوية، SLA، الحالة، الإجراء التالي، ووقت آخر تحديث.

- tabs: `يتطلب إجراءً`، `طلباتي`، `معلومات`، `أمني`، `منتهي`.
- filters: type، priority، due date، entity، status؛ لا يوسع filter scope.
- bulk actions مسموحة للقراءة أو archive فقط؛ الاعتمادات المالية فردية أو batch مع policy وconfirmation.
- read/unread مستقل عن workflow state؛ فتح item حساس يسجل access audit.
- notification deep link يعيد فحص الصلاحية ويعيد إلى inbox إذا انتهى الدور أو الرابط.

## 11. Settings Information Architecture

لا نضع كل الإعدادات في modal واحد. الأقسام التالية مستقلة بعناوين وحالة حفظ واضحة:

| القسم                | ما يضبطه                                                       | الدور الأدنى                  |
| -------------------- | -------------------------------------------------------------- | ----------------------------- |
| Tenant profile       | الاسم القانوني، الكيانات، البلد، العملة، timezone، fiscal year | org_owner/org_admin           |
| Members & access     | الدعوات، الأدوار، scopes، delegations، session revoke          | org_owner أو org_admin بسياسة |
| Policies             | حضور، إجازات، overtime، payroll cut-off، approval chains       | hr_manager + approver         |
| Payroll & finance    | payroll groups، bank/WPS mapping، thresholds، accounts         | payroll/finance + Owner       |
| Notifications        | channels، quiet hours، templates، sender domain                | org_admin                     |
| Integrations         | adapters، mappings، webhook receipts، API keys references      | org_admin + change approver   |
| Subscription & usage | plan، seats، storage، invoices، payment method                 | org_owner/billing             |
| Security             | MFA، sessions، SSO، password policy، export/access review      | org_owner + security policy   |
| Localization         | language، RTL/LTR، date/number format، timezone defaults       | org_admin                     |

التغيير الحساس يعرض before/after وeffective date وسببًا؛ لا يطبق إعدادًا ماليًا غير مكتمل من خطوة واحدة.

## 12. Responsive behavior

| العرض            | shell                                        | الجداول والنماذج                                     | الإجراءات                            |
| ---------------- | -------------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Desktop ≥1280    | Sidebar 288px أو collapsed 80px، Header كامل | جدول متعدد الأعمدة، detail side panel                | primary + secondary actions ظاهرة    |
| Laptop 1024–1279 | Sidebar collapsed افتراضيًا، context مختصر   | أعمدة ثانوية في column chooser                       | actions داخل overflow عند الحاجة     |
| Tablet 768–1023  | Sidebar drawer، Header صفان عند الحاجة       | cards أو جدول أفقي قابل للتمرير مع sticky key column | bottom action bar في form            |
| Mobile <768      | Header صغير + drawer + 4–5 quick actions ESS | list/card، filter sheet، لا جدول عريض بلا بديل       | primary CTA ثابت، confirm قبل الحساس |

الهاتف لا يتيح payment/lock/export restricted من زر سريع؛ يعرض summary ويطلب شاشة تأكيد ذات سبب وMFA/SoD حسب policy. touch targets ≥44px، ولا تعتمد hover في أي حالة.

## 13. RTL/LTR والتوطين

- نستخدم `dir` على shell ونمط كتابة عربي فعلي، لا ترجمة كلمات فقط.
- CSS يعتمد `margin-inline`, `padding-inline`, `inset-inline`, `text-align: start`; icons ذات الاتجاه تعكس فقط إن كان معناها حركة.
- التواريخ والأرقام والعملة من tenant/user locale وtimezone؛ تحفظ ISO UTC في API.
- أسماء الموظفين بالعربي والإنجليزي searchable؛ لا نرتب الحروف العربية بترتيب إنجليزي مصطنع.
- النصوص الطويلة في badges/toasts تختبر clipping، والفعل الأساسي يبقى في موضع ثابت منطقيًا.
- كل route state يملك translation key في `ar` و`en`؛ غياب المفتاح يظهر fallback مراقبًا في CI.

## 14. Loading / empty / error / access-denied contracts

| الحالة           | التصميم                                             | الرسالة/الإجراء                        |
| ---------------- | --------------------------------------------------- | -------------------------------------- |
| Loading          | skeleton يحاكي layout ثم status للـjob              | لا تستخدم spinner لا نهائيًا           |
| Empty first-use  | شرح قيمة + CTA خطوة واحدة + sample اختياري Demo فقط | «ابدأ بإضافة أول موظف»                 |
| Empty filtered   | يحافظ على filter ويقترح مسحه                        | «لا توجد نتائج ضمن هذه الشروط»         |
| Validation       | inline عند الحقل + summary أعلى form                | يذكر كيف يصلح المستخدم الخطأ           |
| API retryable    | alert مع Retry وlast attempt                        | لا يغير state إلى success              |
| API terminal     | incident/reference + support path                   | لا يعرض stack trace أو PII             |
| Access denied    | صفحة موحدة لا تكشف وجود السجل                       | رابط inbox أو طلب وصول                 |
| Stale projection | timestamp وbadge stale                              | زر refresh أو فتح المصدر               |
| Expired session  | يحفظ draft المسموح ثم login                         | لا يعيد إرسال restricted fields صامتًا |

## 15. Telemetry للـIA

نسجل أحداث تنقل قليلة ومفيدة: `route_viewed`, `nav_item_opened`, `breadcrumb_back`, `command_palette_opened`, `search_submitted`, `search_result_opened`, `inbox_item_opened`, `access_denied_shown`, `deep_link_fallback`, `locale_changed`, `responsive_action_used`.

كل event يحمل `tenant_id` المشتق داخليًا، role family، route name، locale، viewport class، وcorrelation id؛ لا يحمل اسمًا أو راتبًا أو query كاملًا. نقيس time-to-first-action، search success، dead-end rate، permission fallback، وmobile completion لكل رحلة.

## 16. حالات قبول Information Architecture

| ID    | Given                             | When                         | Then                                                               |
| ----- | --------------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| IA-01 | Employee فعّال                    | يفتح `/app`                  | يرى ESS/dashboard الخاص به ولا تظهر روابط إدارة الرواتب            |
| IA-02 | Manager بفريقين محددين            | يفتح attendance              | كل route/query يحافظ على team scope فقط                            |
| IA-03 | Org Admin بلا billing permission  | يفتح `/app/settings/billing` | access denied أو طلب وصول، دون كشف invoice                         |
| IA-04 | رابط hash قديم `#employees`       | يفتحه المستخدم               | redirect canonical إلى people route مع filters آمنة                |
| IA-05 | رابط deep link لمسير              | تنتهي عضوية Payroll          | يعاد إلى inbox برسالة موحدة ولا يظهر run metadata حساس             |
| IA-06 | مستخدم عربي على الهاتف            | يفتح drawer ويغير اللغة      | RTL، focus، labels، وback behavior سليمة                           |
| IA-07 | جدول 10 آلاف موظف                 | يبحث من Ctrl/Cmd+K           | query server-side وpagination؛ لا تحميل كامل للمتصفح               |
| IA-08 | نتيجتان بنفس الاسم                | يبحث بالاسم                  | يظهر employee no masked/allowed وسياق entity، لا اختيارًا غامضًا   |
| IA-09 | report projection stale           | يفتح Reports                 | يرى stale time وrefresh/job، لا أرقامًا بلا علامة                  |
| IA-10 | API يرجع 403                      | يفتح notification link       | صفحة access denied لا تكشف وجود المورد                             |
| IA-11 | drawer مفتوح                      | يضغط Esc أو خارج drawer      | يغلق مع إعادة focus لزر الفتح                                      |
| IA-12 | form فيه تغييرات                  | يضغط navigation              | confirm أو save draft وفق حساسية البيانات                          |
| IA-13 | Payroll Officer في `/app/payroll` | لا توجد period مفتوحة        | empty state يشرح cut-off ويخفي Execute                             |
| IA-14 | Employee لديه payslip             | يفتح deep link               | يعرض masked/allowed fields وdownload مؤقتًا فقط                    |
| IA-15 | Support ticket منتهية             | يفتح document link           | fallback إلى ticket history ولا signed URL                         |
| IA-16 | locale English ثم reload          | يعود بعد يوم                 | يحافظ على locale المسموح ولا يخلط ترجمة route                      |
| IA-17 | filter يحتوي entity من tenant آخر | يرسل URL                     | validation يحذف القيمة ويرجع scope الحالي                          |
| IA-18 | keyboard-only user                | يتنقل في shell وmodal        | focus order وlandmarks وlabels WCAG core tasks                     |
| IA-19 | slow network أثناء route loader   | يفتح page                    | skeleton ثم retry/status، لا صفحة بيضاء                            |
| IA-20 | Demo mode                         | يبدل role                    | يظهر badge Demo فقط؛ لا يتاح في Live ولا يغير server authorization |

## 17. تسليم الأجزاء التالية

- **PART 7:** تحويل route tree إلى Complete Screen Inventory، مع مكونات كل شاشة وحالاتها.
- **PART 8:** تثبيت Design System وtokens وcomponents لـshell وforms وtables وcharts.
- **PART 9:** ربط الـinbox والـroute actions بـworkflows وapproval states.
- **PART 11–13:** تحويل loaders/guards/search/export إلى API وSecurity وE2E/accessibility tests.

الكتالوج الآلي المرفق يثبت بنية التنقل المقترحة فقط؛ `runtime_enabled` يبقى `false` حتى اعتماد routes وpolicies والاختبارات.
