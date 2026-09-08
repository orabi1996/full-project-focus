# PART 14 — DevOps Architecture

**الحالة:** تصميم تشغيل وتسليم مبدئي قابل للتنفيذ؛ لا ينشئ بيئات أو أسرار أو deployments تلقائيًا من هذا الملف.  
**تاريخ الإصدار:** 8 سبتمبر 2026  
**المرجع:** PART 10، PART 12، PART 13، `AGENTS.md`، `.github/workflows/quality.yml`، `supabase/config.toml`، و`README.md`.

المشروع يستخدم GitHub Actions للجودة، Vite/TanStack Start للواجهة والخادم، Supabase للبيانات، وLovable للمزامنة/المعاينة. DevOps المطلوب يحافظ على تاريخ Git المنشور ويجعل كل release قابلة للتدقيق والتراجع.

## 1. استراتيجية Git والتغيير

- `main`: مرآة الإصدار المنشور أو المتصل بـLovable؛ protected، لا push مباشر، وrequired checks.
- `develop` أو بيئة تكامل اختيارية فقط إذا زادت الحاجة؛ لا نخلق فروعًا دائمة بلا ownership.
- `feature/*`, `fix/*`, `docs/*`: فرع قصير بــPR واحد وcommit messages واضحة. docs/manifest دفعات مستقلة كما في PR #4.
- PR template يطلب المشكلة، النطاق، migrations، الأمن، الاختبارات، rollback، screenshots للـUI، وقرار open/assumption.
- CODEOWNERS: security لـauth/RLS، finance لـpayroll/payment/ledger، product لـdocs/contracts، platform لـworkflow/infra.
- يمنع force push وrebase/amend/squash على commits المنشورة؛ التعديل اللاحق commit جديد. هذا يحمي مزامنة Lovable وسجل المراجعة.
- tag على release المرشح ثم annotate بالـcommit SHA وmigration version وartifact digest.

## 2. خط CI الحالي وخط الهدف

الحالي في `.github/workflows/quality.yml` يشغل على push/PR إلى `main`: npm ci، typecheck، lint، test:coverage، build، Playwright Chromium، ويحفظ التقارير 14 يومًا. هذا baseline جيد ويحتاج توسيعًا تدريجيًا:

1. **preflight:** secret scan، formatting، lockfile consistency، changed-files scope.
2. **static:** TypeScript، ESLint، SAST، dependency/SCA، license policy، container/IaC scan، SBOM.
3. **unit/contract:** Vitest coverage، JSON manifest shape، migration lint، PGlite/RLS contract.
4. **build:** Vite/TanStack production build، bundle budget، artifact checksum.
5. **integration:** Supabase ephemeral/staging، migration from zero، seed synthetic، API/RLS tests.
6. **browser:** Playwright desktop + mobile، a11y/visual على schedule أو RC.
7. **security/performance:** fuzz/replay/upload، k6/Lighthouse، فقط على staging لا production.
8. **publish:** upload immutable artifact، sign/provenance، ثم deployment job يحتاج environment approval.
9. **post-deploy:** health/readiness، smoke login/dashboard/read-only، metrics gate، auto rollback حسب policy.

لا نضع service-role أو provider secrets في PR jobs غير الموثوقة. jobs من fork تعمل بدون secrets وتغلق التكاملات الخارجية.

## 3. البيئات

| البيئة       | الغرض               | البيانات                       | الأسرار/الوصول               | التغيير                  |
| ------------ | ------------------- | ------------------------------ | ---------------------------- | ------------------------ |
| local        | تطوير سريع          | seed محلي أو PGlite            | `.env` غير committed         | أي developer             |
| preview      | مراجعة PR/واجهة     | demo/synthetic، no payroll raw | publishable key فقط          | تلقائي بعد build         |
| ephemeral-db | migrations/contract | schema + fixtures قصيرة العمر  | connection secret job-scoped | CI                       |
| staging      | تكامل كامل          | masked seed، provider sandbox  | secrets environment          | deploy بعد CI            |
| production   | عملاء مدفوعون       | customer data                  | vault/KMS، least privilege   | approval + change window |
| dr/restore   | اختبار الاستعادة    | encrypted backup copy          | isolated credentials         | runbook ربع سنوي         |

