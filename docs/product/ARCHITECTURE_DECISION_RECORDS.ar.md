# سجل القرارات المعمارية — ADRs

**التاريخ:** 8 سبتمبر 2026. **المرجع:** [PART 3](PART_03_PRODUCT_ARCHITECTURE.ar.md).
**الحالة:** قرارات مبدئية للمراجعة؛ لا تعتبر موافقات تشغيل أو أمن أو علامة تجارية.

## ADR-001 — Modular Monolith أولًا

**الحالة:** مقبول مبدئيًا.
**السياق:** المشروع يحتوي مجالات كثيرة وفريق يحتاج سرعة، والرواتب/الأرصدة تتطلب معاملات متماسكة.
**القرار:** تطبيق واحد بحدود domains وapplication services وrepositories وworkers.
**لماذا:** يقلل كلفة التشغيل وتكرار العقود، ويتيح معاملة واحدة.
**نرفضه إذا:** أثبت قياس أن مجالًا مستقلًا يحتاج نشرًا أمنيًا أو حملًا أو فريقًا مختلفًا؛ عندها يسجل ADR لاستخراجه مع contract وownership.
**الأثر:** الانضباط الداخلي والاختبارات أهم من توزيع الخدمات مبكرًا.

## ADR-002 — PostgreSQL/Supabase مرجع المعاملات

**الحالة:** مقبول مبدئيًا.
**السياق:** المشروع يستخدم Supabase Auth/PostgreSQL/RLS/Storage، والمجال مالي وعلاقاته علائقية.
**القرار:** PostgreSQL للكيانات والمعاملات وviews/RPC عند الحاجة؛ Supabase كطبقة مستضافة وفق حدود الأسرار.
**الأثر:** نحتاج migration contracts وRLS حقيقية، ونفصل service role عن client. لا تعتبر سهولة Supabase بديلًا عن تصميم tenant.

## ADR-003 — Shared schema مع tenant_id

**الحالة:** قرار مستهدف يحتاج تنفيذًا واختبارًا.
**السياق:** SaaS يحتاج عزل عدة عملاء، والمخطط الحالي يرتكز على `companies/subsidiaries` دون إثبات شامل لtenant.
**القرار:** tenant root وmembership و`tenant_id` إلزامي في كل جدول tenant-owned، مع RLS وcompound indexes. الشركة القانونية كيان داخل tenant.
**البدائل:** schema لكل عميل أو database لكل عميل؛ تدرس لعميل Enterprise عند سبب إقليمي/أمني مقاس.
**الأثر:** migration backfill واختبارات عميلين ومنع global uniqueness غير المقصود.

## ADR-004 — دفاع مزدوج للصلاحيات

**الحالة:** مقبول.
**السياق:** UI role checks مفيدة للتجربة لكنها لا تحمي البيانات، وRLS وحدها لا تصف كل workflow أو separation of duties.
**القرار:** session + tenant context + application authorization + RLS + storage policy + audit. أي طبقة تفشل تغلق الطلب، ولا تمنح طبقة المتصفح وصولًا.
**الأثر:** كل command يحمل actor/tenant/scope، وكل test يثبت السماح والرفض.

## ADR-005 — Outbox مع at-least-once

**الحالة:** مقبول.
**السياق:** إشعارات وتكاملات وتقارير لا يجب أن تجعل معاملة الراتب غير متماسكة، وإعادة التشغيل متوقعة.
**القرار:** سجل outbox في نفس transaction، Worker مع retry/dead-letter، ومستهلك idempotent.
**الأثر:** لا نعتمد على callback واحد أو fire-and-forget؛ نعرض الحالة وlast attempt.

## ADR-006 — Typed commands/queries قبل Public REST واسع

**الحالة:** مقبول مبدئيًا.
**السياق:** Server Functions الحالية مفيدة للتطبيق نفسه، لكن API عام مبكرًا يثبت عقودًا قبل التحقق.
**القرار:** عقود typed داخل التطبيق (server functions أو route handlers) مع error codes وpagination؛ Public REST `/api/v1` بعد تثبيت النواة وحاجة تكامل فعلية.
**الأثر:** لا يبنى GraphQL أو marketplace بلا consumer وcontract tests؛ adapter خارجي لا يصل DB مباشرة.

## ADR-007 — ملفات الموظفين في private object storage

**الحالة:** مقبول.
**السياق:** هوية وإقامة وعقود وIBAN وPDF بيانات Restricted، وpublic URL غير مقبول.
**القرار:** bucket خاص ومسار tenant/employee/document/version، metadata في DB، signed URL قصير وفحص تنزيل وتدقيق.
**الأثر:** الرفع multipart/virus/type/size وإلغاء الرابط؛ لا نسجل محتوى أو سرًا في analytics.

## ADR-008 — Jobs للأعمال الثقيلة وعمليات الاستيراد

**الحالة:** مقبول مبدئيًا.
**السياق:** استيراد punch وتقارير وPDF وإشعارات قد تتجاوز زمن HTTP.
**القرار:** Command ينشئ job transactionally ويعيد status؛ worker قابل للاستئناف. لا يسجل النجاح قبل اكتمال الجزء المعلن.
**الأثر:** progress وretry وdead-letter، واختبار tenant في كل payload.

