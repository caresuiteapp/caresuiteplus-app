import type { ServiceResult } from '@/types';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { sanitizeEmployeePortalPayload } from '@/lib/portal/portalVisibilityService';
import { fetchLivePortalAppointmentsForEmployee } from '@/lib/portal/portalAppointmentsLiveService';
import { fetchEmployeePortalClientDocuments } from '@/lib/portal/portalDocumentsLiveService';
import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';

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
  assignmentHistory: Array<{
    assignmentId: string;
    title: string;
    plannedStartAt: string;
    status: string;
  }>;
  portalDocuments: EmployeePortalClientRecordDocument[];
};

const CLIENT_LIST_SELECT =
  'id, first_name, last_name, street, postal_code, city, care_level, phone, mobile';

const CLIENT_DETAIL_SELECT = `${CLIENT_LIST_SELECT}, date_of_birth, gender, house_number, floor, apartment_number, doorbell_name, visible_notes_for_employee, emergency_notes, allergies, mobility_notes, pets, key_management_notes`;

type ClientRow = {
  id: string;
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

type VisitClientRow = {
  id: string;
  client_id: string;
  planned_start_at: string;
  canonical_status: string | null;
  client_visible_notes: string | null;
  title: string | null;
};

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
  return assignmentStatus === 'gestartet' || assignmentStatus === 'bestaetigt' || assignmentStatus === 'unterwegs';
}

async function loadEmployeeClientVisits(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<VisitClientRow[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, 'assist_visits')
    .select('id, client_id, planned_start_at, canonical_status, client_visible_notes, title')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .neq('planning_status', 'draft')
    .order('planned_start_at', { ascending: false })
    .limit(500);

  if (error) {
    if (isMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []) as VisitClientRow[] };
}

async function loadClientsByIds(
  tenantId: string,
  clientIds: string[],
  detail = false,
): Promise<ServiceResult<Map<string, ClientRow>>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  if (clientIds.length === 0) return { ok: true, data: new Map() };

  const { data, error } = await fromUnknownTable(supabase, 'clients')
    .select(detail ? CLIENT_DETAIL_SELECT : CLIENT_LIST_SELECT)
    .eq('tenant_id', tenantId)
    .in('id', clientIds);

  if (error) {
    if (isMissingTableError(error)) return { ok: true, data: new Map() };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const map = new Map<string, ClientRow>();
  for (const row of (data ?? []) as ClientRow[]) {
    map.set(row.id, row);
  }
  return { ok: true, data: map };
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

  const now = Date.now();
  for (const visit of visits) {
    if (!visit.client_id) continue;
    const entry = byClient.get(visit.client_id) ?? {
      clientId: visit.client_id,
      activeCount: 0,
      lastAt: null,
      nextAt: null,
      hints: null,
    };
    if (visit.client_visible_notes?.trim() && !entry.hints) {
      entry.hints = visit.client_visible_notes.trim();
    }
    const startMs = new Date(visit.planned_start_at).getTime();
    if (isActiveAssignmentStatus(visit.canonical_status)) {
      entry.activeCount += 1;
    }
    if (startMs <= now) {
      entry.lastAt =
        !entry.lastAt || startMs > new Date(entry.lastAt).getTime()
          ? visit.planned_start_at
          : entry.lastAt;
    } else {
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
    const visitsResult = await loadEmployeeClientVisits(tenantId, employeeId);
    if (!visitsResult.ok) {
      const appts = await fetchLivePortalAppointmentsForEmployee(tenantId, employeeId);
      if (!appts.ok) return visitsResult;
      if (appts.data.length === 0) return { ok: true, data: [] };

      const clientIds = [...new Set(appts.data.map((item) => item.clientId).filter(Boolean))];
      const clientsResult = await loadClientsByIds(tenantId, clientIds);
      if (!clientsResult.ok) return clientsResult;

      const byClient = new Map<
        string,
        { activeCount: number; lastAt: string | null; nextAt: string | null }
      >();
      const now = Date.now();
      for (const item of appts.data) {
        if (!item.clientId) continue;
        const entry = byClient.get(item.clientId) ?? {
          activeCount: 0,
          lastAt: null,
          nextAt: null,
        };
        const startMs = new Date(item.startsAt).getTime();
        if (item.status === 'aktiv' || item.assignmentStatus === 'gestartet') {
          entry.activeCount += 1;
        }
        if (startMs <= now) {
          entry.lastAt =
            !entry.lastAt || startMs > new Date(entry.lastAt).getTime() ? item.startsAt : entry.lastAt;
        } else {
          entry.nextAt =
            !entry.nextAt || startMs < new Date(entry.nextAt).getTime() ? item.startsAt : entry.nextAt;
        }
        byClient.set(item.clientId, entry);
      }

      const records = [...byClient.entries()].map(([clientId, meta]) =>
        mapListItemFromClient(clientId, clientsResult.data.get(clientId) ?? null, {
          ...meta,
          hints: null,
        }),
      );
      records.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
      return { ok: true, data: records };
    }

    if (visitsResult.data.length === 0) return { ok: true, data: [] };

    const clientIds = [...new Set(visitsResult.data.map((visit) => visit.client_id).filter(Boolean))];
    const clientsResult = await loadClientsByIds(tenantId, clientIds);
    if (!clientsResult.ok) return clientsResult;

    return {
      ok: true,
      data: aggregateClientRecords(visitsResult.data, clientsResult.data),
    };
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
): Promise<EmployeePortalClientContact[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await fromUnknownTable(supabase, 'client_contacts')
    .select(
      'id, full_name, first_name, last_name, phone, mobile, relationship, is_emergency_contact, is_primary_contact',
    )
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('is_primary_contact', { ascending: false })
    .order('is_emergency_contact', { ascending: false })
    .limit(12);

  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => {
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
  });
}

export async function fetchEmployeePortalClientRecordDetail(
  tenantId: string,
  employeeId: string,
  clientId: string,
): Promise<ServiceResult<EmployeePortalClientRecordDetail | null>> {
  return runService(async () => {
    const list = await fetchEmployeePortalClientRecords(tenantId, employeeId);
    if (!list.ok) return list;
    const base = list.data.find((item) => item.clientId === clientId);
    if (!base) return { ok: true, data: null };

    const appts = await fetchLivePortalAppointmentsForEmployee(tenantId, employeeId);
    if (!appts.ok) return appts;

    const history = appts.data
      .filter((item) => item.clientId === clientId)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
      .slice(0, 25)
      .map((item) => ({
        assignmentId: item.id,
        title: item.title,
        plannedStartAt: item.startsAt,
        status: String(item.assignmentStatus ?? item.status),
      }));

    const clientsResult = await loadClientsByIds(tenantId, [clientId], true);
    if (!clientsResult.ok) return clientsResult;
    const row = clientsResult.data.get(clientId) ?? null;

    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    let accessHint: string | null = null;
    const { data: addressRows } = await fromUnknownTable(supabase, 'client_addresses')
      .select('access_notes, street, house_number, postal_code, city, floor, apartment_number, doorbell_name')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .limit(1);

    if (addressRows?.length) {
      const address = addressRows[0] as Record<string, unknown>;
      accessHint = address.access_notes ? String(address.access_notes).trim() : null;
    }

    const contacts = await loadClientContacts(tenantId, clientId);
    const documentsResult = await fetchEmployeePortalClientDocuments(tenantId, clientId);
    const portalDocuments = documentsResult.ok ? mapPortalDocuments(documentsResult.data) : [];

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
        contacts,
        assignmentHistory: history,
        portalDocuments,
      }) as EmployeePortalClientRecordDetail,
    };
  });
}
