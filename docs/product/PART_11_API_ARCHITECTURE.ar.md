# PART 11 — API Architecture

**الحالة:** عقود REST وأوامر مبدئية قابلة للتحويل إلى OpenAPI؛ لا تعني أن كل المسارات منشورة.  
**تاريخ الإصدار:** 8 سبتمبر 2026  
**المرجع:** PART 4، PART 5، PART 6، PART 9، PART 10، وserver functions الحالية داخل `src/lib/business`.

الهدف هو تقديم API ثابتة للواجهة والتطبيقات الخارجية، مع الحفاظ مؤقتًا على TanStack server functions المستخدمة في الكود الحالي. كل عملية حساسة تمر بخادم واحد يتحقق من tenant وRBAC وstate machine؛ لا يقرر المتصفح صلاحية أو مبلغًا.

## 1. الشكل العام

- **Base URL:** `/api/v1` للعميل، و`/api/platform/v1` لوظائف المنصة. لا يخلط platform token مع tenant token.
- **Resource IDs:** UUID opaque؛ أرقام المرجع البشرية للعرض والبحث فقط.
- **Methods:** GET للاستعلام، POST لإنشاء أو command، PATCH لتعديل draft/version، DELETE للإلغاء أو archive فقط. لا تستخدم PUT على ledger أو snapshot.
- **Content type:** `application/json`; الملفات عبر signed upload ثم metadata command. `application/problem+json` للأخطاء.
- **Versioning:** major في path، minor في `X-Api-Version` وschema version؛ الإضافة backward-compatible، والتغيير الكاسر يحتاج deprecation window.
- **Contract source:** OpenAPI مولّد من schemas typed؛ لا يكتب فريق الواجهة endpoint غير موجود في manifest.

## 2. المصادقة والسياق

1. `Authorization: Bearer <session access token>` من Supabase Auth أو OIDC؛ refresh token لا يرسل إلى API resource.
2. الخادم يستخرج `user_id` وmembership الفعالة من token. `X-Tenant-Id` اختياري للتبديل بين tenants المسموح بها، ويُراجع server-side؛ قيمة body لا تتغلب عليه.
3. `X-Request-Id` يمر إلى logs/audit، ويُولّد إن غاب. `traceparent` اختياري للتتبع.
4. أوامر الإنشاء والتسوية والدفع تستلزم `Idempotency-Key` (8–128 رمزًا). الخادم يحفظ hash والنتيجة لمدة policy window، ويرجع النتيجة نفسها عند إعادة الإرسال.
5. `If-Match: W/"version"` مطلوب لتعديل draft أو قرار يستند إلى نسخة؛ تعارض النسخة يرجع `409 version_conflict` مع رابط إعادة التحميل.
6. الأجهزة تستخدم device credential محدودًا لمسار punch، مع `X-Device-Id` وtimestamp/signature وallowlist للشبكة عند الحاجة؛ لا تمنح دور مستخدم.
7. webhooks من مزود الدفع/الحضور تحقق HMAC وprovider event id، وتضع payload في quarantine قبل التفسير.

## 3. envelope والاستجابات

استجابة ناجحة:

```json
{
  "data": { "id": "uuid", "status": "pending_approval" },
  "meta": { "request_id": "req_...", "as_of": "2026-09-08T12:00:00Z" }
}
```

قائمة:

```json
{
  "data": [],
  "meta": {
    "request_id": "req_...",
    "next_cursor": "opaque",
    "has_more": true,
    "total": null,
    "filters_applied": ["status"],
    "as_of": "2026-09-08T12:00:00Z"
  }
}
```

خطأ موحد قريب من RFC 9457:

```json
{
  "error": {
    "code": "leave_insufficient_balance",
    "message_key": "errors.leave.insufficient_balance",
    "message": "الرصيد المتاح لا يكفي للفترة المطلوبة",
    "fields": [{ "path": "end_date", "code": "balance" }],
    "retryable": false,
    "request_id": "req_..."
  }
}
```

لا يرجع الخطأ SQL أو stack trace أو وجود سجل restricted. 401 يعني جلسة غير صالحة، 403 صلاحية/نطاق، 404 مورد غير ظاهر أو غير موجود، 409 تعارض حالة/نسخة، 422 فشل تحقق، 429 حد معدل، 5xx فشل خدمة.

