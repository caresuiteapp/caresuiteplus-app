import type { SupabaseClient } from '@supabase/supabase-js';
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type {
  CompanyOrganizationScope, CompanyOrganizationResult, CompanyOrganizationSnapshot, CompanyOrganizationPermissions,
  CompanyOrganizationKind, CompanyOrganizationRecord, CompanyLegalEntity, CompanySite, CompanyDepartment,
  CompanyEmployeePlacement, CompanyRelationship, CompanyLegalEntityInput, CompanySiteInput, CompanyDepartmentInput,
  CompanyEmployeePlacementInput, CompanyRelationshipInput,
} from '@/types/tenant/companyOrganization';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { TENANT_SETTINGS_PERMISSION } from './tenantSettingsRoute';
import { loadCompanyAccess } from './companyAccessService.web';

type Row = Record<string, unknown>;
type Db = NonNullable<ReturnType<typeof getSupabaseClient>>;
const PAGE = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TABLES = { entity: 'company_legal_entities', site: 'company_sites', department: 'company_departments', placement: 'company_employee_placements', relationship: 'company_relationships' } as const;
const inFlight = new Set<string>();
class OrganizationError extends Error {
  constructor(message: string, readonly conflict = false) { super(message); }
}
const asRow = (value: unknown): Row | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
const camel = (key: string) => key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
const snake = (key: string) => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

export function getCompanyOrganizationPermissions(role: RoleKey | null | undefined, effectivePermissions?: readonly PermissionKey[]): CompanyOrganizationPermissions {
  const can = (permission: PermissionKey) => enforcePermission(role, permission, { effectivePermissions }) === null;
  const manage = can(TENANT_SETTINGS_PERMISSION);
  const viewEmployees = can('office.employees.view');
  return { view: manage, manage, viewEmployees, managePlacements: manage && viewEmployees };
}

function connection(scope: CompanyOrganizationScope, placement = false): Db {
  const permissions = getCompanyOrganizationPermissions(scope.actorRoleKey, scope.effectivePermissions);
  if (!permissions.manage || (placement && !permissions.managePlacements)) throw new OrganizationError('Für diese Unternehmensdaten fehlt Ihnen die Berechtigung.');
  const denied = guardServiceTenant(scope.tenantId);
  if (denied) throw new OrganizationError(denied.error);
  if (!UUID.test(scope.tenantId)) throw new OrganizationError('Das Unternehmen konnte nicht eindeutig zugeordnet werden.');
  if (getServiceMode() !== 'supabase') throw new OrganizationError('Die Unternehmensstruktur benötigt eine aktive Datenbankverbindung. Es werden keine Beispieldaten verwendet.');
  const db = getSupabaseClient();
  if (!db) throw new OrganizationError('Die Datenbankverbindung ist nicht verfügbar. Bitte erneut laden.');
  return db;
}

function failure<T>(error: unknown, attempted = false): CompanyOrganizationResult<T> {
  const row = asRow(error);
  const code = typeof row?.code === 'string' ? row.code : '';
  const setupRequired = ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(code);
  const conflict = error instanceof OrganizationError ? error.conflict : code === '40001';
  const serverMessage = typeof row?.message === 'string' ? row.message : '';
  const validationMessage = code === '23514' && /^(Die |Der |Das |Diese |Für |Standort |Abteilung |Personalzugriff |Ungültige |Eingabefeld )/.test(serverMessage) ? serverMessage : null;
  const rollbackConfirmed = Boolean(code);
  const uncertain = attempted && !rollbackConfirmed;
  const message = setupRequired ? 'Die Unternehmensstruktur ist auf dem Server noch nicht eingerichtet. Bitte die vorbereitete Aktualisierung bereitstellen.'
    : conflict ? 'Dieser Eintrag wurde inzwischen geändert. Bitte neu laden und Ihre Angaben vergleichen.'
      : validationMessage ?? (code === '23505' ? serverMessage.includes('company_main_site') ? 'Für diese Gesellschaft besteht bereits ein aktiver Hauptsitz.' : 'Dieser Organisationscode wird bereits verwendet. Bitte einen anderen Code wählen.'
        : code === '23503' ? 'Eine ausgewählte Zuordnung ist nicht mehr verfügbar. Bitte neu laden und die Zuordnung prüfen.'
          : code === '42501' ? 'Für diesen Eintrag oder die gewählte Zuordnung fehlt Ihnen die Berechtigung.'
            : error instanceof OrganizationError ? error.message : toGermanSupabaseError(error));
  return { ok: false, error: uncertain && !conflict ? `${message} Bitte laden Sie die Liste neu und prüfen Sie den Speicherstand, bevor Sie den Vorgang wiederholen.` : message,
    conflict, setupRequired, reloadRequired: uncertain || conflict };
}

