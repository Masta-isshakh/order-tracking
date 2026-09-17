# Sprint 0 — Foundation (النسخة النهائية بعد FOS-000)

الافتراض التقني: Tailwind CSS (خصائص منطقية تجعل RTL/LTR شبه مجاني).

| ID | الاسم | المسؤول | يعتمد على | مكتمل عندما |
|---|---|---|---|---|
| **FOS-000** | Repository Bootstrap (الاستثناء الوحيد لقاعدة مهمة/فرع/PR) | Claude Code + Dev A | إنشاء المستودع يدويًا | Next.js + TS strict + ESLint + Prettier + Tailwind، هيكل المجلدات، `.gitignore`، `README.md`، `AGENTS.md` (بقاعدة DECISION REQUIRED)، `CONTRIBUTING.md`، `docs/` (القرارات، Blueprint، sprint-0، sprint-1)، CI أساسي (typecheck/lint/build)، قالب PR، `CODEOWNERS`. أخضر ومدموج |
| FOS-001 | Shared enums & types | Dev A | 000 | `shared/enums.ts` كامل + اختبار اكتمال الترجمة |
| FOS-002 | i18n foundation | Dev B | 000 | `en.ts`/`ar.ts` مُطبَّع، `useT()`، cookie، `lang`/`dir` على `<html>`، اختبار المفاتيح، تبديل بلا إعادة تحميل |
| FOS-003 | App shell | Dev B | 002 | تخطيط `/app` (6 عناصر) و`/portal` و`/login` هياكل، RTL/LTR، 400px |
| FOS-004 | Amplify backend skeleton | Dev A | 001 | `backend.ts` + Organization + UserProfile + storage فارغ، sandbox ينشر، outputs مستثنى من Git |
| FOS-005 | Cognito phone OTP | Dev A | 004 | نقل auth/ والمحفزات وotp/ من Stars بالنسخ، نفس الضمانات، `test-auth-flow.mjs` ينجح |
| FOS-006 | Groups, org attribute & seed | Dev A | 005 | المجموعات الأربع، `custom:organizationId`، `seed-org.mjs`، `seed-owner.mjs` |
| FOS-007 | Custom mutation pattern & ActivityLog | Dev A | 004 | ActivityLog بلا كتابة مباشرة، `logActivity()`، `appsync.ts`، `updateOrganization` تكتب سجلًا |
| FOS-008 | Frontend auth & role routing | Dev B | 003, 005 | دخول، جلسة، middleware يوجّه حسب المجموعة، خروج |
| FOS-009 | Backend check & integration scripts | Dev A | 006, 007 | `check-backend.mjs`، `test-data-flows.mjs` بحالة updateOrganization، ينظفان |
| FOS-010 | Amplify Hosting production | OWNER (Console) + Dev A (`amplify.yml`) | 008, 009 | main = إنتاج بدور خدمة، env من Console، seed مرة بجلسة SSO مؤقتة، check-backend ينجح على الإنتاج |
| FOS-011 | Sprint 0 acceptance | الشركاء الثلاثة | 010 | 3 دخولات من الهواتف بالعربية والإنجليزية، ActivityLog يسجل من الإنتاج |

**التوازي بعد FOS-000:**
```
Dev A:  001 → 004 → 005 → 006 → 007 → 009 ─┐
Dev B:  002 → 003 ──────────► 008 (بعد 005) ─┼─► 010 (OWNER) → 011
```
A لا يلمس `app/` و`src/`. B لا يلمس `amplify/` و`shared/`.
