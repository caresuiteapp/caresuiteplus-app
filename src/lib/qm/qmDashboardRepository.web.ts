import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { qmReadError } from './qmReadError.web';
import type { QmAudit, QmChange, QmDashboardSection, QmDashboardSnapshot } from './qm.types';

type QueryError = Parameters<typeof toGermanSupabaseError>[0];
type QueryResult = { data: unknown; error: QueryError; count?: number | null };
type Row = Record<string, unknown>;
const auditColumns = 'id,tenant_id,title,audit_type,status,scheduled_at,completed_at,auditor_name,findings_count,summary,created_at,updated_at';
const changeColumns = 'id,tenant_id,title,change_type,status,document_id,description,requested_by,completed_at,created_at,updated_at';

function field(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') throw new Error('Die QM-Daten sind unvollständig. Bitte erneut laden.');
  return value;
}

function nullableField(row: Row, key: string): string | null {
  return row[key] === null ? null : field(row, key);
}

function rows(value: unknown, tenantId: string): Row[] {
  if (!Array.isArray(value)) throw new Error('Die QM-Daten wurden nicht vollständig geliefert.');
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Die QM-Daten sind unvollständig.');
    const row = item as Row;
    if (row.tenant_id !== tenantId) throw new Error('Die QM-Daten gehören nicht zum aktiven Mandanten.');
    field(row, 'id');
    return row;
  });
}

function mapAudit(row: Row): QmAudit {
  const status = field(row, 'status'), auditType = field(row, 'audit_type');
  if (!['planned', 'in_progress', 'completed', 'follow_up'].includes(status)
    || !['internal', 'external', 'md_inspection'].includes(auditType)
    || !Number.isSafeInteger(row.findings_count) || Number(row.findings_count) < 0) {
    throw new Error('Ein Audit enthält ungültige Angaben.');
  }
  return {
    id: field(row, 'id'), tenantId: field(row, 'tenant_id'), title: field(row, 'title'),
    auditType: auditType as QmAudit['auditType'], status: status as QmAudit['status'],
    scheduledAt: field(row, 'scheduled_at'), completedAt: nullableField(row, 'completed_at'),
    auditorName: field(row, 'auditor_name'), findingsCount: Number(row.findings_count),
    summary: field(row, 'summary'), createdAt: field(row, 'created_at'), updatedAt: field(row, 'updated_at'),
  };
}

function mapChange(row: Row): QmChange {
  const status = field(row, 'status'), changeType = field(row, 'change_type');
  if (!['open', 'in_progress', 'completed', 'cancelled'].includes(status)
    || !['correction', 'improvement', 'legal_update', 'audit_finding'].includes(changeType)) {
    throw new Error('Eine QM-Änderung enthält ungültige Angaben.');
  }
  return {
    id: field(row, 'id'), tenantId: field(row, 'tenant_id'), title: field(row, 'title'),
    changeType: changeType as QmChange['changeType'], status: status as QmChange['status'],
    documentId: nullableField(row, 'document_id'), description: field(row, 'description'),
    requestedBy: field(row, 'requested_by'), completedAt: nullableField(row, 'completed_at'),
    createdAt: field(row, 'created_at'), updatedAt: field(row, 'updated_at'),
  };
}

/** Exact counts use PostgREST HEAD, so a server row limit cannot undercount a tenant. */
export async function readQmDashboardSnapshot(tenantId: string): Promise<ServiceResult<QmDashboardSnapshot>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const count = (table: string) => fromUnknownTable(client, table)
    .select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
  const definitions: [QmDashboardSection, PromiseLike<QueryResult>][] = [
    ['chapters', count('qm_handbook_chapters')],
    ['documents', count('qm_documents')],
    ['compliance', count('qm_compliance_requirements').in('status', ['open', 'in_progress', 'overdue'])],
    ['mdPackages', count('md_audit_packages')],
    ['approvals', count('qm_documents').eq('status', 'in_review')],
    ['audits', fromUnknownTable(client, 'qm_audits').select(auditColumns).eq('tenant_id', tenantId)
      .in('status', ['planned', 'in_progress', 'follow_up']).order('scheduled_at', { ascending: true }).limit(5)],
    ['changes', fromUnknownTable(client, 'qm_changes').select(changeColumns).eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false }).limit(5)],
  ];
  const results = await Promise.allSettled(definitions.map(([, query]) => query));
  const data: QmDashboardSnapshot = {
    chapterCount: 0, documentCount: 0, complianceOpenCount: 0, mdPackageCount: 0,
    pendingApprovals: 0, recentChanges: [], upcomingAudits: [], sectionErrors: {}, loadedAt: new Date().toISOString(),
  };
  const countFields = {
    chapters: 'chapterCount', documents: 'documentCount', compliance: 'complianceOpenCount',
    mdPackages: 'mdPackageCount', approvals: 'pendingApprovals',
  } as const;
  results.forEach((result, index) => {
    const section = definitions[index]![0];
    try {
      if (result.status === 'rejected') throw new Error('Die Verbindung wurde unterbrochen. Bitte erneut laden.');
      const response = result.value;
      if (response.error) throw new Error(qmReadError(response.error));
      if (section === 'audits') data.upcomingAudits = rows(response.data, tenantId).map(mapAudit);
      else if (section === 'changes') data.recentChanges = rows(response.data, tenantId).map(mapChange);
      else {
        if (!Number.isSafeInteger(response.count) || Number(response.count) < 0) {
          throw new Error('Die Anzahl konnte nicht zuverlässig ermittelt werden.');
        }
        data[countFields[section]] = response.count!;
      }
    } catch (error) {
      data.sectionErrors![section] = error instanceof Error ? error.message : 'Dieser Bereich konnte nicht geladen werden.';
    }
  });
  if (Object.keys(data.sectionErrors!).length === definitions.length) {
    return { ok: false, error: 'Die QM-Übersicht konnte nicht geladen werden. Bitte erneut versuchen.' };
  }
  return { ok: true, data };
}
