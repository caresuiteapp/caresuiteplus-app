import type { ViewStyle } from 'react-native';
import { InfoBanner } from '@/components/ui/InfoBanner';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

type Props = {
  message: string;
  title?: string;
  variant?: AlertVariant;
  dismissible?: boolean;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
};

const VARIANT_MAP: Record<AlertVariant, 'info' | 'success' | 'warning' | 'danger'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

export function HealthOSAlert({
  message,
  title,
  variant = 'info',
  dismissible,
  onDismiss,
  actionLabel,
  onAction,
  style,
}: Props) {
  return (
    <InfoBanner
      title={title}
      message={message}
      variant={VARIANT_MAP[variant]}
      dismissible={dismissible}
      onDismiss={onDismiss}
      actionLabel={actionLabel}
      onAction={onAction}
      style={style}
    />
  );
}
