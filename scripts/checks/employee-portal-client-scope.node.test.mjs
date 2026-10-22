import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { buildEmployeePortalClientScope } from '../../src/lib/portal/employeePortalClientScope.ts';

const id = (n) => `${String(n).padStart(8, '0')}-7777-4777-8777-777777777777`;
const row = (patch = {}) => ({
  id: id(10),
  tenant_id: id(1),
  client_id: id(3),
  employee_id: id(2),
  employee_portal_visible: true,
  planning_status: 'published',
  planned_start_at: '2026-10-14T08:00:00.123456Z',
  canonical_status: 'scheduled',
  client_visible_notes: 'Nur einsatzbezogener Hinweis',
  title: 'Zugewiesener Einsatz',
  ...patch,
});

test('eigene sichtbare Zuweisungen bilden ausschließlich ihre nativen Pflegefall-IDs ab', () => {
  const value = buildEmployeePortalClientScope(id(1), id(2), [row(), row({ id: id(11), client_id: id(4) })]);
  assert.deepEqual(value.clientIds, [id(3), id(4)]);
  assert.equal(value.source, 'own_visible_assignments_only');
  assert.equal(value.visits.length, 2);
});

test('mehrere eigene Einsätze desselben Pflegefalls erweitern den Pflegefallumfang nicht', () => {
  const value = buildEmployeePortalClientScope(id(1), id(2), [row(), row({ id: id(11) })]);
  assert.deepEqual(value.clientIds, [id(3)]);
  assert.equal(value.visits.length, 2);
});

test('ohne eigene Zuweisung entsteht kein tenantweites Klientenverzeichnis', () => {
  const value = buildEmployeePortalClientScope(id(1), id(2), []);
  assert.deepEqual(value.clientIds, []);
  assert.deepEqual(value.visits, []);
});

for (const [label, patch] of [
  ['fremder Mandant', { tenant_id: id(9) }],
  ['fremde Mitarbeitendenidentität', { employee_id: id(9) }],
  ['verborgener Einsatz', { employee_portal_visible: false }],
  ['Planungsentwurf', { planning_status: 'draft' }],
]) {
  test(`${label} verwirft den gesamten Zuweisungssnapshot`, () => {
    assert.throws(() => buildEmployeePortalClientScope(id(1), id(2), [row(), row({ id: id(11), ...patch })]), /fremd, verborgen oder unvollständig/);
  });
}

test('ungültige native Identität, Einsatzzeit und doppelte Einsatz-ID werden verweigert', () => {
  assert.throws(() => buildEmployeePortalClientScope(id(1), id(2), [row({ client_id: 'Anzeige' })]), /unvollständig/);
  assert.throws(() => buildEmployeePortalClientScope(id(1), id(2), [row({ planned_start_at: 'irgendwann' })]), /unvollständig/);
  assert.throws(() => buildEmployeePortalClientScope(id(1), id(2), [row(), row()]), /doppelt/);
});

test('Zuweisungssnapshot und Ergebnislisten bleiben unveränderlich', () => {
  const value = buildEmployeePortalClientScope(id(1), id(2), [row()]);
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.clientIds), true);
  assert.equal(Object.isFrozen(value.visits), true);
  assert.equal(Object.isFrozen(value.visits[0]), true);
});

test('Live-Service filtert serverseitig auf eigene Mitarbeitenden-ID und lädt nur abgeleitete Pflegefälle', async () => {
  const service = await fs.readFile(new URL('../../src/lib/portal/employeePortalClientRecordsService.web.ts', import.meta.url), 'utf8');
  assert.match(service, /loadEmployeeClientVisits\(tenantId, employeeId\)/);
  assert.match(service, /\.eq\('employee_id', employeeId\)/);
  assert.match(service, /loadClientsByIds\(tenantId, clientIds\)/);
  assert.match(service, /fetchLivePortalAppointmentsForEmployee\(tenantId, employeeId\)/);
  assert.match(service, /visitsResult\.error === EMPLOYEE_PORTAL_SCOPE_ERROR/);
  assert.match(service, /item\.employeeId !== employeeId/);
  assert.match(service, /!clientIds\.includes\(row\.id\)/);
  assert.match(service, /!isEmployeePortalScopeId\(item\.clientId\)/);
  assert.doesNotMatch(service, /loadAllTenantClients|fetchLivePortalAppointmentsForEmployeeTeam/);
});

test('Detailpfad bleibt im eigenen Einsatzumfang und gibt nur Primär- oder Notfallkontakte weiter', async () => {
  const service = await fs.readFile(new URL('../../src/lib/portal/employeePortalClientRecordsService.web.ts', import.meta.url), 'utf8');
  assert.match(service, /const base = list\.data\.find\(\(item\) => item\.clientId === clientId\)/);
  assert.match(service, /if \(!base\) return \{ ok: true, data: null \}/);
  assert.match(service, /row\.is_emergency_contact === true \|\| row\.is_primary_contact === true/);
});

test('RLS-Patch entfernt tenantweite Lesepolicies und bindet Klienten, Adressen, Kontakte und Einsätze an die eigene Zuweisung', async () => {
  const sql = await fs.readFile(new URL('../../supabase/patches/ambulatory_employee_portal_scope.sql', import.meta.url), 'utf8');
  for (const token of [
    /DROP POLICY IF EXISTS clients_portal_employee_team_records_select/,
    /DROP POLICY IF EXISTS clients_portal_employee_team_calendar_select/,
    /DROP POLICY IF EXISTS assist_visits_portal_employee_team_select/,
    /employee_id = public\.resolve_current_employee_id\(\)/,
    /employee_portal_visible = TRUE/,
    /planning_status <> 'draft'/,
    /is_primary_contact = TRUE OR is_emergency_contact = TRUE/,
    /DROP POLICY IF EXISTS client_documents_portal_employee_select/,
    /DROP POLICY IF EXISTS client_intake_documents_portal_employee_select/,
    /portal_visible = TRUE/,
    /sensitivity NOT IN \('internal', 'restricted'\)/,
  ]) assert.match(sql, token);
  assert.doesNotMatch(sql, /FROM public\.assignments/);
  assert.doesNotMatch(sql, /FOR\s+(?:INSERT|UPDATE|DELETE)/i);
});
