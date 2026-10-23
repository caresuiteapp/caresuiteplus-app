import type { RoleKey, ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { qmReadError } from './qmReadError.web';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { enforceQmPermission, QM_VIEW } from './qmPermissions';
import { mapQmRegisterRows, type QmRegisterEntry, type QmRegisterKind } from './qmRegisterDomain.web';

const base = 'id,tenant_id,title,status,created_at,updated_at';
export const QM_REGISTER_QUERIES: Record<QmRegisterKind, { table: string; columns: string; order: string }> = {
  audits: { table: 'qm_audits', columns: `${base},audit_type,scheduled_at,completed_at,auditor_name,findings_count,summary`, order: 'scheduled_at' },
  measures: { table: 'qm_measures', columns: `${base},audit_id,due_at,assigned_to,description,completed_at`, order: 'due_at' },
  compliance: { table: 'qm_compliance_requirements', columns: `${base},legal_reference_id,due_at,responsible_role,evidence_document_ids,notes`, order: 'due_at' },
  changes: { table: 'qm_changes', columns: `${base},change_type,document_id,description,requested_by,completed_at`, order: 'created_at' },
  legal: { table: 'qm_legal_references', columns: 'id,tenant_id,title,source,reference_code,summary,effective_from,document_ids,created_at,updated_at', order: 'title' },
  md: { table: 'md_audit_packages', columns: `${base},inspection_year,datenschutz_confirmed,approved_at,approved_by,notes`, order: 'created_at' },
};

/** Web read path only. Uses the signed-in client and existing tenant RLS, never elevated credentials. */
export async function fetchQmRegister(kind: QmRegisterKind, tenantId: string, roleKey?: RoleKey | null): Promise<ServiceResult<QmRegisterEntry[]>> {
  const denied = enforceQmPermission<QmRegisterEntry[]>(roleKey, QM_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Dieses Register benötigt eine aktive Mandantenverbindung.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Die Datenverbindung ist derzeit nicht verfügbar.' };
  const config = QM_REGISTER_QUERIES[kind];
  const rows: unknown[] = [];
  const pageSize = 250;
  for (let offset = 0; offset < 20000; offset += pageSize) {
    const { data, error } = await fromUnknownTable(client, config.table).select(config.columns)
      .eq('tenant_id', tenantId).order(config.order, { ascending: kind !== 'changes' && kind !== 'md', nullsFirst: false })
      .order('id').range(offset, offset + pageSize - 1);
    if (error) return { ok: false, error: qmReadError(error) };
    if (!Array.isArray(data)) return { ok: false, error: 'Die Datenabfrage hat keinen bestätigten Registerbestand geliefert.' };
    rows.push(...data);
    if (data.length < pageSize) return mapQmRegisterRows(kind, rows, tenantId);
  }
  return { ok: false, error: 'Der Registerbestand ist zu groß für eine vollständige Übersicht. Die Anzahl wird deshalb nicht als vollständig angezeigt.' };
}

export type QmMdPackageRead = {
  entry: QmRegisterEntry;
  items: { id: string; documentId: string; includedVersionId: string | null; notes: string; sortOrder: number }[];
};

export async function fetchQmMdPackageRead(tenantId: string, packageId: string, roleKey?: RoleKey | null): Promise<ServiceResult<QmMdPackageRead>> {
  const denied = enforceQmPermission<QmMdPackageRead>(roleKey, QM_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!packageId) return { ok: false, error: 'Keine Prüfungsmappe ausgewählt.' };
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Dieses Register benötigt eine aktive Mandantenverbindung.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Die Datenverbindung ist derzeit nicht verfügbar.' };
  const header = await fromUnknownTable(client, 'md_audit_packages').select(QM_REGISTER_QUERIES.md.columns)
    .eq('tenant_id', tenantId).eq('id', packageId).maybeSingle();
  if (header.error) return { ok: false, error: qmReadError(header.error) };
  if (!header.data) return { ok: false, error: 'Die Prüfungsmappe wurde für diesen Mandanten nicht gefunden.' };
  const mapped = mapQmRegisterRows('md', [header.data], tenantId);
  if (!mapped.ok) return mapped;
  if (mapped.data[0]?.id !== packageId) return { ok: false, error: 'Die Prüfungsmappe konnte nicht sicher zugeordnet werden.' };
  const items: QmMdPackageRead['items'] = [];
  const pageSize = 250;
  for (let offset = 0; offset < 20000; offset += pageSize) {
    const result = await fromUnknownTable(client, 'md_audit_package_items')
      .select('id,tenant_id,package_id,document_id,included_version_id,notes,sort_order')
      .eq('tenant_id', tenantId).eq('package_id', packageId).order('sort_order').order('id').range(offset, offset + pageSize - 1);
    if (result.error) return { ok: false, error: qmReadError(result.error) };
    if (!Array.isArray(result.data)) return { ok: false, error: 'Der Mappeninhalt konnte nicht vollständig geladen werden.' };
    for (const row of result.data as Record<string, unknown>[]) {
      if (!row || row.tenant_id !== tenantId || row.package_id !== packageId || typeof row.id !== 'string' || !row.id || typeof row.document_id !== 'string' || !row.document_id || typeof row.sort_order !== 'number' || (row.included_version_id !== null && typeof row.included_version_id !== 'string') || typeof row.notes !== 'string') {
        return { ok: false, error: 'Ein Mappeneintrag konnte nicht sicher zugeordnet werden.' };
      }
      items.push({ id: row.id, documentId: row.document_id, includedVersionId: row.included_version_id as string | null, notes: row.notes, sortOrder: row.sort_order });
    }
    if (result.data.length < pageSize) return { ok: true, data: { entry: mapped.data[0], items } };
  }
  return { ok: false, error: 'Der Mappeninhalt ist zu groß für eine vollständige Übersicht.' };
}
