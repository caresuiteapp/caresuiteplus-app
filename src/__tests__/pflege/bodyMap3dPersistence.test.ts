import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BODY_MAP_MARKER_SELECT_COLUMNS,
  mapBodyMapMarkerRow,
  type BodyMapMarkerLiveRow,
} from '@/lib/pflege/bodyMapRepository.supabase';

function readSrc(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Medizinische 3D-Bodymap-Persistenz', () => {
  it('selektiert sämtliche Felder für einen reproduzierbaren 3D-Anker', () => {
    for (const column of [
      'model_id',
      'anatomy_pack_id',
      'anatomical_zone_id',
      'local_position',
      'world_position',
      'surface_normal',
      'surface_uv',
      'mesh_name',
      'primitive_index',
      'triangle_index',
      'pressure_classification',
      'finding_details',
    ]) {
      expect(BODY_MAP_MARKER_SELECT_COLUMNS).toContain(column);
    }
  });

  it('rekonstruiert einen vollständigen 3D-Oberflächenpunkt', () => {
    const row: BodyMapMarkerLiveRow = {
      id: 'marker-1',
      tenant_id: 'tenant-1',
      client_id: 'client-1',
      wound_id: null,
      gender: 'neutral',
      view: 'vorderseite',
      region: 'rumpf',
      marker_type: 'dekubitus',
      x_percent: 50,
      y_percent: 50,
      note: 'Kategorie 2',
      model_id: 'body-erwachsener-divers',
      anatomy_pack_id: 'anatomy-pack-vulva',
      age_group: 'erwachsener',
      sex: 'divers',
      genital_anatomy: 'vulva',
      chest_anatomy: 'brueste',
      skin_tone: 'mittel',
      anatomical_zone_id: 'rumpf.brust.links',
      local_position: { x: 0.1, y: 0.2, z: 0.3 },
      world_position: { x: 1.1, y: 1.2, z: 1.3 },
      surface_normal: { x: 0, y: 0, z: 1 },
      surface_uv: { u: 0.4, v: 0.6 },
      mesh_name: 'torso',
      primitive_index: 0,
      triangle_index: 42,
      pressure_classification: 'kategorie_2',
      finding_status: 'aktiv',
      finding_details: { diagnose: 'Druckverletzung' },
      created_by: 'profile-1',
      created_at: '2026-07-25T08:00:00.000Z',
      updated_at: '2026-07-25T08:00:00.000Z',
    };

    const marker = mapBodyMapMarkerRow(row);
    expect(marker.surfacePoint).toEqual({
      localPosition: row.local_position,
      worldPosition: row.world_position,
      normal: row.surface_normal,
      uv: row.surface_uv,
      meshName: 'torso',
      primitiveIndex: 0,
      triangleIndex: 42,
    });
    expect(marker.pressureClassification).toBe('kategorie_2');
    expect(marker.findingDetails).toEqual({ diagnose: 'Druckverletzung' });
  });

  it('Migration schützt klinische Medien und speichert Dekubitus-Verläufe', () => {
    const migration = readSrc('supabase/migrations/20260725083000_bodymap_3d_medical.sql');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.body_map_finding_history');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.body_map_finding_media');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.pressure_injury_assessments');
    expect(migration).toContain("'bodymap-clinical-media'");
    expect(migration).toContain('public.current_tenant_id()');
    expect(migration).toContain('(storage.foldername(name))[2]');
    expect(migration).toContain('measurement_reference_present');
    expect(migration).toContain('append_body_map_finding_history_trigger');
    expect(migration).toContain('body_map_finding_history_select_tenant');
    expect(migration).not.toContain('body_map_finding_history_tenant_policy\n  ON public.body_map_finding_history\n  FOR ALL');
  });
});
