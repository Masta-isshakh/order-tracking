# Fontain OS — Final Product Blueprint (معتمد مبدئيًا)

## A. System Map

خط واحد يمشي عليه كل عميل، وحوله ثمانية أشياء بدور واحد لكل منها:

- **Client Workspace**: الملف الذي يحتوي كل شيء عن العميل.
- **Decision Inbox**: برج المراقبة. كل ما يحتاج إنسانًا يظهر هنا فقط.
- **ActivityLog**: الذاكرة. كل خطوة تكتب سطرًا، ولا يُمسح.
- **AI Suggestions**: المستشار. يقرأ ويقترح ولا يلمس.
- **Finance**: من قبول العرض إلى الربح.
- **Client Portal**: نافذة العميل على جزئه فقط.
- **App Factory**: القسم التقني داخل Project.
- **GitHub + Claude Code**: خارج النظام، ينفذان الكود.

```
                    ┌──────────── DECISION INBOX ────────────┐
                    └──▲──────▲──────▲──────▲──────▲──────▲──┘
LEAD ─► QUALIFICATION ─► PROPOSAL ─► CLIENT ─► PROJECT ─► TASKS ─► DELIVERY ─► PAYMENT ─► RENEWAL
  │                       │           └────────────── CLIENT WORKSPACE ──────────────────┘
  │                       ├──► CLIENT PORTAL (عرض، حالة، اعتمادات، فواتير)
  │                       └──► FINANCE: Proposal → Invoices → Payments → Expenses → Profit → Renewals
  └── AI SUGGESTIONS يقرأ الكل ويكتب Suggestion فقط ──► Inbox
  └── كل انتقال ──► ACTIVITY LOG
PROJECT (تقني) ── App Factory fields داخل النظام ── GitHub repo خارج النظام
```

**التحكم بتكلفة الـAI:** كل استدعاء يحمل `featureKey` ويكتب `AiUsage`. `Organization.aiMonthlyLimit` اختياري. عند بلوغه: `paused`، تتوقف الاقتراحات فقط. المفتاح في AWS، تقرأه الـLambda فقط.

## B. Role Map

| القدرة | OWNER | MANAGER | STAFF | CLIENT |
|---|---|---|---|---|
| Decision Inbox | كامل | كامل عدا المالية | عناصره فقط | لا |
| Leads | كل شيء | كل شيء | المُسندة له + إنشاء | لا |
| Clients / Workspace | كل شيء | كل شيء | عملاء مشاريعه، قراءة + تفاعلات | لا |
| Projects / Tasks | كل شيء | كل شيء | مهامه + قراءة مشروعه | لا |
| مراجعة المهام | نعم | نعم | إذا سُمّي مراجعًا | لا |
| Proposals | إنشاء + اعتماد + إرسال | نفسه | مسودة فقط | قبول / طلب تعديل |
| Finance | كل شيء | قراءة + تسجيل دفعات ومصاريف | لا يرى المبالغ | فواتيره |
| Settings كتالوج/Playbooks | نعم | نعم | لا | لا |
| Settings فريق/أدوار | نعم | لا | لا | لا |
| Settings AI (سقف/استهلاك) | نعم | قراءة | لا | لا |
| حذف | نعم | لا | لا | لا |

## C. Screen Map (14 شاشة)

```
LOGIN → OWNER/MANAGER → /app/inbox | STAFF → /app/tasks | CLIENT → /portal
```
القائمة الجانبية: Inbox · Leads · Clients · My Tasks · Finance · Settings.

الفريق: Decision Inbox، Leads Board، Lead Detail، Proposal Builder، Clients، Client Workspace (نظرة عامة/مشاريع/تفاعلات/ملفات/مالية/سجل)، Project Detail (+App Factory)، Task Detail (لوحة جانبية)، My Tasks، Finance (فواتير/دفعات/مصاريف/تجديدات)، Settings.
العميل: مشروعي، الاعتمادات، الملفات والفواتير.

## D. Automation Map