## 4. الاستعلامات والقوائم

- parameters: `page[size]` (1–100)، `page[cursor]` opaque، `filter[field]` من allowlist، `sort` مع prefix `-`، `include` محدد، و`as_of` للتقارير.
- default sort ثابت `(updated_at desc, id desc)`؛ cursor يضمن عدم تكرار الصفوف.
- البحث النصي يستخدم `q` وlocale normalization؛ لا يقبل SQL fragments أو arbitrary columns.
- totals الثقيلة اختيارية عبر `meta=summary` أو job report؛ لا يحسب `count(*)` لكل طلب قائمة كبيرة.
- export يستعمل `POST /exports` ويعيد job، لا يحول GET إلى تنزيل ملف حساس.
- كل query يطبق tenant RLS ثم scope الدور ثم field allowlist؛ projection لا يعيد أعمدة salary أو national ID إلا إذا سمح الدور.

## 5. الموارد والأوامر

### الهوية والمؤسسة

| الطريقة والمسار                                  | الغرض                                           | الصلاحيات                  |
| ------------------------------------------------ | ----------------------------------------------- | -------------------------- |
| `GET /me`                                        | المستخدم وmemberships والـlocale                | authenticated              |
| `GET /tenants`                                   | المؤسسات المتاحة للمستخدم                       | authenticated              |
| `GET/PATCH /tenants/{tenantId}/settings`         | إعداد timezone/locale/currency والسياسات العامة | org_owner/org_admin        |
| `GET/POST/PATCH /tenants/{tenantId}/departments` | الهيكل                                          | org_admin/hr_manager       |
| `POST /memberships/invitations`                  | دعوة عضو                                        | org_admin/hr_manager       |
| `POST /invitations/{token}/accept`               | قبول دعوة مرة واحدة                             | invitee                    |
| `POST /tenant-switch`                            | تثبيت سياق tenant في session                    | authenticated + membership |

### الموظفون والملفات

| الطريقة والمسار                            | الغرض                          | الصلاحيات                    |
| ------------------------------------------ | ------------------------------ | ---------------------------- |
| `GET /employees`                           | قائمة scoped مع filters        | HR/manager/auditor حسب scope |
| `POST /employees`                          | إنشاء موظف ومسودة onboarding   | hr_operator/hr_manager       |
| `GET/PATCH /employees/{id}`                | الملف العام مع version         | owner/HR                     |
| `POST /employees/{id}/employment-versions` | تغيير عقد/مدير effective-dated | hr_manager + approval        |
| `POST /employees/{id}/documents/upload`    | signed upload session          | employee/HR                  |
| `POST /employees/{id}/documents`           | اعتماد metadata/hash           | employee/HR                  |
| `GET /employees/{id}/salary-profiles`      | salary masked/مسموح            | payroll/finance/HR/owner     |
| `POST /employees/{id}/salary-profiles`     | نسخة راتب جديدة                | payroll/HR + approval        |
| `POST /employees/{id}/exit-cases`          | بدء الخروج                     | hr_manager                   |

### الحضور والوقت

| الطريقة والمسار                             | الغرض                    | الصلاحيات                   |
| ------------------------------------------- | ------------------------ | --------------------------- |
| `GET/POST /shifts`                          | تعريف وردية              | attendance_officer          |
| `GET/POST /schedules`                       | إسناد جدول               | attendance_officer          |
| `GET /attendance/days`                      | projection يومية         | employee/manager/attendance |
| `POST /attendance/imports`                  | إنشاء import job         | attendance_officer          |
| `GET /attendance/imports/{id}`              | الحالة وreject report    | attendance_officer          |
| `POST /attendance/punches`                  | punch موثق من ESS/device | employee/device             |
| `POST /attendance/corrections`              | طلب تصحيح                | employee/manager            |
| `POST /attendance/corrections/{id}/approve` | قرار تصحيح               | manager/attendance/payroll  |
| `POST /attendance/overtime-requests`        | طلب إضافي                | employee/manager            |
| `POST /attendance/periods/{id}/settle`      | قفل/تسوية الفترة         | attendance/payroll          |

### الإجازات والطلبات

