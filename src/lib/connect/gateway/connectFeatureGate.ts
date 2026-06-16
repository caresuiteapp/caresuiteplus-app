import { getConnectCategory, getConnectIntegration } from '@/lib/connect/connectCatalog';
import { resolveModuleNavState } from '@/lib/modules/moduleVisibilityService';
import { isDemoMode } from '@/lib/supabase/config';
import type { ConnectReadiness } from '@/types/modules/connect';
import type {
  ConnectConnectorStatus,
  ConnectEnvironment,
  ConnectExecutionContext,
  ConnectIntegrationStatus,
} from '@/types/connect/gateway';
import type {
  ConnectFeatureActionKey,
  ConnectFeatureGateCode,
  ConnectFeatureGateContext,
  ConnectFeatureGateResult,
  ConnectFeatureKey,
  ConnectFeatureMeta,
} from '@/types/connect/featureGate';
import type { PermissionKey, RoleKey } from '@/types';

export const CONNECT_FEATURE_META: Record<string, ConnectFeatureMeta> = {
  'accounting.datev': {
    catalogCategoryKey: 'accounting',
    integrationKey: 'datev',
    requiresExternalTransfer: true,
  },
  'payments.link': {
    catalogCategoryKey: 'payments',
    integrationKey: 'stripe',
    requiresPaymentData: true,
    requiresExternalTransfer: true,
  },
  'ti.kim': {
    catalogCategoryKey: 'ti_kim',
    integrationKey: 'kim',
    requiresHealthData: true,
    requiresExternalTransfer: true,
    requiresAvv: true,
  },
  'communication.sms': {
    catalogCategoryKey: 'communication_channels',
    integrationKey: 'sms',
    requiresExternalTransfer: true,
  },
  'geo.gps': {
    catalogCategoryKey: 'routes_gps',
    integrationKey: 'maps_google',
    requiresExternalTransfer: true,
  },
  'documents.ocr': {
    catalogCategoryKey: 'documents_signatures',
    integrationKey: 'ocr',
    requiresExternalTransfer: true,
  },
  'marketplace.referral': {
    catalogCategoryKey: 'marketplace',
    integrationKey: 'software_partner',
    requiresExternalTransfer: true,
  },
};

const PASSIVE_ACTIONS = new Set<ConnectFeatureActionKey>(['view', 'navigate']);

const ADMIN_ROLES = new Set<RoleKey>(['business_admin']);

function deny(
  code: ConnectFeatureGateCode,
  message: string,
  options: { visible?: boolean; showBlockPage?: boolean } = {},
): ConnectFeatureGateResult {
  return {
    allowed: false,
    visible: options.visible ?? true,
    showBlockPage: options.showBlockPage ?? true,
    code,
    message,
  };
}

export function parseConnectFeatureKey(
  featureKey: ConnectFeatureKey,
): { categoryKey: string; integrationKey: string } | null {
  const dot = featureKey.indexOf('.');
  if (dot <= 0) return null;
  return {
    categoryKey: featureKey.slice(0, dot),
    integrationKey: featureKey.slice(dot + 1),
  };
}

export function resolveConnectFeatureReadiness(featureKey: ConnectFeatureKey): ConnectReadiness {
  const meta = CONNECT_FEATURE_META[featureKey];
  if (meta?.catalogCategoryKey && meta.integrationKey) {
    const integration = getConnectIntegration(meta.catalogCategoryKey, meta.integrationKey);
    if (integration) return integration.readiness;
    const category = getConnectCategory(meta.catalogCategoryKey);
    return category?.readiness ?? 'coming_soon';
  }

  const parsed = parseConnectFeatureKey(featureKey);
  if (!parsed) return 'coming_soon';
  const integration = getConnectIntegration(parsed.categoryKey, parsed.integrationKey);
  if (integration) return integration.readiness;
  const category = getConnectCategory(parsed.categoryKey);
  return category?.readiness ?? 'coming_soon';
}

function resolveFeatureReadinessFromConnector(
  connectorStatus: ConnectConnectorStatus,
  catalogReadiness: ConnectReadiness,
): ConnectReadiness {
  if (connectorStatus === 'disabled') return 'disabled';
  if (connectorStatus === 'internal') return 'internal';
  if (connectorStatus === 'coming_soon' || connectorStatus === 'not_available') {
    return 'coming_soon';
  }
  if (connectorStatus === 'beta') return 'beta';
  if (connectorStatus === 'sandbox_ready' || connectorStatus === 'production_ready') {
    return catalogReadiness === 'disabled' ? 'disabled' : 'prepared';
  }
  return catalogReadiness;
}

export function isConnectFeaturePassiveAction(actionKey: ConnectFeatureActionKey): boolean {
  return PASSIVE_ACTIONS.has(actionKey);
}

