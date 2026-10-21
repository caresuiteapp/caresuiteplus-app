import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/inventory/inventoryConsumablesBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\};\n/m, '').replace(/\bexport /g, '')) + ';return getInventoryConsumablesBoundaryWeb;')();
const itemType = read('src/types/inventory/index.ts').match(/export type InventoryItem = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const createType = read('src/types/inventory/index.ts').match(/export type CreateInventoryItemInput = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const migration = read('supabase/migrations/0135_inventory_prepared.sql');
const itemTable = migration.match(/CREATE TABLE IF NOT EXISTS public\.inventory_items \(([\s\S]*?)\n\);/)?.[1] ?? '';
const assignmentTable = migration.match(/CREATE TABLE IF NOT EXISTS public\.inventory_assignments \(([\s\S]*?)\n\);/)?.[1] ?? '';
const repository = read('src/lib/inventory/inventoryRepository.supabase.ts');
const panel = read('src/screens/inventory/InventoryConsumablesBoundaryPanel.web.tsx');
const dashboard = read('src/screens/inventory/InventoryDashboardScreen.web.tsx');
const wound = read('src/screens/pflege/WoundCareScreen.web.tsx');

test('Boundary is immutable, exact and cannot be promoted to stock evidence', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Reflect.ownKeys(value), [
    'capability', 'itemIdentity', 'quantity', 'unit', 'minimumStock', 'supplierRelation',
    'stockLedger', 'consumptionEvent', 'visitRelation', 'duplicateConsumptionGuard', 'sourceQuality',
  ]);
  assert.equal(value.capability, 'durable_asset_inventory_only');
  assert.equal(value.itemIdentity, 'individual_inventory_item');
  for (const key of ['quantity', 'unit', 'minimumStock', 'supplierRelation', 'stockLedger', 'consumptionEvent', 'visitRelation']) {
    assert.equal(value[key], 'not_provided');
  }
  assert.equal(value.duplicateConsumptionGuard, 'not_verifiable');
  assert.equal(value.sourceQuality, 'declared_current_web_contract_not_native_original_history');
  assert.throws(() => { value.quantity = 'provided'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

for (const [label, contract] of [['InventoryItem DTO', itemType], ['Create input DTO', createType], ['inventory_items table', itemTable]]) {
  test(`${label} has no consumable quantity, unit, minimum-stock or supplier contract`, () => {
    assert.ok(contract.length > 100);
    for (const token of ['quantity', 'stock_quantity', 'unit', 'minimum_stock', 'min_stock', 'supplier_id']) {
      assert.doesNotMatch(contract, new RegExp(`\\b${token}\\b`, 'i'));
    }
  });
}

test('Assignment table has employee issue identity but no client visit or consumption idempotency relation', () => {
  assert.match(assignmentTable, /item_id\s+UUID/);
  assert.match(assignmentTable, /recipient_employee_id\s+UUID/);
  for (const token of ['client_id', 'visit_id', 'service_id', 'consumption_id', 'idempotency_key', 'quantity']) {
    assert.doesNotMatch(assignmentTable, new RegExp(`\\b${token}\\b`, 'i'));
  }
});

test('Current repository reads asset items and assignments without inventing a consumables table', () => {
  assert.match(repository, /'inventory_items'/);
  assert.match(repository, /'inventory_assignments'/);
  assert.doesNotMatch(repository, /'inventory_(?:consumptions|stock_movements|suppliers)'/);
});

test('Wound material documentation explicitly does not create a stock booking', () => {
  assert.match(wound, /erstellt keine automatische Freigabe, Bestandsbuchung oder Abrechnung/);
});

test('Web dashboard mounts the boundary panel without a write, RPC or new data query', () => {
  assert.match(dashboard, /<InventoryConsumablesBoundaryPanel \/>/);
  assert.doesNotMatch(panel, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
  assert.match(panel, /keine native Mengeneinheit/);
  assert.match(panel, /doppelte Abbuchung/);
});

test('Boundary implementation contains no clock, inferred arithmetic, record ids or mutable input', () => {
  for (const token of ['Date\\.now', 'Math\\.', '\\btenantId\\b', '\\bclientId\\b', '\\bvisitId\\b', '\\bitemId\\b', 'quantity\\s*[-+]']) {
    assert.doesNotMatch(source, new RegExp(token));
  }
});
