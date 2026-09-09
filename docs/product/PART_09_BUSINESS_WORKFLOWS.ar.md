# PART 9 — Business Workflows

**الحالة:** مواصفات مبدئية قابلة للتحويل إلى commands وjobs وواجهات API؛ لا تُفعّل التشغيل وحدها.

**تاريخ الإصدار:** 8 سبتمبر 2026  
**المرجع:** PART 2، PART 3، PART 4، PART 5، PART 6، PART 7، PART 8  
**النطاق:** دورة العمل المؤسسية من إنشاء الطلب إلى القرار والتنفيذ والمطابقة والتدقيق، مع التركيز على الحضور والخصومات والسلف والرواتب والصرف المبكر والمخالصة.

## 1. قاعدة موحدة لكل Workflow

كل مسار عمل يمر بالترتيب الآتي، حتى إذا كان القرار آليًا:

1. **Trigger:** حدث من المستخدم أو جهاز أو مزود خارجي أو جدولة زمنية.
2. **Context وValidation:** تحديد tenant وactor وeffective date، ثم التحقق من الحالة والحدود والتكرار والبيانات الحساسة.
3. **Action command:** أمر مسمى قابل لإعادة المحاولة، يكتب سجلًا أوليًا ولا يغير أكثر من aggregate مالك للحقيقة في المعاملة نفسها.
4. **Approval وPolicy:** تطبيق RBAC وscope وSoD وسلسلة موافقات النسخة السارية. غياب صاحب القرار يوقف المسار في حالة واضحة ولا يمرر تلقائيًا.
5. **Notification:** حدث idempotent يرسل للمستلمين المسموح لهم؛ لا تُرسل قيم الراتب أو رقم الهوية في قناة غير مشفرة.
6. **Processing:** job أو transaction قصيرة، مع outbox وidempotency key وقياس زمن الانتظار.
7. **Completion أو Failure:** نتيجة قابلة للعرض وإعادة المحاولة أو التعويض، دون حذف أثر المحاولة.
8. **Audit event:** actor، action، entity، old/new summary، reason، IP/device، correlation id، timestamp، policy version.

لا تُعد الواجهة العملية مكتملة لمجرد وجود زر حفظ؛ يجب أن يظهر لها مالك حقيقة، صلاحية، انتقال حالة، فشل، إشعار، وتسوية أو أثر تدقيق.

## 2. الحالات القياسية

| الحالة             | المعنى                           | الانتقالات المسموحة             |
| ------------------ | -------------------------------- | ------------------------------- |
| `draft`            | مسودة لم تُرسل                   | submit، cancel                  |
| `submitted`        | أُرسلت وتجاوزت التحقق الأولي     | route، return، reject           |
| `pending_approval` | تنتظر موافقة واحدة أو أكثر       | approve، return، reject، expire |
| `approved`         | اكتملت الموافقات                 | process، cancel قبل القفل       |
| `processing`       | job أو transaction قيد التنفيذ   | complete، retry، fail           |
| `completed`        | اكتمل الأثر والمطابقة            | archive، reverse وفق سياسة      |
| `returned`         | أعيدت للمُنشئ بسبب نقص           | edit، cancel، resubmit          |
| `rejected`         | قرار نهائي بالرفض                | appeal إن سمحت السياسة          |
| `failed_retryable` | فشل مؤقت                         | retry بعد backoff               |
| `failed_terminal`  | فشل يحتاج تدخلًا                 | incident، manual replay         |
| `cancelled`        | أُلغي قبل الأثر غير القابل للعكس | archive                         |
| `expired`          | انتهت مهلة SLA                   | escalate، re-route              |
| `locked`           | لا يسمح بالتعديل أثناء التسوية   | complete، unlock بتفويض         |

## 3. ضوابط مشتركة

