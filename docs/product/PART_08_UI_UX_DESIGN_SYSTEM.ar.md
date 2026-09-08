# PART 8 — UI/UX DESIGN SYSTEM

**التاريخ:** 8 سبتمبر 2026. **الإصدار:** 0.1 — نظام تصميم مبدئي قابل للتحويل إلى tokens ومكونات.

**المرجع:** [PART 6 — Information Architecture](PART_06_INFORMATION_ARCHITECTURE.ar.md)، [PART 7 — Complete Screen Inventory](PART_07_COMPLETE_SCREEN_INVENTORY.ar.md)، [جرد الشاشات الآلي](SCREEN_INVENTORY.draft.json)، و[الـtokens الحالية](../../src/styles.css).

**الحالة:** مواصفات تصميم قابلة للتنفيذ والمراجعة. لا تستبدل CSS الحالي تلقائيًا ولا تثبت اعتمادًا نهائيًا للعلامة التجارية قبل موافقة C‑Smarx/Classera.

## 1. قرار النظام

نعتمد Material 3 كأساس سلوكي مع هوية Classera Pulse البصرية: Royal Blue للحركة والثقة، Electric Cyan للإشارة والطاقة، وDeep Navy للمساحات عالية التباين. نستخدم semantic tokens بدل إدخال hex داخل كل component.

الهدف هو واجهة مؤسسية هادئة وكثيفة بالقدر الذي يحتاجه HR، مع CTA واضح وإشارات حالة يمكن فهمها من اللون والنص والأيقونة معًا. لا نستخدم gradient أو glow في كل بطاقة؛ نخصصهما للهوية، الإجراء الأساسي، وحالات الانتقال.

الخط الحالي يعرّف Cairo مع Plus Jakarta Sans وRoboto، ويستخدم Material Symbols وLucide/Radix. نبقي هذا الاستثمار، ونضيف contract يمنع mixing غير المقصود أو تحميل font إضافي داخل feature.

## 2. أصول خط الأساس والفجوات

| الأصل الحالي                                                             | الدليل                                                                | قرار Design System                                                                      |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Light/Dark CSS variables وOKLCH                                          | `src/styles.css`                                                      | نعرض semantic names وhex reference في token catalog؛ القيمة التشغيلية تبقى CSS variable |
| Classera Pulse blue/cyan gradients وbutton utilities                     | `src/styles.css`                                                      | نثبت gradient roles محددة ونمنع استخدامها للنص أو status وحده                           |
| Material 3 provider وradius utilities                                    | `src/lib/theme/MaterialDesignProvider.tsx`                            | نربط provider بـtheme version وcomponent contracts                                      |
| Cairo وPlus Jakarta Sans وRoboto وJetBrains Mono                         | `src/styles.css`                                                      | Cairo للعربية، Plus Jakarta للإنجليزية عند الحاجة، Mono للأرقام/IDs فقط                 |
| مكونات Radix/shadcn: dialog, drawer, table, form, tabs, toast, skeleton… | `src/components/ui`                                                   | نضيف wrappers ذات labels وRTL وstates، ولا نكرر primitive داخل كل شاشة                  |
| logo وmark لـClassera Pulse                                              | `src/components/common/AppLogo.tsx`, `public/classera-pulse-logo.png` | استخدام asset المعتمد عبر AppLogo؛ الاسم التجاري النهائي يظل قرارًا مفتوحًا             |

## 3. مبادئ الواجهة

1. **الثقة قبل الزخرفة:** الأرقام المالية، صاحب القرار، وقت التحديث، ومصدر البيانات يظهرون قبل الرسوم التجميلية.
2. **إجراء واحد واضح:** كل شاشة لها primary action واحد، والأفعال الحساسة لها confirmation وreason.
3. **الكثافة المتدرجة:** KPI مختصر في الأعلى، detail عند الطلب، وprogress للـjobs بدل تحميل كل شيء.
4. **حالة مفهومة:** status = لون + label + icon + next action؛ لا نعتمد على اللون وحده.
5. **أمان مرئي بلا كشف:** نوضح أن حقلًا مقنع أو خارج النطاق دون تأكيد وجود سجل حساس.
6. **العربية أصلية:** RTL، ترتيب القراءة، الصياغة، التواريخ، وأحجام Cairo مصممة للعربي، وEnglish variant يُراجع منفصلًا.
7. **الأداء جزء من التصميم:** skeleton يحاكي layout، lazy charts، pagination، وjob status بدل spinner طويل.
8. **التوافق والاسترجاع:** dirty state، retry، undo حيث آمن، وdraft مؤرخ لا يعتمد على localStorage للبيانات المقيدة.

