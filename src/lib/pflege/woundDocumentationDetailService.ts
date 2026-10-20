import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { WoundDocumentationDetail } from './woundDocumentationDetailStats';

type Row = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);

export async function fetchWoundDocumentationDetail(
  woundId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<WoundDocumentationDetail>> {
  const denied = enforcePermission<WoundDocumentationDetail>(actorRoleKey, 'pflege.wounds.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const { data, error } = await fromUnknownTable(supabase, 'clinical_wound_cases')
    .select('*').eq('tenant_id', tenantId).eq('id', woundId).maybeSingle();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data) return { ok: false, error: 'Wundfall nicht gefunden.' };
  const row = data as Row;
  const { data: client } = await fromUnknownTable(supabase, 'clients')
    .select('first_name,last_name').eq('tenant_id', tenantId).eq('id', text(row.client_id)).maybeSingle();
  const { data: assessments } = await fromUnknownTable(supabase, 'clinical_wound_assessments')
    .select('*').eq('tenant_id', tenantId).eq('wound_case_id', woundId)
    .order('assessed_at', { ascending: false });
  const entries = (assessments ?? []) as Row[];
  const latest = entries[0] ?? {};
  const clientRow = (client ?? {}) as Row;
  const size = [latest.length_cm, latest.width_cm, latest.depth_cm].filter((v) => v != null).map(text).join(' × ');
  const photoCount = entries.reduce((count, entry) => count + (Array.isArray(entry.photo_refs) ? entry.photo_refs.length : 0), 0);
  return { ok: true, data: {
    id: text(row.id), tenantId, clientId: text(row.client_id), bodyLocation: text(row.body_location),
    description: text(latest.wound_bed) || text(row.etiology), documentedAt: text(latest.assessed_at) || text(row.updated_at),
    status: text(row.status) === 'healed' ? 'abgeschlossen' : 'aktiv', sensitivity: 'health', visibility: 'team',
    createdAt: text(row.created_at), updatedAt: text(row.updated_at),
    clientName: `${text(clientRow.first_name)} ${text(clientRow.last_name)}`.trim() || '—',
    woundType: text(row.wound_type), woundSize: size ? `${size} cm` : 'Nicht gemessen',
    treatmentPlan: text(row.treatment_plan), photoCount, bodyMapPrepared: true,
    nextReviewAt: text(row.next_review_at) || null,
    caregiverNotes: [text(latest.intervention), text(latest.response)].filter(Boolean).join(' · '),
  } };
}
