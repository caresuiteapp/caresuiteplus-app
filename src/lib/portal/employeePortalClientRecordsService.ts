import type { ServiceResult } from '@/types';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { toTimezoneDateKey } from '@/lib/office/calendarDateUtils';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { sanitizeEmployeePortalPayload } from '@/lib/portal/portalVisibilityService';
import { fetchEmployeePortalClientDocuments } from '@/lib/portal/portalDocumentsLiveService';
import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';
import { buildEmployeePortalClientScope, isEmployeePortalScopeId, type EmployeePortalClientVisitScopeRow } from './employeePortalClientScope';

const CLIENT_SCOPE_ERROR = 'Die Klientenakte konnte dem Mandanten nicht eindeutig zugeordnet werden.';
const VISIT_SCOPE_ERROR = 'Ihre Einsatzdaten konnten nicht eindeutig zugeordnet werden.';

export type EmployeePortalClientRecordListItem = {
  clientId: string;
  displayName: string;
  city: string | null;
  street: string | null;
  zip: string | null;
  careGrade: string | null;
  careGradeLabel: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  careFundName?: string | null;
  legacyPayerName?: string | null;
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
  assignmentHistoryError?: string | null;
};

const CLIENT_LIST_SELECT =
  'id, tenant_id, status, deleted_at, first_name, last_name, street, postal_code, city, care_level, phone, mobile';

const PRIMARY_INSURANCE = 'primary_insurance:client_insurance_profiles!client_insurance_profiles_client_id_fkey';
const CLIENT_REGISTER_SELECT = `${CLIENT_LIST_SELECT}, date_of_birth, insurance_name, ${PRIMARY_INSURANCE}(tenant_id, client_id, is_primary, care_fund_name)`;
const CLIENT_DETAIL_SELECT = `${CLIENT_REGISTER_SELECT}, gender, house_number, floor, apartment_number, doorbell_name, visible_notes_for_employee, emergency_notes, allergies, mobility_notes, pets, key_management_notes`;
const CLIENT_INSURANCE_NUMBER_SELECT = `id, tenant_id, status, deleted_at, insurance_number, ${PRIMARY_INSURANCE}(tenant_id, client_id, is_primary, insurance_number)`;

type InsuranceRow = {
  tenant_id: string;
  client_id: string;
  is_primary: boolean;
  care_fund_name?: string | null;
  insurance_number?: string | null;
};

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
  insurance_name?: string | null;
  insurance_number?: string | null;
  primary_insurance?: InsuranceRow[];
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

function primaryInsurance(row: ClientRow) {
  const profiles = row.primary_insurance;
  const profile = Array.isArray(profiles) && profiles.length === 1 ? profiles[0] : null;
  return profile?.tenant_id === row.tenant_id && profile.client_id === row.id && profile.is_primary === true ? profile : null;
}

function recordFacts(row: ClientRow, today: string) {
  const birth = row.date_of_birth?.trim() ?? '';
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(birth) ? new Date(`${birth}T00:00:00Z`) : null;
  const validBirth = birthDate && Number.isFinite(birthDate.getTime()) && birthDate.toISOString().slice(0, 10) === birth && birth <= today;
  const age = validBirth
    ? Number(today.slice(0, 4)) - Number(birth.slice(0, 4)) - Number(today.slice(5) < birth.slice(5))
    : null;
  const careFundName = primaryInsurance(row)?.care_fund_name?.trim() || null;
  return {
    dateOfBirth: validBirth ? formatDate(birth) : null,
    age,
    careFundName,
    // Older records may only have a general payer. Keep that label distinct.
    legacyPayerName: careFundName ? null : row.insurance_name?.trim() || null,
  };
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
  today?: string,
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
    ...(row && today ? recordFacts(row, today) : {}),
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
async function readRecordPages<T>(
  query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  scopeError = CLIENT_SCOPE_ERROR,
): Promise<ServiceResult<T[]>> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let page = 0; page < 500; page++) {
    const { data, error } = await query(rows.length, rows.length + pageSize - 1);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!Array.isArray(data) || data.length > pageSize || Object.keys(data).length !== data.length) return { ok: false, error: scopeError };
    if (data.length === 0) return { ok: true, data: rows };
    rows.push(...data as T[]);
  }
  return { ok: false, error: scopeError };
}