- **Tenant context:** يُستخرج من الجلسة أو token ولا يُقبل من body وحده. كل query يمر عبر tenant guard وRLS.
- **Effective dating:** لا يغير الطلب سجلًا بدأ احتسابه أو مسيرة مقفلة؛ التصحيح ينشئ adjustment أو reversal.
- **Permission وSoD:** منشئ طلب الراتب أو الدفع لا يعتمد طلبه، وموظف المطابقة لا يوافق على استثناءه نفسه.
- **Concurrency:** version أو optimistic lock يمنع تعديل طلب بعد اعتماده. يعرض النظام نسخة جديدة بدل الكتابة فوق التعديل.
- **Idempotency:** لكل command مفتاح مركب من tenant وactor وbusiness reference وoperation؛ إعادة الطلب تعيد النتيجة السابقة.
- **Outbox وInbox:** يُكتب الحدث داخل المعاملة ثم ينشره worker؛ الرسائل المكررة تُهمل عبر event id.
- **Privacy:** الإشعارات تعرض رابطًا وملخصًا عامًا؛ التفاصيل المالية في جلسة مصادق عليها.
- **Time وlocale:** الحساب في UTC مع timezone المؤسسة؛ تواريخ العرض والتقارير حسب إعداد المؤسسة.
- **Break-glass:** وصول الدعم أو الطوارئ مؤقت، بسبب مكتوب، ومراجعة لاحقة؛ لا يمنح صلاحية دائمة.

## 4. كتالوج المسارات

| المعرّف | المسار                         | المالك التشغيلي                           | الأثر الرئيسي                    |
| ------- | ------------------------------ | ----------------------------------------- | -------------------------------- |
| WF-01   | إنشاء المؤسسة والتهيئة         | org_owner                                 | tenant وprofile وpolicy baseline |
| WF-02   | الدعوة والعضوية وربط الموظف    | org_admin / hr_operator                   | membership وemployee link        |
| WF-03   | دورة حياة الموظف               | hr_manager                                | employee version وdocuments      |
| WF-04   | استيراد الحضور                 | attendance_officer                        | raw punches وattendance day      |
| WF-05   | تصحيح الحضور والإضافي والتأخير | line_manager / attendance_officer         | adjustment وpolicy decision      |
| WF-06   | الإجازة ورصيدها                | employee / manager                        | leave request وledger            |
| WF-07   | مسيرة الرواتب                  | payroll_officer / finance_officer         | payroll run وpayslip snapshot    |
| WF-08   | الدفع والمطابقة                | finance_officer                           | payment batch وreconciliation    |
| WF-09   | السلفة والخصم بالأقساط         | employee / finance_officer                | advance وinstallment ledger      |
| WF-10   | المصروفات والصرف المبكر        | employee / finance_officer                | reimbursement أو early payout    |
| WF-11   | الخروج والمخالصة               | hr_manager / finance_officer              | exit case وsettlement            |
| WF-12   | التوظيف إلى مباشرة العمل       | recruiter / hr_manager                    | candidate وemployee              |
| WF-13   | دورة الأداء                    | performance_lead / line_manager           | cycle وreview وacknowledgment    |
| WF-14   | العهد والأصول                  | asset_manager / employee                  | custody assignment وreturn       |
| WF-15   | التكاملات والتقارير المجدولة   | org_admin / support_agent                 | sync job وreport export          |
| WF-16   | الاشتراك والدعم والوصول الطارئ | org_owner / billing_admin / support_agent | commerce case وsupport audit     |

## 5. المسارات المالية ومسارات الوقت

### WF-04 — استيراد الحضور