## 4. Color tokens

القيم التالية مرجع التصميم. التطبيق يستخدم CSS variables أو theme provider؛ لا تُكتب الألوان مباشرة في component. يراجع QA contrast على النصوص الفعلية في كل theme.

| Token            | Light              | Dark               | الاستخدام                                             |
| ---------------- | ------------------ | ------------------ | ----------------------------------------------------- |
| `brand.royal`    | `#004BCE`          | `#38BDF8`          | primary action، active link، focus ring في سياق مناسب |
| `brand.cyan`     | `#00B5FF`          | `#00B5FF`          | accent، progress، pulse mark، selected tint           |
| `brand.navy`     | `#05112A`          | `#E2E2E9`          | نص عميق أو primary foreground على cyan                |
| `surface.canvas` | `#F7F9FC`          | `#111318`          | خلفية التطبيق                                         |
| `surface.card`   | `#FFFFFF`          | `#1D2026`          | بطاقة وpopover وmodal                                 |
| `surface.muted`  | `#F0F4F9`          | `#383B43`          | input، table header، skeleton                         |
| `text.primary`   | `#1A1C1E`          | `#E2E2E9`          | العناوين والنص الأساسي                                |
| `text.secondary` | `#444746`          | `#B7BBC3`          | وصف وmetadata                                         |
| `border.default` | `#E0E2EC`          | `#484C55`          | حدود غير تفاعلية                                      |
| `border.focus`   | `#004BCE`          | `#38BDF8`          | focus-visible ring بسمك 3px                           |
| `status.success` | `#087F5B`          | `#65D6A5`          | approved، paid، healthy                               |
| `status.warning` | `#9A5B00`          | `#FFBD5A`          | pending، expiring، stale                              |
| `status.danger`  | `#BA1A1A`          | `#FFB4AB`          | rejected، failed، blocked                             |
| `status.info`    | `#006A9C`          | `#73D0FF`          | processing، informational                             |
| `overlay.scrim`  | `rgb(0 0 0 / 32%)` | `rgb(0 0 0 / 60%)` | dialog/drawer فقط                                     |

### قواعد التباين

- النص العادي وحقول الإدخال يستهدف WCAG AA (4.5:1)، والنص الكبير/العناوين 3:1 على الأقل.
- `brand.cyan` لا يستخدم كنص صغير على الأبيض؛ يستخدم كخلفية مع `brand.navy` أو كaccent غير نصي.
- status success/warning/danger/info يظهر معه label أو icon، وتوجد نسخة نصية في screen reader.
- في dark theme لا نعكس ألوان الصور أو logo عشوائيًا؛ نستخدم mark/asset مناسبًا مع surface card.

## 5. Typography tokens

| المستوى     | Font                 | الحجم/line-height | الوزن   | الاستخدام                           |
| ----------- | -------------------- | ----------------- | ------- | ----------------------------------- |
| Display     | Cairo / Plus Jakarta | 36/44             | 800     | hero أو صفحة عامة فقط               |
| H1          | Cairo / Plus Jakarta | 30/38             | 800     | عنوان page                          |
| H2          | Cairo / Plus Jakarta | 24/32             | 800     | section وmodal title                |
| H3          | Cairo / Plus Jakarta | 18/26             | 700     | card وsubsection                    |
| Body        | Cairo / Plus Jakarta | 14/22             | 400–600 | نص العمل الأساسي                    |
| Body small  | Cairo / Plus Jakarta | 12/18             | 500–600 | metadata، table، helper             |
| Label       | Cairo / Plus Jakarta | 12/16             | 700     | label وbadge                        |
| Button      | Cairo / Plus Jakarta | 13/20             | 700     | كل الأزرار                          |
| Code/number | JetBrains Mono       | 12–14/18          | 500–700 | IDs، references، amounts عند الحاجة |

