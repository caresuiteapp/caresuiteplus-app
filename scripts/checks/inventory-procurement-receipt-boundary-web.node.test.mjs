import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/inventory/inventoryProcurementReceiptBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getInventoryProcurementReceiptBoundaryWeb;')();
const types = read('src/types/inventory/index.ts');
const repository = read('src/lib/inventory/inventoryRepository.supabase.ts');
const migration = read('supabase/migrations/0135_inventory_prepared.sql');
const panel = read('src/screens/inventory/InventoryConsumablesBoundaryPanel.web.tsx');

test('Procurement boundary is immutable and forbids availability from order state', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.equal(value.capability, 'durable_asset_register_not_procurement_or_stock');
  assert.equal(value.availabilityFromOrderStatus, 'forbidden');
  assert.equal(value.actualReceiptProof, 'not_verifiable');
  assert.throws(() => { value.actualReceiptProof = 'verified'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Current inventory types expose individual assets but no procurement quantities', () => {
  assert.match(types, /export type InventoryItem =/);
  assert.match(types, /purchaseDate\?: string \| null/);
  const item = types.match(/export type InventoryItem = \{([\s\S]*?)\n\};/)?.[1] ?? '';
  assert.ok(item.length > 500);
  assert.doesNotMatch(item, /(?:supplier|vendor|orderedQuantity|receivedQuantity|delivery|goodsReceipt|invoice)(?:\??:|Id\??:)/i);
});

test('Prepared inventory schema has no procurement or goods-receipt tables', () => {
  const tables = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS public\.([a-z0-9_]+)/g)].map(match => match[1]);
  assert.deepEqual(tables, [
    'inventory_categories',
    'inventory_locations',
    'inventory_items',
    'inventory_assignments',
    'inventory_return_records',
    'inventory_damage_reports',
    'inventory_return_protocols',
    'device_management_profiles',
    'inventory_audit_events',
  ]);
  assert.ok(tables.every(table => !/(?:purchase_order|order_line|delivery|goods_receipt|stock_movement|supplier_invoice)/.test(table)));
});

test('Inventory item schema cannot record ordered, received or difference quantity', () => {
  const table = migration.match(/CREATE TABLE IF NOT EXISTS public\.inventory_items \(([\s\S]*?)\n\);/)?.[1] ?? '';
  assert.ok(table.length > 900);
  assert.match(table, /purchase_date\s+DATE/);
  assert.match(table, /status\s+TEXT/);
  assert.doesNotMatch(table, /supplier_id|vendor_id|ordered_quantity|received_quantity|delivery_id|goods_receipt_id|difference_quantity|supplier_invoice_id|stock_quantity/i);
});

test('Repository writes assets and returns but no procurement or receipt ledger', () => {
  const tableCalls = [...repository.matchAll(/fromUnknownTable\(supabase, '([^']+)'\)/g)].map(match => match[1]);
  assert.ok(tableCalls.includes('inventory_items'));
  assert.ok(tableCalls.includes('inventory_return_records'));
  assert.ok(tableCalls.every(table => !/(?:purchase_order|order_line|delivery|goods_receipt|stock_movement|supplier_invoice)/.test(table)));
  assert.doesNotMatch(repository, /ordered_quantity|received_quantity|goods_receipt|supplier_invoice|stock_movement/i);
});

test('Asset creation marks one item available without representing a goods receipt', () => {
  const create = repository.match(/async createItem\([\s\S]*?\n  \},\n\n  async updateItem/)?.[0] ?? '';
  assert.ok(create.length > 1000);
  assert.match(create, /status: 'available'/);
  assert.match(create, /fromUnknownTable\(supabase, 'inventory_items'\)/);
  assert.doesNotMatch(create, /supplier|purchase_order|delivery|goods_receipt|ordered_quantity|received_quantity|stock_movement|invoice/i);
});

test('Visible boundary separates purchase metadata from actual receipt evidence', () => {
  assert.match(panel, /Bestellungen und Lieferungen · Nachweisgrenze/);
  assert.match(panel, /Kaufdatum, Hersteller, Notiz und der Status/);
  assert.match(panel, /nicht als verfügbar gewertet/);
  assert.match(panel, /tatsächliches Wareneingangsereignis/);
  assert.match(panel, /nachvollziehbare Bestandsbuchung/);
});

test('Boundary display has no query, write, clock or inferred receipt completion', () => {
  const visible = panel.match(/Bestellungen und Lieferungen · Nachweisgrenze[\s\S]*?procurementBoundary\.availabilityFromOrderStatus\}<\/Text>/)?.[0] ?? '';
  assert.ok(visible.length > 700);
  for (const content of [source, visible]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
  assert.doesNotMatch(source, /status\s*[:=]\s*['"](?:received|completed|approved|released)['"]/);
});
