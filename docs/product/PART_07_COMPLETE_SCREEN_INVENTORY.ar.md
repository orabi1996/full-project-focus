# PART 7 — COMPLETE SCREEN INVENTORY

**التاريخ:** 8 سبتمبر 2026. **الإصدار:** 0.1 — جرد شاشات مبدئي قابل للتحويل إلى تصميم واختبار.

**المرجع:** [PART 5 — User Journeys](PART_05_USER_JOURNEYS.ar.md)، [PART 6 — Information Architecture](PART_06_INFORMATION_ARCHITECTURE.ar.md)، [كتالوج الرحلات](USER_JOURNEY_CATALOG.draft.json)، و[المكونات الحالية](../../src/components).

**الحالة:** الجرد يصف 160 شاشة مقترحة تشمل المساحات العامة والعميل والمنصة وESS. وجود شاشة في الكتالوج لا يعني أنها منفذة أو متاحة لمستخدم حقيقي.

## 1. عقد الشاشة الموحد

كل عنصر في [الكتالوج الآلي](SCREEN_INVENTORY.draft.json) يحمل الحقول التي يحتاجها Product وDesign وEngineering وQA:

| الحقل                   | ما يصفه                                                              | مصدر القرار                       |
| ----------------------- | -------------------------------------------------------------------- | --------------------------------- |
| name_ar وlabel_key      | العنوان العربي ومفتاح الترجمة الإنجليزية                             | Localization وRTL                 |
| route وentry            | الرابط ونقطة الدخول من sidebar أو inbox أو deep link أو quick action | Information Architecture والرحلات |
| roles وpermissions      | الأدوار أو أنواع الممثلين والصلاحيات والنطاق الأدنى                  | PART 4                            |
| purpose وlayout         | النتيجة التجارية والهيكل العام                                       | UX                                |
| main_components         | Header وcards وtables وforms وtimeline وcharts وdialogs              | Design System                     |
| actions وbuttons        | إجراءات المستخدم وتسميات الأزرار الأولية                             | Workflows وMicrocopy              |
| fields وfilters وtables | البيانات ونطاق البحث والـcolumns المبدئية                            | Domain وAPI                       |
| validation              | قواعد الشكل والنطاق والتزامن والحساسية                               | Security وBusiness Rules          |
| state_profile           | عقد loading وempty وerror وsuccess القياسي                           | QA وAccessibility                 |
| apis وrelated           | عقود القراءة والكتابة وروابط الرحلة                                  | Architecture                      |

أسماء الحقول في الكتالوج مفاتيح عقد وليست أسماء أعمدة قاعدة البيانات النهائية. يحدد state_profile حالات الشاشة الأربع؛ لا يسمح للواجهة بإخفاء failure خلف success toast.

## 2. قواعد تصميم مشتركة

- لكل شاشة heading واحد، وصف قصير، primary action واحد، وbreadcrumb قابل للرجوع.
- الـlist تعرض filters وpagination ووقت as_of؛ الـdetail تعرض status وowner وrelated actions؛ الـform تعرض dirty state وvalidation summary؛ الـworkflow تعرض صاحب الخطوة وSLA والتعليق؛ التقرير يعرض مصدر الإسقاط ووقت التحديث.
- أي زر اعتماد أو قفل أو دفع أو تصدير مقيد يعيد فحص الصلاحية وSoD ويطلب confirmation وreason عند الحاجة. إخفاء الزر تحسين UX فقط.
- كل route يمر بالترتيب: session ثم membership ثم feature ثم entitlement ثم permission ثم scope ثم status ثم SoD ثم audit.
- لا يظهر salary أو IBAN أو identity files في table أو search preview إلا بحقول masked وpermission صريح. روابط المستندات private ومؤقتة.
- كل عملية طويلة job لها progress وretry آمن وDLQ؛ failure لا يتحول إلى success.
- التوطين عربي وEnglish من البداية: RTL logical layout، تاريخ ورقم وعملة من locale وtimezone، وlabels لا تعتمد على اتجاه النص.
- الهاتف يستخدم cards وfilter sheet وsticky primary action؛ الجداول العريضة لها بديل list أو column chooser، وtouch target لا يقل عن 44px.

## 3. عقد الحالات القياسي

| state_profile | Loading                                     | Empty                                                 | Error                                            | Success                                    |
| ------------- | ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| analytics     | skeleton للـKPI والرسوم والجداول            | لا بيانات في الفترة؛ CTA لتغيير filter أو إعداد مصدر  | تقرير stale أو تعذر المصدر مع refresh            | مؤشرات مع as_of وdrill-down مسموح          |
| auth          | تأكيد الجلسة أو التحدي مع مؤشر زمني         | لا توجد جلسة أو دعوة صالحة؛ طلب رابط جديد             | رسالة موحدة قابلة للإصلاح دون كشف وجود الحساب    | جلسة أو عضوية موثقة وتحويل إلى route مسموح |
| detail        | skeleton للملخص وtabs                       | المورد غير متاح ضمن النطاق أو archived                | تعذر تحميل المورد؛ فتح inbox أو تذكرة            | مورد مقروء مع status وrelated actions      |
| form          | تحميل draft أو versions مع disabled actions | نموذج جديد مع تعليمات وأمثلة                          | رسائل inline وsummary وعدم فقد الحقول            | حفظ أو إرسال برقم مرجعي وحالة تالية        |
| list          | skeleton للمرشحات والصفوف                   | CTA أول قيمة أو رسالة لا نتائج ضمن filter             | Retry مع آخر query آمن                           | نتيجة مفلترة مع pagination ووقت التحديث    |
| marketing     | هيكل محتوى skeleton ثم CTA                  | لا توجد حالة فارغة؛ يظهر محتوى التعريف أو contact CTA | تعذر تحميل المحتوى؛ Retry أو Contact             | محتوى مترجم وCTA واضح                      |
| mobile        | cards وquick actions skeleton               | لا توجد مهمة؛ إرشاد لأول إجراء                        | رسالة قصيرة وretry لا تعطل ESS                   | إجراء واحد واضح مع status ووقت آخر تحديث   |
| system        | health cards skeleton مع job heartbeat      | لا توجد حوادث أو نتائج ضمن filter                     | incident reference وsupport path دون stack trace | حالة موثقة مع audit وlast check            |
| upload        | progress قابل للاستئناف وعدّاد صفوف         | قالب وروابط قواعد الملف قبل الرفع                     | أخطاء صفية قابلة للتنزيل مع retry idempotent     | job reference وaccepted/rejected counts    |
| wizard        | skeleton للخطوة مع progress محفوظ           | ابدأ الخطوة مع شرح الحقول المطلوبة                    | inline validation مع حفظ draft المسموح           | حفظ النسخة وإظهار الخطوة التالية والمرجع   |
| workflow      | timeline skeleton مع صاحب الخطوة            | لا توجد خطوة متاحة أو inbox فارغ                      | Retry أو escalation دون تغيير الحالة             | قرار محفوظ وإشعار وnext action             |

