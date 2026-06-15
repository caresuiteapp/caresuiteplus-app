import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import type {
  MdAccessLogEntry,
  MdAuditPackage,
  MdAuditPackageItem,
  MdShareToken,
  QmAiDraft,
  QmAudit,
  QmChange,
  QmComplianceRequirement,
  QmDocument,
  QmDocumentVersion,
  QmExportJob,
  QmHandbook,
  QmHandbookChapter,
  QmLegalReference,
  QmMeasure,
  QmReadConfirmation,
  QmTemplateSeed,
} from './qm.types';

const T = DEMO_TENANT_ID;
const NOW = '2026-06-01T10:00:00.000Z';

function ts(offsetDays = 0): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function entity<T extends { id: string; tenantId: string; createdAt: string; updatedAt: string }>(
  base: Omit<T, 'tenantId' | 'createdAt' | 'updatedAt'>,
  createdOffset = 0,
): T {
  return {
    ...base,
    tenantId: T,
    createdAt: ts(createdOffset),
    updatedAt: ts(createdOffset),
  } as T;
}

export const QM_HANDBOOK: QmHandbook = entity({
  id: 'qm-handbook-001',
  title: 'Qualitätsmanagement-Handbuch',
  version: '3.2',
  status: 'active',
  approvedAt: ts(-30),
  approvedBy: 'PDL Schmidt',
});

const CHAPTER_TITLES = [
  'Einleitung und Geltungsbereich',
  'Qualitätspolitik und Qualitätsziele',
  'Organisation und Verantwortlichkeiten',
  'Qualitätsmanagementbeauftragter (QMB)',
  'Pflegedienstleitung (PDL)',
  'Dokumentenlenkung',
  'Risikomanagement',
  'Prozessmanagement',
  'Personal und Qualifikation',
  'Hygiene und Infektionsschutz',
  'Medikamentenmanagement',
  'Notfallmanagement',
  'Beschwerdemanagement',
  'Interne Audits',
  'Maßnahmenmanagement',
  'MD-Prüfung Vorbereitung',
  'Externe Prüfungen',
  'Fortbildung und Schulung',
  'Datenschutz und DSGVO',
  'Anhang A – Formularverzeichnis',
  'Anhang B – Gesetzesverzeichnis',
  'Anhang C – Prozesslandkarte',
];

export const QM_CHAPTERS: QmHandbookChapter[] = CHAPTER_TITLES.map((title, i) =>
  entity({
    id: `qm-ch-${String(i + 1).padStart(3, '0')}`,
    handbookId: QM_HANDBOOK.id,
    parentId: i === 0 ? null : 'qm-ch-001',
    sortOrder: i + 1,
    title,
    content: `# ${title}\n\nDieses Kapitel beschreibt die verbindlichen Anforderungen für ${title.toLowerCase()} im ambulanten Pflegedienst.\n\n## Zweck\nSicherstellung der Qualität gemäß § 113 SGB XI und MDK-Richtlinien.\n\n## Verantwortlichkeit\nQMB und PDL tragen die Gesamtverantwortung.`,
    version: '3.2',
    status: i < 18 ? 'published' : 'in_review',
    lastReviewedAt: ts(-60 + i),
  }, -90 + i),
);

