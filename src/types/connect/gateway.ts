import type { PermissionKey, RoleKey } from '@/types';

/** Connector-Kategorien — zentrale Gateway-Taxonomie. */
export type ConnectCategoryKey =
  | 'billing'
  | 'accounting'
  | 'payments'
  | 'ti_kim'
  | 'communication'
  | 'maps'
  | 'documents'
  | 'medical_catalogs'
  | 'hr_payroll'
  | 'academy'
  | 'marketplace';

/** Betriebsstatus eines Connectors (getrennt von UI-Catalog-readiness). */
export type ConnectConnectorStatus =
  | 'not_available'
  | 'coming_soon'
  | 'internal'
  | 'beta'
  | 'sandbox_ready'
  | 'production_ready'
  | 'disabled'
  | 'error';

export type ConnectEnvironment = 'demo' | 'sandbox' | 'production';

export type ConnectIntegrationStatus =
  | 'not_configured'
  | 'requested'
  | 'configured'
  | 'sandbox'
  | 'production'
  | 'degraded'
  | 'disabled'
  | 'error';

export type ConnectGuardCode =
  | 'missing_tenant'
  | 'missing_user'
  | 'missing_role'
  | 'missing_integration'
  | 'integration_disabled'
  | 'provider_coming_soon'
  | 'production_in_demo_mode'
  | 'production_mock_adapter'
  | 'health_data_denied'
  | 'missing_credential'
  | 'action_not_allowed'
  | 'connector_disabled'
  | 'connector_not_available';

export type ConnectGuardResult =
  | { allowed: true }
  | { allowed: false; code: ConnectGuardCode; message: string };

export type ConnectCapability = {
  key: string;
  title: string;
  description: string;
  dataDirection: 'in' | 'out' | 'bidirectional';
  sensitiveDataLevel: 'none' | 'personal' | 'health' | 'financial' | 'special_category';
  status: ConnectConnectorStatus;
};

export type ConnectAdapterResult<T = unknown> = {
  ok: boolean;
  blocked?: boolean;
  demo?: boolean;
  message: string;
  data?: T;
  auditAction: string;
};

export type ConnectExecutionContext = {
  tenantId: string;
  userId: string;
  role: RoleKey;
  environment: ConnectEnvironment;
  integrationId: string | null;
  providerKey: string;
  category: ConnectCategoryKey;
  requestId: string;
  permissions: PermissionKey[];
  demoMode: boolean;
  integrationStatus: ConnectIntegrationStatus;
  connectorStatus: ConnectConnectorStatus;
  hasCredentialReference: boolean;
  allowedActions: readonly string[];
  isMockAdapter: boolean;
};

export type ConnectProviderAdapter = {
  providerKey: string;
  category: ConnectCategoryKey;
  isMockAdapter: boolean;
  getAllowedActions(): readonly string[];
  getStatus(context: ConnectExecutionContext): ConnectConnectorStatus;
  validateConfiguration(context: ConnectExecutionContext): ConnectAdapterResult;
  listCapabilities(context: ConnectExecutionContext): ConnectCapability[];
  testConnection(context: ConnectExecutionContext): Promise<ConnectAdapterResult>;
  execute(
    action: string,
    payload: Record<string, unknown>,
    context: ConnectExecutionContext,
  ): Promise<ConnectAdapterResult>;
  audit(
    action: string,
    result: ConnectAdapterResult,
    context: ConnectExecutionContext,
  ): ConnectAuditEntryDraft;
};

export type ConnectAuditEntryDraft = {
  tenantId: string;
  integrationId: string | null;
  providerKey: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  blocked: boolean;
  demo: boolean;
};

export const CONNECT_CONNECTOR_STATUS_LABELS: Record<ConnectConnectorStatus, string> = {
  not_available: 'Nicht verfügbar',
  coming_soon: 'In Vorbereitung',
  internal: 'Intern',
  beta: 'Beta',
  sandbox_ready: 'Sandbox bereit',
  production_ready: 'Produktiv bereit',
  disabled: 'Deaktiviert',
  error: 'Fehler',
};

export const CONNECT_ENVIRONMENT_LABELS: Record<ConnectEnvironment, string> = {
  demo: 'Demo',
  sandbox: 'Sandbox',
  production: 'Produktion',
};

/** Anzeige — niemals „verbunden“, wenn nicht konfiguriert. */
export function isConnectDisplayedAsConnected(
  integrationStatus: ConnectIntegrationStatus,
  connectorStatus: ConnectConnectorStatus,
): boolean {
  if (integrationStatus === 'not_configured' || integrationStatus === 'requested') {
    return false;
  }
  if (integrationStatus === 'disabled' || integrationStatus === 'error') {
    return false;
  }
  return (
    connectorStatus === 'sandbox_ready' || connectorStatus === 'production_ready'
  ) && (integrationStatus === 'sandbox' || integrationStatus === 'production' || integrationStatus === 'configured');
}
