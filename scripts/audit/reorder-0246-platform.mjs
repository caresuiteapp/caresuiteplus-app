#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const file = path.join(root, 'supabase/migrations/0246_platform_console_foundation_live.sql');
const sql = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function between(from, to) {
  const s = sql.indexOf(from);
  const e = sql.indexOf(to, s + from.length);
  if (s === -1 || e === -1) throw new Error(`between failed: ${from.slice(0, 40)} -> ${to.slice(0, 40)}`);
  return sql.slice(s, e).trim();
}

const header = sql.slice(0, sql.indexOf('-- --------------------------------------------------------------------------\n-- Hilfsfunktionen')).trim();
const rbac = between(
  '-- --------------------------------------------------------------------------\n-- Hilfsfunktionen: Plattform-RBAC (SECURITY DEFINER)',
  '-- --------------------------------------------------------------------------\n-- 1. platform_users',
);
const tables = between(
  '-- --------------------------------------------------------------------------\n-- 1. platform_users',
  '-- --------------------------------------------------------------------------\n-- Seed: Modulverzeichnis',
);
const seeds = between(
  '-- --------------------------------------------------------------------------\n-- Seed: Modulverzeichnis',
  '-- --------------------------------------------------------------------------\n-- Sync bestehender Mandanten in platform_tenants',
);
const sync = between(
  '-- --------------------------------------------------------------------------\n-- Sync bestehender Mandanten in platform_tenants',
  '-- --------------------------------------------------------------------------\n-- RLS aktivieren',
);
const rls = between(
  '-- --------------------------------------------------------------------------\n-- RLS aktivieren',
  '-- platform_users\nCREATE POLICY platform_users_select',
);
const policies = between(
  '-- platform_users\nCREATE POLICY platform_users_select',
  '-- --------------------------------------------------------------------------\n-- RPC: Plattform-Session / Auth',
);
const rpcs = between(
  '-- --------------------------------------------------------------------------\n-- RPC: Plattform-Session / Auth',
  '-- --------------------------------------------------------------------------\n-- GRANTs auf Tabellen',
);
const grants = sql.slice(sql.indexOf('-- --------------------------------------------------------------------------\n-- GRANTs auf Tabellen')).trim();

const rbacGrants = rbac.match(/GRANT EXECUTE ON FUNCTION[\s\S]*?platform_has_capability\(TEXT\) TO authenticated;/)[0];
const rbacFns = rbac.replace(rbacGrants, '').trim();

const out = `${header}

-- --------------------------------------------------------------------------
-- 1–14. Tabellen, Indizes, platform_write_audit_log (vor RBAC-Hilfsfunktionen)
-- --------------------------------------------------------------------------
${tables}

-- --------------------------------------------------------------------------
-- Hilfsfunktionen: Plattform-RBAC (SECURITY DEFINER)
-- --------------------------------------------------------------------------
${rbacFns.replace(/^-- --------------------------------------------------------------------------\n-- Hilfsfunktionen: Plattform-RBAC \(SECURITY DEFINER\)\n-- --------------------------------------------------------------------------\n/, '')}

${rbacGrants}

${seeds}

${sync}

-- --------------------------------------------------------------------------
${rls.replace(/^-- --------------------------------------------------------------------------\n-- RLS aktivieren\n-- --------------------------------------------------------------------------\n/, 'RLS aktivieren\n-- --------------------------------------------------------------------------\n')}

${policies}

-- --------------------------------------------------------------------------
${rpcs}

-- --------------------------------------------------------------------------
${grants}
`.replace(/\n{3,}/g, '\n\n');

fs.writeFileSync(file, `${out}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, bytes: fs.statSync(file).size, startsWith: out.slice(0, 120) }));