const DOC_DEFS: Array<{
  id: string;
  num: string;
  title: string;
  type: QmDocument['documentType'];
  status: QmDocument['status'];
  chapterIdx: number;
  tags: string[];
}> = [
  { id: 'qm-doc-001', num: 'VA-QM-001', title: 'Dokumentenlenkung', type: 'procedure', status: 'published', chapterIdx: 5, tags: ['QM', 'Dokumente'] },
  { id: 'qm-doc-002', num: 'VA-QM-002', title: 'Internes Auditverfahren', type: 'procedure', status: 'published', chapterIdx: 13, tags: ['Audit'] },
  { id: 'qm-doc-003', num: 'VA-QM-003', title: 'Maßnahmenmanagement', type: 'procedure', status: 'published', chapterIdx: 14, tags: ['Maßnahmen'] },
  { id: 'qm-doc-004', num: 'VA-QM-004', title: 'Beschwerdemanagement', type: 'procedure', status: 'published', chapterIdx: 12, tags: ['Beschwerde'] },
  { id: 'qm-doc-005', num: 'VA-QM-005', title: 'Risikomanagement Pflege', type: 'procedure', status: 'approved', chapterIdx: 6, tags: ['Risiko'] },
  { id: 'qm-doc-006', num: 'VA-HY-001', title: 'Hygienemanagement', type: 'procedure', status: 'published', chapterIdx: 9, tags: ['Hygiene'] },
  { id: 'qm-doc-007', num: 'VA-MED-001', title: 'Medikamentengabe ambulant', type: 'procedure', status: 'published', chapterIdx: 10, tags: ['Medikamente'] },
  { id: 'qm-doc-008', num: 'VA-NOT-001', title: 'Notfallmanagement', type: 'procedure', status: 'published', chapterIdx: 11, tags: ['Notfall'] },
  { id: 'qm-doc-009', num: 'AA-PFL-001', title: 'Erstbesuch dokumentieren', type: 'work_instruction', status: 'published', chapterIdx: 7, tags: ['Pflege'] },
  { id: 'qm-doc-010', num: 'AA-PFL-002', title: 'Wundversorgung durchführen', type: 'work_instruction', status: 'published', chapterIdx: 9, tags: ['Wunde'] },
  { id: 'qm-doc-011', num: 'AA-PFL-003', title: 'Medikamentenbox kontrollieren', type: 'work_instruction', status: 'published', chapterIdx: 10, tags: ['Medikamente'] },
  { id: 'qm-doc-012', num: 'AA-PFL-004', title: 'Sturzprotokoll ausfüllen', type: 'work_instruction', status: 'in_review', chapterIdx: 6, tags: ['Sturz'] },
  { id: 'qm-doc-013', num: 'CL-AUD-001', title: 'Audit-Checkliste Station', type: 'checklist', status: 'published', chapterIdx: 13, tags: ['Audit'] },
  { id: 'qm-doc-014', num: 'CL-HY-001', title: 'Hygiene-Begehung', type: 'checklist', status: 'published', chapterIdx: 9, tags: ['Hygiene'] },
  { id: 'qm-doc-015', num: 'CL-MD-001', title: 'MD-Prüfungsvorbereitung', type: 'checklist', status: 'published', chapterIdx: 15, tags: ['MD'] },
  { id: 'qm-doc-016', num: 'CL-EIN-001', title: 'Einarbeitungs-Checkliste', type: 'checklist', status: 'published', chapterIdx: 8, tags: ['Personal'] },
  { id: 'qm-doc-017', num: 'PR-AUD-001', title: 'Internes Audit Protokoll', type: 'protocol', status: 'published', chapterIdx: 13, tags: ['Audit'] },
  { id: 'qm-doc-018', num: 'PR-BES-001', title: 'Beschwerdeprotokoll', type: 'protocol', status: 'published', chapterIdx: 12, tags: ['Beschwerde'] },
  { id: 'qm-doc-019', num: 'PR-MD-001', title: 'MD-Begleitprotokoll', type: 'protocol', status: 'approved', chapterIdx: 15, tags: ['MD'] },
  { id: 'qm-doc-020', num: 'PO-DAT-001', title: 'Datenschutzrichtlinie', type: 'policy', status: 'published', chapterIdx: 18, tags: ['DSGVO'] },
  { id: 'qm-doc-021', num: 'PO-QUA-001', title: 'Qualitätspolitik', type: 'policy', status: 'published', chapterIdx: 1, tags: ['Qualität'] },
  { id: 'qm-doc-022', num: 'VA-PER-001', title: 'Personalentwicklung', type: 'procedure', status: 'published', chapterIdx: 8, tags: ['Personal'] },
  { id: 'qm-doc-023', num: 'AA-PFL-005', title: 'SIS-Dokumentation', type: 'work_instruction', status: 'draft', chapterIdx: 7, tags: ['SIS'] },
  { id: 'qm-doc-024', num: 'CL-QUA-001', title: 'Qualitätsrunde monatlich', type: 'checklist', status: 'published', chapterIdx: 2, tags: ['Qualität'] },
  { id: 'qm-doc-025', num: 'PR-NOT-001', title: 'Notfallprotokoll', type: 'protocol', status: 'published', chapterIdx: 11, tags: ['Notfall'] },
  { id: 'qm-doc-026', num: 'VA-MD-001', title: 'MD-Prüfungsvorbereitung Verfahren', type: 'procedure', status: 'published', chapterIdx: 15, tags: ['MD'] },
  { id: 'qm-doc-027', num: 'AA-HY-001', title: 'Händedesinfektion', type: 'work_instruction', status: 'published', chapterIdx: 9, tags: ['Hygiene'] },
  { id: 'qm-doc-028', num: 'CL-FOR-001', title: 'Fortbildungsnachweis', type: 'checklist', status: 'published', chapterIdx: 17, tags: ['Fortbildung'] },
  { id: 'qm-doc-029', num: 'PR-AUD-002', title: 'Audit-Nachverfolgung', type: 'protocol', status: 'in_review', chapterIdx: 13, tags: ['Audit'] },
  { id: 'qm-doc-030', num: 'VA-EXT-001', title: 'Externe Prüfung begleiten', type: 'procedure', status: 'approved', chapterIdx: 16, tags: ['Prüfung'] },
  { id: 'qm-doc-031', num: 'PO-RAU-001', title: 'Rauchverbot-Richtlinie', type: 'policy', status: 'published', chapterIdx: 0, tags: ['Sicherheit'] },
  { id: 'qm-doc-032', num: 'AA-MD-001', title: 'MD-Mappe zusammenstellen', type: 'work_instruction', status: 'published', chapterIdx: 15, tags: ['MD'] },
];