كل شاشة في الكتالوج تشير إلى profile واحد، ويمكن لـQA تحويله إلى snapshots وE2E وaccessibility checks. الاستثناءات الخاصة بالشاشة تضاف في ticket ولا تكسر العقد العام.

## 4. جرد الشاشات

عدد الشاشات في الكتالوج: **160**.

### المساحة العامة والهوية (12)

| ID   | الشاشة                  | المسار            | الدور الأساسي          | النمط   | الغرض                                             |
| ---- | ----------------------- | ----------------- | ---------------------- | ------- | ------------------------------------------------- |
| S001 | الصفحة التعريفية        | /                 | visitor                | landing | شرح قيمة منصة Classera Pulse HCM ومسار التجربة    |
| S002 | نظرة المنتج             | /product          | visitor                | landing | عرض الوحدات والفائدة بحسب حجم المنشأة             |
| S003 | الأمن والخصوصية         | /security         | visitor                | landing | شرح مبادئ العزل والتدقيق وحماية البيانات          |
| S004 | الباقات والتجربة        | /pricing          | visitor                | landing | عرض فرضيات الباقات وشروط التجربة قبل اعتماد السعر |
| S005 | تسجيل الدخول            | /login            | visitor                | auth    | بدء جلسة باستخدام البريد أو SSO المعتمد           |
| S008 | طلب استعادة كلمة المرور | /recovery         | visitor                | auth    | طلب رابط استعادة دون كشف وجود البريد              |
| S006 | التحقق متعدد العوامل    | /mfa              | employee_or_org_member | auth    | إثبات عامل إضافي قبل فتح الجلسة الحساسة           |
| S007 | تأكيد البريد            | /verify           | employee_or_org_member | auth    | تأكيد ملكية البريد قبل تفعيل العضوية              |
| S009 | تعيين كلمة مرور جديدة   | /recovery/reset   | employee_or_org_member | auth    | تعيين كلمة مرور عبر token قصير العمر              |
| S010 | قبول دعوة العضوية       | /invite/:token    | employee_or_org_member | auth    | قبول الدعوة ومراجعة الدور والنطاق قبل الإنشاء     |
| S011 | مراجعة الجلسات والأجهزة | /account/sessions | employee_or_org_member | auth    | عرض وإلغاء الجلسات النشطة للحساب                  |
| S012 | الوصول غير المسموح      | /access-denied    | employee_or_org_member | auth    | شرح الرفض وتوجيه المستخدم إلى inbox أو طلب وصول   |

### الرئيسية (1)

| ID   | الشاشة              | المسار | الدور الأساسي          | النمط     | الغرض                                    |
| ---- | ------------------- | ------ | ---------------------- | --------- | ---------------------------------------- |
| S013 | لوحة الدور الرئيسية | /app   | employee_or_org_member | analytics | عرض مؤشرات ومهام اليوم حسب الدور والنطاق |

### تهيئة العميل (11)

| ID   | الشاشة                 | المسار                                | الدور الأساسي      | النمط  | الغرض                                             |
| ---- | ---------------------- | ------------------------------------- | ------------------ | ------ | ------------------------------------------------- |
| S014 | الكيان القانوني        | /app/onboarding/legal-entity          | org_owner          | form   | إنشاء أول شركة أو كيان داخل tenant                |
| S015 | اللغة والعملة والمنطقة | /app/onboarding/localization          | org_owner          | form   | تثبيت locale والعملة والمنطقة الزمنية             |
| S016 | الهيكل التنظيمي الأولي | /app/onboarding/organization          | org_admin          | form   | تعريف الأقسام والمناصب والمديرين                  |
| S017 | مواقع العمل والسياج    | /app/onboarding/locations             | attendance_officer | form   | تعريف المواقع وtimezone ونطاق الحضور              |
| S018 | سياسات البداية         | /app/onboarding/policies              | hr_manager         | form   | اختيار سياسات الحضور والإجازة والاعتماد الأولية   |
| S019 | مجموعات الرواتب        | /app/onboarding/payroll-groups        | payroll_officer    | form   | تعريف مجموعات الفترات والكيانات ومواعيد القطع     |
| S020 | استيراد الموظفين       | /app/onboarding/import                | hr_operator        | upload | رفع قالب الموظفين والتحقق من الصفوف               |
| S021 | مطابقة أعمدة الاستيراد | /app/onboarding/import/mapping        | hr_operator        | upload | ربط أعمدة الملف بعقد People                       |
| S022 | أخطاء الاستيراد        | /app/onboarding/import/errors/:job_id | hr_operator        | detail | مراجعة الصفوف المرفوضة وإعادة تشغيلها بأمان       |
| S023 | قائمة تهيئة العميل     | /app/onboarding/checklist             | org_admin          | wizard | متابعة خطوات التفعيل وأصحابها وموعدها             |
| S024 | أول قيمة مكتملة        | /app/onboarding/first-value           | org_owner          | detail | تأكيد أول موظف أو أول طلب وخطوة الاستخدام التالية |

