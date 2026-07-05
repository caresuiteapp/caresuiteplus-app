import type { ServiceResult } from '@/types';
import { fetchLivePortalAppointmentsForEmployee } from '@/lib/portal/portalAppointmentsLiveService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { sanitizeEmployeePortalPayload } from '@/lib/portal/portalVisibilityService';

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

function personName(row?: { first_name: string | null; last_name: string | null } | null): string {
  if (!row) return 'Klient:in';
  const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
  return name || 'Klient:in';
}

export async function fetchEmployeePortalClientRecords(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeePortalClientRecordListItem[]>> {
  return runService(async () => {
    const appts = await fetchLivePortalAppointmentsForEmployee(tenantId, employeeId);
    if (!appts.ok) return appts;

    const byClient = new Map<
      string,
      {
        clientId: string;
        activeCount: number;
        lastAt: string | null;
        nextAt: string | null;
      }
    >();

    const now = Date.now();
    for (const item of appts.data) {
      if (!item.clientId) continue;
      const entry = byClient.get(item.clientId) ?? {
        clientId: item.clientId,
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

    const clientIds = [...byClient.keys()];
    if (clientIds.length === 0) return { ok: true, data: [] };

    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(supabase, 'clients')
      .select('id, first_name, last_name, street, zip, city, care_level, notes')
      .eq('tenant_id', tenantId)
      .in('id', clientIds);

    if (error) {
      if (isMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const rowById = new Map(rows.map((row) => [String(row.id), row]));

    const records: EmployeePortalClientRecordListItem[] = clientIds.map((clientId) => {
      const meta = byClient.get(clientId)!;
      const row = rowById.get(clientId);
      return sanitizeEmployeePortalPayload({
        clientId,
        displayName: personName(
          row
            ? {
                first_name: row.first_name as string | null,
                last_name: row.last_name as string | null,
              }
            : null,
        ),
        city: row?.city ? String(row.city) : null,
        street: row?.street ? String(row.street) : null,
        zip: row?.zip ? String(row.zip) : null,
        careGrade: row?.care_level ? String(row.care_level) : null,
        hints: row?.notes ? String(row.notes) : null,
        activeAssignmentCount: meta.activeCount,
        lastAssignmentAt: meta.lastAt,
        nextAssignmentAt: meta.nextAt,
      }) as EmployeePortalClientRecordListItem;
    });

    records.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
    return { ok: true, data: records };
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

    const { data: clientRow } = await fromUnknownTable(supabase, 'clients')
      .select('phone, notes')
      .eq('tenant_id', tenantId)
      .eq('id', clientId)
      .maybeSingle();

    let accessHint: string | null = null;
    const { data: addressRows } = await fromUnknownTable(supabase, 'client_addresses')
      .select('access_notes')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .not('access_notes', 'is', null)
      .limit(1);
    if (addressRows?.length) {
      const notes = (addressRows[0] as { access_notes?: string | null }).access_notes;
      accessHint = notes?.trim() ? notes.trim() : null;
    }

    let emergencyContact: string | null = null;
    const { data: contacts } = await fromUnknownTable(supabase, 'client_contacts')
      .select('name, phone, relationship, is_emergency')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('is_emergency', true)
      .limit(3);
    if (contacts?.length) {
      emergencyContact = (contacts as Array<Record<string, unknown>>)
        .map((c) => `${c.name ?? ''}${c.phone ? ` (${c.phone})` : ''}`.trim())
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

    const row = clientRow as Record<string, unknown> | null;

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
