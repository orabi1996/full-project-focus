# PART 5 — USER JOURNEYS

**التاريخ:** 8 سبتمبر 2026. **الإصدار:** 0.1 — رحلات مستخدم مبدئية قابلة للاختبار.

**المرجع:** [PART 2 — Product Strategy](PART_02_PRODUCT_STRATEGY.ar.md)، [PART 3 — Product Architecture](PART_03_PRODUCT_ARCHITECTURE.ar.md)، [PART 4 — User Roles & Permissions](PART_04_USER_ROLES_AND_PERMISSIONS.ar.md)، و[نطاق MVP](MVP_SCOPE_AND_ACCEPTANCE.ar.md).

**الحالة:** مخرجات Product/UX قابلة للتحويل إلى routes وAPI وE2E. لا تفترض أن كل الرحلات منفذة في الكود الحالي، ولا تعتمد بلدًا أو مزود دفع أو جهاز بصمة لم يُعتمد بعد.

## 1. كيف نقرأ الرحلة

كل رحلة تبدأ من نية واضحة للمستخدم وتنتهي بنتيجة قابلة للقياس. لا نعتبر ظهور صفحة نجاح إنجازًا؛ الإنجاز يحتاج موردًا محفوظًا، صلاحية صحيحة، إشعارًا قابلًا للتتبع، وسجل تدقيق.

```text
Trigger
→ Context and validation
→ User action
→ Approval or policy decision
→ Processing / job
→ Notification
→ Completion or explicit failure
→ Audit log and next best action
```

الحالات الموحدة التي يجب أن تفهمها الواجهة:

| الحالة             | المعنى                           | ما يراه المستخدم                                   |
| ------------------ | -------------------------------- | -------------------------------------------------- |
| `draft`            | بدأ إدخالًا ولم يرسل             | حفظ مؤقت، متابعة لاحقًا، لا أثر عمل نهائي          |
| `submitted`        | أرسل الطلب وفحوص الشكل نجحت      | رقم مرجعي ووقت الإرسال                             |
| `pending_approval` | ينتظر صاحب صلاحية                | من يراجع، ما المطلوب، وموعد SLA                    |
| `processing`       | Worker أو مزود خارجي يعمل        | تقدم أو آخر محاولة، مع منع التكرار                 |
| `completed`        | النتيجة محفوظة ومسموح عرضها      | النتيجة، المصدر، وإجراء المتابعة                   |
| `rejected`         | قرار رفض مبرر                    | السبب القابل للفهم وخيار التصحيح/الاعتراض          |
| `failed_retryable` | تعذر مؤقت                        | إعادة تلقائية أو زر إعادة آمن مع `idempotency_key` |
| `failed_terminal`  | تعذر يحتاج تدخلًا                | رقم حادثة/تذكرة، دون وعد نجاح كاذب                 |
| `cancelled`        | ألغى صاحب الطلب قبل نقطة القفل   | أثر الإلغاء وسياسة استرجاع أي حجز                  |
| `expired`          | انتهت مهلة تفويض أو جلسة أو رابط | تسجيل دخول/تفويض جديد، ولا إعادة تشغيل صامتة       |

## 2. خط الأساس في التطبيق الحالي

| ما هو موجود                                                                                                                       | دليل محلي                                                                     | أثره على الرحلات الهدف                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| مسار `/login` وحارس `AuthGate` وإعادة التوجيه عند عدم وجود جلسة                                                                   | `src/routes/login.tsx`, `src/components/auth/AuthGate.tsx`                    | رحلة الدخول موجودة جزئيًا؛ التسجيل والتحقق والدعوة تحتاج routes وعقودًا مستقلة                              |
| مسار `/` يحمل `AppProvider` و`AppLayout` بعد المصادقة                                                                             | `src/routes/index.tsx`                                                        | نحتاج tenant context وتهيئة أولية قبل عرض بيانات العميل                                                     |
| التنقل الداخلي يعتمد `window.location.hash` و`VALID_TABS`                                                                         | `src/components/layout/AppLayout.tsx`                                         | deep links وback/forward وguard لكل مورد ليست مكتملة؛ تُنقل تدريجيًا إلى routes typed                       |
| الوحدات lazy داخل sidebar: الموظفون، الحضور، الورديات، الإجازات، الرواتب، السلف، المصروفات، الأداء، ATS، العهد، التقارير والتدقيق | `src/components/layout/AppSidebar.tsx`, `src/components/layout/AppLayout.tsx` | توجد نقطة دخول UI كثيرة، لكن الرحلة التجارية تحتاج حالات وموافقات وسياق tenant لا توفره علامة التبويب وحدها |
| `AppContext` يجمع حالة البيانات وعمليات عدة مجالات، مع وضع Demo منفصل                                                             | `src/lib/context/AppContext.tsx`, `src/lib/config/runtime-config.ts`          | نستخدم compatibility adapter أثناء الانتقال؛ لا نخلط mock مع أول معاملة مالية أو جلسة Live                  |
| endpoint عام للبصمة                                                                                                               | `src/routes/api/public/biometric/punch.ts`                                    | يجب أن يمر الجهاز الموثق، التوقيع، idempotency، rate limit، والمراقبة قبل تجربة عميل                        |

هذه القراءة لا تعني أن كل زر في الوحدات الحالية مكتمل أو أن RLS عزل إنتاجي. الرحلات التالية هي السلوك المستهدف الذي تُقاس به الفجوات.

