# Fontain OS — Implementation Plan (معتمد مبدئيًا)

## 1. Team Split
- **Dev A (Backend):** يملك `amplify/`، `scripts/`، `shared/`. Sprint 0: 001، 004، 005، 006، 007، 009، وملف `amplify.yml` في 010. Sprint 1: نماذج Lead/Interaction، الـMutations الثمانية، الفهارس، اختبار التكامل، تطبيع الهاتف في `shared/`.
- **Dev B (Frontend):** يملك `app/`، `src/`. Sprint 0: 002، 003، 008. Sprint 1: Board، Card، Detail، الجدول الزمني، نموذج التفاعل، نافذة الإغلاق، الفلاتر والبحث.
- **عقد Sprint 1 أولًا:** يوم 1 يكتب A توقيعات الـMutations في `shared/contracts/leads.ts` ويدمجها، وB يبدأ على بيانات وهمية بنفس الأنواع.
- **Claude Code مع A:** "لا تلمس app/ و src/". **مع B:** "لا تلمس amplify/ و shared/". `docs/` و`AGENTS.md` يعدّلهما شخص واحد لكل PR. كل جلسة من فرع جديد من main محدّث، وتنتهي بـPR واحد.

## 2. Repository Structure
```
fontain-os/
├── app/                 # مسارات Next.js فقط، رفيعة: (auth)/login، app/…، portal/…، layout.tsx
├── src/
│   ├── features/        # leads/ clients/ tasks/ finance/ inbox/ portal/ → components/ hooks/ api.ts i18n.ts
│   ├── components/      # ui/ (Button, Input, Dialog, Badge, Drawer) · layout/ (Sidebar, Topbar, PageHeader)
│   ├── lib/             # amplify client، auth session، helpers
│   └── i18n/            # en.ts, ar.ts, provider, useT
├── amplify/
│   ├── backend.ts · auth/ · data/ (resource.ts + models/) · storage/
│   ├── functions/       # leads/ work/ sales/ finance/ decisions/ user-manager/
│   └── shared/          # appsync.ts, cognito.ts, activity.ts, otp/, phone.ts
├── shared/              # enums.ts · contracts/ · validators/  (يُستورد من الطرفين)
├── scripts/             # check-backend.mjs, seed-*.mjs, test-*.mjs, logs.mjs
├── tests/               # vitest بنفس هيكل src/ و shared/
├── docs/                # DECISIONS.md, blueprint.md, sprints/
├── .github/             # workflows/ci.yml, pull_request_template.md, CODEOWNERS
├── AGENTS.md · README.md · CONTRIBUTING.md
```
السبب: `app/` رفيع و`features/` سمين يمنع التعارض؛ `shared/` محايد كعقد بين الطرفين؛ Lambda لكل مجموعة لا لكل mutation؛ `scripts/` بفلسفة Stars؛ مواصفات الـSprints بجانب الكود.

## 3. Environments
| البيئة | ما هي | من/متى | لا يكسر |
|---|---|---|---|
| Local | `next dev` + sandbox المطور | كل مطور دائمًا | شيئًا خارج جهازه |
| Developer sandbox | `ampx sandbox --identifier dev-x`، خلفية كاملة باسمه | كل مطور، تُعاد بحرية | sandbox الآخر والإنتاج |
| Pull Request | CI: typecheck، lint، unit، `next build`. لا نشر خلفية للـPR في V1 | تلقائي | لا يلمس بيئة |
| Production | Amplify Hosting على `main` بخلفيته ودور خدمة | عند الدمج فقط | لا يصل أحد إلا عبر PR |

الحماية: لا access keys للإنتاج على أي جهاز (D-53)؛ المطورون IAM Identity Center بصلاحية sandbox، والأفضل حساب AWS منفصل للـsandboxes؛ جداول الإنتاج بحماية حذف + PITR؛ schema إضافي فقط.

