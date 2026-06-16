import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { resetLiveMonitorStore } from '@/lib/assist/liveMonitorStore';
import { createManagementTask } from '@/lib/assist/managementTaskService';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import {
  createPersonalComplianceTaskFromRisk,
  fetchPersonalComplianceSnapshot,
  listPersonalComplianceAuditEvents,
  resetPersonalComplianceCockpitState,
} from '@/lib/office/personalComplianceCockpitService';
import { buildPersonalComplianceSnapshot } from '@/lib/office/personalComplianceCockpitBuilder';
import { seedPersonalComplianceDemoStore } from '@/lib/office/personalComplianceStore';
import { seedTrainingDemoStore } from '@/lib/training/trainingStore';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = 'tenant-pc-isolation';

describe('Personal-Compliance-Cockpit (Prompt 79)', () => {
  beforeEach(() => {
    resetPersonalComplianceCockpitState();
    resetLiveMonitorStore();
    seedTrainingDemoStore();
    seedPersonalComplianceDemoStore();
  });

  it('1. liefert 14 KPIs für business_admin aus echten Mandantendaten', () => {
    const result = fetchPersonalComplianceSnapshot(TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kpis).toHaveLength(14);
    expect(result.data.kpis.every((k) => k.value >= 0)).toBe(true);
    expect(result.data.kpis.every((k) => k.dataSource)).toBeTruthy();
    expect(result.data.employees.length).toBeGreaterThan(0);
  });

  it('2. blockiert Klient:innenportal', () => {
    const result = fetchPersonalComplianceSnapshot(TENANT, 'client_portal');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Klient/i);
  });

  it('3. blockiert Mitarbeitendenportal', () => {
    const result = fetchPersonalComplianceSnapshot(TENANT, 'employee_portal');
    expect(result.ok).toBe(false);
  });

  it('4. isoliert Mandanten — leerer Snapshot ohne Demo-Mitarbeitende', () => {
    const snapshot = buildPersonalComplianceSnapshot({ tenantId: OTHER_TENANT });
    expect(snapshot.employees).toHaveLength(0);
    expect(snapshot.kpis.find((k) => k.key === 'active_employees')?.value).toBe(0);
  });

  it('5. jede Warnung hat eine Datenquelle', () => {
    const result = fetchPersonalComplianceSnapshot(TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const risk of result.data.risks) {
      expect(risk.dataSource).toBeTruthy();
      expect(risk.id).toBeTruthy();
      expect(risk.employeeId).toBeTruthy();
    }
  });

  it('6. Einsatzfähigkeit wird über Assignment-Eligibility geprüft', () => {
    const result = fetchPersonalComplianceSnapshot(TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const employee003 = result.data.employees.find((e) => e.employeeId === 'employee-003');
    expect(employee003).toBeDefined();
    expect(employee003?.deployable).toBe(false);

    const deployableKpi = result.data.kpis.find((k) => k.key === 'deployable');
    const notDeployableKpi = result.data.kpis.find((k) => k.key === 'not_deployable');
    const activeKpi = result.data.kpis.find((k) => k.key === 'active_employees');
    expect(deployableKpi!.value + notDeployableKpi!.value).toBeLessThanOrEqual(activeKpi!.value);
  });

  it('7. sensible HR-Risiken für dispatch ohne Detailtext', () => {
    const admin = fetchPersonalComplianceSnapshot(TENANT, 'business_admin');
    const dispatch = fetchPersonalComplianceSnapshot(TENANT, 'dispatch');
    expect(admin.ok && dispatch.ok).toBe(true);
    if (!admin.ok || !dispatch.ok) return;

    const adminBg = admin.data.risks.filter((r) => r.code.startsWith('background_check'));
    const dispatchBg = dispatch.data.risks.filter((r) => r.code.startsWith('background_check'));
    expect(adminBg.length).toBeGreaterThan(0);
    expect(dispatchBg.length).toBe(adminBg.length);
    expect(dispatchBg.some((r) => r.message.includes('autorisierte Rollen'))).toBe(true);
  });

  it('8. KPI-Filter qualification_missing schränkt Risiken ein', () => {
    const result = fetchPersonalComplianceSnapshot(TENANT, 'business_admin', {
      kpiKey: 'qualification_missing',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.risks.every((r) => r.code === 'qualification_missing')).toBe(true);
  });

  it('9. erstellt Verwaltungsaufgabe aus Risiko', () => {
    const snapshot = fetchPersonalComplianceSnapshot(TENANT, 'business_admin');
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;

    const risk = snapshot.data.risks.find((r) => r.code === 'document_missing');
    expect(risk).toBeDefined();

    const created = createPersonalComplianceTaskFromRisk({
      tenantId: TENANT,
      riskId: risk!.id,
      actorRoleKey: 'business_admin',
      actorId: 'demo-user',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.taskId).toMatch(/^mgmt-task-/);

    const audit = listPersonalComplianceAuditEvents(TENANT);
    expect(audit.some((e) => e.action === 'management_task.created')).toBe(true);
  });

  it('10. Live-Modus blockiert Demo-Fallback', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    const block = guardLiveDemoFeature(TENANT, 'Personal-Compliance-Cockpit');
    expect(block?.ok).toBe(false);

    vi.unstubAllEnvs();
  });
});

describe('Personal-Compliance-Cockpit — Offboarding & Abwesenheit', () => {
  beforeEach(() => {
    resetPersonalComplianceCockpitState();
    seedTrainingDemoStore();
    seedPersonalComplianceDemoStore();
  });

  it('zählt offene Offboardings und kranke Abwesenheiten aus Demo-Quellen', () => {
    const result = fetchPersonalComplianceSnapshot(TENANT, 'business_manager');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const offboardingKpi = result.data.kpis.find((k) => k.key === 'offboarding_open');
    const sickKpi = result.data.kpis.find((k) => k.key === 'sick_absent');
    expect(offboardingKpi!.value).toBeGreaterThanOrEqual(1);
    expect(sickKpi!.value).toBeGreaterThanOrEqual(1);

    createManagementTask({
      tenantId: TENANT,
      taskType: 'master_data_review',
      employeeId: 'employee-001',
      title: 'Stammdaten prüfen',
      description: 'Test',
    });

    const refreshed = fetchPersonalComplianceSnapshot(TENANT, 'business_manager');
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    const tasksKpi = refreshed.data.kpis.find((k) => k.key === 'open_personnel_tasks');
    expect(tasksKpi!.value).toBeGreaterThanOrEqual(1);
  });
});
