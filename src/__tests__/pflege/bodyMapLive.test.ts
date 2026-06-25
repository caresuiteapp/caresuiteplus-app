import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  createBodyMapMarker,
  fetchBodyMapMarkers,
  patchBodyMapMarker,
  removeBodyMapMarker,
} from '@/lib/pflege/bodyMapService';
import {
  BODY_MAP_MARKER_SELECT_COLUMNS,
  mapBodyMapMarkerRow,
  mapBodyMapMarkerRows,
  type BodyMapMarkerLiveRow,
} from '@/lib/pflege/bodyMapRepository.supabase';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const sampleRow: BodyMapMarkerLiveRow = {
  id: 'bm-1',
  tenant_id: 'tenant-1',
  client_id: 'client-1',
  wound_id: 'wound-1',
  gender: 'neutral',
  view: 'vorderseite',
  region: 'rumpf',
  marker_type: 'wunde',
  x_percent: 50.25,
  y_percent: 40.5,
  note: 'Test',
  created_by: 'profile-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

describe('BodyMap live MVP (Prompt 02)', () => {
  it('Migration 0042 definiert body_map_markers mit RLS', () => {
    const sql = readSrc('supabase/migrations/0042_bodymap_live.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.body_map_markers');
    expect(sql).toContain('tenant_id UUID NOT NULL');
    expect(sql).toContain('client_id UUID NOT NULL');
    expect(sql).toContain('wound_id UUID NULL');
    expect(sql).toContain("gender IN ('weiblich','maennlich','neutral')");
    expect(sql).toContain("view IN ('vorderseite','rueckseite')");
    expect(sql).toContain('x_percent NUMERIC(5,2)');
    expect(sql).toContain('created_by UUID');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('body_map_markers_tenant_policy');
    expect(sql).toContain('idx_body_map_markers_client');
  });

  it('mapBodyMapMarkerRow mappt Supabase-Zeile auf BodyMapMarker', () => {
    const marker = mapBodyMapMarkerRow(sampleRow);
    expect(marker.id).toBe('bm-1');
    expect(marker.tenantId).toBe('tenant-1');
    expect(marker.clientId).toBe('client-1');
    expect(marker.woundId).toBe('wound-1');
    expect(marker.xPercent).toBe(50.25);
    expect(marker.yPercent).toBe(40.5);
    expect(marker.note).toBe('Test');
  });

  it('mapBodyMapMarkerRows liefert leere Liste bei leeren Zeilen', () => {
    const result = mapBodyMapMarkerRows([]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });

  it('BODY_MAP_MARKER_SELECT_COLUMNS deckt alle Pflichtfelder ab', () => {
    expect(BODY_MAP_MARKER_SELECT_COLUMNS).toContain('tenant_id');
    expect(BODY_MAP_MARKER_SELECT_COLUMNS).toContain('client_id');
    expect(BODY_MAP_MARKER_SELECT_COLUMNS).toContain('wound_id');
    expect(BODY_MAP_MARKER_SELECT_COLUMNS).toContain('marker_type');
    expect(BODY_MAP_MARKER_SELECT_COLUMNS).toContain('x_percent');
    expect(BODY_MAP_MARKER_SELECT_COLUMNS).toContain('created_by');
  });

  it('bodyMapService nutzt guardServiceTenant und Live-Repository', () => {
    const source = readSrc('src/lib/pflege/bodyMapService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('bodyMapSupabaseRepository');
    expect(source).toContain('Klient:in fehlt');
    expect(source).not.toContain('isPflegeDemoFunctional');
  });

  it('BodyMapScreen misst Canvas per onLayout statt fester Pixel', () => {
    const source = readSrc('src/screens/pflege/BodyMapScreen.tsx');
    expect(source).toContain('canvasSize');
    expect(source).toContain('onLayout');
    expect(source).toContain('canvasSize.width');
    expect(source).toContain('canvasSize.height');
    expect(source).not.toContain('/ 280');
    expect(source).not.toContain('/ 420');
  });

  it('bodyMapRepository schreibt optional Audit-Einträge', () => {
    const source = readSrc('src/lib/pflege/bodyMapRepository.supabase.ts');
    expect(source).toContain('client_audit_entries');
    expect(source).toContain('writeBodyMapAudit');
  });

  it('Demo-Modus: Marker CRUD funktioniert weiterhin', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const clientId = 'client-bodymap-live-test';

    const created = await createBodyMapMarker(
      DEMO_TENANT_ID,
      {
        clientId,
        gender: 'neutral',
        view: 'vorderseite',
        region: 'rumpf',
        markerType: 'wunde',
        xPercent: 50,
        yPercent: 40,
        note: 'Live-Test Demo',
      },
      'nurse',
    );
    expect(created.ok).toBe(true);

    const list = await fetchBodyMapMarkers(DEMO_TENANT_ID, clientId, 'nurse');
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data.length).toBeGreaterThan(0);

    const markerId = list.ok ? list.data[0]!.id : '';
    const patched = await patchBodyMapMarker(
      DEMO_TENANT_ID,
      clientId,
      markerId,
      { note: 'Aktualisiert live-test' },
      'nurse',
    );
    expect(patched.ok).toBe(true);

    const removed = await removeBodyMapMarker(DEMO_TENANT_ID, clientId, markerId, 'nurse');
    expect(removed.ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it('Live-Modus ohne Supabase meldet Supabase nicht verfügbar', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    const result = await fetchBodyMapMarkers(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
      'nurse',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Supabase|nicht verfügbar/i);

    vi.unstubAllEnvs();
  });
});
