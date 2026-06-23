#!/usr/bin/env node
/**
 * Content Portal C.4 — idempotent LIVE backfill (portal settings init).
 * Only LIVE whitelist tenants. Zero deletes. Supports --dry-run.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIVE_WHITELIST = ['56180c22-b894-4fab-b55e-a563c94dd6e7'];
const outPath = join(root, '.audit-content-portal-live-backfill-results.json');

function loadEnv() {
  const path = join(root, '.env');
  const out = { ...process.env };
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function restSelect(url, key, table, query) {
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: JSON.stringify(data), data: null };
  return { ok: true, data };
}

async function restUpsert(url, key, table, rows, onConflict) {
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text };
  }
  return { ok: true };
}

async function main() {
  const env = loadEnv();
  const dryRun = process.argv.includes('--dry-run');
  const url = (env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  const result = { ok: false, dryRun, tenants: [], deletes: 0 };

  if (!url || !serviceKey) {
    result.reason = 'missing_service_role_or_url';
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

    const clientsRes = await restSelect(
      url,
      serviceKey,
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

    const portalRes = await restSelect(
      url,
      serviceKey,
      'client_portal_settings',
      `select=client_id&tenant_id=eq.${tenantId}`,
    );
    tenantReport.portalRowsBefore = portalRes.data?.length ?? 0;

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
      const upsert = await restUpsert(url, serviceKey, 'client_portal_settings', rows, 'tenant_id,client_id');
      tenantReport.upsertError = upsert.error;
      tenantReport.upserted = upsert.ok ? rows.length : 0;
    }

    result.tenants.push(tenantReport);
  }

  result.ok = result.tenants.every((t) => !t.error && !t.upsertError);
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
