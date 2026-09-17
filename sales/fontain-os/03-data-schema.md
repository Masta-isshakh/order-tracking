# Fontain OS — Data Schema, Enums, Routes, Mutations (معتمد مبدئيًا)

كل كيان يحمل `organizationId` إجباريًا مع فهرس ثانوي. لن يُكرر أدناه.

## 1. الكيانات

### الجذر
| الكيان | الحقول الأهم | يرتبط بـ | يُنشأ |
|---|---|---|---|
| Organization | name, phone, defaultPaymentSchedule, aiMonthlyLimit, aiEnabledFeatures | الكل | seed مرة واحدة |
| UserProfile | cognitoSub, name, phone, role, isActive, clientId | Organization, Client | يدويًا / تلقائيًا للعميل |

### المبيعات
| الكيان | الحقول الأهم | يرتبط بـ | يُنشأ |
|---|---|---|---|
| Lead | businessName, contactName, phone(E.164), category, source, sourceRef, stage, ownerId, followUpAt, lostReason, lostNote, notes, clientId | UserProfile, Client | يدويًا |
| Interaction | leadId أو clientId, channel, direction, summary, occurredAt, createdById, externalId | Lead أو Client | يدويًا (WhatsApp API لاحقًا) |
| Client | businessName, contactName, phone, category, status, leadId, portalUserId | Lead, UserProfile, Projects | تلقائيًا عند قبول العرض / يدويًا |

### التنفيذ
| الكيان | الحقول الأهم | يرتبط بـ | يُنشأ |
|---|---|---|---|
| Project | clientId, name, status, ownerId, playbookId, proposalId, startedAt, deliveredAt, closedAt, **App Factory:** productType, templateKey, repoUrl, appStage, previewUrl, productionUrl, buildStatus | Client, Playbook, Proposal, Tasks | تلقائيًا / يدويًا |
| Playbook | name, productType, description, isActive | PlaybookSteps | Settings |
| PlaybookStep | playbookId, order, title, description, estimatedDays, requiresClientApproval, defaultRole | Playbook | Settings |
| Task | projectId, title, description, status, priority, ownerId, reviewerId, createdById, dueAt, order, playbookStepId, requiresClientApproval | Project, UserProfile | من Playbook / يدويًا |
| Comment | taskId, authorId, body | Task | يدويًا |
| Attachment | projectId أو taskId, s3Key, fileName, mimeType, size, uploadedById | Project أو Task | يدويًا |
| Approval | projectId, type(PROPOSAL/DELIVERABLE), refId, status, previewUrl, clientNote, decidedAt | Project, Proposal/Task | تلقائيًا |

### المال
| الكيان | الحقول الأهم | يرتبط بـ | يُنشأ |
|---|---|---|---|
| Service | name(ar/en), description(ar/en), basePrice, isActive, defaultPlaybookId | Playbook | Settings |
| Proposal | leadId أو clientId, status, title, language, items(json), total, paymentSchedule(json), validUntil, portalToken, createdById, approvedById, sentAt, acceptedAt | Lead/Client, Services, Project | يدويًا |
| Invoice | clientId, projectId, proposalId, number, amount, dueAt, status, issuedAt, description | Client, Project, Proposal, Payments | تلقائيًا من القبول / يدويًا |
| Payment | invoiceId, amount, paidAt, method, reference, recordedById | Invoice | يدويًا |
| Expense | projectId, category, amount, description, paidAt, recordedById | Project | يدويًا |
| Renewal | clientId, projectId, type, provider, ourCost, clientPrice, renewsAt, status | Client, Project | عند إغلاق المشروع / يدويًا |

### التشغيل والذكاء
| الكيان | الحقول الأهم | يرتبط بـ | يُنشأ |
|---|---|---|---|
| DecisionItem | type, title, refType, refId, requestedById, assigneeId, status, decidedById, decidedAt, rejectReason | أي كيان | تلقائيًا فقط |
| Suggestion | type, refType, refId, content, featureKey, status, decisionItemId, usageId | أي كيان | الـAI فقط |
| AiUsage | featureKey, requestedById, inputTokens, outputTokens, estimatedCost, occurredAt, month | Suggestion | تلقائيًا |
| ActivityLog | refType, refId, action, actorId(أو SYSTEM/AI), summary, meta(json), occurredAt | أي كيان | تلقائيًا، لا تعديل ولا حذف |

