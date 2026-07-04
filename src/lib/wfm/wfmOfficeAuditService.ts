import type { RoleKey, ServiceResult } from '@/types';
import type { WfmOfficeAuditEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  appendAuditEntry,
  createAuditId,
  listAuditForEntity,
  listAuditForTenant,
} from './wfmOfficeTimekeepingStore';

const TABLE = 'workforce_audit_log';

type AuditRow = {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

function mapRow(row: AuditRow): WfmOfficeAuditEntry {
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    tenantId: row.tenant_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    actorId: row.actor_id,
    summary: row.summary,
    field: typeof meta.field === 'string' ? meta.field : null,
    oldValue: typeof meta.oldValue === 'string' ? meta.oldValue : null,
    newValue: typeof meta.newValue === 'string' ? meta.newValue : null,
    reason: typeof meta.reason === 'string' ? meta.reason : null,
    source: typeof meta.source === 'string' ? meta.source : null,
    metadata: meta,
    createdAt: row.created_at,
  };
}

export async function writeWfmOfficeAudit(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  input: {
    entityType: string;
    entityId: string;
    action: string;
    actorId: string | null;
    summary: string;
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    reason?: string | null;
    source?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<ServiceResult<WfmOfficeAuditEntry>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const now = new Date().toISOString();
  const id = createAuditId();
  const metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
  };
  if (input.field) metadata.field = input.field;
  if (input.oldValue) metadata.oldValue = input.oldValue;
  if (input.newValue) metadata.newValue = input.newValue;
  if (input.reason) metadata.reason = input.reason;
  if (input.source) metadata.source = input.source;

  const entry: WfmOfficeAuditEntry = {
    id,
    tenantId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorId: input.actorId,
    summary: input.summary,
    field: input.field ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    reason: input.reason ?? null,
    source: input.source ?? null,
    metadata,
    createdAt: now,
  };

  appendAuditEntry(tenantId, entry);

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: entry };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .insert({
      id,
      tenant_id: tenantId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      actor_id: input.actorId,
      summary: input.summary,
      metadata,
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: entry };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: mapRow(data as AuditRow) };
}

export async function listWfmOfficeAuditForEntry(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  entryId: string,
): Promise<ServiceResult<WfmOfficeAuditEntry[]>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
  if (denied) return denied;

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: listAuditForEntity(tenantId, entryId) };
  }

  const localEntries = listAuditForEntity(tenantId, entryId);
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: localEntries };

  const { data, error } = await fromUnknownTable(supabase, TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('entity_id', entryId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: localEntries };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const mapped = (data ?? []).map((row) => mapRow(row as AuditRow));
  for (const row of mapped) appendAuditEntry(tenantId, row);
  const merged = [...listAuditForEntity(tenantId, entryId)];
  const seen = new Set(merged.map((e) => e.id));
  for (const row of mapped) {
    if (!seen.has(row.id)) merged.push(row);
  }
  return { ok: true, data: merged.length ? merged : localEntries };
}

export async function listWfmOfficeAuditForTenant(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<WfmOfficeAuditEntry[]>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
  if (denied) return denied;
  return { ok: true, data: listAuditForTenant(tenantId) };
}

export function resetWfmOfficeAuditDemoStore(): void {
  // cleared via resetWfmOfficeTimekeepingStore
}
