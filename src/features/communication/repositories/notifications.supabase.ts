import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { communicationFrom } from './supabaseTable';

const TABLE = 'communication_notifications';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export type NotificationRow = {
  id: string;
  tenantId: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  threadId: string | null;
};

function mapRow(row: Record<string, unknown>): NotificationRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    type: String(row.type),
    title: String(row.title),
    body: String(row.body),
    readAt: (row.read_at as string | null) ?? null,
    threadId: (row.thread_id as string | null) ?? null,
  };
}

export const notificationsSupabaseRepository = {
  async listUnread(tenantId: string): Promise<ServiceResult<NotificationRow[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .select('id, tenant_id, type, title, body, read_at, thread_id')
      .eq('tenant_id', tenantId)
      .is('read_at', null)
      .order('created_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const rows = (data ?? []) as Record<string, unknown>[];
    return { ok: true, data: rows.map((r) => mapRow(r)) };
  },

  async markRead(tenantId: string, notificationId: string): Promise<ServiceResult<{ read: true }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { error } = await communicationFrom(supabase, TABLE)
      .update({ read_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', notificationId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { read: true } };
  },

  async insert(tenantId: string, input: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .insert({ tenant_id: tenantId, ...input })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: String((data as { id: string }).id) } };
  },
};