async function loadEmployeeClientVisits(
  tenantId: string,
  employeeId: string,
  clientId?: string,
): Promise<ServiceResult<VisitClientRow[]>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    const result = await readRecordPages<VisitClientRow>((from, to) => {
      const query = fromUnknownTable(supabase, 'assist_visits')
        .select('id, tenant_id, client_id, employee_id, employee_portal_visible, planning_status, planned_start_at, canonical_status, client_visible_notes, title')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('employee_portal_visible', true)
        .neq('planning_status', 'draft')
        .not('client_id', 'is', null);
      if (clientId) query.eq('client_id', clientId);
      return query.order('planned_start_at', { ascending: false }).order('id', { ascending: true }).range(from, to);
    }, VISIT_SCOPE_ERROR);
    if (!result.ok) return result;
    try {
      const { visits } = buildEmployeePortalClientScope(tenantId, employeeId, result.data);
      if (visits.some(visit => clientId && visit.client_id !== clientId)) return { ok: false, error: VISIT_SCOPE_ERROR };
      return { ok: true, data: [...visits] };
    } catch {
      return { ok: false, error: VISIT_SCOPE_ERROR };
    }
  });
}

async function loadActiveTenantClients(tenantId: string, select: string, clientId?: string): Promise<ServiceResult<Map<string, ClientRow>>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  // Tenant RLS authorizes the directory. Visit rows only enrich the displayed records.
  const result = await readRecordPages<ClientRow>((from, to) => {
    const query = fromUnknownTable(supabase, 'clients')
      .select(select)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .is('deleted_at', null);
    if (clientId) query.eq('id', clientId);
    if (select !== CLIENT_LIST_SELECT) {
      query.eq('primary_insurance.tenant_id', tenantId).eq('primary_insurance.is_primary', true);
    }
    return query.order('id', { ascending: true }).range(from, to);
  });
  if (!result.ok) return result;

  const rows = new Map<string, ClientRow>();
  for (const row of result.data) {
    if (!row || !isEmployeePortalScopeId(row.id) || row.tenant_id !== tenantId || row.status !== 'active'
      || row.deleted_at !== null || (clientId && row.id !== clientId) || rows.has(row.id)) {
      return { ok: false, error: CLIENT_SCOPE_ERROR };
    }
    rows.set(row.id, row);
  }
  return { ok: true, data: rows };
}

function aggregateClientRecords(
  visits: VisitClientRow[],
  clientRows: Map<string, ClientRow>,
  includeRecordFacts = false,
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

  const today = includeRecordFacts ? toTimezoneDateKey(new Date(now)) : undefined;
  const records = [...byClient.values()].map((meta) =>
    mapListItemFromClient(meta.clientId, clientRows.get(meta.clientId) ?? null, meta, today),
  );

  records.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
  return records;
}

export async function fetchEmployeePortalClientRecords(
  tenantId: string,
  employeeId: string,
  { includeRecordFacts = false }: { includeRecordFacts?: boolean } = {},
): Promise<ServiceResult<EmployeePortalClientRecordListItem[]>> {
  return runService(async () => {
    if (!isEmployeePortalScopeId(tenantId) || !isEmployeePortalScopeId(employeeId)) return { ok: false, error: 'Mitarbeitendenprofil konnte nicht verknüpft werden.' };
    const [clients, visits] = await Promise.all([
      loadActiveTenantClients(tenantId, includeRecordFacts ? CLIENT_REGISTER_SELECT : CLIENT_LIST_SELECT),
      loadEmployeeClientVisits(tenantId, employeeId),
    ]);
    if (!clients.ok) return clients;
    return { ok: true, data: aggregateClientRecords(visits.ok ? visits.data : [], clients.data, includeRecordFacts) };
  });
}

