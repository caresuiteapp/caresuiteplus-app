#!/usr/bin/env node
/**
 * CareSuite+ — Verifikation Migration 0226 (cs_* Vorlagen-Datenbank)
 * Parst erwartete Counts aus der SQL-Datei und prüft optional Remote-Supabase.
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
const migrationPath = join(root, 'supabase', 'migrations', '0233_cs_vorlagen_datenbank.sql');

function parseExpectedFromSql(sql) {
  const seedTemplates = (sql.match(/^select public\.cs_seed_template\(/gim) ?? []).length;

  const categoryBlock = sql.match(
    /insert into public\.cs_template_categories[\s\S]*?on conflict \(category_key\)/i,
  );
  const categories = categoryBlock
    ? (categoryBlock[0].match(/\('[\w_]+',\s*'/g) ?? []).length
    : 0;

  const placeholderBlock = sql.match(
    /insert into public\.cs_template_placeholders[\s\S]*?on conflict \(placeholder_key\)/i,
  );
  const placeholders = placeholderBlock
    ? (placeholderBlock[0].match(/\('[\w.]+',\s*'/g) ?? []).length
    : 0;

  const requiredObjects = [
    'cs_template_categories',
    'cs_template_placeholders',
    'cs_document_templates',
    'cs_document_template_versions',
    'cs_template_signature_fields',
    'cs_template_delivery_defaults',
    'cs_document_requests',
    'cs_document_request_signatures',
    'cs_document_request_files',
  ];

  const functions = ['cs_placeholder_value', 'cs_render_template_html', 'cs_seed_template'];

  const tablesPresent = requiredObjects.map((name) => ({
    name,
    declaredInMigration: new RegExp(`create table if not exists public\\.${name}`, 'i').test(sql),
  }));

  const functionsPresent = functions.map((name) => ({
    name,
    declaredInMigration: new RegExp(
      `create or replace function public\\.${name}\\(`,
      'i',
    ).test(sql),
  }));

  return {
    categories,
    placeholders,
    documentTemplates: seedTemplates,
    activeVersionsExpected: seedTemplates,
    signatureFieldsExpected: 'pro Vorlage via cs_seed_template (variabel)',
    deliveryDefaultsExpected: seedTemplates,
    seedTemplates,
    tablesPresent,
    functionsPresent,
  };
}

const TABLE_SELECT_COLUMNS = {
  cs_template_delivery_defaults: 'template_id',
};

async function countRemoteTable(admin, table, filter) {
  const selectCol = TABLE_SELECT_COLUMNS[table] ?? 'id';
  const query = filter ?? `select=${selectCol}`;
  const res = await admin.restSelect(table, `${query}&limit=1`);
  if (!res.ok) {
    return { ok: false, error: res.error?.message ?? 'query_failed', count: null };
  }
  const rows = Array.isArray(res.data) ? res.data.length : 0;
  // PostgREST without count header — fetch capped list
  const full = await admin.restSelect(table, `${query}&limit=5000`);
  if (!full.ok) {
    return { ok: false, error: full.error?.message ?? 'query_failed', count: null };
  }
  return { ok: true, count: Array.isArray(full.data) ? full.data.length : rows };
}

async function probeRemote(env) {
  const { value: url } = getSupabaseUrl(env);
  const { value: serviceKey } = getServiceRoleKey(env);
  if (!url || !serviceKey) {
    return {
      attempted: false,
      reason: 'SUPABASE_SERVICE_ROLE_KEY oder SUPABASE_URL fehlt — nur SQL-Parse.',
    };
  }

  const admin = createAuditAdminClient(env);
  const tables = [
    { name: 'cs_template_categories', select: 'id' },
    { name: 'cs_template_placeholders', select: 'id' },
    { name: 'cs_document_templates', select: 'id' },
    { name: 'cs_document_template_versions', select: 'id' },
    { name: 'cs_template_signature_fields', select: 'id' },
    { name: 'cs_template_delivery_defaults', select: 'template_id' },
  ];

  const remoteCounts = {};
  const remoteErrors = [];

  for (const table of tables) {
    const result = await countRemoteTable(admin, table.name, `select=${table.select}`);
    if (!result.ok) {
      remoteErrors.push({ table: table.name, error: result.error });
      remoteCounts[table.name] = null;
    } else {
      remoteCounts[table.name] = result.count;
    }
  }

  // RPC smoke: cs_render_template_html with minimal payload
  let rpcOk = null;
  let rpcError = null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/cs_render_template_html`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        _html: '<p>{{tenant.legal_name}}</p>',
        _context: { tenant: { legal_name: 'CareSuite Test' } },
      }),
    });
    const text = await res.text();
    rpcOk = res.ok && text.includes('CareSuite Test');
    if (!rpcOk) rpcError = text.slice(0, 300);
  } catch (err) {
    rpcOk = false;
    rpcError = String(err.message ?? err);
  }

  return {
    attempted: true,
    remoteCounts,
    remoteErrors,
    rpc: { cs_render_template_html: rpcOk, error: rpcError },
  };
}

async function main() {
  if (!existsSync(migrationPath)) {
    console.error(JSON.stringify({ ok: false, error: 'migration_file_missing', path: migrationPath }));
    process.exit(1);
  }

  const sql = readFileSync(migrationPath, 'utf8');
  const expected = parseExpectedFromSql(sql);
  const env = loadAuditEnv();
  const remote = await probeRemote(env);

  const report = {
    ok: true,
    migrationFile: 'supabase/migrations/0233_cs_vorlagen_datenbank.sql',
    generatedAt: new Date().toISOString(),
    expectedFromSql: expected,
    remote,
    notes: [
      'Juristische Vorlagen sind technische Muster — vor Produktion rechtlich prüfen.',
      'PDF-Archiv (cs_document_request_files) ist Phase 4 — keine Fake-Dateien anlegen.',
      'Einsatz-Blockade (required_before_service) ist Phase 3 — noch nicht scharf schalten.',
    ],
  };

  if (remote.attempted && remote.remoteErrors.length > 0) {
    report.ok = false;
    report.verdict = 'Migration vermutlich noch nicht angewendet oder Tabellen fehlen.';
  } else if (remote.attempted && remote.remoteCounts) {
    const mismatches = [];
    if (remote.remoteCounts.cs_template_categories !== expected.categories) {
      mismatches.push('categories');
    }
    if (remote.remoteCounts.cs_template_placeholders !== expected.placeholders) {
      mismatches.push('placeholders');
    }
    if (remote.remoteCounts.cs_document_templates !== expected.documentTemplates) {
      mismatches.push('document_templates');
    }
    report.verdict =
      mismatches.length === 0
        ? 'Remote-Counts stimmen mit SQL-Seed überein.'
        : `Abweichungen bei: ${mismatches.join(', ')}`;
    report.ok = mismatches.length === 0 && remote.rpc?.cs_render_template_html === true;
  } else {
    report.verdict = 'Lokal geparst — Remote nicht geprüft (Service Role fehlt).';
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err.message ?? err) }));
  process.exit(1);
});