| حدث إنسان | النظام تلقائيًا |
|---|---|
| إنشاء Lead | followUpAt = +24h، ActivityLog، (Sprint 5) Suggestion رد أول → Inbox |
| مرور موعد المتابعة | تنبيه محسوب + بطاقة حمراء |
| طلب اعتماد عرض | DecisionItem للمالك |
| اعتماد العرض | portalToken، Lead → PROPOSAL_SENT |
| **العميل يقبل العرض** | **Client + Project + مهام من Playbook + Invoices حسب الجدول + ActivityLog + Inbox: NEW_CLIENT** |
| العميل يطلب تعديل العرض | DecisionItem CLIENT_CHANGE_REQUEST |
| تسجيل دفعة | إعادة حساب الفاتورة، المشروع "مموّل" عند الأولى |
| مهمة → Review | DecisionItem TASK_REVIEW للمراجع |
| اعتماد مهمة "مراجعة العميل" | Approval في البوابة بالرابط |
| العميل يعتمد التسليم | إغلاق Approval، الفاتورة الثانية مستحقة |
| العميل يطلب تعديل التسليم | مهمة تعديل + DecisionItem |
| إغلاق مشروع | Renewals بعد سنة، حساب الربح، (Sprint 5) اقتراح ما بعد التسليم |
| 30 يومًا على تجديد | DecisionItem RENEWAL_DUE |
| فاتورة متأخرة / عميل بلا تفاعل 48h | تنبيه محسوب |
| بلوغ سقف AI | إيقاف الاقتراحات فقط |

لا يُؤتمت أبدًا: إرسال للعميل، تغيير سعر، تسجيل دفعة، حذف.

## E. Human vs AI

| Action | Human | Claude | Approval? |
|---|---|---|---|
| قراءة البيانات | نعم | قراءة فقط | لا |
| مسودة رد أول | يعدّل ويرسل | يقترح | نعم |
| ملخص عميل | يقرأ | يلخّص | لا (معلوماتي) |
| مسودة عرض | يراجع | يقترح البنود | نعم |
| إرسال العرض | هو فقط | لا | نعم |
| السعر / الخصم | نعم | لا يقترح خصمًا | نعم |
| إنشاء المهام | Playbook | لا | لا |
| اعتماد مراجعة / DecisionItem | نعم | **مستحيل بالصلاحيات** | — |
| أي كتابة خارج Suggestion | نعم | **مستحيل بالصلاحيات** | — |

## F. V1 Final Boundary

**محذوف من V1:** PDF للعروض (العرض صفحة في البوابة)، AppProduct ككيان (حقول في Project)، Snooze، Suggestion "مهام مقترحة"، File على Client، Renewal يولّد فواتير تلقائيًا، تعدد جهات الاتصال.

**يبقى:** Leads، Interactions، Clients، Projects، Playbooks، Tasks+مراجعة، Catalog، Proposals عبر البوابة، Invoices/Payments/Expenses، Renewals مبسطة، Decision Inbox، ActivityLog، 3 أنواع Suggestion + AiUsage + سقف، Client Portal، عربي/إنجليزي.

## G. Sprint Order (أسبوعان لكل Sprint)

| Sprint | المحتوى | ما يصبح ممكنًا |
|---|---|---|
| 0 Foundation | المستودع، Amplify skeleton، Organization/UserProfile، OTP، Next.js، i18n/RTL، CI، حماية main، نمط Mutation+ActivityLog، نشر | الدخول بالهاتف |
| 1 Leads | Leads، Interactions، Board، Detail، متابعات، سبب الخسارة | إدارة كل الـleads |
| 2 Work | Clients، Workspace، Projects، Playbooks، Tasks، Comments، Files، My Tasks، مراجعة، Decision Inbox v1 | إدارة مشروع كامل |
| 3 Sell | Catalog، Proposal Builder، Portal، أتمتة القبول | أول عميل يقبل من رابط |
| 4 Money | Invoices، Payments، Expenses، Renewals، Finance، مالية المشروع | من دفع ومن عليه وكم ربحنا |
| 5 AI | Suggestion، Lambda الـAI، Secrets، AiUsage/سقف، 3 أنواع، Inbox | الاقتراحات |
| 6 Harden | تفعيل MANAGER/STAFF/CLIENT فعليًا، سكربتات اختبار، seed، أمن، إطلاق | استخدام يومي |

## H. Day in the Life (ملخص)

9:00 Owner يفتح Inbox: 5 عناصر. 9:20 يعتمد رد AI ويرسله من واتساب ويسجل تفاعلًا. 10:30 lead جديد يُضاف من الهاتف. 11:00 شريك يعمل من My Tasks وينقل مهمة إلى Review. 13:00 اعتماد المهمة يفتح Approval للعميل. 15:30 العميل يطلب تعديلًا من البوابة → مهمة تعديل. 16:00 تعديل واعتماد → الفاتورة الثانية مستحقة. 17:30 عرض جديد بمسودة AI يُعتمد ويُرسل. 18:00 Finance: مستحق لنا، متوقع الشهر، ربح المشروع.
