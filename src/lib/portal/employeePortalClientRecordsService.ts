import type { ServiceResult } from '@/types';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { sanitizeEmployeePortalPayload } from '@/lib/portal/portalVisibilityService';
import { fetchLivePortalAppointmentsForEmployee } from '@/lib/portal/portalAppointmentsLiveService';

export type EmployeePortalClientRecordListItem = {
  clientId: string;
  displayName: string;
  city: string | null;
  street: string | null;
  zip: string | null;
  careGrade: string | null;
  hints: string | null;
  activeAssignmentCount: number;
  lastAssignmentAt: string | null;
  nextAssignmentAt: string | null;
};

export type EmployeePortalClientRecordDetail = EmployeePortalClientRecordListItem & {
  phone: string | null;
  accessHint: string | null;
  emergencyContact: string | null;
  assignmentHistory: Array<{
    assignmentId: string;
    title: string;
    plannedStartAt: string;
    status: string;
  }>;
  portalDocuments: Array<{
    id: string;
    title: string;
    category: string | null;
    createdAt: string;
  }>;
};

/** Safe clients columns for portal reads (production schema — postal_code, no zip). */
const CLIENT_PORTAL_SELECT =
  'id, first_name, last_name, street, postal_code, city, care_level, phone';

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  zip: string | null;
  postal_code: string | null;
  city: string | null;
  care_level: string | null;
  phone: string | null;
};

type VisitClientRow = {
  id: string;
  client_id: string;
  planned_start_at: string;
  canonical_status: string | null;
  client_visible_notes: string | null;
  title: string | null;
  clients: ClientRow | ClientRow[] | null;
};

function personName(row?: { first_name: string | null; last_name: string | null } | null): string {
  if (!row) return 'Klient:in';
  const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
  return name || 'Klient:in';
}

function unwrapClient(clients: VisitClientRow['clients']): ClientRow | null {
  if (!clients) return null;
  return Array.isArray(clients) ? (clients[0] ?? null) : clients;
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
): Promise<ServiceResult<Map<string, ClientRow>>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  if (clientIds.length === 0) return { ok: true, data: new Map() };

  const { data, error } = await fromUnknownTable(supabase, 'clients')
    .select(CLIENT_PORTAL_SELECT)
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
      embedded: ClientRow | null;
    }
  >();

  const now = Date.now();
  for (const visit of visits) {
    if (!visit.client_id) continue;
    const embedded = unwrapClient(visit.clients);
    const entry = byClient.get(visit.client_id) ?? {
      clientId: visit.client_id,
      activeCount: 0,
      lastAt: null,
      nextAt: null,
      hints: null,
      embedded,
    };
    if (embedded && !entry.embedded) entry.embedded = embedded;
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

  const records: EmployeePortalClientRecordListItem[] = [...byClient.values()].map((meta) => {
    const row = meta.embedded ?? clientRows.get(meta.clientId) ?? null;
    return sanitizeEmployeePortalPayload({
      clientId: meta.clientId,
      displayName: personName(row),
      city: row?.city ? String(row.city) : null,
      street: row?.street ? String(row.street) : null,
      zip: row?.zip ? String(row.zip) : row?.postal_code ? String(row.postal_code) : null,
      careGrade: row?.care_level ? String(row.care_level) : null,
      hints: meta.hints,
      activeAssignmentCount: meta.activeCount,
      lastAssignmentAt: meta.lastAt,
      nextAssignmentAt: meta.nextAt,
    }) as EmployeePortalClientRecordListItem;
  });

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

      const records = [...byClient.entries()].map(([clientId, meta]) => {
        const row = clientsResult.data.get(clientId) ?? null;
        return sanitizeEmployeePortalPayload({
          clientId,
          displayName: personName(row),
          city: row?.city ? String(row.city) : null,
          street: row?.street ? String(row.street) : null,
          zip: row?.zip ? String(row.zip) : row?.postal_code ? String(row.postal_code) : null,
          careGrade: row?.care_level ? String(row.care_level) : null,
          hints: null,
          activeAssignmentCount: meta.activeCount,
          lastAssignmentAt: meta.lastAt,
          nextAssignmentAt: meta.nextAt,
        }) as EmployeePortalClientRecordListItem;
      });
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
      .slice(0, 20)
      .map((item) => ({
        assignmentId: item.id,
        title: item.title,
        plannedStartAt: item.startsAt,
        status: String(item.assignmentStatus ?? item.status),
      }));

    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data: clientRow, error: clientError } = await fromUnknownTable(supabase, 'clients')
      .select(CLIENT_PORTAL_SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', clientId)
      .maybeSingle();

    if (clientError && !isMissingTableError(clientError)) {
      return { ok: false, error: toGermanSupabaseError(clientError) };
    }

    let accessHint: string | null = null;
    const { data: addressRows, error: addressError } = await fromUnknownTable(
      supabase,
      'client_addresses',
    )
      .select('access_notes')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .not('access_notes', 'is', null)
      .limit(1);

    if (!addressError && addressRows?.length) {
      const notes = (addressRows[0] as { access_notes?: string | null }).access_notes;
      accessHint = notes?.trim() ? notes.trim() : null;
    }

    let emergencyContact: string | null = null;
    const { data: contacts, error: contactsError } = await fromUnknownTable(
      supabase,
      'client_contacts',
    )
      .select('full_name, first_name, last_name, phone, relationship, is_emergency_contact')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('is_emergency_contact', true)
      .limit(3);

    if (!contactsError && contacts?.length) {
      emergencyContact = (contacts as Array<Record<string, unknown>>)
        .map((c) => {
          const label =
            String(c.full_name ?? c.name ?? '').trim() ||
            `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
          return `${label}${c.phone ? ` (${c.phone})` : ''}`.trim();
        })
        .filter(Boolean)
        .join(' · ');
    }

    let portalDocuments: EmployeePortalClientRecordDetail['portalDocuments'] = [];
    const { data: docs, error: docsError } = await fromUnknownTable(supabase, 'client_documents')
      .select('id, title, category, created_at')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('portal_visible', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!docsError && docs) {
      portalDocuments = (docs as Array<Record<string, unknown>>).map((doc) => ({
        id: String(doc.id),
        title: String(doc.title ?? 'Dokument'),
        category: doc.category ? String(doc.category) : null,
        createdAt: String(doc.created_at ?? ''),
      }));
    }

    const row = clientRow as ClientRow | null;

    return {
      ok: true,
      data: sanitizeEmployeePortalPayload({
        ...base,
        phone: row?.phone ? String(row.phone) : null,
        accessHint,
        emergencyContact,
        assignmentHistory: history,
        portalDocuments,
      }) as EmployeePortalClientRecordDetail,
    };
  });
}
