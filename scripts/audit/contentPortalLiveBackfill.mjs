#!/usr/bin/env node
/**
 * Content Portal C.4 — idempotent LIVE backfill (portal settings init).
 * Only LIVE whitelist tenants. Zero deletes. Supports --dry-run.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuditAdminClient, loadAuditEnv } from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIVE_WHITELIST = ['56180c22-b894-4fab-b55e-a563c94dd6e7'];
const outPath = join(root, '.audit-content-portal-live-backfill-results.json');

async function main() {
  const env = loadAuditEnv();
  const dryRun = process.argv.includes('--dry-run');
  const adminClient = createAuditAdminClient(env);
  const result = { ok: false, dryRun, tenants: [], deletes: 0 };

  if (!adminClient.url || !adminClient.key) {
    result.reason = 'missing_service_role_or_url';
    result.clientError = {
      clientType: 'admin',
      envKeyName: adminClient.keyEnvKeyName,
      errorClass: 'missing_env',
    };
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    process.exit(2);
  }

  for (const tenantId of LIVE_WHITELIST) {
    const tenantReport = {
      tenantId,
      clientsBefore: 0,
      activeClients: 0,
      portalRowsBefore: 0,
      wouldUpsert: 0,
      upserted: 0,
    };

    const clientsRes = await adminClient.restSelect(
      'clients',
      `select=id,status&tenant_id=eq.${tenantId}`,
    );
    if (!clientsRes.ok) {
      tenantReport.error = clientsRes.error;
      result.tenants.push(tenantReport);
      continue;
    }

    const clients = clientsRes.data ?? [];
    tenantReport.clientsBefore = clients.length;
    tenantReport.activeClients = clients.filter((c) => c.status === 'active').length;

    const portalRes = await adminClient.restSelect(
      'client_portal_settings',
      `select=client_id&tenant_id=eq.${tenantId}`,
    );
    tenantReport.portalRowsBefore = portalRes.ok ? (portalRes.data?.length ?? 0) : 0;
    if (!portalRes.ok) {
      tenantReport.portalError = portalRes.error;
    }

    const existing = new Set((portalRes.data ?? []).map((r) => r.client_id));
    const missing = clients.filter((c) => c.status === 'active' && !existing.has(c.id));
    tenantReport.wouldUpsert = missing.length;

    if (!dryRun && missing.length > 0) {
      const rows = missing.map((c) => ({
        tenant_id: tenantId,
        client_id: c.id,
        portal_enabled: true,
        inherit_tenant_defaults: true,
      }));
      const upsert = await adminClient.restUpsertMany('client_portal_settings', rows, 'tenant_id,client_id');
      tenantReport.upsertError = upsert.ok ? undefined : upsert.error;
      tenantReport.upserted = upsert.ok ? rows.length : 0;
    }

    result.tenants.push(tenantReport);
  }

  result.ok = result.tenants.every((t) => !t.error && !t.upsertError && !t.portalError);
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