export const QM_DOCUMENTS: QmDocument[] = DOC_DEFS.map((d, i) =>
  entity({
    id: d.id,
    documentNumber: d.num,
    title: d.title,
    documentType: d.type,
    status: d.status,
    currentVersionId: `${d.id}-v1`,
    chapterId: QM_CHAPTERS[d.chapterIdx]?.id ?? QM_CHAPTERS[0].id,
    ownerRole: 'QMB',
    reviewDueAt: ts(90 + i),
    tags: d.tags,
  }, -80 + i),
);

export const QM_DOCUMENT_VERSIONS: QmDocumentVersion[] = DOC_DEFS.map((d, i) =>
  entity({
    id: `${d.id}-v1`,
    documentId: d.id,
    versionNumber: '1.0',
    content: `# ${d.title}\n\n## Zweck\nVerbindliche Vorgabe für ${d.title}.\n\n## Ablauf\n1. Vorbereitung\n2. Durchführung\n3. Dokumentation\n4. Nachverfolgung\n\n## Verantwortlich\nQMB / PDL`,
    changeSummary: 'Erstveröffentlichung',
    status: d.status,
    approvedAt: d.status === 'published' || d.status === 'approved' ? ts(-30) : null,
    approvedBy: d.status === 'published' || d.status === 'approved' ? 'QMB Müller' : null,
    publishedAt: d.status === 'published' ? ts(-20) : null,
  }, -80 + i),
);