### شؤون الموظفين والهيكل (20)

| ID   | الشاشة                 | المسار                                 | الدور الأساسي   | النمط     | الغرض                                      |
| ---- | ---------------------- | -------------------------------------- | --------------- | --------- | ------------------------------------------ |
| S025 | دليل الموظفين          | /app/people/employees                  | hr_operator     | list      | البحث في سجل الموظفين ضمن النطاق           |
| S044 | المناصب والقوى المخططة | /app/organization/positions            | hr_operator     | list      | مقارنة headcount المخطط بالمشغول           |
| S026 | ملف الموظف 360         | /app/people/employees/:id              | hr_manager      | profile   | عرض ملخص الموظف وtabs المسموحة             |
| S027 | بيانات الهوية الشخصية  | /app/people/employees/:id/personal     | hr_operator     | detail    | مراجعة البيانات الشخصية المقنعة وتاريخها   |
| S028 | العقد والوظيفة         | /app/people/employees/:id/employment   | hr_operator     | detail    | عرض employment المؤرخ والمدير والموقع      |
| S031 | وثائق الموظف           | /app/people/employees/:id/documents    | hr_operator     | detail    | إدارة metadata والرفع الخاص للمستندات      |
| S032 | سجل حضور الموظف        | /app/people/employees/:id/attendance   | hr_operator     | detail    | مراجعة punch والقرارات ضمن النطاق          |
| S033 | أرصدة إجازات الموظف    | /app/people/employees/:id/leaves       | hr_operator     | detail    | عرض الرصيد والحجوزات والتسويات             |
| S029 | التعويضات والراتب      | /app/people/employees/:id/compensation | hr_manager      | detail    | مراجعة salary profile المؤرخ والبدلات      |
| S030 | البنك وملف الدفع       | /app/people/employees/:id/bank         | payroll_officer | detail    | عرض بيانات الدفع المقنعة حسب الصلاحية      |
| S034 | عهد الموظف             | /app/people/employees/:id/assets       | asset_manager   | detail    | عرض الأصول المسندة وخطوات الإرجاع          |
| S035 | إضافة موظف: الهوية     | /app/people/employees/new/personal     | hr_operator     | wizard    | بدء إنشاء Person بالبيانات المطلوبة        |
| S036 | إضافة موظف: الوظيفة    | /app/people/employees/new/employment   | hr_operator     | wizard    | تحديد الكيان والقسم والمدير والموقع        |
| S037 | إضافة موظف: التعويض    | /app/people/employees/new/compensation | hr_operator     | wizard    | إدخال salary profile وpayroll group المقنع |
| S038 | إضافة موظف: المستندات  | /app/people/employees/new/documents    | hr_operator     | wizard    | رفع مستندات التعيين إلى private storage    |
| S039 | إضافة موظف: المراجعة   | /app/people/employees/new/review       | hr_operator     | wizard    | فحص كامل قبل الحفظ أو الإرسال للاعتماد     |
| S040 | خط حياة الموظف         | /app/people/employees/:id/lifecycle    | hr_manager      | timeline  | تتبع hire والنقل والتغييرات والخروج        |
| S041 | استيراد موظفين جماعي   | /app/people/import                     | hr_operator     | upload    | تشغيل job استيراد مع progress وchecksum    |
| S042 | حل التكرارات           | /app/people/import/duplicates/:job_id  | hr_operator     | detail    | مقارنة الصفوف بسجلات Person القائمة        |
| S043 | المخطط الهيكلي         | /app/organization/chart                | org_admin       | analytics | استكشاف hierarchy والوظائف والمديرين       |

### الأدوار والوصول (10)

| ID   | الشاشة              | المسار                          | الدور الأساسي | النمط     | الغرض                                         |
| ---- | ------------------- | ------------------------------- | ------------- | --------- | --------------------------------------------- |
| S045 | أعضاء العميل        | /app/access/members             | org_admin     | list      | إدارة العضويات وحالات الدعوة                  |
| S046 | دعوة عضو            | /app/access/members/invite      | org_admin     | form      | إنشاء دعوة بدور ونطاق وتاريخ فعالية           |
| S047 | كتالوج الأدوار      | /app/access/roles               | org_owner     | list      | عرض الأدوار وصلاحياتها النظامية والمخصصة      |
| S048 | تحرير دور           | /app/access/roles/:id           | org_owner     | form      | تكوين permissions مع deny وSoD                |
| S049 | نطاق عضو            | /app/access/scopes/:member_id   | org_admin     | form      | تحديد departments/entities/locations المسموحة |
| S050 | التفويضات           | /app/access/delegations         | org_admin     | list      | مراجعة التفويضات المؤرخة وإلغائها             |
| S051 | مراجعة الوصول       | /app/access/reviews             | auditor       | analytics | مراجعة الصلاحيات الحساسة والدورية             |
| S052 | سلاسل الموافقات     | /app/access/approval-chains     | hr_manager    | list      | فهرس workflows حسب الطلب والسياسة             |
| S053 | مصمم سلسلة الموافقة | /app/access/approval-chains/:id | hr_manager    | form      | اختبار ترتيب المعتمدين والبدائل وSLA          |
| S054 | قرار وصول مفرد      | /app/access/decisions/:id       | auditor       | detail    | عرض سبب allow أو deny والscope والaudit       |

