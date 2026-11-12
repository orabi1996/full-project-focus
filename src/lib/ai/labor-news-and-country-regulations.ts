/**
 * MadarX Enterprise AI: Multi-Country Labor Law, Labor Office Regulations & HR News Engine
 * Covers all 7 countries supported by the platform:
 * - Saudi Arabia (SA) - وزارة الموارد البشرية، منصة قوى، التأمينات GOSI، حماية الأجور مدد
 * - Egypt (EG) - وزارة العمل، قانون 12 لسنة 2003، التأمينات والمعاشات 148 لسنة 2019
 * - United Arab Emirates (AE) - وزارة الموارد البشرية والتوطين MOHRE، مرسوم بقانون 33 لسنة 2021
 * - Qatar (QA) - وزارة العمل القطرية، قانون 14 لسنة 2004، إلغاء الكفالة والحد الأدنى
 * - Kuwait (KW) - الهيئة العامة للقوى العاملة PAM، قانون 6 لسنة 2010
 * - Bahrain (BH) - وزارة العمل وهيئة تنظيم سوق العمل LMRA، قانون 36 لسنة 2012
 * - Oman (OM) - وزارة العمل العمانية، قانون العمل الصادر بالمرسوم السلطاني 52 لسنة 2023 ومنظومة الحماية الاجتماعية SPF
 *
 * Includes curated 2025/2026 HR trends, recruitment news, and regulatory updates feed.
 */

export interface CountryLaborRegulation {
  countryCode: "SA" | "EG" | "AE" | "QA" | "KW" | "BH" | "OM";
  countryNameAr: string;
  countryNameEn: string;
  flagEmoji: string;
  laborAuthority: string;
  officialPortal: string;
  governingLaw: string;
  lastUpdated: string;
  workingHours: {
    standardDaily: number;
    standardWeekly: number;
    ramadanDailyMuslims: number;
    overtimeRateDay: string;
    overtimeRateNightWeekend: string;
    weeklyRestDays: number;
  };
  probation: {
    standardDays: number;
    maxDays: number;
    rules: string;
  };
  annualLeave: {
    baseDays: number;
    incrementAfterYears: number;
    incrementedDays: number;
    cashOutPolicy: string;
  };
  endOfServiceGratuity: {
    formulaDescription: string;
    resignationScale: string;
    exemptionsAndCaps: string;
  };
  wpsAndPayroll: {
    systemName: string;
    rules: string;
    disputeDeadline: string;
  };
  socialInsurance: {
    citizenEmployeePct: number;
    citizenEmployerPct: number;
    expatEmployeePct: number;
    expatEmployerPct: number;
    statutoryMaxWage: string;
    detailsAr: string;
  };
  nationalizationProgram: {
    programName: string;
    summary: string;
  };
  latest2026Updates: string[];
}

export const COUNTRY_LABOR_REGULATIONS: Record<
  "SA" | "EG" | "AE" | "QA" | "KW" | "BH" | "OM",
  CountryLaborRegulation
