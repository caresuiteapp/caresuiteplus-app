import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const source = read('src/lib/inventory/inventoryMedicalDeviceMaintenanceBoundary.web.ts');
const getBoundary = new Function(strip(source.replace(/^export type[\s\S]*?\n\}>;\n/m, '').replace(/\bexport /g, '')) + ';return getInventoryMedicalDeviceMaintenanceBoundaryWeb;')();
const types = read('src/types/inventory/index.ts');
const itemType = types.match(/export type InventoryItem = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const createType = types.match(/export type CreateInventoryItemInput = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const mdmType = types.match(/export type DeviceManagementProfile = \{([\s\S]*?)\n\};/)?.[1] ?? '';
const migration = read('supabase/migrations/0135_inventory_prepared.sql');
const table = (name) => migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${name} \\(([\\s\\S]*?)\\n\\);`))?.[1] ?? '';
const itemTable = table('inventory_items');
const mdmTable = table('device_management_profiles');
const auditTable = table('inventory_audit_events');
const repository = read('src/lib/inventory/inventoryRepository.supabase.ts');
const panel = read('src/screens/inventory/InventoryConsumablesBoundaryPanel.web.tsx');

test('Boundary is immutable and denies inferred maintenance, instruction and release', () => {
  const value = getBoundary();
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Reflect.ownKeys(value), [
    'capability', 'medicalDeviceClassification', 'maintenanceEvent', 'maintenanceHistory',
    'maintenanceDueAt', 'inspectionOrCalibration', 'instructionRecord',
    'instructionQualification', 'releaseDecision', 'plannedUseRelation',
    'unapprovedUseObjection', 'inventoryStatusMeaning', 'serialManufacturerModelMeaning',
    'mdmProfileMeaning', 'sourceQuality',
  ]);
  assert.equal(value.capability, 'no_medical_device_maintenance_or_release_contract');
  for (const key of ['medicalDeviceClassification', 'maintenanceEvent', 'maintenanceHistory', 'maintenanceDueAt', 'inspectionOrCalibration', 'instructionRecord', 'instructionQualification', 'releaseDecision', 'plannedUseRelation']) {
    assert.equal(value[key], 'not_provided');
  }
  assert.equal(value.unapprovedUseObjection, 'not_verifiable');
  assert.equal(value.inventoryStatusMeaning, 'current_asset_state_not_maintenance_evidence');
  assert.equal(value.serialManufacturerModelMeaning, 'durable_asset_identification_only');
  assert.equal(value.mdmProfileMeaning, 'device_management_not_medical_device_release');
  assert.throws(() => { value.releaseDecision = 'provided'; }, TypeError);
  assert.strictEqual(getBoundary(), value);
});

for (const [label, contract] of [['InventoryItem DTO', itemType], ['Create input DTO', createType], ['inventory_items table', itemTable]]) {
  test(`${label} has no maintenance, inspection, instruction or release contract`, () => {
    assert.ok(contract.length > 100);
    for (const token of ['medical_device_class', 'maintenance_event_id', 'maintenance_due_at', 'inspection_at', 'calibration_at', 'instruction_id', 'instruction_at', 'released_at', 'released_by', 'use_plan_id']) {
      assert.doesNotMatch(contract, new RegExp(`\\b${token}\\b`, 'i'));
    }
  });
}

test('Asset identity, warranty and current status do not prove maintenance or approval', () => {
  assert.match(itemType, /serialNumber\?: string \| null/);
  assert.match(itemType, /manufacturer\?: string \| null/);
  assert.match(itemType, /model\?: string \| null/);
  assert.match(itemType, /warrantyUntil\?: string \| null/);
  assert.match(itemTable, /'maintenance'/);
  assert.doesNotMatch(source, /status\s*[<>=]|warrantyUntil\s*[<>=]|Date\s*\(/);
});

test('MDM profile remains endpoint management, not regulated-device maintenance or release', () => {
  assert.match(mdmType, /mdmStatus: 'not_configured' \| 'enrolled' \| 'pending' \| 'removed'/);
  assert.match(mdmTable, /remote_lock_prepared/);
  assert.match(mdmTable, /remote_wipe_prepared/);
  for (const token of ['maintenance_due_at', 'inspection_at', 'calibration_at', 'instruction_id', 'released_at']) {
    assert.doesNotMatch(mdmTable, new RegExp(`\\b${token}\\b`, 'i'));
  }
});

test('Generic audit cannot replace an append-only medical-device maintenance ledger', () => {
  assert.match(auditTable, /action\s+TEXT\s+NOT NULL/);
  assert.match(auditTable, /metadata\s+JSONB/);
  for (const token of ['maintenance_event_id', 'inspection_id', 'calibration_id', 'instruction_id', 'release_id', 'use_plan_id']) {
    assert.doesNotMatch(auditTable, new RegExp(`\\b${token}\\b`, 'i'));
  }
});

test('Repository exposes no native maintenance, instruction, release or planned-use table', () => {
  for (const tableName of ['medical_devices', 'device_maintenance_events', 'device_inspections', 'device_calibrations', 'device_instructions', 'device_releases', 'device_use_plans']) {
    assert.doesNotMatch(repository, new RegExp(`['\"]${tableName}['\"]`));
  }
});

test('Visible boundary has no query, write, RPC, clock or inferred release arithmetic', () => {
  assert.match(panel, /Gerätekategorie, Seriennummer, Hersteller, Modell/);
  assert.match(panel, /geplante Nutzung eines nicht freigegebenen Geräts/);
  for (const content of [source, panel]) {
    assert.doesNotMatch(content, /\b(?:fetch|insert|update|delete|upsert|rpc)\s*\(/);
    assert.doesNotMatch(content, /Date\.now|new Date|Math\.|setTimeout|setInterval/);
  }
});
