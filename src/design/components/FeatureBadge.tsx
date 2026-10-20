import { StatusBadge, type StatusKind } from './StatusBadge';
import type { UiVisibility } from '@/lib/ui/uiVisibility';
import { defaultPublicVisibility } from '@/lib/ui/uiVisibility';

type FeatureBadgeProps = {
  kind: StatusKind;
  label?: string;
  dot?: boolean;
  visibility?: UiVisibility;
  /** Raw key for developer diagnosis only */
  rawKey?: string;
};

/** Feature/status chip — delegates to StatusBadge with visibility rules. */
export function FeatureBadge({
  kind,
  label,
  dot,
  visibility = defaultPublicVisibility(),
  rawKey,
}: FeatureBadgeProps) {
  return (
    <StatusBadge
      kind={kind}
      label={label}
      dot={dot}
      visibility={visibility}
      rawKey={rawKey}
    />
  );
}
