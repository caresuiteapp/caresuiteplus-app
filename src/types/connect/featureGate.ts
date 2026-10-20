import type { RoleKey } from '@/types/core/auth';
import type { PermissionKey } from '@/types/permissions';
import type { ConnectReadiness } from '@/types/modules/connect';
import type {
  ConnectConnectorStatus,
  ConnectEnvironment,
  ConnectIntegrationStatus,
} from '@/types/connect/gateway';

/** Connect-Feature-Schlüssel — Kategorie.Integration oder Modul-Alias. */
export type ConnectFeatureKey =
  | 'accounting.datev'
  | 'payments.link'
  | 'ti.kim'
  | 'communication.sms'
  | 'geo.gps'
  | 'documents.ocr'
  | 'marketplace.referral'
  | (string & {});

/** Aktion innerhalb eines Features (UI, Route, Gateway). */
export type ConnectFeatureActionKey =
  | 'view'
  | 'navigate'
  | 'configure'
  | 'execute'
  | 'export'
  | 'send'
  | 'capture'
  | 'test_connection'
  | 'create_payment_link'
  | 'accounting_export'
  | 'partner_referral'
  | (string & {});

export type ConnectFeatureGateCode =
  | 'missing_user'
  | 'missing_tenant'
  | 'missing_role'
  | 'module_access_denied'
  | 'feature_disabled'
  | 'feature_coming_soon'
  | 'feature_internal'
  | 'provider_not_configured'
  | 'sandbox_production_data'
  | 'production_not_approved'
  | 'production_mock_blocked'
  | 'production_demo_blocked'
  | 'missing_credential'
  | 'health_data_denied'
  | 'payment_approval_required'
  | 'external_transfer_denied'
  | 'avv_required'
  | 'permission_denied';

export type ConnectFeatureGateResult =
  | { allowed: true; visible: true }
  | {
      allowed: false;
      visible: boolean;
      showBlockPage: boolean;
      code: ConnectFeatureGateCode;
      message: string;
    };

export type ConnectFeatureMeta = {
  requiresHealthData?: boolean;
  requiresPaymentData?: boolean;
  requiresExternalTransfer?: boolean;
  requiresAvv?: boolean;
  catalogCategoryKey?: string;
  integrationKey?: string;
};

export type ConnectFeatureGateContext = {
  userId: string | null;
  tenantId: string | null;
  role: RoleKey | null;
  permissions: readonly PermissionKey[];
  hasConnectModuleAccess: boolean;
  featureReadiness: ConnectReadiness;
  integrationStatus: ConnectIntegrationStatus;
  connectorStatus: ConnectConnectorStatus;
  providerEnvironment: ConnectEnvironment;
  isMockProvider: boolean;
  hasCredentialReference: boolean;
  hasProductionApproval: boolean;
  hasPrivacyApproval: boolean;
  hasPaymentApproval: boolean;
  hasExternalTransferConsent: boolean;
  hasAvv: boolean;
  demoMode: boolean;
  requiresHealthData: boolean;
  requiresPaymentData: boolean;
  requiresExternalTransfer: boolean;
  /** True wenn echte Produktivdaten verarbeitet würden (nicht Sandbox-Demo). */
  usesProductionData: boolean;
};

export const CONNECT_PREPARED_BLOCK_TITLE = 'Schnittstelle vorbereitet';

export const CONNECT_PREPARED_BLOCK_TEXT =
  'Diese CareSuite+ Connect Schnittstelle ist vorbereitet. Für die produktive Nutzung ist eine gültige Anbieter-Konfiguration, eine passende Datenfreigabe und gegebenenfalls ein Vertrag oder eine AVV erforderlich.';
