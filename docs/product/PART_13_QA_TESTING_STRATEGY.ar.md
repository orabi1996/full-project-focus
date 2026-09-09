# PART 13 — QA & Testing Strategy

**الحالة:** خطة اختبار ومصفوفة تغطية قابلة للتنفيذ؛ لا تدّعي أن كل الحالات منفذة الآن.  
**تاريخ الإصدار:** 8 سبتمبر 2026  
**المرجع:** PART 7، PART 9، PART 10، PART 11، PART 12، و`vitest.config.ts` و`playwright.config.ts`.

المشروع يملك Vitest لاختبارات منطق الصلاحيات والحسابات والمعاملات، وPlaywright لـChromium وmobile-chrome في وضع demo، واختبارات contract للمigrations والتنقل والأمان. هذه الدفعة تنظّمها حول مخاطر HR الفعلية: isolation، الخصومات والتأخير، القفل، التسوية، الدفع، واللغة العربية.

## 1. مستويات الاختبار

| المستوى       | ما يثبت                                               | الأداة/البيئة                         | gate                 |
| ------------- | ----------------------------------------------------- | ------------------------------------- | -------------------- |
| Unit          | pure calculators، parsers، permissions، state guards  | Vitest/Node                           | كل PR                |
| Component     | states وRTL وa11y للمكونات                            | Vitest + Testing Library عند اعتمادها | كل UI PR             |
| Contract      | schema، migration text، RLS، API envelope، tokens     | Vitest/Node + SQL fixture             | كل PR يمس contract   |
| Integration   | repository/server function مع Supabase test أو PGlite | Vitest + ephemeral DB                 | كل domain PR         |
| API           | auth/RLS، pagination، idempotency، errors، webhooks   | API harness/Newman أو typed client    | staging وPR حساس     |
| E2E           | user journey عبر المتصفح                              | Playwright Chromium + mobile          | release candidate    |
| Visual        | اختلاف layout/light-dark/RTL                          | Playwright screenshots                | release candidate    |
| Accessibility | keyboard، screen reader semantics، contrast           | axe + manual keyboard                 | كل شاشة جديدة        |
| Performance   | p95، query، bundle، queue                             | Lighthouse/k6/EXPLAIN                 | beta وscale gate     |
| Security      | SAST/SCA، fuzz، upload، replay، restore               | CI scanners + staging                 | pilot وrelease       |
| Chaos/DR      | provider timeout، job replay، restore                 | staging isolated                      | production readiness |

## 2. استراتيجية البيانات والبيئات

- **Unit fixtures:** قيم ثابتة بالعربية والإنجليزية، عملات وtimezone مختلفة، أرقام سالبة/صفرية، وحالات rounding.
- **Integration DB:** schema snapshot أو PGlite fixture قريب من Supabase؛ لا تُستخدم بيانات عميل حقيقية.
- **E2E demo:** `VITE_ENABLE_DEMO_MODE=true` فقط، مع dataset معروف وactor personas للموظف والمدير والـHR والمالية.
- **Staging:** Supabase project منفصل، secrets منفصلة، provider sandbox، private storage وAV test files، وseed قابل للإعادة.
- **Production smoke:** حسابات مراقبة بلا salary raw، endpoint health، login/MFA، read-only dashboard؛ لا ننفذ payment حقيقيًا.
- كل dataset يحمل `seed_version` وtenant ids معزولة؛ cleanup لا يحذف audit evidence المراد اختباره إلا داخل مشروع ephemeral.

## 3. أهداف التغطية والبوابات

- calculators وstate guards وRBAC: 95% statements، 90% branches.
- repositories وserver functions الحساسة (payroll/leave/attendance/payment/settlement): 85% statements، 75% branches كحد أدنى، مع حالات failure.
- UI components المشتركة: كل variant/state أساسي مرة واحدة؛ لا يكفي snapshot واحد.
- API contracts: 100% endpoints في manifest لها happy + auth/validation/error + idempotency حيث يلزم.
- E2E: كل journey JRN-01–12 وworkflow WF-01–16 له مسار smoke؛ payroll/payment/settlement له failure path أيضًا.
- Security: SEC-A01–20 كلها release gates؛ لا exceptions بلا owner وexpiry.
- a11y: لا critical/serious axe violations، وkeyboard completion لمسارات ESS وapproval وpayroll review.
- الأداء المبدئي: dashboard p95 ≤2s بعد warm cache، list API p95 ≤500ms (page 50)، command سريع ≤800ms، job queue age حسب SLA.