## 3. خريطة الرحلات الأساسية

| ID   | الرحلة                        | المستخدم الأساسي                  | نقطة البداية                | النتيجة التجارية                                    |
| ---- | ----------------------------- | --------------------------------- | --------------------------- | --------------------------------------------------- |
| J-01 | اكتشاف المنصة والدخول الآمن   | زائر/عضو                          | Landing أو دعوة             | جلسة موثقة أو طلب تجربة مؤهل                        |
| J-02 | إنشاء عميل وتهيئة أولية       | Org Owner/Admin                   | دعوة أو تسجيل               | tenant وكيان وسياسة أولية وعضو أول                  |
| J-03 | دعوة عضو وربطه بموظف          | Org Admin/HR                      | People → Invite             | عضوية فعالة وحساب مرتبط بلا انتحال سجل              |
| J-04 | دورة الموظف من التعيين للخروج | HR Manager/Operator               | People                      | employment مؤرخ ومستندات وoffboarding قابل للمطابقة |
| J-05 | يوم الموظف في الخدمة الذاتية  | Employee                          | ESS                         | بصمة/طلب/مصروف/قسيمة مع حالة واضحة                  |
| J-06 | معالجة حضور واستثناء أو إضافي | Employee/Manager/Attendance       | Attendance                  | واقعة مقفلة تدخل payroll أو ترفض بسبب موثق          |
| J-07 | إجازة واعتماد ورصيد           | Employee/Manager/HR               | ESS/Leave                   | حجز رصيد ثم تسوية أو إلغاء بلا رصيد سالب            |
| J-08 | دورة مسير الرواتب والدفع      | Payroll/Finance/HR                | Payroll                     | snapshot محسوب ومراجع ومقفل ومدفوع ومطابق           |
| J-09 | سلفة ومصروف وتسوية مخالصة     | Employee/HR/Finance               | Loans/Expenses/Exit         | التزام مالي واحد المصدر مع فصل المهام               |
| J-10 | توظيف ثم تحويل المرشح لموظف   | Recruiter/HR                      | ATS                         | مرشح مؤهل وعرض مقبول وemployee جديد دون ازدواج      |
| J-11 | دورة أهداف وتقييم أداء        | Manager/Performance/Employee      | Performance                 | أهداف معتمدة وتقييم ومحادثة وأثر قابل للاعتراض      |
| J-12 | عهدة وتكامل وتقارير ودعم      | Asset/Integration/Auditor/Support | Assets/Integrations/Reports | أصل أو مزود أو تقرير قابل للتتبع دون كشف زائد       |

كل رحلة تحمل `tenant_id` ضمنيًا من الجلسة؛ لا يقبل المستخدم Tenant ID من URL لتوسيع نطاقه. الحساب غير المرتبط بموظف يمكنه إكمال الربط إذا سمحت سياسة العميل، لكنه لا يستعير سجلًا آخر.

## 4. الرحلات بالتفصيل

### J-01 — من Landing أو الدعوة إلى جلسة آمنة

**المشاركون:** زائر، Org Owner، Employee، Identity provider، Support عند الفشل. **الهدف:** دخول قابل للاستعادة مع معرفة tenant واللغة والمنطقة الزمنية دون كشف ما إذا كان بريد معين مسجلًا.

1. **Trigger:** يفتح الزائر صفحة تعريف Classera Pulse HCM أو رابط دعوة أحادي الاستخدام.
2. **Context:** تُحمل اللغة `ar/en` والاتجاه ووقت الجلسة؛ رابط الدعوة لا يحتوي بيانات راتب أو اسم موظف كامل.
3. **Validation:** فحص HTTPS، صلاحية الرابط، domain policy، rate limit، وعدم تسريب وجود الحساب في رسائل الخطأ.
4. **Action:** يختار تسجيل الدخول بالبريد/المزود المعتمد؛ المدعو يقبل شروط المنشأة وينشئ كلمة مرور أو يمر SSO/MFA.
5. **Approval:** لا توجد موافقة HR على login؛ الدعوة نفسها تحتاج أنشأها Admin مخول ولم تُلغ أو تنتهِ.
6. **Processing:** إنشاء session قصيرة مع refresh rotation، تحميل memberships والاستحقاقات والأدوار من الخادم، وتحديد أول شاشة مسموحة.
7. **Notification:** نجاح داخل التطبيق؛ فشل متكرر يرسل تنبيهًا أمنيًا بعد العتبة، ولا يرسل كلمة مرور أو رمزًا في سجل.
8. **Completion:** `authenticated + active_membership` أو `authenticated + onboarding_required`. يوجه المستخدم إلى آخر شاشة مسموحة فقط.
9. **Audit:** login success/failure، device/IP risk، invite accepted، MFA change، وسبب أي block.

**مسارات الفشل:** رابط منتهي → يطلب إعادة الدعوة؛ كلمة مرور خطأ → backoff ورسالة موحدة؛ MFA timeout → إعادة تحدٍ دون إنشاء جلسة جزئية؛ عضوية معلقة → لا يفتح أي Query ولو بقيت جلسة قديمة.

**معيار النجاح:** 95% من الجلسات الصحيحة تصل إلى الصفحة الأولى المسموحة خلال 3 ثوانٍ في بيئة Pilot، ولا يكشف اختبار cross-tenant أي فرق بين بريد موجود وغير موجود.

