import type { PermissionKey } from '@/types/permissions';
import type { CompanyAssetLink, CompanyAssetLinkInput, CompanyContract, CompanyContractInput, CompanyInsuranceInput, CompanyInsurancePolicy, CompanyResourceDeadline, CompanyResourceKind, CompanyResourceResult, CompanyResourceScope, CompanyResourcesSnapshot, CompanyVehicle, CompanyVehicleAllocation, CompanyVehicleAllocationInput, CompanyVehicleInput, CompanyVehicleReturnInput } from '@/types/tenant/companyResources';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { TENANT_SETTINGS_PERMISSION } from './tenantSettingsRoute';

export type { CompanyResourceScope, CompanyResourceResult, CompanyResourcesSnapshot } from '@/types/tenant/companyResources';
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const pending = new Set<string>();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const intervals = ['once', 'monthly', 'quarterly', 'half_yearly', 'yearly'];

export function getCompanyResourcesPermissions(scope: CompanyResourceScope) {
  const can = (key: PermissionKey) => enforcePermission(scope.actorRoleKey, key, { effectivePermissions: scope.effectivePermissions }) === null;
  return { view: can(TENANT_SETTINGS_PERMISSION), manage: can(TENANT_SETTINGS_PERMISSION), viewEmployees: can('office.employees.view'), viewDocuments: can('office.documents.view'), viewInventory: can('inventory.view') };
}
function assertScope(scope: CompanyResourceScope) {
  const denied = enforcePermission(scope.actorRoleKey, TENANT_SETTINGS_PERMISSION, { effectivePermissions: scope.effectivePermissions });
  if (denied && !denied.ok) throw new Error(denied.error);
  const invalid = guardServiceTenant(scope.tenantId); if (invalid) throw new Error(invalid.error);
  if (!uuid.test(scope.tenantId)) throw new Error('Der Mandant ist ungültig.');
  if (getServiceMode() !== 'supabase') throw new Error('Unternehmensressourcen benötigen eine aktive Datenbankverbindung. Es werden keine Beispieldaten verwendet.');
}
function snake(value: unknown): Json {
  if (Array.isArray(value)) return value.map(snake);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([key, v]) => [key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`), snake(v)]));
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
  throw new Error('Ungültige Eingabe.');
}
function camel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camel);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), camel(v)]));
  return value;
}
function validate(input: object) {
  for (const [key, value] of Object.entries(input)) {
    if (value == null || value === '') continue;
    if ((key === 'id' || /Id$/.test(key)) && (typeof value !== 'string' || !uuid.test(value))) throw new Error('Eine Verknüpfung ist ungültig. Bitte erneut auswählen.');
    if (/On$/.test(key)) {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error('Bitte ein gültiges Datum eingeben.');
    }
    if (/At$/.test(key) && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) throw new Error('Bitte einen gültigen Zeitpunkt eingeben.');
    if (/Cents$/.test(key) && (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 9000000000000)) throw new Error('Geldbeträge müssen positive Centbeträge sein.');
    if (/mileage/i.test(key) && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000000)) throw new Error('Bitte einen gültigen Kilometerstand eingeben.');
    if (typeof value === 'string' && value.length > 12000) throw new Error('Ein Text ist zu lang. Bitte auf höchstens 12.000 Zeichen kürzen.');
  }
  const v = input as Record<string, unknown>;
  if (v.id && (!Number.isInteger(v.expectedVersion) || Number(v.expectedVersion) < 1)) throw new Error('Der Versionsstand fehlt. Bitte den Eintrag neu laden.');
  if (v.startsOn && v.endsOn && String(v.endsOn) < String(v.startsOn)) throw new Error('Das Ende darf nicht vor dem Beginn liegen.');
  if (v.startsAt && v.endsAt && Date.parse(String(v.endsAt)) <= Date.parse(String(v.startsAt))) throw new Error('Das Ende muss nach dem Beginn liegen.');
  if (v.paymentInterval && !intervals.includes(String(v.paymentInterval))) throw new Error('Bitte einen gültigen Zahlungsrhythmus auswählen.');
}
async function call<T>(scope: CompanyResourceScope, name: string, args: Record<string, unknown>, write = false): Promise<CompanyResourceResult<T>> {
  let locked = false; let sent = false;
  try {
    assertScope(scope);
    if (write) { if (pending.has(scope.tenantId)) throw new Error('Ein Vorgang wird bereits gespeichert. Bitte kurz warten.'); pending.add(scope.tenantId); locked = true; }
    const db = getSupabaseClient(); if (!db) throw new Error('Die Datenbankverbindung ist nicht verfügbar.');
    assertScope(scope); sent = true;
    const { data, error } = await db.rpc(name as never, { p_tenant: scope.tenantId, ...args } as never);
    if (error) {
      const code = String(error.code ?? ''); const message = String(error.message ?? '');
      const unavailable = ['PGRST202', '42883', '42P01'].includes(code);
      const conflict = code === '40001' || code === '23P01';
      return { ok: false, unavailable, conflict, error: unavailable ? 'Dieser Bereich ist auf dem Server noch nicht eingerichtet. Vor dem ersten Speichern muss die Unternehmenserweiterung freigegeben sein.' : conflict ? 'Der Eintrag wurde inzwischen geändert oder das Fahrzeug ist bereits vergeben. Bitte neu laden und prüfen.' : code === '42501' ? 'Für diesen Vorgang fehlt die Berechtigung.' : ['23505', '23503'].includes(code) ? 'Die Verknüpfung ist nicht mehr verfügbar oder der Eintrag existiert bereits. Bitte neu laden.' : code === 'P0001' || code === '22023' ? message : 'Der Vorgang konnte nicht bestätigt werden. Bitte neu laden und prüfen.', reloadRequired: !unavailable && write };
    }
    if (data == null) return { ok: false, error: 'Der Server hat den Vorgang nicht bestätigt. Bitte neu laden.', reloadRequired: write };
    return { ok: true, data: camel(data) as T };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Der Vorgang konnte nicht abgeschlossen werden.', reloadRequired: write && sent }; }
  finally { if (locked) pending.delete(scope.tenantId); }
}
export async function loadCompanyResources(scope: CompanyResourceScope): Promise<CompanyResourceResult<CompanyResourcesSnapshot>> {
  return call(scope, 'company_resources_snapshot', {});
}
async function save<T>(scope: CompanyResourceScope, kind: CompanyResourceKind, input: object): Promise<CompanyResourceResult<T>> {
  try { validate(input); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Bitte Eingaben prüfen.' }; }
  return call(scope, 'company_resources_save', { p_kind: kind, p_input: snake(input) }, true);
}
export const saveCompanyContract = (scope: CompanyResourceScope, input: CompanyContractInput) => save<CompanyContract>(scope, 'contract', input);
export const saveCompanyInsurancePolicy = (scope: CompanyResourceScope, input: CompanyInsuranceInput) => save<CompanyInsurancePolicy>(scope, 'insurance', input);
export const saveCompanyVehicle = (scope: CompanyResourceScope, input: CompanyVehicleInput) => save<CompanyVehicle>(scope, 'vehicle', input);
export const saveCompanyVehicleAllocation = (scope: CompanyResourceScope, input: CompanyVehicleAllocationInput) => save<CompanyVehicleAllocation>(scope, 'allocation', input);
export const saveCompanyAssetLink = (scope: CompanyResourceScope, input: CompanyAssetLinkInput) => save<CompanyAssetLink>(scope, 'asset', input);
export function returnCompanyVehicle(scope: CompanyResourceScope, input: CompanyVehicleReturnInput) {
  try { validate(input); } catch (error) { return Promise.resolve<CompanyResourceResult<CompanyVehicleAllocation>>({ ok: false, error: error instanceof Error ? error.message : 'Bitte Eingaben prüfen.' }); }
  return call<CompanyVehicleAllocation>(scope, 'company_resources_return_vehicle', { p_input: snake(input) }, true);
}
export function archiveCompanyResource(scope: CompanyResourceScope, kind: CompanyResourceKind, id: string, expectedVersion: number) {
  return save<CompanyContract | CompanyInsurancePolicy | CompanyVehicle | CompanyVehicleAllocation | CompanyAssetLink>(scope, kind, { id, expectedVersion, archive: true });
}
export function linkCompanyLogbookVehicle(scope: CompanyResourceScope, input: { vehicleId: string; logbookVehicleId: string; expectedVersion: number }) {
  try { validate(input); if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw new Error('Bitte den Fahrzeugstand neu laden.'); } catch (error) { return Promise.resolve<CompanyResourceResult<CompanyVehicle>>({ ok: false, error: error instanceof Error ? error.message : 'Bitte Eingaben prüfen.' }); }
  return call<CompanyVehicle>(scope, 'company_resources_link_logbook', { p_input: snake(input) }, true);
}
/** Explicit stored dates only; no legal notice calculation and no claim of dispatched reminders. */
export function getCompanyResourceDeadlines(snapshot: CompanyResourcesSnapshot, today = new Date().toISOString().slice(0, 10)): CompanyResourceDeadline[] {
  const deadlines: CompanyResourceDeadline[] = [];
  const add = (kind: CompanyResourceDeadline['resourceKind'], id: string, title: string, label: string, date: string | null) => { if (date) { const dueOn = date.slice(0, 10); deadlines.push({ id: `${kind}:${id}:${label}`, resourceKind: kind, resourceId: id, title, label, dueOn, overdue: dueOn < today }); } };
  snapshot.contracts.filter(x => x.status === 'active').forEach(x => { add('contract', x.id, x.title, 'Kündigungstermin', x.noticeOn); add('contract', x.id, x.title, 'Vertragsende', x.endsOn); add('contract', x.id, x.title, 'Wiedervorlage', x.reviewOn); });
  snapshot.policies.filter(x => x.status === 'active').forEach(x => { add('insurance', x.id, x.title, 'Kündigungstermin', x.noticeOn); add('insurance', x.id, x.title, 'Versicherungsende', x.endsOn); add('insurance', x.id, x.title, 'Prüfung', x.reviewOn); });
  snapshot.vehicles.filter(x => x.status !== 'archived').forEach(x => { add('vehicle', x.id, x.plate, 'Hauptuntersuchung', x.huDueOn); add('vehicle', x.id, x.plate, 'Wartung', x.serviceDueOn); add('vehicle', x.id, x.plate, 'Leasingende', x.leaseEndsOn); });
  snapshot.allocations.filter(x => ['active', 'planned'].includes(x.status)).forEach(x => add('allocation', x.id, snapshot.vehicles.find(v => v.id === x.vehicleId)?.plate ?? 'Fahrzeug', 'Fahrzeugrückgabe', x.endsAt));
  return deadlines.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title, 'de'));
}