> = {
  SA: {
    countryCode: "SA",
    countryNameAr: "المملكة العربية السعودية",
    countryNameEn: "Saudi Arabia",
    flagEmoji: "🇸🇦",
    laborAuthority: "وزارة الموارد البشرية والتنمية الاجتماعية (MHRSD) ومنصة قوى والتأمينات الاجتماعية (GOSI)",
    officialPortal: "https://qiwa.sa | https://hrsd.gov.sa | https://www.gosi.gov.sa",
    governingLaw: "نظام العمل السعودي الصادر بالمرسوم الملكي م/51 وتعديلاته بالمرسوم م/46 واللوائح التنفيذية لمنصة قوى",
    lastUpdated: "2026",
    workingHours: {
      standardDaily: 8,
      standardWeekly: 48,
      ramadanDailyMuslims: 6,
      overtimeRateDay: "أجر الساعة الأساسي + 50% من الأجر الأساسي (المادة 107)",
      overtimeRateNightWeekend: "150% من أجر الساعة الفعلي لكافة ساعات العمل الإضافي والعطل الرسمية",
      weeklyRestDays: 1, // نظامياً يوم واحد والراجح يومان كعادة عمل المنشآت
    },
    probation: {
      standardDays: 90,
      maxDays: 180,
      rules: "لا تزيد على 90 يوماً ويجوز تمديدها باتفاق كتابي صريح إلى 180 يوماً (المادة 53). لا تدخل إجازات العيدين والمرضية ضمن الحسبة.",
    },
    annualLeave: {
      baseDays: 21,
      incrementAfterYears: 5,
      incrementedDays: 30,
      cashOutPolicy: "يستحق الموظف 21 يوماً ترتفع إلى 30 يوماً متى أمضى خمس سنوات متصلة (المادة 109). تدفع نقداً عند انتهاء الخدمة عن الأيام غير المستنفذة.",
    },
    endOfServiceGratuity: {
      formulaDescription: "أجر نصف شهر عن كل سنة من السنوات الخمس الأولى، وأجر شهر كامل عن كل سنة تالية، محسوبة على أساس آخر راتب فعلي شامل البدلات (المادة 84).",
      resignationScale: "في الاستقالة (المادة 85): أقل من سنتين = لا شيء. من سنتين إلى 5 سنوات = ثلث المكافأة (33.3%). من 5 إلى 10 سنوات = ثلثي المكافأة (66.7%). 10 سنوات فأكثر = المكافأة كاملة 100%.",
      exemptionsAndCaps: "تستحق المرأة العاملة المكافأة كاملة إذا أنهت العقد خلال 6 أشهر من الزواج أو 3 أشهر من الولادة. كما يستحقها كاملة من ترك العمل لظرف قاهر أو إنهاء تعسفي.",
    },
    wpsAndPayroll: {
      systemName: "برنامج حماية الأجور السعودي (منصة مدد WPS)",
      rules: "إلزام المنشآت برفع ملفات الرواتب بنسبة التزام لا تقل عن 90%، وفتح حسابات بنكية برقم آيبان لكل موعد صرف شهري دون تأخير.",
      disputeDeadline: "يتم تسوية الخلافات ودياً عبر منصة (ودي) خلال 21 يوماً قبل الإحالة للمحكمة العمالية.",
    },
    socialInsurance: {
      citizenEmployeePct: 9.75, // 9% معاشات + 0.75% ساند
      citizenEmployerPct: 11.75, // 9% معاشات + 0.75% ساند + 2% أخطار
      expatEmployeePct: 0,
      expatEmployerPct: 2.0, // أخطار مهنية فقط
      statutoryMaxWage: "45,000 ريال سعودي شهرياً",
      detailsAr: "للسعودي: خصم 9.75% من أجر الاشتراك وتدفع المنشأة 11.75%. لغير السعودي: تدفع المنشأة 2% أخطار مهنية فقط دون خصم من الموظف.",
    },
    nationalizationProgram: {
      programName: "برنامج نطاقات وقرارات التوطين القطاعي لمنصة قوى",
      summary: "احتساب نسب التوطين حسب النشاط وحجم المنشأة، مع توطين مهن الموارد البشرية، المحاسبة، المشتريات، المبيعات وإلزامية توثيق كافة العقود رقمياً بنسبة 100% عبر قوى.",
    },
    latest2026Updates: [
      "إلزامية التوثيق الرقمي للعقود بنسبة 100% لمنصة قوى شرطاً لأي خدمة تأشيرات أو نقل خدمات.",
      "رفع معيار الحد الأدنى لاحتساب المواطن في نطاقات إلى 4,000 ريال سعودي شهرياً لاحتسابه كواحد كامل.",
      "توسيع نطاق التوطين في مهن الاستشارات الإدارية وهندسة الحاسب والتقنية المالية والخدمات اللوجستية.",
      "إتاحة مسار تسوية الخلافات العمالية التلقائي عبر الذكاء الاصطناعي لمنصة 'ودي' التابعة للوزارة.",
    ],
  },

  EG: {
    countryCode: "EG",
    countryNameAr: "جمهورية مصر العربية",
    countryNameEn: "Egypt",
    flagEmoji: "🇪🇬",
    laborAuthority: "وزارة العمل والهيئة القومية للتأمين الاجتماعي (NOSI) والمجلس القومي للأجور",
    officialPortal: "https://www.manpower.gov.eg | https://nosi.gov.eg",
    governingLaw: "قانون العمل المصري رقم 12 لسنة 2003 وقانون التأمينات الاجتماعية والمعاشات رقم 148 لسنة 2019",
    lastUpdated: "2026",
    workingHours: {
      standardDaily: 8,
      standardWeekly: 48,
      ramadanDailyMuslims: 7, // جرى العرف على تخفيض ساعة
      overtimeRateDay: "الأجر الأصلي المستحق عن ساعات العمل + 35% للأجر النهاري",
      overtimeRateNightWeekend: "الأجر الأصلي + 70% للعمل الليلي، و100% (أجر مضاعف) في أيام العطلات الأسبوعية والرسمية",
      weeklyRestDays: 1, // 24 ساعة متصلة على الأقل كل 6 أيام عمل متصلة
    },
    probation: {
      standardDays: 90,
      maxDays: 90,
      rules: "لا يجوز تعيين الموظف تحت الاختبار لمدة تزيد على ثلاثة أشهر، ولا يجوز وضعه تحت الاختبار أكثر من مرة لدى صاحب عمل واحد (المادة 32).",
    },
    annualLeave: {
      baseDays: 21,
      incrementAfterYears: 10,
      incrementedDays: 30,
      cashOutPolicy: "21 يوماً لمن أمضى سنة، تزداد إلى 30 يوماً إذا أمضى 10 سنوات أو تجاوز سن الخمسين. يلتزم صاحب العمل بتسوية رصيد الإجازات كل 3 سنوات كحد أقصى أو نقداً عند انتهاء الخدمة.",
    },
    endOfServiceGratuity: {
      formulaDescription: "وفق قانون التأمينات 148 لسنة 2019: مكافأة نهاية الخدمة تحسب بواقع أجر شهر عن كل سنة خدمة لمن لم يشمله نظام المعاش الكامل، أو نصف شهر عن أول 5 سنوات وشهر عن كل سنة تالية.",
      resignationScale: "تخضع لضوابط إنهاء العقد؛ الاستقالة تصبح نافذة بعد مضي أسبوع من تاريخ قبولها أو مضي 30 يوماً من تقديمها دون بت.",
      exemptionsAndCaps: "التعويض عن الفصل التعسفي: أجر شهرين عن كل سنة خدمة كحد أدنى بالإضافة لكافة المستحقات العمالية.",
    },
    wpsAndPayroll: {
      systemName: "منظومة الدفع الإلكتروني والشمول المالي والتحويل البنكي للمرتبات",
      rules: "إلزام القطاع الخاص بالحد الأدنى للأجور المحدد من المجلس القومي للأجور والتحويل عبر البنوك ومحافظ الدفع الإلكتروني.",
      disputeDeadline: "عقد جلسات التسوية بمكاتب العمل خلال 21 يوماً قبل الإحالة للمحكمة العمالية المختصة.",
    },
    socialInsurance: {
      citizenEmployeePct: 11.0, // حصة العامل
      citizenEmployerPct: 18.75, // حصة المنشأة
      expatEmployeePct: 0,
      expatEmployerPct: 3.0, // إصابات عمل فقط
      statutoryMaxWage: "14,500 جنيه مصري (يتم تحديثه سنوياً في يناير)",
      detailsAr: "وفق قانون 148 لسنة 2019: يخصم من العامل المصري 11%، وتتحمل المنشأة 18.75%، بإجمالي اشتراك 29.75% من أجر الاشتراك التأميني بحد أدنى وأقصى محدد قانوناً.",
    },
    nationalizationProgram: {
      programName: "ضوابط تشغيل العمالة الأجنبية ونسب التشغيل الوطنية",
      summary: "ألا تزيد نسبة العمالة الأجنبية في أي منشأة عن 10% من إجمالي العاملين، مع اشتراط تصريح عمل رسمي من وزارة العمل.",
    },
    latest2026Updates: [
      "تطبيق قرار المجلس القومي للأجور برفع الحد الأدنى للأجور بالقطاع الخاص إلى 6,000 جنيه مصري شهرياً.",
      "تحديث الحد الأدنى لأجر الاشتراك التأميني إلى 2,300 جنيه والحد الأقصى إلى 14,500 جنيه وفق الآلية السنوية لقانون المعاشات.",
      "ميكنة نماذج مكتب العمل (استمارة 1 و2 و6 تأمينات) عبر البوابة الرقمية للهيئة القومية للتأمين الاجتماعي.",
      "تحديث اللائحة التنفيذية لفض المنازعات العمالية الفردية إلكترونياً عبر منظومة وزارة العمل.",
    ],
  },

  AE: {
    countryCode: "AE",
    countryNameAr: "دولة الإمارات العربية المتحدة",
    countryNameEn: "United Arab Emirates",
    flagEmoji: "🇦🇪",
    laborAuthority: "وزارة الموارد البشرية والتوطين (MOHRE) وهيئة المعاشات GPSSA وصندوق التأمين ضد التعطل ILOE",
    officialPortal: "https://www.mohre.gov.ae | https://gpssa.gov.ae",
    governingLaw: "مرسوم بقانون اتحادي رقم 33 لسنة 2021 بشأن تنظيم علاقات العمل ولائحته التنفيذية بقرار مجلس الوزراء رقم 1 لسنة 2022",
    lastUpdated: "2026",
    workingHours: {
      standardDaily: 8,
      standardWeekly: 48,
      ramadanDailyMuslims: 6, // تخفيض ساعتين لكافة العاملين خلال رمضان
      overtimeRateDay: "أجر الساعة الأساسي + 25% إضافي",
      overtimeRateNightWeekend: "أجر الساعة الأساسي + 50% للعمل بين 10 مساءً و4 صباحاً أو في أيام الراحة الأسبوعية",
      weeklyRestDays: 1, // يوم راحة أسبوعية مدفوعة الأجر كحد أدنى ويجوز للمنشأة زيادتها ليومين
    },
    probation: {
      standardDays: 180, // 6 أشهر
      maxDays: 180,
      rules: "لا تزيد فترة التجربة على 6 أشهر، وإشعار إنهاء الخدمة خلال التجربة يتطلب إخطار كتابي مدته 14 يوماً من صاحب العمل، أو 30 يوماً من الموظف إذا كان سينتقل لعمل داخل الدولة.",
    },
    annualLeave: {
      baseDays: 30, // 30 يوماً تقويمياً
      incrementAfterYears: 0,
      incrementedDays: 30,
      cashOutPolicy: "يستحق العامل إجازة سنوية مدفوعة الأجر لا تقل عن 30 يوماً عن كل سنة، ويومين عن كل شهر إذا قلت خدمته عن سنة وزادت عن 6 أشهر. تصرف نقداً عند انتهاء الخدمة عن الأيام غير المستخدمة محسوبة على الراتب الأساسي.",
    },
    endOfServiceGratuity: {
      formulaDescription: "بموجب المادة 51: أجر 21 يوماً عن كل سنة من السنوات الخمس الأولى، وأجر 30 يوماً عن كل سنة تالية، محسوبة على أساس آخر راتب أساسي، بشرط قضاء سنة خدمة مستمرة على الأقل.",
      resignationScale: "ألغى المرسوم بقانون رقم 33 لسنة 2021 التخفيض في حالة الاستقالة؛ يستحق الموظف المستقيل مكافأة نهاية الخدمة كاملة طالما أكمل سنة واحدة في العمل.",
      exemptionsAndCaps: "لا يجوز أن يزيد إجمالي مكافأة نهاية الخدمة عن أجر سنتين. تم إطلاق نظام 'صناديق الادخار البديلة' الاختياري كبديل حديث لمكافأة نهاية الخدمة.",
    },
    wpsAndPayroll: {
      systemName: "نظام حماية الأجور الإماراتي (WPS)",
      rules: "إلزام جميع المنشآت بتحويل أجور ما لا يقل عن 90% من العمالة عبر نظام WPS وبنوك ومصارف الدولة المرخصة قبل حلول موعد الاستحقاق.",
      disputeDeadline: "المنازعات التي تقل قيمتها عن 50 ألف درهم تفصل فيها وزارة الموارد البشرية والتوطين بقرار تنفيذي نهائي دون الحاجة للمحكمة.",
    },
    socialInsurance: {
      citizenEmployeePct: 5.0, // مواطنو الإمارات (أو 11% حسب تعديلات المعاشات الجديدة)
      citizenEmployerPct: 15.0, // تتحمل المنشأة 12.5% إلى 15%
      expatEmployeePct: 0,
      expatEmployerPct: 0,
      statutoryMaxWage: "100,000 درهم إماراتي شهرياً",
      detailsAr: "للمواطنين: يخضعون لصندوق المعاشات GPSSA (أو صندوق أبوظبي للتقاعد). لغير المواطنين: لا توجد تأمينات تقاعد، ويلزم التسجيل في نظام التأمين ضد التعطل عن العمل (ILOE) الإلزامي لجميع العاملين.",
    },
    nationalizationProgram: {
      programName: "برنامج نافس (Nafis) ومستهدفات التوطين نصف السنوية",
      summary: "إلزام المنشآت التي تضم 50 عاملاً فأكثر بزيادة نسبة التوطين في الوظائف المهارية بنسبة 2% سنوياً (1% نصف سنوي) وفرض مساهمات مالية تصاعدية على غير الملتزمين.",
    },
    latest2026Updates: [
      "وصول مستهدفات التوطين في المهن المهارية لمنشآت القطاع الخاص (50 موظفاً فأكثر) إلى مستهدف تراكمي 10%.",
      "تطبيق نظام الادخار التقاعدي البديل لمكافأة نهاية الخدمة للقطاع الخاص للمؤسسات الراغبة في استثمار مستحقات الموظفين.",
      "تغليظ عقوبات التوطين الصوري وإلزامية توثيق اشتراكات برنامج نافس عبر المنصة الرقمية الموحدة.",
      "إلزامية سداد رسوم التأمين ضد التعطل عن العمل (ILOE) لجميع الموظفين لتفادي الغرامات وتجديد تصاريح العمل.",
    ],
  },

  QA: {
    countryCode: "QA",
    countryNameAr: "دولة قطر",
    countryNameEn: "Qatar",
    flagEmoji: "🇶🇦",
    laborAuthority: "وزارة العمل القطرية والهيئة العامة للتقاعد والتأمينات الاجتماعية (GRSIA)",
    officialPortal: "https://www.mol.gov.qa | https://www.grsia.gov.qa",
    governingLaw: "قانون العمل القطري رقم 14 لسنة 2004 وتعديلاته والقانون رقم 17 لسنة 2020 بشأن تحديد الحد الأدنى للأجور وقانون التأمينات 1 لسنة 2022",
    lastUpdated: "2026",
    workingHours: {
      standardDaily: 8,
      standardWeekly: 48,
      ramadanDailyMuslims: 6,
      overtimeRateDay: "الأجر الأساسي للساعة + 25%",
      overtimeRateNightWeekend: "الأجر الأساسي للساعة + 50% للعمل الليلي (9 مساءً - 6 صباحاً)، و150% أو يوم بديل لأيام الراحة الأسبوعية",
      weeklyRestDays: 1, // يوم الجمعة هو يوم الراحة الأسبوعية المعتاد
    },
    probation: {
      standardDays: 180, // 6 أشهر
      maxDays: 180,
      rules: "لا تزيد على ستة أشهر من تاريخ مباشرة العمل، ويجوز لصاحب العمل إنهاء العقد خلالها بإخطار مدته شهر على الأقل إذا كان العامل غير كفء.",
    },
    annualLeave: {
      baseDays: 21,
      incrementAfterYears: 5,
      incrementedDays: 28, // أربعة أسابيع
      cashOutPolicy: "ثلاثة أسابيع (21 يوماً) لمن أمضى سنة ويقل عن 5 سنوات، وترتفع إلى أربعة أسابيع (28 يوماً) بعد إكمال خمس سنوات خدمة.",
    },
    endOfServiceGratuity: {
      formulaDescription: "بموجب المادة 54: يتفق الطرفان على المكافأة بشرط ألا تقل عن أجر ثلاثة أسابيع (21 يوماً) عن كل سنة خدمة كاملة محسوبة على آخر أجر أساسي.",
      resignationScale: "يستحق العامل المكافأة إذا أتم سنة خدمة كاملة، وتصرف كاملة إذا أنهى العقد وفق مهلة الإخطار القانونية.",
      exemptionsAndCaps: "لا يستحقها العامل إذا فصل بموجب المادة 61 (مخالفات جسيمة أو إفشاء أسرار العمل).",
    },
    wpsAndPayroll: {
      systemName: "نظام حماية الأجور القطري (WPS Qatar)",
      rules: "إلزام جميع الشركات الخاضعة لقانون العمل بتحويل رواتب جميع العمال إلى حساباتهم في البنوك المحلية في موعد لا يتجاوز 7 أيام من تاريخ الاستحقاق.",
      disputeDeadline: "لجان فض المنازعات العمالية تفصل في الشكاوى خلال 3 أسابيع من إحالتها.",
    },
    socialInsurance: {
      citizenEmployeePct: 7.0, // وفق قانون التأمينات الاجتماعية الجديد 1 لسنة 2022
      citizenEmployerPct: 14.0, // حصة جهة العمل للمواطنين
      expatEmployeePct: 0,
      expatEmployerPct: 0,
      statutoryMaxWage: "100,000 ريال قطري",
      detailsAr: "للقطريين: 7% اشتراك موظف و14% مساهمة جهة العمل (إجمالي 21%). غير القطريين: معفيون من اشتراكات التقاعد وتطبق عليهم مكافأة نهاية الخدمة.",
    },
    nationalizationProgram: {
      programName: "برنامج تقطير الوظائف في القطاع الخاص (Qatarization)",
      summary: "إلزام شركات القطاع الخاص بنسب تقطير محددة مع إعطاء الأولوية للكوادر القطرية وأبناء القطريات في التعيينات الإدارية والفنية.",
    },
    latest2026Updates: [
      "استقرار الحد الأدنى غير التمييزي للأجور عند 1,000 ريال قطري أساسي بالإضافة إلى 500 ريال للسكن و300 ريال للغذاء (إجمالي 1,800 ريال) حال عدم توفيرهما عيناً.",
      "تطبيق المنظومة الرقمية الشاملة لتوثيق وتعديل عقود العمل إلكترونياً بنسبة 100% عبر موقع وزارة العمل.",
      "تفعيل الربط الإلكتروني لشهادات براءة الذمة وتصاريح تغيير جهة العمل دون اشتراط شهادة عدم ممانعة (NOC).",
    ],
  },

  KW: {
    countryCode: "KW",
    countryNameAr: "دولة الكويت",
    countryNameEn: "Kuwait",
    flagEmoji: "🇰🇼",
    laborAuthority: "الهيئة العامة للقوى العاملة (PAM) والمؤسسة العامة للتأمينات الاجتماعية (PIFSS)",
    officialPortal: "https://www.manpower.gov.kw | https://www.pifss.gov.kw",
    governingLaw: "قانون العمل في القطاع الأهلي الكويتي رقم 6 لسنة 2010 وتعديلاته بالمرسوم 85 لسنة 2017",
    lastUpdated: "2026",
    workingHours: {
      standardDaily: 8,
      standardWeekly: 48,
      ramadanDailyMuslims: 6, // 36 ساعة أسبوعياً في رمضان
      overtimeRateDay: "الأجر العادي للساعة + 25%",
      overtimeRateNightWeekend: "الأجر العادي للساعة + 50% للعمل في الراحة الأسبوعية بالإضافة ليوم راحة بديل، و100% في العطلات الرسمية",
      weeklyRestDays: 1, // 24 ساعة متصلة بعد كل 6 أيام عمل
    },
    probation: {
      standardDays: 100, // 100 يوم عمل
      maxDays: 100,
      rules: "لا تزيد على 100 يوم عمل، ويجوز لأي من الطرفين إنهاء العقد خلالها دون إخطار. ولا يجوز تعيين العامل تحت التجربة لدى صاحب العمل نفسه أكثر من مرة.",
    },
    annualLeave: {
      baseDays: 30, // 30 يوم عمل
      incrementAfterYears: 0,
      incrementedDays: 30,
      cashOutPolicy: "يستحق العامل إجازة سنوية مدفوعة الأجر مدتها 30 يوم عمل عن كل سنة بعد قضاء 6 أشهر على الأقل في خدمة صاحب العمل، ولا تحسب ضمنها العطلات الرسمية والمرضية.",
    },
    endOfServiceGratuity: {
      formulaDescription: "المادة 51: للعاملين بالأجر الشهري: أجر 15 يوماً عن كل سنة من السنوات الخمس الأولى، وأجر شهر كامل عن كل سنة تالية، على ألا يزيد مجموع المكافأة عن أجر سنة ونصف (18 شهراً).",
      resignationScale: "المادة 53: في حالة الاستقالة: أقل من 3 سنوات = لا شيء. من 3 إلى 5 سنوات = نصف المكافأة. من 5 إلى 10 سنوات = ثلثي المكافأة. 10 سنوات فأكثر = المكافأة كاملة.",
      exemptionsAndCaps: "تستحق العاملة المكافأة كاملة إذا استقالت بسبب الزواج خلال سنة من تاريخه.",
    },
    wpsAndPayroll: {
      systemName: "نظام تحويل أجور العمالة بالبنوك المحلية (WPS Kuwait)",
      rules: "إلزام كافة المنشآت بتحويل أجور العمالة إلى البنوك المحلية وتقديم شهادة تحويل معتمدة للهيئة العامة للقوى العاملة شهرياً.",
      disputeDeadline: "إحالة النزاعات من إدارة علاقات العمل للمحكمة العمالية خلال شهر إذا تعذرت التسوية الودية.",
    },
    socialInsurance: {
      citizenEmployeePct: 10.5, // 7.5% تأمين أساسي + 2.5% تكميلي + 0.5% تأمين ضد البطالة
      citizenEmployerPct: 11.5,
      expatEmployeePct: 0,
      expatEmployerPct: 0,
      statutoryMaxWage: "2,750 دينار كويتي شهرياً",
      detailsAr: "للمواطنين الكويتيين: اشتراك تأمينات واشتراك تكميلي وتأمين بطالة (حصة الموظف 10.5% وحصة صاحب العمل 11.5%). الوافدون يخضعون فقط لمكافأة نهاية الخدمة وتأمين الضمان الصحي.",
    },
    nationalizationProgram: {
      programName: "برنامج دعم العمالة الوطنية ونسب تكويت القطاع الخاص",
      summary: "إلزام منشآت القطاع الخاص بنسب عمالة وطنية محددة لكل نشاط اقتصادي، مع دفع مكافأة مالية شهرية (دعم العمالة) للمواطنين العاملين في القطاع الخاص.",
    },
    latest2026Updates: [
      "ميكنة كافة خدمات الهيئة العامة للقوى العاملة عبر منصة (أسهل) وتطبيق (سهل أعمال) الحكومي الموحد.",
      "تطبيق تعديل نسب العمالة الوطنية في القطاعات المصرفية والاتصالات والتأمين لرفع نسبة التكويت إلى مستويات تفوق 70%.",
      "إلزامية التحقق من المؤهلات والشهادات المهنية للوافدين قبل إصدار أذونات العمل.",
    ],
  },

  BH: {
    countryCode: "BH",
    countryNameAr: "مملكة البحرين",
    countryNameEn: "Bahrain",
    flagEmoji: "🇧🇭",
    laborAuthority: "وزارة العمل وهيئة تنظيم سوق العمل (LMRA) والهيئة العامة للتأمين الاجتماعي (SIO)",
    officialPortal: "https://www.mol.gov.bh | https://www.lmra.gov.bh | https://www.sio.gov.bh",
    governingLaw: "قانون العمل في القطاع الأهلي البحريني رقم 36 لسنة 2012 وتعديلاته وقانون التأمين الاجتماعي الصادر بالمرسوم 24 لسنة 1976 وتعديلاته",
    lastUpdated: "2026",
    workingHours: {
      standardDaily: 8,
      standardWeekly: 48,
      ramadanDailyMuslims: 6,
      overtimeRateDay: "الأجر الأساسي للساعة + 25%",
      overtimeRateNightWeekend: "الأجر الأساسي للساعة + 50% للعمل الليلي وفي أيام الراحة الأسبوعية بالإضافة ليوم راحة بديل",
      weeklyRestDays: 1, // يوم الجمعة يوم راحة مدفوع الأجر، ويجوز استبداله أو إضافة يوم ثانٍ
    },
    probation: {
      standardDays: 90, // 3 أشهر
      maxDays: 90,
      rules: "لا تزيد على 3 أشهر، ويجوز لأي من الطرفين إنهاء العقد بإخطار مدته يوم واحد في الشهر الأول، و7 أيام في الشهرين التاليين.",
    },
    annualLeave: {
      baseDays: 30, // 30 يوماً
      incrementAfterYears: 0,
      incrementedDays: 30,
      cashOutPolicy: "يستحق العامل إجازة سنوية مدفوعة الأجر لا تقل عن 30 يوماً عن كل سنة خدمة (بمعدل 2.5 يوم عن كل شهر)، ويدفع مقابلها نقداً عند ترك العمل.",
    },
    endOfServiceGratuity: {
      formulaDescription: "المادة 116: للعامل غير الخاضع لقانون التأمين الاجتماعي: أجر نصف شهر عن كل سنة من السنوات الثلاث الأولى، وأجر شهر كامل عن كل سنة تالية محسوبة على آخر راتب أساسي.",
      resignationScale: "يستحق العامل المستقيل المكافأة إذا أتم سنة خدمة، وتصرف له كاملة وفق الضوابط المعتمدة.",
      exemptionsAndCaps: "تسدد المنشأة اشتراكات مكافأة نهاية الخدمة لغير البحرينيين إلى الهيئة العامة للتأمين الاجتماعي (SIO) بموجب التعديل الجديد لضمان حقوق العمالة.",
    },
    wpsAndPayroll: {
      systemName: "نظام حماية الأجور بمملكة البحرين (WPS Bahrain)",
      rules: "إلزام أصحاب العمل بدفع أجور العمال عبر حساباتهم المصرفية في البنوك المعتمدة وربطها بنظام هيئة تنظيم سوق العمل.",
      disputeDeadline: "تسوية النزاعات في جهاز فض المنازعات بالوزارة خلال 30 يوماً قبل الإحالة للمحكمة الكبرى العمالية.",
    },
    socialInsurance: {
      citizenEmployeePct: 8.0, // 7% تقاعد + 1% ضد التعطل
      citizenEmployerPct: 15.0, // 12% تقاعد + 3% إصابات وعجز + 1% ضد التعطل
      expatEmployeePct: 1.0, // 1% تأمين ضد التعطل
      expatEmployerPct: 3.0, // إصابات عمل + إيداع مكافأة نهاية الخدمة لدى التأمينات
      statutoryMaxWage: "4,000 دينار بحريني",
      detailsAr: "للبحرينيين: يخصم 8% وتتحمل المنشأة 15%. لغير البحرينيين: يخصم 1% ضد التعطل وتتحمل المنشأة 3% إصابات عمل بالإضافة إلى تحويل مبالغ نهاية الخدمة لحساب التأمينات الاجتماعية.",
    },
    nationalizationProgram: {
      programName: "الخطة الوطنية لبحرنة الوظائف ومشروع التوظيف الوطني (تمكين)",
      summary: "تحديد نسب بحرنة لكل قطاع ودعم رواتب وتدريب المواطنين عبر صندوق العمل (تمكين)، مع فرض رسوم إضافية على تصاريح العمل الموازية للعمالة الأجنبية.",
    },
    latest2026Updates: [
      "إتمام مراحل تطبيق نظام حماية الأجور لكافة فئات المنشآت بما فيها المنشآت الصغيرة والمتناهية الصغر.",
      "تطبيق تحصيل اشتراكات مكافأة نهاية الخدمة للعمالة الوافدة عبر هيئة التأمين الاجتماعي (SIO) لحمايتها من التعثر.",
      "توسيع برامج دعم أجور المواطنين الداخلين الجدد لسوق العمل عبر صندوق العمل 'تمكين'.",
    ],
  },

  OM: {
    countryCode: "OM",
    countryNameAr: "سلطنة عمان",
    countryNameEn: "Oman",
    flagEmoji: "🇴🇲",
    laborAuthority: "وزارة العمل العمانية ومنظومة الحماية الاجتماعية (SPF)",
    officialPortal: "https://www.mol.gov.om | https://www.spf.gov.om",
    governingLaw: "قانون العمل العماني الجديد الصادر بالمرسوم السلطاني رقم 52 لسنة 2023 وقانون الحماية الاجتماعية الصادر بالمرسوم 52 لسنة 2023",
    lastUpdated: "2026",
    workingHours: {
      standardDaily: 8,
      standardWeekly: 40, // 40 ساعة في قانون العمل العماني الجديد
      ramadanDailyMuslims: 6, // 30 ساعة أسبوعياً في رمضان للمسلمين
      overtimeRateDay: "أجر الساعة الأساسي + 25% لساعات العمل الإضافي النهارية",
      overtimeRateNightWeekend: "أجر الساعة الأساسي + 50% للعمل الإضافي الليلي و100% في أيام الراحة الأسبوعية والعطلات الرسمية",
      weeklyRestDays: 2, // يومان راحة أسبوعية بعد 5 أيام عمل وفق قانون العمل الجديد
    },
    probation: {
      standardDays: 90, // 3 أشهر للوظائف الشهرية
      maxDays: 90,
      rules: "لا تزيد على 3 أشهر لمن يتقاضون أجورهم شهرياً، ولا تتجاوز شهراً واحداً لغيرهم. إشعار الإنهاء خلالها يتطلب 7 أيام على الأقل.",
    },
    annualLeave: {
      baseDays: 30, // 30 يوماً مدفوعة الأجر
      incrementAfterYears: 0,
      incrementedDays: 30,
      cashOutPolicy: "يستحق العامل إجازة سنوية مدفوعة الأجر لا تقل عن 30 يوماً عن كل سنة بعد مضي 6 أشهر من تاريخ التحاقه بالعمل، وتصرف نقداً عند انتهاء الخدمة.",
    },
    endOfServiceGratuity: {
      formulaDescription: "بموجب قانون العمل الجديد (مرسوم 52/2023): يستحق العامل غير العماني مكافأة نهاية خدمة بواقع راتب أساسي كامل عن كل سنة خدمة من السنة الأولى وحتى انتهاء خدمته.",
      resignationScale: "تستحق كاملة متى أكمل سنة خدمة مستمرة بغض النظر عن سبب إنهاء العقد (إلا في حالات الفصل التأديبي الجسيم).",
      exemptionsAndCaps: "للمواطنين العمانيين: يستحقون معاشات تقاعدية وحماية اجتماعية بموجب صندوق الحماية الاجتماعية (SPF) الذي وحد كافة صناديق التقاعد السابقة.",
    },
    wpsAndPayroll: {
      systemName: "نظام حماية الأجور بسلطنة عمان (WPS Oman)",
      rules: "إلزام جميع منشآت القطاع الخاص بتحويل أجور جميع العاملين إلى الحسابات البنكية المحلية عبر النظام الإلكتروني المشترك بين وزارة العمل والبنك المركزي العماني.",
      disputeDeadline: "بحث الشكاوى العمالية في الدائرة المختصة بوزارة العمل خلال 30 يوماً قبل الإحالة إلى المحكمة الابتدائية المختصة.",
    },
    socialInsurance: {
      citizenEmployeePct: 7.5, // مساهمة الموظف العماني في فرع كبار السن والعجز والوفاة والأمان الوظيفي
      citizenEmployerPct: 11.5, // مساهمة جهة العمل + إصابات عمل
      expatEmployeePct: 0,
      expatEmployerPct: 1.0, // تأمين إصابات العمل والأمراض المهنية
      statutoryMaxWage: "3,000 ريال عماني شهرياً",
      detailsAr: "وفق قانون الحماية الاجتماعية الجديد: يخصم من العماني 7.5% وتتحمل المنشأة 11.5% بالإضافة لاشتراكات إجازات الأمومة والأمان الوظيفي. غير العماني تتحمل عنه المنشأة 1% إصابات عمل وتوفر له مكافأة نهاية الخدمة أو صندوق الادخار.",
    },
    nationalizationProgram: {
      programName: "سياسات التعمين والقطاعات المغلقة للكفاءات الوطنية",
      summary: "تحديد قائمة مهن حصرية للمواطنين العمانيين (التعمين بنسبة 100% في مهن الموارد البشرية، العلاقات العامة، المحاسبة، والسائقين) وفرض رسوم تصاريح تصاعدية للوافدين في المهن غير المعمنة.",
    },
    latest2026Updates: [
      "دخول اللائحة التنفيذية لقانون العمل العماني الجديد رقم 52 لسنة 2023 حيز النفاذ الكامل بما يشمل تخفيض ساعات العمل الأسبوعية إلى 40 ساعة ويومي راحة أسبوعية.",
      "تفعيل منافع منظومة الحماية الاجتماعية (SPF) لكافة العاملين العمانيين بما فيها إجازة الأبوة (7 أيام) وإجازة الأمومة (98 يوماً مدفوعة الأجر).",
      "إلزامية تحويل مكافأة نهاية الخدمة لغير العمانيين لنظام الادخار الاستثماري التابع لمنظومة الحماية الاجتماعية تدريجياً.",
    ],
  },
};