export const QM_LEGAL_REFERENCES: QmLegalReference[] = [
  entity({ id: 'qm-legal-001', title: 'SGB XI – Soziale Pflegeversicherung', source: 'Bundesgesetz', referenceCode: '§ 113 SGB XI', summary: 'Qualitätsanforderungen ambulante Pflege', effectiveFrom: '2023-01-01T00:00:00.000Z', documentIds: ['qm-doc-001', 'qm-doc-021'] }, -100),
  entity({ id: 'qm-legal-002', title: 'HeimG – Heimgesetz', source: 'Land NRW', referenceCode: '§ 15 HeimG NRW', summary: 'Qualitätssicherung', effectiveFrom: '2022-06-01T00:00:00.000Z', documentIds: ['qm-doc-006'] }, -99),
  entity({ id: 'qm-legal-003', title: 'IfSG – Infektionsschutzgesetz', source: 'Bundesgesetz', referenceCode: '§ 23 IfSG', summary: 'Hygieneanforderungen', effectiveFrom: '2020-01-01T00:00:00.000Z', documentIds: ['qm-doc-006', 'qm-doc-014'] }, -98),
  entity({ id: 'qm-legal-004', title: 'AMG – Arzneimittelgesetz', source: 'Bundesgesetz', referenceCode: '§ 48 AMG', summary: 'Medikamentengabe', effectiveFrom: '2021-01-01T00:00:00.000Z', documentIds: ['qm-doc-007', 'qm-doc-011'] }, -97),
  entity({ id: 'qm-legal-005', title: 'DSGVO', source: 'EU-Verordnung', referenceCode: 'Art. 5 DSGVO', summary: 'Datenschutzgrundsätze', effectiveFrom: '2018-05-25T00:00:00.000Z', documentIds: ['qm-doc-020'] }, -96),
  entity({ id: 'qm-legal-006', title: 'MDK-Richtlinie Prüfung', source: 'G-BA', referenceCode: 'MD-QPR-2024', summary: 'MD-Prüfungskriterien', effectiveFrom: '2024-01-01T00:00:00.000Z', documentIds: ['qm-doc-015', 'qm-doc-026'] }, -95),
  entity({ id: 'qm-legal-007', title: 'ArbSchG', source: 'Bundesgesetz', referenceCode: '§ 3 ArbSchG', summary: 'Arbeitsschutz', effectiveFrom: '2020-01-01T00:00:00.000Z', documentIds: [] }, -94),
  entity({ id: 'qm-legal-008', title: 'MuSchG', source: 'Bundesgesetz', referenceCode: '§ 4 MuSchG', summary: 'Mutterschutz', effectiveFrom: '2020-01-01T00:00:00.000Z', documentIds: [] }, -93),
  entity({ id: 'qm-legal-009', title: 'BetrSichV', source: 'Verordnung', referenceCode: 'BetrSichV', summary: 'Betriebssicherheit', effectiveFrom: '2021-01-01T00:00:00.000Z', documentIds: [] }, -92),
  entity({ id: 'qm-legal-010', title: 'Pflegeberufegesetz', source: 'Bundesgesetz', referenceCode: 'PflBG', summary: 'Qualifikationsanforderungen', effectiveFrom: '2020-01-01T00:00:00.000Z', documentIds: ['qm-doc-022'] }, -91),
  entity({ id: 'qm-legal-011', title: 'SGB V – Krankenversicherung', source: 'Bundesgesetz', referenceCode: '§ 39 SGB V', summary: 'Verordnungsmanagement', effectiveFrom: '2022-01-01T00:00:00.000Z', documentIds: ['qm-doc-007'] }, -90),
];