### J-02 — إنشاء عميل وتهيئة أولية

**المشاركون:** Org Owner، Org Admin، HR Manager، Commerce، Notification. **الهدف:** الوصول إلى أول قيمة خلال جلسة واحدة دون إنشاء إعدادات مالية ناقصة.

1. **Trigger:** يختار العميل بدء تجربة أو يقبل رابط تهيئة من فريق المبيعات.
2. **Validation:** البريد موثق، بلد/عملة/منطقة زمنية مختارة، اسم قانوني ومعرف فريد داخل النظام، وخطة متاحة لكن غير مفعلة تلقائيًا بصلاحية.
3. **Action:** ينشئ tenant، أول legal entity، وحدات/مواقع أولية، سياسة حضور افتراضية معلنة، ويدعو Admin/HR.
4. **Approval:** يوافق Owner على شروط الخدمة ودور الفوترة؛ أي تحقق قانوني أو دفع يمر Commerce adapter ولا يتجاوز العضوية.
5. **Processing:** transaction واحدة للـtenant والmembership الأولى، ثم jobs لاستيراد القالب وإرسال الدعوات. فشل job لا يمحو tenant.
6. **Notification:** checklist من 5 خطوات: البيانات، الهيكل، الورديات، الموظفون، أول طلب/بصمة؛ إشعار لكل Admin مدعو.
7. **Completion:** `onboarding_ready` عندما توجد entity وtimezone وpolicy وعضو Admin واحد؛ يظهر dashboard فارغ مع next best action.
8. **Audit:** actor، terms version، plan version، source/campaign، كل إعداد وسبب أي تغيير.

**حالات خاصة:** اختار العميل عملة أو بلدًا غير مدعوم → يحفظ draft ويطلب تواصلًا؛ رفع CSV جزئي → يعرض الصفوف المقبولة والأخطاء ويتيح إعادة صفوف الفشل؛ استرجاع المتصفح → يستعيد checklist من الخادم لا من localStorage.

### J-03 — دعوة عضو وربطه بموظف

**المشاركون:** Org Admin/HR، المدعو، Employee record، Identity. **الهدف:** عضوية أقل صلاحية مرتبطة بسجل صحيح وتاريخ فعالية.

1. Admin يختار الدور والنطاق والكيان وتاريخ البدء، ويكتب بريدًا؛ لا يستطيع اختيار `super_admin` أو نطاق wildcard.
2. الخادم يتحقق من membership والحدود وخطة المقاعد وتعارض SoD والبريد الموجود، ويعيد `invitation_id` لا token قابلًا للتخمين.
3. يرسل المدعو دعوة، ويقبلها بعد MFA/شروط الخصوصية؛ يمكنه طلب ربط بموظف أو ينتظر HR.
4. HR يراجع match بالرقم الوظيفي أو معرف خارجي؛ لا يعتمد الاسم وحده، ولا يربط مستخدمًا بسجل terminated بلا سبب.
5. عند النجاح تفعّل العضوية وتُحدّث `GET /api/v1/me/authorization`؛ route guard يعيد تحميل القرار ويغلق الشاشات الزائدة.
6. إشعار للمدعو وAdmin؛ تذكير قبل 48 ساعة من الانتهاء؛ إلغاء الدعوة يبطلها فورًا.
7. يسجل audit الإنشاء والقبول والربط والتغيير والإلغاء مع قبل/بعد دون رمز الدعوة.

**الفشل:** مقعد الخطة ممتلئ → لا تُرسل الدعوة؛ بريد دعوة قائم → يعرض حالة الدعوة دون إنشاء نسخة؛ قبول بعد الإلغاء → `invitation_expired`; مستخدم في tenant آخر → membership مستقلة ولا يشارك employee data.

### J-04 — دورة الموظف من التعيين إلى الخروج

**المشاركون:** HR Manager/Operator، Manager، Employee، Payroll، Asset، Documents. **الهدف:** سجل employment مؤرخ يصلح للحضور والراتب والمخالصة.

1. **Hire:** HR ينشئ Person ثم Employment بالكيان، الوظيفة، المدير، الموقع، نوع العقد، effective dates، والحد الأدنى من بيانات الراتب اللازمة.
2. **Validate:** uniqueness للرقم الوظيفي داخل tenant، عدم تداخل عقود فعالة، اكتمال البلد/التصنيف، وحقول identity المقيدة عبر allowlist.
3. **Approve:** HR Manager أو Owner يعتمد التعيين/الراتب؛ المنشئ لا يعتمد ذاته إذا كانت SoD مطلوبة.
4. **Onboard:** النظام ينشئ مهام مستندات وasset وpolicy acknowledgment، ويبعث دعوة ESS اختيارية حسب سياسة العميل.
5. **Operate:** تغييرات النقل أو المدير أو الراتب تنشئ نسخة مؤرخة ولا تعيد كتابة payroll snapshot مقفول.
6. **Exit:** HR يبدأ checklist بتاريخ آخر يوم، Payroll يحسب المستحقات، Asset يؤكد الإرجاع، Finance يراجع، ومعتمد مستقل يغلق المخالصة.
7. **Notify:** الموظف يرى ما يمكنه رؤيته، والمدير يرى مهام فريقه المقنعة، وPayroll/Finance يتلقى البنود المقيدة عبر نطاقه.
8. **Audit:** كل انتقال وحقل حساس وتوقيع ومرفق وسبب تعديل محفوظ append-only.

