import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

async function loadEvidence() {
  const source = await read('src/lib/pflege/careFleetMaintenanceEvidence.web.ts');
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}#${Date.now()}`);
}

test('fleet maintenance boundary is immutable and rejects status or label inference', async () => {
  const { getCareFleetMaintenanceEvidence } = await loadEvidence();
  const evidence = getCareFleetMaintenanceEvidence();
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.missingEvidence));
  assert.equal(evidence.currentStatusMayStandForMaintenanceHistory, false);
  assert.equal(evidence.labelMayStandForAvailability, false);
  assert.strictEqual(getCareFleetMaintenanceEvidence(), evidence);
});

test('tour schema has a vehicle reference while inventory provides vehicle category and current status', async () => {
  const toursSql = await read('supabase/migrations/20260812210000_pfleger_operations_workspace_live_r1.sql');
  const inventorySql = await read('supabase/migrations/0135_inventory_prepared.sql');
  const tours = toursSql.match(/CREATE TABLE IF NOT EXISTS public\.care_tours \([\s\S]*?\n\);/)?.[0] ?? '';
  const categories = inventorySql.match(/CREATE TABLE IF NOT EXISTS public\.inventory_categories \([\s\S]*?\n\);/)?.[0] ?? '';
  const items = inventorySql.match(/CREATE TABLE IF NOT EXISTS public\.inventory_items \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(tours, /vehicle_inventory_item_id UUID REFERENCES public\.inventory_items\(id\)/);
  assert.match(categories, /'vehicles'/);
  assert.match(items, /'maintenance'/);
  assert.match(items, /'damaged'/);
  assert.match(items, /'decommissioned'/);
});

test('tour creation ignores the native vehicle reference and accepts only a free label', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const create = sql.match(/CREATE OR REPLACE FUNCTION care_private\.create_tour\([\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(create, /p_payload->>'vehicleLabel'/);
  assert.doesNotMatch(create, /vehicle_inventory_item_id|FROM public\.inventory_items/);
});

test('tour publication has no inventory availability or maintenance guard', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const advance = sql.match(/CREATE OR REPLACE FUNCTION care_private\.advance_tour\([\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(advance, /r\.status='draft' AND p_status='published'/);
  assert.doesNotMatch(advance, /inventory_items|vehicle_inventory_item_id|maintenance|decommissioned|damaged/);
});

test('inventory item is current state without maintenance due date or inspection ledger', async () => {
  const sql = await read('supabase/migrations/0135_inventory_prepared.sql');
  const items = sql.match(/CREATE TABLE IF NOT EXISTS public\.inventory_items \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(items, /status\s+TEXT/);
  assert.doesNotMatch(items, /maintenance_due_at|inspection_result|inspection_at|out_of_service_(?:from|until)|replacement_vehicle_id/i);
});

test('care-tour service exposes label but not vehicle identity status or maintenance evidence', async () => {
  const service = await read('src/lib/pflege/careTourPlanningService.ts');
  const tourType = service.match(/export type CareTour = \{[\s\S]*?\n\};/)?.[0] ?? '';
  assert.match(tourType, /vehicleLabel: string/);
  assert.doesNotMatch(tourType, /vehicleInventoryItemId|vehicleStatus|maintenanceDueAt|inspectionResult|replacementVehicleId/);
});

test('vehicle inventory screen remains separate from care-tour release', async () => {
  const inventory = await read('src/screens/inventory/InventoryListScreen.tsx');
  const tour = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  assert.match(inventory, /maintenance: 'In Wartung'/);
  assert.match(tour, /Fahrzeug \/ Kennzeichen/);
  assert.doesNotMatch(tour, /inventory_items|vehicle_inventory_item_id|categoryGroupFilter="vehicles"/);
});

test('visible Web/Desktop boundary is integrated without query write or native behaviour change', async () => {
  const screen = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  const web = await read('src/components/pflege/CareFleetMaintenanceEvidencePanel.web.tsx');
  const native = await read('src/components/pflege/CareFleetMaintenanceEvidencePanel.tsx');
  assert.match(screen, /<CareFleetMaintenanceEvidencePanel \/>/);
  assert.match(web, /Inventarstatus ist keine Wartungsfreigabe/);
  assert.match(web, /Nicht verfügbare Fahrzeuge vor Freigabe sperren/);
  assert.doesNotMatch(web, /supabase|\.from\(|\.rpc\(|useAsyncQuery|Date\.now|new Date/);
  assert.match(native, /return null/);
});
