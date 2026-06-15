/**
 * Feature readiness status — replaces blanket preparedOnly for core app functions.
 * Only external-provider integrations may remain requires_external_provider / requires_credentials.
 */
export type FeatureStatus =
  | 'available_demo'
  | 'available_live'
  | 'partial_live'
  | 'requires_external_provider'
  | 'requires_credentials'
  | 'disabled_by_admin';

export const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  available_demo: 'Demo-funktional',
  available_live: 'Live angebunden',
  partial_live: 'Teilweise live',
  requires_external_provider: 'Externe Anbindung erforderlich',
  requires_credentials: 'Zugangsdaten erforderlich',
  disabled_by_admin: 'Vom Admin deaktiviert',
};

/** External-provider feature keys that may remain preparedOnly. */
export const ALLOWED_PREPARED_ONLY_KEYS = [
  'ti',
  'kim',
  'epa',
  'erezept',
  'emp',
  'egk_live',
  'external_ai_provider',
  'push_provider',
  'payment_provider',
  'datev',
  'external_cost_bearer_api',
  'store_submission',
] as const;

export type AllowedPreparedOnlyKey = (typeof ALLOWED_PREPARED_ONLY_KEYS)[number];

export function isAllowedPreparedOnlyKey(key: string): key is AllowedPreparedOnlyKey {
  return (ALLOWED_PREPARED_ONLY_KEYS as readonly string[]).includes(key);
}

export function isPreparedOnlyStatus(status: FeatureStatus): boolean {
  return (
    status === 'requires_external_provider' ||
    status === 'requires_credentials' ||
    status === 'disabled_by_admin'
  );
}

export function getFeatureStatusLabel(status: FeatureStatus): string {
  return FEATURE_STATUS_LABELS[status];
}

export function resolveDemoOrLiveStatus(isLiveWired: boolean): FeatureStatus {
  return isLiveWired ? 'available_live' : 'available_demo';
}

export function resolveExternalProviderStatus(): FeatureStatus {
  return 'requires_external_provider';
}