export const QM_COMPLIANCE: QmComplianceRequirement[] = [
  entity({ id: 'qm-comp-001', title: 'Jährliche Fortbildung QMB', legalReferenceId: 'qm-legal-001', status: 'fulfilled', dueAt: ts(30), responsibleRole: 'QMB', evidenceDocumentIds: ['qm-doc-028'], notes: 'Nachweis vorhanden' }, -60),
  entity({ id: 'qm-comp-002', title: 'Hygiene-Begehung quartalsweise', legalReferenceId: 'qm-legal-003', status: 'in_progress', dueAt: ts(14), responsibleRole: 'PDL', evidenceDocumentIds: ['qm-doc-014'], notes: 'Q2 ausstehend' }, -59),
  entity({ id: 'qm-comp-003', title: 'MD-Mappe aktualisieren', legalReferenceId: 'qm-legal-006', status: 'open', dueAt: ts(45), responsibleRole: 'QMB', evidenceDocumentIds: ['qm-doc-015'], notes: '' }, -58),
  entity({ id: 'qm-comp-004', title: 'Datenschutz-Folgenabschätzung', legalReferenceId: 'qm-legal-005', status: 'overdue', dueAt: ts(-10), responsibleRole: 'Admin', evidenceDocumentIds: ['qm-doc-020'], notes: 'Überfällig seit 10 Tagen' }, -57),
  entity({ id: 'qm-comp-005', title: 'Notfallübung dokumentieren', legalReferenceId: 'qm-legal-001', status: 'open', dueAt: ts(60), responsibleRole: 'PDL', evidenceDocumentIds: ['qm-doc-025'], notes: '' }, -56),
  entity({ id: 'qm-comp-006', title: 'Medikamenten-Audit', legalReferenceId: 'qm-legal-004', status: 'fulfilled', dueAt: ts(-30), responsibleRole: 'QMB', evidenceDocumentIds: ['qm-doc-007'], notes: '' }, -55),
  entity({ id: 'qm-comp-007', title: 'Beschwerdeauswertung Q1', legalReferenceId: 'qm-legal-001', status: 'fulfilled', dueAt: ts(-60), responsibleRole: 'QMB', evidenceDocumentIds: ['qm-doc-004'], notes: '' }, -54),
  entity({ id: 'qm-comp-008', title: 'Personalqualifikation prüfen', legalReferenceId: 'qm-legal-010', status: 'in_progress', dueAt: ts(21), responsibleRole: 'PDL', evidenceDocumentIds: ['qm-doc-022'], notes: '' }, -53),
  entity({ id: 'qm-comp-009', title: 'Risikoanalyse aktualisieren', legalReferenceId: 'qm-legal-001', status: 'open', dueAt: ts(90), responsibleRole: 'QMB', evidenceDocumentIds: ['qm-doc-005'], notes: '' }, -52),
  entity({ id: 'qm-comp-010', title: 'Internes Audit Q2', legalReferenceId: 'qm-legal-001', status: 'open', dueAt: ts(75), responsibleRole: 'QMB', evidenceDocumentIds: ['qm-doc-002'], notes: '' }, -51),
  entity({ id: 'qm-comp-011', title: 'Arbeitsschutz-Unterweisung', legalReferenceId: 'qm-legal-007', status: 'waived', dueAt: ts(0), responsibleRole: 'Admin', evidenceDocumentIds: [], notes: 'Extern beauftragt' }, -50),
];

export const QM_CHANGES: QmChange[] = [
  entity({ id: 'qm-chg-001', title: 'Hygiene-VA Revision 2.0', changeType: 'improvement', status: 'completed', documentId: 'qm-doc-006', description: 'Aktualisierung nach IfSG-Änderung', requestedBy: 'QMB Müller', completedAt: ts(-15) }, -40),
  entity({ id: 'qm-chg-002', title: 'Sturzprotokoll Erweiterung', changeType: 'audit_finding', status: 'in_progress', documentId: 'qm-doc-012', description: 'MD-Feststellung: Sturzrisiko erweitern', requestedBy: 'PDL Schmidt', completedAt: null }, -20),
  entity({ id: 'qm-chg-003', title: 'DSGVO-Richtlinie Update', changeType: 'legal_update', status: 'open', documentId: 'qm-doc-020', description: 'Anpassung Art. 30 Verzeichnis', requestedBy: 'Admin', completedAt: null }, -10),
  entity({ id: 'qm-chg-004', title: 'MD-Checkliste Korrektur', changeType: 'correction', status: 'completed', documentId: 'qm-doc-015', description: 'Tippfehler und fehlende Punkte', requestedBy: 'QMB Müller', completedAt: ts(-5) }, -30),
  entity({ id: 'qm-chg-005', title: 'SIS-Arbeitsanweisung neu', changeType: 'improvement', status: 'open', documentId: 'qm-doc-023', description: 'Neue SIS-Vorgaben umsetzen', requestedBy: 'PDL Schmidt', completedAt: null }, -5),
  entity({ id: 'qm-chg-006', title: 'Notfall-VA Überarbeitung', changeType: 'improvement', status: 'in_progress', documentId: 'qm-doc-008', description: 'Erweiterung Brandfall', requestedBy: 'QMB Müller', completedAt: null }, -8),
];