export async function fetchEmployeePortalClientInsuranceNumber(
  tenantId: string,
  employeeId: string,
  clientId: string,
): Promise<ServiceResult<string | null>> {
  return runService(async () => {
    if (!isEmployeePortalScopeId(tenantId) || !isEmployeePortalScopeId(employeeId) || !isEmployeePortalScopeId(clientId)) {
      return { ok: false, error: CLIENT_SCOPE_ERROR };
    }
    // The same active-client RLS scope applies as when opening this record.
    const clients = await loadActiveTenantClients(tenantId, CLIENT_INSURANCE_NUMBER_SELECT, clientId);
    if (!clients.ok) return clients;
    const row = clients.data.get(clientId);
    if (!row) return { ok: false, error: 'Für diese Akte ist keine Versichertennummer verfügbar.' };
    return { ok: true, data: primaryInsurance(row)?.insurance_number?.trim() || row.insurance_number?.trim() || null };
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
    if (!row || !isEmployeePortalScopeId(row.id) || row.tenant_id !== tenantId || row.client_id !== clientId || contactIds.has(row.id)) return { ok: false, error: CLIENT_SCOPE_ERROR };
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

async function loadClientAccessHint(tenantId: string, clientId: string): Promise<ServiceResult<string | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const { data, error } = await fromUnknownTable(supabase, 'client_addresses')
    .select('id, tenant_id, client_id, access_notes')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
    .order('id', { ascending: true })
    .limit(1);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!Array.isArray(data) || data.length > 1) return { ok: false, error: CLIENT_SCOPE_ERROR };
  const address = data[0];
  if (data.length && (!address || address.tenant_id !== tenantId || address.client_id !== clientId || !isEmployeePortalScopeId(address.id))) {
    return { ok: false, error: CLIENT_SCOPE_ERROR };
  }
  return { ok: true, data: typeof address?.access_notes === 'string' ? address.access_notes.trim() || null : null };
}

export async function fetchEmployeePortalClientRecordDetail(
  tenantId: string,
  employeeId: string,
  clientId: string,
): Promise<ServiceResult<EmployeePortalClientRecordDetail | null>> {
  return runService(async () => {
    if (!isEmployeePortalScopeId(tenantId) || !isEmployeePortalScopeId(employeeId) || !isEmployeePortalScopeId(clientId)) return { ok: false, error: CLIENT_SCOPE_ERROR };
    const clients = await loadActiveTenantClients(tenantId, CLIENT_DETAIL_SELECT, clientId);
    if (!clients.ok) return clients;
    const row = clients.data.get(clientId);
    if (!row) return { ok: true, data: null };

    const [visits, contacts, access] = await Promise.all([
      loadEmployeeClientVisits(tenantId, employeeId, clientId),
      loadClientContacts(tenantId, clientId),
      loadClientAccessHint(tenantId, clientId),
    ]);
    const ownVisits = visits.ok ? visits.data : [];
    const history = ownVisits.map(visit => ({
      assignmentId: visit.id,
      title: visit.title?.trim() || 'Einsatz',
      plannedStartAt: visit.planned_start_at,
      status: remoteStatusToAssignment(visit.canonical_status ?? ''),
    }));
    // Document visibility also remains enforced by the document service and RLS.
    const documents = ownVisits.length ? await fetchEmployeePortalClientDocuments(tenantId, clientId) : null;
    const portalDocuments = documents?.ok ? mapPortalDocuments(documents.data) : [];
    const [base] = aggregateClientRecords(ownVisits, clients.data, true);

    const accessParts = [
      access.ok ? access.data : null,
      row?.key_management_notes?.trim() ?? null,
      row?.doorbell_name?.trim() ? `Klingel: ${row.doorbell_name.trim()}` : null,
    ].filter(Boolean);

    return {
      ok: true,
      data: sanitizeEmployeePortalPayload({
        ...base,
        documentCount: portalDocuments.length,
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
        contacts: contacts.ok ? contacts.data : [],
        contactsError: contacts.ok ? null : contacts.error,
        documentsError: documents && !documents.ok ? documents.error : null,
        accessError: access.ok ? null : access.error,
        assignmentHistory: history,
        assignmentHistoryError: visits.ok ? null : visits.error,
        portalDocuments,
      }) as EmployeePortalClientRecordDetail,
    };
  });
}