### العلاقات
```
Lead ──(1:1 بعد الفوز)──► Client ──(1:N)──► Project ──(1:N)──► Task ──(1:N)──► Comment
Project/Task ──(1:N)──► Attachment      Project ──(1:N)──► Approval ──► Proposal أو Task
Playbook ──(1:N)──► PlaybookStep ──(نسخة)──► Task
Lead/Client ──(1:N)──► Proposal ──(1:N)──► Invoice ──(1:N)──► Payment
Proposal ──(1:1 بعد القبول)──► Project      Project ──(1:N)──► Expense      Client ──(1:N)──► Renewal
Suggestion ──(1:1)──► DecisionItem      Suggestion ──(1:1)──► AiUsage
ActivityLog / DecisionItem ──(refType+refId)──► أي كيان
```
مشتق لا يُخزن: مدفوع الفاتورة، "متأخر"، تقدم المشروع، ربح المشروع، مستحق لنا، متوقع الشهر.

## 2. الشكل التقني لـAmplify Gen 2
- كل model: `organizationId: a.string().required()` + secondary index.
- الصلاحيات: `allow.groups(['OWNER','MANAGER','STAFF'])` للفريق، `allow.group('CLIENT')` قراءة على ما يخص البوابة. الـLambdas: `allow.resource(fn)` مرة واحدة على مستوى الـschema.
- الحقول المركبة `a.json()` تُكتب عبر `toJsonField()` وتُقرأ بـ`parseJsonArray()` (قاعدة AWSJSON من Stars).
- الـEnums بـ`a.enum` في ملف مشترك واحد.
- `a.belongsTo`/`a.hasMany` للعلاقات الثابتة. `refType + refId` بفهرس مركّب لـActivityLog/DecisionItem/Suggestion/Attachment/Interaction.
- فهارس: Lead على stage/ownerId/followUpAt. Invoice على status+dueAt. Task على ownerId+status. DecisionItem على assigneeId+status. AiUsage على month.
- Custom mutations: `a.mutation().arguments().returns().handler(a.handler.function(fn))`، قراءة اسم الحقل بـ`resolverFieldName(event)` (لا `event.info`). Lambda واحدة لكل مجموعة: leads, work, sales, finance, decisions.

## 3. Enums
- Role: OWNER, MANAGER, STAFF, CLIENT
- LeadStage: NEW, CONTACTED, QUALIFIED, PROPOSAL_SENT, WON, LOST
- LeadSource: INSTAGRAM, TIKTOK, WHATSAPP, REFERRAL, VIDEO_AD, GOOGLE, WALK_IN, OTHER
- LostReason: NO_RESPONSE, NO_BUDGET, CHOSE_COMPETITOR, NOT_NOW, NOT_A_FIT, OTHER (OTHER يستلزم نصًا)
- InteractionChannel: WHATSAPP, CALL, MEETING, EMAIL, OTHER · InteractionDirection: INBOUND, OUTBOUND
- ClientStatus: ACTIVE, ARCHIVED
- ProjectStatus: ACTIVE, ON_HOLD, DELIVERED, CLOSED, CANCELLED
- AppStage: IDEA, REQUIREMENTS, SPEC, DESIGN, DEVELOPMENT, TESTING, PREVIEW, CLIENT_APPROVAL, DEPLOYED · BuildStatus: UNKNOWN, PASSED, FAILED
- TaskStatus: NEW, ASSIGNED, IN_PROGRESS, WAITING, REVIEW, APPROVED, DONE · TaskPriority: LOW, NORMAL, HIGH, URGENT
- ProposalStatus: DRAFT, PENDING_APPROVAL, SENT, CHANGES_REQUESTED, ACCEPTED, DECLINED
- InvoiceStatus: ISSUED, PARTIALLY_PAID, PAID, VOID · PaymentMethod: BANK_TRANSFER, CASH, CARD, OTHER
- ExpenseCategory: DOMAIN, HOSTING, CONTRACTOR, ADS, OTHER
- ApprovalType: PROPOSAL, DELIVERABLE · ApprovalStatus: PENDING, APPROVED, CHANGES_REQUESTED
- RenewalType: DOMAIN, HOSTING, MAINTENANCE, OTHER · RenewalStatus: UPCOMING, RENEWED, CANCELLED
- DecisionType: SUGGESTION, TASK_REVIEW, PROPOSAL_APPROVAL, CLIENT_CHANGE_REQUEST, RENEWAL_DUE, NEW_CLIENT · DecisionStatus: OPEN, APPROVED, REJECTED
- SuggestionType: LEAD_REPLY, PROPOSAL_DRAFT, CLIENT_SUMMARY · SuggestionStatus: PENDING, APPROVED, REJECTED
"متأخر" ليس حالة، يُحسب من التاريخ.

