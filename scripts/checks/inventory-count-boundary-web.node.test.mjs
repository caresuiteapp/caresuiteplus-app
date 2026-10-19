import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/inventory/inventoryCountBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getInventoryCountBoundaryWeb;')();
const types = read('src/types/inventory/index.ts');
const repository = read('src/lib/inventory/inventoryRepository.supabase.ts');
const migration = read('supabase/migrations/0135_inventory_prepared.sql');
const panel = read('src/screens/inventory/InventoryConsumablesBoundaryPanel.web.tsx');

test('Count boundary is immutable and forbids silent quantity overwrite', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.equal(value.assetLocation, 'provided_for_individual_asset');
  assert.equal(value.silentQuantityOverwrite, 'forbidden');
  assert.equal(value.physicalCountProof, 'not_verifiable');
  assert.throws(() => { value.silentQuantityOverwrite = 'allowed'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

test('Location type identifies a place but contains no stock quantity', () => {
  const location = types.match(/export type InventoryLocation = \{([\s\S]*?)\n\};/)?.[1] ?? '';
  assert.ok(location.length > 100);
  assert.match(location, /label: string/);
  assert.match(location, /building\?: string \| null/);
  assert.match(location, /room\?: string \| null/);
  assert.doesNotMatch(location, /quantity|expected|counted|variance|adjustment|approved/i);
});

test('Item location relation carries no warehouse quantity or count evidence', () => {
  const item = types.match(/export type InventoryItem = \{([\s\S]*?)\n\};/)?.[1] ?? '';
  assert.match(item, /locationId\?: string \| null/);
  assert.doesNotMatch(item, /quantity|expectedStock|countedStock|inventoryCount|variance|adjustment/i);
});

test('Prepared schema has an asset location table but no inventory-count ledger', () => {
  const tables = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS public\.([a-z0-9_]+)/g)].map(match => match[1]);
  assert.ok(tables.includes('inventory_locations'));
  assert.ok(tables.includes('inventory_items'));
  assert.ok(tables.every(table => !/(?:inventory_count|count_line|stock_count|stock_movement|inventory_adjustment)/.test(table)));
});

test('Location and item tables cannot store expected, counted or variance quantity', () => {
  const locations = migration.match(/CREATE TABLE IF NOT EXISTS public\.inventory_locations \(([\s\S]*?)\n\);/)?.[1] ?? '';
  const items = migration.match(/CREATE TABLE IF NOT EXISTS public\.inventory_items \(([\s\S]*?)\n\);/)?.[1] ?? '';
  assert.match(locations, /label\s+TEXT/);
  assert.match(items, /location_id\s+UUID/);
  for (const table of [locations, items]) {
    assert.doesNotMatch(table, /expected_quantity|counted_quantity|variance_quantity|counted_at|counted_by|approved_by|adjustment_id/i);
  }
});

test('Repository exposes location listing and item location update only', () => {
  const locationRead = repository.match(/async listLocations\([\s\S]*?\n  \},/)?.[0] ?? '';
  assert.match(locationRead, /fromUnknownTable\(supabase, 'inventory_locations'\)/);
  assert.match(repository, /rowPatch\.location_id = patch\.locationId/);
  assert.doesNotMatch(repository, /expected_quantity|counted_quantity|variance_quantity|inventory_count|stock_movement|inventory_adjustment/i);
});

test('Visible boundary separates asset locations from physical counting', () => {
  assert.match(panel, /Lagerorte und Inventur · Nachweisgrenze/);
  assert.match(panel, /weder Sollbestand noch gezählter Bestand/);
  assert.match(panel, /belegt keine tatsächliche Inventur/);
  assert.match(panel, /Zählereignis, Zählposition, Soll-\/Ist-Menge, Abweichung, Freigabe und Korrekturbuchung fehlen/);
  assert.match(panel, /weder aus Status oder Objektzahl berechnet noch durch stilles Ändern/);
});

test('Boundary display has no query, write, clock or inferred count completion', () => {
  const visible = panel.match(/Lagerorte und Inventur · Nachweisgrenze[\s\S]*?countBoundary\.silentQuantityOverwrite\}<\/Text>/)?.[0] ?? '';
  assert.ok(visible.length > 650);
  for (const content of [source, visible]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
  assert.doesNotMatch(source, /status\s*[:=]\s*['"](?:counted|approved|completed|corrected)['"]/);
});