export function isConnectAdminRole(
  role: RoleKey | null,
  permissions: readonly PermissionKey[],
): boolean {
  if (role && ADMIN_ROLES.has(role)) return true;
  return permissions.includes('connect.configure');
}

function resolveHasConnectModuleAccess(tenantId: string | null, role: RoleKey | null): boolean {
  if (!tenantId?.trim()) return false;
  const nav = resolveModuleNavState('connect', { tenantId, roleKey: role ?? undefined });
  return nav.isVisible && nav.isNavigable;
}

export function buildConnectFeatureGateContext(
  input: Partial<ConnectFeatureGateContext> & {
    userId?: string | null;
    tenantId?: string | null;
    role?: RoleKey | null;
  },
): ConnectFeatureGateContext {
  const tenantId = input.tenantId?.trim() ?? null;
  const demoMode = input.demoMode ?? isDemoMode();

  return {
    userId: input.userId?.trim() ?? null,
    tenantId,
    role: input.role ?? null,
    permissions: input.permissions ?? [],
    hasConnectModuleAccess:
      input.hasConnectModuleAccess ??
      resolveHasConnectModuleAccess(tenantId, input.role ?? null),
    featureReadiness: input.featureReadiness ?? 'coming_soon',
    integrationStatus: input.integrationStatus ?? 'not_configured',
    connectorStatus: input.connectorStatus ?? 'coming_soon',
    providerEnvironment: input.providerEnvironment ?? (demoMode ? 'demo' : 'sandbox'),
    isMockProvider: input.isMockProvider ?? true,
    hasCredentialReference: input.hasCredentialReference ?? false,
    hasProductionApproval: input.hasProductionApproval ?? false,
    hasPrivacyApproval: input.hasPrivacyApproval ?? false,
    hasPaymentApproval: input.hasPaymentApproval ?? false,
    hasExternalTransferConsent: input.hasExternalTransferConsent ?? false,
    hasAvv: input.hasAvv ?? false,
    demoMode,
    requiresHealthData: input.requiresHealthData ?? false,
    requiresPaymentData: input.requiresPaymentData ?? false,
    requiresExternalTransfer: input.requiresExternalTransfer ?? false,
    usesProductionData: input.usesProductionData ?? false,
  };
}

export function buildConnectFeatureGateContextFromFeatureKey(
  featureKey: ConnectFeatureKey,
  input: Partial<ConnectFeatureGateContext> & {
    userId?: string | null;
    tenantId?: string | null;
    role?: RoleKey | null;
  } = {},
): ConnectFeatureGateContext {
  const meta = CONNECT_FEATURE_META[featureKey] ?? {};
  const parsed = parseConnectFeatureKey(featureKey);
  const categoryKey = meta.catalogCategoryKey ?? parsed?.categoryKey;
  const integrationKey = meta.integrationKey ?? parsed?.integrationKey;
  const integration =
    categoryKey && integrationKey
      ? getConnectIntegration(categoryKey, integrationKey)
      : undefined;

  const readiness = integration?.readiness ?? resolveConnectFeatureReadiness(featureKey);

  return buildConnectFeatureGateContext({
    featureReadiness: readiness,
    requiresHealthData: meta.requiresHealthData ?? false,
    requiresPaymentData: meta.requiresPaymentData ?? false,
    requiresExternalTransfer: meta.requiresExternalTransfer ?? false,
    ...input,
  });
}

export function buildConnectFeatureGateContextFromExecution(
  featureKey: ConnectFeatureKey,
  context: ConnectExecutionContext,
  overrides: Partial<ConnectFeatureGateContext> = {},
): ConnectFeatureGateContext {
  const meta = CONNECT_FEATURE_META[featureKey] ?? {};
  const catalogReadiness = resolveConnectFeatureReadiness(featureKey);
  return buildConnectFeatureGateContext({
    userId: context.userId,
    tenantId: context.tenantId,
    role: context.role,
    permissions: context.permissions,
    featureReadiness: resolveFeatureReadinessFromConnector(
      context.connectorStatus,
      catalogReadiness,
    ),
    integrationStatus: context.integrationStatus,
    connectorStatus: context.connectorStatus,
    providerEnvironment: context.environment,
    isMockProvider: context.isMockAdapter,
    hasCredentialReference: context.hasCredentialReference,
    demoMode: context.demoMode,
    requiresHealthData: meta.requiresHealthData ?? false,
    requiresPaymentData: meta.requiresPaymentData ?? false,
    requiresExternalTransfer: meta.requiresExternalTransfer ?? false,
    usesProductionData: context.environment === 'production',
    ...overrides,
  });
}

