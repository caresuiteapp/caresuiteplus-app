import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8').trim();
const workspace = read('../supabase/migrations/20261022055559_pflege_wound_workspace_quarantined.sql')
  .replaceAll('care_private.require_workspace_session(', 'care_private.require_wound_workspace_session(');
const consent = read('../supabase/migrations/20261022055652_pflege_wound_photo_consent_scope.sql');
const sources = read('../supabase/migrations/20261022055659_pflege_wound_path_source_fingerprint.sql')
  .replaceAll('care_private.require_workspace_session(', 'care_private.require_wound_workspace_session(');
const record = read('../supabase/patches/ambulatory_wound_record.sql');
const access = read('../supabase/patches/ambulatory_wound_release_access.sql');
const location = read('../supabase/patches/ambulatory_wound_initial_location.sql');

if (!/^begin;$/im.test(record) || !/^commit;$/im.test(record) ||
  [workspace, consent, sources, access, location].some((sql) => /^(?:begin|commit|rollback);$/im.test(sql))) {
  throw new Error('Unerwartete Transaktionsgrenze in den Wundakten-Patches.');
}

process.stdout.write([
  'begin;',
  "set local lock_timeout = '6s';",
  "set local statement_timeout = '60s';",
  workspace,
  consent,
  sources,
  record.replace(/^begin;$/im, '').replace(/^commit;$/im, ''),
  access,
  location,
  "notify pgrst, 'reload schema';",
  'commit;',
  '',
].join('\n\n'));
