import type { ViewStyle } from 'react-native';
import { PremiumBadge } from '@/components/ui/PremiumBadge';
import {
  resolveHealthOSStatusDisplay,
  type HealthOSStatusDomain,
} from './status/healthosStatusMapping';
import { healthosTokens, type HealthOSBadgeTone } from './tokens/healthosTokens';

type Props = {
  /** Pre-resolved German label (preferred when caller already mapped). */
  label?: string;
  /** Map technical value → German UI via HealthOS status registry. */
  domain?: HealthOSStatusDomain;
  technicalValue?: string | null;
  tone?: HealthOSBadgeTone;
  style?: ViewStyle;
  dot?: boolean;
};

export function HealthOSStatusBadge({
  label,
  domain,
  technicalValue,
  tone,
  style,
  dot = false,
}: Props) {
  const resolved =
    domain && technicalValue != null
      ? resolveHealthOSStatusDisplay(domain, technicalValue)
      : null;

  const displayLabel = label ?? resolved?.label ?? 'Status unbekannt';
  const displayTone = tone ?? resolved?.tone ?? 'muted';
  const premiumVariant = healthosTokens.badgeTones[displayTone].premiumVariant;

  return (
    <PremiumBadge label={displayLabel} variant={premiumVariant} style={style} dot={dot} />
  );
}
