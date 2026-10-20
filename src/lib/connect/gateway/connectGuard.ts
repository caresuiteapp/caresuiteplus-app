import type {
  ConnectExecutionContext,
  ConnectGuardCode,
  ConnectGuardResult,
} from '@/types/connect/gateway';

const HEALTH_DATA_ACTIONS = new Set([
  'export_health_data',
  'sync_health_records',
  'kim_send',
  'kim_receive',
  'epa_read',
  'epa_write',
]);

const HEALTH_DATA_PERMISSIONS = new Set([
  'office.clients.view_sensitive',
  'ti.kim.manage',
  'ti.epa.view',
]);

export function assertConnectActionAllowed(
  action: string,
  context: ConnectExecutionContext,
): ConnectGuardResult {
  if (!context.tenantId?.trim()) {
    return deny('missing_tenant', 'Mandant fehlt — externe Aktion blockiert.');
  }
  if (!context.userId?.trim()) {
    return deny('missing_user', 'Anmeldung erforderlich — externe Aktion blockiert.');
  }
  if (!context.role) {
    return deny('missing_role', 'Rolle fehlt — externe Aktion blockiert.');
  }
  if (!context.integrationId?.trim()) {
    return deny('missing_integration', 'Keine Integration konfiguriert — Aktion blockiert.');
  }
  if (context.integrationStatus === 'disabled') {
    return deny('integration_disabled', 'Integration ist deaktiviert.');
  }
  if (context.connectorStatus === 'disabled') {
    return deny('connector_disabled', 'Connector ist deaktiviert.');
  }
  if (context.connectorStatus === 'coming_soon' || context.connectorStatus === 'not_available') {
    return deny('provider_coming_soon', 'Diese Schnittstelle ist noch nicht freigegeben.');
  }
  if (context.environment === 'production' && context.demoMode) {
    return deny('production_in_demo_mode', 'Produktionsumgebung im Demo-Modus nicht erlaubt.');
  }
  if (context.environment === 'production' && context.isMockAdapter) {
    return deny('production_mock_adapter', 'Mock-Adapter in Produktion blockiert.');
  }
  if (requiresHealthDataPermission(action) && !hasHealthDataPermission(context)) {
    return deny('health_data_denied', 'Keine Berechtigung für Gesundheitsdaten-Transfer.');
  }
  if (!context.hasCredentialReference && context.environment !== 'demo') {
    return deny('missing_credential', 'Anbieter-Konfiguration (Vault-Referenz) fehlt.');
  }
  if (context.allowedActions.length > 0 && !context.allowedActions.includes(action)) {
    return deny('action_not_allowed', `Aktion „${action}" ist für diesen Anbieter nicht erlaubt.`);
  }
  return { allowed: true };
}

function deny(code: ConnectGuardCode, message: string): ConnectGuardResult {
  return { allowed: false, code, message };
}

function requiresHealthDataPermission(action: string): boolean {
  return HEALTH_DATA_ACTIONS.has(action);
}

function hasHealthDataPermission(context: ConnectExecutionContext): boolean {
  return context.permissions.some((p) => HEALTH_DATA_PERMISSIONS.has(p));
}
