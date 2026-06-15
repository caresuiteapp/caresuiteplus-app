import type { RoleKey, ServiceResult } from '@/types';
import type { TIAuditAction, TIAuditEvent, TIAuditLogQuery, TIAuditLogResult } from '@/types/modules/ti';
import {
  TI_DEMO_TENANT,
  appendTIAuditEvent,
  getTIAuditEvents,
} from '@/data/demo/ti';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { tiAuditSupabaseRepository } from './repositories';

export async function appendTIAudit(
  tenantId: string,
  action: TIAuditAction,
  actorName: string,
  resourceType: string,
  resourceId: string | null,
  details: string | null,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TIAuditEvent>> {
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    return tiAuditSupabaseRepository.append(tenantId, {
      action,
      actorName,
      resourceType,
      resourceId,
      details,
    });
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  const event = appendTIAuditEvent({
    tenantId,
    action,
    actorId: null,
    actorName,
    resourceType,
    resourceId,
    details,
    ipAddress: null,
  });

  return { ok: true, data: event };
}

export async function fetchTIAuditLog(
  tenantId: string,
  query: TIAuditLogQuery,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TIAuditLogResult>> {
  const denied = enforcePermission<TIAuditLogResult>(actorRoleKey, 'ti.audit.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const result = await tiAuditSupabaseRepository.list(tenantId, query);
    if (!result.ok) return result;
    const pageSize = query.pageSize ?? 20;
    const page = query.page ?? 1;
    return {
      ok: true,
      data: {
        items: result.data.items,
        totalCount: result.data.totalCount,
        filteredCount: result.data.filteredCount,
        page,
        pageSize,
        hasMore: page * pageSize < result.data.filteredCount,
      },
    };
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  await new Promise((r) => setTimeout(r, 140));

  const pageSize = query.pageSize ?? 20;
  const page = query.page ?? 1;
  let items = getTIAuditEvents();

  if (query.action && query.action !== 'all') {
    items = items.filter((e) => e.action === query.action);
  }

  if (query.search?.trim()) {
    const q = query.search.toLowerCase();
    items = items.filter(
      (e) =>
        e.actorName.toLowerCase().includes(q) ||
        (e.details?.toLowerCase().includes(q) ?? false) ||
        e.action.toLowerCase().includes(q),
    );
  }

  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);

  return {
    ok: true,
    data: {
      items: slice,
      totalCount: getTIAuditEvents().length,
      filteredCount: items.length,
      page,
      pageSize,
      hasMore: start + pageSize < items.length,
    },
  };
}

export async function exportTIAuditLog(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  actorName = 'System',
): Promise<ServiceResult<{ csv: string; rowCount: number }>> {
  const denied = enforcePermission<{ csv: string; rowCount: number }>(actorRoleKey, 'ti.audit.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const result = await tiAuditSupabaseRepository.list(tenantId, { page: 1, pageSize: 10_000 });
    if (!result.ok) return result;
    const events = result.data.items;
    const header = 'Zeitpunkt;Aktion;Akteur;Ressource;Details';
    const rows = events.map(
      (e) =>
        `${e.createdAt};${e.action};${e.actorName};${e.resourceType}:${e.resourceId ?? ''};${e.details ?? ''}`,
    );
    await appendTIAudit(tenantId, 'audit_export', actorName, 'ti_audit', null, `${events.length} Ereignisse exportiert`, actorRoleKey);
    return { ok: true, data: { csv: [header, ...rows].join('\n'), rowCount: events.length } };
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  const events = getTIAuditEvents();
  const header = 'Zeitpunkt;Aktion;Akteur;Ressource;Details';
  const rows = events.map(
    (e) =>
      `${e.createdAt};${e.action};${e.actorName};${e.resourceType}:${e.resourceId ?? ''};${e.details ?? ''}`,
  );

  appendTIAuditEvent({
    tenantId,
    action: 'audit_export',
    actorId: null,
    actorName,
    resourceType: 'ti_audit',
    resourceId: null,
    details: `${events.length} Ereignisse exportiert`,
    ipAddress: null,
  });

  return { ok: true, data: { csv: [header, ...rows].join('\n'), rowCount: events.length } };
}