### الوقت والحضور (16)

| ID   | الشاشة                 | المسار                                      | الدور الأساسي      | النمط     | الغرض                                    |
| ---- | ---------------------- | ------------------------------------------- | ------------------ | --------- | ---------------------------------------- |
| S055 | لوحة الحضور المباشرة   | /app/time/attendance                        | attendance_officer | analytics | عرض نسب الحضور والتأخير ومصدر البيانات   |
| S056 | الكشف اليومي           | /app/time/attendance/daily                  | attendance_officer | table     | مراجعة حضور اليوم والورديات والاستثناءات |
| S057 | حضور الموظف            | /app/time/attendance/me                     | employee           | detail    | عرض punches وساعات اليوم وطلب التصحيح    |
| S058 | صندوق استثناءات الحضور | /app/time/attendance/exceptions             | attendance_officer | list      | ترتيب الاستثناءات حسب SLA والنطاق        |
| S059 | تفصيل استثناء الحضور   | /app/time/attendance/exceptions/:id         | attendance_officer | workflow  | اعتماد أو رفض التصحيح أو الإضافي مع سبب  |
| S060 | أجهزة البصمة           | /app/time/devices                           | attendance_officer | list      | مراقبة الأجهزة والمفاتيح وحالة الاتصال   |
| S061 | تسجيل جهاز بصمة        | /app/time/devices/new                       | attendance_officer | form      | إضافة جهاز بمفتاح وتوقيع وموقع محدد      |
| S062 | استيراد البصمات        | /app/time/attendance/import                 | attendance_officer | upload    | رفع batch punch مع checksum              |
| S063 | مطابقة ملف البصمة      | /app/time/attendance/import/:job_id/mapping | attendance_officer | upload    | مطابقة employee/device/time columns      |
| S064 | الحجر والصفوف المرفوضة | /app/time/attendance/quarantine/:job_id     | attendance_officer | detail    | فحص الصفوف غير الآمنة وإعادة تشغيلها     |
| S065 | قائمة الورديات         | /app/time/shifts                            | attendance_officer | list      | إدارة قوالب الورديات والمرونة            |
| S066 | تحرير وردية            | /app/time/shifts/:id                        | attendance_officer | form      | تعريف أوقات العمل والاستراحات والتسامح   |
| S067 | جدول الورديات          | /app/time/scheduler                         | attendance_officer | calendar  | توزيع الورديات ومراجعة التغطية           |
| S068 | قواعد الإضافي والتأخير | /app/time/overtime-rules                    | hr_manager         | settings  | ضبط القواعد التي تنتج facts للرواتب      |
| S070 | سياسة الحضور           | /app/time/policies                          | hr_manager         | settings  | إدارة grace والغياب والتصحيح والاعتماد   |
| S069 | مواقع الحضور           | /app/time/locations                         | attendance_officer | list      | إدارة المواقع وgeofence وtimezone        |

### الإجازات والطلبات (10)

| ID   | الشاشة               | المسار                           | الدور الأساسي | النمط     | الغرض                                     |
| ---- | -------------------- | -------------------------------- | ------------- | --------- | ----------------------------------------- |
| S071 | لوحة الإجازات        | /app/time/leaves                 | hr_manager    | analytics | عرض الرصيد والاستخدام والطلبات المعلقة    |
| S072 | إجازاتي              | /app/time/leaves/me              | employee      | list      | متابعة طلبات الموظف والحجوزات             |
| S073 | طلب إجازة جديد       | /app/time/leaves/new             | employee      | form      | إرسال طلب مع حساب الأيام والرصيد          |
| S074 | تفصيل طلب الإجازة    | /app/time/leaves/:id             | employee      | workflow  | متابعة القرار والاعتراض والإلغاء          |
| S075 | تقويم إجازة الفريق   | /app/time/leaves/team-calendar   | line_manager  | calendar  | التخطيط لتغطية الفريق دون كشف زائد        |
| S076 | سياسات الإجازات      | /app/time/leaves/policies        | hr_manager    | settings  | إدارة الأنواع والاستحقاق والحجز           |
| S077 | أرصدة الإجازات       | /app/time/leaves/balances        | hr_operator   | list      | مراجعة الأرصدة حسب الموظف والفترة         |
| S078 | تعديل رصيد           | /app/time/leaves/balances/adjust | hr_manager    | form      | إضافة adjustment بسبب موثق دون حذف ledger |
| S079 | صندوق اعتماد الطلبات | /app/inbox/approvals             | line_manager  | workflow  | عرض كل الطلبات التي تنتظر دور المستخدم    |
| S080 | قرار اعتماد مفرد     | /app/inbox/approvals/:id         | line_manager  | workflow  | اتخاذ قرار مع comment وSoD وSLA           |

### الرواتب والمالية (29)

