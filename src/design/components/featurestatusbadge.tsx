import { StatusBadge, type StatusKind } from './StatusBadge';
import {
  defaultPublicVisibility,
  resolveVisibleLabel,
  userFriendlyLabel,
  type UiVisibility,
} from '@/lib/ui/uiVisibility';
import type { FeatureStatus } from '@/lib/status/featureStatus';
import { getFeatureStatusLabel } from '@/lib/status/featureStatus';

type FeatureStatusBadgeProps = {
  status: FeatureStatus | 'preparedOnly' | 'coming_soon' | 'internal' | 'beta' | 'demoMode';
  visibility?: UiVisibility;
  label?: string;
  dot?: boolean;
};

function mapFeatureStatusToKind(
  status: FeatureStatusBadgeProps['status'],
): StatusKind {
  switch (status) {
    case 'available_live':
    case 'partial_live':
      return 'active';
    case 'available_demo':
      return 'info';
    case 'requires_external_provider':
    case 'requires_credentials':
    case 'preparedOnly':
      return 'preparedOnly';
    case 'disabled_by_admin':
      return 'inactive';
    case 'coming_soon':
      return 'comingSoon';
    case 'beta':
      return 'warning';
    case 'internal':
    case 'demoMode':
      return 'info';
    default:
      return 'info';
  }
}

function resolveDefaultLabel(status: FeatureStatusBadgeProps['status']): string {
  if (status === 'preparedOnly') return userFriendlyLabel('preparedOnly');
  if (status === 'coming_soon') return userFriendlyLabel('coming_soon');
  if (status === 'internal') return userFriendlyLabel('internal');
  if (status === 'beta') return userFriendlyLabel('beta');
  if (status === 'demoMode') return userFriendlyLabel('demoMode');
  return getFeatureStatusLabel(status);
}

/** Feature readiness badge with role-based visibility — never shows raw preparedOnly to normal users. */
export function FeatureStatusBadge({
  status,
  visibility = defaultPublicVisibility(),
  label,
  dot = false,
}: FeatureStatusBadgeProps) {
  const raw = label ?? resolveDefaultLabel(status);
  const visible = resolveVisibleLabel(raw, visibility);
  if (!visible) return null;

  return <StatusBadge kind={mapFeatureStatusToKind(status)} label={visible} dot={dot} />;
}
