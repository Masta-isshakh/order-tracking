/**
 * Prints what a signed-out visitor sees, straight from the deployed API.
 * A quick way to confirm the public Home and Book tabs will have content.
 *
 *   node scripts/show-content.mjs
 */
import { gqlAsGuest, REGION } from './lib/backend-test-kit.mjs';

const result = await gqlAsGuest(`query {
  listServices(limit: 50) { items { id name nameAr price steps isActive } }
  listPackages(limit: 50) { items { id name nameAr price steps isActive } }
  getAppSettings(id: "GLOBAL") { companyName companyNameAr tagline }
}`);

if (result.errors?.length) {
  console.error('Failed:', result.errors.map((e) => e.message).join('; '));
  process.exit(1);
}

const services = result.data?.listServices?.items ?? [];
const packages = result.data?.listPackages?.items ?? [];
const settings = result.data?.getAppSettings;

const stepCount = (steps) => {
  try {
    const parsed = typeof steps === 'string' ? JSON.parse(steps) : steps;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

console.log(`\nPublic catalog (${REGION}) — what a signed-out visitor sees\n`);
console.log(`  Company: ${settings?.companyName ?? '(not set)'} / ${settings?.companyNameAr ?? '—'}`);
console.log(`  Tagline: ${settings?.tagline ?? '(not set)'}\n`);

console.log(`  Services (${services.length}):`);
for (const s of services) {
  console.log(`    · ${s.name} / ${s.nameAr ?? '—'} — ${s.price ?? '—'} QAR — ${stepCount(s.steps)} steps`);
}

console.log(`\n  Packages (${packages.length}):`);
for (const p of packages) {
  console.log(`    · ${p.name} / ${p.nameAr ?? '—'} — ${p.price ?? '—'} QAR — ${stepCount(p.steps)} steps`);
}
console.log('');
