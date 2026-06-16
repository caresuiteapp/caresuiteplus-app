/** Globale und mandantenspezifische Betriebsmodi — strikte Trennung Demo/Pilot/Sandbox/Production. */
export type EnvironmentMode = 'demo' | 'sandbox' | 'pilot' | 'internal_test' | 'production';

export type EnvironmentModeRecord = {
  id: string;
  modeKey: EnvironmentMode;
  label: string;
  description: string;
  allowsRealData: boolean;
  allowsMockProviders: boolean;
  allowsDemoFallback: boolean;
  requiresBanner: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TenantEnvironmentSettings = {
  id: string;
  tenantId: string;
  mode: EnvironmentMode;
  demoDataSetKey: string | null;
  isPilotTenant: boolean;
  pilotPhase: string | null;
  showKnownRisks: boolean;
  feedbackModulePrepared: boolean;
  providerSandboxOnly: boolean;
  notes: string | null;
  updatedAt: string;
  createdAt: string;
};

export type DemoDataSet = {
  id: string;
  dataSetKey: string;
  label: string;
  tenantId: string;
  isSynthetic: boolean;
  containsRealData: boolean;
  createdAt: string;
};

export type PilotReadinessCheck = {
  id: string;
  tenantId: string;
  checkKey: string;
  status: 'pending' | 'passed' | 'warning' | 'failed';
  message: string;
  evaluatedAt: string;
};

export type EnvironmentAuditEventType =
  | 'mode_resolved'
  | 'demo_data_blocked'
  | 'mock_provider_blocked'
  | 'demo_fallback_blocked'
  | 'provider_sandbox_labeled'
  | 'tenant_settings_updated'
  | 'pilot_marked';

export type EnvironmentAuditEvent = {
  id: string;
  tenantId: string | null;
  eventType: EnvironmentAuditEventType;
  mode: EnvironmentMode;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

export type EnvironmentGuardResult =
  | { ok: true }
  | { ok: false; error: string; code?: EnvironmentGuardCode };

export type EnvironmentGuardCode =
  | 'demo_data_in_production'
  | 'mock_provider_in_production'
  | 'demo_fallback_in_production'
  | 'invalid_tenant_for_mode'
  | 'sandbox_as_production';

export type ProviderEnvironment = 'demo' | 'sandbox' | 'production';

export type ProviderEnvironmentDisplay = {
  environment: ProviderEnvironment;
  label: string;
  isProductionClaim: boolean;
};