العنوان العربي لا يضغط line-height إلى أقل من 1.35. الأرقام المالية تستخدم tabular numerals عند المقارنة، وتعرض العملة من tenant locale.

## 6. Spacing, radius, elevation, motion

| Token                   |                          القيمة | الاستخدام                            |
| ----------------------- | ------------------------------: | ------------------------------------ |
| `space.1` إلى `space.6` |          4، 8، 12، 16، 24، 32px | فجوات داخلية وخارجية على grid من 4px |
| `space.8`               |                            40px | فصل section أو header                |
| `radius.sm/md/lg`       |                       8/12/16px | input، card، dialog                  |
| `radius.xl/2xl`         |                         20/24px | hero وsurface كبيرة                  |
| `radius.full`           |                          9999px | pill، avatar، primary CTA عند الحاجة |
| `elevation.1`           |    0 1px 3px rgb(24 33 43 / 6%) | card عادية                           |
| `elevation.2`           |  0 8px 24px rgb(24 33 43 / 10%) | popover وhover مهم                   |
| `elevation.3`           | 0 20px 48px rgb(24 33 43 / 18%) | modal وcritical drawer               |
| `motion.fast`           |                           120ms | hover، focus، toggle                 |
| `motion.normal`         |                           200ms | drawer، card، tab                    |
| `motion.slow`           |                           320ms | page transition أو progress فقط      |

الحركة توقف عند `prefers-reduced-motion`. لا نستخدم transform يغيّر موضع زر حساس أثناء confirmation، ولا نضيف animation لتجميل رقم مالي يتغير.

## 7. Component library

### 7.1 Actions and navigation

| المكوّن         | variants                                                    | الحالات المطلوبة                                  | قاعدة المنتج                                             |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| Button          | primary، secondary، outline، ghost، destructive، link، icon | default، hover، focus، pressed، disabled، loading | primary واحد؛ destructive يذكر أثره                      |
| IconButton      | neutral، accent، destructive                                | tooltip، focus، disabled                          | aria-label مطلوب؛ لا icon-only في إجراء حساس بلا tooltip |
| Link/Breadcrumb | inline، breadcrumb، deep link                               | visited، focus، unavailable                       | لا يضع PII أو token في href                              |
| Tabs            | line، pill، vertical                                        | active، hover، disabled، overflow                 | tab state في URL إذا كان غير حساس                        |
| Sidebar item    | default، active، with badge                                 | collapsed، mobile، denied hidden                  | badge للـinbox فقط وبنطاق المستخدم                       |
| Command palette | search، grouped results                                     | loading، no results، keyboard active              | permission filter قبل ranking                            |

### 7.2 Inputs and forms

| المكوّن            | variants                            | الحالات المطلوبة                                   | قاعدة المنتج                           |
| ------------------ | ----------------------------------- | -------------------------------------------------- | -------------------------------------- |
| Text/Input         | text، email، number، masked، search | empty، filled، focus، invalid، disabled، read-only | label دائم؛ helper يشرح format         |
| Select/Combobox    | single، multi، async                | loading، no options، invalid، clearable            | لا يحمل كل tenant عند الفتح            |
| Date/Time picker   | date، range، time، timezone         | min/max، holiday، invalid، locale                  | تخزين ISO؛ عرض timezone واضح           |
| Money input        | SAR أو عملة tenant                  | decimal، max، negative blocked                     | يعرض currency ويمنع floating ambiguity |
| Textarea/Comment   | normal، reason، appeal              | char count، invalid، read-only                     | reason مطلوب للأفعال المقيدة           |
| File upload        | single، multi، import               | validating، progress، rejected، retry              | type/size/virus check؛ لا public URL   |
| Stepper            | horizontal، vertical                | current، complete، blocked، error                  | يحفظ progress؛ لا يتخطى policy gate    |
| Validation summary | inline + top summary                | error count، focus first                           | نص عربي/English قابل للفهم             |

### 7.3 Data and feedback