**حالات الفشل:** عقدان متداخلان → block مع تواريخ التعارض؛ مستند ناقص → يبقى `pending_documents`؛ مدير خارج entity → يطلب assignment؛ موظف أعيد تعيينه → employment جديد لا duplicate Person؛ خروج أثناء مسير مقفول → يفتح settlement adjustment موثقًا.

### J-05 — يوم الموظف في الخدمة الذاتية ESS

**المشاركون:** Employee، Device/Attendance، Manager، HR، Payroll. **الهدف:** تنفيذ المهام اليومية من شاشة صغيرة مع أقل عدد خطوات.

1. يفتح الموظف ESS فيرى بطاقة اليوم: وردية، حالة الحضور، الرصيد المتاح، الطلبات المعلقة، آخر قسيمة، والتنبيهات.
2. يضغط Check-in/Check-out أو يرسل طلب تصحيح؛ الخادم يتحقق من employee link، timezone، نافذة الوردية، device signature إن كانت بصمة، وidempotency.
3. يرسل إجازة أو مصروفًا أو طلب سلفة من نموذج يوضح الرصيد والحدود والوثائق المطلوبة قبل الإرسال.
4. يعرض النظام مسار الاعتماد المتوقع وSLA؛ لا يَعِد بالموافقة ولا يخصم رصيدًا نهائيًا قبل reservation transaction.
5. يتلقى الموظف تحديثات in-app/email بحسب أولوية العميل، ويستطيع سحب الطلب قبل نقطة القفل إن سمحت السياسة.
6. بعد اكتمال المسير تظهر القسيمة المقنعة/المصرح بها، مع مصدر الفترة ورابط اعتراض أو تذكرة.
7. نهاية اليوم تحفظ event trail؛ offline punch إن سمح الجهاز يحمل timestamp/device id ويظهر `pending_sync` حتى التحقق.

**الفشل:** شبكة منقطعة → لا نكرر العملية تلقائيًا دون idempotency؛ رصيد غير كافٍ → لا إرسال؛ حساب غير مربوط → شاشة ربط/تواصل؛ جهاز غير مصرح → `device_not_trusted` مع بديل طلب يدوي.

### J-06 — معالجة الحضور والاستثناء والإضافي

**المشاركون:** Employee، Line Manager، Attendance Officer، HR، Payroll. **الهدف:** تحويل punch أو جدول إلى واقعة معتمدة قابلة للحساب.

1. **Trigger:** import من جهاز/ملف أو طلب تصحيح من الموظف؛ batch يحمل checksum وsource.
2. **Validation:** tenant/location/device، timestamp في timezone الموقع، duplicate punch، shift assignment، overlap، وسياسة grace/late/overtime.
3. **Action:** Time service ينشئ raw punch immutable نسبيًا وattendance day version؛ الاستثناء يظهر في inbox صاحب النطاق.
4. **Approval:** Manager يعتمد واقعة فريقه؛ Attendance Officer/HR يحسم التعارض أو الإضافي؛ صاحب الطلب لا يعتمد ذاته.
5. **Processing:** job يطابق الورديات ويحجز أثرًا سيستهلكه Payroll، مع retry آمن وdead-letter للصفوف المعطوبة.
6. **Notification:** الموظف يرى الحالة والسبب؛ المدير يرى قائمة SLA؛ Payroll لا يرى قيمة لم تُحسم كـapproved fact.
7. **Completion:** `resolved` أو `rejected` مع سبب، ونسخة attendance تدخل projection؛ التعديل بعد lock يفتح adjustment جديدًا.
8. **Audit:** raw source، actor، policy version، before/after، approval chain، device/IP، correlation id.

**الفشل:** batch جزئي → يعلن accepted/rejected counts؛ تكرار نفس الملف → يعيد نتيجة سابقة؛ وقت مستقبلي أو device key منتهٍ → quarantine؛ manager غادر الفريق → يعاد توجيه الاعتماد وفق effective date.

### J-07 — إجازة واعتماد ورصيد

**المشاركون:** Employee، Line Manager، HR Manager، Payroll. **الهدف:** عدم بيع نفس اليوم مرتين وعدم تحويل طلب غير معتمد إلى راتب.

1. الموظف يختار نوع الإجازة والتواريخ ويشاهد working days والرصيد المتوقع والوثائق المطلوبة.
2. الخادم يتحقق من membership وemployee link والتداخل والعطلات والحد الأدنى، وينشئ reservation متفائلًا داخل transaction.
3. يرسل الطلب إلى manager الصحيح في تاريخ الواقعة؛ إن كان خارج الفريق يرفض route القرار ويطلب إصلاح assignment.
4. Manager يقبل/يرفض مع سبب؛ HR يتدخل عند policy exception أو تجاوز حد؛ لا يقبل الموظف طلبه.
5. عند الاعتماد تتحول reservation إلى ledger؛ عند الرفض/الإلغاء تحرر reservation مرة واحدة وتُسجل النسخة.
6. إشعار لكل انتقال، مع تذكير SLA وتصعيد مخول؛ Payroll يستهلك settled leave event فقط.
7. بعد قفل المسير لا تعدل الإجازة القديمة؛ يُنشأ correction/settlement adjustment.
8. Audit يسجل الطلب، الرصيد قبل/بعد، policy، actor، delegation، والتوقيت.