| ID   | الشاشة               | المسار                                | الدور الأساسي   | النمط     | الغرض                                                  |
| ---- | -------------------- | ------------------------------------- | --------------- | --------- | ------------------------------------------------------ |
| S081 | لوحة الرواتب         | /app/payroll                          | payroll_officer | analytics | عرض حالة periods والتحذيرات والمبالغ الإجمالية المقنعة |
| S082 | مسيرات الرواتب       | /app/payroll/runs                     | payroll_officer | list      | فهرس runs حسب الفترة والمجموعة والحالة                 |
| S083 | إعداد مسير جديد      | /app/payroll/runs/new                 | payroll_officer | form      | اختيار period وgroup وcut-off والسياسة                 |
| S084 | حساب المسير          | /app/payroll/runs/:id/calculation     | payroll_officer | workflow  | متابعة job جمع facts وحساب snapshot                    |
| S085 | تحذيرات المسير       | /app/payroll/runs/:id/warnings        | payroll_officer | table     | إصلاح مصادر ناقصة أو تغييرات بعد cut-off               |
| S086 | مراجعة المسير        | /app/payroll/runs/:id/review          | hr_manager      | workflow  | مراجعة الإجماليات والعينات قبل القفل                   |
| S087 | تفصيل المسير         | /app/payroll/runs/:id                 | payroll_officer | detail    | عرض snapshot ومصادره وحالة الفترة                      |
| S088 | قفل المسير           | /app/payroll/runs/:id/lock            | payroll_officer | workflow  | تطبيق four-eyes ومنع إعادة الحساب الصامت               |
| S089 | دفعة الدفع           | /app/payroll/runs/:id/payments        | finance_officer | workflow  | إنشاء batch دفع أو WPS بمرجع idempotent                |
| S090 | تصدير WPS أو البنك   | /app/payroll/runs/:id/wps             | finance_officer | form      | تجهيز ملف مزود الدفع بعد authorization                 |
| S091 | حالة الدفع           | /app/payroll/runs/:id/payment-status  | finance_officer | detail    | عرض accepted أو failed أو partial دون تكرار دفع        |
| S092 | مطابقة الدفع         | /app/payroll/runs/:id/reconciliation  | finance_officer | workflow  | مطابقة إجمالي المسير مع إثبات البنك                    |
| S093 | معاينة القسيمة       | /app/payroll/runs/:id/payslip-preview | payroll_officer | detail    | معاينة قسيمة مقنعة قبل النشر                           |
| S094 | قسيمتي               | /app/self-service/payslips/:period    | employee        | detail    | قراءة القسيمة المنشورة وتنزيلها مؤقتًا                 |
| S095 | ملفات الرواتب        | /app/payroll/salary-files             | payroll_officer | list      | مراجعة salary profiles وتواريخها                       |
| S096 | استيراد الرواتب      | /app/payroll/salary-files/import      | payroll_officer | upload    | رفع ملف salary مع validation للحقول المقيدة            |
| S097 | طلب تغيير راتب       | /app/payroll/salary-changes/new       | hr_manager      | form      | إنشاء change مؤرخ يمر بموافقة مستقلة                   |
| S098 | السلف والأقساط       | /app/payroll/loans                    | payroll_officer | list      | مراجعة السلف وحالة الأقساط                             |
| S099 | طلب سلفة             | /app/payroll/loans/new                | employee        | form      | إرسال سلفة مع الحد والسبب والوثيقة                     |
| S100 | تفصيل السلفة         | /app/payroll/loans/:id                | payroll_officer | detail    | عرض الموافقات والصرف وجدول الأقساط                     |
| S101 | المصروفات            | /app/payroll/expenses                 | finance_officer | list      | فهرس المطالبات وحالات المطابقة                         |
| S102 | مطالبة مصروف         | /app/payroll/expenses/new             | employee        | form      | رفع مطالبة مع receipt وسياسة المصروف                   |
| S103 | تفصيل مطالبة المصروف | /app/payroll/expenses/:id             | finance_officer | workflow  | مراجعة واعتماد أو رفض المطالبة                         |
| S104 | المخالصات            | /app/payroll/settlements              | finance_officer | list      | فهرس تسويات نهاية الخدمة وحالتها                       |
| S105 | معاينة المخالصة      | /app/payroll/settlements/:id/preview  | hr_manager      | detail    | جمع المستحقات والأصول والخصومات المؤهلة                |
| S106 | إغلاق المخالصة       | /app/payroll/settlements/:id/close    | finance_officer | workflow  | إغلاق four-eyes وإصدار statement                       |
| S107 | ربط الحسابات المالية | /app/payroll/finance/mappings         | finance_officer | settings  | تعريف entity/account/WPS mapping                       |
| S108 | سياسات الرواتب       | /app/payroll/policies                 | payroll_officer | settings  | إدارة cut-off والبدلات والخصومات والقفل                |
| S109 | تقارير الرواتب       | /app/payroll/reports                  | payroll_officer | report    | تشغيل تقارير payroll وvariance ضمن النطاق              |

### المواهب وتطوير الأداء (11)