كل environment يملك Supabase project/URL وstorage bucket وlogging sink منفصلة. `VITE_ENABLE_DEMO_MODE` لا يفتح demo في production حتى لو تسربت القيمة؛ production guard يبقى server/client.

## 4. Secrets وconfiguration

- مصدر الأسرار: GitHub Environments أو cloud secret manager/KMS؛ `.env.example` أسماء فقط، و`.env` محلي ignored.
- public publishable key يمكن في bundle وفق Supabase model؛ `SUPABASE_SERVICE_ROLE_KEY` وprovider credentials server-only.
- rotation: publishable/provider/webhook keys بجدول expiry؛ service-role وKMS حسب policy، مع overlapping keys وrevocation.
- config schema يتحقق في startup: URL، key type، environment، demo flag، WPS bank code؛ fail closed عند missing/invalid.
- logs وbuild artifacts تفحص patterns للـPAT، service role، IBAN، JWT، API secret؛ لا نطبع env كاملة.
- deployment identity OIDC قصيرة العمر بدل cloud long-lived key عند توفره؛ permissions read-only للـCI وللتطبيق حسب job.

## 5. Supabase والمigrations

- migrations مرتبة timestamp، forward-only، idempotent حيث يمكن؛ لا تعديل ملف مطبق، بل migration تصحيحية.
- PR migration يشغل preflight: orphan/duplicate/lock duration/RLS policy inventory، ثم apply from zero وupgrade from latest.
- staging يطبق migrations قبل artifact code إذا كان backward-compatible؛ breaking change يمر expand → migrate → contract.
- database backup/PITR قبل migration المالية؛ كل migration له recovery note وowner.
- service role محصور في server route/RPC، وPostgREST grants وRLS contract جزء من CI.
- seed production ممنوع؛ synthetic seed يحمل tenant IDs غير حقيقية وlocale/currency variants.

## 6. النشر والتراجع

**Release flow:** PR → checks → merge main → build artifact digest → deploy staging → smoke/approval → production canary → health/SLO → full rollout.

- frontend static assets versioned خلف CDN؛ API/server functions لها compatibility window.
- database expand migration تسبق code الذي يقرأ العمود؛ contract migration تؤجل إلى صفر قراءة من old path.
- canary لtenant داخلي/monitoring account، ثم 10%/50%/100% حسب error budget؛ payment غير الحقيقي في sandbox أثناء canary.
- rollback code إلى artifact سابق إذا health/error gate فشل؛ لا rollback أعمى لــDB migration. استخدم forward fix أو compensating migration.
- feature flags توقف payroll/payment/integration الجديدة دون حذف بيانات؛ flag changes audit وexpiry.
- runbook يحدد owner، command، metric، آخر artifact جيد، وأمر إيقاف الدفع/queue.

## 7. Observability

- **Logs:** structured JSON، request/trace ID، environment، service، tenant hash، actor hash، event/status/latency؛ redaction للـPII/secrets.
- **Metrics:** availability، p50/p95/p99، 4xx/5xx، DB connections/locks، RLS denies، queue age/retry/DLQ، webhook/provider latency، payroll close/payment reconciliation، signup/activation.
- **Traces:** browser → server function/API → DB/RPC → queue/provider، مع sampling لا يسجل payload حساس.
- **Errors:** error tracker مع release SHA/source maps private، tenant/user hash، route، breadcrumbs؛ source maps لا تُنشر public.
- **Alerts:** P0 data/payment، P1 SLO/queue/DB، P2 feature؛ كل alert له runbook وon-call وdedup.
- dashboards منفصلة platform وtenant؛ لا تعرض platform dashboard salary raw أو tenant list لعضو عادي.

## 8. النسخ الاحتياطي والتعافي

- PostgreSQL PITR + snapshot يومي مشفر، object storage versioning، وbackup لــconfig/manifest غير السري.
- RPO مبدئي 15 دقيقة، RTO 4 ساعات للـproduction standard؛ Enterprise قد يطلب أقل بعقد منفصل.
- restore drill ربع سنوي: نسخة معزولة، apply migrations، تحقق counts/checksums/tenant RLS، replay outbox، ثم تقرير gaps.
- disaster modes: read-only ESS/status، pause payment/provider، queue drain، failover، ثم resume commands idempotent.
- legal hold وretention يوقفان purge؛ backup expiry لا يحذف نسخة لازمة لتحقيق عقد أو قانون.

