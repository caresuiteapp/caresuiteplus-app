import type { ServiceResult } from '@/types';
import type {
  BodyMapAgeGroup,
  BodyMapAnatomyPackId,
  BodyMapChestAnatomy,
  BodyMapGender,
  BodyMapGenitalAnatomy,
  BodyMapMarker,
  BodyMapMarkerCreateInput,
  BodyMapMarkerType,
  BodyMapModelId,
  BodyMapRegion,
  BodyMapSex,
  BodyMapSkinTone,
  BodyMapSurfacePoint,
  BodyMapView,
} from '@/types/modules/bodyMap';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

export const BODY_MAP_MARKER_SELECT_COLUMNS =
  'id, tenant_id, client_id, wound_id, gender, view, region, marker_type, x_percent, y_percent, note, model_id, anatomy_pack_id, age_group, sex, genital_anatomy, chest_anatomy, skin_tone, anatomical_zone_id, local_position, world_position, model_position, surface_normal, model_normal, surface_uv, mesh_name, primitive_index, triangle_index, pressure_classification, finding_status, finding_details, created_by, created_at, updated_at';

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
  model_id?: BodyMapModelId | null;
  anatomy_pack_id?: BodyMapAnatomyPackId | null;
  age_group?: BodyMapAgeGroup | null;
  sex?: BodyMapSex | null;
  genital_anatomy?: BodyMapGenitalAnatomy | null;
  chest_anatomy?: BodyMapChestAnatomy | null;
  skin_tone?: BodyMapSkinTone | null;
  anatomical_zone_id?: string | null;
  local_position?: BodyMapSurfacePoint['localPosition'] | null;
  world_position?: BodyMapSurfacePoint['worldPosition'] | null;
  model_position?: BodyMapSurfacePoint['modelPosition'] | null;
  surface_normal?: BodyMapSurfacePoint['normal'] | null;
  model_normal?: BodyMapSurfacePoint['modelNormal'] | null;
  surface_uv?: BodyMapSurfacePoint['uv'] | null;
  mesh_name?: string | null;
  primitive_index?: number | null;
  triangle_index?: number | null;
  pressure_classification?: string | null;
  finding_status?: string | null;
  finding_details?: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export function mapBodyMapMarkerRow(row: BodyMapMarkerLiveRow): BodyMapMarker {
  const hasSurfacePoint =
    !!row.local_position &&
    !!row.world_position &&
    !!row.surface_normal &&
    typeof row.mesh_name === 'string';
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
    modelId: row.model_id ?? null,
    anatomyPackId: row.anatomy_pack_id ?? null,
    ageGroup: row.age_group ?? null,
    sex: row.sex ?? null,
    genitalAnatomy: row.genital_anatomy ?? null,
    chestAnatomy: row.chest_anatomy ?? null,
    skinTone: row.skin_tone ?? null,
    anatomicalZoneId: row.anatomical_zone_id ?? null,
    surfacePoint: hasSurfacePoint
      ? {
          localPosition: row.local_position!,
          worldPosition: row.world_position!,
          modelPosition: row.model_position ?? undefined,
          normal: row.surface_normal!,
          modelNormal: row.model_normal ?? undefined,
          uv: row.surface_uv ?? null,
          meshName: row.mesh_name!,
          primitiveIndex: row.primitive_index ?? null,
          triangleIndex: row.triangle_index ?? null,
        }
      : null,
    pressureClassification: row.pressure_classification ?? null,
    findingStatus: row.finding_status ?? null,
    findingDetails: row.finding_details ?? {},
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
    input: BodyMapMarkerCreateInput & { createdBy?: string | null },
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
        model_id: input.modelId ?? null,
        anatomy_pack_id: input.anatomyPackId ?? null,
        age_group: input.ageGroup ?? null,
        sex: input.sex ?? null,
        genital_anatomy: input.genitalAnatomy ?? null,
        chest_anatomy: input.chestAnatomy ?? null,
        skin_tone: input.skinTone ?? null,
        anatomical_zone_id: input.anatomicalZoneId ?? null,
        local_position: input.surfacePoint?.localPosition ?? null,
        world_position: input.surfacePoint?.worldPosition ?? null,
        model_position: input.surfacePoint?.modelPosition ?? null,
        surface_normal: input.surfacePoint?.normal ?? null,
        model_normal: input.surfacePoint?.modelNormal ?? null,
        surface_uv: input.surfacePoint?.uv ?? null,
        mesh_name: input.surfacePoint?.meshName ?? null,
        primitive_index: input.surfacePoint?.primitiveIndex ?? null,
        triangle_index: input.surfacePoint?.triangleIndex ?? null,
        pressure_classification: input.pressureClassification ?? null,
        finding_status: input.findingStatus ?? 'aktiv',
        finding_details: input.findingDetails ?? {},
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