/**
 * Zentraler Release-Gate für CareSuite+ Connect.
 * Alle 15 Regeln werden hier durchgesetzt.
 */
export function assertConnectFeatureAllowed(
  featureKey: ConnectFeatureKey,
  actionKey: ConnectFeatureActionKey,
  context: ConnectFeatureGateContext,
): ConnectFeatureGateResult {
  const passive = isConnectFeaturePassiveAction(actionKey);

  if (!context.userId?.trim()) {
    return deny('missing_user', 'Anmeldung erforderlich — Aktion blockiert.', { visible: false });
  }
  if (!context.tenantId?.trim()) {
    return deny('missing_tenant', 'Mandant fehlt — Aktion blockiert.');
  }
  if (!context.role) {
    return deny('missing_role', 'Rolle fehlt — Aktion blockiert.');
  }
  if (!context.hasConnectModuleAccess) {
    return deny('module_access_denied', 'Connect-Modul ist für diesen Mandanten nicht freigeschaltet.');
  }
  if (context.featureReadiness === 'disabled') {
    return deny('feature_disabled', 'Diese Schnittstelle ist deaktiviert.', { visible: false });
  }

  if (context.featureReadiness === 'internal' && !isConnectAdminRole(context.role, context.permissions)) {
    return deny(
      'feature_internal',
      'Interne Schnittstelle — nur für Administratoren verfügbar.',
      { visible: false },
    );
  }

  if (context.featureReadiness === 'coming_soon' && !passive) {
    return deny(
      'feature_coming_soon',
      'Schnittstelle vorbereitet — produktive Aktion noch nicht freigegeben.',
      { visible: true, showBlockPage: true },
    );
  }

  if (
    context.demoMode &&
    context.providerEnvironment === 'demo' &&
    (actionKey === 'test_connection' || actionKey.startsWith('test_'))
  ) {
    return { allowed: true, visible: true };
  }

  if (passive) {
    return { allowed: true, visible: true };
  }

  if (actionKey === 'configure' && !context.permissions.includes('connect.configure')) {
    return deny('permission_denied', 'Konfiguration nur für Administratoren.', { showBlockPage: true });
  }

  if (
    context.integrationStatus === 'not_configured' ||
    context.integrationStatus === 'requested' ||
    context.connectorStatus === 'not_available'
  ) {
    return deny(
      'provider_not_configured',
      'Anbieter nicht konfiguriert — Aktion blockiert.',
      { visible: true, showBlockPage: true },
    );
  }

  if (context.providerEnvironment === 'production' && context.isMockProvider) {
    return deny('production_mock_blocked', 'Mock-Anbieter in Produktion blockiert.');
  }
  if (context.providerEnvironment === 'production' && context.demoMode) {
    return deny('production_demo_blocked', 'Demo-Modus in Produktion blockiert.');
  }

  if (!context.hasCredentialReference && context.providerEnvironment !== 'demo') {
    return deny('missing_credential', 'Anbieter-Konfiguration (Vault-Referenz) fehlt.');
  }

  if (context.providerEnvironment === 'sandbox' && context.usesProductionData) {
    return deny(
      'sandbox_production_data',
      'Sandbox-Umgebung — keine Produktivdaten erlaubt.',
    );
  }

  if (context.providerEnvironment === 'production') {
    if (!context.hasCredentialReference) {
      return deny('missing_credential', 'Produktion erfordert gültige Anbieter-Konfiguration.');
    }
    if (!context.hasProductionApproval) {
      return deny(
        'production_not_approved',
        'Produktive Nutzung erfordert Freigabe und Vertrag.',
      );
    }
  }

  if (context.requiresHealthData && !context.hasPrivacyApproval) {
    return deny(
      'health_data_denied',
      'Gesundheitsdaten erfordern explizite Datenschutz-Freigabe.',
    );
  }

  if (context.requiresPaymentData && !context.hasPaymentApproval) {
    return deny(
      'payment_approval_required',
      'Zahlungsdaten erfordern Zahlungs-Freigabe durch Administrator.',
    );
  }

  if (context.requiresExternalTransfer) {
    if (!context.hasExternalTransferConsent) {
      return deny(
        'external_transfer_denied',
        'Externer Datentransfer erfordert Einwilligung oder Freigabe.',
      );
    }
    const meta = CONNECT_FEATURE_META[featureKey];
    if ((meta?.requiresAvv || context.requiresHealthData) && !context.hasAvv) {
      return deny('avv_required', 'Auftragsverarbeitungsvertrag (AVV) erforderlich.');
    }
  }

  return { allowed: true, visible: true };
}

export function resolveConnectFeatureKeyFromGateway(
  category: string,
  providerKey: string,
): ConnectFeatureKey {
  return `${category}.${providerKey}` as ConnectFeatureKey;
}