الـthresholds الموجودة في `vitest.config.ts` تغطي ملفات حرجة محددة وليست نسبة المشروع كله؛ نوسع include تدريجيًا ولا نخفض threshold لتمرير build.

## 4. Test Matrix حسب المجال

| المجال               | Unit/contract                                | Integration/API                   | E2E/visual                       | حالات الخطر                                 |
| -------------------- | -------------------------------------------- | --------------------------------- | -------------------------------- | ------------------------------------------- |
| Auth/RBAC            | role catalog، claim parsing، permission deny | membership، tenant switch، RLS    | login، MFA، unauthorized route   | token expiry، role escalation، cross-tenant |
| Organization         | cycle guard، effective dates                 | hierarchy FKs، unique tenant keys | add department/location/position | cyclic parent، archived manager             |
| Employees/Documents  | validation، masking، file hash               | upload policy، document scope     | onboarding/profile/doc upload    | restricted reveal، malware، expiry          |
| Attendance           | rounding، grace، late/early formulas         | import dedup، day recompute       | punch/correction/overtime        | duplicate punch، timezone، locked period    |
| Leave                | accrual/balance math                         | reservation/settle/cancel RPC     | request/approve/cancel           | overlap، negative balance، missing approver |
| Payroll              | salary/deduction/tax math                    | snapshot/lock/adjustment          | calculate/review/lock/payslip    | exception row، concurrent lock              |
| Loans/Advances       | installment/remaining balance                | disbursement/deduction ledger     | request/approve/disburse         | failed payout، collision                    |
| Payments             | totals/rounding                              | provider sandbox/reconcile        | submit/confirm/exception         | callback replay، amount mismatch            |
| Settlement           | EOSB/leave/loan formulas                     | version/sign/hold                 | exit/statement/acknowledge       | post-sign amendment                         |
| Expenses             | category/duplicate/hash                      | approval/reimbursement            | claim/early payout               | formula injection، duplicate receipt        |
| ATS/Performance      | stage/score rules                            | offer-to-employee                 | candidate/review/lock            | consent، feedback scope                     |
| Assets               | custody state                                | assignment/return                 | accept/dispute/return            | exit with unreturned asset                  |
| Integrations/Reports | cursor/filter contracts                      | sync/webhook/export jobs          | schedule/report download         | timeout، scope، expired URL                 |
| Support/Audit        | redaction/severity                           | break-glass/read audit            | ticket/escalation                | insider access                              |

## 5. Unit وproperty tests

- Payroll: gross = earnings، deductions لا تتجاوز policy cap إلا override، net = gross − deductions، rounding deterministic، zero employee لا يكسر run.
- Attendance: crossing midnight، daylight change، missing out punch، grace boundary ±1 minute، duplicate source key، locale date.
- Leave: reservation concurrency، partial day، holiday/weekend، cancel after approval، carryover expiry.
- Loans: installment sum، final residual، early settlement، salary cap، negative/zero amount.
- Settlement: service years/months، EOSB brackets حسب policy version، leave encashment، open advance، amendment immutability.
- RBAC: every manage role can view، auditor never mutate، scope self/team/all، no self approval.
- Parsers/export: CSV quoting، Arabic UTF-8/BOM، formula prefixes، invalid MIME، malformed JSON.
- Property/fuzz: random dates/amounts/status transitions لا تنتج NaN أو negative ledger أو illegal state.

## 6. Integration وAPI tests

كل domain adapter يختبر transaction boundary وRLS وoutbox:

1. إنشاء request ثم approval decision يكتب timeline وnotification مرة واحدة.
2. payroll calculate يثبت input snapshot؛ إعادة job بنفس key لا تضاعف lines.
3. lock يرفض أي update مباشر بعد القفل، وadjustment يكتب version جديد.
4. provider timeout يستعلم الحالة قبل retry؛ callback المكرر يطابق item نفسه.
5. leave reserve تحت concurrent requests لا يسمح balance سالبًا.
6. report export يحفظ filter/as_of ويعطي signed URL منتهيًا.
7. `tenant_id` من URL/body لا يتغلب على session context؛ 404/403 لا يكشف restricted record.
8. كل endpoint في `API_CONTRACT_MANIFEST.draft.json` يمر schema success + validation + auth + rate limit.

## 7. E2E وvisual

- smoke: login، tenant context، dashboard، employee self-service، leave request، attendance punch، approval inbox.
- critical financial: salary profile version، payroll calculate/review/lock، payslip masking، advance، payment sandbox/reconcile، settlement sign.
- administrative: org hierarchy، shift schedule، documents، expense، ATS، performance، assets، reports، audit.
- desktop Chromium وmobile Chrome؛ timezone `Asia/Riyadh` وlocale `ar-SA`، مع suite English LTR في nightly.
- screenshot baselines للـPage shell، table empty/loading/error، form validation، dialog، mobile drawer، dark theme، RTL icons. Visual diff لا يُقبل بــupdate blanket؛ كل baseline له reviewer.
- كل test يثبت no page errors، route، status، وnext action؛ لا يعتمد على sleep ثابت، بل network idle/role locator/job polling.

## 8. Accessibility وlocalization

- axe على كل route inventory subset؛ manual Tab/Shift+Tab، Enter/Space، Escape، focus return، keyboard table pagination.
- headings hierarchy، labels، `aria-invalid`/describedby، live region للتوست والـjob، table header scopes، chart table fallback.
- contrast AA، focus ring، touch target 44px، reduced motion، zoom 200% دون فقد action.
- Arabic RTL وEnglish LTR، نصوص أطول، الأرقام والتواريخ والعملة وtimezone، mixed Arabic/Latin IDs، search normalization.
- لا نعتبر ترجمة key موجودة كافية؛ اختبار missing key والـfallback جزء من CI.

## 9. Performance وload

- Lighthouse صفحات login/dashboard/employee/payroll، budget للـJS وfonts والصور، وقياس cold/warm.
- k6 أو equivalent: 1K مستخدم read mix، 100 concurrent payroll/report jobs، device punch burst، webhook burst.
- EXPLAIN للـtenant list وattendance period وpayroll lines وaudit، مع index/RLS overhead.
- queue tests: backpressure، retry/backoff، DLQ، long report لا يمنع punch أو approval.
- gates مبدئية: no error budget breach، p95 وفق القسم 3، DB CPU/locks/connection pool ضمن runbook، ولا memory leak في browser/mobile.

## 10. Security وfailure matrix

| السيناريو                 | النتيجة المتوقعة        | نوع الاختبار      |
| ------------------------- | ----------------------- | ----------------- |
| token منتهي/issuer خاطئ   | 401 موحد، لا query      | API/security      |
| tenant id غريب            | 403/404 بلا كشف         | RLS/API           |
| role من localStorage      | لا أثر server           | contract/E2E      |
| duplicate command/webhook | resource/event واحد     | integration       |
| provider timeout          | query ثم retry/DLQ      | integration/chaos |
| malformed upload          | reject/quarantine       | security          |
| SQL/filter injection      | 422، لا query غير مسموح | fuzz              |
| XSS/CSV formula           | escaped/CSP/export safe | security/E2E      |
| concurrent lock/reserve   | conflict، ledger سليم   | integration/load  |
| backup restore            | RPO/RTO وaudit متسقة    | DR                |

## 11. إدارة العيوب والـflakiness

