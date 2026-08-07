/**
 * Loads a starter catalog and company profile so the app has something to show
 * on day one. Safe to re-run: it skips anything already present.
 *
 *   node scripts/seed-content.mjs +97455512345
 *
 * The phone number must belong to an existing ADMIN (see seed-admin.mjs) —
 * the script signs in as that admin and writes through the real API, so the
 * same authorization rules the app obeys are applied here too.
 */
import { gqlAsUser, signInWithOtp, REGION } from './lib/backend-test-kit.mjs';

const [, , adminPhone] = process.argv;
if (!adminPhone) {
  console.error('Usage: node scripts/seed-content.mjs +97455512345   (an existing ADMIN number)');
  process.exit(1);
}

const SERVICES = [
  {
    name: 'Exterior Detailing',
    nameAr: 'تلميع خارجي',
    description: 'Full exterior decontamination, machine polish and protective wax.',
    descriptionAr: 'إزالة الشوائب وتلميع آلي وطبقة شمع واقية للهيكل الخارجي.',
    price: 450,
    durationMinutes: 240,
    category: 'Detailing',
    steps: [
      { key: 'wash', name: 'Wash & decontamination', nameAr: 'غسيل وإزالة الشوائب' },
      { key: 'clay', name: 'Clay bar treatment', nameAr: 'معالجة بالطين' },
      { key: 'polish', name: 'Machine polish', nameAr: 'تلميع آلي' },
      { key: 'wax', name: 'Wax & seal', nameAr: 'شمع وحماية' },
    ],
  },
  {
    name: 'Interior Deep Clean',
    nameAr: 'تنظيف داخلي عميق',
    description: 'Steam clean, leather conditioning and full cabin sanitisation.',
    descriptionAr: 'تنظيف بالبخار وتغذية الجلد وتعقيم كامل للمقصورة.',
    price: 320,
    durationMinutes: 180,
    category: 'Detailing',
    steps: [
      { key: 'vacuum', name: 'Vacuum & dry clean', nameAr: 'شفط وتنظيف جاف' },
      { key: 'steam', name: 'Steam clean', nameAr: 'تنظيف بالبخار' },
      { key: 'leather', name: 'Leather conditioning', nameAr: 'تغذية الجلد' },
      { key: 'sanitise', name: 'Sanitise & finish', nameAr: 'تعقيم وإنهاء' },
    ],
  },
  {
    name: 'Ceramic Coating',
    nameAr: 'طلاء سيراميك',
    description: '9H ceramic coating with a 3-year hydrophobic guarantee.',
    descriptionAr: 'طلاء سيراميك 9H مع ضمان طارد للماء لمدة 3 سنوات.',
    price: 2200,
    durationMinutes: 1440,
    category: 'Protection',
    steps: [
      { key: 'prep', name: 'Surface preparation', nameAr: 'تحضير السطح' },
      { key: 'correct', name: 'Paint correction', nameAr: 'تصحيح الطلاء' },
      { key: 'coat', name: 'Ceramic application', nameAr: 'تطبيق السيراميك' },
      { key: 'cure', name: 'Curing', nameAr: 'التجفيف' },
      { key: 'inspect', name: 'Final inspection', nameAr: 'الفحص النهائي' },
    ],
  },
  {
    name: 'PPF Paint Protection',
    nameAr: 'حماية الطلاء PPF',
    description: 'Self-healing paint protection film on high-impact panels.',
    descriptionAr: 'فيلم حماية ذاتي الإصلاح على الأجزاء الأكثر تعرضاً.',
    price: 3800,
    durationMinutes: 2880,
    category: 'Protection',
    steps: [
      { key: 'measure', name: 'Measure & pattern', nameAr: 'القياس والتفصيل' },
      { key: 'prep', name: 'Panel preparation', nameAr: 'تحضير الأجزاء' },
      { key: 'apply', name: 'Film application', nameAr: 'تركيب الفيلم' },
      { key: 'finish', name: 'Edge sealing & inspection', nameAr: 'إغلاق الحواف والفحص' },
    ],
  },
];