export const QM_AUDITS: QmAudit[] = [
  entity({ id: 'qm-aud-001', title: 'Internes Audit Q1 2026', auditType: 'internal', status: 'completed', scheduledAt: ts(-90), completedAt: ts(-85), auditorName: 'QMB Müller', findingsCount: 2, summary: '2 Feststellungen, Maßnahmen erstellt' }, -100),
  entity({ id: 'qm-aud-002', title: 'MD-Prüfung Vorbereitung', auditType: 'md_inspection', status: 'in_progress', scheduledAt: ts(30), completedAt: null, auditorName: 'MDK Nord', findingsCount: 0, summary: 'Vorbereitung läuft' }, -50),
  entity({ id: 'qm-aud-003', title: 'Hygiene-Audit', auditType: 'internal', status: 'planned', scheduledAt: ts(45), completedAt: null, auditorName: 'Hygienebeauftragte', findingsCount: 0, summary: 'Quartalsbegehung geplant' }, -30),
  entity({ id: 'qm-aud-004', title: 'Externe ISO-Begutachtung', auditType: 'external', status: 'planned', scheduledAt: ts(120), completedAt: null, auditorName: 'TÜV Rheinland', findingsCount: 0, summary: 'Optional' }, -20),
];

export const QM_MEASURES: QmMeasure[] = [
  entity({ id: 'qm-meas-001', title: 'Sturzprotokoll überarbeiten', status: 'in_progress', auditId: 'qm-aud-001', dueAt: ts(14), assignedTo: 'PDL Schmidt', description: 'Audit-Feststellung #1', completedAt: null }, -80),
  entity({ id: 'qm-meas-002', title: 'Fortbildungsplan aktualisieren', status: 'completed', auditId: 'qm-aud-001', dueAt: ts(-30), assignedTo: 'QMB Müller', description: 'Audit-Feststellung #2', completedAt: ts(-25) }, -79),
  entity({ id: 'qm-meas-003', title: 'MD-Mappe vervollständigen', status: 'open', auditId: 'qm-aud-002', dueAt: ts(21), assignedTo: 'QMB Müller', description: 'Fehlende Nachweise ergänzen', completedAt: null }, -78),
  entity({ id: 'qm-meas-004', title: 'Datenschutz-Folgenabschätzung', status: 'overdue', auditId: null, dueAt: ts(-10), assignedTo: 'Admin', description: 'Compliance überfällig', completedAt: null }, -77),
  entity({ id: 'qm-meas-005', title: 'Hygiene-Schulung durchführen', status: 'open', auditId: 'qm-aud-003', dueAt: ts(40), assignedTo: 'Hygienebeauftragte', description: 'Vor Quartalsaudit', completedAt: null }, -76),
  entity({ id: 'qm-meas-006', title: 'Beschwerdeprozess optimieren', status: 'in_progress', auditId: null, dueAt: ts(30), assignedTo: 'QMB Müller', description: 'Prozessverbesserung', completedAt: null }, -75),
];

export const QM_READ_CONFIRMATIONS: QmReadConfirmation[] = [
  entity({ id: 'qm-read-001', documentId: 'qm-doc-006', documentVersionId: 'qm-doc-006-v1', userId: 'emp-001', userDisplayName: 'Pflegekraft Anna', confirmedAt: ts(-5) }, -5),
  entity({ id: 'qm-read-002', documentId: 'qm-doc-007', documentVersionId: 'qm-doc-007-v1', userId: 'emp-002', userDisplayName: 'Pflegekraft Bernd', confirmedAt: ts(-3) }, -3),
];

export const MD_PACKAGES: MdAuditPackage[] = [
  entity({
    id: 'md-pkg-001',
    title: 'MD-Prüfungsmappe 2026',
    status: 'shared',
    inspectionYear: 2026,
    datenschutzConfirmed: true,
    approvedAt: ts(-7),
    approvedBy: 'PDL Schmidt',
    exportJobId: 'qm-export-001',
    shareTokenId: 'md-token-001',
    notes: 'Hauptmappe für MD-Prüfung',
  }, -14),
  entity({
    id: 'md-pkg-002',
    title: 'MD-Ergänzungsmappe Hygiene',
    status: 'pending_approval',
    inspectionYear: 2026,
    datenschutzConfirmed: true,
    approvedAt: null,
    approvedBy: null,
    exportJobId: null,
    shareTokenId: null,
    notes: 'Ergänzung nach internem Audit',
  }, -7),
];