- Severity P0: كشف أو صرف مزدوج أو فقد ledger؛ إيقاف release فورًا.
- P1: مسار مالي/اعتماد أساسي متعطل أو data corruption؛ إصلاح قبل release.
- P2: feature غير أساسي أو workaround واضح؛ backlog بموعد.
- P3: نص/visual منخفض الأثر؛ لا يحجب pilot إلا إذا a11y أو brand gate.
- كل bug يحوي tenant/role/locale/browser/build، خطوات، expected/actual، trace/screenshot، data sensitivity، وregression test.
- flaky test يُوسم ويملك owner؛ retry في CI لا يخفيه. بعد فشل متكرر يعزل من gate مع ticket وexpiry، ثم يعاد إلى gate.
- لا نستخدم test data حقيقية أو نشارك trace يحوي salary/document؛ artifacts تُقنع وتُحذف حسب retention.

## 12. CI/CD gates وExit Criteria

**Pull request:** format، typecheck، lint، unit/contract، security scan، changed-scope integration، docs/manifest shape.  
**Nightly:** full unit + coverage، E2E desktop/mobile، visual، a11y، dependency scan، k6 smoke.  
**Release candidate:** staging migration rehearsal، API contract، all critical journeys، restore drill، provider sandbox، sign-off من product/security/finance.

لا يخرج الإصدار من beta قبل: صفر P0/P1 مفتوح، SEC-A01–20 ناجحة أو exception معتمد، WF/DB/API critical paths خضراء، coverage gates محققة، a11y critical صفر، p95 ضمن الهدف، restore evidence، وrunbooks للدعم والتراجع.

## 13. معايير قبول QA

1. **QA-A01:** كل commit يمر format/typecheck/lint وunit tests قبل merge.
2. **QA-A02:** thresholds الحالية لا تنخفض وتظهر في artifact قابل للمراجعة.
3. **QA-A03:** كل endpoint في API manifest له contract success/error/auth test.
4. **QA-A04:** كل journey JRN-01–12 له E2E أو test gap موثق بمالك وموعد.
5. **QA-A05:** payroll/leave/attendance/payment/settlement لها happy وfailure وconcurrency cases.
6. **QA-A06:** migration/RLS tests تثبت DB-A01–20 على schema snapshot.
7. **QA-A07:** SEC-A01–20 لا توجد لها exceptions منتهية.
8. **QA-A08:** Playwright يمر Chromium desktop وmobile في locale ar-SA دون page errors.
9. **QA-A09:** RTL/LTR وdark/light وresponsive visual baselines محدثة بمراجعة.
10. **QA-A10:** axe لا يسجل critical/serious، وkeyboard يكمل ESS/approval.
11. **QA-A11:** CSV/PDF/XLSX exports لا تكشف restricted أو formula injection.
12. **QA-A12:** duplicate/idempotency tests لا تضاعف ledger/payment/notification.
13. **QA-A13:** load smoke يحقق p95/error budget والـqueue لا يتراكم فوق SLA.
14. **QA-A14:** provider outage/timeout يختبر retry وDLQ وmanual replay.
15. **QA-A15:** restore drill يحفظ RPO/RTO ويثبت audit وtenant isolation.
16. **QA-A16:** test artifacts والـlogs redacted ولا تحمل بيانات عميل حقيقية.
17. **QA-A17:** flaky test list لها owner/expiry ولا تختبئ خلف retries.
18. **QA-A18:** release checklist موقعة من product وsecurity وfinance للميزات الحساسة.
19. **QA-A19:** rollback/recovery command مجرب في staging ولا يحذف audit.
20. **QA-A20:** كل defect P0/P1 مغلق أو يمنع release وفق policy.

## 14. تسليم التنفيذ

يبدأ الفريق بتثبيت `test:unit`, `test:coverage`, و`test:e2e` الموجودة ثم يضيف fixtures للtenant/RLS وAPI harness وaxe/visual. تضاف suites domain-by-domain، مع جعل معايير DB/API/SEC/WF بوابات آلية. لا نكتب snapshot عشوائيًا لكل component؛ نختبر state وbusiness outcome، ونحفظ artifacts بحدود الخصوصية.
