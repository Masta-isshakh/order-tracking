/**
 * Prints the failure reason and log tail for an EAS build.
 *
 *   node scripts/eas-build-logs.mjs <buildId>
 *
 * `eas build:view` reports only the status, and the web UI needs a browser, so
 * this asks the API directly using the session the EAS CLI already stored.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const buildId = process.argv[2];
if (!buildId) {
  console.error('Usage: node scripts/eas-build-logs.mjs <buildId>');
  process.exit(1);
}

const state = JSON.parse(readFileSync(join(homedir(), '.expo', 'state.json'), 'utf8'));
const sessionSecret = state?.auth?.sessionSecret;
if (!sessionSecret) {
  console.error('Not logged in. Run: npx eas-cli login');
  process.exit(1);
}

const graphql = async (query, variables = {}) => {
  const response = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'expo-session': sessionSecret,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
};

const data = await graphql(
  `query Build($id: ID!) {
     builds {
       byId(buildId: $id) {
         id
         status
         error { errorCode message docsUrl }
         logFiles
       }
     }
   }`,
  { id: buildId },
);

const build = data.builds.byId;
console.log(`\nBuild ${build.id} — ${build.status}\n`);

if (build.error) {
  console.log(`  errorCode  ${build.error.errorCode}`);
  console.log(`  message    ${build.error.message}`);
  if (build.error.docsUrl) console.log(`  docs       ${build.error.docsUrl}`);
  console.log('');
}

for (const url of build.logFiles ?? []) {
  console.log(`--- ${url.split('/').pop()} ---`);
  const text = await fetch(url).then((r) => r.text()).catch(() => '');
  // Logs arrive as newline-delimited JSON records.
  const lines = text
    .split('\n')
    .map((line) => {
      try {
        const parsed = JSON.parse(line);
        return parsed.msg ?? '';
      } catch {
        return line;
      }
    })
    .filter(Boolean);
  console.log(lines.slice(-60).join('\n'));
  console.log('');
}