| ID   | الشاشة              | المسار                                            | الدور الأساسي    | النمط     | الغرض                                       |
| ---- | ------------------- | ------------------------------------------------- | ---------------- | --------- | ------------------------------------------- |
| S110 | لوحة التوظيف        | /app/talent/recruitment                           | recruiter        | analytics | عرض funnel الشواغر والمرشحين ومواعيد العروض |
| S111 | الشواغر             | /app/talent/recruitment/vacancies                 | recruiter        | list      | إدارة الوظائف المفتوحة وحالتها              |
| S112 | إنشاء شاغر          | /app/talent/recruitment/vacancies/new             | recruiter        | form      | تعريف شاغر ونطاقه وموافقته                  |
| S113 | خط المرشحين         | /app/talent/recruitment/candidates                | recruiter        | list      | إدارة pipeline والمراحل والفلاتر            |
| S114 | ملف المرشح          | /app/talent/recruitment/candidates/:id            | recruiter        | detail    | عرض بيانات المرشح وموافقاته المقنعة         |
| S115 | مقابلة وتقييم       | /app/talent/recruitment/candidates/:id/interviews | recruiter        | workflow  | جمع scorecards دون كشف ملاحظات غير مصرح     |
| S116 | إصدار عرض           | /app/talent/recruitment/candidates/:id/offer      | hr_manager       | form      | إنشاء عرض بمدة وموافقة ونسخة ثابتة          |
| S117 | تخطيط القوى العاملة | /app/talent/workforce-planning                    | hr_manager       | analytics | مقارنة headcount والميزانية والشواغر        |
| S118 | دورات الأداء        | /app/talent/performance/cycles                    | performance_lead | list      | فتح ومتابعة دورات التقييم                   |
| S119 | الأهداف وcheck-in   | /app/talent/performance/cycles/:id/goals          | line_manager     | form      | تحديد أهداف الفريق ومتابعة الأدلة           |
| S120 | مراجعة الأداء       | /app/talent/performance/reviews/:id               | performance_lead | workflow  | إرسال وموازنة وقفل التقييم والاعتراض        |

### التقارير والتكامل والعهد والتدقيق (20)

| ID   | الشاشة             | المسار                            | الدور الأساسي          | النمط    | الغرض                                     |
| ---- | ------------------ | --------------------------------- | ---------------------- | -------- | ----------------------------------------- |
| S121 | سجل العهد          | /app/governance/assets            | asset_manager          | list     | فهرس الأصول والموقع والمالك والحالة       |
| S122 | تفصيل أصل          | /app/governance/assets/:id        | asset_manager          | detail   | عرض serial والضمان والأثر والتاريخ        |
| S123 | إسناد أصل          | /app/governance/assets/:id/assign | asset_manager          | form     | تسليم أصل لموظف مع قبول موثق              |
| S124 | إرجاع وفحص أصل     | /app/governance/assets/:id/return | asset_manager          | workflow | إغلاق العهدة أو فتح dispute عند الخروج    |
| S125 | نزاعات العهد       | /app/governance/assets/disputes   | auditor                | list     | مراجعة الأصول المفقودة أو المختلف عليها   |
| S126 | كتالوج التقارير    | /app/reports                      | auditor                | report   | اختيار تقارير جاهزة حسب الدور والنطاق     |
| S127 | منشئ تقرير         | /app/reports/new                  | hr_manager             | form     | اختيار projection وفلاتر وحقول export     |
| S128 | حالة تشغيل التقرير | /app/reports/jobs/:id             | auditor                | detail   | عرض progress أو retry أو DLQ              |
| S129 | معاينة التقرير     | /app/reports/jobs/:id/preview     | auditor                | detail   | مراجعة النتائج قبل تنزيل ملف مقيد         |
| S130 | جدولة التقارير     | /app/reports/schedules            | hr_manager             | list     | تعريف إرسال دوري بحقول مقنعة              |
| S131 | مركز التكاملات     | /app/integrations                 | org_admin              | list     | مراجعة adapters وحالة الاتصال             |
| S132 | إضافة تكامل        | /app/integrations/new             | org_admin              | form     | اختيار موصل وحفظ credential reference     |
| S133 | مطابقة التكامل     | /app/integrations/:id/mapping     | org_admin              | form     | ربط IDs والكيانات وحقول المصدر            |
| S134 | وظيفة المزامنة     | /app/integrations/jobs/:id        | org_admin              | detail   | عرض accepted/rejected وlast attempt وDLQ  |
| S135 | تسليمات Webhook    | /app/integrations/webhooks        | org_admin              | list     | مراجعة التوقيع وإعادة التشغيل الآمن       |
| S136 | مفاتيح API         | /app/integrations/api-keys        | org_admin              | list     | إدارة المراجع والدوران دون عرض السر       |
| S137 | مستكشف سجل التدقيق | /app/governance/audit             | auditor                | list     | البحث في الأثر حسب actor وentity ووقت     |
| S138 | تفصيل حدث التدقيق  | /app/governance/audit/:id         | auditor                | detail   | عرض before/after وسبب القرار دون أسرار    |
| S139 | مركز الإشعارات     | /app/notifications                | employee_or_org_member | list     | متابعة action required والمعلومات والأمان |
| S140 | إعلانات المنشأة    | /app/governance/announcements     | org_admin              | form     | إنشاء إعلان مترجم بجدولة ونطاق            |

### الخدمة الذاتية (5)

| ID   | الشاشة               | المسار                       | الدور الأساسي | النمط  | الغرض                                  |
| ---- | -------------------- | ---------------------------- | ------------- | ------ | -------------------------------------- |
| S141 | بوابة الخدمة الذاتية | /app/self-service            | employee      | mobile | بطاقة اليوم والإجراءات السريعة للموظف  |
| S142 | حضور الخدمة الذاتية  | /app/self-service/attendance | employee      | mobile | تسجيل دخول أو خروج ومراجعة ساعات اليوم |
| S143 | طلباتي               | /app/self-service/requests   | employee      | mobile | متابعة الإجازات والسلف والمصروفات      |
| S144 | قسائم الرواتب        | /app/self-service/payslips   | employee      | mobile | قراءة القسائم المنشورة وتنزيلها المؤقت |
| S145 | مستنداتي             | /app/self-service/documents  | employee      | mobile | رفع أو قراءة المستندات الشخصية المقيدة |

### إعدادات العميل (9)