const PACKAGES = [
  {
    name: 'Showroom Package',
    nameAr: 'باقة الصالة',
    description: 'Exterior detailing, interior deep clean and a ceramic top coat.',
    descriptionAr: 'تلميع خارجي وتنظيف داخلي عميق وطبقة سيراميك علوية.',
    price: 2800,
    durationMinutes: 1680,
    steps: [
      { key: 'ext', name: 'Exterior detailing', nameAr: 'تلميع خارجي' },
      { key: 'int', name: 'Interior deep clean', nameAr: 'تنظيف داخلي عميق' },
      { key: 'ceramic', name: 'Ceramic top coat', nameAr: 'طبقة سيراميك' },
      { key: 'qc', name: 'Quality check & handover', nameAr: 'فحص الجودة والتسليم' },
    ],
  },
  {
    name: 'Full Protection Package',
    nameAr: 'باقة الحماية الكاملة',
    description: 'PPF on the front end plus a full-body ceramic coating.',
    descriptionAr: 'فيلم حماية للمقدمة مع طلاء سيراميك لكامل الهيكل.',
    price: 5500,
    durationMinutes: 4320,
    steps: [
      { key: 'prep', name: 'Preparation & correction', nameAr: 'التحضير والتصحيح' },
      { key: 'ppf', name: 'PPF installation', nameAr: 'تركيب PPF' },
      { key: 'ceramic', name: 'Ceramic coating', nameAr: 'طلاء سيراميك' },
      { key: 'cure', name: 'Curing', nameAr: 'التجفيف' },
      { key: 'qc', name: 'Final inspection', nameAr: 'الفحص النهائي' },
    ],
  },
];

console.log(`\nSeeding Stars content (${REGION})`);
const token = await signInWithOtp(adminPhone);
console.log(`  signed in as ${adminPhone}\n`);

const existing = await gqlAsUser(
  token,
  `query { listServices(limit: 200) { items { id name } }
           listPackages(limit: 200) { items { id name } } }`,
);
const haveServices = new Set((existing.data?.listServices?.items ?? []).map((s) => s.name));
const havePackages = new Set((existing.data?.listPackages?.items ?? []).map((p) => p.name));

let added = 0;
for (const [index, service] of SERVICES.entries()) {
  if (haveServices.has(service.name)) {
    console.log(`  skip   service "${service.name}" (already present)`);
    continue;
  }
  const result = await gqlAsUser(
    token,
    `mutation Create($input: CreateServiceInput!) { createService(input: $input) { id name } }`,
    {
      input: {
        ...service,
        steps: JSON.stringify(service.steps),
        currency: 'QAR',
        isActive: true,
        sortOrder: index,
      },
    },
  );
  if (result.data?.createService?.id) {
    added += 1;
    console.log(`  add    service "${service.name}" (${service.steps.length} steps)`);
  } else {
    console.log(`  ERROR  service "${service.name}": ${result.errors?.[0]?.message}`);
  }
}

for (const [index, pkg] of PACKAGES.entries()) {
  if (havePackages.has(pkg.name)) {
    console.log(`  skip   package "${pkg.name}" (already present)`);
    continue;
  }
  const result = await gqlAsUser(
    token,
    `mutation Create($input: CreatePackageInput!) { createPackage(input: $input) { id name } }`,
    {
      input: {
        ...pkg,
        steps: JSON.stringify(pkg.steps),
        currency: 'QAR',
        isActive: true,
        sortOrder: index,
      },
    },
  );
  if (result.data?.createPackage?.id) {
    added += 1;
    console.log(`  add    package "${pkg.name}" (${pkg.steps.length} steps)`);
  } else {
    console.log(`  ERROR  package "${pkg.name}": ${result.errors?.[0]?.message}`);
  }
}

/* Company profile — only created if the row does not exist yet, so a real
   profile entered in the app is never overwritten. */
const settings = await gqlAsUser(token, `query { getAppSettings(id: "GLOBAL") { id companyName } }`);
if (!settings.data?.getAppSettings) {
  const result = await gqlAsUser(
    token,
    `mutation Create($input: CreateAppSettingsInput!) { createAppSettings(input: $input) { id } }`,
    {
      input: {
        id: 'GLOBAL',
        companyName: 'Stars',
        companyNameAr: 'ستارز',
        tagline: 'Detailing · Polishing · Paint protection',
        taglineAr: 'تفصيل · تلميع · حماية طلاء',
        about:
          'Stars is a specialist vehicle care studio in Qatar. Every job is tracked step by step, so you always know exactly where your car is in the process.',
        aboutAr:
          'ستارز استوديو متخصص بالعناية بالمركبات في قطر. نتابع كل مرحلة من العمل حتى تعرف دائماً أين وصلت سيارتك بالضبط.',
        currency: 'QAR',
        workingHours: JSON.stringify([
          { day: 'Saturday – Thursday', hours: '8:00 – 20:00' },
          { day: 'Friday', hours: '14:00 – 20:00' },
        ]),
        heroImageKeys: [],
      },
    },
  );
  console.log(
    result.data?.createAppSettings?.id
      ? '  add    company profile'
      : `  ERROR  company profile: ${result.errors?.[0]?.message}`,
  );
} else {
  console.log('  skip   company profile (already present)');
}

console.log(`\nDone. ${added} catalog item(s) added.`);
console.log('Open the app — Home and Book now have content.\n');
