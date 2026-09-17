# Fontain OS — سجل القرارات

آخر تحديث: 2026-09-17

## المنتج
- D-01 الاسم أثناء التطوير: **Fontain OS** (ليس Branding نهائيًا).
- D-02 يُبنى لاستخدام Fontain Digital Solutions أولًا. لا SaaS الآن.
- D-03 كل البيانات تحت `Organization` واحدة مُهيأة مسبقًا (seed). لا إعدادات لكل مؤسسة، لا تبديل، لا فوترة. الباب مفتوح لتعدد المؤسسات لاحقًا بدون إعادة كتابة.
- D-04 Client Workspace هو مصدر الحقيقة الوحيد لكل عميل.
- D-05 Decision Inbox هو الصفحة الرئيسية للإدارة.
- D-06 **AI suggests, Human approves.** الـAI يكتب في `Suggestion` فقط ولا يعتمد أي `DecisionItem`. مفروض بالصلاحيات في الخادم.
- D-07 V1 يجب أن يكون مفيدًا من أول Lead ويُستخدم يوميًا.
- D-08 App Factory: Fontain OS يدير دورة حياة المشروع التقني فقط (قالب، مستودع، مرحلة، روابط، حالة بناء، اعتماد). GitHub + Claude Code + المطورون ينفذون الكود. لا IDE، لا تخزين كود. حقول App Factory جزء من `Project` لا كيان مستقل.

## الفريق والصلاحيات
- D-10 الفريق الحالي 3 شركاء، الثلاثة `OWNER`.
- D-11 الأدوار في البنية: `OWNER / MANAGER / STAFF / CLIENT`. لا صلاحيات على مستوى الحقول في V1.
- D-12 مراجعة المهام: Reviewer اختياري على المهمة، وإلا منشئ المهمة، وأي OWNER يستطيع المراجعة.
- D-13 لا `hourlyRate`، لا Time Tracker، لا `actualHours` في V1. ربح المشروع = الدفعات المستلمة − مصاريف المشروع.

## التقنية
- D-20 الواجهة: Next.js App Router واحد بمنطقتين `/app` (الفريق) و`/portal` (العميل). Tailwind CSS. لا تطبيق جوال في V1.
- D-21 الخلفية: Amplify Gen 2 + Cognito + AppSync + DynamoDB + S3 + Lambda، بنفس أنماط مشروع Stars.
- D-22 الهوية: دخول بالهاتف وOTP للفريق والعملاء (منقول من Stars بالنسخ). خاصية `custom:organizationId` على المستخدم.
- D-23 كل تغيير حالة مهم يمر عبر Custom Mutation (Lambda) تكتب التغيير + `ActivityLog` + `DecisionItem` في خطوة واحدة. لا تحديث مباشر للحالات من الواجهة.
- D-24 عربي + إنجليزي + RTL/LTR من اليوم الأول. نمط `en.ts`/`ar.ts` المُطبَّع.
- D-25 العملة QAR فقط. لا ضرائب في V1 (حقل ضريبة فارغ في البنية).
- D-26 AWS Region: البقاء على `ap-south-1` (تم التحقق: Amplify Hosting SSR لـNext.js متاح فيها، وكل الخدمات المطلوبة). لا نقل بلا سبب تقني.
- D-27 الاستضافة: Amplify Hosting. إعادة تقييم Vercel فقط عند سبب تقني حقيقي.
- D-28 مستودع مستقل `fontain-os`. يُستفاد من Stars بالنسخ (OTP، i18n، RTL، utilities) لا بالربط.
- D-29 مفتاح Claude API مملوك لـFontain، مخزّن في AWS (آلية Amplify `secret()` / SSM أو Secrets Manager)، لا على أي جهاز. تتبع الاستهلاك بـ`AiUsage` لكل ميزة، سقف شهري اختياري من إعدادات OWNER، وعند بلوغه تتوقف الاقتراحات فقط.
- D-30 الإشعارات في V1 داخل النظام فقط: Decision Inbox، My Tasks، شارات. لا بريد ولا واتساب.
- D-31 لا Migration في V1. قاعدة بيانات نظيفة.
- D-32 تغييرات الـschema **إضافية فقط**: لا حذف ولا إعادة تسمية حقل في نفس الإصدار.

## النطاق
- D-40 داخل V1: Leads، Interactions، Clients، Projects (+App Factory fields)، Playbooks، Tasks مع مراجعة، Comments، Attachments، Approvals، Service Catalog، Proposals عبر البوابة، Invoices، Payments، Expenses، Renewals المبسطة، Decision Inbox، Suggestions (3 أنواع)، AiUsage، ActivityLog، Client Portal.
- D-41 خارج V1: WhatsApp Cloud API، Google/Meta Ads، Time tracking، Workload، تكامل GitHub Webhooks، محاسبة كاملة، تطبيق جوال، PDF للعروض، Snooze، مهام مقترحة من AI، ملفات على مستوى Client، تعدد جهات اتصال للعميل، تجديد يولّد فواتير تلقائيًا.
- D-42 جدول الدفع الافتراضي 50% عند البدء و50% قبل الإطلاق، قابل للتعديل لكل عرض.
- D-43 الـAI في Sprint 5 وليس في البداية. النظام يجب أن يكون مفيدًا بالكامل بدون AI.

## سير العمل
- D-50 `main` محمي: PR إجباري + مراجع واحد + CI أخضر. لا دفع مباشر. Squash merge فقط.
- D-51 **One Task → One Branch → One PR.** الاستثناء الوحيد: `FOS-000 Repository Bootstrap`.
- D-52 لكل مطور sandbox خاص. `main` وحده يُنشر للإنتاج عبر Amplify Console بدور خدمة.
- D-53 **لا access keys للإنتاج على أي جهاز**، حتى OWNER. المطورون صلاحيات sandbox فقط. الإنتاج عبر Amplify service role، وأي عمل يدوي على الإنتاج بجلسة SSO قصيرة العمر من IAM Identity Center. توصية: حساب AWS منفصل للـsandboxes.
- D-54 Claude Code يعمل على فروع الميزات فقط. تسمية: `feature/FOS-<id>-<slug>`.
- D-55 قاعدة **DECISION REQUIRED** في `AGENTS.md`: عند الحاجة لتغيير معماري، أو Model غير موجود في المواصفة، أو مكتبة رئيسية جديدة، أو تغيير قرار في DECISIONS.md، أو توسيع النطاق: يتوقف Claude Code ويطبع `DECISION REQUIRED` بالسبب والخيارات والتوصية، ولا ينفذ حتى يعتمد إنسان.

## افتراضات معتمدة ضمنيًا (قابلة للتغيير بكلفة دقائق)
- مراحل الـLead: `NEW → CONTACTED → QUALIFIED → PROPOSAL_SENT → WON / LOST`.
- حالات المهمة: `NEW → ASSIGNED → IN_PROGRESS → WAITING → REVIEW → APPROVED → DONE`.
- فئات المصاريف: `DOMAIN, HOSTING, CONTRACTOR, ADS, OTHER`.
- تكرار الهاتف في Leads يحذّر ولا يمنع.
- عميل واحد = رقم هاتف واحد للبوابة.
