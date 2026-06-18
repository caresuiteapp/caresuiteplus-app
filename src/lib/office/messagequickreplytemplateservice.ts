import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import type { OfficeQuickReplyTemplate } from '@/lib/office/messagequickreplies';
import { OFFICE_MESSAGING_SCHEMA_ERROR } from '@/lib/office/messagethreadservice';

export type QuickReplyTemplateRecord = OfficeQuickReplyTemplate & {
  id: string;
  sortOrder: number;
  isActive: boolean;
};

function mapRow(row: Record<string, unknown>): QuickReplyTemplateRecord {
  return {
    id: String(row.id),
    key: String(row.key),
    label: String(row.label),
    body: String(row.body),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active ?? true),
  };
}

export async function listQuickReplyTemplates(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QuickReplyTemplateRecord[]>> {
  const denied = enforcePermission<QuickReplyTemplateRecord[]>(actorRoleKey, 'office.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('message_quick_reply_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });

  if (error) {
    if (isMissingTableServiceError(toGermanSupabaseError(error))) {
      return { ok: false, error: OFFICE_MESSAGING_SCHEMA_ERROR };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)) };
}

export async function saveQuickReplyTemplate(
  tenantId: string,
  input: {
    id?: string;
    key: string;
    label: string;
    body: string;
    sortOrder?: number;
    isActive?: boolean;
  },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QuickReplyTemplateRecord>> {
  const denied = enforcePermission<QuickReplyTemplateRecord>(actorRoleKey, 'office.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const key = input.key.trim();
  const label = input.label.trim();
  const body = input.body.trim();
  if (!key || !label || !body) {
    return { ok: false, error: 'Schlüssel, Bezeichnung und Text sind erforderlich.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const payload = {
    tenant_id: tenantId,
    key,
    label,
    body,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from('message_quick_reply_templates')
      .update(payload)
      .eq('tenant_id', tenantId)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapRow(data as Record<string, unknown>) };
  }

  const { data, error } = await supabase
    .from('message_quick_reply_templates')
    .insert(payload)
    .select('*')
    .single();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: mapRow(data as Record<string, unknown>) };
}

export async function deactivateQuickReplyTemplate(
  tenantId: string,
  templateId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<void>> {
  const denied = enforcePermission<void>(actorRoleKey, 'office.access');
  if (denied) return denied;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { error } = await supabase
    .from('message_quick_reply_templates')
    .update({ is_active: false })
    .eq('tenant_id', tenantId)
    .eq('id', templateId);

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: undefined };
}
