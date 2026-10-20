import type { ComponentType } from 'react';
import { Platform, Pressable, StyleSheet, Text, type PressableProps, type ViewStyle } from 'react-native';
import { spacing } from '@/theme';

type DesktopSidebarToggleProps = {
  side: 'left' | 'right';
  collapsed: boolean;
  onPress: () => void;
  controls: string;
  accentColor: string;
};

const AccessiblePressable = Pressable as ComponentType<
  PressableProps & { 'aria-controls'?: string; title?: string }
>;

export function DesktopSidebarToggle({
  side,
  collapsed,
  onPress,
  controls,
  accentColor,
}: DesktopSidebarToggleProps) {
  const opening = collapsed;
  const label = `${side === 'left' ? 'Modulnavigation' : 'Kontextleiste'} ${opening ? 'öffnen' : 'schließen'}`;
  const chevron = side === 'left' ? (opening ? '›' : '‹') : opening ? '‹' : '›';
  const webControlProps: { 'aria-controls'?: string } =
    Platform.OS === 'web' ? { 'aria-controls': controls } : {};

  return (
    <AccessiblePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={label}
      accessibilityState={{ expanded: !collapsed }}
      {...webControlProps}
      title={label}
      style={[styles.button, { borderColor: accentColor }]}
      testID={`desktop-${side}-sidebar-toggle`}
    >
      <Text style={[styles.chevron, { color: accentColor }]}>{chevron}</Text>
    </AccessiblePressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 28,
    minWidth: 28,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: spacing.xs,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null),
  },
  chevron: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
});
