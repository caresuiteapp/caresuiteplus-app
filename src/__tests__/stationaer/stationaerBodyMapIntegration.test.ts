import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBodyMapMarker,
  fetchBodyMapMarkers,
} from '@/lib/pflege/bodyMapService';

afterEach(() => vi.unstubAllEnvs());

function read(path: string) {
  return readFileSync(path, 'utf8');
}

describe('stationäre 3D-Bodymap-Integration', () => {
  it('stellt Modulhub und bewohnerbezogene Bodymap-Route bereit', () => {
    expect(read('app/stationaer/bodymap.tsx')).toContain(
      'StationaerBodyMapHubScreen',
    );
    const route = read('app/stationaer/bewohner/[id]/bodymap.tsx');
    expect(route).toContain('<BodyMapScreen careContext="stationaer"');
  });

  it('verlinkt die Bodymap in Navigation und Bewohnerakte', () => {
    expect(read('src/lib/navigation/modulenav/stationaernav.ts')).toContain(
      "href: '/stationaer/bodymap'",
    );
    expect(read('src/screens/stationaer/ResidentDetailScreen.tsx')).toContain(
      '/bodymap',
    );
  });

  it('trennt Bewohner:innen technisch von Pflege-Klient:innen', () => {
    const repository = read('src/lib/pflege/bodyMapRepository.supabase.ts');
    const service = read('src/lib/pflege/bodyMapClinicalService.ts');
    const migration = read(
      'supabase/migrations/20260726094500_bodymap_clinical_interaction_phase9.sql',
    );
    expect(repository).toContain("subjectType: BodyMapSubjectType = 'client'");
    expect(repository).toContain('resident_record_id');
    expect(service).toContain("'subjects'");
    expect(service).toContain("'resident'");
    expect(migration).toContain("subject_type IN ('client', 'resident')");
    expect(migration).toContain('body_map_markers_subject_reference_check');
  });

  it('nutzt dieselbe klinische Engine und keine abweichende Stationär-Kopie', () => {
    const hub = read('src/screens/stationaer/StationaerBodyMapHubScreen.tsx');
    const residentRoute = read('app/stationaer/bewohner/[id]/bodymap.tsx');
    expect(hub).toContain('Alle 18 Körpervarianten');
    expect(residentRoute).toContain("@/screens/pflege/BodyMapScreen");
  });

  it('isoliert im Demo-Lauf identische Pflege- und Bewohner-IDs', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const tenantId = 'tenant-stationaer-bodymap';
    const sharedId = 'same-subject-id';
    const baseInput = {
      clientId: sharedId,
      gender: 'neutral' as const,
      view: 'vorderseite' as const,
      region: 'rumpf' as const,
      markerType: 'wunde' as const,
      xPercent: 50,
      yPercent: 50,
    };
    expect(
      await createBodyMapMarker(
        tenantId,
        { ...baseInput, note: 'Pflege', subjectType: 'client' },
        'nurse',
      ),
    ).toMatchObject({ ok: true });
    expect(
      await createBodyMapMarker(
        tenantId,
        { ...baseInput, note: 'Stationär', subjectType: 'resident' },
        'nurse',
      ),
    ).toMatchObject({ ok: true });

    const clients = await fetchBodyMapMarkers(tenantId, sharedId, 'nurse', 'client');
    const residents = await fetchBodyMapMarkers(
      tenantId,
      sharedId,
      'nurse',
      'resident',
    );
    expect(clients.ok && clients.data.map((entry) => entry.note)).toContain('Pflege');
    expect(clients.ok && clients.data.map((entry) => entry.note)).not.toContain('Stationär');
    expect(residents.ok && residents.data.map((entry) => entry.note)).toContain('Stationär');
    expect(residents.ok && residents.data.map((entry) => entry.note)).not.toContain('Pflege');
  });
});