| المكوّن             | variants                                | الحالات المطلوبة                                | قاعدة المنتج                                       |
| ------------------- | --------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| Table               | compact، comfortable، responsive list   | loading، empty، filtered empty، error، selected | header يوضح scope/as_of؛ columns الحساسة allowlist |
| Card/KPI            | neutral، brand، status، clickable       | loading، stale، disabled                        | KPI يذكر الفترة ومصدره                             |
| Badge/Status        | success، warning، danger، info، neutral | icon + text، dark/light                         | لا لون وحده ولا label مبهم                         |
| Avatar/Avatar group | photo، initials، masked                 | missing، loading، privacy                       | alt صحيح؛ لا يعرض identity الخام                   |
| Pagination          | numbered، cursor، load more             | disabled، page size                             | server-side؛ يحفظ filter الآمن                     |
| Modal/Dialog        | confirm، form، detail                   | open، focus trap، escape، loading               | confirmation قبل lock/payment/export               |
| Drawer/Sheet        | detail، filter، mobile menu             | open، focus return، dirty                       | لا يخفي action footer أثناء كتابة form             |
| Toast/Alert         | success، info، warning، error           | timeout، persistent، action                     | يذكر reference أو next action                      |
| Empty state         | first use، filtered، denied             | illustration optional، CTA                      | يشرح السبب والحل لا «لا بيانات» فقط                |
| Skeleton/Progress   | page، table، job                        | reduced motion، timeout                         | يحاكي الأبعاد؛ job يعرض percent/last attempt       |
| Timeline            | audit، approval، lifecycle              | collapsed، actor masked، gap                    | الأحداث immutable وtimestamp واضح                  |
| Chart               | line، bar، donut، heatmap               | no data، stale، tooltip، table fallback         | palette accessible وdata table بديل                |

## 8. Contract للحالات والتفاعلات

كل component يثبت CSS/ARIA state قبل ربط domain:

| الحالة              | مرئي                           | keyboard/ARIA                         | الحد التجاري                             |
| ------------------- | ------------------------------ | ------------------------------------- | ---------------------------------------- |
| hover               | surface tint أو elevation بسيط | لا يعتمد عليه                         | لا يغيّر permission                      |
| focus-visible       | ring 3px عالي التباين          | focus order منطقي                     | لا يختفي خلف drawer                      |
| disabled            | opacity محدودة + tooltip/سبب   | `aria-disabled` أو disabled حقيقي     | لا يستخدم لإخفاء access denied في server |
| loading             | skeleton أو spinner داخل الزر  | `aria-busy`                           | يمنع duplicate submit                    |
| invalid             | border + icon + message        | `aria-invalid` وdescribedby           | لا يسمح submit إذا policy تمنع           |
| read-only/masked    | lock icon + label              | يقرأ «مقنع»                           | لا يتيح copy/export خام                  |
| destructive confirm | dialog وsummary                | focus على cancel أو confirm حسب الخطر | يطلب reason واسم العملية                 |

## 9. Layout patterns قابلة لإعادة الاستخدام

### Page shell

`PageHeader` فيه breadcrumb، H1، description، context (tenant/entity/period)، primary action، وsecondary overflow. تحته `StatusBar` عند job أو stale، ثم content grid. لا نضع أكثر من 12 column على desktop، وتتحول إلى عمود واحد تحت 768px.

### List and table

`FilterBar` يعرض عدد الفلاتر وClear، ثم `DataTable` مع pagination وcolumn chooser وas_of. عند الهاتف يتحول الصف إلى Card فيها أهم 3 حقول وaction menu. export خارج filter scope ممنوع.

### Detail and profile

`EntityHeader` يعرض الاسم المقنع/المعرف المسموح، status، owner، dates، ثم tabs. `SensitiveField` يملك masked/reveal permission وreason. `ActivityTimeline` يظهر آخر الأحداث مع link إلى audit.

### Form and workflow

`FormSection` يجزئ الحقول، `ValidationSummary` أعلى الصفحة، و`ActionFooter` sticky. workflow يضيف `ApprovalTimeline`, `DecisionPanel`, `EvidenceCard`, و`SlaBadge`. أفعال approve/reject لا تظهر كأزرار متجاورة بلا معنى؛ يظهر next state وسبب مطلوب.

### Dashboard and reports

صف KPI أول، صف charts ثاني، صف inbox/table ثالث، مع freshness وdrill-down. كل chart له table fallback، وأي رقم مالي يحمل period وcurrency وsource.

