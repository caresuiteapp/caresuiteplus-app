import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { PERSONAL_COMPLIANCE_KPI_LABELS } from '@/types/modules/personalComplianceCockpit';
import { createManagementTask } from '@/lib/assist/managementTaskService';
import { resetLiveMonitorStore } from '@/lib/assist/liveMonitorStore';
import { resetQmCockpitStore, QM_COCKPIT_STORE, nextQmCorrectionId } from '@/lib/assist/qmCockpitStore';
import { resetComplianceTrainingStore } from '@/lib/office/complianceTrainingStore';
import {
  assignComplianceTraining,
  seedDefaultComplianceItemsForTenant,
} from '@/lib/office/complianceTrainingService';
import {
  buildPersonalComplianceSnapshot,
  filterPersonalComplianceSnapshot,
} from '@/lib/office/personalComplianceCockpitBuilder';
import {
  createPersonalComplianceTask,
  fetchPersonalComplianceCockpit,
} from '@/lib/office/personalComplianceCockpitService';
import {
  filterPersonalComplianceRisksForViewer,
  canViewPersonalComplianceCockpit,
  buildPersonalComplianceAccessContext,
} from '@/lib/office/personalComplianceAccess';
import {
  listPersonalComplianceAuditEvents,
  resetPersonalComplianceAuditStore,
} from '@/lib/office/personalcomplianceauditservice';
import { resetPersonalComplianceStore, seedPersonalComplianceDemoStore } from '@/lib/office/personalComplianceStore';
import { resetAbsenceStore } from '@/lib/office/absenceStore';
import { evaluateEmployeeAssignmentEligibility } from '@/lib/office/employeeAssignmentEligibility';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';
import { __resetTrainingServiceForTests, __seedTrainingServiceForTests } from '@/lib/training/trainingService';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';

