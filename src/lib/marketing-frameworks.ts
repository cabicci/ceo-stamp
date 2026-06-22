/**
 * Marketing Science Knowledge Layer — single source of truth for framework IDs,
 * definitions, and prompt-ready rendering. Server-safe; import from client for labels only.
 */

import type { Locale } from "@/i18n/I18nProvider";

export type MarketingFramework = {
  id: string;
  name_ar: string;
  name_en: string;
  /** Exact string for framework_applied in generated content. */
  applied_label: string;
  core_principle: string;
  when_to_use: string;
  how_to_apply: string;
  do: string[];
  dont: string[];
  example_hook_ar: string;
};

export const MARKETING_FRAMEWORKS: Record<string, MarketingFramework> = {
  // ---------------------------------------------------------------------------
  // Cialdini — 6 principles (each usable independently)
  // ---------------------------------------------------------------------------
  cialdini_reciprocity: {
    id: "cialdini_reciprocity",
    name_ar: "سيالديني — المعاملة بالمثل",
    name_en: "Cialdini — Reciprocity",
    applied_label: "Cialdini — Reciprocity",
    core_principle:
      "الناس بتحس إنها مطالبة برد الجميل لما تاخد حاجة أولاً. القيمة المجانية أو اللطف بيفتح باب الالتزام.",
    when_to_use:
      "جذب عملاء محتملين، بناء ثقة أولية، MOFU، عروض lead magnet، محتوى تعليمي مجاني قبل طلب البيع.",
    how_to_apply:
      "ابدأ بقيمة حقيقية (نصيحة، checklist، عينة، استشارة قصيرة) من غير ما تطلب حاجة فوراً. بعد ما العميل يستفيد، اربط العرض بخطوة بسيطة: «لو عجبتك النصيحة دي، جرّب…». خلي الهدية محددة ومفيدة مش عامة.",
    do: [
      "قدّم قيمة ملموسة قبل أي طلب",
      "حدد إيه اللي العميل هياخده بالظبط",
      "اربط المجاني بالخطوة الجاية بشكل طبيعي",
    ],
    dont: [
      "متقولش «مجاني» وانت بتطلب بيانات كتير من الأول",
      "متستخدمش وعود فاضية من غير محتوى حقيقي",
      "متخليش الهدية أضعف من المنتج اللي بتبيعه",
    ],
    example_hook_ar: "خد دليل الـ ٥ أخطاء اللي بتهدر فلوسك في الإعلانات — من غير ما تسجل.",
  },
  cialdini_scarcity: {
    id: "cialdini_scarcity",
    name_ar: "سيالديني — الندرة",
    name_en: "Cialdini — Scarcity",
    applied_label: "Cialdini — Scarcity",
    core_principle:
      "الحاجة اللي نادرة أو بتخلص بسرعة بتبان أغلى وأهم. الكمية أو الوقت المحدود بيحفّز القرار.",
    when_to_use:
      "عروض محدودة، BOFU، Most Aware، حملات مبيعات، إطلاق منتج، Black Friday، آخر قطعة في المخزون.",
    how_to_apply:
      "حدد رقم أو تاريخ واضح: كمية، مقاعد، أو مهلة (٤٨ ساعة، لحد الجمعة). اذكر السبب لو أمكن (إنتاج محدود، طلب عالي). حط الندرة في الهوك أو الـ CTA مش بس في آخر السطر.",
    do: [
      "استخدم أرقام محددة (٣٠ مقعد، ٤٨ ساعة)",
      "اربط الندرة بفايدة حقيقية للعميل",
      "خلّي المهلة حقيقية ومتكررش نفس العرض كل أسبوع",
    ],
    dont: [
      "متستخدمش «آخر فرصة» كل يوم — بيضيع المصداقية",
      "متخترعش ندرة وهمية",
      "متنساش توضح إيه اللي هيضيع لو ما اشتريش",
    ],
    example_hook_ar: "فاضل ١٢ كود خصم بس — والعرض بينتهي الخميس الساعة ١٢ بالليل.",
  },
  cialdini_authority: {
    id: "cialdini_authority",
    name_ar: "سيالديني — السلطة",
    name_en: "Cialdini — Authority",
    applied_label: "Cialdini — Authority",
    core_principle:
      "الناس بتميل تصدق وتتبع اللي عنده خبرة، شهادات، أو دليل إنجاز واضح.",
    when_to_use:
      "تأسيس سلطة، B2B، LinkedIn، محتوى تعليمي، أول مرة يتعرف العميل على البراند، MOFU.",
    how_to_apply:
      "اذكر خبرة محددة: سنوات، عدد عملاء، شهادة، جائزة، أو نتيجة رقمية. خلي البراند «الخبير» اللي بيشرح مش بيستعرض. استخدم أرقام ونتائج قبل الوعود.",
    do: [
      "استشهد بإنجاز واحد ملموس على الأقل",
      "ورّي الخبرة من خلال نصيحة عملية مش سيرة ذاتية طويلة",
      "اربط السلطة بمشكلة العميل",
    ],
    dont: [
      "متبالغش في الألقاب من غير دليل",
      "متستخدمش لغة فخمة من غير محتوى",
      "متنساش إن السلطة لازم تخدم العميل مش العكس",
    ],
    example_hook_ar: "بعد ما ساعدنا ٢٠٠ براند مصري يضاعفوا الـ ROAS — ده اللي اتعلمناه عن الإعلانات.",
  },
  cialdini_commitment_consistency: {
    id: "cialdini_commitment_consistency",
    name_ar: "سيالديني — الالتزام والاتساق",
    name_en: "Cialdini — Commitment & Consistency",
    applied_label: "Cialdini — Commitment & Consistency",
    core_principle:
      "بعد ما الشخص يلتزم بخطوة صغيرة، بيحب يفضل متسق مع قراره ويكمل لخطوات أكبر.",
    when_to_use:
      "تسلسل حملات، onboarding، عروض محدودة بعد تفاعل سابق، MOFU → BOFU، retargeting.",
    how_to_apply:
      "ابدأ بخطوة صغيرة (لايك، تسجيل، تحميل، إجابة سؤال). ارجع للالتزام السابق في النص: «انت اختارت كذا، الخطوة الجاية…». قسّم الرحلة لخطوات متسقة مع هوية العميل.",
    do: [
      "اذكر فعل سابق للعميل لو بتعمل retargeting",
      "اقترح خطوة صغيرة قبل الشراء",
      "خلّي كل بوست يكمل اللي قبله",
    ],
    dont: [
      "متطلبش شراء من أول تفاعل",
      "متناقضش رسالة بوست سابق في نفس الحملة",
      "متستخدمش ضغط من غير بناء خطوات",
    ],
    example_hook_ar: "سجّلت في الورشة المجانية؟ كمل الرحلة وخد خصم الـ VIP للي اشترك النهارده.",
  },
  cialdini_social_proof: {
    id: "cialdini_social_proof",
    name_ar: "سيالديني — الإثبات الاجتماعي",
    name_en: "Cialdini — Social Proof",
    applied_label: "Cialdini — Social Proof",
    core_principle:
      "الناس بتحكم باللي زيهم بيعملوه. التقييمات، الأرقام، وقصص العملاء بتقلل الخوف من القرار.",
    when_to_use:
      "كل مراحل القمع، خصوصاً MOFU و BOFU، إعلانات conversion، منتجات جديدة محتاجة ثقة.",
    how_to_apply:
      "حط رقم أو اقتباس عميل حقيقي في أول ٢ سطر. حدد نوع الجمهور في الإثبات: «٣٠٠ صاحب مطعم في القاهرة». استخدم UGC أو screenshot تقييم لو المنصة مناسبة.",
    do: [
      "استخدم أرقام محددة (٤.٨/٥، +١٠٠٠ عميل)",
      "اختار إثبات قريب من persona العميل",
      "اربط الإثبات بنتيجة ملموسة",
    ],
    dont: [
      "متستخدمش «الكل بيحبه» من غير دليل",
      "متزوّرش تقييمات",
      "متكدسش شهادات طويلة في بوست قصير",
    ],
    example_hook_ar: "«الطلبات زادت ٤٠٪ في أول شهر» — كده قال صاحب كافيه في المعادي بعد ما جرّب المنصة.",
  },
  cialdini_liking: {
    id: "cialdini_liking",
    name_ar: "سيالديني — الإعجاب",
    name_en: "Cialdini — Liking",
    applied_label: "Cialdini — Liking",
    core_principle:
      "بنقول آه للناس اللي بنحبها، بنشوف نفسنا فيها، أو بنحس إنها زينا. التشابه والود بيفتحوا الباب للإقناع.",
    when_to_use:
      "بناء علاقة، TOFU، محتوى lifestyle، founders story، مجتمعات محلية، محتوى تفاعلي.",
    how_to_apply:
      "تكلم بلهجة الجمهور واذكر موقف يومي يعرفوه. ورّي وجه بشري (فريق، عميل، مؤسس). استخدم «احنا» و«انت» مش لغة مؤسسية باردة.",
    do: [
      "شارك قصة شخصية قصيرة",
      "استخدم لغة الجمهور المستهدف حرفياً",
      "اظهر قيم مشتركة (عيلة، شغل، طموح)",
    ],
    dont: [
      "متتظاهرش بإنك حاجة مش انت",
      "متستخدمش فكاهة مش مناسبة للبراند",
      "متنساش إن الإعجاب بييجي من الصدق",
    ],
    example_hook_ar: "لو انت صاحب مشروع وبتصحى ٦ الصبح عشان الشغل — احنا فاهمينك وعايزين نسهّلك اليوم.",
  },

  // ---------------------------------------------------------------------------
  // Eugene Schwartz — 5 awareness stages
  // ---------------------------------------------------------------------------
  schwartz_unaware: {
    id: "schwartz_unaware",
    name_ar: "شوارتز — غير واعٍ بالمشكلة",
    name_en: "Eugene Schwartz — Unaware",
    applied_label: "Eugene Schwartz — Unaware",
    core_principle:
      "الجمهور مش عارف عنده مشكلة أصلاً. لازم تلفت نظره لموقف يومي قبل ما تتكلم عن الحل.",
    when_to_use: "TOFU، جمهور جديد، فئات سوق نائمة، منتجات مبتكرة، أول بوستات في حملة إطلاق.",
    how_to_apply:
      "ابدأ بسؤال أو مشهد حياتي: «بتعمل كذا كل يوم؟». ماتذكرش المنتج في أول سطر. ركّز على الألم الخفي أو الفرصة الضايعة من غير ما تسمّي الحل.",
    do: [
      "استخدم سيناريو يومي مألوف",
      "اسأل سؤال يخلي القارئ يقف ويفكر",
      "أجّل ذكر البراند لآخر البوست أو للبوست الجاي",
    ],
    dont: [
      "متفتحش باسم المنتج أو العرض",
      "متفترضش إن العميل عارف المشكلة",
      "متستخدمش مصطلحات تقنية من الأول",
    ],
    example_hook_ar: "بتقعد ساعة كل يوم ترد على نفس أسئلة العملاء على الواتس؟ في حاجة غلط في الصورة دي.",
  },
  schwartz_problem_aware: {
    id: "schwartz_problem_aware",
    name_ar: "شوارتز — واعٍ بالمشكلة",
    name_en: "Eugene Schwartz — Problem Aware",
    applied_label: "Eugene Schwartz — Problem Aware",
    core_principle:
      "العميل عارف إن عنده مشكلة بس مش عارف الحلول المتاحة. دورك توضّح حجم المشكلة وتبني أمل.",
    when_to_use: "TOFU → MOFU، محتوى تعليمي عن الألم، حملات توعية قبل إطلاق منتج.",
    how_to_apply:
      "سمّي المشكلة بوضوح وبالعامية. اشرح تبعاتها (فلوس، وقت، توتر). لسه ماتبيعش الحل — بس ورّي إن في مخرج موجود.",
    do: [
      "استخدم لغة ألم العميل حرفياً",
      "اذكر ٢-٣ تبعات ملموسة للمشكلة",
      "اخلق أمل من غير وعود مبالغ فيها",
    ],
    dont: [
      "متقفش عند الشكوى من غير اتجاه",
      "متقارنش بمنافسين بالاسم بدري",
      "متخليش البوست كله نظري",
    ],
    example_hook_ar: "الإعلانات بتحرق فلوسك ومش راجعة مبيعات؟ المشكلة مش الإعلان — المشكلة في الرسالة.",
  },
  schwartz_solution_aware: {
    id: "schwartz_solution_aware",
    name_ar: "شوارتز — واعٍ بالحل",
    name_en: "Eugene Schwartz — Solution Aware",
    applied_label: "Eugene Schwartz — Solution Aware",
    core_principle:
      "العميل عارف إن في حلول للمشكلة بس مش عارف إن براندك هو الأنسب. لازم تميّز نوع الحل.",
    when_to_use: "MOFU، مقارنة منهجية، محتوى «ليه الطريقة دي»، إطلاق منتج في سوق فيه بدائل.",
    how_to_apply:
      "اشرح نوع الحل (مش بس منتجك): automation، استشارة، اشتراك. قدم معيار اختيار واضح. بعدين اربط البراند كأفضل تنفيذ للمعيار ده.",
    do: [
      "عرّف فئة الحل قبل البراند",
      "قدّم ٣ معايير اختيار عملية",
      "استخدم USP لتمييز التنفيذ",
    ],
    dont: [
      "متتهمش المنافسين مباشرة",
      "متتكلمش عن مميزات من غير سياق مشكلة",
      "متستخدمش jargon من غير شرح",
    ],
    example_hook_ar: "فيه ٣ طرق لإدارة حملاتك: يدوي، وكالة، أو أتمتة. ده الفرق الحقيقي بينهم.",
  },
  schwartz_product_aware: {
    id: "schwartz_product_aware",
    name_ar: "شوارتز — واعٍ بالمنتج",
    name_en: "Eugene Schwartz — Product Aware",
    applied_label: "Eugene Schwartz — Product Aware",
    core_principle:
      "العميل عارف منتجك بس لسه متردد. محتاج يقنع ليه انت مش البديل، وإيه اللي هيحصل لو اشترى.",
    when_to_use: "MOFU → BOFU، retargeting، demo، trial، مقارنة مع بدائل، بوستات قبل الشراء.",
    how_to_apply:
      "ركّز على USP واحد قوي + دليل (رقم، testimonial، ضمان). اذكر اعتراض شائع ورد عليه. CTA واضح لخطوة تجريب أو شراء.",
    do: [
      "اختر USP واحد للبوست مش كل المميزات",
      "اعالج اعتراض واحد بوضوح",
      "حط CTA محدد (جرّب، احجز، اطلب)",
    ],
    dont: [
      "متعيدش intro عام عن البراند",
      "متكدسش ١٠ مميزات",
      "متنساش سبب التردد الحقيقي",
    ],
    example_hook_ar: "عارفين منصتنا — بس لسه متأكد؟ جرّب ١٤ يوم مجاناً وشوف الفرق في أول أسبوع.",
  },
  schwartz_most_aware: {
    id: "schwartz_most_aware",
    name_ar: "شوارتز — واعٍ تماماً",
    name_en: "Eugene Schwartz — Most Aware",
    applied_label: "Eugene Schwartz — Most Aware",
    core_principle:
      "العميل جاهز يشتري — محتاج دفعة أخيرة: عرض، مهلة، أو تذكير بالقيمة. مفيش وقت شرح طويل.",
    when_to_use: "BOFU، عروض محدودة، last chance، عملاء حاليين، إعلانات conversion مباشرة.",
    how_to_apply:
      "هوك = العرض أو المهلة. جملة واحدة قيمة + CTA قوي. قصّر النص — كل كلمة لازم تدفع للفعل.",
    do: [
      "ابدأ بالعرض أو المهلة",
      "استخدم CTA فعل واحد واضح",
      "كرّر القيمة في جملة واحدة بس",
    ],
    dont: [
      "متشرحش المنتج من الصفر",
      "متطوّلش — ده جمهور جاهز",
      "متخليش الـ CTA غامض",
    ],
    example_hook_ar: "خصم ٣٠٪ لآخر ٢٤ ساعة — الكود جاهز، اضغط واطلب.",
  },

  // ---------------------------------------------------------------------------
  // Byron Sharp
  // ---------------------------------------------------------------------------
  sharp_mental_availability: {
    id: "sharp_mental_availability",
    name_ar: "بايرون شارب — التوفر الذهني",
    name_en: "Byron Sharp — Mental Availability",
    applied_label: "Byron Sharp — Mental Availability",
    core_principle:
      "البراند اللي بييجي في بال العميل أول ما يفكر في الفئة بيكسب. الهدف تكرار بسيط ومتسق مش إقناع معقد.",
    when_to_use: "حملات توعية، TOFU، بناء حضور طويل المدى، إعلانات reach، تكرار رسالة واحدة.",
    how_to_apply:
      "اختر رسالة واحدة بسيطة وكررها بصيغ مختلفة. اربط البراند بموقف شراء («لما تحتاج X، فكر في…»). ركّز على الوصول والتكرار مش argument طويل.",
    do: [
      "كرّر نفس الفكرة الأساسية على قنوات مختلفة",
      "اربط البراند بفئة وموقف واضح",
      "استخدم جمل قصيرة سهلة التذكر",
    ],
    dont: [
      "متغيّرش الرسالة الأساسية كل بوست",
      "متفرطش في USPs في حملة awareness",
      "متقيسش النجاح بـ CTR بس على TOFU",
    ],
    example_hook_ar: "لما تفكر تعمل حملة جديدة — فكر فينا الأول. بسيطة كده.",
  },
  sharp_distinctive_assets: {
    id: "sharp_distinctive_assets",
    name_ar: "بايرون شارب — أصول البراند المميزة",
    name_en: "Byron Sharp — Distinctive Brand Assets",
    applied_label: "Byron Sharp — Distinctive Brand Assets",
    core_principle:
      "الألوان، الشكل، الصوت، والرموز الثابتة بتخلي البراند يتعرف عليه من غير ما يقرأ الاسم.",
    when_to_use: "توعية بالبراند، visual campaigns، TOFU، محتوى فيديو وصور، حملات متعددة القنوات.",
    how_to_apply:
      "حط في media_brief عنصر بصري/صوتي مميز للبراند (لون، شكل، jingle، mascot). اذكر الأصول في النص بشكل طبيعي. حافظ على نفس tone و visual language.",
    do: [
      "ارجع لألوان وشخصية البراند في كل بوست",
      "وصف بصري متسق في media_brief",
      "استخدم عبارات أو تصاميم متكررة",
    ],
    dont: [
      "متقلّدش ستايل منافس",
      "متغيّرش الهوية البصرية كل أسبوع",
      "متنساش الأصول في الفيديو والصورة",
    ],
    example_hook_ar: "نفس اللون، نفس الطاقة — لو شوفت الأخضر ده، تعرف إننا جينا.",
  },
  sharp_reach_over_persuasion: {
    id: "sharp_reach_over_persuasion",
    name_ar: "بايرون شارب — الوصول أهم من الإقناع",
    name_en: "Byron Sharp — Reach Over Persuasion",
    applied_label: "Byron Sharp — Reach Over Persuasion",
    core_principle:
      "خفض الاحتكاك ووصول أكبر ناس بسيط أفضل من إقناع عميق لعدد قليل — خصوصاً في awareness.",
    when_to_use: "حملات reach، TOFU، فيديوهات قصيرة، إعلانات broad targeting، بناء قاعدة جمهور.",
    how_to_apply:
      "بسّط الرسالة لجملة واحدة. قلّل الـ friction في CTA (تابع، شوف، اعرف). اختار formats سهلة المشاركة. متطلبش commitment كبير من أول لمسة.",
    do: [
      "اختصر النسخ لأقصى حد",
      "استخدم CTA منخفض الالتزام",
      "صمّم للمشاركة والتكرار",
    ],
    dont: [
      "متكتبش sales page في بوست awareness",
      "متستهدفش conversion بس على جمهور بارد",
      "متعقّدش الرسالة بمميزات كتير",
    ],
    example_hook_ar: "براند مصري بي simplify التسويق — تابعنا وشوف إزاي.",
  },

  // ---------------------------------------------------------------------------
  // StoryBrand, AIDA, PAS
  // ---------------------------------------------------------------------------
  storybrand: {
    id: "storybrand",
    name_ar: "ستوري براند — البطل والمرشد",
    name_en: "StoryBrand",
    applied_label: "StoryBrand",
    core_principle:
      "العميل هو البطل والبراند هو المرشد اللي بيقدّم خطة واضحة ودعوة لفعل محدد.",
    when_to_use:
      "إطلاق منتج، حملات قصة، landing narratives، MOFU، أي محتوى محتاج هيكل قصة واضح.",
    how_to_apply:
      "① العميل عنده مشكلة/طموح ② البراند يفهم ويقدّم خطة بسيطة (٣ خطوات) ③ CTA واحد واضح. متخليش البراند هو بطل القصة.",
    do: [
      "ابدأ بمشكلة أو رغبة العميل",
      "قدّم البراند كمرشد بخطة عملية",
      "اختم بـ CTA واحد محدد",
    ],
    dont: [
      "متتكلمش عن البراند أكتر من العميل",
      "متسيبش القارئ من غير خطوة تالية",
      "متعقّدش الخطة — ٣ خطوات كفاية",
    ],
    example_hook_ar: "عايز تضاعف مبيعاتك أونلاين؟ احنا مرّينا بنفس الطريق — وده نظام الـ ٣ خطوات اللي هيساعدك.",
  },
  aida: {
    id: "aida",
    name_ar: "AIDA — انتباه واهتمام ورغبة وفعل",
    name_en: "AIDA",
    applied_label: "AIDA",
    core_principle:
      "مسار كلاسيكي: لفت انتباه → بناء اهتمام → إثارة رغبة → دعوة لفعل.",
    when_to_use: "إعلانات، بوستات conversion، lead gen، MOFU، copy قصير ومتسلسل.",
    how_to_apply:
      "السطر ١: هوك يوقف التمرير. ٢-٣: فايدة أو حقيقة مثيرة. ٤: رغبة (نتيجة حياتية). ٥: CTA. اتبع الترتيب حتى لو مختصر.",
    do: [
      "هوك قوي في أول ٥ كلمات",
      "اربط الميزة بنتيجة عاطفية",
      "اختم بـ CTA فعل محدد",
    ],
    dont: [
      "متبدأش بـ CTA من غير بناء",
      "متخلطش الترتيب في نسخ طويل من غير عناوين",
      "متنساش مرحلة الرغبة",
    ],
    example_hook_ar: "تخيل توفر ٥ ساعات أسبوعياً؟ المنصة دي بتعمل كده لأصحاب المشاريع — جرّبها النهارده.",
  },
  pas: {
    id: "pas",
    name_ar: "PAS — مشكلة وتهييج وحل",
    name_en: "PAS",
    applied_label: "PAS",
    core_principle:
      "حدّد المشكلة، عمّق الألم (agitate)، قدّم الحل. فعّال لما العميل حاسس بالألم فعلاً.",
    when_to_use: "lead gen، MOFU، خدمات B2B، حلول لمشاكل واضحة، إعلانات pain-point.",
    how_to_apply:
      "P: سمّي المشكلة بجملة. A: اشرح تبعاتها (فلوس ضايعة، وقت، فرص ضايعة) — ٢-٣ جمل. S: قدّم الحل كمخرج مباشر + CTA.",
    do: [
      "استخدم لغة ألم حقيقية من personas",
      "عمّق الألم بأرقام أو مواقف",
      "قدّم الحل كإغلاق للألم مش كقائمة مميزات",
    ],
    dont: [
      "متبالغش في dramatize من غير مصداقية",
      "متقدّمش الحل قبل ما توضح المشكلة",
      "متنساش CTA بعد الحل",
    ],
    example_hook_ar: "بتضيع فلوس على إعلانات مش راجعة؟ كل يوم من غير نظام بيكلفك عملاء. الحل: خطة محتوى مربوطة بالمبيعات.",
  },
};