## 10. Responsive contract

| العرض       | shell                                      | grid                               | actions                      |
| ----------- | ------------------------------------------ | ---------------------------------- | ---------------------------- |
| ≥1280px     | Sidebar 288px وHeader كامل                 | 12 columns، cards 3–4              | primary وsecondary ظاهرة     |
| 1024–1279px | Sidebar collapsed 80px                     | 8 columns، table column chooser    | overflow للثانوي             |
| 768–1023px  | drawer + header صفين                       | 4 columns، table scroll key column | action footer في form        |
| ≤767px      | mobile header + drawer + ESS quick actions | عمود واحد، cards وsheets           | CTA ثابت، touch target ≥44px |

عند ضيق المساحة لا نصغر الخط تحت Body small لإبقاء table؛ نغير التمثيل إلى list/card. payment وlock وrestricted export تحتاج صفحة تأكيد كاملة حتى على الهاتف.

## 11. RTL/LTR وقواعد العربية

- نضع `dir` على root context ونستخدم CSS logical properties: `margin-inline`, `padding-inline`, `inset-inline`, `text-align: start`.
- نعكس chevron وarrow التي تعبر عن حركة، ولا نعكس icons التي تعبر عن حالة أو ملف أو مال.
- Cairo للعربية مع line-height أكبر؛ Plus Jakarta/Roboto للإنجليزية حسب translation contract، وJetBrains Mono للـIDs والأرقام التقنية.
- أسماء الموظفين بالعربية والإنجليزية، search normalization للعربية، وحقول رقمية LTR داخل حاوية direction مناسبة.
- التاريخ يقرأ بصيغة tenant locale مع tooltip ISO عند الحاجة؛ timezone يظهر بجانب وقت attendance/payment.
- لا نضع نصوصًا داخل صورة؛ logo له alt عربي/English، وCSS لا يفترض عرضًا ثابتًا للنص.

## 12. Microcopy أساسية

| السياق       | العربية                                            | English                                                     |
| ------------ | -------------------------------------------------- | ----------------------------------------------------------- |
| حفظ          | حفظ التغييرات                                      | Save changes                                                |
| إرسال        | إرسال للمراجعة                                     | Submit for review                                           |
| نجاح         | تم حفظ التغيير بالمرجع {reference}                 | Change saved with reference {reference}                     |
| انتظار       | الطلب بانتظار موافقة {role}                        | Waiting for {role} approval                                 |
| رفض          | لم يتم التنفيذ: {reason}                           | Not completed: {reason}                                     |
| صلاحية       | لا توجد صلاحية لهذا الإجراء ضمن نطاقك              | You do not have permission for this action in your scope    |
| جلسة         | انتهت الجلسة؛ سجّل الدخول للمتابعة                 | Your session expired; sign in to continue                   |
| فارغ أول مرة | ابدأ بإضافة أول موظف                               | Start by adding your first employee                         |
| فارغ filter  | لا توجد نتائج بهذه الشروط                          | No results match these filters                              |
| job          | جارٍ تجهيز الملف؛ يمكنك متابعة الحالة من الإشعارات | Preparing the file; track progress in Notifications         |
| restricted   | القيمة مقنعة لحماية بيانات الموظف                  | Value masked to protect employee data                       |
| confirmation | سيقفل هذا المسير ولا يمكن تعديل snapshot بعده      | This locks the run; its snapshot cannot be edited afterward |

الرسائل لا تعرض stack trace أو email أو IBAN أو سبب أمني تفصيلي يساعد على التخمين. النصوص الحساسة قابلة للترجمة، والـplaceholders لها format contract.

## 13. Charts and data visualization

- palette الأساسية: royal، cyan، success، warning، danger، info؛ لا يزيد chart واحد عن 5 series.
- كل chart له legend نصي، tooltip، table fallback، وempty/stale state.
- لا نستخدم donut لفرق صغير أو أكثر من 5 فئات؛ نستخدم bar/table للمقارنة الدقيقة.
- الخطوط والأرقام لا تقل عن 12px في desktop و11px في mobile مع إمكانية تكبير المتصفح.
- الرسوم المالية تعرض currency وperiod وas_of، ولا تخلط net وgross في نفس المحور دون label.

