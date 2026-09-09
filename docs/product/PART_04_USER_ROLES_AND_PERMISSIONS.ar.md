# PART 4 — USER ROLES & PERMISSIONS

**التاريخ:** 8 سبتمبر 2026. **الإصدار:** 0.1 — نموذج صلاحيات مبدئي.

**المرجع:** [PART 3 — Product Architecture](PART_03_PRODUCT_ARCHITECTURE.ar.md)، [خريطة المجالات](PRODUCT_DOMAIN_MAP.ar.md)، و[معايير MVP](MVP_SCOPE_AND_ACCEPTANCE.ar.md).

**الحالة:** مواصفات قابلة للتحويل إلى Schema وAPI واختبارات. لا تغير هذه الوثيقة صلاحيات التطبيق الحالية تلقائيًا.

## 1. القرار الأساسي

نستخدم RBAC قابلًا للتوسعة مع Data Scope وقيود Separation of Duties. الدور يحدد المجموعة الافتراضية، لكن القرار النهائي لكل طلب يمر عبر:

```text
Active session
→ tenant membership
→ released feature
→ subscription entitlement
→ role permission
→ data scope
→ entity/period status
→ separation-of-duties rule
→ audit requirement
```

الواجهة تخفي الإجراء غير المتاح لتحسين الفهم، لكنها لا تمنحه. الخادم وقاعدة البيانات يرفضان المحاولة حتى لو غيّر المستخدم `role` في المتصفح أو أرسل معرف سجل آخر.

**Deny wins:** إذا جمع المستخدم دورين متعارضين أو انتهى التفويض أو فشل نطاق الصف، يرفض الفعل الحساس. الاستثناء الإداري المؤقت لا يفتح كل البيانات؛ يحتاج سببًا ومدة وموافقة وسجلًا.

## 2. ما يظهر في الخط الحالي