| ID   | الشاشة                 | المسار                      | الدور الأساسي | النمط    | الغرض                                               |
| ---- | ---------------------- | --------------------------- | ------------- | -------- | --------------------------------------------------- |
| S146 | إعدادات المنشأة        | /app/settings/tenant        | org_admin     | settings | تعديل الملف القانوني والكيانات والبيانات الافتراضية |
| S147 | إعدادات الوصول         | /app/settings/access        | org_admin     | settings | مراجعة الأعضاء والأدوار وMFA والسياسات              |
| S148 | إعدادات السياسات       | /app/settings/policies      | org_admin     | settings | إدارة attendance وleave وpayroll وapproval policies |
| S149 | إعدادات التوطين        | /app/settings/localization  | org_admin     | settings | تغيير اللغة والتاريخ والأرقام وtimezone             |
| S150 | إعدادات الإشعارات      | /app/settings/notifications | org_admin     | settings | اختيار القنوات والقوالب وساعات الهدوء               |
| S151 | الأمان والجلسات        | /app/settings/security      | org_owner     | settings | إدارة MFA وSSO والجلسات وسياسة كلمة المرور          |
| S152 | الاشتراك والفوترة      | /app/settings/billing       | org_owner     | settings | عرض الخطة والمقاعد والفواتير وسياسة الإلغاء         |
| S153 | الاستخدام والاستحقاقات | /app/settings/usage         | org_owner     | settings | مراجعة seats وstorage وfeatures قبل الحد            |
| S154 | الفواتير ووسيلة الدفع  | /app/settings/invoices      | org_owner     | settings | عرض invoice وحالة الدفع دون منح RBAC                |

### المساعدة والدعم (3)

| ID   | الشاشة          | المسار               | الدور الأساسي          | النمط    | الغرض                                      |
| ---- | --------------- | -------------------- | ---------------------- | -------- | ------------------------------------------ |
| S155 | مركز المساعدة   | /support/help        | employee_or_org_member | list     | البحث في المقالات والدليل حسب اللغة والدور |
| S156 | تذاكر الدعم     | /support/tickets     | employee_or_org_member | list     | فهرس تذاكر العميل وحالتها وSLA             |
| S157 | تفصيل تذكرة دعم | /support/tickets/:id | employee_or_org_member | workflow | مراسلة الدعم وعرض ما تم الوصول إليه        |

### إدارة المنصة (3)

| ID   | الشاشة                    | المسار                  | الدور الأساسي | النمط    | الغرض                                          |
| ---- | ------------------------- | ----------------------- | ------------- | -------- | ---------------------------------------------- |
| S158 | عملاء المنصة              | /platform/tenants       | super_admin   | platform | مراجعة حالة العملاء والتهيئة دون employee data |
| S159 | كتالوج الباقات والإصدارات | /platform/plans         | super_admin   | platform | إدارة draft plans وfeature releases            |
| S160 | صحة المنصة وBreak-glass   | /platform/system-health | super_admin   | platform | مراقبة jobs والحوادث ومراجعة الوصول المؤقت     |

## 5. تخطيط النمط حسب نوع الشاشة

| النمط            | LAYOUT                              | HEADER                    | CONTENT                              | ACTIONS                                | RESPONSIVE                         |
| ---------------- | ----------------------------------- | ------------------------- | ------------------------------------ | -------------------------------------- | ---------------------------------- |
| marketing        | مساحة عامة بعمود hero وsocial proof | شعار وروابط legal         | value cards وsecurity note وCTA      | تجربة أو تواصل                         | عمود واحد على الهاتف               |
| auth             | بطاقة دخول مقسمة أو كاملة العرض     | brand + language          | form وMFA/error/legal                | متابعة وإعادة إرسال                    | form كامل العرض وkeyboard first    |
| wizard           | stepper يسار منطقي أو أعلى          | breadcrumb وprogress      | sections وsummary                    | حفظ draft، التالي، السابق، إنهاء       | sticky footer وstep واحد ظاهر      |
| list/table       | page header وfilter bar             | title وcontext وas_of     | table/list وpagination               | search وfilter وview وexport عند الإذن | cards أو key columns وfilter sheet |
| detail/profile   | summary header وtabs                | status وowner وbreadcrumb | fields وhistory وrelated             | تعديل أو تنزيل مقنع                    | tabs تتحول إلى select أو sections  |
| form/settings    | settings nav أو form card           | title وdirty state        | fields وvalidation summary وevidence | حفظ وإرسال وإلغاء واستعادة             | bottom action bar وsingle column   |
| workflow         | status timeline وapproval card      | current approver وSLA     | evidence وcomments وdecision history | approve وreject وreturn                | decision footer ثابت وواضح         |
| analytics/report | KPI grid وchart area                | period وfreshness         | charts وtable وdrill-down            | refresh وrun وschedule وexport         | chart stack وtable scroll          |
| upload           | dropzone وrules                     | source وjob status        | mapping وrow errors وprogress        | فحص وبدء وretry وتنزيل الأخطاء         | file card وrow summary             |
| mobile           | mobile header وquick actions        | context مختصر             | cards وstatus sheets                 | attendance وleave وexpense وpayslip    | bottom actions وtouch target       |
| platform/system  | platform shell وhealth cards        | tenant risk وlast check   | incidents وjobs وaudit drawer        | inspect وmasked export وticket         | table مع filter sheet              |

## 6. قواعد البيانات والـAPI لكل شاشة

