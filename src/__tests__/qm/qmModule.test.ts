import { describe, expect, it, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { resetQmDemoStore } from '@/lib/qm';
import { buildQmDashboardKpis } from '@/lib/qm/qmDashboardStats';
import {
  fetchQmDashboard,
  fetchQmChapters,
  fetchQmDocuments,
  approveQmDocument,
  createQmChange,
  createQmAudit,
  createQmMeasure,
  createMdAuditPackage,
  selectMdPackageDocuments,
  confirmMdPackageDatenschutz,
  approveMdAuditPackage,
  generateMdShareToken,
  revokeMdShareToken,
  validateMdShareToken,
  createQmAiDraft,
  acceptQmAiDraft,
  rejectQmAiDraft,
  createQmExportJob,
  fetchQmCompliance,
  fetchQmLegalReferences,
} from '@/lib/qm';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('QM Module Permissions', () => {
  it('blockiert ohne qm.view', () => {
    expect(enforcePermission(null, 'qm.view')).not.toBeNull();
  });

  it('erlaubt business_admin qm.view', () => {
    expect(enforcePermission('business_admin', 'qm.view')).toBeNull();
  });

  it('blockiert caregiver qm.approve_document', () => {
    expect(enforcePermission('caregiver', 'qm.approve_document')).not.toBeNull();
  });

  it('erlaubt nurse qm.create_measure', () => {
    expect(enforcePermission('nurse', 'qm.create_measure')).toBeNull();
  });
});

describe('QM Dashboard', () => {
  beforeEach(() => resetQmDemoStore());

  it('liefert KPIs mit Kapiteln und Dokumenten', async () => {
    const result = await fetchQmDashboard(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.chapterCount).toBeGreaterThanOrEqual(20);
    expect(result.data.documentCount).toBeGreaterThanOrEqual(30);
    expect(result.data.mdPackageCount).toBeGreaterThanOrEqual(2);
  });

  it('buildQmDashboardKpis mappt Snapshot ehrlich', async () => {
    const result = await fetchQmDashboard(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kpis = buildQmDashboardKpis(result.data);
    expect(kpis).toHaveLength(5);
    expect(kpis.some((k) => k.id === 'chapters')).toBe(true);
    expect(kpis.some((k) => k.id === 'approvals')).toBe(true);
  });

  it('QmDashboardScreen nutzt CareLightModuleDashboard', () => {
    const screen = readSrc('src/screens/qm/QmDashboardScreen.tsx');
    expect(screen).toContain('CareLightScreen');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).toContain("moduleKey=\"qm\"");
    expect(screen).not.toContain('PreparedModeBanner');
    expect(screen).not.toContain('AdaptiveModuleDashboard');
  });
});

describe('QM Handbook', () => {
  beforeEach(() => resetQmDemoStore());

  it('listet 20+ Kapitel', async () => {
    const result = await fetchQmChapters(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThanOrEqual(20);
  });
});

describe('QM Documents', () => {
  beforeEach(() => resetQmDemoStore());

  it('listet 30+ Dokumente', async () => {
    const result = await fetchQmDocuments(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThanOrEqual(30);
  });

  it('freigabe eines Dokuments', async () => {
    const result = await approveQmDocument(DEMO_TENANT_ID, 'qm-doc-012', 'QMB Test', 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('approved');
  });
});

describe('QM Compliance & Legal', () => {
  beforeEach(() => resetQmDemoStore());

  it('listet 10+ Rechtsgrundlagen', async () => {
    const result = await fetchQmLegalReferences(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThanOrEqual(10);
  });

  it('listet 10+ Compliance-Anforderungen', async () => {
    const result = await fetchQmCompliance(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThanOrEqual(10);
  });
});

describe('QM Changes, Audits, Measures', () => {
  beforeEach(() => resetQmDemoStore());

  it('erstellt Änderung', async () => {
    const result = await createQmChange(
      DEMO_TENANT_ID,
      { title: 'Test-Änderung', changeType: 'improvement', documentId: 'qm-doc-001', description: 'Test', requestedBy: 'QMB' },
      'business_admin',
    );
    expect(result.ok).toBe(true);
  });

  it('erstellt Audit', async () => {
    const result = await createQmAudit(
      DEMO_TENANT_ID,
      { title: 'Test-Audit', auditType: 'internal', scheduledAt: new Date().toISOString(), auditorName: 'QMB', summary: '' },
      'business_admin',
    );
    expect(result.ok).toBe(true);
  });

  it('erstellt Maßnahme', async () => {
    const result = await createQmMeasure(
      DEMO_TENANT_ID,
      { title: 'Test-Maßnahme', auditId: null, dueAt: new Date().toISOString(), assignedTo: 'PDL', description: 'Test' },
      'nurse',
    );
    expect(result.ok).toBe(true);
  });
});

describe('MD Package Workflow', () => {
  beforeEach(() => resetQmDemoStore());

  it('voller Workflow: erstellen → docs → datenschutz → approve → share', async () => {
    const created = await createMdAuditPackage(
      DEMO_TENANT_ID,
      { title: 'Test-MD-Mappe', inspectionYear: 2026 },
      'business_admin',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const pkgId = created.data.id;

    const docs = await selectMdPackageDocuments(
      DEMO_TENANT_ID,
      pkgId,
      ['qm-doc-001', 'qm-doc-006'],
      'business_admin',
    );
    expect(docs.ok).toBe(true);

    const ds = await confirmMdPackageDatenschutz(DEMO_TENANT_ID, pkgId, 'business_admin');
    expect(ds.ok).toBe(true);

    const approved = await approveMdAuditPackage(DEMO_TENANT_ID, pkgId, 'PDL Test', 'business_admin');
    expect(approved.ok).toBe(true);
    if (approved.ok) expect(approved.data.exportJobId).not.toBeNull();

    const token = await generateMdShareToken(DEMO_TENANT_ID, pkgId, 30, 'business_admin');
    expect(token.ok).toBe(true);
    if (!token.ok) return;

    const view = await validateMdShareToken(token.data.token);
    expect(view.ok).toBe(true);

    const revoked = await revokeMdShareToken(DEMO_TENANT_ID, token.data.id, 'business_admin');
    expect(revoked.ok).toBe(true);

    const blocked = await validateMdShareToken(token.data.token);
    expect(blocked.ok).toBe(false);
  });

  it('blockiert abgelaufenen Token', async () => {
    const result = await validateMdShareToken('md-demo-token-expired');
    expect(result.ok).toBe(false);
  });

  it('blockiert ungültigen Token', async () => {
    const result = await validateMdShareToken('invalid-token-xyz');
    expect(result.ok).toBe(false);
  });
});

describe('QM Export Jobs', () => {
  beforeEach(() => resetQmDemoStore());

  it('erstellt Export-Job mit preparedOnly', async () => {
    const result = await createQmExportJob(
      DEMO_TENANT_ID,
      { packageId: null, documentIds: ['qm-doc-001'], format: 'pdf' },
      'business_admin',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.preparedOnly).toBe(true);
    expect(result.data.downloadUrl).toBeNull();
  });
});

describe('QM AI Assistant', () => {
  beforeEach(() => resetQmDemoStore());

  it('erstellt KI-Entwurf ohne echten LLM', async () => {
    const result = await createQmAiDraft(
      DEMO_TENANT_ID,
      { action: 'gap_analysis', promptSummary: 'Lückenanalyse Test' },
      'business_admin',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.disclaimer).toContain('KI-generierte Inhalte');
    expect(result.data.suggestedContent.length).toBeGreaterThan(0);
  });

  it('akzeptiert und verwirft Entwürfe', async () => {
    const created = await createQmAiDraft(
      DEMO_TENANT_ID,
      { action: 'checklist', promptSummary: 'Checkliste' },
      'business_admin',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const accepted = await acceptQmAiDraft(DEMO_TENANT_ID, created.data.id, 'business_admin');
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(accepted.data.status).toBe('accepted');

    const created2 = await createQmAiDraft(
      DEMO_TENANT_ID,
      { action: 'summarize', promptSummary: 'Zusammenfassung' },
      'business_admin',
    );
    if (!created2.ok) return;
    const rejected = await rejectQmAiDraft(DEMO_TENANT_ID, created2.data.id, 'business_admin');
    expect(rejected.ok).toBe(true);
    if (rejected.ok) expect(rejected.data.status).toBe('rejected');
  });
});

describe('QM Demo Persistence', () => {
  beforeEach(() => resetQmDemoStore());

  it('persistiert Änderungen im Demo-Store', async () => {
    await createQmChange(
      DEMO_TENANT_ID,
      { title: 'Persist-Test', changeType: 'correction', documentId: null, description: '', requestedBy: 'QMB' },
      'business_admin',
    );
    const dashboard = await fetchQmDashboard(DEMO_TENANT_ID, 'business_admin');
    expect(dashboard.ok).toBe(true);
    if (!dashboard.ok) return;
    expect(dashboard.data.recentChanges.some((c) => c.title === 'Persist-Test')).toBe(true);
  });
});