## 4. Secrets & Config
| العنصر | التصنيف | أين |
|---|---|---|
| مفتاح Claude API | Secret | Amplify `secret('ANTHROPIC_API_KEY')` (SSM مشفّر) أو Secrets Manager عبر SDK؛ تقرأه الـLambda فقط |
| Twilio/SNS | Secret | نفس الآلية |
| بيانات AWS | Secret | جلسات SSO قصيرة على جهاز المطور، ليست في المشروع |
| `amplify_outputs.json` | Config مولَّد | لا يُرفع لـGit؛ Amplify Hosting يولّده للإنتاج |
| المنطقة، افتراضيات المؤسسة | Config | `backend.ts` وسجل Organization |
| أعلام الميزات | Config | حقول Organization من Settings |
| `NEXT_PUBLIC_*` | Config عام | `.env.local` محليًا، Console للإنتاج. **لا سر فيها أبدًا** |

## 5. Test Strategy
- **تلقائي (CI):** typecheck، lint، وحدة للمنطق النقي (الهاتف، متأخر، الانتقالات، اكتمال ar/en، حسابات المال)، `next build`.
- **يدوي قبل PR:** سكربت تكامل الميزة على sandbox ومخرجاته في الـPR؛ جولة عربي ثم إنجليزي على عرض الجوال.
- **قبل الدمج:** CI أخضر، موافقة مراجع، مخرجات التكامل، DoD مؤشرة.
- **بعد النشر:** Amplify build أخضر، `check-backend.mjs` على الإنتاج، دخول Owner من الهاتف.
- **لا نبني:** E2E بالمتصفح، تغطية مستهدفة، snapshots.

## 6. Git Workflow (مثال FOS-101 Create Lead)
1. المهمة في `docs/sprints/sprint-1.md` ببند قبول.
2. `git checkout main && git pull && git checkout -b feature/FOS-101-create-lead`
3. Claude Code: "نفّذ FOS-101 حسب المواصفة… لا تلمس app/ و src/."
4. المطور يقرأ الفرق كاملًا، يشغّل sandbox والسكربت، يصلح.
5. `git commit -m "FOS-101: add Lead model and createLead mutation"` ثم push.
6. PR بقالب المستودع. CI تلقائيًا.
7. المطور الآخر (أو Owner) يراجع.
8. CI أخضر + موافقة → Squash merge، حذف الفرع.
9. Amplify ينشر main؛ `check-backend.mjs` على الإنتاج؛ المهمة "منشور".
قواعد: فرع لكل مهمة، PR لكل فرع، لا PR يتجاوز مهمة، لا دمج ذاتي.

## 7. Definition of Done
1. بند القبول يعمل على sandbox. 2. عربي RTL وإنجليزي LTR بلا نقص. 3. 400px بلا تمرير أفقي. 4. ActivityLog وDecisionItem حيث تنص المواصفة. 5. الصلاحيات في الخادم واختُبر الرفض. 6. لا سر ولا ملف مولَّد. 7. CI أخضر. 8. سكربت تكامل موجود ونجح ومخرجاته في الـPR. 9. مراجع وافق، دُمج بـsquash. 10. المواصفة/DECISIONS محدّثة إن لزم.

## 8. Rollback
- **أ. واجهة/Lambda:** Amplify Console → Redeploy آخر نشرة مستقرة (دقيقتان) → `git revert` لcommit الدمج عبر PR → المهمة تعود مفتوحة.
- **ب. schema:** آمن لأن التغييرات إضافية؛ revert كما أعلاه؛ لا حذف حقول.
- **ج. بيانات:** DynamoDB PITR إلى جدول جديد → نسخ المتضرر فقط → ActivityLog يحدد من فعل ماذا.
- الوقاية: الميزة الخطرة خلف علم في Organization مطفأ.

## 9. AGENTS.md — قاعدة DECISION REQUIRED (نص معتمد)
```
## DECISION REQUIRED
أثناء أي مهمة، إذا احتجت إلى: تغيير معماري، Model جديد غير موجود في المواصفة،
مكتبة أو اعتمادية رئيسية جديدة، تغيير قرار في docs/DECISIONS.md، أو توسيع نطاق المهمة،
فتوقف فورًا ولا تنفذ. اطبع:

DECISION REQUIRED
السبب: ...
الخيارات: 1) ... 2) ... 3) ...
توصيتي: ...

ثم انتظر اعتماد إنسان. لا تكمل المهمة بافتراض الخيار الأرجح.
```
