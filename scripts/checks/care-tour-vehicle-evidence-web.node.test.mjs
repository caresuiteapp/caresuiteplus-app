import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

async function loadEvidence() {
  const source = await read('src/lib/pflege/careTourVehicleEvidence.web.ts');
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}#${Date.now()}`);
}

test('vehicle boundary is immutable and rejects planned-trip inference', async () => {
  const { getCareTourVehicleEvidence } = await loadEvidence();
  const evidence = getCareTourVehicleEvidence();
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.missingEvidence));
  assert.equal(evidence.plannedLabelMayStandForCompletedTrip, false);
  assert.equal(evidence.employeeAssignmentMayStandForDriverQualification, false);
  assert.strictEqual(getCareTourVehicleEvidence(), evidence);
});

test('tour schema has an optional vehicle reference that remains unbound by the workflow', async () => {
  const sql = await read('supabase/migrations/20260812210000_pfleger_operations_workspace_live_r1.sql');
  const tours = sql.match(/CREATE TABLE IF NOT EXISTS public\.care_tours \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(tours, /vehicle_label_snapshot TEXT NOT NULL DEFAULT ''/);
  assert.match(tours, /vehicle_inventory_item_id UUID REFERENCES public\.inventory_items\(id\)/);
  assert.match(tours, /employee_id UUID/);
  assert.doesNotMatch(tours, /driver_id|odometer|mileage|trip_purpose|handover|custody/i);
});

test('tour creation copies free vehicle text without availability or suitability lock', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const create = sql.match(/CREATE OR REPLACE FUNCTION care_private\.create_tour\([\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(create, /vehicle_label_snapshot/);
  assert.match(create, /p_payload->>'vehicleLabel'/);
  assert.doesNotMatch(create, /vehicle_inventory_item_id|FROM public\.(?:vehicles|fleet_vehicles|inventory_items)|odometer|mileage|driver_license/i);
});

test('tour event history has no trip or odometer evidence', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const events = sql.match(/CREATE TABLE IF NOT EXISTS public\.care_tour_events \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(events, /action text NOT NULL/);
  assert.doesNotMatch(events, /vehicle_id|driver_id|odometer|mileage|trip_purpose|handover|custody/i);
});

test('tour completion does not validate a trip or contradictory mileage', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const advance = sql.match(/CREATE OR REPLACE FUNCTION care_private\.advance_tour\([\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(advance, /r\.status='in_progress' AND p_status='completed'/);
  assert.doesNotMatch(advance, /odometer|mileage|kilometer|trip_purpose|vehicle_id|driver_id/i);
});

test('tour service maps only the vehicle label and assigned employee', async () => {
  const service = await read('src/lib/pflege/careTourPlanningService.ts');
  const tourType = service.match(/export type CareTour = \{[\s\S]*?\n\};/)?.[0] ?? '';
  assert.match(tourType, /employeeId: string \| null/);
  assert.match(tourType, /vehicleLabel: string/);
  assert.doesNotMatch(tourType, /vehicleId|driverId|odometer|mileage|tripPurpose|handover|custody/);
});

test('planning UI accepts free vehicle text without asserting completed travel', async () => {
  const screen = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  assert.match(screen, /label="Fahrzeug \/ Kennzeichen"/);
  assert.match(screen, /value=\{vehicleLabel\}/);
  assert.doesNotMatch(screen, /Kilometerstand|Fahrtzweck|Fahrzeug-ID|Führerschein|Übergabe|Rückgabe/);
});

test('visible Web/Desktop boundary is integrated without query write or native behaviour change', async () => {
  const screen = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  const web = await read('src/components/pflege/CareTourVehicleEvidencePanel.web.tsx');
  const native = await read('src/components/pflege/CareTourVehicleEvidencePanel.tsx');
  assert.match(screen, /<CareTourVehicleEvidencePanel \/>/);
  assert.match(web, /Fahrzeuglabel ist kein Fahrtenbuch/);
  assert.match(web, /Fahrt und Kilometer getrennt nachweisen/);
  assert.doesNotMatch(web, /supabase|\.from\(|\.rpc\(|useAsyncQuery|Date\.now|new Date/);
  assert.match(native, /return null/);
});