**الفشل:** الرصيد تغير بالتوازي → conflict وإعادة عرض؛ overlap مع إجازة معتمدة → لا reservation؛ طلب عاجل خارج السياسة → approval خاص وسبب؛ إلغاء بعد بدء الإجازة → policy decision واضح لا حذف صامت.

### J-08 — دورة مسير الرواتب والدفع

**المشاركون:** Payroll Officer، HR Reviewer، Finance Officer، Org Owner، Employee، Bank/WPS adapter. **الهدف:** مسير snapshot يمكن شرحه وإعادة قراءته ومطابقته.

1. Payroll يختار period وpayroll group؛ الخادم يقفل تعريف الفترة ويثبت timezone/عملة/نسخة سياسة.
2. job يجمع approved attendance، leave ledger، salary effective dates، loans/installments، deductions، وadjustments؛ كل مصدر يحمل version.
3. يعرض `calculated` مع warnings: بيانات ناقصة، تغير بعد cut-off، duplicate bank account، أو حد خطة/تكامل.
4. Reviewer مستقل يراجع الإجماليات وsample employee ويعيد `changes_requested` أو يعتمد؛ المعد لا يعتمد ذاته عند four-eyes.
5. Payroll يقفل run؛ بعد `locked` لا يعاد الحساب من current salary، وأي تعديل يصبح adjustment run مع reason.
6. Finance ينشئ payment batch/WPS file أو يسجل مرجع الدفع عبر adapter؛ التنفيذ منفصل عن إعداد المسير.
7. النظام يطابق total run مع total bank evidence، ويصنف `paid`, `partial`, `failed`, `reconciled`; فشل البنك لا يرجع المسير إلى Draft.
8. ينشر payslip job وروابط خاصة قصيرة للموظفين، ويرسل إشعارًا بالنتيجة دون كشف راتب في البريد.
9. Audit يسجل كل command، snapshot version، approvals، export/download، provider response، retry، وbreak-glass.

**الفشل:** نقص مصدر → run `blocked` قبل calculate؛ اختلاف إجمالي → `reconciliation_required`؛ callback مكرر → idempotent؛ batch جزئي → لا يعاد دفع الصفوف الناجحة؛ IBAN مقنع → لا export خام إلا permission وreason.

### J-09 — سلفة ومصروف وتسوية مخالصة

**المشاركون:** Employee، HR/Payroll، Finance، Asset، Approver. **الهدف:** التزام مالي له مالك وحالة ومطابقة، ولا يُخصم مرتين.

1. الموظف يطلب سلفة أو مصروفًا مع المبلغ والسبب والوثيقة؛ الخادم يطبق الحد والعملة والـduplicate key.
2. HR/Payroll يراجع الأهلية؛ Finance يعتمد الصرف وفق threshold؛ لا ينشئ الشخص ويعتمد ويدفع العملية الحساسة نفسها.
3. عند الدفع ينشأ disbursement reference؛ جدول الأقساط يحدد الفترة والمبلغ المتبقي، ولا يغيّر salary snapshot المقفول.
4. المصروف ينتظر matching receipt/expense policy؛ المرفق يذهب إلى private storage وsigned URL قصير.
5. عند بدء الخروج ينشئ النظام settlement preview يجمع الراتب المتبقي، leave payout، loan installments، assets، والخصومات المؤهلة.
6. HR وFinance يراجعان البنود؛ Asset يغلق العهدة؛ معتمد مستقل يغلق المخالصة ويصدر statement للموظف حسب الحساسية.
7. أي refund أو adjustment يملك رقمًا جديدًا ويرتبط بالعملية الأصلية؛ notification يوضح الإجراء التالي.
8. Audit يسجل amount before/after، actor، reason، evidence، والاعتمادات.

**الفشل:** إيصال مكرر → quarantine؛ حساب صرف موقوف → لا تنفيذ؛ قسط يتجاوز صافي المستحق → policy exception؛ أصل مفقود → dispute case بدل خصم صامت.

### J-10 — توظيف ثم تحويل المرشح لموظف

**المشاركون:** Recruiter، Hiring Manager، HR Manager، Candidate، Payroll/IT عند التعيين. **الهدف:** عدم فقدان المرشح أو إنشاء Person مزدوج.

1. Recruiter ينشئ vacancy بكيان وموقع وrange وصلاحية رؤية؛ Hiring Manager يراجعها.
2. يدخل المرشح عبر رابط/استيراد؛ النظام يمنع duplicate email/phone وفق سياسة الاحتفاظ ويقنع بيانات الهوية.
3. يتحرك المرشح في مراحل `sourced → screening → interview → offer → accepted/rejected`; كل انتقال يحمل actor وreason.
4. العرض يحتاج approval بحسب range/role؛ المرشح يقبل نسخة العرض مع expiry، ولا يصبح موظفًا قبل effective date.
5. HR يحول candidate إلى Person/Employment عبر idempotent command، ويطلب المستندات والدعوة.
6. Payroll/IT/Asset يتلقى tasks من EmployeeHired event، وليس نسخة من كل بيانات المرشح.
7. إشعارات المرشح لا تكشف ملاحظات داخلية؛ إشعارات الفريق تبين task لا salary الخام.
8. Audit وretention policy يسجلان consent، مصدر المرشح، القرار، وتاريخ الحذف/الأرشفة.