- شاشة القراءة تستخدم API يثبت tenant context وscope وpagination؛ شاشة الكتابة تستخدم command مع idempotency وversion عند الحساسية.
- S084–S092 وS103 وS106 وS120 وS124 وS157 تحمل workflow state وapproval history؛ لا تكفي GET واحدة لعرض القرار.
- S020–S022 وS041 وS062–S064 وS096 وS128 وS134 تحمل job reference وaccepted/rejected counts وretry/DLQ.
- S029–S030 وS037 وS090–S094 وS105–S109 تقيد الحقول بالـallowlist؛ لا يعرض route أو search preview سرًا خامًا.
- S045–S054 وS147 وS151 وS160 تحتاج access_decisions وaudit reference؛ تغييرات الدور لا تحفظ في localStorage.
- كل API في JSON مبدئي؛ PART 11 يثبت HTTP envelope وerrors وpagination، وPART 10 يثبت الجداول وRLS.

## 7. Responsive وRTL handoff

- Desktop: shell كامل، Sidebar قابل للطي، جدول أو detail panel، وaction rail.
- Laptop: Sidebar collapsed، context مختصر، وcolumn chooser للأعمدة الثانوية.
- Tablet: drawer للتنقل، filter sheet، key column ثابتة، وaction footer في النماذج.
- Mobile: ESS quick actions أولًا، cards بدل الجداول، bottom sheet للتفاصيل، ولا payment أو lock أو restricted export من quick action.
- RTL: start/end properties، عكس أيقونة الحركة فقط، وIDs والأرقام مقروءة LTR داخل Arabic text.
- Accessibility: landmarks، focus order، keyboard shortcuts، screen-reader labels، color مع text، وfocus trap للـmodal.

## 8. حالات خاصة يجب أن تظهر في التصميم

| الحالة                 | الشاشة/النمط المتأثر                    | العرض المطلوب                                     |
| ---------------------- | --------------------------------------- | ------------------------------------------------- |
| tenant جديد بلا بيانات | dashboard وemployees وreports           | empty first-use مع CTA واحد وسبب عدم توفر الأرقام |
| query كبير             | كل list/table/search                    | server pagination وdebounce ووقت آخر تحديث        |
| role سُحب أثناء العرض  | detail وworkflow وreport                | access denied موحد وإبطال signed URL              |
| period مقفول           | payroll وleave وattendance              | badge locked وadjustment path دون overwrite       |
| job طويل أو جزئي       | import وpayments وreports وintegrations | progress وaccepted/rejected وretry/DLQ            |
| field restricted       | employee وpayroll وdocument             | masked value أو رفض export مع reason              |
| شبكة منقطعة            | ESS وforms                              | حفظ draft المسموح وidempotent retry               |
| ترجمة ناقصة            | كل الشاشة                               | fallback مراقب في CI، لا نص key للمستخدم          |

## 9. حالات قبول الجرد

| ID     | Given                     | When                  | Then                                          |
| ------ | ------------------------- | --------------------- | --------------------------------------------- |
| INV-01 | دور Employee              | يفتح /app             | يوجه إلى S013 أو S141 ويرى ESS فقط            |
| INV-02 | دور HR Manager            | يفتح ملف موظف         | يرى tabs المسموحة وmasked fields              |
| INV-03 | مستخدم بلا permission     | يفتح route معروف      | access denied موحد لا يكشف المورد             |
| INV-04 | رابط hash قديم            | يفتحه المستخدم        | mapping إلى route canonical مع guard          |
| INV-05 | list أول استخدام          | لا توجد صفوف          | CTA يشرح القيمة ولا table فارغ بلا معنى       |
| INV-06 | list بفترة كبيرة          | يغير filter           | server pagination وquery آمن                  |
| INV-07 | form dirty                | يغير route            | confirm أو save draft حسب الحساسية            |
| INV-08 | workflow four-eyes        | منشئ المسير يفتح lock | الزر مرفوض ويظهر reviewer المطلوب             |
| INV-09 | export restricted         | role لديه view فقط    | masked أو deny مع audit reason                |
| INV-10 | upload جزئي               | job يفشل في صفوف      | counts وdownload errors وretry                |
| INV-11 | projection stale          | يفتح analytics        | badge stale وas_of وrefresh                   |
| INV-12 | session expired           | يرسل form             | login ثم إعادة فحص بلا submit صامت            |
| INV-13 | mobile ESS                | يفتح الشاشة           | quick actions وtouch targets وحالة مختصرة     |
| INV-14 | Arabic locale             | يفتح table/form       | RTL وlabels وdates وnumbers سليمة             |
| INV-15 | English locale            | يعود بعد reload       | يحافظ على locale وroute semantics             |
| INV-16 | drawer مفتوح              | يضغط Esc              | يغلق ويعيد focus إلى زر الفتح                 |
| INV-17 | duplicate click           | يرسل payment أو leave | نتيجة واحدة بنفس idempotency reference        |
| INV-18 | tenant filter من عميل آخر | يرسل URL              | يحذف filter ويرجع إلى scope الحالي            |
| INV-19 | support break-glass منتهٍ | يفتح S157             | لا signed URL ويسجل انتهاء الجلسة             |
| INV-20 | Demo role switch          | يغير الدور            | محاكاة مرئية فقط ولا تغيّر Live authorization |

## 10. تسليم التنفيذ

1. يراجع Product وDesign أسماء S001–S160 ويثبت subset يدخل MVP أو Beta.
2. يربط كل شاشة بملف route أو page module، ثم يضيف loader وguard وquery key.
3. يحول state_profile إلى shared components وvisual snapshots وE2E.
4. يضيف API contract وpermission code وanalytics events لكل شاشة قبل ربط البيانات الحية.
5. يحول INV-01–20 إلى E2E وvisual وaccessibility tests في PART 13.
6. بعد اعتماد الجرد يبدأ PART 8 بتثبيت tokens وcomponent variants، ثم PART 9 بالـworkflows.

الكتالوج الآلي مبدئي وغير مفعّل؛ لا يضيف routes أو صلاحيات بمجرد رفعه.
