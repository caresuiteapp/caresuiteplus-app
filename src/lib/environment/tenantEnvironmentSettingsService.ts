import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { PILOT_TENANT_IDS } from '@/lib/pilot/pilotConfig';
import type { DemoDataSet, TenantEnvironmentSettings } from '@/types/environment';
import { logEnvironmentAuditEvent } from './environmentAuditService';

const SETTINGS = new Map<string, TenantEnvironmentSettings>();
const DEMO_DATA_SETS = new Map<string, DemoDataSet>();

function seedDefaults(): void {
  if (SETTINGS.size > 0) return;

  SETTINGS.set(DEMO_TENANT_ID, {
    id: 'tes-demo-001',
    tenantId: DEMO_TENANT_ID,
    mode: 'demo',
    demoDataSetKey: 'caresuite_demo_v1',
    isPilotTenant: false,
    pilotPhase: null,
    showKnownRisks: false,
    feedbackModulePrepared: false,
    providerSandboxOnly: true,
    notes: 'Standard-Demo-Mandant — ausschließlich synthetische Daten.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  for (const [index, tenantId] of PILOT_TENANT_IDS.entries()) {
    SETTINGS.set(tenantId, {
      id: `tes-pilot-${index + 1}`,
      tenantId,
      mode: 'pilot',
      demoDataSetKey: null,
      isPilotTenant: true,
      pilotPhase: index === 0 ? 'aktiv' : index === 1 ? 'onboarding' : 'vorbereitung',
      showKnownRisks: true,
      feedbackModulePrepared: true,
      providerSandboxOnly: false,
      notes: 'Pilot-Mandant — begrenzter Rollout mit sichtbaren Risiken.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  }

  DEMO_DATA_SETS.set('caresuite_demo_v1', {
    id: 'dds-001',
    dataSetKey: 'caresuite_demo_v1',
    label: 'CareSuite+ Standard-Demo',
    tenantId: DEMO_TENANT_ID,
    isSynthetic: true,
    containsRealData: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
}

seedDefaults();

export function getTenantEnvironmentSettings(tenantId: string): TenantEnvironmentSettings | null {
  seedDefaults();
  return SETTINGS.get(tenantId) ?? null;
}

export function upsertTenantEnvironmentSettings(
  input: Omit<TenantEnvironmentSettings, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): TenantEnvironmentSettings {
  seedDefaults();
  const existing = SETTINGS.get(input.tenantId);
  const row: TenantEnvironmentSettings = {
    id: input.id ?? existing?.id ?? `tes-${input.tenantId}`,
    tenantId: input.tenantId,
    mode: input.mode,
    demoDataSetKey: input.demoDataSetKey,
    isPilotTenant: input.isPilotTenant,
    pilotPhase: input.pilotPhase,
    showKnownRisks: input.showKnownRisks,
    feedbackModulePrepared: input.feedbackModulePrepared,
    providerSandboxOnly: input.providerSandboxOnly,
    notes: input.notes,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  SETTINGS.set(input.tenantId, row);
  logEnvironmentAuditEvent({
    tenantId: input.tenantId,
    eventType: 'tenant_settings_updated',
    mode: row.mode,
    summary: `Mandant-Umgebung auf „${row.mode}“ gesetzt.`,
    metadata: {
      isPilotTenant: String(row.isPilotTenant),
      demoDataSetKey: row.demoDataSetKey ?? '',
    },
  });
  return row;
}

export function getDemoDataSet(dataSetKey: string): DemoDataSet | null {
  seedDefaults();
  return DEMO_DATA_SETS.get(dataSetKey) ?? null;
}

export function isDemoDataTenant(tenantId: string): boolean {
  const settings = getTenantEnvironmentSettings(tenantId);
  if (settings?.demoDataSetKey) return true;
  return tenantId === DEMO_TENANT_ID;
}

export function resetTenantEnvironmentSettingsStore(): void {
  SETTINGS.clear();
  DEMO_DATA_SETS.clear();
  seedDefaults();
}