## 4. Routes
```
/                      توجيه حسب المجموعة
/login                 هاتف + OTP
/app                   → /app/inbox (OWNER/MANAGER) أو /app/tasks (STAFF)
/app/inbox
/app/leads             /app/leads/[id]
/app/proposals/new?leadId=|clientId=    /app/proposals/[id]
/app/clients           /app/clients/[id]  (+ /projects /interactions /files /finance /activity)
/app/projects/[id]     (?task=[taskId] لوحة جانبية)
/app/tasks             (?task=[taskId])   /app/tasks/[id]
/app/finance           → /invoices | /payments | /expenses | /renewals   /app/finance/invoices/[id]
/app/settings          → /organization | /services | /playbooks | /team | /ai
/portal                → المشروع الوحيد أو القائمة
/portal/projects/[id]  /portal/proposals/[token]  /portal/approvals/[id]  /portal/invoices
```

## 5. Custom Mutations (من | يغيّر | ActivityLog | DecisionItem)

**Leads (Sprint 1):** createLead (الفريق | Lead NEW, followUpAt +24h | lead.created | لا) · updateLead (الفريق | الحقول الأساسية | lead.updated | لا) · moveLeadStage (الفريق | المرحلة عدا WON/LOST | lead.stage_changed | لا) · assignLead (OWNER/MANAGER، STAFF على نفسه | ownerId | lead.assigned | لا) · logInteraction (الفريق | Interaction + followUpAt + NEW→CONTACTED عند أول OUTBOUND | lead.interaction_logged | لا) · setLeadFollowUp (الفريق | followUpAt | lead.follow_up_set | لا) · closeLeadLost (الفريق | LOST + سبب إجباري | lead.lost | لا) · reopenLead (OWNER/MANAGER | LOST→CONTACTED | lead.reopened | لا)

**Sales (Sprint 3):** convertLeadToClient (OWNER/MANAGER | Client+UserProfile، WON | lead.won, client.created | NEW_CLIENT) · submitProposalForApproval (الفريق | DRAFT→PENDING_APPROVAL | proposal.submitted | PROPOSAL_APPROVAL) · approveAndSendProposal (OWNER/MANAGER | SENT + portalToken، Lead→PROPOSAL_SENT | proposal.sent | يغلق) · respondToProposal (CLIENT عبر token | ACCEPTED/CHANGES_REQUESTED | proposal.accepted/changes_requested | CLIENT_CHANGE_REQUEST عند التعديل) · acceptProposal (SYSTEM | Client+Project+Tasks من Playbook+Invoices، Lead→WON | client.created, project.created, invoice.issued×n | NEW_CLIENT)

**Work (Sprint 2):** createProject · createTask/assignTask · updateTaskStatus (المالك | ASSIGNED↔IN_PROGRESS↔WAITING) · submitTaskForReview (→REVIEW | TASK_REVIEW) · approveTask (المراجع/OWNER | APPROVED ثم DONE أو requestClientApproval) · returnTask (سبب إجباري) · requestClientApproval (Approval DELIVERABLE) · respondToApproval (CLIENT | عند التعديل مهمة تعديل + DecisionItem) · updateAppStage · closeProject (CLOSED + Renewals)

**Finance (Sprint 4):** issueInvoice · recordPayment (Payment + إعادة حساب + ON_HOLD→ACTIVE) · voidInvoice (OWNER) · recordExpense · markRenewed (RENEWED + التالي بعد سنة)

**Decisions & AI (Sprints 2/5):** resolveDecision (المكلّف/OWNER | APPROVED/REJECTED+سبب + الفعل المرتبط) · requestSuggestion (يتحقق من السقف، Claude، AiUsage + Suggestion | SUGGESTION)