**الفشل:** عرض منتهي → يحتاج إعادة إصدار؛ range غير مسموح → approval؛ duplicate Person → يوقف التحويل للمراجعة؛ رفض بعد offer → يحتفظ بالقرار وفق retention دون تفعيل employee.

### J-11 — دورة أهداف وتقييم أداء

**المشاركون:** Performance Lead، Line Manager، Employee، HR. **الهدف:** تقييم قابل للفهم والاعتراض ولا يتحول تلقائيًا إلى خصم أو قرار راتب.

1. Performance Lead يفتح cycle بمدى زمني وقالب وأوزان؛ HR يعتمد policy.
2. Manager يحدد أهداف فريقه ضمن scope؛ الموظف يقترح/يقبل ويضيف check-ins وأدلة.
3. النظام يتحقق من الوزن 100%، عدم وجود هدف خارج الدورة، وfield sensitivity للملاحظات.
4. Manager يرسل تقييمًا؛ الموظف يقر بالاطلاع أو يطلب اعتراضًا، ولا يعدل نسخة المدير بعد الإرسال.
5. Calibration/HR يراجعان التوزيع ويثبتان cycle؛ أي أثر تعويض يذهب إلى salary workflow مستقل ومؤرخ.
6. Notifications تشرح الموعد القادم، وتدعم العربية والإنجليزية دون ترجمة حرفية لملاحظات حساسة.
7. Completion ينشئ review snapshot وnext goals؛ اعتراض مفتوح لا يمنع حفظ التقييم لكنه يوسم الحالة.
8. Audit يسجل القالب، versions، actors، acknowledgments، والاعتراضات.

**الفشل:** مدير تغير أثناء الدورة → يحتفظ بالتاريخ ويعيد الخطوة التالية؛ وزن ناقص → لا إرسال؛ اعتراض بعد lock → case جديد؛ صلاحية المدير لا تشمل المرشح → لا كشف.

### J-12 — عهدة وتكامل وتقارير ودعم

هذه رحلة مركبة من ثلاث نهايات متشابهة: مورد تشغيلي، نتيجة تقرير، أو تذكرة دعم. تُفصل صلاحياتها ولا يشترك Support في بيانات HR تلقائيًا.

**العهدة:** Asset Manager ينشئ الأصل برقم serial وحالة وموقع؛ HR/Manager يطلب الإسناد؛ الموظف يؤكد الاستلام؛ عند النقل/الخروج تُنشأ return inspection؛ التلف أو الفقد يفتح dispute ولا يخصم تلقائيًا. كل signed document خاص ومساره tenant-aware.

**التكامل:** Integration Admin يختار adapter وmapping وcredential reference؛ Security/Owner يوافقان؛ test connection لا يقرأ كل البيانات؛ sync job يعرض cursor وعدد accepted/rejected وlast attempt؛ webhook يتحقق من signature وreplay protection؛ فشل المزود يبقى في DLQ ولا يغير الحقيقة الداخلية.

**التقرير/التدقيق:** المستخدم يحدد report وscope وfilters؛ الخادم ينشئ report job من projection مصرح؛ preview يقنع الحقول؛ export restricted يحتاج reason/permission؛ الملف له expiry وتنزيله audit؛ stale projection يظهر بوقت آخر تحديث.

**الدعم:** Support Agent يفتح ticket محددًا؛ إن احتاج break-glass يملك ticket، سببًا، مدة، موافقة، وحقولًا مقنعة؛ انتهاء الجلسة يلغي الروابط؛ العميل يرى ما قرئ ولماذا.

## 5. خريطة يومية حسب الدور

| الدور              | أول مهمة                   | Inbox/تنبيه حرج              | قرار اليوم                | مقياس نجاح                       |
| ------------------ | -------------------------- | ---------------------------- | ------------------------- | -------------------------------- |
| Org Owner/Admin    | صحة الاشتراك والتهيئة      | دعوات، seats، policy changes | منح scope/اعتماد عقد      | وقت الوصول لأول موظف منتج        |
| HR Manager         | exceptions وطلبات الموظفين | SLA اعتماد، بيانات ناقصة     | اعتماد تعيين/تغيير        | نسبة الطلبات المكتملة من أول مرة |
| HR Operator        | People/documents           | missing docs وduplicates     | تصحيح سجل أو مستند        | زمن معالجة ملف الموظف            |
| Payroll Officer    | cut-off وrun warnings      | تغييرات بعد cut-off          | calculate/review/lock     | run بلا adjustment غير مبرر      |
| Finance Officer    | payment/reconciliation     | failed/partial batch         | execute أو فتح مطابقة     | فرق التسوية ووقت الإغلاق         |
| Attendance Officer | device/batch/late          | device offline وquarantine   | resolve exception         | نسبة punches المعالجة آليًا      |
| Line Manager       | فريقه وapprovals           | طلبات متأخرة                 | accept/reject/feedback    | متوسط زمن اعتماد الفريق          |
| Recruiter          | vacancies/candidates       | offer expiry وduplicates     | نقل مرحلة/عرض             | time-to-hire وconversion         |
| Performance Lead   | cycle health               | أهداف ناقصة/تقييمات          | فتح/قفل cycle             | اكتمال الدورة والاعتراضات        |
| Asset Manager      | assigned/overdue assets    | returns/disputes             | assign/return/inspect     | أصول بلا custodian               |
| Auditor            | audit/report freshness     | break-glass/export           | طلب evidence              | اكتمال trace بلا PII زائد        |
| Employee           | ESS card                   | approval/payroll/attendance  | submit/acknowledge/appeal | إنجاز المهمة دون دعم             |
| Support Agent      | ticket queue               | SLA وbreak-glass expiry      | حل أو تصعيد               | first response وzero overreach   |

