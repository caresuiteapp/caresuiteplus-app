import { ReactNode, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type AdaptiveActionBarProps = {
  primary?: ReactNode;
  secondary?: ReactNode;
  tertiary?: ReactNode;
  style?: ViewStyle;
};

export function AdaptiveActionBar({ primary, secondary, tertiary, style }: AdaptiveActionBarProps) {
  const { isPhone } = useDeviceClass();
  const { colors } = useLegacyTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        phoneStack: {
          gap: careSpacing.sm,
          paddingVertical: careSpacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.borderSoft,
        },
        desktopRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: careSpacing.md,
          paddingVertical: careSpacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.borderSoft,
        },
        left: {
          flex: 1,
        },
        right: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: careSpacing.sm,
        },
      }),
    [colors.borderSoft],
  );

  if (isPhone) {
    return (
      <View style={[styles.phoneStack, style]}>
        {primary}
        {secondary}
        {tertiary}
      </View>
    );
  }

  return (
    <View style={[styles.desktopRow, style]}>
      <View style={styles.left}>{tertiary}</View>
      <View style={styles.right}>
        {secondary}
        {primary}
      </View>
    </View>
  );
}