**Trigger:** رفع ملف، مزامنة جهاز بصمة، أو job مجدول.  
**Validation:** فحص نوع الملف وحجمه، timezone، معرف الجهاز، تكرار الصف، الموظف الفعال، ونافذة التاريخ. الصفوف غير المعروفة لا تُسقط؛ تُحفظ في reject report مع سبب.  
**Action:** إنشاء import batch ثم raw punch records بمفتاح device/date/time/employee؛ لا يحسب يوم الحضور داخل خطوة الإدخال.  
**Processing:** job يحول الصفوف إلى attendance day بعد تطبيق الورديات والعطلات والتسامح.  
**Completion:** عدد المقبول والمرفوض والمتعارض، رابط تقرير، وevent للتنبيه.  
**Recovery:** إعادة تشغيل الصفوف المرفوضة بعد تصحيح mapping فقط، مع نسخة batch جديدة مرتبطة بالأصل.

### WF-05 — تصحيح الحضور والإضافي والخصم

**Trigger:** طلب موظف أو تعديل من مسؤول حضور أو rule يكتشف تأخيرًا/خروجًا مبكرًا.  
**Validation:** وجود punch أو سبب موثق، عدم قفل الفترة، عدم تجاوز حدود الإضافي، وعدم تكرار adjustment للفترة نفسها.  
**Approval:** تعديل الموظف يحتاج manager؛ تعديل يؤثر في payroll بعد القفل يحتاج payroll_officer وسببًا؛ الاستثناء عالي القيمة يحتاج موافقًا ثانيًا.  
**Processing:** يحسب engine ساعات العمل والتأخير والخصم والإضافي وفق policy version، ثم ينشئ ledger entries؛ لا يعدل الراتب مباشرة.  
**Completion:** يظهر القرار في attendance day ويرسل أثرًا إلى payroll projection.  
**Compensation:** إذا ظهرت المعلومة بعد القفل، تُنشأ adjustment للدفعة اللاحقة أو reversal مع موافقة، ولا يعاد فتح المسيرة بصمت.

### WF-06 — الإجازة والرصيد

**Trigger:** employee يرسل طلب إجازة.  
**Validation:** النوع، التواريخ، الرصيد المتاح، التداخل، فترة notice، المستند، وcalendar المؤسسة.  
**Approval:** manager ثم HR عند نوع حساس أو تجاوز policy؛ delegate يستمر حتى تاريخ نهاية التفويض فقط.  
**Processing:** حجز مؤقت للرصيد عند الاعتماد، ثم ترحيل ledger نهائي بعد اكتمال الموافقة؛ الإلغاء يعيد الرصيد بقيد عكسي.  
**Completion:** تقويم الفريق ورصيد الموظف وnotification متسقة عبر event واحد.

### WF-07 — مسيرة الرواتب

**Trigger:** payroll_officer ينشئ فترة.  
**Validation:** الفترة غير متداخلة، كل الموظفين لهم contract وpolicy، attendance imports مكتملة أو exceptions مقبولة، ولا توجد adjustments غير معالجة.  
**Processing:** snapshot للمدخلات، calculate job، validation report، ثم مرحلة review. النتائج المؤقتة قابلة للمقارنة مع المسيرة السابقة.  
**Approval وLock:** payroll_officer يراجع؛ finance_officer يعتمد الإجماليات؛ org_owner أو مفوض يعتمد الإغلاق حسب الخطة. بعد `locked` لا تتغير المدخلات.  
**Completion:** payslip snapshot وdeduction ledger وpayment batch جاهزة؛ الإشعار يرسل رابطًا آمنًا.  
**Failure:** فشل موظف واحد يعزل في exception row؛ لا يفشل المجموع بلا تفسير. إعادة الحساب تستخدم run version جديدًا.

### WF-08 — الدفع والمطابقة

**Trigger:** مسيرة مقفلة تنشئ payment batch، ثم provider callback أو رفع bank statement.  
**Validation:** مجموع الدفعة يساوي المسيرة، حساب المستفيد فعال، currency وprovider account مطابقان، لا يوجد batch مكرر.  
**Approval:** finance maker/checker؛ الدفع فوق حد المؤسسة يحتاج موافقة ثانية.  
**Processing:** إرسال provider request بمفتاح idempotency، polling أو webhook، ثم reconciliation job يطابق reference/amount/date.  
**Completion:** `paid` أو `partially_reconciled` أو `exception`; لا يُعد `paid` من callback غير موثق.  
**Recovery:** استعلام حالة المزود قبل retry، ثم manual reconciliation بسبب مكتوب.