function mapRecord<T extends CompanyOrganizationRecord>(value: unknown, tenantId: string): T {
  const row = asRow(value);
  if (!row || !UUID.test(String(row.id ?? '')) || row.tenant_id !== tenantId || !Number.isInteger(row.version) || Number(row.version) < 1
    || !['active', 'inactive', 'archived'].includes(String(row.status)) || typeof row.created_at !== 'string' || typeof row.updated_at !== 'string') {
    throw new OrganizationError('Die Datenbankantwort enthält keinen gültigen Unternehmenseintrag. Bitte erneut laden.');
  }
  return Object.fromEntries(Object.entries(row).map(([key, item]) => [camel(key), item])) as T;
}

async function rows(db: Db, scope: CompanyOrganizationScope, table: string, select = '*'): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    connection(scope);
    const { data, error } = await fromUnknownTable(db, table).select(select).eq('tenant_id', scope.tenantId).order('id').range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!Array.isArray(data) || data.some(value => !asRow(value))) throw new OrganizationError('Die Unternehmensdaten konnten nicht vollständig gelesen werden.');
    result.push(...data.map(value => asRow(value)!));
    if (data.length < PAGE) return result;
  }
}

async function choices(db: Db, scope: CompanyOrganizationScope, kind: 'employees' | 'cost_centers'): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    connection(scope);
    const response = await (db as SupabaseClient).rpc('company_organization_choices', { p_tenant_id: scope.tenantId, p_kind: kind, p_offset: offset });
    if (response.error) throw response.error;
    if (!Array.isArray(response.data) || response.data.some(value => !asRow(value) || !UUID.test(String(value.id ?? '')))) throw new OrganizationError('Die Auswahllisten konnten nicht vollständig geladen werden.');
    result.push(...response.data as Row[]);
    if (response.data.length < PAGE) return result;
  }
}

export async function loadCompanyOrganization(scope: CompanyOrganizationScope): Promise<CompanyOrganizationResult<CompanyOrganizationSnapshot>> {
  try {
    const db = connection(scope);
    const access = await loadCompanyAccess(scope.tenantId);
    if (!access.ok) return { ok: false, error: access.error };
    const authorizedScope = { ...scope, effectivePermissions: access.data.permissions };
    const permissions = getCompanyOrganizationPermissions(scope.actorRoleKey, access.data.permissions);
    if (!permissions.view) throw new OrganizationError('Für diese Unternehmensdaten fehlt Ihnen die Berechtigung.');
    const employeesVisible = permissions.viewEmployees;
    const [entities, sites, departments, placements, relationships, employees, costCenters, audit] = await Promise.all([
      rows(db, authorizedScope, TABLES.entity), rows(db, authorizedScope, TABLES.site), rows(db, authorizedScope, TABLES.department),
      employeesVisible ? rows(db, authorizedScope, TABLES.placement) : Promise.resolve([]), rows(db, authorizedScope, TABLES.relationship),
      employeesVisible ? choices(db, authorizedScope, 'employees') : Promise.resolve([]),
      choices(db, authorizedScope, 'cost_centers'), access.data.scopeLimited ? Promise.resolve([]) : rows(db, authorizedScope, 'company_organization_audit'),
    ]);
    return { ok: true, data: {
      entities: entities.map(row => mapRecord<CompanyLegalEntity>(row, scope.tenantId)),
      sites: sites.map(row => mapRecord<CompanySite>(row, scope.tenantId)),
      departments: departments.map(row => mapRecord<CompanyDepartment>(row, scope.tenantId)),
      placements: placements.map(row => mapRecord<CompanyEmployeePlacement>(row, scope.tenantId)),
      relationships: relationships.map(row => mapRecord<CompanyRelationship>(row, scope.tenantId)), employeesVisible,
      permissions, scopeLimited: access.data.scopeLimited, canManageEntities: permissions.manage && !access.data.scopeLimited,
      employees: employees.map(row => ({ id: String(row.id), firstName: String(row.first_name ?? ''), lastName: String(row.last_name ?? ''), status: String(row.status ?? '') })),
      costCenters: costCenters.map(row => ({ id: String(row.id), code: String(row.code), name: String(row.name), isActive: row.is_active === true })),
      audit: audit.map(row => ({ id: String(row.id), kind: row.record_kind as CompanyOrganizationKind, recordId: String(row.record_id),
        action: row.action as CompanyOrganizationSnapshot['audit'][number]['action'], actorId: String(row.actor_id), createdAt: String(row.created_at), version: Number(row.version) })),
    } };
  } catch (error) { return failure(error); }
}

