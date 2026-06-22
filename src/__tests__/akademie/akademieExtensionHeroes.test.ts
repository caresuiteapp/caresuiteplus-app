import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildAkademieReportsKpis,
  buildAkademieSettingsKpis,
  buildCertificateListKpis,
  buildEnrollmentListKpis,
} from '@/lib/akademie/akademieExtensionStats';
import { buildQmDocumentsListKpis } from '@/lib/qm/qmDocumentsListStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Akademie Extension Heroes (Sprint 88)', () => {
  it('EnrollmentsListHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/akademie/EnrollmentsListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Teilnehmer:innen');
    expect(hero).toContain('isAkademieExtensionLiveReady');
  });

  it('CertificatesListHero und AkademieReportsHero nutzen PremiumListHeroFrame', () => {
    const certs = readSrc('src/components/akademie/CertificatesListHero.tsx');
    const reports = readSrc('src/components/akademie/AkademieReportsHero.tsx');
    const settings = readSrc('src/components/akademie/AkademieSettingsHero.tsx');
    expect(certs).toContain('Zertifikate');
    expect(reports).toContain('Auswertungen');
    expect(settings).toContain('Modul-Einstellungen');
  });

  it('Akademie Extension-Screens nutzen neue Heroes', () => {
    expect(readSrc('src/components/akademie/EnrollmentsListView.tsx')).toContain('EnrollmentsListHero');
    expect(readSrc('src/components/akademie/CertificatesListView.tsx')).toContain('CertificatesListHero');
    expect(readSrc('src/screens/akademie/AkademieReportsScreen.tsx')).toContain('AkademieReportsHero');
    expect(readSrc('src/screens/akademie/AkademieSettingsScreen.tsx')).toContain('AkademieSettingsHero');
  });

  it('AkademieIndexScreen nutzt isAkademieCoursesLiveReady auf Kurse-Tile', () => {
    const index = readSrc('src/screens/akademie/AkademieIndexScreen.tsx');
    expect(index).toContain('isAkademieCoursesLiveReady');
    expect(index).toContain('isActive={coursesLive}');
    expect(index).toContain("isActive onPress={() => router.push('/akademie/teilnehmer'");
  });

  it('buildEnrollmentListKpis berechnet Fortschritt', () => {
    const kpis = buildEnrollmentListKpis([
      {
        id: '1',
        tenantId: 't1',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        participantName: 'A',
        courseTitle: 'Hygiene',
        courseId: 'c1',
        profileId: 'p1',
        enrolledAt: '2026-01-01',
        completedAt: null,
        progressPercent: 50,
        status: 'aktiv',
      },
    ]);
    expect(kpis[0]?.value).toBe('1');
    expect(kpis[2]?.value).toBe('50 %');
  });

  it('buildCertificateListKpis zählt Zertifikate', () => {
    const kpis = buildCertificateListKpis([
      {
        id: '1',
        tenantId: 't1',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        participantName: 'A',
        courseTitle: 'Hygiene',
        courseId: 'c1',
        profileId: 'p1',
        issuedAt: new Date().toISOString(),
        expiresAt: null,
        status: 'aktiv',
      },
    ]);
    expect(kpis[0]?.value).toBe('1');
  });

  it('buildAkademieReportsKpis liefert Compliance', () => {
    const kpis = buildAkademieReportsKpis({
      activeCourses: 5,
      enrollmentsOpen: 12,
      completionsThisMonth: 3,
      certificatesExpiring: 2,
      mandatoryCompliancePercent: 91,
    });
    expect(kpis[2]?.value).toBe('91 %');
  });

  it('buildAkademieSettingsKpis zählt aktive Optionen', () => {
    const kpis = buildAkademieSettingsKpis({
      mandatoryReminders: true,
      certificateAutoIssue: false,
      examRequired: true,
      externalInstructors: false,
      progressTracking: true,
    });
    expect(kpis[0]?.value).toBe('3');
  });
});

describe('QM Documents List Hero (Sprint 88)', () => {
  it('QmDocumentsListHero nutzt PremiumListHeroFrame mit Live-Badge', () => {
    const hero = readSrc('src/components/qm/QmDocumentsListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('QM-Dokumente');
    expect(hero).toContain('isQmDocumentsLiveReady');
    expect(hero).toContain('buildQmDocumentsListKpis');
  });

  it('QmDocumentsScreen nutzt QmDocumentsListHero', () => {
    const screen = readSrc('src/screens/qm/QmDocumentsScreen.tsx');
    expect(screen).toContain('QmDocumentsListHero');
    expect(screen).toContain('documents={items}');
  });

  it('buildQmDocumentsListKpis zählt Dokumente und Typen', () => {
    const kpis = buildQmDocumentsListKpis([
      {
        id: '1',
        tenantId: 't1',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        documentNumber: 'QM-001',
        title: 'Verfahren A',
        documentType: 'procedure',
        status: 'published',
        currentVersionId: null,
        chapterId: null,
        ownerRole: 'QM',
        reviewDueAt: null,
        tags: [],
      },
      {
        id: '2',
        tenantId: 't1',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        documentNumber: 'QM-002',
        title: 'Checkliste B',
        documentType: 'checklist',
        status: 'draft',
        currentVersionId: null,
        chapterId: null,
        ownerRole: 'QM',
        reviewDueAt: null,
        tags: [],
      },
    ]);
    expect(kpis[0]?.value).toBe('2');
    expect(kpis[2]?.value).toBe('2');
  });
});