### WF-09 — السلفة والخصم بالأقساط

**Trigger:** طلب سلفة من employee أو إنشاء finance case.  
**Validation:** حد السلفة، الأهلية، صافي الراتب، سلف مفتوحة، جدول الخصم، وموافقة contract.  
**Approval:** manager وfinance حسب القيمة؛ finance لا يعتمد استثناءه.  
**Processing:** صرف principal، إنشاء installment schedule وdeduction ledger؛ تأجيل القسط عند إجازة مصرح بها لا يحذف القسط.  
**Completion:** حالة السلفة، المتبقي، next due، وربط كل قسط بمسيرة.  
**Recovery:** فشل الصرف يبقي السلفة `approved` أو `failed_retryable` بلا قيد خصم؛ التسوية المبكرة تنشئ quote ثم موافقة.

### WF-10 — المصروفات والصرف المبكر

**Trigger:** expense claim أو early payout request.  
**Validation:** receipt، cost center، policy category، duplicate receipt hash، amount، وتاريخ الصرف. الصرف المبكر يحتاج سببًا ويحسب أثره على payroll/cash.  
**Approval:** manager للغرض، finance للمبلغ، وorg_owner/مفوض لطلب خارج السياسة.  
**Processing:** OCR اختياري لا يعتمد القرار وحده؛ job يراجع المبلغ ويصدر reimbursement أو advances offset.  
**Completion:** transaction reference وledger؛ الصرف المبكر يظل payable/settled واضحًا ولا يختلط بصافي الراتب.

### WF-11 — الخروج والمخالصة

**Trigger:** termination notice أو انتهاء contract.  
**Validation:** تاريخ آخر يوم، الإشعار، عهد وأصول، سلف، إجازات، payroll cutoff، وسبب الخروج.  
**Approval:** HR يعتمد الحالة؛ line manager يثبت التسليم؛ finance يعتمد الحساب؛ لا يصرف قبل اكتمال holds الحرجة.  
**Processing:** snapshot للراتب والمستحقات والخصومات، حساب leave encashment وnotice وadvance balance، ثم settlement statement version.  
**Completion:** موافقة الموظف/استلامه، payment batch أو hold reason، إغلاق access وفق policy، audit شامل.  
**Recovery:** تصحيح بعد التوقيع عبر amendment version؛ لا تحذف النسخة الموقعة.

## 6. المسارات الإدارية والموارد البشرية

### WF-01 — إنشاء المؤسسة والتهيئة

ينشئ org_owner tenant، المنطقة الزمنية والعملة واللغة، ثم يختار policy baseline ويضيف أول admin. يظل الحساب `setup_incomplete` حتى يكتمل domain وlegal name وبيانات الفوترة الاختيارية. يملك النظام checklist قابلة للاستئناف وحقولًا تمنع إنشاء payroll قبل تعريف calendar وpay policy.

### WF-02 — الدعوة والعضوية وربط الموظف

تُنشأ الدعوة بمفتاح tenant/email/role وإقفال زمني. يقبل المدعو الدعوة مرة واحدة، ثم يُنشأ membership منفصل عن employee profile. إذا كان البريد مرتبطًا بعضو آخر أو موظفًا مؤرشفًا، تظهر عملية ربط يوافق عليها HR بدل دمج صامت.

### WF-03 — دورة حياة الموظف

`draft → active → leave_of_absence أو suspended → exited → archived`. كل تغيير ينشئ effective-dated employment version، ويُراجع المستندات والـmanager والـcost center. تعليق الحساب يوقف الدخول ولا يمس payroll history؛ الأرشفة لا تحذف سجلات التدقيق.

