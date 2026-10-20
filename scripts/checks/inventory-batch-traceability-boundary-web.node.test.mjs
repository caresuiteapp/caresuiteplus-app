import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/inventory/inventoryBatchTraceabilityBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getInventoryBatchTraceabilityBoundaryWeb;')();
const itemType = read('src/types/inventory/index.ts').match(/export type InventoryItem = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const createType = read('src/types/inventory/index.ts').match(/export type CreateInventoryItemInput = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const migration = read('supabase/migrations/0135_inventory_prepared.sql');
const table = (name) => migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${name} \\(([\\s\\S]*?)\\n\\);`))?.[1] ?? '';
const itemTable = table('inventory_items');
const auditTable = table('inventory_audit_events');
const repository = read('src/lib/inventory/inventoryRepository.supabase.ts');
const panel = read('src/screens/inventory/InventoryConsumablesBoundaryPanel.web.tsx');
const wound = read('src/screens/pflege/WoundCareScreen.web.tsx');

test('Boundary is immutable, exact and cannot be promoted to recall evidence', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Reflect.ownKeys(value), [
    'capability', 'batchIdentity', 'expiryDate', 'stockPosition', 'quarantineEvent',
    'disposalEvent', 'recallEvent', 'careExecutionRelation', 'applicationEvidence',
    'recallImpactSearch', 'purchaseDateMeaning', 'warrantyMeaning', 'locationMeaning',
    'genericAuditMeaning', 'sourceQuality',
  ]);
  assert.equal(value.capability, 'no_batch_or_expiry_traceability');
  for (const key of ['batchIdentity', 'expiryDate', 'stockPosition', 'quarantineEvent', 'disposalEvent', 'recallEvent', 'careExecutionRelation', 'applicationEvidence']) {
    assert.equal(value[key], 'not_provided');
  }
  assert.equal(value.recallImpactSearch, 'not_verifiable');
  assert.equal(value.purchaseDateMeaning, 'durable_asset_acquisition_only');
  assert.equal(value.warrantyMeaning, 'durable_asset_warranty_only');
  assert.equal(value.locationMeaning, 'durable_asset_location_only');
  assert.equal(value.genericAuditMeaning, 'not_a_structured_batch_ledger');
  assert.equal(value.sourceQuality, 'declared_current_web_contract_not_native_original_history');
  assert.throws(() => { value.batchIdentity = 'provided'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

for (const [label, contract] of [['InventoryItem DTO', itemType], ['Create input DTO', createType], ['inventory_items table', itemTable]]) {
  test(`${label} has no batch, expiry, stock-position or recall contract`, () => {
    assert.ok(contract.length > 100);
    for (const token of ['batch_id', 'batch_number', 'lot_id', 'lot_number', 'expiry_date', 'expiration_date', 'best_before_at', 'stock_position_id', 'recall_id']) {
      assert.doesNotMatch(contract, new RegExp(`\\b${token}\\b`, 'i'));
    }
  });
}

test('Purchase, warranty and asset location remain explicit durable-asset fields only', () => {
  assert.match(itemType, /purchaseDate\?: string \| null/);
  assert.match(itemType, /warrantyUntil\?: string \| null/);
  assert.match(itemType, /locationId\?: string \| null/);
  assert.match(itemTable, /purchase_date\s+DATE/);
  assert.match(itemTable, /warranty_until\s+DATE/);
  assert.match(itemTable, /location_id\s+UUID/);
  assert.doesNotMatch(source, /purchaseDate\s*[<>=]|warrantyUntil\s*[<>=]|Date\s*\(/);
});

test('Generic inventory audit is not a structured batch, recall, quarantine or disposal ledger', () => {
  assert.match(auditTable, /action\s+TEXT\s+NOT NULL/);
  assert.match(auditTable, /metadata\s+JSONB/);
  for (const token of ['batch_id', 'lot_id', 'recall_id', 'quarantine_event_id', 'disposal_event_id', 'client_id', 'visit_id', 'execution_id']) {
    assert.doesNotMatch(auditTable, new RegExp(`\\b${token}\\b`, 'i'));
  }
});

test('Repository exposes no batch stock, recall or documented-application table', () => {
  for (const tableName of ['inventory_batches', 'inventory_stock_positions', 'inventory_recalls', 'inventory_quarantines', 'inventory_disposals', 'inventory_applications']) {
    assert.doesNotMatch(repository, new RegExp(`['\"]${tableName}['\"]`));
  }
});

test('Wound material free text is not promoted to a batch application', () => {
  assert.match(wound, /Geplantes Material wird nicht als verbraucht übernommen/);
  assert.match(wound, /erstellt keine automatische Freigabe, Bestandsbuchung oder Abrechnung/);
  assert.doesNotMatch(wound, /\b(?:batchId|batchNumber|lotId|lotNumber|expiryDate|recallId)\b/);
});

test('Visible boundary has no query, write, RPC, clock or inferred expiry arithmetic', () => {
  assert.match(panel, /Kaufdatum, Garantiefrist und Lagerort/);
  assert.match(panel, /Rückruf, Sperrung, Entsorgung und betroffene Versorgungen/);
  for (const content of [source, panel]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
});
