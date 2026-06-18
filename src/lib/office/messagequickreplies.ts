import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { OFFICE_MESSAGING_SCHEMA_ERROR } from '@/lib/office/messagethreadservice';

export type OfficeQuickReplyTemplate = {
  key: string;
  label: string;
  body: string;
};

/** Vordefinierte Schnellantworten — Fallback wenn DB-Tabelle fehlt. */
export const OFFICE_QUICK_REPLY_TEMPLATES: readonly OfficeQuickReplyTemplate[] = [
  {
    key: 'received',
    label: 'Eingegangen',
    body: 'Vielen Dank für Ihre Nachricht. Wir haben diese erhalten und melden uns zeitnah.',
  },
  {
    key: 'in_progress',
    label: 'In Bearbeitung',
    body: 'Ihr Anliegen wird derzeit bearbeitet. Wir informieren Sie, sobald es Neuigkeiten gibt.',
  },
  {
    key: 'waiting_info',
    label: 'Rückfrage',
    body: 'Für die weitere Bearbeitung benötigen wir noch eine kurze Rückmeldung von Ihnen.',
  },
  {
    key: 'resolved',
    label: 'Erledigt',
    body: 'Ihr Anliegen wurde bearbeitet. Bei weiteren Fragen starten Sie gerne einen neuen Chat.',
  },
  {
    key: 'appointment',
    label: 'Termin',
    body: 'Wir prüfen die Terminmöglichkeiten und melden uns mit einem Vorschlag.',
  },
] as const;

export async function fetchOfficeQuickReplyTemplates(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OfficeQuickReplyTemplate[]>> {
  const denied = enforcePermission<OfficeQuickReplyTemplate[]>(actorRoleKey, 'office.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: true, data: [...OFFICE_QUICK_REPLY_TEMPLATES] };
  }

  const { data, error } = await supabase
    .from('message_quick_reply_templates')
    .select('key, label, body, sort_order')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    if (isMissingTableServiceError(toGermanSupabaseError(error))) {
      return { ok: true, data: [...OFFICE_QUICK_REPLY_TEMPLATES] };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data?.length) {
    return { ok: true, data: [...OFFICE_QUICK_REPLY_TEMPLATES] };
  }

  return {
    ok: true,
    data: data.map((row) => ({
      key: String(row.key),
      label: String(row.label),
      body: String(row.body),
    })),
  };
}
