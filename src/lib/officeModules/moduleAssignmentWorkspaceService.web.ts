import type { PermissionKey, ProductKey, RoleKey, WorkflowStatus } from '@/types';
import type { ModuleAssignmentSection } from '@/lib/officeCore/types';
import { demoTenant } from '@/data/demo/tenant';
import { officeCoreDemoRepository } from '@/lib/officeCore/demoRepository';
import { getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';
import { ROLE_LABELS } from '@/data/constants/roleLabels';
import { resolveAuthenticatedProfileId } from '@/lib/auth/resolveAuthenticatedProfile';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/supabase/config';
import { fetchTenantProfile } from '@/lib/supabase/tenantService';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { loadCompanyAccess } from '@/lib/tenant/companyAccessService.web';
import { CENTRAL_CATALOG_INDEX } from '@/data/seeds/documentCatalog/centralCatalogIndex';
import { countModuleAssignmentDocumentInventory } from './moduleAssignmentInventory.web';
import { hasEffectiveModuleGateAccess } from '@/lib/modules/moduleAccessService';
import { isUnreleasedCatalogModuleKey } from '@/lib/modules/constants';
import { INVOICE_MODULES } from '@/lib/office/invoiceModules';

export type ModuleAssignmentWorkspaceScope = { authUserId: string; profileId: string; tenantId: string; roleKey: RoleKey | null };
export type ModuleAssignmentWorkspaceAction = { label: string; route: string };
export type ModuleAssignmentInventorySnapshot = { count: number | null; state: 'ready' | 'restricted' | 'error'; error?: string; action: ModuleAssignmentWorkspaceAction | null };
export type ModuleAssignmentWorkspaceItem = { id: string; title: string; subtitle: string; meta?: string; moduleKey: ProductKey; status: WorkflowStatus; active: boolean; actions: ModuleAssignmentWorkspaceAction[] };
export type ModuleAssignmentSectionSnapshot = { key: ModuleAssignmentSection; count: number | null; activeCount: number | null; state: 'ready' | 'restricted' | 'error'; error?: string; action: ModuleAssignmentWorkspaceAction | null; inventory: ModuleAssignmentInventorySnapshot };
export type ModuleAssignmentWorkspaceSnapshot = { tenantId: string; tenantName: string; source: 'live' | 'demo'; loadedAt: string; sections: ModuleAssignmentSectionSnapshot[]; section: ModuleAssignmentSection | null; items: ModuleAssignmentWorkspaceItem[]; warnings: string[] };
export type ModuleAssignmentWorkspaceErrorCode = 'identity' | 'permission' | 'connection' | 'unavailable';
export type ModuleAssignmentWorkspaceResult = { ok: true; data: ModuleAssignmentWorkspaceSnapshot } | { ok: false; error: string; code: ModuleAssignmentWorkspaceErrorCode };

type Client = NonNullable<ReturnType<typeof getSupabaseClient>>;
type Row = Record<string, unknown>;
type Failure = Extract<ModuleAssignmentWorkspaceResult, { ok: false }>;
type Access = { ok: true; permissions: Set<PermissionKey> };
const fail = (code: ModuleAssignmentWorkspaceErrorCode, error: string): Failure => ({ ok: false, code, error });
const IDENTITY_ERROR = 'Das angemeldete Konto oder Unternehmen hat sich geändert. Bitte laden Sie die Zuordnungen erneut.';
const READ_ERROR = 'Die gespeicherten Zuordnungen konnten nicht vollständig geladen werden. Bitte erneut versuchen.';
const PERMISSION_ERROR = 'Für diese Zuordnungen fehlt Ihnen die Berechtigung.';
const KEYS: ModuleAssignmentSection[] = ['clients', 'employees', 'services', 'documents', 'templates', 'permissions', 'billing'];
const TABLES: Record<ModuleAssignmentSection, string> = { clients: 'client_module_assignments', employees: 'employee_module_assignments', services: 'module_service_catalog', documents: 'module_document_visibility', templates: 'module_template_assignments', permissions: 'module_permission_profiles', billing: 'module_billing_sources' };
const VIEW: Record<ModuleAssignmentSection, PermissionKey> = { clients: 'office.clients.view', employees: 'office.employees.view', services: 'office.catalogs.view', documents: 'office.documents.view', templates: 'office.catalogs.view', permissions: 'business.tenant.manage', billing: 'office.invoices.view' };
const INVENTORY_VIEW: Record<ModuleAssignmentSection, PermissionKey> = { ...VIEW, templates: 'office.documents.view' };
const REQUIRED: PermissionKey[] = [...new Set<PermissionKey>(['office.access', ...Object.values(VIEW), 'office.clients.edit', 'office.employees.edit'])];
const COMPANY_PERMISSIONS: readonly PermissionKey[] = ['office.employees.view', 'office.employees.edit', 'office.documents.view', 'business.tenant.manage'];
const BASE = 'id,tenant_id,module_key,status';
const COLUMNS: Record<ModuleAssignmentSection, string> = {
  clients: `${BASE},is_active,client_id,assigned_at,primary_employee_id`,
  employees: `${BASE},employee_id,role_in_module,assigned_at`,
  services: `${BASE},service_code,service_name,billing_category,unit_price_cents`,
  documents: `${BASE},document_id,document_title,visibility`,
  templates: `${BASE},template_id,template_name,template_category`,
  permissions: `${BASE},profile_name,role_key,can_view,can_edit,can_export`,
  billing: `${BASE},source_label,source_type,linked_invoice_id`,
};
const PRODUCTS = new Set<ProductKey>(['office', 'assist', 'pflege', 'beratung', 'stationaer', 'akademie']);
const STATUSES: Record<string, WorkflowStatus> = { active: 'aktiv', enabled: 'aktiv', assigned: 'aktiv', aktiv: 'aktiv', draft: 'entwurf', entwurf: 'entwurf', prepared: 'in_bearbeitung', in_progress: 'in_bearbeitung', in_bearbeitung: 'in_bearbeitung', completed: 'abgeschlossen', abgeschlossen: 'abgeschlossen', archived: 'archiviert', inactive: 'archiviert', deactivated: 'archiviert', disabled: 'archiviert', archiviert: 'archiviert', error: 'fehlerhaft', fehlerhaft: 'fehlerhaft', blocked: 'gesperrt', locked: 'gesperrt', gesperrt: 'gesperrt', planned: 'geplant', geplant: 'geplant', confirmed: 'bestaetigt', bestaetigt: 'bestaetigt' };
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const object = (value: unknown): value is Row => value !== null && typeof value === 'object' && !Array.isArray(value);

function rowState(row: Row, tenantId: string, section: ModuleAssignmentSection) {
  if (!text(row.id) || row.tenant_id !== tenantId || !PRODUCTS.has(row.module_key as ProductKey) || !STATUSES[text(row.status)] || section === 'clients' && row.is_active != null && typeof row.is_active !== 'boolean') throw new Error(READ_ERROR);
  const status = section === 'clients' && row.is_active === false ? 'archiviert' : STATUSES[text(row.status)];
  // The portal's live membership contract uses is_active independently of workflow status.
  const active = section === 'clients' && typeof row.is_active === 'boolean' ? row.is_active : status === 'aktiv';
  return { id: text(row.id), moduleKey: row.module_key as ProductKey, status, active };
}

/** Counted, stable pages: a partial server page must never become an apparently complete total. */
type InventoryFilters = { systemAndTenant?: boolean; excludeDeleted?: boolean; excludeDeletedAt?: boolean; modules?: readonly string[]; archiveOrder?: boolean };
async function readPages(client: Client, tenantId: string, table: string, columns: string, ids?: readonly string[], filters: InventoryFilters = {}): Promise<Row[]> {
  const rows: Row[] = [], seen = new Set<string>();
  let total: number | null = null;
  for (let offset = 0; offset < 50_000; offset += 250) {
    let query = fromUnknownTable(client, table).select(columns, { count: 'exact' });
    query = filters.systemAndTenant ? query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`) : query.eq('tenant_id', tenantId);
    if (filters.excludeDeleted) query = query.neq('status', 'deleted');
    if (filters.excludeDeletedAt) query = query.is('deleted_at', null);
    if (filters.modules) query = query.in('module_key', [...filters.modules]);
    if (ids) query = query.in('id', [...ids]);
    const ordered = filters.archiveOrder ? query.order('updated_at', { ascending: false, nullsFirst: true }).order('id', { ascending: false }) : query.order('id', { ascending: true });
    const result = await ordered.range(offset, offset + 249);
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || Number(result.count) < 0 || total !== null && total !== result.count) throw new Error(READ_ERROR);
    total = result.count;
    for (const value of result.data) {
      if (!object(value) || !text(value.id) || !(value.tenant_id === tenantId || filters.systemAndTenant && value.tenant_id === null) || seen.has(String(value.id))
        || filters.modules && !filters.modules.includes(String(value.module_key))) throw new Error(READ_ERROR);
      seen.add(String(value.id)); rows.push(value);
    }
    if (rows.length === total) return rows;
    if (rows.length > Number(total) || result.data.length < 250) throw new Error(READ_ERROR);
  }
  throw new Error('Die Zuordnungen sind für diese Ansicht zu umfangreich. Bitte wenden Sie sich an Ihre Verwaltung.');
}

/** Only merge identity metadata is needed: no document bodies or separate person-name lookup. */
async function readDocumentInventoryCount(client: Client, tenantId: string): Promise<number> {
  const [stored, intake] = await Promise.all([
    readPages(client, tenantId, 'client_documents', 'id,tenant_id,client_id,title,file_name,source,intake_document_id,updated_at', undefined, { archiveOrder: true }),
    readPages(client, tenantId, 'client_intake_documents', 'id,tenant_id,client_id,template_key,document_type,title,status,updated_at', undefined, { archiveOrder: true }),
  ]);
  return countModuleAssignmentDocumentInventory(stored, intake, tenantId);
}

/** Source inventory is independent from explicit module assignments and never creates or backfills any rows. */
const getCatalogModules = (tenantId: string) => INVOICE_MODULES.filter(module => !isUnreleasedCatalogModuleKey(module.key) && hasEffectiveModuleGateAccess(module.key, tenantId)).map(module => module.key);
async function readInventory(client: Client | null, tenantId: string, section: ModuleAssignmentSection, permissions: Set<PermissionKey>, catalogModules: readonly string[] | null): Promise<ModuleAssignmentInventorySnapshot> {
  if (!permissions.has(INVENTORY_VIEW[section])) return { count: null, state: 'restricted', error: 'Für diesen Bestand fehlt Ihnen die Berechtigung.', action: null };
  const action = inventoryAction(section, permissions);
  try {
    if (section === 'templates') return { count: CENTRAL_CATALOG_INDEX.length, state: 'ready', action };
    if (!client) return { count: null, state: 'error', error: 'Dieser Bestand wird in der Demo nicht geladen.', action: null };
    let count: number;
    if (section === 'documents') count = await readDocumentInventoryCount(client, tenantId);
    else {
      const modules = section === 'services' ? catalogModules ?? [] : undefined;
      const table = { clients: 'clients', employees: 'employees', services: 'tenant_service_catalog', permissions: 'role_templates', billing: 'invoices' }[section];
      const rows = modules?.length === 0 ? [] : await readPages(client, tenantId, table, `id,tenant_id${modules ? ',module_key' : ''}`, undefined,
        { systemAndTenant: section === 'permissions', excludeDeleted: section === 'clients' || section === 'employees', excludeDeletedAt: section === 'employees', modules });
      count = rows.length;
    }
    return { count, state: 'ready', action };
  } catch { return { count: null, state: 'error', error: 'Der Bestand konnte nicht vollständig geladen werden. Bitte erneut versuchen.', action }; }
}

async function readNames(client: Client, tenantId: string, table: 'clients' | 'employees', input: string[]) {
  const ids = [...new Set(input.filter(Boolean))], result = new Map<string, string>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const rows = await readPages(client, tenantId, table, 'id,tenant_id,first_name,last_name', ids.slice(offset, offset + 100));
    for (const row of rows) {
      if (!ids.includes(String(row.id))) throw new Error(READ_ERROR);
      const name = [text(row.first_name), text(row.last_name)].filter(Boolean).join(' ');
      result.set(String(row.id), name || 'Name nicht hinterlegt');
    }
  }
  return result;
}

/** No role defaults or permission cache in live mode. Server grants are narrowed by current overrides. */
async function readConfirmedScope(client: Client, scope: ModuleAssignmentWorkspaceScope): Promise<Access | Failure> {
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== scope.authUserId) return fail('identity', IDENTITY_ERROR);
  const [resolved, profile, company] = await Promise.all([resolveAuthenticatedProfileId(scope.tenantId), fetchTenantProfile(scope.authUserId), loadCompanyAccess(scope.tenantId)]);
  if (!resolved.ok || resolved.data !== scope.profileId || !profile || profile.id !== scope.profileId || profile.tenantId !== scope.tenantId || !profile.roleKey || profile.roleKey !== scope.roleKey || profile.roleKey.endsWith('_portal')) return fail('identity', IDENTITY_ERROR);
  if (!company.ok) return fail('unavailable', company.error);
  if (company.data.scopeLimited) return fail('permission', 'Für diese unternehmensweite Übersicht benötigen Sie Zugriff ohne Bereichsbeschränkung.');
  const results = await Promise.all(REQUIRED.map(async permission => {
    const result = await client.rpc('has_permission', { p_permission_key: permission });
    if (result.error || typeof result.data !== 'boolean') throw new Error('Die Berechtigungen konnten nicht geprüft werden.');
    return [permission, result.data] as const;
  }));
  const permissions = new Set(results.filter(([, allowed]) => allowed).map(([permission]) => permission));
  // These permissions have a newer, authoritative evaluator, including employee overrides.
  for (const permission of COMPANY_PERMISSIONS) {
    if (company.data.permissions.includes(permission)) permissions.add(permission); else permissions.delete(permission);
  }
  if (!profile.roleId) return fail('unavailable', 'Die Berechtigungen konnten nicht eindeutig geprüft werden.');
  const role = await client.from('roles').select('key').eq('id', profile.roleId).maybeSingle();
  if (role.error || !text(role.data?.key)) return fail('unavailable', 'Die Berechtigungen konnten nicht eindeutig geprüft werden.');
  const overrides = await client.from('role_permission_sets').select('permission_key').eq('tenant_id', scope.tenantId).eq('role_key', role.data!.key);
  if (overrides.error || !Array.isArray(overrides.data)) return fail('unavailable', 'Die Berechtigungen konnten nicht geprüft werden.');
  if (overrides.data.length) {
    const granted = new Set(overrides.data.map(row => row.permission_key));
    // company_access_permissions already evaluates additional roles and direct grants.
    // Other keys remain conservatively intersected with the legacy RLS permission grant.
    for (const permission of permissions) if (!COMPANY_PERMISSIONS.includes(permission) && !granted.has(permission)) permissions.delete(permission);
  }
  // fetchTenantProfile deliberately has no employee link. Resolve the real link,
  // and distinguish a missing link from an existing row hidden by personnel RLS.
  const [employeeIdentity, employee] = await Promise.all([
    client.rpc('current_employee_id_from_profile'),
    client.from('employees').select('id,tenant_id,profile_id,status').eq('tenant_id', scope.tenantId).eq('profile_id', scope.profileId).maybeSingle(),
  ]);
  if (employeeIdentity.error || employee.error || employeeIdentity.data != null && !text(employeeIdentity.data)
    || (employeeIdentity.data ?? null) !== (employee.data?.id ?? null)
    || employee.data && (employee.data.tenant_id !== scope.tenantId || employee.data.profile_id !== scope.profileId || !['active', 'aktiv'].includes(String(employee.data.status)))) return fail('unavailable', 'Die persönliche Zuordnung konnte nicht eindeutig geprüft werden.');
  if (employee.data) {
    const overridesResult = await fromUnknownTable(client, 'employee_permission_overrides').select('permission_key,allowed,valid_from,valid_until').eq('tenant_id', scope.tenantId).eq('employee_id', employee.data.id);
    if (overridesResult.error || !Array.isArray(overridesResult.data)) return fail('unavailable', 'Die persönlichen Berechtigungen konnten nicht geprüft werden.');
    const now = Date.now();
    for (const row of overridesResult.data) {
      if (!object(row) || typeof row.allowed !== 'boolean' || !text(row.permission_key)) return fail('unavailable', 'Die persönlichen Berechtigungen konnten nicht geprüft werden.');
      const from = row.valid_from == null ? -Infinity : Date.parse(String(row.valid_from));
      const until = row.valid_until == null ? Infinity : Date.parse(String(row.valid_until));
      if (Number.isNaN(from) || Number.isNaN(until)) return fail('unavailable', 'Die persönlichen Berechtigungen konnten nicht geprüft werden.');
      if (row.allowed === false && from <= now && until >= now) permissions.delete(row.permission_key as PermissionKey);
    }
  }
  if (!permissions.has('office.access')) return fail('permission', PERMISSION_ERROR);
  const current = await client.auth.getUser();
  return current.error || current.data.user?.id !== scope.authUserId ? fail('identity', IDENTITY_ERROR) : { ok: true, permissions };
}

async function confirmScope(client: Client, scope: ModuleAssignmentWorkspaceScope): Promise<Access | Failure> {
  try { return await readConfirmedScope(client, scope); }
  catch { return fail('unavailable', 'Ihr Zugang und Ihre Berechtigungen konnten nicht bestätigt werden. Bitte laden Sie die Zuordnungen erneut.'); }
}

function sectionAction(section: ModuleAssignmentSection, permissions: Set<PermissionKey>): ModuleAssignmentWorkspaceAction | null {
  if (!permissions.has(VIEW[section])) return null;
  return inventoryAction(section, permissions);
}
function inventoryAction(section: ModuleAssignmentSection, permissions: Set<PermissionKey>): ModuleAssignmentWorkspaceAction | null {
  if (!permissions.has(INVENTORY_VIEW[section])) return null;
  switch (section) {
    case 'clients': return { label: 'Klientenakten öffnen', route: '/office/clients' };
    case 'employees': return { label: 'Personalakten öffnen', route: '/office/employees' };
    case 'services': return { label: 'Leistungskatalog öffnen', route: '/office/catalogs' };
    case 'documents': return { label: 'Dokumentenablage öffnen', route: '/business/office/documents' };
    case 'templates': return permissions.has('office.documents.view') ? { label: 'Dokumentenkatalog öffnen', route: '/business/office/document-catalog' } : null;
    case 'permissions': return permissions.has('office.employees.view') ? { label: 'Personalakten & Rechte öffnen', route: '/office/employees' } : null;
    case 'billing': return { label: 'Rechnungen öffnen', route: '/office/invoices' };
  }
}
function dateLabel(value: unknown): string {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium' }).format(parsed) : 'Datum nicht hinterlegt';
}
const display = (value: unknown, fallback: string): string => text(value) || fallback;

function mapItems(rows: Row[], tenantId: string, section: ModuleAssignmentSection, permissions: Set<PermissionKey>, clients: Map<string, string>, employees: Map<string, string>): ModuleAssignmentWorkspaceItem[] {
  return rows.map(row => {
    const base = rowState(row, tenantId, section);
    const action = sectionAction(section, permissions);
    const actions: ModuleAssignmentWorkspaceAction[] = action ? [action] : [];
    switch (section) {
      case 'clients': {
        const id = text(row.client_id), name = clients.get(id);
        if (!id) throw new Error(READ_ERROR);
        return { ...base, title: name ?? 'Klientenakte nicht verfügbar', subtitle: `Zugeordnet am ${dateLabel(row.assigned_at)}`, meta: employees.get(text(row.primary_employee_id)), actions: name ? [{ label: 'Klientenakte öffnen', route: `/business/office/clients/${encodeURIComponent(id)}` }, { label: 'Betreuungsbereiche öffnen', route: `/business/office/clients/${encodeURIComponent(id)}/portal` }] : [] };
      }
      case 'employees': {
        const id = text(row.employee_id), name = employees.get(id);
        if (!id) throw new Error(READ_ERROR);
        return { ...base, title: name ?? 'Personalakte nicht verfügbar', subtitle: display(row.role_in_module, 'Funktion nicht hinterlegt'), meta: `Zugeordnet am ${dateLabel(row.assigned_at)}`, actions: name ? [{ label: 'Personalakte öffnen', route: `/office/employees/${encodeURIComponent(id)}` }] : [] };
      }
      case 'services': {
        const price = typeof row.unit_price_cents === 'number' && Number.isSafeInteger(row.unit_price_cents) && row.unit_price_cents >= 0 ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(row.unit_price_cents / 100) : 'Preis nicht verfügbar';
        return { ...base, title: display(row.service_name, 'Leistung ohne Bezeichnung'), subtitle: [text(row.service_code), text(row.billing_category)].filter(Boolean).join(' · ') || 'Keine weiteren Angaben', meta: price, actions };
      }
      case 'documents': return { ...base, title: display(row.document_title, 'Dokument ohne Bezeichnung'), subtitle: ({ module_only: 'Im zugeordneten Bereich', office_and_module: 'In Office und im zugeordneten Bereich', portal: 'Im Portal' } as Record<string, string>)[text(row.visibility)] ?? 'Sichtbarkeit nicht bestätigt', actions };
      case 'templates': return { ...base, title: display(row.template_name, 'Vorlage ohne Bezeichnung'), subtitle: display(row.template_category, 'Keine Kategorie hinterlegt'), actions };
      case 'permissions': {
        const role = text(row.role_key), flags = [row.can_view === true ? 'Lesen' : null, row.can_edit === true ? 'Bearbeiten' : null, row.can_export === true ? 'Export' : null].filter(Boolean);
        return { ...base, title: display(row.profile_name, 'Profil ohne Bezeichnung'), subtitle: `Rolle: ${ROLE_LABELS[role as RoleKey] ?? 'Individuelle Rolle'}`, meta: flags.join(' · ') || 'Keine Freigaben hinterlegt', actions };
      }
      case 'billing': return { ...base, title: display(row.source_label, 'Quelle ohne Bezeichnung'), subtitle: ({ office_invoice: 'Office-Rechnung', module_export: 'Export aus einem Fachbereich', external: 'Externe Quelle' } as Record<string, string>)[text(row.source_type)] ?? 'Quellentyp nicht bestätigt', actions: text(row.linked_invoice_id) ? [{ label: 'Rechnung öffnen', route: `/office/invoices/${encodeURIComponent(text(row.linked_invoice_id))}` }, ...actions] : actions };
    }
  });
}

function demoRows(section: ModuleAssignmentSection): Row[] {
  const sources = { clients: officeCoreDemoRepository.listClientModuleAssignments, employees: officeCoreDemoRepository.listEmployeeModuleAssignments, services: officeCoreDemoRepository.listModuleServiceCatalog, documents: officeCoreDemoRepository.listModuleDocumentVisibility, templates: officeCoreDemoRepository.listModuleTemplateAssignments, permissions: officeCoreDemoRepository.listModulePermissionProfiles, billing: officeCoreDemoRepository.listModuleBillingSources };
  return sources[section]().map(item => Object.fromEntries(Object.entries(item).map(([key, value]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value])));
}

async function loadWorkspace(scope: ModuleAssignmentWorkspaceScope, section?: ModuleAssignmentSection): Promise<ModuleAssignmentWorkspaceResult> {
  if (!scope.authUserId?.trim() || !scope.profileId?.trim() || !scope.tenantId?.trim() || !scope.roleKey || scope.roleKey.endsWith('_portal')) return fail('identity', IDENTITY_ERROR);
  if (section && !KEYS.includes(section)) return fail('unavailable', 'Dieser Zuordnungsbereich ist nicht verfügbar.');
  const demo = isDemoMode(), client = demo ? null : getSupabaseClient();
  if (demo && scope.tenantId !== demoTenant.id) return fail('identity', 'Beispieldaten sind nur im Demo-Unternehmen verfügbar.');
  if (!demo && !client) return fail('unavailable', 'Die Datenverbindung ist nicht verfügbar. Bitte erneut versuchen.');
  const before: Access | Failure = demo ? { ok: true, permissions: new Set(getPermissionsForRole(scope.roleKey)) } : await confirmScope(client!, scope);
  if (!before.ok) return before;
  if (!before.permissions.has('office.access') || section && !before.permissions.has(VIEW[section]) && !before.permissions.has(INVENTORY_VIEW[section])) return fail('permission', PERMISSION_ERROR);
  const tenant = demo ? { data: demoTenant, error: null } : await client!.from('tenants').select('id,name').eq('id', scope.tenantId).maybeSingle();
  if (tenant.error || !tenant.data || tenant.data.id !== scope.tenantId || !text(tenant.data.name)) return fail('unavailable', 'Das Unternehmen konnte nicht eindeutig geladen werden.');
  const catalogModules = !demo && before.permissions.has(INVENTORY_VIEW.services) ? getCatalogModules(scope.tenantId) : null;
  let selectedRows: Row[] = [];
  const sections = await Promise.all(KEYS.map(async (key: ModuleAssignmentSection): Promise<ModuleAssignmentSectionSnapshot> => {
    const inventory = await readInventory(client, scope.tenantId, key, before.permissions, catalogModules);
    if (!before.permissions.has(VIEW[key])) return { key, count: null, activeCount: null, state: 'restricted', error: PERMISSION_ERROR, action: null, inventory };
    try {
      const columns = key === section ? COLUMNS[key] : `${BASE}${key === 'clients' ? ',is_active' : ''}`;
      const rows = demo ? demoRows(key) : await readPages(client!, scope.tenantId, TABLES[key], columns);
      const states = rows.map(row => rowState(row, scope.tenantId, key));
      if (key === section) selectedRows = rows;
      return { key, count: rows.length, activeCount: states.filter(item => item.active).length, state: 'ready', action: sectionAction(key, before.permissions), inventory };
    } catch {
      return { key, count: null, activeCount: null, state: 'error', error: READ_ERROR, action: sectionAction(key, before.permissions), inventory };
    }
  }));
  const warnings: string[] = [];
  let nameReadFailed = false;
  let clients = new Map<string, string>(), employees = new Map<string, string>();
  if (section === 'clients' || section === 'employees') {
    if (demo) {
      for (const row of selectedRows) {
        if (section === 'clients') clients.set(text(row.client_id), text(row.client_name));
        if (section === 'employees') employees.set(text(row.employee_id), text(row.employee_name));
        if (text(row.primary_employee_id)) employees.set(text(row.primary_employee_id), text(row.primary_employee_name));
      }
    } else {
      try {
        if (section === 'clients') clients = await readNames(client!, scope.tenantId, 'clients', selectedRows.map(row => text(row.client_id)));
        if (section === 'employees' || before.permissions.has('office.employees.view')) employees = await readNames(client!, scope.tenantId, 'employees', selectedRows.map(row => text(row[section === 'clients' ? 'primary_employee_id' : 'employee_id'])));
        if (section === 'clients' && selectedRows.some(row => !clients.has(text(row.client_id))) || section === 'employees' && selectedRows.some(row => !employees.has(text(row.employee_id)))) warnings.push('Einzelne verknüpfte Akten sind nicht verfügbar oder für Ihren Zugang nicht freigegeben.');
      } catch { nameReadFailed = true; }
    }
  }
  const after: Access | Failure = demo ? before : await confirmScope(client!, scope);
  if (!after.ok) return after;
  if (section && !after.permissions.has(VIEW[section]) && !after.permissions.has(INVENTORY_VIEW[section])) return fail('permission', PERMISSION_ERROR);
  // Never return data read under a grant that was revoked during the request.
  if ([...before.permissions].some(permission => !after.permissions.has(permission))) return fail('permission', 'Ihre Berechtigungen haben sich geändert. Bitte laden Sie die Zuordnungen erneut.');
  if (catalogModules && catalogModules.join(',') !== getCatalogModules(scope.tenantId).join(',')) {
    const services = sections.find(item => item.key === 'services');
    if (services) services.inventory = { count: null, state: 'error', error: 'Die Katalogfreigaben haben sich geändert. Bitte laden Sie den Bestand erneut.', action: null };
  }
  if (nameReadFailed) return fail('connection', 'Die zugeordneten Namen konnten nicht vollständig geladen werden. Bitte erneut versuchen.');
  if (section && sections.find(item => item.key === section)?.state === 'error') return fail('connection', READ_ERROR);
  const items = section ? mapItems(selectedRows, scope.tenantId, section, after.permissions, clients, employees) : [];
  if (section === 'clients' && items.some(item => item.active && ['archiviert', 'abgeschlossen', 'gesperrt', 'fehlerhaft'].includes(item.status))) warnings.push('Einige Zuordnungen sind für das Portal aktiv, obwohl ihr Bearbeitungsstatus davon abweicht. Bitte prüfen Sie diese in der Klientenakte.');
  return { ok: true, data: { tenantId: scope.tenantId, tenantName: text(tenant.data.name), source: demo ? 'demo' : 'live', loadedAt: new Date().toISOString(), sections, section: section ?? null, items, warnings } };
}

/** Entirely read-only: opening a workspace does not seed, assign, grant access, or change records. */
export async function fetchModuleAssignmentWorkspace(scope: ModuleAssignmentWorkspaceScope, section?: ModuleAssignmentSection): Promise<ModuleAssignmentWorkspaceResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([loadWorkspace(scope, section), new Promise<ModuleAssignmentWorkspaceResult>(resolve => { timer = setTimeout(() => resolve(fail('unavailable', 'Die Abfrage dauert zu lange. Bitte versuchen Sie es erneut.')), 30_000); })]);
  } catch { return fail('unavailable', READ_ERROR); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