export const ALL_FRAMEWORK_IDS = Object.keys(MARKETING_FRAMEWORKS);

/** Shown in UI when a package has no fixed frameworks (e.g. quick_post). */
export const FRAMEWORK_DYNAMIC_LABEL_AR = "يتحدد حسب الهدف";

/**
 * Returns full framework entries for the given ids (unknown ids are skipped).
 */
export function getFrameworkKnowledge(ids: string[]): MarketingFramework[] {
  return ids
    .map((id) => MARKETING_FRAMEWORKS[id])
    .filter((f): f is MarketingFramework => f != null);
}

/**
 * Compact prompt block: core_principle + how_to_apply + do/dont only.
 * Keeps token cost low for selective injection.
 */
export function renderFrameworkKnowledgeForPrompt(ids: string[]): string {
  const entries = getFrameworkKnowledge(ids);
  if (entries.length === 0) return "";

  const blocks = entries.map((f) => {
    const dos = f.do.map((d) => `  • ${d}`).join("\n");
    const donts = f.dont.map((d) => `  • ${d}`).join("\n");
    return `### ${f.applied_label} (${f.id})
المبدأ: ${f.core_principle}
التطبيق: ${f.how_to_apply}
افعل:
${dos}
تجنب:
${donts}`;
  });

  return `## معرفة الأطر التسويقية (طبّقها حرفياً في النسخ — مش مجرد ذكر الاسم)
${blocks.join("\n\n")}`;
}