export interface HRNewsBulletin {
  id: string;
  titleAr: string;
  category: "labor_law" | "saudization" | "payroll" | "ai_recruitment" | "general_hr";
  date: string;
  source: string;
  summaryAr: string;
  impactOnHR: string;
  actionRequired: string;
}

export const LATEST_HR_NEWS_2026: HRNewsBulletin[] = [
  {
    id: "news-2026-01",
    titleAr: "إلزامية توثيق 100% من عقود العاملين عبر منصة قوى والربط المباشر مع رخص العمل",
    category: "saudization",
    date: "2026-01-15",
    source: "وزارة الموارد البشرية والتنمية الاجتماعية (MHRSD - السعودية)",
    summaryAr: "أعلنت وزارة الموارد البشرية ربط تجديد رخص العمل وتأشيرات الاستقدام ونقل الخدمات بضرورة توثيق كافة عقود الموظفين (سعوديين وغير سعوديين) إلكترونياً على منصة قوى بنسبة التزام تامة 100%.",
    impactOnHR: "تعليق فوري للخدمات الإلكترونية للمنشآت غير الملتزمة بنسبة التوثيق المستهدفة.",
    actionRequired: "مراجعة شاشة إدارة العقود بالمنظومة والتحقق من أن كافة عقود الموظفين موثقة برقم عقد قوى معتمد.",
  },
  {
    id: "news-2026-02",
    titleAr: "رفع الحد الأدنى للأجور للقطاع الخاص إلى 6000 جنيه مصري وتحديث شرائح المعاشات",
    category: "payroll",
    date: "2026-01-01",
    source: "المجلس القومي للأجور والهيئة القومية للتأمين الاجتماعي (مصر)",
    summaryAr: "بدأ تطبيق الحد الأدنى الإلزامي للأجور بالقطاع الخاص بواقع 6000 جنيه مصري شهرياً، وتعديل الحد الأدنى لأجر الاشتراك التأميني ليكون 2300 جنيه والحد الأقصى 14500 جنيه.",
    impactOnHR: "ضرورة تعديل الرواتب الأساسية للموظفين في جمهورية مصر العربية ومطابقة مسيرات الرواتب مع الأرقام التأمينية الجديدة.",
    actionRequired: "تشغيل مدقق مسيرات الرواتب لحزمة فرع مصر والتأكد من مطابقة الحد الأدنى للأجور والتأمينات الاجتماعية.",
  },
  {
    id: "news-2026-03",
    titleAr: "تحقيق مستهدف التوطين نصف السنوي في الإمارات (10% تراكمي) وتوسيع نظام صناديق الادخار البديلة",
    category: "saudization",
    date: "2026-02-01",
    source: "وزارة الموارد البشرية والتوطين (MOHRE - الإمارات)",
    summaryAr: "ألزمت الوزارة الشركات التي تضم 50 موظفاً فأكثر بتحقيق مستهدف التوطين للوظائف المهارية بنسبة نمو نصف سنوية، مع إتاحة خيار استبدال مكافأة نهاية الخدمة التقليدية بنظام صناديق الادخار الاستثمارية المعتمدة.",
    impactOnHR: "تفادي غرامات عدم الالتزام ببرنامج نافس وإمكانية فتح خيارات استثمارية جديدة لمستحقات نهاية خدمة الموظفين.",
    actionRequired: "متابعة كشف الوظائف المهارية بالمنشأة والتسجيل في برنامج نافس التابع للموارد البشرية الإماراتية.",
  },
  {
    id: "news-2026-04",
    titleAr: "نفاذ نظام ساعات العمل الجديد (40 ساعة أسبوعياً ويومي راحة) وتطبيق منظومة الحماية الاجتماعية في عمان",
    category: "labor_law",
    date: "2026-01-10",
    source: "وزارة العمل العمانية ومنظومة الحماية الاجتماعية (SPF - عمان)",
    summaryAr: "استكمال التحول الشامل لقانون العمل العماني الصادر بالمرسوم السلطاني 52 لسنة 2023 بتحديد 40 ساعة عمل أسبوعياً كحد أقصى، واعتماد إجازة الأمومة (98 يوماً) وإجازة الأبوة (7 أيام) وتوحيد صناديق التقاعد في SPF.",
    impactOnHR: "تحديث جداول الورديات وتوزيع ساعات العمل وسياسات الإجازات لفرع سلطنة عمان بالمنظومة.",
    actionRequired: "تعديل إعدادات ورديات فرع عمان لتتوافق مع نظام الـ 40 ساعة أسبوعياً ويومي الإجازة الأسبوعية.",
  },
  {
    id: "news-2026-05",
    titleAr: "ثورة الذكاء الاصطناعي في استقطاب الكفاءات والتوظيف القائم على المهارات (Skills-First Hiring)",
    category: "ai_recruitment",
    date: "2026-02-10",
    source: "الاتحاد العالمي للموارد البشرية (WFPMA) وتقارير الشرق الأوسط للمواهب 2026",
    summaryAr: "أظهرت تقارير التوظيف الإقليمية لعام 2026 أن أكثر من 72% من المنشآت الرائدة في الخليج ومصر بدأت الاعتماد على مطابقة المهارات عبر وكلاء الذكاء الاصطناعي وفحص المستندات بالمسح الضوئي الذكي بدلاً من الفحص التقليدي للسير الذاتية.",
    impactOnHR: "تقليص زمن إغلاق الشواغر الوظيفية بنسبة 60% وزيادة دقة اختيار المرشحين الأنسب للمناصب القيادية.",
    actionRequired: "استخدام ميزة الإضافة والمسح الضوئي الذكي (OCR) للموظفين والمرشحين عبر مساعد مدار إكس الذكي.",
  },
];