function validDate(value: unknown, label: string) {
  if (value == null || value === '') return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)
    throw new OrganizationError(`${label}: Bitte ein gültiges Datum eingeben.`);
}

function validate(kind: CompanyOrganizationKind, input: Row, archive = false): Row {
  if (input.id != null && (!UUID.test(String(input.id)) || !Number.isInteger(input.expectedVersion) || Number(input.expectedVersion) < 1))
    throw new OrganizationError('Der aktuelle Speicherstand fehlt. Bitte den Eintrag neu laden.');
  if (archive) return { status: 'archived' };
  for (const [key, value] of Object.entries(input)) {
    if (key.endsWith('Id') && value != null && value !== '' && !UUID.test(String(value))) throw new OrganizationError('Eine ausgewählte Zuordnung ist ungültig. Bitte neu auswählen.');
    if (typeof value === 'string' && value.length > (['notes', 'responsibilities', 'openingHours'].includes(key) ? 4000 : ['name', 'partnerName'].includes(key) ? 200 : 500)) throw new OrganizationError('Ein Eingabefeld ist zu lang. Bitte kürzen Sie Ihre Angaben.');
  }
  if (!['placement', 'relationship'].includes(kind) && !String(input.name ?? '').trim()) throw new OrganizationError('Bitte eine Bezeichnung eingeben.');
  if (input.status != null && !['active', 'inactive', 'archived'].includes(String(input.status))) throw new OrganizationError('Bitte einen gültigen Status auswählen.');
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email))) throw new OrganizationError('Bitte eine gültige E-Mail-Adresse eingeben.');
  if (input.website && !/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(String(input.website))) throw new OrganizationError('Die Internetadresse muss mit https:// oder http:// beginnen.');
  if (['entity', 'site'].includes(kind) && !/^[A-Za-z]{2}$/.test(String(input.country ?? 'DE'))) throw new OrganizationError('Bitte ein zweistelliges Länderkürzel eingeben.');
  validDate(input.startsOn, 'Beginn'); validDate(input.endsOn, 'Ende');
  if (input.startsOn && input.endsOn && String(input.endsOn) < String(input.startsOn)) throw new OrganizationError('Das Ende darf nicht vor dem Beginn liegen.');
  for (const key of ['allocationPercent', 'ownershipPercent']) if (input[key] != null && (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || Number(input[key]) < 0 || Number(input[key]) > 100)) throw new OrganizationError('Prozentangaben müssen zwischen 0 und 100 liegen.');
  if (kind === 'site' && !['headquarters', 'branch', 'office', 'service', 'warehouse', 'other'].includes(String(input.kind))) throw new OrganizationError('Bitte eine Standortart auswählen.');
  if (kind === 'placement') {
    if (!input.employeeId || !input.startsOn) throw new OrganizationError('Bitte eine Person und ein Anfangsdatum auswählen.');
    if (!input.entityId && !input.siteId && !input.departmentId) throw new OrganizationError('Bitte mindestens ein Unternehmen, einen Standort oder eine Abteilung zuordnen.');
    if (typeof input.isPrimary !== 'boolean') throw new OrganizationError('Bitte Hauptzuordnung oder weitere Zuordnung auswählen.');
  }
  if (kind === 'relationship') {
    if (!['subsidiary', 'holding', 'franchise', 'cooperation'].includes(String(input.kind))) throw new OrganizationError('Bitte die Art der Verbindung auswählen.');
    if (!String(input.partnerName ?? '').trim()) throw new OrganizationError('Bitte den Partner benennen.');
    if (input.partnerEntityId && input.partnerEntityId === input.entityId) throw new OrganizationError('Ein Unternehmen kann nicht sein eigener Partner sein.');
  }
  if ((input.id && input.parentEntityId === input.id) || (input.id && input.parentDepartmentId === input.id)) throw new OrganizationError('Ein Eintrag kann sich nicht selbst übergeordnet sein.');
  return Object.fromEntries(Object.entries(input).filter(([key]) => !['id', 'expectedVersion'].includes(key)).map(([key, value]) => [snake(key), typeof value === 'string' ? value.trim() || null : value]));
}

