import { describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  createCounselingProtocol,
  fetchCounselingProtocols,
} from '@/lib/beratung/moduleExtensionService';
import {
  createPflegeBericht,
  fetchPflegeBerichteList,
} from '@/lib/pflege/pflegeReportListService';

describe('Arbeitsplan dedicated screen services', () => {
  it('Pflegeberichte list returns demo items', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const list = await fetchPflegeBerichteList(DEMO_TENANT_ID, 'nurse');
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data.length).toBeGreaterThan(0);
    vi.unstubAllEnvs();
  });

  it('Pflegebericht can be created with validation', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const empty = await createPflegeBericht('nurse', {
      title: '',
      reportType: 'pflegebericht',
      clientName: 'Test',
      content: 'Text',
    });
    expect(empty.ok).toBe(false);

    const created = await createPflegeBericht('nurse', {
      title: 'Monatsbericht',
      reportType: 'pflegebericht',
      clientName: 'Test Klient',
      content: 'Verlauf stabil.',
    });
    expect(created.ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it('Beratungsprotokoll can be created and listed', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const before = await fetchCounselingProtocols(DEMO_TENANT_ID, 'counselor');
    expect(before.ok).toBe(true);
    const countBefore = before.ok ? before.data.length : 0;

    const created = await createCounselingProtocol(
      DEMO_TENANT_ID,
      {
        caseId: 'case-001',
        caseSubject: 'Testfall',
        content: 'Protokolltext aus Arbeitsplan-Test',
      },
      'counselor',
    );
    expect(created.ok).toBe(true);

    const after = await fetchCounselingProtocols(DEMO_TENANT_ID, 'counselor');
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.data.length).toBeGreaterThanOrEqual(countBefore);
    vi.unstubAllEnvs();
  });
});

describe('Arbeitsplan route audit heuristics', () => {
  it('dedicated route screens do not use titleOverride', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const dedicated = [
      'src/screens/assist/EinsaetzeListScreen.tsx',
      'src/screens/assist/LeistungsnachweiseListScreen.tsx',
      'src/screens/pflege/SisListScreen.tsx',
      'src/screens/pflege/PflegeplanungListScreen.tsx',
      'src/screens/pflege/PflegeberichteListScreen.tsx',
      'src/screens/pflege/PflegeberichtErstellenScreen.tsx',
      'src/screens/beratung/BeratungFaelleListScreen.tsx',
      'src/screens/beratung/BeratungFallAnlegenScreen.tsx',
      'src/screens/beratung/BeratungProtokolleListScreen.tsx',
      'src/screens/beratung/BeratungProtokollErstellenScreen.tsx',
      'src/screens/stationaer/BewohnerinnenListScreen.tsx',
      'src/screens/stationaer/WohnbereicheListScreen.tsx',
      'src/screens/akademie/AkademieKurseListScreen.tsx',
      'src/screens/akademie/TeilnehmendeListScreen.tsx',
    ];
    for (const rel of dedicated) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      expect(src.includes('titleOverride'), rel).toBe(false);
    }
  });
});
