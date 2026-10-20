import type { ServiceResult } from '@/types';
import type { TIAuditAction, TIAuditEvent, TIAuditLogQuery } from '@/types/modules/ti';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';

const TABLE = 'ti_audit_events';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapRow(row: Record<string, unknown>): TIAuditEvent {
  const ts = String(row.created_at ?? new Date().toISOString());
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    action: row.action as TIAuditAction,
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorName: String(row.actor_name ?? 'System'),
    resourceType: String(row.resource_type ?? ''),
    resourceId: row.resource_id ? String(row.resource_id) : null,
    details: row.details ? String(row.details) : null,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    createdAt: ts,
    updatedAt: String(row.updated_at ?? ts),
  };
}

export const tiAuditSupabaseRepository = {
  async append(
    tenantId: string,
    payload: {
      action: TIAuditAction;
      actorName: string;
      resourceType: string;
      resourceId: string | null;
      details: string | null;
      actorId?: string | null;
      ipAddress?: string | null;
    },
  ): Promise<ServiceResult<TIAuditEvent>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        tenant_id: tenantId,
        action: payload.action,
        actor_id: payload.actorId ?? null,
        actor_name: payload.actorName,
        resource_type: payload.resourceType,
        resource_id: payload.resourceId,
        details: payload.details,
        ip_address: payload.ipAddress ?? null,
      })
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapRow(data as Record<string, unknown>) };
  },

  async list(
    tenantId: string,
    query: TIAuditLogQuery,
  ): Promise<ServiceResult<{ items: TIAuditEvent[]; totalCount: number; filteredCount: number }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    let builder = supabase
      .from(TABLE)
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (query.action && query.action !== 'all') {
      builder = builder.eq('action', query.action);
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      builder = builder.or(
        `actor_name.ilike.%${q}%,details.ilike.%${q}%,action.ilike.%${q}%`,
      );
    }

    const pageSize = query.pageSize ?? 20;
    const page = query.page ?? 1;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await builder.range(from, to);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const items = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
    const filteredCount = count ?? items.length;

    return {
      ok: true,
      data: {
        items,
        totalCount: count ?? items.length,
        filteredCount,
      },
    };
  },
};
