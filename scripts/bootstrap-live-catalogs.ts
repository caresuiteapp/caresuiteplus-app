#!/usr/bin/env npx tsx
/**
 * Idempotent live bootstrap: assist catalog_items + template catalog_entries.
 * Uses SUPABASE_SERVICE_ROLE_KEY from .env — never logs secrets.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASSIST_CATALOG_DEFINITIONS,
  buildAssistCatalogSnapshot,
} from '../src/data/seeds/assistCatalogSeeds';
import { getAllCatalogEntries } from '../src/data/demo/templates/seeds';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, '.audit-bootstrap-live-catalogs-results.json');

function loadEnv() {
  const path = join(root, '.env');
  if (!existsSync(path)) return;
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
    if (!process.env[key]) process.env[key] = val;
  }
}

type RestResult = { ok: boolean; status: number; body: unknown };

async function rest(
  baseUrl: string,
  serviceKey: string,
  method: string,
  path: string,
  body?: unknown,
  prefer?: string,
): Promise<RestResult> {
  const headers: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

async function fetchAll<T>(
  baseUrl: string,
  serviceKey: string,
  table: string,
  query: string,
): Promise<T[]> {
  const res = await rest(baseUrl, serviceKey, 'GET', `${table}?${query}`, undefined, 'count=exact');
  if (!res.ok) throw new Error(`${table} fetch failed (${res.status})`);
  return (res.body as T[]) ?? [];
}

/** Stable UUID for template catalog_entries (DB column is uuid, demo seeds use string ids). */
function catalogEntryUuid(catalogType: string, valueKey: string): string {
  const hash = createHash('sha256')
    .update(`caresuite-catalog-entry:v1:${catalogType}:${valueKey}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function main() {
  loadEnv();
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const result: Record<string, unknown> = { ok: false, at: new Date().toISOString() };

  if (!baseUrl || !serviceKey) {
    result.reason = 'missing_supabase_service_role_env';
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    process.exit(2);
  }

  const snapshot = buildAssistCatalogSnapshot();
  const defKeyBySeedId = new Map(
    ASSIST_CATALOG_DEFINITIONS.map((d) => [d.id, d.catalogKey]),
  );
  const remoteDefs = await fetchAll<{ id: string; catalog_key: string }>(
    baseUrl,
    serviceKey,
    'catalog_definitions',
    'select=id,catalog_key&tenant_id=is.null&order=sort_order',
  );
  const remoteDefByKey = new Map(remoteDefs.map((d) => [d.catalog_key, d.id]));

  const existingItems = await fetchAll<{ id: string }>(
    baseUrl,
    serviceKey,
    'catalog_items',
    'select=id&tenant_id=is.null',
  );
  const existingItemIds = new Set(existingItems.map((r) => r.id));

  const itemRows = snapshot.items
    .map((item) => {
      const catalogKey = defKeyBySeedId.get(item.catalogId);
      const catalogId = catalogKey ? remoteDefByKey.get(catalogKey) : undefined;
      if (!catalogId) return null;
      if (existingItemIds.has(item.id)) return null;
      return {
        id: item.id,
        tenant_id: null,
        catalog_id: catalogId,
        parent_item_id: item.parentItemId,
        item_key: item.itemKey,
        label: item.label,
        short_label: item.shortLabel,
        description: item.description,
        helper_text: item.helperText,
        tags: item.tags,
        icon: item.icon,
        color: item.color,
        sort_order: item.sortOrder,
        is_system_default: item.isSystemDefault,
        is_active: item.isActive,
        is_billable_relevant: item.isBillableRelevant,
        is_documentation_required: item.isDocumentationRequired,
        is_signature_relevant: item.isSignatureRelevant,
        is_risk_relevant: item.isRiskRelevant,
        default_duration_minutes: item.defaultDurationMinutes,
        default_price_hint: item.defaultPriceHint,
        default_unit: item.defaultUnit,
        payload_json: item.payloadJson,
      };
    })
    .filter(Boolean);

  let itemsInserted = 0;
  for (const batch of chunk(itemRows, 40)) {
    const res = await rest(
      baseUrl,
      serviceKey,
      'POST',
      'catalog_items?on_conflict=id',
      batch,
      'resolution=merge-duplicates,return=minimal',
    );
    if (!res.ok) {
      result.reason = 'catalog_items_insert_failed';
      result.itemsError = { status: res.status, body: res.body };
      writeFileSync(outPath, JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result));
      process.exit(1);
    }
    itemsInserted += batch.length;
  }

  const existingEntries = await fetchAll<{ catalog_type: string; value_key: string }>(
    baseUrl,
    serviceKey,
    'catalog_entries',
    'select=catalog_type,value_key',
  );
  const entryKey = (t: string, k: string) => `${t}::${k}`;
  const existingEntrySet = new Set(
    existingEntries.map((e) => entryKey(e.catalog_type, e.value_key)),
  );

  const entryRows = getAllCatalogEntries()
    .filter((e) => !existingEntrySet.has(entryKey(e.catalogType, e.valueKey)))
    .map((e) => ({
      id: catalogEntryUuid(e.catalogType, e.valueKey),
      tenant_id: null,
      catalog_type: e.catalogType,
      value_key: e.valueKey,
      label: e.label,
      description: e.description,
      module_key: e.moduleKey,
      is_system: e.isSystem,
      is_active: e.isActive,
      sort_order: e.sortOrder,
    }));

  let entriesInserted = 0;
  for (const batch of chunk(entryRows, 50)) {
    const res = await rest(
      baseUrl,
      serviceKey,
      'POST',
      'catalog_entries?on_conflict=id',
      batch,
      'resolution=merge-duplicates,return=minimal',
    );
    if (!res.ok) {
      result.reason = 'catalog_entries_insert_failed';
      result.entriesError = { status: res.status, body: res.body };
      result.itemsInserted = itemsInserted;
      writeFileSync(outPath, JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result));
      process.exit(1);
    }
    entriesInserted += batch.length;
  }

  const counts = await fetchAll<{ groups: number; definitions: number; items: number; entries: number }>(
    baseUrl,
    serviceKey,
    'rpc/execute_sql',
    '',
  ).catch(() => null);

  void counts;

  const verifyItems = await fetchAll<{ id: string }>(
    baseUrl,
    serviceKey,
    'catalog_items',
    'select=id&tenant_id=is.null',
  );
  const verifyAssignmentStatus = await fetchAll<{ id: string }>(
    baseUrl,
    serviceKey,
    'catalog_entries',
    'select=id&catalog_type=eq.assignment_status',
  );

  result.ok = true;
  result.itemsInserted = itemsInserted;
  result.entriesInserted = entriesInserted;
  result.remoteSystemItems = verifyItems.length;
  result.remoteAssignmentStatusEntries = verifyAssignmentStatus.length;
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}

main().catch((err) => {
  const result = { ok: false, error: String(err) };
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.error(err);
  process.exit(1);
});