describe('Personal-Compliance-Cockpit (Prompt 79)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetPersonalComplianceStore();
    resetPersonalComplianceAuditStore();
    resetComplianceTrainingStore();
    resetLiveMonitorStore();
    resetQmCockpitStore();
    resetAbsenceStore();
    __resetTrainingServiceForTests();
    seedPersonalComplianceDemoStore();
    __seedTrainingServiceForTests();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetPersonalComplianceStore();
    resetPersonalComplianceAuditStore();
    resetComplianceTrainingStore();
    resetLiveMonitorStore();
    resetQmCockpitStore();
    resetAbsenceStore();
    __resetTrainingServiceForTests();
  });

  it('1. liefert alle 14 KPIs mit Datenquellen', async () => {
    await seedDefaultComplianceItemsForTenant(TENANT, 'business_admin');
    const result = await fetchPersonalComplianceCockpit(TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.kpis).toHaveLength(14);
    for (const kpi of result.data.kpis) {
      expect(kpi.dataSource).toBeTruthy();
      expect(PERSONAL_COMPLIANCE_KPI_LABELS[kpi.key]).toBe(kpi.label);
      expect(typeof kpi.value).toBe('number');
      expect(kpi.value).toBeGreaterThanOrEqual(0);
    }
    expect(result.data.risks.every((r) => r.dataSource)).toBe(true);
  });

  it('2. blockiert Klient:innenportale', async () => {
    const access = canViewPersonalComplianceCockpit(
      buildPersonalComplianceAccessContext({ tenantId: TENANT, roleKey: 'client_portal' }),
    );
    expect(access.allowed).toBe(false);

    const result = await fetchPersonalComplianceCockpit(TENANT, 'client_portal');
    expect(result.ok).toBe(false);
  });

  it('3. erzwingt Mandantentrennung', async () => {
    const snapshot = buildPersonalComplianceSnapshot({ tenantId: OTHER_TENANT, ensureDemoSeed: true });
    expect(snapshot.employees).toHaveLength(0);
    expect(snapshot.kpis.find((k) => k.key === 'active_employees')?.value).toBe(0);
  });

  it('4. prüft Einsatzfähigkeit nur mit vollständigem Eligibility-Check', () => {
    const file = getDemoEmployeePersonnelFile('employee-003');
    expect(file).toBeTruthy();
    if (!file) return;

    const eligibility = evaluateEmployeeAssignmentEligibility({
      tenantId: TENANT,
      employeeId: 'employee-003',
      personnelFile: file,
      roleKey: file.portalAccess.roleKey,
    });

    expect(eligibility.deployable).toBe(false);
    expect(eligibility.blockers.length).toBeGreaterThan(0);

    const snapshot = buildPersonalComplianceSnapshot({ tenantId: TENANT });
    const row = snapshot.employees.find((e) => e.employeeId === 'employee-003');
    expect(row?.deployable).toBe(false);
  });

  it('5. liefert im Live-Modus keine Demo-Fallback-Zahlen', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    const result = await fetchPersonalComplianceCockpit(TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.preparedOnly).toBe(true);
    expect(result.data.kpis).toHaveLength(0);
  });

  it('6. filtert sensible HR-Risiken für nicht autorisierte Rollen', () => {
    const snapshot = buildPersonalComplianceSnapshot({ tenantId: TENANT });
    const sensitive = snapshot.risks.filter((r) => r.sensitive);
    expect(sensitive.length).toBeGreaterThan(0);

    const ctx = buildPersonalComplianceAccessContext({ tenantId: TENANT, roleKey: 'dispatch' });
    const filtered = filterPersonalComplianceRisksForViewer(ctx, sensitive);
    expect(filtered.every((r) => r.message.includes('Sensible HR-Information'))).toBe(true);
  });

  it('7. unterstützt Drilldown-Filter nach KPI und Status', () => {
    const snapshot = buildPersonalComplianceSnapshot({ tenantId: TENANT });
    const filtered = filterPersonalComplianceSnapshot(snapshot, { kpiKey: 'not_deployable' });
    expect(filtered.employees.every((e) => !e.deployable)).toBe(true);

    const byRole = filterPersonalComplianceSnapshot(snapshot, { roleTitle: 'Pflegefachkraft' });
    expect(byRole.employees.every((e) => e.roleTitle?.includes('Pflegefachkraft'))).toBe(true);
  });

  it('8. erstellt Personalaufgabe mit Audit-Eintrag', async () => {
    const created = await createPersonalComplianceTask({
      tenantId: TENANT,
      employeeId: 'employee-001',
      title: 'Qualifikation nachweisen',
      description: 'Erste-Hilfe-Nachweis hochladen',
      actorRole: 'business_admin',
      actorId: 'admin-1',
    });
    expect(created.ok).toBe(true);

    const audits = listPersonalComplianceAuditEvents(TENANT, 'employee-001');
    expect(audits.some((a) => a.action === 'personnel_task_created')).toBe(true);
  });

  it('9. integriert compliance_training für fehlende Unterweisungen', async () => {
    await seedDefaultComplianceItemsForTenant(TENANT, 'business_admin');
    const items = await import('@/lib/office/complianceTrainingStore').then((m) =>
      m.listComplianceItemsForTenant(TENANT),
    );
    const item = items[0];
    expect(item).toBeDefined();
    await assignComplianceTraining(
      {
        tenantId: TENANT,
        employeeId: 'employee-001',
        trainingItemId: item!.id,
        mandatory: true,
      },
      'business_admin',
    );

    const snapshot = buildPersonalComplianceSnapshot({ tenantId: TENANT });
    const briefingKpi = snapshot.kpis.find((k) => k.key === 'briefing_missing');
    expect(briefingKpi?.value).toBeGreaterThan(0);
    expect(
      snapshot.risks.some(
        (r) => r.code === 'briefing_missing' && r.dataSource === 'compliance_training',
      ),
    ).toBe(true);
  });

  it('10. zählt Korrekturen, Offboarding und Abwesenheiten aus Quellen', async () => {
    QM_COCKPIT_STORE.qmCorrectionRequests.push({
      id: nextQmCorrectionId(),
      tenantId: TENANT,
      assignmentId: 'asg-pc-1',
      serviceRecordId: null,
      requestedBy: 'admin',
      assignedToEmployeeId: 'employee-002',
      affectedArea: 'documentation',
      reason: 'Doku unvollständig',
      requiredResponse: 'Ergänzen',
      dueAt: new Date().toISOString(),
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null,
      documentVersion: 1,
      correctedFromDocumentId: null,
    });

    createManagementTask({
      tenantId: TENANT,
      taskType: 'master_data_review',
      employeeId: 'employee-004',
      description: 'Stammdaten prüfen',
      priority: 'normal',
    });

    const snapshot = buildPersonalComplianceSnapshot({ tenantId: TENANT });

    expect(snapshot.kpis.find((k) => k.key === 'offboarding_open')?.value).toBeGreaterThan(0);
    expect(snapshot.kpis.find((k) => k.key === 'sick_absent')?.value).toBeGreaterThan(0);
    expect(snapshot.kpis.find((k) => k.key === 'open_corrections')?.value).toBeGreaterThan(0);
    expect(snapshot.kpis.find((k) => k.key === 'open_personnel_tasks')?.value).toBeGreaterThan(0);
  });
});