| الطريقة والمسار                     | الغرض                   | الصلاحيات           |
| ----------------------------------- | ----------------------- | ------------------- |
| `GET /leave/balances`               | projection + as_of      | employee/HR         |
| `POST /leave/requests`              | إنشاء طلب               | employee            |
| `GET /leave/requests`               | قائمة حسب الحالة        | employee/manager/HR |
| `POST /leave/requests/{id}/approve` | approve/return/reject   | approver chain      |
| `POST /leave/requests/{id}/cancel`  | إلغاء مع reverse ledger | owner/HR وفق الحالة |
| `GET /inbox/approvals`              | مهام الموافقة           | approver            |
| `POST /requests/{id}/decisions`     | command عام للـworkflow | approver المقرر     |

### الرواتب والخصومات والسلف

| الطريقة والمسار                       | الغرض                     | الصلاحيات                |
| ------------------------------------- | ------------------------- | ------------------------ |
| `POST /payroll/runs`                  | إنشاء period/run          | payroll_officer          |
| `POST /payroll/runs/{id}/calculate`   | snapshot وحساب job        | payroll_officer          |
| `GET /payroll/runs/{id}`              | totals وحالة والاستثناءات | payroll/finance/HR       |
| `GET /payroll/runs/{id}/lines`        | تفاصيل الموظفين حسب scope | payroll/finance/owner    |
| `POST /payroll/runs/{id}/review`      | إقرار الاستثناءات         | payroll_officer          |
| `POST /payroll/runs/{id}/lock`        | قفل snapshot              | finance/org_owner chain  |
| `POST /payroll/runs/{id}/adjustments` | تصحيح بعد القفل           | payroll + reason         |
| `GET /employees/{id}/payslips`        | قسائم مقنعة/مسموحة        | employee/HR/payroll      |
| `POST /salary-advances`               | طلب سلفة                  | employee                 |
| `POST /salary-advances/{id}/approve`  | اعتماد حسب القيمة         | manager/finance          |
| `POST /salary-advances/{id}/disburse` | صرف وإنشاء ledger         | finance                  |
| `GET /deductions`                     | سجل الخصومات ومصدرها      | employee/finance/payroll |

### الدفع والمطابقة والمالية

| الطريقة والمسار                            | الغرض                  | الصلاحيات          |
| ------------------------------------------ | ---------------------- | ------------------ |
| `POST /payment-batches`                    | تجهيز دفعة من run مقفل | finance            |
| `POST /payment-batches/{id}/submit`        | maker/checker/provider | finance + approval |
| `POST /payment-batches/{id}/confirm`       | تأكيد حالة مزود موثقة  | finance            |
| `GET /payment-batches/{id}/reconciliation` | الاستثناءات والمطابقة  | finance/auditor    |
| `POST /reconciliation/items/{id}/resolve`  | معالجة استثناء         | finance + reason   |
| `POST /expense-reports`                    | إنشاء تقرير مصروفات    | employee           |
| `POST /expense-reports/{id}/submit`        | إرسال للموافقة         | employee           |
| `POST /early-payout-requests`              | صرف مبكر مستقل         | employee/finance   |
| `GET /journals` و`GET /journals/{id}`      | دفتر متوازن            | finance/auditor    |

### التوظيف والأداء والعهد

| الطريقة والمسار                                        | الغرض                  | الصلاحيات              |
| ------------------------------------------------------ | ---------------------- | ---------------------- |
| `GET/POST /job-openings`                               | الشواغر                | recruiter/HR           |
| `POST /candidates`                                     | مرشح مع consent/dedupe | recruiter              |
| `POST /candidates/{id}/advance`                        | نقل مرحلة              | recruiter              |
| `POST /job-offers` و`POST /job-offers/{id}/accept`     | عرض versioned          | HR/candidate           |
| `POST /performance/cycles`                             | فتح دورة               | performance_lead       |
| `POST /performance/reviews/{id}/submit`                | self/manager review    | participant            |
| `POST /performance/cycles/{id}/lock`                   | إقفال الدورة           | performance_lead       |
| `POST /assets/{id}/assign` و`POST /assets/{id}/return` | عهدة وتسليم            | asset_manager/employee |

### التشغيل والتكامل والتقارير والدعم