## ADR-009 — AI لا يقرر مالًا أو وصولًا

**الحالة:** مقبول.
**السياق:** المشروع يتعامل مع راتب وخصم ومعلومات موظف؛ قيمة AI غير مثبتة في PART 1–2.
**القرار:** لا AI في اعتماد خصم أو راتب أو توظيف أو صلاحية. يمكن دراسة بحث سياسة أو تلخيص فرق مع مصدر وhuman review بعد قياس وخصوصية وتكلفة.
**الأثر:** أي feature مستقبلية تحمل data minimization وopt-out وaudit وfallback بشري.

## ADR-010 — انتقال تدريجي من AppContext والكود الحالي

**الحالة:** مقبول.
**السياق:** `AppContext` كبير ويحمل mock/live ومهام domains؛ إعادة الكتابة الشاملة مخاطرة.
**القرار:** compatibility adapter، ثم استخراج domain واحد، وإعادة قراءة بعد كل mutation، مع إيقاف Demo في Live.
**ترتيب:** Access/tenant → People → Time/Leave → Payroll → Reporting/Commerce.
**الأثر:** commits صغيرة قابلة للتراجع، وتغلق contract tests قبل إزالة adapter.

## ADR-011 — Commerce لا يمنح RBAC

**الحالة:** مقبول.
**السياق:** الباقة تحدد features/limits، بينما الدور يحدد ما يحق للمستخدم فعله؛ خلطهما يسبب تسريبًا أو صلاحية زائدة.
**القرار:** authorize = released feature + plan entitlement + role permission + data scope + entity status. تغيير الخطة لا ينشئ دورًا ولا يوسع النطاق.
**الأثر:** upgrade/downgrade يحافظان على البيانات والتاريخ، ويمنعان الإضافة فوق الحد برسالة قابلة للفهم.

## ADR-012 — Learning Bridge بدل إعادة بناء LMS

**الحالة:** مؤجل إلى إثبات التكامل.
**السياق:** C‑SmarX/LeadXera قد يملكان وظائف تدريب؛ تكرارها يوسع المنتج ويضيع مصدر الحقيقة.
**القرار:** عقد ربط محدود لمعرف الموظف وحالة التدريب/الشهادة، مع مالك بيانات وتدفق فشل؛ لا نسخ محتوى أو افتراض SSO/API.
**الأثر:** يمكن تعديل العلاقة بعد وثيقة الوصول أو إبقاء المنتج مستقلًا دون إعادة بناء النواة.

## 3. القرارات المفتوحة قبل Architecture Freeze

| ID   | القرار                                              | البدائل                                            | مالك الدور               | بوابة الحسم                          |
| ---- | --------------------------------------------------- | -------------------------------------------------- | ------------------------ | ------------------------------------ |
| O-01 | هل HR منتج مستقل أم موديول C‑SmarX                  | مستقل متكامل / داخل C‑SmarX / مؤجل                 | Business + Product       | خريطة الملكية والوصول والطلب التجاري |
| O-02 | `company` الحالية tenant أم entity داخل tenant جديد | mapping واحد / tenant root جديد                    | Architecture + Security  | backfill وRLS عميلين                 |
| O-03 | ORM/SQL/RPC وحدود repository                        | SQL typed / query builder / ORM جزئي               | Engineering              | query plans وmigration contracts     |
| O-04 | Queue/Worker المستضاف                               | Supabase/Edge job / خدمة queue                     | DevOps                   | حجم الاستيراد وSLO وتكلفة التشغيل    |
| O-05 | مزود الدفع التجاري                                  | فاتورة وإثبات خارجي / مزود محلي / Stripe إذا ملائم | Finance + Legal          | بلد الكيان والعقد والتكامل           |
| O-06 | حفظ المستندات                                       | Supabase Storage / S3-compatible                   | Security + DevOps        | سيادة البيانات والتكلفة والنسخ       |
| O-07 | أول موصل حضور                                       | ملف معياري / جهاز محدد / API مزود                  | Product + Implementation | عميل تجريبي ووثائق مصدر              |
| O-08 | هدف Enterprise isolation                            | shared schema / schema / database                  | Security + Finance       | طلب عقد وRTO/RPO وتكلفة تشغيل        |
| O-09 | API عام                                             | server functions فقط / REST v1 / GraphQL لاحق      | Product + Integrations   | consumer حقيقي وcontract tests       |

## 4. قاعدة تغيير القرار

أي تغيير في ADR يضيف: سببًا ودليلًا وتاريخًا، بدائل، أثرًا على البيانات والأمان والتكلفة، خطة انتقال، واختبار رجوع. لا نغير tenant strategy أو currency/identity أو payroll source-of-truth داخل إصلاح UI صغير. عند بقاء دليل تجاري مفقود، نستخدم adapter أو feature flag بدل ترسيخ افتراض لا يمكن الرجوع عنه.
