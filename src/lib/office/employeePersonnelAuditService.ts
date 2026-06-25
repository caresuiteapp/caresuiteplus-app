import type { RoleKey } from '@/types/core/auth';
import type { EmployeeAuditEvent, EmployeeMasterData } from '@/types/modules/employeePersonnelFile';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

const auditStore = new Map<string, EmployeeAuditEvent[]>();
let auditCounter = 0;

function storeKey(tenantId: string, employeeId: string): string {
  return `${tenantId}:${employeeId}`;
}

export function resetEmployeePersonnelAuditStore(): void {
  auditStore.clear();
  auditCounter = 0;
}

function cacheAuditEvent(event: EmployeeAuditEvent): EmployeeAuditEvent {
  const key = storeKey(event.tenantId, event.employeeId);
  const list = auditStore.get(key) ?? [];
  list.unshift(event);
  auditStore.set(key, list);
  return event;
}

type AuditEventInput = Omit<EmployeeAuditEvent, 'id' | 'createdAt' | 'updatedAt'>;

function buildLocalAuditEvent(input: AuditEventInput): EmployeeAuditEvent {
  auditCounter += 1;
  const now = new Date().toISOString();
  return {
    ...input,
    id: globalThis.crypto?.randomUUID?.() ?? `emp-audit-${auditCounter}`,
    createdAt: now,
    updatedAt: now,
  };
}

async function persistAuditEventToSupabase(event: EmployeeAuditEvent): Promise<void> {
  if (getServiceMode() !== 'supabase') return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await fromUnknownTable(supabase, 'employee_audit_events').insert({
    id: event.id,
    tenant_id: event.tenantId,
    employee_id: event.employeeId,
    action: event.action,
    actor_id: event.actorId,
    actor_role: event.actorRole,
    summary: event.summary,
    field_changes: event.fieldChanges ?? null,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
  });

  if (error && !isSupabaseMissingTableError(error)) {
    console.warn('[employeePersonnelAuditService]', toGermanSupabaseError(error));
  }
}

export async function appendEmployeeAuditEvent(input: AuditEventInput): Promise<EmployeeAuditEvent> {
  const event = buildLocalAuditEvent(input);
  cacheAuditEvent(event);
  await persistAuditEventToSupabase(event);
  return event;
}

export function getEmployeeAuditEvents(employeeId: string, tenantId?: string): EmployeeAuditEvent[] {
  if (tenantId) {
    return auditStore.get(storeKey(tenantId, employeeId)) ?? [];
  }

  const merged: EmployeeAuditEvent[] = [];
  for (const [key, events] of auditStore.entries()) {
    if (key.endsWith(`:${employeeId}`)) merged.push(...events);
  }
  return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

type EmployeeAuditEventRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  action: string;
  actor_id?: string | null;
  actor_role?: string | null;
  summary: string;
  field_changes?: Record<string, { before: string | null; after: string | null }> | null;
  created_at: string;
  updated_at: string;
};

export function mapEmployeeAuditEventRow(row: EmployeeAuditEventRow): EmployeeAuditEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    action: row.action,
    actorId: row.actor_id ?? null,
    actorRole: (row.actor_role as RoleKey | null) ?? null,
    summary: row.summary,
    fieldChanges: row.field_changes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadEmployeeAuditEventsFromDb(
  tenantId: string,
  employeeId: string,
): Promise<EmployeeAuditEvent[]> {
  if (getServiceMode() !== 'supabase') {
    return getEmployeeAuditEvents(employeeId, tenantId);
  }

  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await fromUnknownTable(supabase, 'employee_audit_events')
    .select(
      'id, tenant_id, employee_id, action, actor_id, actor_role, summary, field_changes, created_at, updated_at',
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isSupabaseMissingTableError(error)) return [];
    return [];
  }

  const events = (data as EmployeeAuditEventRow[]).map(mapEmployeeAuditEventRow);
  auditStore.set(storeKey(tenantId, employeeId), events);
  return events;
}

export function buildMasterDataAuditDiff(
  before: EmployeeMasterData,
  after: EmployeeMasterData,
): Record<string, { before: string | null; after: string | null }> {
  const changes: Record<string, { before: string | null; after: string | null }> = {};
  const keys = Object.keys(after) as (keyof EmployeeMasterData)[];

  for (const key of keys) {
    const prev = before[key];
    const next = after[key];
    const prevStr = prev == null ? null : String(prev);
    const nextStr = next == null ? null : String(next);
    if (prevStr !== nextStr) {
      changes[key] = { before: prevStr, after: nextStr };
    }
  }

  return changes;
}

export async function auditEmployeeMasterDataChange(input: {
  tenantId: string;
  employeeId: string;
  actorId: string | null;
  actorRole: RoleKey | null;
  before: EmployeeMasterData;
  after: EmployeeMasterData;
}): Promise<EmployeeAuditEvent | null> {
  const fieldChanges = buildMasterDataAuditDiff(input.before, input.after);
  if (Object.keys(fieldChanges).length === 0) return null;

  return appendEmployeeAuditEvent({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    action: 'master_data_updated',
    actorId: input.actorId,
    actorRole: input.actorRole,
    summary: `Stammdaten geändert (${Object.keys(fieldChanges).join(', ')}).`,
    fieldChanges,
  });
}