| الطريقة والمسار                                       | الغرض                      | الصلاحيات         |
| ----------------------------------------------------- | -------------------------- | ----------------- |
| `GET /notifications` و`POST /notifications/{id}/read` | inbox                      | authenticated     |
| `GET /audit-events`                                   | تدقيق وفق scope            | auditor/security  |
| `POST /integrations/connections`                      | إنشاء اتصال مشفر           | org_admin         |
| `POST /integrations/{id}/sync`                        | تشغيل sync job             | org_admin         |
| `POST /reports/runs`                                  | تقرير async بفلتر snapshot | حسب report scope  |
| `GET /jobs/{id}`                                      | تقدم ومحاولات وDLQ         | owner/support     |
| `POST /support/tickets`                               | فتح تذكرة                  | authenticated     |
| `POST /support/tickets/{id}/break-glass`              | طلب وصول طارئ              | security + reason |

## 6. الأوامر ومسارات الحالة

الأمر يعيد `202 Accepted` إذا بدأ job، أو `200` إذا اكتمل transaction سريعًا. payload command يتضمن `reason` للأفعال الحساسة و`expected_state` اختياريًا. مثال قفل مسيرة:

```http
POST /api/v1/payroll/runs/8e.../lock
Authorization: Bearer …
X-Tenant-Id: 9a...
Idempotency-Key: lock:8e:v3
If-Match: W/"3"
Content-Type: application/json

{"reason":"تمت مراجعة استثناءات الحضور واعتماد الإجمالي"}
```

الرد يوضح `status=locked`, `version=4`, `job_id` إن كان غير متزامن، و`audit_event_id`. لا يرسل endpoint واحدًا أمرًا عامًا باسم `updateStatus` يمكنه القفز من draft إلى paid؛ كل انتقال له command وguard واضح.

## 7. الأحداث والـwebhooks

الأحداث الداخلية versioned وبـenvelope موحد:

```json
{
  "event_id": "evt_...",
  "event_type": "payroll.run.locked",
  "schema_version": "1.0",
  "tenant_id": "uuid",
  "aggregate": { "type": "payroll_run", "id": "uuid", "version": 4 },
  "occurred_at": "2026-09-08T12:00:00Z",
  "actor": { "type": "user", "id": "uuid" },
  "data": { "period": "2026-08", "totals_hash": "sha256:..." }
}
```

- outbox يكتب داخل transaction؛ publisher يعيد المحاولة وDLQ.
- consumer يضع `event_id` في inbox قبل الأثر الخارجي؛ إعادة الحدث لا تضاعف payroll/payment/notification.
- webhook subscription تحدد event allowlist وtarget وsecret hash وretry policy؛ payload لا يتضمن salary raw.
- توقيع HMAC على `timestamp + body`، ورفض timestamp خارج نافذة replay.
- callback provider يتحول إلى event بعد التحقق؛ لا ينفذ SQL مباشرًا من body.

## 8. حدود المعدل والحمولة

| الفئة            | limit مبدئي               | ملاحظات                        |
| ---------------- | ------------------------- | ------------------------------ |
| browser reads    | 120 طلب/دقيقة/مستخدم      | burst 30؛ headers توضح المتبقي |
| browser commands | 30/دقيقة/مستخدم           | idempotency إلزامي             |
| device punches   | 600/دقيقة/جهاز            | batch حتى 100 مع source key    |
| exports          | 5/ساعة/مستخدم             | async وquota حسب الخطة         |
| webhooks         | 300/دقيقة/tenant/provider | backoff وDLQ                   |
| platform admin   | 60/دقيقة/actor            | audit لكل query حساس           |

حد payload JSON 1MB، ملف upload يمر signed URL وحد حجم الخطة وvirus scan. 413 للحجم، 429 مع `Retry-After`، ولا نرفع limit من المتصفح.

## 9. التوافق مع server functions الحالية

الكود الحالي يستخدم `createServerFn` في ملفات payroll وattendance وleave وpayments وapprovals وloans وsalary وsettlement وcompany وreports. مرحلة التوافق تبني adapters بنفس validation ثم تنقل الشاشة endpoint-by-endpoint:

| server function الحالية            | العقد المستهدف                                        |
| ---------------------------------- | ----------------------------------------------------- |
| `runPayrollServer`                 | `POST /payroll/runs/{id}/calculate`                   |
| `updatePayrollRunStatusServer`     | commands منفصلة: review/lock/confirm                  |
| `recordPunchServer`                | `POST /attendance/punches`                            |
| `processAttendanceServer`          | `POST /attendance/imports` أو `/periods/{id}/process` |
| `submitAttendanceCorrectionServer` | `POST /attendance/corrections`                        |
| `actOnRequestServer`               | `POST /requests/{id}/decisions`                       |
| `requestSalaryAdvanceServer`       | `POST /salary-advances`                               |
| `disburseApprovedLoansServer`      | `POST /salary-advances/{id}/disburse`                 |
| `prepareRunPaymentsServer`         | `POST /payment-batches`                               |
| `disburseRunPaymentsServer`        | `POST /payment-batches/{id}/submit`                   |
| `createSettlementServer`           | `POST /employees/{id}/exit-cases`                     |
| `updateSettlementStatusServer`     | commands approve/sign/pay/close                       |
| `getMonthlyReportServer`           | `POST /reports/runs`                                  |

لا يغير adapter semantics أو يتجاوز Supabase RLS. يضاف contract test يثبت أن adapter والـREST يعيدان نفس state/error code خلال فترة النقل.

## 10. المراقبة والتوثيق

كل request يسجل method/path template/status/latency/request_id/tenant hash/user hash، مع حذف authorization وPII. المقاييس: p50/p95 latency، 4xx/5xx، conflict، rate-limit، job queue age، webhook delivery، وbusiness command success. OpenAPI يولد client types وPostman/SDK بعد review؛ changelog يسجل deprecation وmigration guide.

## 11. معايير قبول API

1. **API-A01:** token صحيح دون membership يعيد 403 موحدًا ولا يكشف tenant.
2. **API-A02:** تغيير `X-Tenant-Id` إلى tenant غير مسموح لا يغير context.
3. **API-A03:** command بلا Idempotency-Key يعيد 428/422 حسب contract ولا ينشئ أثرًا.
4. **API-A04:** إعادة command بنفس المفتاح تعيد resource/event واحدًا.
5. **API-A05:** If-Match قديم يعيد 409 مع version الحالي دون كتابة فوقه.
6. **API-A06:** filter أو sort غير موجود في allowlist يعيد 422 ولا يمرر SQL.
7. **API-A07:** cursor يعيد صفحات مستقرة ولا يكرر row عند تحديث غير متعارض.
8. **API-A08:** employee يرى حقوله المسموح بها فقط، وsalary masked خارج scope.
9. **API-A09:** approve/reject لا يقفز state ولا يقبل self-approval.
10. **API-A10:** payroll calculate يرجع 202 وjob status عند الحجم الكبير.
11. **API-A11:** timeout provider لا يعيد payment submit قبل query حالة المزود.
12. **API-A12:** webhook signature وtimestamp غير صحيحين يذهبان quarantine.
13. **API-A13:** event consumer يعالج event_id مرة واحدة حتى مع retry.
14. **API-A14:** error response يحتوي code/message_key/request_id ولا يحتوي stack trace.
15. **API-A15:** 429 يرسل Retry-After ولا يتجاوز limit عبر headers مزورة.
16. **API-A16:** export ينشئ job وsigned URL منتهيًا ولا يعيد ملفًا حساسًا في GET.
17. **API-A17:** adapter server function وREST يتطابقان في state وerror codes.
18. **API-A18:** device punch يقبل source key مرة واحدة ويطبق device scope.
19. **API-A19:** break-glass command يسجل reason/expiry وsecurity event.
20. **API-A20:** OpenAPI schema يطابق manifest ولا توجد endpoint غير موثقة في production.

## 12. تسليم التنفيذ

يبدأ الفريق بـAPI envelope وerror catalog وtenant middleware ثم يضيف resources القراءة، وبعدها commands للحضور والإجازة والرواتب والدفع. تُبنى schemas بـZod أو ما يعادلها مرة واحدة وتستخدم في REST وserver functions. يثبت QA معايير API-A01–20 وcontract tests، ويُشغّل OpenAPI lint في CI. تبقى GraphQL وpublic partner API قرارًا لاحقًا؛ REST كافٍ لمسارات HR الحالية وأكثر قابلية للتدقيق.