async function save<T extends CompanyOrganizationRecord>(scope: CompanyOrganizationScope, kind: CompanyOrganizationKind, input: object, archive = false): Promise<CompanyOrganizationResult<T>> {
  let attempted = false;
  const lock = `${scope.tenantId}:${scope.actorProfileId ?? scope.actorRoleKey}`;
  let locked = false;
  try {
    const db = connection(scope, kind === 'placement');
    const record = input as Row;
    const data = validate(kind, record, archive);
    if (inFlight.has(lock)) throw new OrganizationError('Eine Änderung wird bereits gespeichert. Bitte kurz warten.');
    inFlight.add(lock); locked = true;
    attempted = true;
    const response = await (db as SupabaseClient).rpc('company_organization_save', {
      p_tenant_id: scope.tenantId, p_kind: kind, p_id: record.id ?? null,
      p_expected_version: record.expectedVersion ?? null, p_data: data,
    });
    if (response.error) throw response.error;
    const result = mapRecord<T>(response.data, scope.tenantId);
    if (record.id && result.id !== record.id) throw new OrganizationError('Der gespeicherte Eintrag konnte nicht bestätigt werden.');
    if (record.expectedVersion && result.version !== Number(record.expectedVersion) + 1) throw new OrganizationError('Die gespeicherte Version konnte nicht bestätigt werden.');
    return { ok: true, data: result };
  } catch (error) { return failure(error, attempted); }
  finally { if (locked) inFlight.delete(lock); }
}

export const saveCompanyLegalEntity = (scope: CompanyOrganizationScope, input: CompanyLegalEntityInput) => save<CompanyLegalEntity>(scope, 'entity', input);
export const saveCompanySite = (scope: CompanyOrganizationScope, input: CompanySiteInput) => save<CompanySite>(scope, 'site', input);
export const saveCompanyDepartment = (scope: CompanyOrganizationScope, input: CompanyDepartmentInput) => save<CompanyDepartment>(scope, 'department', input);
export const saveCompanyEmployeePlacement = (scope: CompanyOrganizationScope, input: CompanyEmployeePlacementInput) => save<CompanyEmployeePlacement>(scope, 'placement', input);
export const saveCompanyRelationship = (scope: CompanyOrganizationScope, input: CompanyRelationshipInput) => save<CompanyRelationship>(scope, 'relationship', input);
export const archiveCompanyOrganization = (scope: CompanyOrganizationScope, kind: CompanyOrganizationKind, id: string, expectedVersion: number) => save<CompanyOrganizationRecord>(scope, kind, { id, expectedVersion }, true);