### WF-12 — التوظيف إلى مباشرة العمل

تنتقل vacancy من draft إلى published ثم candidate stages، مع consent وdedupe. العرض الوظيفي versioned ويحتاج HR approval؛ عند القبول تُنشأ employee profile وonboarding tasks بعملية idempotent. رفض المرشح يغلق بياناته وفق retention policy ولا يكشف ملاحظات المقابلة.

### WF-13 — دورة الأداء

يُنشئ performance_lead cycle بالأهداف وcalibration window، ثم يفتح self review وmanager review، ويقفل بعد acknowledgment. التعديل بعد القفل يتطلب reopen مؤقتًا مع سبب وأثر audit؛ لا يظهر manager feedback لمستخدم غير مخول.

### WF-14 — العهد والأصول

asset_manager يسجل الأصل ورقمه وحالته، ثم يطلب assignment؛ employee يقبل الاستلام بالتوقيع أو يرفع اعتراضًا. عند الخروج يتحول الأصل إلى return inspection، وتُربط التلفيات أو الفقد بقضية منفصلة لا بخصم تلقائي.

## 7. التكامل والدعم

### WF-15 — التكاملات والتقارير المجدولة

يُنشئ org_admin connection مع provider مع اختبار اتصال وصلاحيات أقل. sync job يحمل cursor وwatermark ويمنع التكرار؛ فشل صفحة واحدة يعزلها ويترك آخر sync ناجحًا ظاهرًا. report job يحفظ filter snapshot وtemplate version ويصدر PDF/XLSX من worker، مع رابط منتهي الصلاحية.

### WF-16 — الاشتراك والدعم والوصول الطارئ

تغييرات الخطة تمر عبر commerce provider ثم entitlement projection؛ فشل الدفع يرسل grace-period events قبل التعليق. support_agent يفتح ticket بtenant scope ولا يرى payroll values افتراضيًا. break-glass يطلب سببًا ومدة وموافقًا ثانيًا، ويسجل كل قراءة للبيانات الحساسة، ثم ينتهي تلقائيًا.

## 8. Approval Engine Contract

- `approval_request` يحمل `workflow_id` و`subject_id` و`policy_version` و`sequence` و`approver_scope` و`due_at`.
- القرار واحد من approve/return/reject/skip_by_policy؛ approve بلا comment مسموح فقط إذا كانت السياسة لا تشترط تفسيرًا.
- لا يُحسب approver من بيانات العميلة المرسلة في الواجهة؛ يحسمه server-side من الدور والنطاق وeffective date.
- self-approval مرفوض افتراضيًا، والتفويض لا يتجاوز chain أو تاريخ الانتهاء.
- عند غياب approver تبقى الحالة `blocked_no_approver` ويُنشأ تنبيه للمالك؛ لا يوجد fallback إلى super admin تلقائيًا.
- كل decision يحمل decision id فريدًا؛ إعادة النقر تعيد القرار السابق ولا تنشئ خطوة ثانية.

## 9. Jobs والإشعارات والتعويض

| نوع العملية  | queue        | retry                       | timeout    | التعويض                 |
| ------------ | ------------ | --------------------------- | ---------- | ----------------------- |
| حساب payroll | payroll      | 3 محاولات مع backoff        | 15 دقيقة   | run version جديد        |
| مزامنة جهاز  | integration  | 5 محاولات                   | 5 دقائق    | cursor آخر ناجح         |
| إرسال دفع    | payment      | لا retry قبل query provider | حسب المزود | reconciliation case     |
| تصدير تقرير  | report       | 3 محاولات                   | 10 دقائق   | حذف artifact المؤقت فقط |
| إشعار        | notification | 5 محاولات ثم DLQ            | دقيقتان    | إعادة إرسال event نفسه  |

