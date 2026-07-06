#!/usr/bin/env node
/**
 * CareSuite+ — Verifikation Migration 0234 (Portal-Dokumentrechte für cs_* Signatures)
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAuditAdminClient,
  getServiceRoleKey,
  getSupabaseUrl,
  loadAuditEnv,
} from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationPath = join(root, 'supabase', 'migrations', '0234_cs_document_portal_permissions.sql');

const EXPECTED_PERMISSIONS = [
  'portal.employee.documents.view',
  'portal.employee.documents.download',
  'portal.client.documents.view',
  'portal.client.documents.download',
];

async function countRows(admin, table, filter) {
  const res = await admin.restSelect(table, `${filter}&limit=5000`);
  if (!res.ok) return { ok: false, error: res.error?.message ?? 'query_failed', count: null };
  return { ok: true, count: Array.isArray(res.data) ? res.data.length : 0 };
}

async function main() {
  if (!existsSync(migrationPath)) {
    console.error(JSON.stringify({ ok: false, error: 'migration_file_missing', path: migrationPath }));
    process.exit(1);
  }

  const sql = readFileSync(migrationPath, 'utf8');
  const env = loadAuditEnv();
  const { value: url } = getSupabaseUrl(env);
  const { value: serviceKey } = getServiceRoleKey(env);

  const report = {
    ok: true,
    migrationFile: 'supabase/migrations/0234_cs_document_portal_permissions.sql',
    generatedAt: new Date().toISOString(),
    expectedPermissions: EXPECTED_PERMISSIONS,
    remote: { attempted: false },
  };

  if (!url || !serviceKey) {
    report.ok = false;
    report.verdict = 'SUPABASE_SERVICE_ROLE_KEY oder SUPABASE_URL fehlt — Remote nicht geprüft.';
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const admin = createAuditAdminClient(env);
  report.remote.attempted = true;

  const catalogChecks = {};
  for (const key of EXPECTED_PERMISSIONS) {
    const result = await countRows(admin, 'permission_catalog', `select=key&key=eq.${encodeURIComponent(key)}`);
    catalogChecks[key] = result.ok ? result.count === 1 : null;
    if (result.ok && result.count !== 1) report.ok = false;
    if (!result.ok) report.ok = false;
  }

  const rolePermChecks = {};
  for (const roleKey of ['employee_portal', 'client_portal']) {
    const perms =
      roleKey === 'employee_portal'
        ? ['portal.employee.documents.view', 'portal.employee.documents.download']
        : ['portal.client.documents.view', 'portal.client.documents.download'];
    const counts = {};
    for (const perm of perms) {
      const result = await countRows(
        admin,
        'role_permissions',
        `select=permission_key&permission_key=eq.${encodeURIComponent(perm)}&roles.key=eq.${roleKey}`,
      );
      // role_permissions join may not work via simple filter — query via roles
      const direct = await admin.restSelect(
        'role_permissions',
        `select=permission_key,role_id&permission_key=eq.${encodeURIComponent(perm)}&limit=500`,
      );
      let matchCount = 0;
      if (direct.ok && Array.isArray(direct.data)) {
        const rolesRes = await admin.restSelect('roles', `select=id,key&key=eq.${roleKey}&limit=1`);
        const roleId = rolesRes.ok && rolesRes.data?.[0]?.id;
        if (roleId) {
          matchCount = direct.data.filter((row) => row.role_id === roleId).length;
        }
      }
      counts[perm] = matchCount >= 1;
      if (matchCount < 1) report.ok = false;
    }
    rolePermChecks[roleKey] = counts;
  }

  report.remote = {
    attempted: true,
    permissionCatalog: catalogChecks,
    rolePermissions: rolePermChecks,
    migrationSqlPresent: EXPECTED_PERMISSIONS.every((key) => sql.includes(key)),
  };

  report.verdict = report.ok
    ? 'Migration 0234 Portal-RBAC remote verifiziert.'
    : 'Migration 0234 fehlt oder unvollständig auf Remote.';

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err.message ?? err) }));
  process.exit(1);
});
