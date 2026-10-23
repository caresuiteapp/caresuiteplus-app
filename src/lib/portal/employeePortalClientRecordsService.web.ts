import type { ServiceResult } from '@/types';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { sanitizeEmployeePortalPayload } from '@/lib/portal/portalVisibilityService';
import { fetchLivePortalAppointmentsForEmployee } from '@/lib/portal/portalAppointmentsLiveService';
import { fetchEmployeePortalClientDocuments } from '@/lib/portal/portalDocumentsLiveService';
import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';
import { buildEmployeePortalClientScope, isEmployeePortalScopeId, type EmployeePortalClientVisitScopeRow } from './employeePortalClientScope';

// Web narrows the existing caller-selected employee contract; server RLS still owns session authorization.
const EMPLOYEE_PORTAL_SCOPE_ERROR = 'Eigene sichtbare Mitarbeiterportal-Zuweisungen konnten nicht zuverlässig bestätigt werden.';

export type EmployeePortalClientRecordListItem = {
  clientId: string;
  displayName: string;
  city: string | null;
  street: string | null;
  zip: string | null;
  careGrade: string | null;
  careGradeLabel: string | null;
  phone: string | null;
  mobile: string | null;
  hints: string | null;
  documentCount: number;
  activeAssignmentCount: number;
  lastAssignmentAt: string | null;
  nextAssignmentAt: string | null;
};

export type EmployeePortalClientContact = {
  id: string;
  displayName: string;
  relationship: string | null;
  phone: string | null;
  mobile: string | null;
  isEmergencyContact: boolean;
  isPrimaryContact: boolean;
};

export type EmployeePortalClientRecordDocument = PortalDocumentListItem & {
  createdAt: string;
  categoryLabel: string;
};

export type EmployeePortalClientRecordDetail = EmployeePortalClientRecordListItem & {
  dateOfBirth: string | null;
  gender: string | null;
  houseNumber: string | null;
  floor: string | null;
  apartmentNumber: string | null;
  doorbellName: string | null;
  employeeNotes: string | null;
  emergencyNotes: string | null;
  allergies: string | null;
  mobilityNotes: string | null;
  pets: string | null;
  keyManagementNotes: string | null;
  accessHint: string | null;
  contacts: EmployeePortalClientContact[];
  assignmentHistory: {
    assignmentId: string;
    title: string;
    plannedStartAt: string;
    status: string;
  }[];
  portalDocuments: EmployeePortalClientRecordDocument[];
  documentsError?: string | null;
  contactsError?: string | null;
  accessError?: string | null;
};

const CLIENT_LIST_SELECT =
  'id, tenant_id, status, deleted_at, first_name, last_name, street, postal_code, city, care_level, phone, mobile';

const CLIENT_DETAIL_SELECT = `${CLIENT_LIST_SELECT}, date_of_birth, gender, house_number, floor, apartment_number, doorbell_name, visible_notes_for_employee, emergency_notes, allergies, mobility_notes, pets, key_management_notes`;

type ClientRow = {
  id: string;
  tenant_id: string;
  status: string;
  deleted_at: string | null;
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  care_level: string | null;
  phone: string | null;
  mobile: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  house_number?: string | null;
  floor?: string | null;
  apartment_number?: string | null;
  doorbell_name?: string | null;
  visible_notes_for_employee?: string | null;
  emergency_notes?: string | null;
  allergies?: string | null;
  mobility_notes?: string | null;
  pets?: string | null;
  key_management_notes?: string | null;
};

type VisitClientRow = EmployeePortalClientVisitScopeRow;

function personName(row?: { first_name: string | null; last_name: string | null } | null): string {
  if (!row) return 'Klient:in';
  const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
  return name || 'Klient:in';
}

function resolvePostalCode(row: ClientRow | null): string | null {
  if (!row?.postal_code) return null;
  return String(row.postal_code);
}

function resolveCareGrade(row: ClientRow | null): { raw: string | null; label: string | null } {
  if (!row?.care_level) return { raw: null, label: null };
  const raw = String(row.care_level);
  const label = formatCareLevel(raw) || raw;
  return { raw, label };
}

function mapListItemFromClient(
  clientId: string,
  row: ClientRow | null,
  meta: {
    hints: string | null;
    activeCount: number;
    lastAt: string | null;
    nextAt: string | null;
    documentCount?: number;
  },
): EmployeePortalClientRecordListItem {
  const care = resolveCareGrade(row);
  return sanitizeEmployeePortalPayload({
    clientId,
    displayName: personName(row),
    city: row?.city ? String(row.city) : null,
    street: row?.street ? String(row.street) : null,
    zip: resolvePostalCode(row),
    careGrade: care.raw,
    careGradeLabel: care.label,
    phone: row?.phone ? String(row.phone) : null,
    mobile: row?.mobile ? String(row.mobile) : null,
    hints: meta.hints,
    documentCount: meta.documentCount ?? 0,
    activeAssignmentCount: meta.activeCount,
    lastAssignmentAt: meta.lastAt,
    nextAssignmentAt: meta.nextAt,
  }) as EmployeePortalClientRecordListItem;
}

function isActiveAssignmentStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const assignmentStatus = remoteStatusToAssignment(status);
  return ['gestartet', 'bestaetigt', 'unterwegs', 'angekommen', 'pausiert'].includes(assignmentStatus);
}

/** Empty-page termination also handles a server cap below the requested page size. */
async function readRecordPages<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<ServiceResult<T[]>> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let page = 0; page < 500; page++) {
    const { data, error } = await query(rows.length, rows.length + pageSize - 1);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!Array.isArray(data) || data.length > pageSize || Object.keys(data).length !== data.length) return { ok: false, error: EMPLOYEE_PORTAL_SCOPE_ERROR };
    if (data.length === 0) return { ok: true, data: rows };
    rows.push(...data as T[]);
  }
  return { ok: false, error: EMPLOYEE_PORTAL_SCOPE_ERROR };
}

async function loadEmployeeClientVisits(tenantId: string, employeeId: string): Promise<ServiceResult<VisitClientRow[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const result = await readRecordPages<VisitClientRow>((from, to) => fromUnknownTable(supabase, 'assist_visits')
    .select('id, tenant_id, client_id, employee_id, employee_portal_visible, planning_status, planned_start_at, canonical_status, client_visible_notes, title')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('employee_portal_visible', true)
    .neq('planning_status', 'draft')
    .order('planned_start_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to));
  if (!result.ok) return result;
  try {
    const scope = buildEmployeePortalClientScope(tenantId, employeeId, result.data);
    if (scope.visits.some(visit => !visit.planning_status.trim())) return { ok: false, error: EMPLOYEE_PORTAL_SCOPE_ERROR };
    return { ok: true, data: [...scope.visits] };
  } catch {
    return { ok: false, error: EMPLOYEE_PORTAL_SCOPE_ERROR };
  }
}

async function loadClientsByIds(tenantId: string, clientIds: string[], detail = false): Promise<ServiceResult<Map<string, ClientRow>>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const map = new Map<string, ClientRow>();
  for (let offset = 0; offset < clientIds.length; offset += 100) {
    const ids = clientIds.slice(offset, offset + 100);
    const result = await readRecordPages<ClientRow>((from, to) => fromUnknownTable(supabase, 'clients')
      .select(detail ? CLIENT_DETAIL_SELECT : CLIENT_LIST_SELECT)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .in('id', ids)
      .order('id', { ascending: true })
      .range(from, to));
    if (!result.ok) return result;
    for (const row of result.data) {
      if (!row || !isEmployeePortalScopeId(row.id) || row.tenant_id !== tenantId || row.status !== 'active' || row.deleted_at !== null || !clientIds.includes(row.id) || !ids.includes(row.id) || map.has(row.id)) return { ok: false, error: EMPLOYEE_PORTAL_SCOPE_ERROR };
      map.set(row.id, row);
    }
  }
  return { ok: true, data: map };
}

function sameVisitScope(a: VisitClientRow[], b: VisitClientRow[]): boolean {
  const project = (rows: VisitClientRow[]) => rows.map(row => [row.id,row.tenant_id,row.client_id,row.employee_id,row.employee_portal_visible,row.planning_status,row.planned_start_at,row.canonical_status,row.client_visible_notes,row.title]);
  return JSON.stringify(project(a)) === JSON.stringify(project(b));
}

function aggregateClientRecords(
  visits: VisitClientRow[],
  clientRows: Map<string, ClientRow>,
): EmployeePortalClientRecordListItem[] {
  const byClient = new Map<
    string,
    {
      clientId: string;
      activeCount: number;
      lastAt: string | null;
      nextAt: string | null;
      hints: string | null;
    }
  >();

  for (const clientId of clientRows.keys()) {
    byClient.set(clientId, {
      clientId,
      activeCount: 0,
      lastAt: null,
      nextAt: null,
      hints: null,
    });
  }

  const now = Date.now();
  for (const visit of visits) {
    const entry = byClient.get(visit.client_id);
    if (!entry) continue;
    if (visit.client_visible_notes?.trim() && !entry.hints) {
      entry.hints = visit.client_visible_notes.trim();
    }
    const startMs = new Date(visit.planned_start_at).getTime();
    if (!Number.isFinite(startMs)) continue;
    if (isActiveAssignmentStatus(visit.canonical_status)) {
      entry.activeCount += 1;
    }
    if (startMs <= now) {
      entry.lastAt =
        !entry.lastAt || startMs > new Date(entry.lastAt).getTime()
          ? visit.planned_start_at
          : entry.lastAt;
    } else if (!['storniert', 'nicht_erschienen'].includes(remoteStatusToAssignment(visit.canonical_status ?? ''))) {
      entry.nextAt =
        !entry.nextAt || startMs < new Date(entry.nextAt).getTime()
          ? visit.planned_start_at
          : entry.nextAt;
    }
    byClient.set(visit.client_id, entry);
  }

  const records = [...byClient.values()].map((meta) =>
    mapListItemFromClient(meta.clientId, clientRows.get(meta.clientId) ?? null, meta),
  );

  records.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
  return records;
}

export async function fetchEmployeePortalClientRecords(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeePortalClientRecordListItem[]>> {
  return runService(async () => {
    if (!isEmployeePortalScopeId(tenantId) || !isEmployeePortalScopeId(employeeId)) return { ok: false, error: 'Mitarbeitendenprofil konnte nicht verknüpft werden.' };
    const visitsResult = await loadEmployeeClientVisits(tenantId, employeeId);
    if (!visitsResult.ok) return { ok: false, error: visitsResult.error === EMPLOYEE_PORTAL_SCOPE_ERROR ? EMPLOYEE_PORTAL_SCOPE_ERROR : `Eigene Zuweisungen konnten nicht geladen werden: ${visitsResult.error}` };
    const clientIds = [...new Set(visitsResult.data.map(visit => visit.client_id))];
    if (clientIds.length === 0) return { ok: true, data: [] };
    const clientsResult = await loadClientsByIds(tenantId, clientIds);
    if (!clientsResult.ok) return clientsResult;
    const current = await loadEmployeeClientVisits(tenantId, employeeId);
    if (!current.ok || !sameVisitScope(visitsResult.data, current.data)) return { ok: false, error: EMPLOYEE_PORTAL_SCOPE_ERROR };
    return { ok: true, data: aggregateClientRecords(visitsResult.data, clientsResult.data) };
  });
}

function mapPortalDocuments(items: PortalDocumentListItem[]): EmployeePortalClientRecordDocument[] {
  return items.map((item) => ({
    ...item,
    createdAt: item.updatedAt,
    categoryLabel: PORTAL_DOCUMENT_CATEGORY_LABELS[item.category] ?? item.category,
  }));
}

async function loadClientContacts(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<EmployeePortalClientContact[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const result = await readRecordPages<Record<string, unknown>>((from, to) => fromUnknownTable(supabase, 'client_contacts')
    .select(
      'id, tenant_id, client_id, full_name, first_name, last_name, phone, mobile, relationship, is_emergency_contact, is_primary_contact',
    )
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .or('is_primary_contact.eq.true,is_emergency_contact.eq.true')
    .order('is_primary_contact', { ascending: false })
    .order('is_emergency_contact', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to));

  if (!result.ok) return result;

  const contactIds = new Set<string>();
  for (const row of result.data) {
    if (!row || !isEmployeePortalScopeId(row.id) || row.tenant_id !== tenantId || row.client_id !== clientId || contactIds.has(row.id)) return { ok: false, error: EMPLOYEE_PORTAL_SCOPE_ERROR };
    contactIds.add(row.id);
  }
  return { ok: true, data: result.data.filter(row => row.is_emergency_contact === true || row.is_primary_contact === true).map((row) => {
    const displayName =
      String(row.full_name ?? '').trim() ||
      `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() ||
      'Kontakt';
    return {
      id: String(row.id),
      displayName,
      relationship: row.relationship ? String(row.relationship) : null,
      phone: row.phone ? String(row.phone) : null,
      mobile: row.mobile ? String(row.mobile) : null,
      isEmergencyContact: row.is_emergency_contact === true,
      isPrimaryContact: row.is_primary_contact === true,
    };
  }) };
}

export async function fetchEmployeePortalClientRecordDetail(
  tenantId: string,
  employeeId: string,
  clientId: string,
): Promise<ServiceResult<EmployeePortalClientRecordDetail | null>> {
  return runService(async () => {
    if (!isEmployeePortalScopeId(tenantId) || !isEmployeePortalScopeId(employeeId) || !isEmployeePortalScopeId(clientId)) return { ok: false, error: EMPLOYEE_PORTAL_SCOPE_ERROR };
    const list = await fetchEmployeePortalClientRecords(tenantId, employeeId);
    if (!list.ok) return list;
    const base = list.data.find((item) => item.clientId === clientId);
    if (!base) return { ok: true, data: null };

    const ownVisits = await loadEmployeeClientVisits(tenantId, employeeId);
    if (!ownVisits.ok || !ownVisits.data.some(visit => visit.client_id === clientId)) return { ok: false, error: EMPLOYEE_PORTAL_SCOPE_ERROR };
    const ownVisitIds = new Set(ownVisits.data.filter(visit => visit.client_id === clientId).map(visit => visit.id));
    const ownVisitClients = new Map(ownVisits.data.map(visit => [visit.id, visit.client_id]));
    const appts = await fetchLivePortalAppointmentsForEmployee(tenantId, employeeId);
    if (!appts.ok) return appts;
    if (!Array.isArray(appts.data) || Object.keys(appts.data).length !== appts.data.length || appts.data.some(item => !item || item.employeeId !== employeeId || !isEmployeePortalScopeId(item.clientId) || typeof item.id !== 'string' || !item.id || !Number.isFinite(Date.parse(item.startsAt)) || ownVisitClients.has(item.id) && ownVisitClients.get(item.id) !== item.clientId) || new Set(appts.data.map(item => item.id)).size !== appts.data.length) return { ok: false, error: EMPLOYEE_PORTAL_SCOPE_ERROR };

    const history = appts.data
      .filter((item) => item.clientId === clientId && ownVisitIds.has(item.id))
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
      .map((item) => ({
        assignmentId: item.id,
        title: item.title,
        plannedStartAt: item.startsAt,
        status: String(item.assignmentStatus ?? item.status),
      }));

    const clientsResult = await loadClientsByIds(tenantId, [clientId], true);
    if (!clientsResult.ok) return clientsResult;
    const row = clientsResult.data.get(clientId) ?? null;
    if (!row) return { ok: true, data: null };

    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    let accessHint: string | null = null;
    const { data: addressRows, error: addressError } = await fromUnknownTable(supabase, 'client_addresses')
      .select('id, tenant_id, client_id, access_notes, street, house_number, postal_code, city, floor, apartment_number, doorbell_name')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .limit(1);

    if (!addressError && (!Array.isArray(addressRows) || addressRows.length > 1 || addressRows.some(address => address.tenant_id !== tenantId || address.client_id !== clientId || !isEmployeePortalScopeId(address.id)))) return { ok: false, error: EMPLOYEE_PORTAL_SCOPE_ERROR };
    if (!addressError && addressRows?.length) {
      const address = addressRows[0] as Record<string, unknown>;
      accessHint = address.access_notes ? String(address.access_notes).trim() : null;
    }

    const [contactsResult, documentsResult] = await Promise.all([
      loadClientContacts(tenantId, clientId), fetchEmployeePortalClientDocuments(tenantId, clientId),
    ]);
    const portalDocuments = documentsResult.ok ? mapPortalDocuments(documentsResult.data) : [];

    const current = await loadEmployeeClientVisits(tenantId, employeeId);
    if (!current.ok || !sameVisitScope(ownVisits.data, current.data)) return { ok: false, error: EMPLOYEE_PORTAL_SCOPE_ERROR };
    const care = resolveCareGrade(row);
    const listMapped = mapListItemFromClient(clientId, row, {
      hints: base.hints,
      activeCount: base.activeAssignmentCount,
      lastAt: base.lastAssignmentAt,
      nextAt: base.nextAssignmentAt,
      documentCount: portalDocuments.length,
    });

    const accessParts = [
      accessHint,
      row?.key_management_notes?.trim() ?? null,
      row?.doorbell_name?.trim() ? `Klingel: ${row.doorbell_name.trim()}` : null,
    ].filter(Boolean);

    return {
      ok: true,
      data: sanitizeEmployeePortalPayload({
        ...listMapped,
        careGrade: care.raw,
        careGradeLabel: care.label,
        dateOfBirth: row?.date_of_birth ? formatDate(row.date_of_birth) : null,
        gender: row?.gender ? String(row.gender) : null,
        houseNumber: row?.house_number ? String(row.house_number) : null,
        floor: row?.floor ? String(row.floor) : null,
        apartmentNumber: row?.apartment_number ? String(row.apartment_number) : null,
        doorbellName: row?.doorbell_name ? String(row.doorbell_name) : null,
        employeeNotes: row?.visible_notes_for_employee?.trim() ?? null,
        emergencyNotes: row?.emergency_notes?.trim() ?? null,
        allergies: row?.allergies?.trim() ?? null,
        mobilityNotes: row?.mobility_notes?.trim() ?? null,
        pets: row?.pets?.trim() ?? null,
        keyManagementNotes: row?.key_management_notes?.trim() ?? null,
        accessHint: accessParts.length > 0 ? accessParts.join('\n') : null,
        contacts: contactsResult.ok ? contactsResult.data : [],
        contactsError: contactsResult.ok ? null : contactsResult.error,
        documentsError: documentsResult.ok ? null : documentsResult.error,
        accessError: addressError ? toGermanSupabaseError(addressError) : null,
        assignmentHistory: history,
        portalDocuments,
      }) as EmployeePortalClientRecordDetail,
    };
  });
}