الإشعارات الافتراضية In-app وEmail، مع SMS/Push اختيارية. كل template يحمل locale وversion وpriority؛ event_id يمنع التكرار. رسائل الفشل تعرض action آمنًا مثل «أعد المحاولة» أو «افتح الاستثناء» وتخفي تفاصيل سرية.

## 10. SLA والتصعيد

| المسار               | هدف القرار   | تصعيد أول          | تصعيد نهائي        |
| -------------------- | ------------ | ------------------ | ------------------ |
| إجازة عادية          | يوم عمل واحد | manager delegate   | HR queue           |
| تصحيح حضور           | يومان        | attendance_officer | payroll exception  |
| مسيرة payroll review | 4 ساعات      | finance_officer    | org_owner          |
| payment exception    | ساعتان       | finance lead       | incident/on-call   |
| support break-glass  | 15 دقيقة     | security function  | incident commander |

الـSLA يحسب تقويم المؤسسة ويوقف عند `returned` إذا كان السبب من المُنشئ؛ يسجل كل pause/resume.

## 11. معايير قبول قابلة للاختبار

1. **WF-A01:** لا يمكن لأمر من tenant أن يقرأ أو يغير سجلًا من tenant آخر.
2. **WF-A02:** إعادة إرسال command بنفس idempotency key تعيد نفس resource وaudit event واحد.
3. **WF-A03:** منشئ طلب لا يظهر كـapprover صالح في السلسلة.
4. **WF-A04:** انتهاء التفويض يعيد التوجيه إلى owner ولا يعتمد الطلب تلقائيًا.
5. **WF-A05:** صف حضور مكرر يذهب إلى duplicate report ولا يضاعف الساعات.
6. **WF-A06:** تعديل بعد payroll lock ينشئ adjustment ولا يغير snapshot القديم.
7. **WF-A07:** رفض الإجازة لا يحجز الرصيد، وإلغاؤها بعد الاعتماد يعيد قيدًا عكسيًا.
8. **WF-A08:** payroll employee exception لا يخفي إجمالي المسيرة ولا يسمح بالقفل قبل قرار السياسة.
9. **WF-A09:** callback دفع غير معروف لا يغير الحالة إلى paid.
10. **WF-A10:** timeout payment يستعلم provider قبل أي إعادة إرسال.
11. **WF-A11:** فشل صرف السلفة لا ينشئ deduction installment.
12. **WF-A12:** duplicate receipt لا يمكن اعتماده دون override موثق.
13. **WF-A13:** settlement بعد التوقيع يحافظ على النسخة السابقة ويضيف amendment.
14. **WF-A14:** تعليق الموظف يوقف الجلسة دون حذف payroll history.
15. **WF-A15:** قبول العرض ينشئ employee مرة واحدة حتى مع إعادة webhook.
16. **WF-A16:** report export يستخدم filter snapshot ولا يرى المستخدم حقولًا خارج scope.
17. **WF-A17:** فشل صفحة في sync لا يمس آخر cursor ناجح.
18. **WF-A18:** break-glass ينتهي في الموعد ويرسل security notification.
19. **WF-A19:** كل قرار يكتب audit يتضمن actor وreason وpolicy version.
20. **WF-A20:** job في DLQ يظهر owner وretry count وmanual replay reason.

## 12. تسليم التنفيذ

يحوّل فريق backend كل workflow إلى command/query/event contract مع schema version. يبدأ التنفيذ من WF-01 وWF-02 ثم WF-04 وWF-05 وWF-06، وبعدها WF-07 إلى WF-11؛ لا يُفتح payroll production قبل وجود ledger وlock وreconciliation. يضيف فريق الواجهة state machine وpermission-aware actions، ويحوّل فريق QA حالات القبول أعلاه إلى API وE2E tests. تبقى القواعد البلدية للرواتب والضرائب قرارًا مفتوحًا حتى تحديد الأسواق المستهدفة.
