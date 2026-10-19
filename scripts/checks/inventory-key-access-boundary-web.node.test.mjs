import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/inventory/inventoryKeyAccessBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getInventoryKeyAccessBoundaryWeb;')();
const types = read('src/types/inventory/index.ts');
const mapper = read('src/lib/inventory/inventoryMapper.ts');
const repository = read('src/lib/inventory/inventoryRepository.supabase.ts');
const migration = read('supabase/migrations/0135_inventory_prepared.sql');
const panel = read('src/screens/inventory/InventoryConsumablesBoundaryPanel.web.tsx');

test('Key/access boundary is immutable and denies inferred handling or revocation', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.equal(value.capability, 'key_and_access_inventory_signal_only');
  assert.equal(value.responsibleHandlingProof, 'not_verifiable');
  assert.equal(value.accessRevocationProof, 'not_verifiable');
  assert.equal(value.secretMaterialExposure, 'forbidden');
  assert.throws(() => { value.accessRevocationProof = 'verified'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Inventory has keys/access category but no credential payload type', () => {
  assert.match(types, /'keys_access'/);
  assert.match(types, /accessAccountRef\?: string \| null/);
  assert.doesNotMatch(types, /(?:password|passwort|accessCode|pin|secret|credential)(?:\??:|\s*=)/i);
});

test('Mapped account value remains an opaque reference only', () => {
  assert.match(mapper, /accessAccountRef: optStr\(r\.access_account_ref\)/);
  assert.doesNotMatch(mapper, /decrypt|credential|password|passwort|secret/i);
});

test('Loss report schema lacks responsible handler and concrete response action', () => {
  const table = migration.match(/CREATE TABLE IF NOT EXISTS public\.inventory_damage_reports \(([\s\S]*?)\n\);/)?.[1] ?? '';
  assert.ok(table.length > 500);
  assert.match(table, /report_type\s+TEXT/);
  assert.match(table, /reported_by_profile_id\s+UUID/);
  assert.match(table, /resolved_at\s+TIMESTAMPTZ/);
  assert.doesNotMatch(table, /responsible_(?:profile|employee)_id|resolution_action|revoked_at|lock_action|replacement_key_id/);
});

test('Repository loss write changes inventory state but cannot prove access revocation', () => {
  const report = repository.match(/async reportDamage\([\s\S]*?\n  \},\n\n  async buildDashboard/)?.[0] ?? '';
  assert.ok(report.length > 1000);
  assert.match(report, /report\.reportType === 'loss'/);
  assert.match(report, /status: 'lost', condition: 'lost'/);
  assert.match(report, /status: report\.reportType === 'loss' \? 'lost'/);
  assert.doesNotMatch(report, /revoke|disable|rotate|lock|access_account|credential|password|secret/i);
});

test('Return record is physical inventory evidence, not an account revocation event', () => {
  const table = migration.match(/CREATE TABLE IF NOT EXISTS public\.inventory_return_records \(([\s\S]*?)\n\);/)?.[1] ?? '';
  assert.match(table, /assignment_id\s+UUID/);
  assert.match(table, /returned_at\s+TIMESTAMPTZ/);
  assert.match(table, /recorded_by_profile_id\s+UUID/);
  assert.doesNotMatch(table, /access_revoked|credential|password|secret|account_disabled/i);
});

test('Visible boundary states loss handling, revocation and secret limits', () => {
  assert.match(panel, /Schlüssel und Zugang · Nachweisgrenze/);
  assert.match(panel, /Eine Verlustmeldung belegt noch keine zuständige Bearbeitung/);
  assert.match(panel, /bestätigt keine Zugangssperre/);
  assert.match(panel, /keine Zugangscodes, Passwörter oder sonstigen Geheimnisse/);
});

test('Boundary display has no query, write, clock or inferred completion', () => {
  const visible = panel.match(/<Text style=\{\[styles\.title,[\s\S]*?Schlüssel und Zugang · Nachweisgrenze[\s\S]*?keyAccessBoundary\.secretMaterialExposure\}<\/Text>/)?.[0] ?? '';
  assert.ok(visible.length > 500);
  for (const content of [source, visible]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
  assert.doesNotMatch(source, /status\s*[:=]\s*['"](?:completed|approved|released|revoked)['"]/);
});
