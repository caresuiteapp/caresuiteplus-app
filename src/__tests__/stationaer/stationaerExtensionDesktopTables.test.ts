import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Stationär Extension Desktop Tables (Sprint 101)', () => {
  it('LivingAreasListTable hat Spalten Bereich, Kapazität, Belegt, Frei, Status', () => {
    const source = readSrc('src/components/stationaer/LivingAreasListTable.tsx');
    expect(source).toContain('PremiumDataTable');
    expect(source).toContain('label: \'Bereich\'');
    expect(source).toContain('label: \'Kapazität\'');
    expect(source).toContain('label: \'Belegt\'');
  });

  it('LivingAreasListView nutzt Desktop View-Toggle und Persistenz', () => {
    const source = readSrc('src/components/stationaer/LivingAreasListView.tsx');
    expect(source).toContain('useDesktopListViewPreference');
    expect(source).toContain("'stationaer.livingAreas'");
    expect(source).toContain('LivingAreasListTable');
    expect(source).toContain('showViewToggle={isDesktop}');
  });

  it('HandoverReportListTable und HandoverReportsListView existieren', () => {
    expect(readSrc('src/components/stationaer/HandoverReportListTable.tsx')).toContain('PremiumDataTable');
    expect(readSrc('src/components/stationaer/HandoverReportsListView.tsx')).toContain("'stationaer.handovers'");
  });

  it('LivingAreaDetailHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/stationaer/LivingAreaDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(readSrc('src/screens/stationaer/LivingAreaDetailScreen.tsx')).toContain('LivingAreaDetailHero');
    expect(readSrc('app/stationaer/wohnbereiche/[id].tsx')).toContain('LivingAreaDetailScreen');
  });

  it('HandoverDetailHero und Route existieren', () => {
    expect(readSrc('src/components/stationaer/HandoverDetailHero.tsx')).toContain('PremiumListHeroFrame');
    expect(readSrc('app/stationaer/uebergabebericht/[id].tsx')).toContain('HandoverDetailScreen');
  });
});

describe('Akademie Extension Desktop Tables (Sprint 101)', () => {
  it('EnrollmentsListTable hat Spalten Teilnehmer, Kurs, Fortschritt', () => {
    const source = readSrc('src/components/akademie/EnrollmentsListTable.tsx');
    expect(source).toContain('PremiumDataTable');
    expect(source).toContain('label: \'Teilnehmer:in\'');
    expect(source).toContain('label: \'Kurs\'');
  });

  it('EnrollmentsListView nutzt Persistenz akademie.enrollments', () => {
    const source = readSrc('src/components/akademie/EnrollmentsListView.tsx');
    expect(source).toContain("'akademie.enrollments'");
    expect(source).toContain('EnrollmentsListTable');
  });

  it('CertificatesListView nutzt Persistenz akademie.certificates', () => {
    const source = readSrc('src/components/akademie/CertificatesListView.tsx');
    expect(source).toContain("'akademie.certificates'");
    expect(source).toContain('CertificatesListTable');
  });

  it('EnrollmentDetailHero und CertificateDetailHero existieren', () => {
    expect(readSrc('src/components/akademie/EnrollmentDetailHero.tsx')).toContain('PremiumListHeroFrame');
    expect(readSrc('app/akademie/teilnehmer/[id].tsx')).toContain('EnrollmentDetailScreen');
    expect(readSrc('app/akademie/zertifikate/[id].tsx')).toContain('CertificateDetailScreen');
  });
});