| الملاحظة                                                                                              | الدليل                                                                                                                                                                                                                                                                                                                                                 | أثرها على التنفيذ                                                          |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `AuthRole` يتضمن `org_admin`، بينما `UserRole` المستخدم في بعض الواجهة لا يتضمنه                      | [roles.ts](https://github.com/orabi1996/full-project-focus/blob/d3c855537490400667b406baaa14ce0ab0ccf43f/src/lib/auth/roles.ts)، [types/index.ts](https://github.com/orabi1996/full-project-focus/blob/d3c855537490400667b406baaa14ce0ab0ccf43f/src/types/index.ts)                                                                                    | عقد الأنواع يحتاج توحيدًا؛ لا نسقط مدير المنشأة إلى دور آخر                |
| `AppContext` يحول `org_admin` إلى `super_admin` في `mappedAuthenticatedRole`                          | [AppContext](https://github.com/orabi1996/full-project-focus/blob/d3c855537490400667b406baaa14ce0ab0ccf43f/src/lib/context/AppContext.tsx)                                                                                                                                                                                                             | إخفاء فروق الصلاحية يرفع الخطر؛ نفصل الدورين في النموذج الهدف              |
| `moduleAccess` و`moduleManageAccess` قوائم ثابتة للواجهة                                              | [permissions.ts](https://github.com/orabi1996/full-project-focus/blob/d3c855537490400667b406baaa14ce0ab0ccf43f/src/lib/auth/permissions.ts)                                                                                                                                                                                                            | تبقى UI hints؛ مصدر الحقيقة يصبح permission catalog + server authorization |
| يوجد `role_definitions` و`app_permissions` و`role_permissions` و`user_role_assignments` في migrations | [business schema](https://github.com/orabi1996/full-project-focus/blob/d3c855537490400667b406baaa14ce0ab0ccf43f/supabase/migrations/20260831115000_business_schema.sql)                                                                                                                                                                                | نستفيد من الجداول بعد إضافة tenant/scope/effective dates والاختبارات       |
| مجموعات وتجاوزات الصلاحيات في `AppContext` تحفظ أجزاءً في localStorage أثناء Demo                     | [AppContext](https://github.com/orabi1996/full-project-focus/blob/d3c855537490400667b406baaa14ce0ab0ccf43f/src/lib/context/AppContext.tsx)                                                                                                                                                                                                             | لا تستخدم لتحديد صلاحية Live أو حفظ سياسات عميل؛ تنقل إلى DB audit-scoped  |
| سياسات أولية لبعض الجداول كانت عامة ثم جاءت migrations تشديد                                          | [enterprise schema](https://github.com/orabi1996/full-project-focus/blob/d3c855537490400667b406baaa14ce0ab0ccf43f/supabase/migrations/20260830170000_hrms_enterprise_schema.sql)، [hardening](https://github.com/orabi1996/full-project-focus/blob/d3c855537490400667b406baaa14ce0ab0ccf43f/supabase/migrations/20260831113000_security_hardening.sql) | لا نعتمد أي دور أو عزل قبل تطبيق الترحيلات بالترتيب واختبار RLS عميلين     |

هذه الملاحظات تشخيص خط أساس؛ لا تعني أن كل مسار Live مفتوح أو مغلق. تقرير الأمن واختبارات قاعدة البيانات في الأجزاء التالية يحسمان السلوك الفعلي.

## 3. طبقات الأدوار

### أدوار المنصة

| الكود           | الاسم العربي       | الغرض                                           | النطاق الافتراضي                                       |
| --------------- | ------------------ | ----------------------------------------------- | ------------------------------------------------------ |
| `super_admin`   | مدير المنصة        | تشغيل المنتج ودعم الحوادث وإدارة الكتالوج العام | Platform؛ لا يرى بيانات عميل إلا وصولًا مؤقتًا ومدققًا |
| `support_agent` | موظف دعم           | متابعة حالة تهيئة أو تذكرة                      | Ticket/tenant محدد ومؤقت؛ PII مقنع افتراضيًا           |
| `billing_admin` | مسؤول فوترة المنصة | عقود الباقات والفواتير والتحصيل                 | Commerce على tenant المسموح؛ لا رواتب موظفي العميل     |

هذه الأدوار ليست أدوار HR للعميل. وجودها يحتاج tenant/organization boundary منفصلًا وحسابًا داخليًا لا يضاف تلقائيًا إلى `user_roles` الخاصة بالعميل.

### أدوار العميل

| الكود                | الاسم العربي         | المهمة الأساسية                           | النطاق الافتراضي                                 |
| -------------------- | -------------------- | ----------------------------------------- | ------------------------------------------------ |
| `org_owner`          | مالك الاشتراك        | مسؤول العقد والتهيئة والسياسات الحساسة    | Tenant؛ لا يعتمد عملية أنشأها إذا تعارضت القاعدة |
| `org_admin`          | مدير المنشأة         | إدارة الإعدادات والمستخدمين والكيانات     | Tenant / entities الممنوحة                       |
| `hr_manager`         | مدير الموارد البشرية | دورة الموظف والسياسات والاعتمادات         | Tenant أو entities الممنوحة                      |
| `hr_operator`        | أخصائي موارد بشرية   | بيانات الموظفين والطلبات والوثائق اليومية | Department/entity حسب assignment                 |
| `payroll_officer`    | مسؤول الرواتب        | تجهيز ومراجعة المسيرات والسلف             | Payroll groups الممنوحة                          |
| `finance_officer`    | مسؤول المالية        | الدفع والمطابقة والقيود والمصروفات        | Entities/accounts الممنوحة                       |
| `attendance_officer` | مسؤول الحضور         | الأجهزة والورديات والاستثناءات            | Locations/entities الممنوحة                      |
| `line_manager`       | المدير المباشر       | اعتماد فريقه ومتابعة الحضور               | Team؛ لا يقرأ راتب فريقه كاملًا افتراضيًا        |
| `recruiter`          | مسؤول التوظيف        | الشواغر والمرشحون والعروض                 | Recruitment scope                                |
| `performance_lead`   | مسؤول الأداء         | دورات التقييم والأهداف                    | Entities/departments الممنوحة                    |
| `asset_manager`      | مسؤول العهد          | الأصول وإخلاء الطرف                       | Entities/locations الممنوحة                      |
| `auditor`            | المدقق               | قراءة أثر وتقارير محددة                   | Tenant؛ read-only وexport approval حسب السياسة   |
| `employee`           | الموظف               | الخدمة الذاتية وبياناته                   | Self؛ team data لا تظهر له                       |

`org_owner` قرار تجاري مبدئي. إذا لم يحتج العميل دورًا منفصلًا، يمكن ربطه بـ`org_admin` مع entitlement خاص بالعقد، دون رفعه إلى `super_admin`.

## 4. نطاقات البيانات

| الكود             | معنى الوصول                                                 | مثال                    |
| ----------------- | ----------------------------------------------------------- | ----------------------- |
| `self`            | سجلات المستخدم/الموظف المرتبط فقط                           | قسيمته وطلباته وبصماته  |
| `team`            | الموظفون الذين يكون المستخدم مديرهم الفعلي في تاريخ الواقعة | اعتماد إجازة فريق مباشر |
| `department`      | وحدة تنظيمية معينة وموروثاتها النشطة                        | تقرير حضور قسم          |
| `location`        | موقع عمل محدد؛ لا يساوي كل الشركة                           | مسؤول حضور فرع          |
| `entity`          | كيان قانوني/شركة فرعية داخل tenant                          | مسير شركة تابعة         |
| `payroll_group`   | مجموعة رواتب وفتراتها                                       | مسؤول مسير مجموعة معينة |
| `tenant`          | كل بيانات العميل التي يسمح بها الدور                        | HR Manager              |
| `tenant_commerce` | عقود العميل وفواتيره واستحقاقاته التجارية فقط               | مسؤول فوترة المنصة      |
| `platform`        | إعدادات المنتج وبيانات تشغيل غير سرية                       | كتالوج الميزات          |
| `ticket`          | tenant وحالة تذكرة محددان ولمدة                             | Support Agent           |

النطاق ليس اختيارًا حرًا في query. الخادم يحل الصفوف من membership والهيكل والتاريخ، ويضيف شرط `tenant_id` إلى Repository وRLS. عند تعدد النطاقات نأخذ اتحاد الصفوف المسموح بها، وتظل حقول Restricted مقيدة بمستوى الحقل.

### مستويات الحقول

| المستوى               | أمثلة                                   | الأدوار التي يمكنها القراءة عادة            |
| --------------------- | --------------------------------------- | ------------------------------------------- |
| `public_profile`      | الاسم الوظيفي، الموقع، الحالة العامة    | المدير/HR ضمن النطاق                        |
| `confidential_hr`     | العقد، تاريخ الميلاد، الوثيقة الوصفية   | HR والأدوار المفوضة؛ مقنع للمدير            |
| `restricted_payroll`  | الأساسي والبدلات والخصومات والقسيمة     | Payroll وFinance المخول وAuditor عند الحاجة |
| `restricted_identity` | رقم الهوية/الإقامة، IBAN، ملفات الإثبات | HR محدد وPayroll/Finance للحقل المطلوب فقط  |
| `security_secret`     | مفاتيح API وwebhook والـservice role    | لا مستخدم عميل؛ Secret Manager وخدمات خادم  |

صلاحية `view` للمسير لا تعني قراءة IBAN الخام. Query يطلب allowlist حقول، ويعرض Masked value متى كان ذلك كافيًا. كل تنزيل Restricted يسجل actor وreason وobject.

## 5. مصفوفة الوحدات عالية المستوى

الرموز: **V** عرض، **C** إنشاء، **E** تعديل، **D** أرشفة/حذف منطقي، **A** اعتماد، **X** تصدير، **P** تنفيذ مالي/تكامل، **—** لا صلاحية افتراضية. النطاق يؤخذ من القسم 4، و`org_owner` ليس اختصارًا لـ`super_admin`.

| الوحدة          | org_owner | org_admin | hr_manager | hr_operator | payroll       | finance     | attendance  | manager        | recruiter    | performance | asset      | auditor    | employee            |
| --------------- | --------- | --------- | ---------- | ----------- | ------------- | ----------- | ----------- | -------------- | ------------ | ----------- | ---------- | ---------- | ------------------- |
| Tenant/org      | VCE       | VCE       | VE         | V           | —             | V           | V           | V              | V            | V           | V          | VX         | V(self)             |
| Users/Roles     | VCE       | VCE       | VC(scope)  | V           | —             | —           | —           | —              | —            | —           | —          | VX         | V(self)             |
| Employees       | VCE       | VCE       | VCE        | VCE(scope)  | V(relevant)   | V(relevant) | V(scope)    | V(team)        | V(candidate) | V(scope)    | V(scope)   | VX(masked) | V(self), E(request) |
| Documents       | VCE*      | VCE*      | VCE*       | VCE(scope)  | V(payroll)    | V(finance)  | V(scope)    | V(team,masked) | V(candidate) | V(scope)    | VCE(scope) | VX         | V(self)             |
| Schedules       | VCE       | VCE       | VCE        | VE(scope)   | V             | V           | VCE(scope)  | VE(team)       | —            | —           | —          | VX         | V(self)             |
| Attendance      | VCE*      | VCE*      | VCE        | VCE(scope)  | V             | V(summary)  | VCEP(scope) | VA(team)       | —            | —           | —          | VX         | VC(self)            |
| Leave/requests  | VCA*      | VCA*      | VCA        | VCE(scope)  | V             | V(summary)  | V(summary)  | VA(team)       | —            | —           | —          | VX         | VCA(self)           |
| Payroll         | V(review) | V(review) | VA(review) | V           | VCE(scope)    | VA/P(scope) | V(summary)  | —              | —            | —           | —          | VX         | V(payslip)          |
| Advances        | V(review) | V(review) | VCA        | VC(scope)   | VCE/AP(scope) | VA/P(scope) | —           | —              | —            | —           | —          | VX(masked) | VCA(self)           |
| Settlement      | VA*       | VA*       | VCA        | VC(scope)   | VCA(scope)    | VA/P        | —           | —              | —            | —           | V(scope)   | VX         | V(self,clearance)   |
| Expenses        | VA*       | VA*       | V(scope)   | VC(scope)   | V(summary)    | VCAP        | —           | VA(team)       | —            | —           | —          | VX         | VCA(self)           |
| Recruitment     | VCE       | VCE       | VCE        | VCE(scope)  | —             | V(summary)  | —           | V              | VCE          | —           | —          | VX         | —                   |
| Performance     | VCE       | VCE       | VCE        | V(scope)    | —             | —           | —           | VCA(team)      | —            | VCE         | —          | VX         | VCA(self)           |
| Assets          | VCE       | VCE       | VCE        | VCE(scope)  | V(settlement) | V(finance)  | —           | V(team)        | —            | —           | VCE(scope) | VX         | VCA(self)           |
| Reports         | VX        | VX        | VX         | V(scope)    | VX(scope)     | VX(scope)   | VX(scope)   | VX(team)       | VX(scope)    | VX(scope)   | VX(scope)  | VX         | V(self)             |
| Integrations    | V/P*      | V/P*      | V          | —           | V             | VP(scope)   | VCE(scope)  | —              | —            | —           | —          | VX(masked) | —                   |
| Billing/support | VCA*      | VCA       | V          | —           | —             | V(summary)  | —           | —              | —            | —           | —          | V(own)     | —                   |
| Audit           | V         | V         | V          | V(scope)    | V(scope)      | V(scope)    | V(scope)    | V(team)        | V(scope)     | V(scope)    | V(scope)   | VX         | V(own actions)      |

`*` يحتاج سببًا أو تفويضًا أو قواعد خاصة. `payroll` اختصار لمسؤول الرواتب، و`finance` لمسؤول المالية، و`manager` للمدير المباشر، و`asset` لمسؤول العهد. هذه مصفوفة إطلاق مبدئية؛ القرار النهائي يُشتق من permission catalog والكيان والنطاق لا من حرف واحد.

### الأفعال الحساسة بالتفصيل

| العملية                 | من ينشئ/يجهز                      | من يراجع                          | من يعتمد/ينفذ                | ممنوعة على                            |
| ----------------------- | --------------------------------- | --------------------------------- | ---------------------------- | ------------------------------------- |
| تغيير عقد أو راتب       | HR Manager/HR Operator حسب النطاق | HR Manager أو Owner               | معتمد مستقل حسب سياسة العميل | الموظف، مدير الفريق، المدقق           |
| اعتماد تصحيح بصمة/إضافي | موظف/Manager/Attendance           | Attendance Officer أو Manager     | HR/المفوض وفق workflow       | صاحب الطلب لنفسه                      |
| اعتماد إجازة            | الموظف                            | المدير المباشر                    | المدير ثم HR عند الحاجة      | الموظف لنفس طلبه                      |
| حساب مسير               | Payroll Officer                   | HR/Finance reviewer               | Payroll approver مستقل       | Finance لا يعدل snapshot؛ الموظف      |
| قفل مسير                | Payroll Officer                   | Reviewer مستقل                    | Payroll/Owner وفق العقد      | معد المسير إذا كانت القاعدة four-eyes |
| تسجيل تنفيذ دفع         | Finance Officer                   | Finance/Owner حسب العقد           | مفوض دفع مستقل عن المعد      | Payroll Officer وحده                  |
| إنشاء/تعديل سلفة        | HR/Payroll                        | Finance أو HR Manager             | مفوض مالي حسب المبلغ         | الموظف لنفسه، المدقق                  |
| إغلاق مخالصة            | HR/Asset/Payroll                  | HR Manager وFinance               | Owner/Finance حسب السياسة    | الموظف وحده، معد البند وحده           |
| تصدير ملف رواتب         | Payroll/Finance                   | Auditor أو approver بحسب الحساسية | مستخدم مخول + reason         | manager/employee                      |
| ربط موصل أو سر          | Integration Admin                 | Security/Owner                    | Owner أو change approver     | جميع أدوار HR اليومية                 |
| منح دور حساس            | Org Owner/Org Admin               | Admin ثانٍ عند MFA/SoD            | Org Owner أو platform policy | الموظف لنفسه، Support بلا تفويض       |

**الاستثناء الإداري:** `super_admin` داخلي يمكنه تشغيل break-glass في حادث فقط: مدة قصيرة، سبب إلزامي، ticket، موافقة ثانية إن أمكن، وحقول مقنعة افتراضيًا. لا يوقع بدل العميل عقدًا ولا يثبت دفع راتب.

## 6. تفويض الصلاحية Delegation

التفويض مورد مؤرخ لا دور دائم:

| الحقل               | القاعدة                                                   |
| ------------------- | --------------------------------------------------------- |
| `delegator_user_id` | مستخدم يملك الصلاحية أصلًا                                |
| `delegate_user_id`  | عضو tenant نشط يحمل الحد الأدنى من الدور                  |
| `permission_codes`  | قائمة ضيقة، لا wildcard                                   |
| `scope`             | entities/departments/requests المحددة                     |
| `starts_at/ends_at` | إلزاميان؛ لا نهاية مفتوحة؛ لا يتجاوزان 30 يومًا افتراضيًا |
| `reason`            | مطلوب للعمليات المالية أو الوثائق المقيدة                 |
| `approval`          | موافقة Owner/HR أو policy؛ لا يعتمد المفوض طلبه الأصلي    |
| `revoked_at`        | إلغاء فوري يسجل الفاعل والسبب                             |

عند التعارض، الإلغاء أو انتهاء المدة أو توقف العضوية يتغلب على التفويض. كل قرار يظهر هل استند إلى role أصلي أم delegation، دون كشف أسرار.

## 7. دورة حياة الدور والصلاحية

1. إنشاء tenant وعضو بدعوة وحالة `invited`.
2. قبول الدعوة والتحقق من البريد/MFA حسب الحساسية.
3. إسناد دور ونطاق وكيان من Admin مخول؛ لا ينشئ الاشتراك دورًا.
4. اختبار أقل صلاحية بقراءة/كتابة/اعتماد/تصدير، ثم تفعيل assignment.
5. مراجعة دورية للصلاحيات الحساسة؛ إشعار قبل انتهاء تفويض أو عضوية.
6. تعليق أو إلغاء الدور فور انتهاء العمل/الموقع/العقد؛ الجلسات الحساسة تلغى.
7. حفظ التاريخ دون حذف assignment أو audit؛ الاستعادة تتم بإسناد جديد بسبب.

تغيير role لا يغير أثر القرارات السابقة ولا يعيد فتح مسير. نقل المدير أو الموظف يحتاج effective date حتى لا يعيد كتابة نطاق تاريخ قديم.

## 8. API وSchema contracts المبدئية

الأسماء التالية تُنفذ وتُختبر في PART 10–12:

| العقد                    | أهم الحقول                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `role_definitions`       | `tenant_id?`, `code`, `name_ar/en`, `is_system`, `data_scope_default`, `status`                     |
| `permission_definitions` | `code`, `module`, `resource`, `action`, `sensitivity`, `release_target`                             |
| `role_permissions`       | `tenant_id?`, `role_id`, `permission_id`, `scope_type`, `scope_ids`, `effective_from/to`            |
| `user_role_assignments`  | `tenant_id`, `user_id`, `role_id`, `assigned_by`, `reason`, `effective_from/to`, `revoked_at`       |
| `delegations`            | الحقول السبعة في القسم 6 + approval/audit                                                           |
| `access_decisions`       | `correlation_id`, `actor`, `permission`, `scope`, `resource`, `result`, `reason_code`, `created_at` |
| `break_glass_sessions`   | `actor`, `tenant`, `reason`, `ticket`, `starts_at`, `expires_at`, `approved_by`, `revoked_at`       |

الاستعلام المبدئي `GET /api/v1/me/authorization` يعيد permission codes وscopes وfeature entitlements لإظهار الواجهة. لا تعتمد العمليات المالية على هذا الرد؛ تعيد تطبيق القرار في الخادم وRLS.

## 9. حالات قبول الصلاحيات

| ID      | Given                                       | When                                       | Then                                                              |
| ------- | ------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| RBAC-01 | موظف A وموظف B في tenantين                  | A يطلب B بالمعرف                           | رفض موحد بلا كشف وجود السجل                                       |
| RBAC-02 | Employee مربوط بسجل واحد                    | يفتح ESS                                   | يرى سجله فقط؛ الحساب غير المرتبط يرى طلب ربط                      |
| RBAC-03 | Line Manager يدير فريقًا                    | يفتح طلب موظف خارج فريقه                   | لا يقرأ ولا يعتمد؛ تغيير query لا يوسّع النطاق                    |
| RBAC-04 | Payroll Officer أنشأ مسيرًا                 | يحاول Lock/Payment بحسب four-eyes          | يرفض إن كانت السياسة تمنع اعتماده الذاتي ويسجل السبب              |
| RBAC-05 | Finance Officer يحمل payment permission فقط | يحاول تعديل راتب أساسي                     | يرفض؛ يستطيع خطوة الدفع المعتمدة فقط                              |
| RBAC-06 | Employee قدم إجازة                          | يحاول Approve طلبه بتبديل الدور            | يرفض على الخادم وRLS؛ لا يتغير الرصيد                             |
| RBAC-07 | Delegation انتهت                            | يرسل command صحيح الشكل                    | يرفض `delegation_expired`                                         |
| RBAC-08 | Delegation لنطاق قسم واحد                   | يقرأ موظف قسم آخر                          | لا يرى القسم الآخر ولا في export                                  |
| RBAC-09 | Auditor read-only                           | يرسل PATCH/DELETE                          | يرفض، ويظل سجله قادرًا على قراءة الأثر المسموح                    |
| RBAC-10 | Support Agent لديه ticket منتهية            | يطلب employee document                     | يرفض؛ لا signed URL                                               |
| RBAC-11 | Org Admin يحاول منح نفسه super_admin        | يرسل assignment                            | يرفض أو يحتاج Owner/Platform policy؛ لا يتحول الدور تلقائيًا      |
| RBAC-12 | Feature غير released لكن entitlement موجود  | المستخدم يرسل command                      | يرفض `feature_not_released`؛ لا يعتمد flag في المتصفح             |
| RBAC-13 | Subscription Past due                       | المستخدم يريد قراءة تاريخ مصرح             | يسمح بالوصول المتفق عليه/التصدير ولا يمنح عمليات جديدة خارج العقد |
| RBAC-14 | Support break-glass بمبرر ومدة              | يفتح تذكرة مصرحًا بها                      | يرى الحقول المقنعة فقط، يسجل كل قراءة، وتنتهي الجلسة تلقائيًا     |
| RBAC-15 | Role assignment يتغير وسط request           | يكرر command                               | يحسم effective version واحدة أو يعيد conflict؛ لا قرارين متعارضين |
| RBAC-16 | مستخدم يحمل HR وAuditor                     | يحاول حذف سجل                              | Deny wins حسب سياسة الحساسية؛ audit يسجل الدور الفعلي والسبب      |
| RBAC-17 | export يتضمن IBAN                           | role لديه report view ولا restricted field | يعرض masked أو يرفض الملف؛ لا يتجاوز report permission            |
| RBAC-18 | tenant membership معلقة                     | الجلسة ما زالت موجودة                      | يرفض كل Query/Command ويُلغي session الحساسة                      |

## 10. خطة الانتقال

| الدفعة | التنفيذ                                                      | شرط الإغلاق                                 |
| ------ | ------------------------------------------------------------ | ------------------------------------------- |
| R0     | توحيد `AuthRole/UserRole` وإزالة mapping إلى super_admin     | اختبار كل الأدوار، وorg_admin منفصل         |
| R1     | إضافة catalog codes وscope types دون إلغاء القوائم الحالية   | UI يستخدم catalog للعرض وserver يحكم        |
| R2     | tenant memberships وassignments effective dates وdelegations | عميلان، فرق نطاق، انتهاء تفويض              |
| R3     | نقل permission groups/overrides من localStorage إلى DB       | reload/session جديدة تحفظ القرار والتدقيق   |
| R4     | تطبيق four-eyes على payroll/payment/settlement               | اختبار تعارض المستخدم والتكرار              |
| R5     | استبدال RLS العامة بسياسات tenant/scope وتشغيل matrix        | صفر cross-tenant في DB/storage/export       |
| R6     | إزالة compatibility flags والقوائم غير المستخدمة             | grep/contract test لا يثبت مصدر صلاحية ثاني |

لا نفذ R0–R6 كـmigration واحدة. كل دفعة قابلة للتراجع ومربوطة بـcontract tests؛ تعطل صلاحية عميل قائم يعالج بخطة assignment موثقة، لا بتوسيع كل الأدوار.

## 11. ما ينتقل إلى الأجزاء التالية

- PART 5: رحلات كل دور من الدعوة إلى إنجاز المهمة والاعتراض والخروج.
- PART 6: وضع الصلاحيات في Navigation وroute guards وresponsive UX.
- PART 7: جرد شاشات إدارة المستخدمين والأدوار والتفويض وAccess denied.
- PART 10–12: جداول membership/role/permission، API، RLS، MFA، وaudit.
- PART 13: تحويل RBAC-01–18 إلى اختبارات Unit/Integration/RLS/E2E.

المخرج الحالي القابل للاستهلاك آليًا هو [كتالوج الأدوار والصلاحيات المبدئي](ROLE_PERMISSION_CATALOG.draft.json). جميع الأدوار فيه `runtime_enabled: false` حتى لا يتحول المستند إلى صلاحيات فعلية بمجرد رفعه.
