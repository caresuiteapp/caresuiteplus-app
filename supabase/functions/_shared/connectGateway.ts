/**
 * CareSuite+ Connect — Edge Function Proxy (Vorbereitung)
 * Keine externen API-Aufrufe. Keine Secrets im Response.
 */

export type ConnectProxyActionAllowlist = Record<string, readonly string[]>;

export const CONNECT_PROXY_ACTION_ALLOWLIST: ConnectProxyActionAllowlist = {
  datev: ['test_connection', 'accounting_export'],
  stripe: ['test_connection', 'payment_collection', 'create_payment_link'],
  kim: ['test_connection', 'kim_send', 'kim_receive'],
  google_maps: ['test_connection', 'route_optimization'],
  docusign: ['test_connection', 'document_signature'],
  icd10_gm: ['test_connection', 'catalog_lookup'],
  personio: ['test_connection', 'employee_sync'],
  moodle: ['test_connection', 'course_sync'],
  gkv: ['test_connection', 'gkv_dta_export'],
  resend: ['test_connection', 'email_delivery'],
  twilio: ['test_connection', 'sms_delivery', 'whatsapp_delivery'],
  messagebird: ['test_connection', 'sms_delivery', 'whatsapp_delivery'],
  marketplace_partner: ['test_connection', 'partner_referral'],
};

export type ConnectProxyRequest = {
  providerKey: string;
  action: string;
  payload?: Record<string, unknown>;
  integrationId?: string | null;
  category?: string;
};

export type ConnectProxyResponse = {
  ok: boolean;
  blocked?: boolean;
  demo?: boolean;
  message: string;
  auditAction: string;
};

export type ConnectProxyFeatureGateInput = {
  userId: string | null;
  tenantId: string | null;
  role: string | null;
  hasModuleAccess: boolean;
  integrationStatus: string;
  hasCredential: boolean;
  environment: 'demo' | 'sandbox' | 'production';
  isMockProvider: boolean;
  demoMode: boolean;
  hasProductionApproval: boolean;
  hasExternalTransferConsent: boolean;
};

export function isConnectProxyActionAllowed(providerKey: string, action: string): boolean {
  const allowlist = CONNECT_PROXY_ACTION_ALLOWLIST[providerKey];
  if (!allowlist) return action === 'test_connection';
  return allowlist.includes(action);
}

export function assertConnectProxyFeatureAllowed(
  input: ConnectProxyFeatureGateInput,
  action: string,
): { allowed: true } | { allowed: false; message: string } {
  if (!input.userId?.trim()) {
    return { allowed: false, message: 'Anmeldung erforderlich — Aktion blockiert.' };
  }
  if (!input.tenantId?.trim()) {
    return { allowed: false, message: 'Mandant fehlt — Aktion blockiert.' };
  }
  if (!input.role?.trim()) {
    return { allowed: false, message: 'Rolle fehlt — Aktion blockiert.' };
  }
  if (!input.hasModuleAccess) {
    return { allowed: false, message: 'Connect-Modul nicht freigeschaltet.' };
  }
  if (input.integrationStatus === 'disabled') {
    return { allowed: false, message: 'Integration deaktiviert.' };
  }
  if (
    input.integrationStatus === 'not_configured' ||
    input.integrationStatus === 'requested'
  ) {
    return { allowed: false, message: 'Anbieter nicht konfiguriert — Aktion blockiert.' };
  }
  if (input.environment === 'production' && input.isMockProvider) {
    return { allowed: false, message: 'Mock-Anbieter in Produktion blockiert.' };
  }
  if (input.environment === 'production' && input.demoMode) {
    return { allowed: false, message: 'Demo-Modus in Produktion blockiert.' };
  }
  if (!input.hasCredential && input.environment !== 'demo') {
    return { allowed: false, message: 'Anbieter-Konfiguration (Vault) fehlt.' };
  }
  if (input.environment === 'production' && !input.hasProductionApproval) {
    return { allowed: false, message: 'Produktive Nutzung erfordert Freigabe.' };
  }
  if (action !== 'test_connection' && !input.hasExternalTransferConsent) {
    return { allowed: false, message: 'Externer Datentransfer erfordert Freigabe.' };
  }
  return { allowed: true };
}

export function buildBlockedProxyResponse(
  action: string,
  message: string,
): ConnectProxyResponse {
  return { ok: false, blocked: true, message, auditAction: action };
}
