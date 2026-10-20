import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { healthosShellLayoutRules } from './healthosShellLayoutRules';

type Props = {
  children?: ReactNode;
  position?: 'top-inline' | 'fab-host';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Slot for notification bell / blocker banners — parent injects UI, no notification services.
 */
export function HealthOSNotificationArea({
  children,
  position = 'top-inline',
  style,
  testID = 'healthos-notification-area',
}: Props) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        inline: {
          paddingHorizontal: careSpacing.md,
          paddingVertical: careSpacing.xs,
          zIndex: healthosShellLayoutRules.zIndex.notification,
        },
        fab: {
          position: 'absolute',
          right: careSpacing.lg,
          bottom: careSpacing.lg,
          zIndex: healthosShellLayoutRules.zIndex.notification,
        },
      }),
    [],
  );

  if (!children) return null;

  return (
    <View
      style={[position === 'fab-host' ? styles.fab : styles.inline, style]}
      testID={testID}
    >
      {children}
    </View>
  );
}