## 6. نقاط الدخول والروابط العميقة المستهدفة

الكود الحالي يستخدم hash tabs. أثناء الانتقال نحتفظ بالتوافق ثم نضيف routes typed، بحيث يحتوي الرابط على معرف مورد غير حساس ويعيد الخادم فحص الصلاحية:

| نية الرابط   | الشكل المستهدف                        | fallback                                  |
| ------------ | ------------------------------------- | ----------------------------------------- |
| دعوة         | `/invite/{opaque_token}`              | رابط منتهي/طلب دعوة جديدة                 |
| تهيئة        | `/app/onboarding/{step}`              | آخر خطوة محفوظة للعضو                     |
| طلب اعتماد   | `/app/approvals/{request_id}`         | inbox بعد رفض الوصول                      |
| استثناء حضور | `/app/attendance/exceptions/{id}`     | قائمة النطاق إذا لم يعد assignment فعالًا |
| مسير         | `/app/payroll/runs/{id}`              | تقرير الحالة فقط إذا انتهى الدور          |
| قسيمة        | `/app/self-service/payslips/{period}` | ESS مع masked status                      |
| تقرير        | `/app/reports/{run_id}`               | سجل job بدون ملف منتهي                    |
| تذكرة دعم    | `/support/tickets/{id}`               | تذكرة العميل دون employee document        |

لا نضع salary أو IBAN أو access token في query string أو analytics. الرابط العميق ليس authorization؛ هو مجرد entry point يعاد حسمه.

## 7. مصفوفة الإشعارات التي تدفع الرحلة

| الحدث                       | المستلم                  | القناة الافتراضية    | الأولوية                 | الإجراء التالي                  |
| --------------------------- | ------------------------ | -------------------- | ------------------------ | ------------------------------- |
| دعوة جديدة/قرب انتهاء       | المدعو وAdmin            | Email + In-app       | عادية/عالية قرب الانتهاء | قبول أو إعادة إرسال مخولة       |
| عضوية معلقة/دور حساس        | المستخدم وOwner          | In-app + Email أمني  | عالية                    | مراجعة assignment/MFA           |
| طلب يحتاج اعتمادًا          | صاحب الدور التالي        | In-app + Email       | عالية حسب SLA            | فتح الطلب واتخاذ قرار           |
| attendance exception        | الموظف/المدير/Attendance | In-app               | عادية                    | تصحيح أو اعتماد                 |
| payroll blocked/locked/paid | Payroll/Finance/Employee | In-app؛ Email للحالة | حرجة/عادية               | إصلاح المصدر/مراجعة/فتح القسيمة |
| payment partial/failed      | Finance/Owner            | In-app + Email       | حرجة                     | retry أو reconciliation case    |
| مستند/عهدة ناقصة            | Employee/HR/Asset        | In-app + Email       | عادية                    | رفع/تأكيد/تصعيد                 |
| تقرير جاهز/منتهي            | الطالب                   | In-app + Email       | عادية                    | تنزيل قبل expiry                |
| break-glass بدأ/انتهى       | Security/Owner/Support   | In-app + Email أمني  | حرجة                     | مراجعة audit وإغلاق التذكرة     |

كل notification يملك `event_id` وtemplate version وlocale وretry count؛ فشل الإرسال لا يغير حالة المورد، ويظهر في notification center.

## 8. حالات عابرة للرحلات

| الحالة                   | تجربة المستخدم                                                | قاعدة النظام                                  |
| ------------------------ | ------------------------------------------------------------- | --------------------------------------------- |
| جلسة منتهية أثناء نموذج  | يحفظ draft آمنًا إن لم يحتوِ restricted fields، ثم يعيد login | لا يرسل command بعد refresh بلا مراجعة صلاحية |
| طلبان لنفس الزر          | رسالة «تم استلام الطلب» مع نفس المرجع                         | idempotency لكل command حساس                  |
| تعديل متزامن             | يوضح أن البيانات تغيرت ويعرض reload/compare                   | optimistic concurrency/version check          |
| شبكة بطيئة               | skeleton ثم status، لا spinner بلا نهاية                      | timeout وjob status قابل للاستعلام            |
| صلاحية سحبت أثناء الرحلة | Access denied مع رابط inbox مناسب                             | deny wins وإلغاء signed URL الحساس            |
| فترة مقفولة              | يشرح سبب القفل ويوجه إلى adjustment                           | لا overwrite snapshot                         |
| صفوف كثيرة/ملف كبير      | تقدم واستئناف وأخطاء صفية قابلة للتنزيل                       | background job وDLQ وtenant guard             |
| تغيير اللغة/الاتجاه      | يحتفظ بالمكان والفلتر دون تغيير المعنى                        | keys مستقرة وRTL/LTR اختبار فعلي              |
| حذف/أرشفة سجل            | يعرض أثرًا وتاريخًا، لا يختفي بلا مرجع                        | soft delete حيث يلزم وaudit append-only       |

