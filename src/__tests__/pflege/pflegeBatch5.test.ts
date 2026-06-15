import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDemoCareRecordListItems } from '@/data/demo/careRecords';
import { buildCareDocumentationDetailKpis } from '@/lib/pflege/careDocumentationListStats';
import {
  buildPflegeCrossModuleLinks,
  type PflegeCrossModuleContext,
} from '@/lib/pflege/pflegeCrossModuleLinks';
import {
  isMedicationEmpReady,
  isWoundBodyMapReady,
} from '@/lib/pflege/pflegeModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Pflege Sprint Batch 5 (Sprint 79)', () => {
  it('pflegeCrossModuleLinks liefert konsistente Verknüpfungen pro Kontext', () => {
    const contexts: PflegeCrossModuleContext[] = [
      'care-plan',
      'vital-reading',
      'vital-create',
      'sis-assessment',
      'sis-form',
      'medication',
      'wound',
      'care-documentation',
    ];

    for (const context of contexts) {
      const links = buildPflegeCrossModuleLinks(context);
      expect(links.length).toBeGreaterThanOrEqual(4);
      expect(links.every((link) => link.href.startsWith('/'))).toBe(true);
      expect(links.some((link) => link.href === '/stationaer/bewohner')).toBe(true);
    }
  });

  it('PflegeCrossModuleLinksPanel ist in allen Pflege-Detailscreens eingebunden', () => {
    const screens = [
      'src/screens/pflege/CarePlanDetailScreen.tsx',
      'src/screens/pflege/VitalReadingDetailScreen.tsx',
      'src/screens/pflege/SisDetailScreen.tsx',
      'src/screens/pflege/MedicationDetailScreen.tsx',
      'src/screens/pflege/WoundDocumentationDetailScreen.tsx',
      'src/screens/pflege/CareDocumentationDetailScreen.tsx',
      'src/screens/pflege/SisPreparedFormScreen.tsx',
      'src/screens/pflege/VitalReadingCreateScreen.tsx',
    ];

    for (const screen of screens) {
      const src = readSrc(screen);
      expect(src).toContain('PflegeCrossModuleLinksPanel');
      expect(src).toContain('context=');
    }
  });

  it('Prepared-Form-Screens nutzen PremiumListHeroFrame statt flacher PremiumCard', () => {
    expect(readSrc('src/components/pflege/SisPreparedFormHero.tsx')).toContain('PremiumListHeroFrame');
    expect(readSrc('src/components/pflege/VitalReadingCreateHero.tsx')).toContain('PremiumListHeroFrame');
    expect(readSrc('src/screens/pflege/SisPreparedFormScreen.tsx')).toContain('SisPreparedFormHero');
    expect(readSrc('src/screens/pflege/VitalReadingCreateScreen.tsx')).toContain('VitalReadingCreateHero');
    expect(readSrc('src/screens/pflege/SisPreparedFormScreen.tsx')).not.toContain('PremiumCard style={styles.header}');
    expect(readSrc('src/screens/pflege/VitalReadingCreateScreen.tsx')).not.toContain('PremiumCard');
  });

  it('CareDocumentationDetailHero ersetzt flachen Inline-Header', () => {
    expect(readSrc('src/components/pflege/CareDocumentationDetailHero.tsx')).toContain('PremiumListHeroFrame');
    expect(readSrc('src/screens/pflege/CareDocumentationDetailScreen.tsx')).toContain('CareDocumentationDetailHero');
    expect(readSrc('src/screens/pflege/CareDocumentationDetailScreen.tsx')).not.toContain(
      '<PremiumListHeroFrame>',
    );
  });

  it('buildCareDocumentationDetailKpis deckt Signatur und PDF ab', () => {
    const record = getDemoCareRecordListItems()[0];
    expect(record).toBeTruthy();
    const kpis = buildCareDocumentationDetailKpis({
      id: record!.id,
      tenantId: record!.tenantId,
      title: record!.assignmentTitle,
      clientName: record!.clientName,
      employeeName: record!.employeeName,
      recordedAt: record!.recordedAt,
      status: record!.status,
      updatedAt: record!.updatedAt,
      hasSignature: record!.hasSignature,
      pdfReady: record!.pdfReady,
      contentPreview: record!.content.slice(0, 120),
      content: record!.content,
      durationMinutes: 45,
      location: 'Wohnung',
    });
    expect(kpis.some((k) => k.id === 'signed')).toBe(true);
    expect(kpis.some((k) => k.id === 'pdf')).toBe(true);
  });

  it('APP_ROUTES listet alle Pflege-Unterrouten unter /pflege', () => {
    const routes = readSrc('src/lib/navigation/routes.ts');
    expect(routes).toContain("'/pflege/medikation'");
    expect(routes).toContain("'/pflege/wunddokumentation'");
    expect(routes).toContain("'/pflege/dokumentation'");
    expect(routes).toContain("'/pflege/dienstplaene'");
    expect(routes).toContain("'/pflege/sis'");
    expect(routes).toContain("'/pflege/auswertungen'");
    expect(routes).toContain("'/pflege/settings'");
  });

  it('CarePlanDetail verlinkt Vitalwerte in die Detailroute', () => {
    const screen = readSrc('src/screens/pflege/CarePlanDetailScreen.tsx');
    expect(screen).toContain('onPress={() => router.push(`/pflege/vitalwerte/${reading.id}`');
  });

  it('eMP bleibt extern; BodyMap ist demo-funktional', () => {
    expect(isMedicationEmpReady()).toBe(false);
    expect(isWoundBodyMapReady()).toBe(true);
  });

  it('Detail-Heroes zeigen externe Anbindung für eMP/BodyMap/Sign/PDF', () => {
    const medHero = readSrc('src/components/pflege/MedicationDetailHero.tsx');
    const woundHero = readSrc('src/components/pflege/WoundDocumentationDetailHero.tsx');
    const docHero = readSrc('src/components/pflege/CareDocumentationDetailHero.tsx');

    expect(medHero).toMatch(/eMP|extern/i);
    expect(woundHero).toMatch(/BodyMap|extern/i);
    expect(docHero).toMatch(/Signatur|PDF/i);
  });

  it('SIS/Vital Form-Screens nutzen demo-funktional statt hartem preparedOnly', () => {
    expect(readSrc('src/screens/pflege/SisFormScreen.tsx')).toContain('saveSisFormAssessment');
    expect(readSrc('src/screens/pflege/VitalReadingCreateScreen.tsx')).toContain('isVitalWriteReady');
    expect(readSrc('src/screens/pflege/VitalReadingCreateScreen.tsx')).toContain('createVitalReading');
    expect(readSrc('app/pflege/bodymap.tsx')).toContain('BodyMapScreen');
  });
});
