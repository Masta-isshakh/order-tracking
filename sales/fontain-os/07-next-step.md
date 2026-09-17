# ابدأ من هنا — الخطوة التالية

## الحالة
التخطيط مكتمل ومعتمد مبدئيًا. **لم يبدأ أي تنفيذ.** لا يوجد مستودع `fontain-os` بعد.

## ما يُفعل يدويًا في GitHub قبل الأمر (5 دقائق)
1. إنشاء مستودع **خاص فارغ** `Masta-isshakh/fontain-os`: بدون README، بدون `.gitignore`، بدون License (حتى يكون `main` فارغًا ويُنشأ كل شيء في PR واحد).
2. منح Claude الوصول إليه: claude.ai → Settings → Connectors → GitHub → اختيار المستودع.
3. إضافة المطورَين كـCollaborators بصلاحية Write.

## الأمر الأول (يُرسل حرفيًا)
```
ابدأ التنفيذ. نفّذ FOS-000 Repository Bootstrap في مستودع Masta-isshakh/fontain-os
على فرع feature/FOS-000-repository-bootstrap وافتح PR إلى main. لا تنشر أي خلفية.
```

## ما سيحدث عند تنفيذه، ولا شيء غيره
1. إضافة المستودع للجلسة واستنساخه.
2. فرع `feature/FOS-000-repository-bootstrap` من `main`.
3. Next.js App Router + TS strict + ESLint + Prettier + Tailwind، صفحة `/` تعرض "Fontain OS".
4. هيكل المجلدات المعتمد مع README قصير في كل مجلد.
5. `.gitignore`: `.env*`، `amplify_outputs.json`، `.amplify/`، `node_modules`، `.next`.
6. `README.md`، `AGENTS.md` (بقاعدة DECISION REQUIRED)، `CONTRIBUTING.md`.
7. `docs/DECISIONS.md`، `docs/blueprint.md`، `docs/sprints/sprint-0.md`، `sprint-1.md` منسوخة من هذا المجلد.
8. `.github/workflows/ci.yml` (typecheck، lint، build)، `pull_request_template.md`، `CODEOWNERS`.
9. تشغيل typecheck/lint/build محليًا والتأكد أنها خضراء.
10. push، فتح PR، إعطاء الرابط، والتوقف.

**لن يحدث:** لا `amplify/`، لا `shared/enums.ts` (FOS-001)، لا i18n (FOS-002)، لا Cognito، لا نشر، لا أسرار، لا لمس لـ`order-tracking`.

## بعد دمج PR الخاص بـFOS-000 (ليس قبله)
4. Settings → Branches → قاعدة على `main`: Require PR، approvals = 1، Require status checks (`ci`)، Do not allow bypassing، Restrict deletions، Block force pushes.
5. Settings → General → Pull Requests: Squash merging فقط، Automatically delete head branches.

## خارج GitHub (شرط لـFOS-004 فما بعد، ليس للأمر الأول)
IAM Identity Center بصلاحية sandbox للمطورَين، وقرار الحساب المنفصل للإنتاج.

## الأمر الثاني (بعد دمج FOS-000)
FOS-001 وFOS-004 لـDev A، وFOS-002 وFOS-003 لـDev B، بالتوازي، كل مهمة على فرعها.