/** Display name for UI badges; falls back to id. */
export function getFrameworkDisplayName(id: string, locale: Locale = "ar"): string {
  const f = MARKETING_FRAMEWORKS[id];
  if (!f) return id;
  return locale === "en" ? f.name_en : f.name_ar;
}

/** Comma-separated labels for UI; empty packages show dynamic label. */
export function formatFrameworksDisplay(frameworkIds: string[], locale: Locale = "ar"): string {
  if (frameworkIds.length === 0) {
    return locale === "en" ? "Set by objective" : FRAMEWORK_DYNAMIC_LABEL_AR;
  }
  const sep = locale === "en" ? ", " : "، ";
  return frameworkIds.map((id) => getFrameworkDisplayName(id, locale)).join(sep);
}

/** Labels for framework_applied field in generated content. */
export function getFrameworkAppliedLabel(id: string): string {
  return MARKETING_FRAMEWORKS[id]?.applied_label ?? id;
}

/** Filter to known ids, preserving order. */
export function resolveFrameworkIds(ids: string[]): string[] {
  return ids.filter((id) => id in MARKETING_FRAMEWORKS);
}

/** Compact vocabulary list for strategist system prompts. */
export function getFrameworkVocabularyForPrompt(): string {
  return ALL_FRAMEWORK_IDS.map(
    (id) => `- ${id}: ${MARKETING_FRAMEWORKS[id].name_ar} (${MARKETING_FRAMEWORKS[id].applied_label})`,
  ).join("\n");
}