export const MD_PACKAGE_ITEMS: MdAuditPackageItem[] = [
  entity({ id: 'md-item-001', packageId: 'md-pkg-001', documentId: 'qm-doc-001', sortOrder: 1, includedVersionId: 'qm-doc-001-v1', notes: '' }, -14),
  entity({ id: 'md-item-002', packageId: 'md-pkg-001', documentId: 'qm-doc-006', sortOrder: 2, includedVersionId: 'qm-doc-006-v1', notes: '' }, -14),
  entity({ id: 'md-item-003', packageId: 'md-pkg-001', documentId: 'qm-doc-015', sortOrder: 3, includedVersionId: 'qm-doc-015-v1', notes: '' }, -14),
  entity({ id: 'md-item-004', packageId: 'md-pkg-001', documentId: 'qm-doc-026', sortOrder: 4, includedVersionId: 'qm-doc-026-v1', notes: '' }, -14),
  entity({ id: 'md-item-005', packageId: 'md-pkg-001', documentId: 'qm-doc-021', sortOrder: 5, includedVersionId: 'qm-doc-021-v1', notes: '' }, -14),
  entity({ id: 'md-item-006', packageId: 'md-pkg-002', documentId: 'qm-doc-006', sortOrder: 1, includedVersionId: 'qm-doc-006-v1', notes: '' }, -7),
  entity({ id: 'md-item-007', packageId: 'md-pkg-002', documentId: 'qm-doc-014', sortOrder: 2, includedVersionId: 'qm-doc-014-v1', notes: '' }, -7),
];

export const MD_SHARE_TOKENS: MdShareToken[] = [
  entity({
    id: 'md-token-001',
    packageId: 'md-pkg-001',
    token: 'md-demo-token-2026-active',
    expiresAt: ts(90),
    revokedAt: null,
    accessCount: 3,
    shareUrl: '/public/md-share/md-demo-token-2026-active',
  }, -7),
  entity({
    id: 'md-token-expired',
    packageId: 'md-pkg-001',
    token: 'md-demo-token-expired',
    expiresAt: ts(-30),
    revokedAt: null,
    accessCount: 12,
    shareUrl: '/public/md-share/md-demo-token-expired',
  }, -100),
  entity({
    id: 'md-token-revoked',
    packageId: 'md-pkg-001',
    token: 'md-demo-token-revoked',
    expiresAt: ts(60),
    revokedAt: ts(-2),
    accessCount: 5,
    shareUrl: '/public/md-share/md-demo-token-revoked',
  }, -20),
];

export const MD_ACCESS_LOGS: MdAccessLogEntry[] = [
  entity({ id: 'md-log-001', tokenId: 'md-token-001', packageId: 'md-pkg-001', accessedAt: ts(-5), ipAddress: '192.168.1.10', userAgent: 'MDK-Prüfer/1.0', success: true, reason: null }, -5),
  entity({ id: 'md-log-002', tokenId: 'md-token-001', packageId: 'md-pkg-001', accessedAt: ts(-3), ipAddress: '192.168.1.11', userAgent: 'Chrome/120', success: true, reason: null }, -3),
  entity({ id: 'md-log-003', tokenId: 'md-token-expired', packageId: 'md-pkg-001', accessedAt: ts(-1), ipAddress: '10.0.0.5', userAgent: 'Safari/17', success: false, reason: 'Token abgelaufen' }, -1),
];

export const QM_EXPORT_JOBS: QmExportJob[] = [
  entity({
    id: 'qm-export-001',
    packageId: 'md-pkg-001',
    documentIds: ['qm-doc-001', 'qm-doc-006', 'qm-doc-015', 'qm-doc-026', 'qm-doc-021'],
    status: 'generated',
    format: 'pdf',
    preparedOnly: true,
    downloadUrl: null,
    errorMessage: null,
    completedAt: ts(-6),
  }, -7),
  entity({
    id: 'qm-export-002',
    packageId: null,
    documentIds: ['qm-doc-002'],
    status: 'in_preparation',
    format: 'pdf',
    preparedOnly: true,
    downloadUrl: null,
    errorMessage: null,
    completedAt: null,
  }, -2),
];

