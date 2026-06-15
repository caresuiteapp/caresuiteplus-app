import type { ServiceResult } from '@/types';
import type {
  BodyMapGender,
  BodyMapMarker,
  BodyMapMarkerType,
  BodyMapRegion,
  BodyMapView,
} from '@/types/modules/bodyMap';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

export const BODY_MAP_MARKER_SELECT_COLUMNS =
  'id, tenant_id, client_id, wound_id, gender, view, region, marker_type, x_percent, y_percent, note, created_by, created_at, updated_at';

export type BodyMapMarkerLiveRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  wound_id: string | null;
  gender: BodyMapGender;
  view: BodyMapView;
  region: BodyMapRegion;
  marker_type: BodyMapMarkerType;
  x_percent: number;
  y_percent: number;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export function mapBodyMapMarkerRow(row: BodyMapMarkerLiveRow): BodyMapMarker {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    woundId: row.wound_id,
    gender: row.gender,
    view: row.view,
    region: row.region,
    markerType: row.marker_type,
    xPercent: Number(row.x_percent),
    yPercent: Number(row.y_percent),
    note: row.note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBodyMapMarkerRows(rows: BodyMapMarkerLiveRow[]): ServiceResult<BodyMapMarker[]> {
  return { ok: true, data: rows.map(mapBodyMapMarkerRow) };
}

async function writeBodyMapAudit(
  tenantId: string,
  clientId: string,
  action: string,
  details: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await fromUnknownTable(supabase, 'client_audit_entries').insert({
      tenant_id: tenantId,
      client_id: clientId,
      action,
      actor_name: 'BodyMap',
      details,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Audit ist optional — Marker-Operation darf nicht scheitern
  }
}

/** WP342 — Live Supabase Repository (BodyMap-Marker) */
export const bodyMapSupabaseRepository = {
  wpNumber: 342,
  table: 'body_map_markers',
  entityLabel: 'BodyMap-Marker',

  async listByClient(tenantId: string, clientId: string): Promise<ServiceResult<BodyMapMarker[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'body_map_markers')
      .select(BODY_MAP_MARKER_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return mapBodyMapMarkerRows((data ?? []) as unknown as BodyMapMarkerLiveRow[]);
  },

  async create(
    tenantId: string,
    input: {
      clientId: string;
      gender: BodyMapGender;
      view: BodyMapView;
      region: BodyMapRegion;
      markerType: BodyMapMarkerType;
      xPercent: number;
      yPercent: number;
      note: string;
      woundId?: string | null;
      createdBy?: string | null;
    },
  ): Promise<ServiceResult<BodyMapMarker>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const now = new Date().toISOString();
    const { data, error } = await fromUnknownTable(supabase, 'body_map_markers')
      .insert({
        tenant_id: tenantId,
        client_id: input.clientId,
        wound_id: input.woundId ?? null,
        gender: input.gender,
        view: input.view,
        region: input.region,
        marker_type: input.markerType,
        x_percent: input.xPercent,
        y_percent: input.yPercent,
        note: input.note,
        created_by: input.createdBy ?? null,
        created_at: now,
        updated_at: now,
      })
      .select(BODY_MAP_MARKER_SELECT_COLUMNS)
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    const marker = mapBodyMapMarkerRow(data as unknown as BodyMapMarkerLiveRow);
    await writeBodyMapAudit(
      tenantId,
      input.clientId,
      'BodyMap-Marker angelegt',
      `${input.markerType} · ${input.region}`,
    );
    return { ok: true, data: marker };
  },

  async update(
    tenantId: string,
    clientId: string,
    markerId: string,
    patch: Partial<Pick<BodyMapMarker, 'markerType' | 'note' | 'region' | 'view' | 'xPercent' | 'yPercent'>>,
  ): Promise<ServiceResult<BodyMapMarker>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const rowPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.markerType !== undefined) rowPatch.marker_type = patch.markerType;
    if (patch.note !== undefined) rowPatch.note = patch.note;
    if (patch.region !== undefined) rowPatch.region = patch.region;
    if (patch.view !== undefined) rowPatch.view = patch.view;
    if (patch.xPercent !== undefined) rowPatch.x_percent = patch.xPercent;
    if (patch.yPercent !== undefined) rowPatch.y_percent = patch.yPercent;

    const { data, error } = await fromUnknownTable(supabase, 'body_map_markers')
      .update(rowPatch)
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('id', markerId)
      .select(BODY_MAP_MARKER_SELECT_COLUMNS)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Marker nicht gefunden.' };
    const marker = mapBodyMapMarkerRow(data as unknown as BodyMapMarkerLiveRow);
    await writeBodyMapAudit(tenantId, clientId, 'BodyMap-Marker aktualisiert', markerId);
    return { ok: true, data: marker };
  },

  async remove(
    tenantId: string,
    clientId: string,
    markerId: string,
  ): Promise<ServiceResult<{ removed: boolean }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data: existing, error: lookupError } = await fromUnknownTable(supabase, 'body_map_markers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('id', markerId)
      .maybeSingle();
    if (lookupError) return { ok: false, error: toGermanSupabaseError(lookupError) };
    if (!existing) return { ok: false, error: 'Marker nicht gefunden.' };

    const { error } = await fromUnknownTable(supabase, 'body_map_markers')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('id', markerId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    await writeBodyMapAudit(tenantId, clientId, 'BodyMap-Marker entfernt', markerId);
    return { ok: true, data: { removed: true } };
  },
};
