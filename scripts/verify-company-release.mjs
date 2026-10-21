import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const relevant = /company|tenant(?:BrandingService|CenterService|CenterWebPersistence|ModuleToggle|CustomField|ServiceCatalog)|centralCatalogSources/i;
const tests = ['tenant', 'inventory', 'documents', 'navigation'].flatMap(directory =>
  readdirSync(resolve(root, 'src/__tests__', directory))
    .filter(name => /\.test\.tsx?$/.test(name) && relevant.test(name))
    .map(name => `src/__tests__/${directory}/${name}`),
).sort();
tests.push(...readdirSync(resolve(root, 'src/__tests__/office'))
  .filter(name => /^(?:(?:office)?catalogWorkspace|moduleAssignmentWorkspace).*\.test\.tsx?$/i.test(name))
  .map(name => `src/__tests__/office/${name}`));
function run(label, args) {
  console.log(`\n[company-release] ${label}`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(`[company-release] Failed: ${label}`, result.error?.message ?? '');
    process.exit(result.status || 1);
  }
}
run('Company workflows and service boundaries', ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', ...tests]);
for (const file of ['company_access', 'company_resources_scope', 'company_documents_settings', 'company_owner_profile_activation', 'module_assignment_legacy_read_access']) {
  run(`PostgreSQL ${file}`, ['--test', `supabase/tests/${file}.test.mjs`]);
}
console.log('\n[company-release] All required checks passed. No remote database was changed.');
