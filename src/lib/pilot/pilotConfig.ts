/** Live-Pilot Konfiguration — Meilenstein rm-001 (3 ambulante Mandanten) */

export type PilotRolloutPhase = 'vorbereitung' | 'onboarding' | 'aktiv' | 'review' | 'abschluss';

export type PilotFeatureFlag =
  | 'pilot_tenant'
  | 'datev_export'
  | 'reporting_cockpit'
  | 'release_gates'
  | 'qa_checklist';

export type PilotTenantConfig = {
  tenantId: string;
  phase: PilotRolloutPhase;
  features: PilotFeatureFlag[];
  goLiveDate: string;
};

export const PILOT_MILESTONE_ID = 'rm-001';

export const PILOT_FEATURE_FLAGS: Record<PilotFeatureFlag, { label: string; defaultEnabled: boolean }> = {
  pilot_tenant: { label: 'Pilot-Mandant', defaultEnabled: true },
  datev_export: { label: 'DATEV-Export', defaultEnabled: true },
  reporting_cockpit: { label: 'PDL-Cockpit', defaultEnabled: true },
  release_gates: { label: 'Release-Gates', defaultEnabled: true },
  qa_checklist: { label: 'QA-Checkliste', defaultEnabled: true },
};

export const PILOT_ROLLOUT_PHASES: { key: PilotRolloutPhase; label: string; order: number }[] = [
  { key: 'vorbereitung', label: 'Vorbereitung', order: 1 },
  { key: 'onboarding', label: 'Onboarding', order: 2 },
  { key: 'aktiv', label: 'Aktiver Pilot', order: 3 },
  { key: 'review', label: 'Review', order: 4 },
  { key: 'abschluss', label: 'Abschluss', order: 5 },
];

/** 3 ambulante Pilot-Mandanten (IDs verweisen auf pilotTenants.ts) */
export const PILOT_TENANT_IDS = [
  'tenant-pilot-ambulant-001',
  'tenant-pilot-ambulant-002',
  'tenant-pilot-ambulant-003',
] as const;

export type PilotTenantId = (typeof PILOT_TENANT_IDS)[number];

export const PILOT_TENANT_CONFIGS: PilotTenantConfig[] = [
  {
    tenantId: 'tenant-pilot-ambulant-001',
    phase: 'aktiv',
    features: ['pilot_tenant', 'datev_export', 'reporting_cockpit', 'release_gates', 'qa_checklist'],
    goLiveDate: '2026-06-01T00:00:00.000Z',
  },
  {
    tenantId: 'tenant-pilot-ambulant-002',
    phase: 'onboarding',
    features: ['pilot_tenant', 'datev_export', 'reporting_cockpit', 'release_gates'],
    goLiveDate: '2026-06-15T00:00:00.000Z',
  },
  {
    tenantId: 'tenant-pilot-ambulant-003',
    phase: 'vorbereitung',
    features: ['pilot_tenant', 'reporting_cockpit'],
    goLiveDate: '2026-07-01T00:00:00.000Z',
  },
];

export function isPilotTenant(tenantId: string): tenantId is PilotTenantId {
  return (PILOT_TENANT_IDS as readonly string[]).includes(tenantId);
}

export function getPilotTenantConfig(tenantId: string): PilotTenantConfig | null {
  return PILOT_TENANT_CONFIGS.find((c) => c.tenantId === tenantId) ?? null;
}

export function isPilotFeatureEnabled(tenantId: string, feature: PilotFeatureFlag): boolean {
  const config = getPilotTenantConfig(tenantId);
  return config?.features.includes(feature) ?? false;
}