## 9. إدارة التكلفة والسعة

- budgets لكل environment: DB compute/storage، CDN، logs، CI minutes، provider calls؛ تنبيه قبل quota.
- autoscaling للـweb/worker بعد قياس، connection pool وqueue concurrency محددان لكل خطة.
- preview environments تنتهي تلقائيًا بعد PR merge، وartifacts/Playwright reports 14 يومًا افتراضيًا.
- لا نستخدم microservices في البداية؛ domain modules داخل خدمة typed، ويفصل worker للـpayroll/report/integration عندما يصبح queue bottleneck.

## 10. Runbooks الأساسية

| runbook           | trigger                       | خطوات مختصرة                                                       | نتيجة                       |
| ----------------- | ----------------------------- | ------------------------------------------------------------------ | --------------------------- |
| deploy-failure    | health/error gate             | freeze rollout، canary off، rollback artifact، capture SHA         | service healthy أو incident |
| migration-failure | SQL error/lock                | stop job، preserve logs، inspect transaction، forward recovery     | schema known state          |
| payment-incident  | provider mismatch/double risk | pause batch، query provider، reconcile، notify finance             | no duplicate payout         |
| queue-dlq         | retry limit                   | classify code، fix/replay with reason، monitor age                 | DLQ cleared/audited         |
| key-compromise    | secret alert                  | revoke/rotate، invalidate sessions، check audit، notify            | contained exposure          |
| restore-drill     | backup test                   | restore isolated، migrate، verify RLS/ledger/outbox                | RPO/RTO report              |
| tenant-isolation  | RLS alert                     | disable affected endpoint، inspect policy/query، cross-tenant test | no leakage                  |

## 11. معايير قبول DevOps

1. **OPS-A01:** PR لا يمر دون required checks وreview من CODEOWNER عند الملفات الحساسة.
2. **OPS-A02:** force push/rebase/amend لا يستخدم على branch/commits المنشورة.
3. **OPS-A03:** workflow يشغل typecheck/lint/coverage/build وPlaywright كما هو موثق.
4. **OPS-A04:** secret/SCA/SAST scan يفشل job عند secret أو CVE فوق SLA.
5. **OPS-A05:** build artifact له SHA/digest وrelease metadata قابل للمطابقة.
6. **OPS-A06:** preview/staging لا تستخدم بيانات أو secrets production.
7. **OPS-A07:** migration من الصفر ومن latest تمر preflight وpostflight وRLS tests.
8. **OPS-A08:** production deployment يحتاج environment approval وcanary health gate.
9. **OPS-A09:** rollback code لا ينفذ DB destructive rollback؛ يستخدم forward fix/compensation.
10. **OPS-A10:** feature flags الحساسة audit ولها expiry/owner.
11. **OPS-A11:** logs structured ومقنعة ولا تحتوي token/PII/payroll raw.
12. **OPS-A12:** metrics وtraces تربط request/job/provider بـcorrelation id دون payload حساس.
13. **OPS-A13:** alerts P0/P1 لها on-call وrunbook واختبار تجريبي.
14. **OPS-A14:** backup يومي/PITR وobject versioning يعملان ومراقبان.
15. **OPS-A15:** restore drill يثبت RPO/RTO وtenant/RLS/ledger consistency.
16. **OPS-A16:** queue retry/DLQ وmanual replay يسجلان السبب والمالك.
17. **OPS-A17:** preview/artifact retention يطبق quota ولا يترك أسرارًا منتهية.
18. **OPS-A18:** deploy توقف payment/integration عند provider incident دون حذف audit.
19. **OPS-A19:** connection pool/worker concurrency/backpressure تمنع DoS أثناء report/punch burst.
20. **OPS-A20:** كل release مربوط بـcommit SHA وmigration versions وQA/security evidence.

## 12. تسليم التنفيذ

يبدأ الفريق بتحسين `quality.yml` وإضافة secret/SCA/manifest checks، ثم يعرّف GitHub Environments وstaging Supabase وartifact registry. بعد ذلك تُبنى migration rehearsal وsmoke/observability وrunbooks. لا يتم إنشاء cloud resources أو نشر production من هذه المواصفات وحدها؛ يحتاج ذلك حسابات وبنية أسرار وموافقات تشغيلية موثقة.