## 14. Dark theme and high contrast

الوضع الداكن يغير surfaces وtext/borders ويحافظ على معنى status. لا نستخدم black pure أو cyan ساطع كنص طويل. high-contrast mode يزيد border وfocus ring ويحتفظ بعلامات text. الصور والـcharts توفر alternate palette عند contrast failure.

## 15. Design QA وDefinition of Done

قبل اعتبار component أو شاشة جاهزة:

1. token lint يمنع hex خارج catalog ويثبت light/dark fallback.
2. snapshot للعربية والإنجليزية وviewport desktop/mobile.
3. contrast check للنص وfocus وstatus، وkeyboard test بدون mouse.
4. RTL test للـdrawer/table/calendar والـicons الاتجاهية.
5. loading/empty/error/success/disabled/read-only/masked states موثقة.
6. screen reader يقرأ heading وlabel وerror وprogress وtoast.
7. visual diff لا يمر إذا تغير layout بسبب نص عربي أطول أو locale/number format.
8. performance check يمنع component من تحميل chart/font غير مطلوب.

## 16. حالات قبول Design System

| ID    | Given                   | When                 | Then                                                 |
| ----- | ----------------------- | -------------------- | ---------------------------------------------------- |
| DS-01 | Light theme             | يفتح primary CTA     | يستخدم brand.royal مع contrast AA وfocus واضح        |
| DS-02 | Dark theme              | يفتح نفس CTA         | يستخدم cyan/foreground مناسب ولا يختفي النص          |
| DS-03 | Arabic RTL              | يفتح Sidebar وdrawer | ترتيب القراءة وchevrons وfocus صحيحة                 |
| DS-04 | English LTR             | يفتح نفس الشاشة      | labels وspacing وroute semantics سليمة               |
| DS-05 | input invalid           | يضغط Submit          | يرى inline error وsummary وaria-invalid              |
| DS-06 | form dirty              | يغير route           | dialog يتيح save draft أو cancel                     |
| DS-07 | job processing          | يفتح report/import   | progress وlast attempt وretry تظهر                   |
| DS-08 | table empty first-use   | لا توجد بيانات       | CTA قيمة أولى وليس table فارغًا فقط                  |
| DS-09 | table filtered empty    | يمسح filter          | تعود القائمة دون فقد context                         |
| DS-10 | restricted salary       | يفتح card/table      | masked label وno copy/export خام                     |
| DS-11 | destructive action      | يضغط Lock/Payment    | confirmation وsummary وreason/SoD قبل التنفيذ        |
| DS-12 | keyboard-only           | يتنقل في modal       | focus trap وEscape وreturn focus يعملان              |
| DS-13 | screen reader           | يقرأ KPI/chart       | يجد label وperiod وtable fallback                    |
| DS-14 | viewport 360px          | يفتح ESS             | cards وquick actions وtouch target ≥44px             |
| DS-15 | viewport 1024px         | يفتح table           | column chooser وkey column ثابتة                     |
| DS-16 | reduced motion          | يفتح drawer/toast    | لا حركة مزعجة ويظل status مفهومًا                    |
| DS-17 | locale dates            | يعرض attendance      | timezone وformat من tenant/user locale               |
| DS-18 | long Arabic text        | يفتح button/badge    | لا clipping أو overflow، ويظل CTA قابلًا للمس        |
| DS-19 | missing translation key | يبني CI              | يفشل check أو يظهر fallback مراقبًا، لا key للمستخدم |
| DS-20 | unauthorized role       | يحاول الوصول         | لا يعتمد hidden UI؛ server يرجع access denied موحدًا |

## 17. تسليم الأجزاء التالية

- **PART 9:** استخدام هذه المكونات في Workflows وapproval states وconfirmation rules.
- **PART 10–12:** ربط field sensitivity وstatus tokens بعقود Database/API/Security.
- **PART 13:** تحويل DS-01–20 إلى visual/accessibility/component tests.
- **PART 18:** استخراج primitives وwrappers إلى source code بعد اعتماد tokens والـsubset.

الملف الآلي المرفق يظل catalog مقترحًا؛ `runtime_enabled` يساوي `false` ولا يغير CSS أو theme حتى اعتماد المراجعة.