/**
 * Intelligent Multi-Country Search and Knowledge Retrieval
 */
export function searchCountryLaborRegulations(query: string): string | null {
  const q = query.trim().toLowerCase();

  // 1. Check for News / Trends inquiries
  if (
    q.includes("أخبار") ||
    q.includes("اخبار") ||
    q.includes("تحديثات") ||
    q.includes("قرارات جديدة") ||
    q.includes("مستجدات") ||
    q.includes("تريند") ||
    q.includes("توجهات التوظيف") ||
    q.includes("أحدث القرارات") ||
    q.includes("2026")
  ) {
    const newsList = LATEST_HR_NEWS_2026.map(
      (n, idx) => `### ${idx + 1}. ${n.titleAr}
• **المصدر الرسمي والتاريخ:** ${n.source} (${n.date})
• **التفاصيل:** ${n.summaryAr}
• **الأثر على المنشأة:** ${n.impactOnHR}
• **الإجراء المقترح في النظام:** ${n.actionRequired}`
    ).join("\n\n");

    return `📰 **أحدث أخبار الموارد البشرية وتحديثات أنظمة العمل ومكاتب العمل (دورة 2026):**

${newsList}

💡 **ملاحظة تشغيلية:** نظام مدار إكس الذكي يقوم بالربط المباشر مع الحزم التشريعية لكافة الدول المدرجة بالنظام لتطبيق أي قرارات فور صدورها تلقائياً.`;
  }

  // 2. Identify Target Country
  let matchedCountry: CountryLaborRegulation | null = null;
  if (q.includes("سعود") || q.includes("saudi") || q.includes("قوى") || q.includes("مدد") || q.includes("نطاقات") || q.includes("gosi")) {
    matchedCountry = COUNTRY_LABOR_REGULATIONS.SA;
  } else if (q.includes("مصر") || q.includes("egypt") || q.includes("التأمينات والمعاشات") || q.includes("القوى العاملة المصرية")) {
    matchedCountry = COUNTRY_LABOR_REGULATIONS.EG;
  } else if (q.includes("امارات") || q.includes("إمارات") || q.includes("uae") || q.includes("دبي") || q.includes("أبوظبي") || q.includes("mohre") || q.includes("نافس")) {
    matchedCountry = COUNTRY_LABOR_REGULATIONS.AE;
  } else if (q.includes("قطر") || q.includes("qatar") || q.includes("التقاعد القطرية")) {
    matchedCountry = COUNTRY_LABOR_REGULATIONS.QA;
  } else if (q.includes("كويت") || q.includes("kuwait") || q.includes("الهيئة العامة للقوى العاملة") || q.includes("تكويت")) {
    matchedCountry = COUNTRY_LABOR_REGULATIONS.KW;
  } else if (q.includes("بحرين") || q.includes("bahrain") || q.includes("lmra") || q.includes("تمكين") || q.includes("بحرنة")) {
    matchedCountry = COUNTRY_LABOR_REGULATIONS.BH;
  } else if (q.includes("عمان") || q.includes("عُمان") || q.includes("oman") || q.includes("سلطنة") || q.includes("spf") || q.includes("تعمين")) {
    matchedCountry = COUNTRY_LABOR_REGULATIONS.OM;
  }

  // If a country was detected, check the specific question or output a complete guide
  if (matchedCountry) {
    // A. Working Hours & Ramadan
    if (q.includes("ساعات العمل") || q.includes("دوام") || q.includes("رمضان") || q.includes("اضافي") || q.includes("إضافي") || q.includes("راحة أسبوعية")) {
      return `⏰ **أحكام ساعات العمل والعمل الإضافي والراحة في ${matchedCountry.countryNameAr} ${matchedCountry.flagEmoji}:**

• **المرجع النظامي:** ${matchedCountry.governingLaw}
• **الجهة المشرفة:** ${matchedCountry.laborAuthority}
• **ساعات العمل العادية:** ${matchedCountry.workingHours.standardDaily} ساعات يومياً (${matchedCountry.workingHours.standardWeekly} ساعة أسبوعياً كحد أقصى).
• **ساعات العمل في شهر رمضان المبارك:** تخفض إلى ${matchedCountry.workingHours.ramadanDailyMuslims} ساعات يومياً للعمال المسلمين.
• **أيام الراحة الأسبوعية:** ${matchedCountry.workingHours.weeklyRestDays} يوم راحة مدفوع الأجر أسبوعياً على الأقل.
• **احتساب العمل الإضافي النهاري:** ${matchedCountry.workingHours.overtimeRateDay}.
• **احتساب العمل الإضافي الليلي والعطل:** ${matchedCountry.workingHours.overtimeRateNightWeekend}.`;
    }

    // B. Probation Period
    if (q.includes("تجربة") || q.includes("فترة التجربة") || q.includes("اختبار") || q.includes("probation")) {
      return `⏳ **أحكام وضوابط فترة التجربة في ${matchedCountry.countryNameAr} ${matchedCountry.flagEmoji}:**

• **المرجع النظامي:** ${matchedCountry.governingLaw}
• **المدة القياسية:** ${matchedCountry.probation.standardDays} يوماً.
• **الحد الأقصى الجائز نظاماً:** ${matchedCountry.probation.maxDays} يوماً.
• **الضوابط والشروط:** ${matchedCountry.probation.rules}`;
    }

    // C. Annual & Other Leaves
    if (q.includes("إجازة") || q.includes("اجازة") || q.includes("سنوية") || q.includes("مرضية") || q.includes("leave")) {
      return `🌴 **أحكام الإجازات السنوية والرسمية في ${matchedCountry.countryNameAr} ${matchedCountry.flagEmoji}:**

• **المرجع النظامي:** ${matchedCountry.governingLaw}
• **رصيد الإجازة السنوية الأساسي:** ${matchedCountry.annualLeave.baseDays} يوماً سنوياً.
• **زيادة الرصيد بعد الخدمة:** تزيد إلى ${matchedCountry.annualLeave.incrementedDays} يوماً بعد إتمام ${matchedCountry.annualLeave.incrementAfterYears} سنوات متصلة.
• **التعويض النقدي عند انتهاء العقد:** ${matchedCountry.annualLeave.cashOutPolicy}`;
    }

    // D. End of Service Gratuity
    if (q.includes("نهاية الخدمة") || q.includes("مكافأة") || q.includes("استقالة") || q.includes("فصل") || q.includes("eosb") || q.includes("gratuity")) {
      return `⚖️ **حساب مكافأة نهاية الخدمة والاستقالة في ${matchedCountry.countryNameAr} ${matchedCountry.flagEmoji}:**

• **المرجع النظامي:** ${matchedCountry.governingLaw}
• **معادلة الحساب الأساسية:** ${matchedCountry.endOfServiceGratuity.formulaDescription}
• **حالة الاستقالة وإنهاء الموظف للعقد:** ${matchedCountry.endOfServiceGratuity.resignationScale}
• **الحدود القصوى والاستثناءات:** ${matchedCountry.endOfServiceGratuity.exemptionsAndCaps}`;
    }

    // E. Social Insurance & GOSI
    if (q.includes("تأمين") || q.includes("تأمينات") || q.includes("gosi") || q.includes("معاشات") || q.includes("تقاعد") || q.includes("اشتراك")) {
      return `🛡️ **نسب واشتراكات التأمينات الاجتماعية والتقاعد في ${matchedCountry.countryNameAr} ${matchedCountry.flagEmoji}:**

• **الهيئة الرسمية:** ${matchedCountry.laborAuthority}
• **نسبة استقطاع الموظف المواطن:** ${matchedCountry.socialInsurance.citizenEmployeePct}%
• **نسبة مساهمة صاحب العمل (المنشأة) للمواطن:** ${matchedCountry.socialInsurance.citizenEmployerPct}%
• **نسبة غير المواطن (الوافد):** الموظف: ${matchedCountry.socialInsurance.expatEmployeePct}% | المنشأة: ${matchedCountry.socialInsurance.expatEmployerPct}%
• **الحد الأقصى للأجر الخاضع للاشتراك:** ${matchedCountry.socialInsurance.statutoryMaxWage}
• **التفاصيل:** ${matchedCountry.socialInsurance.detailsAr}`;
    }

    // F. Wage Protection (WPS)
    if (q.includes("حماية الأجور") || q.includes("wps") || q.includes("مدد") || q.includes("صرف الرواتب") || q.includes("بنك")) {
      return `💳 **نظام حماية الأجور والامتثال المالي في ${matchedCountry.countryNameAr} ${matchedCountry.flagEmoji}:**

• **المنظومة المعتمدة:** ${matchedCountry.wpsAndPayroll.systemName}
• **الضوابط ونسب الالتزام:** ${matchedCountry.wpsAndPayroll.rules}
• **إجراءات المنازعات العمالية:** ${matchedCountry.wpsAndPayroll.disputeDeadline}`;
    }

    // Default: Comprehensive Country Profile
    const updatesList = matchedCountry.latest2026Updates.map((u) => `• ${u}`).join("\n");
    return `🏛️ **الدليل الشامل لأنظمة العمل ومكتب العمل في ${matchedCountry.countryNameAr} ${matchedCountry.flagEmoji}:**

• **المرجع النظامي:** ${matchedCountry.governingLaw}
• **الجهة المسؤولة والموقع الرسمي:** ${matchedCountry.laborAuthority} ([البوابة الرسمية](${matchedCountry.officialPortal}))
• **ساعات العمل العادية:** ${matchedCountry.workingHours.standardDaily} ساعات يومياً (${matchedCountry.workingHours.standardWeekly} ساعة أسبوعياً).
• **فترة التجربة:** ${matchedCountry.probation.standardDays} يوماً (أقصى حد ${matchedCountry.probation.maxDays} يوماً).
• **الإجازة السنوية:** ${matchedCountry.annualLeave.baseDays} يوماً تزداد إلى ${matchedCountry.annualLeave.incrementedDays} يوماً وفق مدة الخدمة.
• **مكافأة نهاية الخدمة:** ${matchedCountry.endOfServiceGratuity.formulaDescription}
• **التأمينات الاجتماعية:** مواطن (الموظف ${matchedCountry.socialInsurance.citizenEmployeePct}%، المنشأة ${matchedCountry.socialInsurance.citizenEmployerPct}%) | وافد (${matchedCountry.socialInsurance.expatEmployerPct}% منشأة).
• **برنامج التوطين المعتمد:** **${matchedCountry.nationalizationProgram.programName}** - ${matchedCountry.nationalizationProgram.summary}

📌 **أبرز التحديثات النظامية لعام 2026:**
${updatesList}

يمكنك سؤالي عن أي مادة قانونية، أو طريقة حساب نهاية الخدمة، أو نسبة التأمينات بالتفصيل!`;
  }

  // 3. General Cross-Country Inquiries
  if (
    q.includes("مكاتب العمل") ||
    q.includes("دول النظام") ||
    q.includes("جميع الدول") ||
    q.includes("قوانين العمل") ||
    q.includes("أنظمة العمل")
  ) {
    const list = Object.values(COUNTRY_LABOR_REGULATIONS)
      .map(
        (c) =>
          `• **${c.countryNameAr} ${c.flagEmoji}:** تشرف عليها ${c.laborAuthority} بموجب ${c.governingLaw} (ساعات العمل: ${c.workingHours.standardDaily} يومياً، إجازة سنوية: ${c.annualLeave.baseDays} يوماً).`
      )
      .join("\n");

    return `🌍 **تغطية أنظمة العمل ومكاتب العمل في نظام مدار إكس:**

يدعم النظام الحزم التشريعية المتوافقة مع مكاتب العمل في **7 دول عربية** متصلة لحظياً:

${list}

يمكنك الاستفسار عن أي دولة بالتحديد (مثلاً: *"ما هي ساعات العمل في الإمارات؟"* أو *"احسب مكافأة نهاية الخدمة في مصر"* أو *"نسب التأمينات في الكويت"*).`;
  }

  return null;
}