## 9. حالات قبول User Journey

| ID     | Given                         | When                           | Then                                                                 |
| ------ | ----------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| JRN-01 | رابط دعوة منتهٍ               | يفتحه المدعو                   | لا تنشأ جلسة أو membership، ويظهر طلب دعوة جديدة                     |
| JRN-02 | مستخدم في عميلين              | يدخل من نفس المتصفح            | يختار membership صريحة ولا تختلط البيانات أو التقارير                |
| JRN-03 | tenant بلا timezone أو entity | يكمل onboarding                | يحفظ progress ولا يفتح payroll/attendance                            |
| JRN-04 | مقاعد الخطة ممتلئة            | Admin يدعو عضوًا               | لا يُرسل email وتظهر خطوة ترقية/تحرير مقعد                           |
| JRN-05 | عضوية سُحبت أثناء طلب         | يرسل command                   | يرفض الخادم ويظل draft/المورد كما هو                                 |
| JRN-06 | Employee غير مربوط            | يفتح ESS                       | يرى حالة الربط ولا يرى موظفًا آخر أو قسيمة                           |
| JRN-07 | Offline punch مكرر            | تعود الشبكة                    | تُدمج العملية بمفتاح idempotency وتظهر pending ثم نتيجة واحدة        |
| JRN-08 | Manager ليس صاحب نطاق التاريخ | يفتح approval                  | لا يرى الطلب ولا يستطيع اعتماده بتغيير URL                           |
| JRN-09 | رصيد إجازة يتغير بالتوازي     | يرسل موظفان طلبًا متداخلًا     | ينجح الحجز المسموح واحدًا فقط أو يعاد القرار بوضوح                   |
| JRN-10 | run يحتوي مصدرًا ناقصًا       | Payroll يحسب                   | الحالة blocked مع صفوف/مصادر ناقصة، دون payslip                      |
| JRN-11 | Payroll Officer أنشأ run      | يحاول lock ذاتيًا مع four-eyes | يرفض ويطلب reviewer مستقلًا                                          |
| JRN-12 | payment batch جزئي            | يعود callback                  | تبقى الصفوف الناجحة paid والفاشلة قابلة لإعادة المحاولة دون دفع مكرر |
| JRN-13 | IBAN ضمن report view فقط      | يطلب export                    | يعرض masked أو يرفض، ويسجل reason إن سمح                             |
| JRN-14 | candidate مطابق لـPerson قائم | يحول إلى hire                  | يتوقف للمراجعة ولا ينشئ Person مكررًا                                |
| JRN-15 | review cycle مقفول            | يغير الموظف تقييم المدير       | يفتح اعتراضًا/نسخة جديدة ولا يعدل snapshot الأصلي                    |
| JRN-16 | أصل غير معاد عند الخروج       | يغلق HR المخالصة               | settlement يبقى pending/dispute ولا يخصم بصمت                        |
| JRN-17 | sync webhook بلا توقيع صحيح   | يصل إلى adapter                | يعزل الطلب ويرفضه ولا يغير الحقيقة الداخلية                          |
| JRN-18 | support break-glass منتهي     | يطلب document                  | لا يحصل على signed URL ويسجل الرفض والانتهاء                         |
| JRN-19 | projection متأخر              | يفتح المدير dashboard          | يرى `stale` ووقت آخر تحديث بدل أرقام توحي بحداثة غير موجودة          |
| JRN-20 | تغيير اللغة إلى العربية       | يكمل form/approval             | RTL وlabels والأرقام والتاريخ سليمة ولا تضيع المدخلات                |

## 10. مؤشرات الرحلات وبوابات التفعيل

قبل Pilot نثبت event taxonomy التالية: `session_started`, `onboarding_step_completed`, `member_invited`, `employee_linked`, `punch_submitted`, `request_submitted`, `approval_decided`, `payroll_calculated`, `payroll_locked`, `payment_reconciled`, `report_exported`, `support_escalated`.

لا نفعّل الرحلة تجاريًا إلا إذا تحققت البوابة المناسبة:

| البوابة    | الحد الأدنى                                                                    |
| ---------- | ------------------------------------------------------------------------------ |
| Onboarding | entity + timezone + policy + member + first employee أو سبب واضح للتأجيل       |
| Attendance | device/file identity، idempotency، exception queue، وسجل policy version        |
| Leave      | reservation/ledger transaction واختبار overlap وconcurrency                    |
| Payroll    | snapshot، four-eyes، lock، payment idempotency، reconciliation، payslip access |
| ESS        | employee link، masked fields، mobile/RTL، expired-session recovery             |
| Support    | ticket scope، masked PII، break-glass expiry، audit search                     |

## 11. مخرجات الأجزاء التالية

- **PART 6:** تحويل نقاط الدخول والروابط العميقة إلى Information Architecture وroute guards وnavigation حسب الدور.
- **PART 7:** تحويل كل خطوة UI أو حالة إلى جرد شاشات كامل مع loading/empty/error/success.
- **PART 9:** تحويل Trigger/Validation/Approval/Processing إلى Workflows قابلة للتنفيذ.
- **PART 10–13:** ربط الرحلات بجداول وAPI وRLS واختبارات E2E وperformance.

الكتالوج الآلي المرفق يصف الحالات والخطوات والحدود دون تشغيل أي رحلة تلقائيًا.
