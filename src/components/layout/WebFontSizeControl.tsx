import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useWebFontScale } from '@/design/web/WebFontScaleProvider';
import { formatWebFontScaleLabel } from '@/design/web/webFontScaleConfig';
import { spacing, typography } from '@/theme';

const TOPBAR_CONTROL_HEIGHT = 48;
const COMPACT_CONTROL_HEIGHT = 24;

const webPointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as TextStyle) : null;
const webDisabled =
  Platform.OS === 'web' ? ({ cursor: 'default', opacity: 0.35 } as TextStyle) : { opacity: 0.35 };

type WebFontSizeControlProps = {
  compact?: boolean;
};

/** Web-only A− / 100% / A+ text control — scales typography via --app-font-scale. */
export function WebFontSizeControl({ compact = false }: WebFontSizeControlProps) {
  const { colors, isDark } = useLegacyTheme();
  const { scale, increase, decrease, canIncrease, canDecrease } = useWebFontScale();
  const styles = useMemo(() => createStyles(isDark, colors, compact), [compact, isDark, colors]);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.root} accessibilityLabel={`Schriftgröße, aktuell ${formatWebFontScaleLabel(scale)}`}>
      <Pressable
        onPress={canDecrease ? decrease : undefined}
        disabled={!canDecrease}
        style={({ hovered }: { hovered?: boolean }) => [
          styles.actionWrap as ViewStyle,
          canDecrease && hovered ? (styles.actionWrapHover as ViewStyle) : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Schrift verkleinern"
        accessibilityState={{ disabled: !canDecrease }}
      >
        <Text style={[styles.action, canDecrease ? webPointer : webDisabled]}>A−</Text>
      </Pressable>
      <Text style={styles.label}>{formatWebFontScaleLabel(scale)}</Text>
      <Pressable
        onPress={canIncrease ? increase : undefined}
        disabled={!canIncrease}
        style={({ hovered }: { hovered?: boolean }) => [
          styles.actionWrap as ViewStyle,
          canIncrease && hovered ? (styles.actionWrapHover as ViewStyle) : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Schrift vergrößern"
        accessibilityState={{ disabled: !canIncrease }}
      >
        <Text style={[styles.action, canIncrease ? webPointer : webDisabled]}>A+</Text>
      </Pressable>
    </View>
  );
}

function createStyles(
  isDark: boolean,
  colors: ReturnType<typeof useLegacyTheme>['colors'],
  compact: boolean,
) {
  return StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: compact ? COMPACT_CONTROL_HEIGHT : TOPBAR_CONTROL_HEIGHT,
      paddingHorizontal: compact ? 6 : spacing.sm,
      paddingVertical: compact ? 2 : 0,
      borderRadius: 999,
      backgroundColor: 'rgba(15, 27, 51, 0.04)',
      gap: compact ? 2 : spacing.xs,
    },
    actionWrap: {
      paddingHorizontal: 2,
    },
    actionWrapHover: {
      opacity: 0.85,
    },
    action: {
      ...typography.bodyStrong,
      fontSize: compact ? 10 : 14,
      lineHeight: compact ? 12 : 18,
      fontWeight: '600',
      color: colors.textPrimary,
      userSelect: 'none',
    } as TextStyle,
    label: {
      ...typography.caption,
      minWidth: compact ? 28 : 36,
      textAlign: 'center',
      color: colors.textMuted,
      fontWeight: '600',
      fontSize: compact ? 9 : 12,
      lineHeight: compact ? 11 : undefined,
      userSelect: 'none',
    } as TextStyle,
  });
}