export const QM_AI_DRAFTS: QmAiDraft[] = [
  entity({
    id: 'qm-ai-001',
    action: 'gap_analysis',
    status: 'pending',
    targetDocumentId: null,
    targetChapterId: 'qm-ch-015',
    promptSummary: 'Lückenanalyse MD-Vorbereitung',
    suggestedContent: '## Lückenanalyse MD-Vorbereitung\n\n1. Fehlende Sturzprotokoll-Aktualisierung\n2. Datenschutz-Folgenabschätzung überfällig\n3. Hygiene-Schulung vor Audit empfohlen',
    disclaimer: 'KI-generierte Inhalte sind Vorschläge und müssen durch QMB/PDL geprüft werden.',
    reviewedAt: null,
  }, -1),
];

export const QM_TEMPLATES: QmTemplateSeed[] = [
  { id: 'qm-tpl-proc-001', title: 'Verfahrensanweisung (Standard)', documentType: 'procedure', content: '# Verfahrensanweisung\n\n## Zweck\n## Geltungsbereich\n## Verantwortlichkeit\n## Ablauf\n## Dokumentation', tags: ['Vorlage', 'VA'] },
  { id: 'qm-tpl-wi-001', title: 'Arbeitsanweisung (Standard)', documentType: 'work_instruction', content: '# Arbeitsanweisung\n\n## Schritte\n1.\n2.\n3.\n\n## Sicherheitshinweise', tags: ['Vorlage', 'AA'] },
  { id: 'qm-tpl-cl-001', title: 'Audit-Checkliste', documentType: 'checklist', content: '☐ Vorbereitung\n☐ Durchführung\n☐ Dokumentation\n☐ Nachverfolgung', tags: ['Vorlage', 'Checkliste'] },
  { id: 'qm-tpl-prot-001', title: 'Besprechungsprotokoll', documentType: 'protocol', content: '# Protokoll\n\nDatum:\nTeilnehmer:\n\n## Tagesordnung\n## Beschlüsse\n## Maßnahmen', tags: ['Vorlage', 'Protokoll'] },
  { id: 'qm-tpl-meas-001', title: 'Maßnahmenplan', documentType: 'procedure', content: '# Maßnahmenplan\n\n## Feststellung\n## Ursache\n## Maßnahme\n## Frist\n## Verantwortlich', tags: ['Vorlage', 'Maßnahme'] },
  { id: 'qm-tpl-pol-001', title: 'Richtlinie (Standard)', documentType: 'policy', content: '# Richtlinie\n\n## Geltungsbereich\n## Regelung\n## Ausnahmen', tags: ['Vorlage', 'Richtlinie'] },
];

export function createInitialQmDemoStore() {
  return {
    handbook: { ...QM_HANDBOOK },
    chapters: QM_CHAPTERS.map((c) => ({ ...c })),
    documents: QM_DOCUMENTS.map((d) => ({ ...d })),
    documentVersions: QM_DOCUMENT_VERSIONS.map((v) => ({ ...v })),
    legalReferences: QM_LEGAL_REFERENCES.map((l) => ({ ...l })),
    compliance: QM_COMPLIANCE.map((c) => ({ ...c })),
    changes: QM_CHANGES.map((c) => ({ ...c })),
    audits: QM_AUDITS.map((a) => ({ ...a })),
    measures: QM_MEASURES.map((m) => ({ ...m })),
    readConfirmations: QM_READ_CONFIRMATIONS.map((r) => ({ ...r })),
    mdPackages: MD_PACKAGES.map((p) => ({ ...p })),
    mdPackageItems: MD_PACKAGE_ITEMS.map((i) => ({ ...i })),
    mdShareTokens: MD_SHARE_TOKENS.map((t) => ({ ...t })),
    mdAccessLogs: MD_ACCESS_LOGS.map((l) => ({ ...l })),
    exportJobs: QM_EXPORT_JOBS.map((j) => ({ ...j })),
    aiDrafts: QM_AI_DRAFTS.map((d) => ({ ...d })),
    templates: QM_TEMPLATES.map((t) => ({ ...t })),
  };
}

export type QmDemoStore = ReturnType<typeof createInitialQmDemoStore>;
