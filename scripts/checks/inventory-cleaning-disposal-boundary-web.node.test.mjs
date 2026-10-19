import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/inventory/inventoryCleaningDisposalBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getInventoryCleaningDisposalBoundaryWeb;')();
const types = read('src/types/inventory/index.ts');
const returnCapture = types.match(/export type InventoryReturnCapture = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const returnRecord = types.match(/export type InventoryReturnRecord = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const auditType = types.match(/export type InventoryAuditEvent = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const migration = read('supabase/migrations/0135_inventory_prepared.sql');
const table = name => migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${name} \\(([\\s\\S]*?)\\n\\);`))?.[1] ?? '';
const returnTable = table('inventory_return_records');
const auditTable = table('inventory_audit_events');
const repository = read('src/lib/inventory/inventoryRepository.supabase.ts');
const panel = read('src/screens/inventory/InventoryConsumablesBoundaryPanel.web.tsx');

test('Boundary is immutable and denies inferred hygiene execution or disposal', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Reflect.ownKeys(value), [
    'capability', 'activityIdentity', 'responsibleIdentity', 'performedAt',
    'cleaningMethod', 'disinfectionMethod', 'productOrProcedure', 'deviationRecord',
    'disposalEvent', 'releaseAfterCleaning', 'evidenceRelation', 'actualExecutionProof',
    'returnCaptureMeaning', 'deviceResetMeaning', 'genericAuditMeaning', 'sourceQuality',
  ]);
  assert.equal(value.capability, 'no_cleaning_disinfection_or_disposal_evidence_contract');
  for (const key of ['activityIdentity', 'responsibleIdentity', 'performedAt', 'cleaningMethod', 'disinfectionMethod', 'productOrProcedure', 'deviationRecord', 'disposalEvent', 'releaseAfterCleaning', 'evidenceRelation']) assert.equal(value[key], 'not_provided');
  assert.equal(value.actualExecutionProof, 'not_verifiable');
  assert.equal(value.returnCaptureMeaning, 'asset_return_condition_not_hygiene_execution');
  assert.equal(value.deviceResetMeaning, 'data_or_device_reset_not_cleaning_or_disinfection');
  assert.equal(value.genericAuditMeaning, 'not_a_structured_hygiene_or_disposal_ledger');
  assert.throws(() => { value.actualExecutionProof = 'verified'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

for (const [label, contract] of [['Return capture DTO', returnCapture], ['Return record DTO', returnRecord], ['return table', returnTable]]) {
  test(`${label} has no cleaning, disinfection, release or disposal evidence contract`, () => {
    assert.ok(contract.length > 100);
    for (const token of ['cleaning_event_id', 'cleaned_at', 'disinfection_event_id', 'disinfected_at', 'hygiene_release_id', 'disposed_at', 'disposal_id', 'cleaning_method', 'disinfection_method']) assert.doesNotMatch(contract, new RegExp(`\\b${token}\\b`, 'i'));
  });
}

test('Return-condition and reset fields remain inventory capture, not hygiene execution', () => {
  assert.match(returnCapture, /returned: boolean/);
  assert.match(returnCapture, /complete: boolean/);
  assert.match(returnCapture, /condition: InventoryCondition/);
  assert.match(returnCapture, /deviceReset\?: boolean \| null/);
  assert.match(returnCapture, /dataDeleted\?: boolean \| null/);
  assert.doesNotMatch(source, /returned\s*[<>=]|complete\s*[<>=]|deviceReset\s*[<>=]|dataDeleted\s*[<>=]/);
});

test('Generic audit has no structured hygiene actor, method, deviation or disposal relation', () => {
  assert.match(auditType, /action: string/);
  assert.match(auditType, /metadata: Record<string, unknown>/);
  assert.match(auditTable, /action\s+TEXT\s+NOT NULL/);
  for (const token of ['cleaning_event_id', 'disinfection_event_id', 'hygiene_release_id', 'disposal_id', 'performed_by_employee_id', 'deviation_id']) assert.doesNotMatch(auditTable, new RegExp(`\\b${token}\\b`, 'i'));
});

test('Repository exposes no native cleaning, disinfection, release or disposal table', () => {
  for (const tableName of ['inventory_cleaning_events', 'inventory_disinfection_events', 'inventory_hygiene_releases', 'inventory_disposals', 'inventory_hygiene_deviations']) assert.doesNotMatch(repository, new RegExp(`['\"]${tableName}['\"]`));
});

test('Visible boundary has no query, write, RPC, clock or inferred completion', () => {
  assert.match(panel, /Rückgabe, Zustand, Vollständigkeit, Geräte-Reset und Datenlöschung/);
  assert.match(panel, /Notizen und allgemeine Auditwerte bestätigen deshalb keine hygienische Durchführung/);
  for (const content of [source, panel]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
});
