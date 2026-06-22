import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';
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
  const [decreaseHovered, setDecreaseHovered] = useState(false);
  const [increaseHovered, setIncreaseHovered] = useState(false);

  if (Platform.OS !== 'web') return null;

  return (
    <View
      style={styles.root}
      accessibilityRole="group"
      accessibilityLabel={`Schriftgröße, aktuell ${formatWebFontScaleLabel(scale)}`}
    >
      <Text
        onPress={canDecrease ? decrease : undefined}
        style={[
          styles.action,
          canDecrease ? webPointer : webDisabled,
          canDecrease && decreaseHovered ? styles.actionHover : null,
        ]}
        onHoverIn={() => setDecreaseHovered(true)}
        onHoverOut={() => setDecreaseHovered(false)}
        accessibilityRole="button"
        accessibilityLabel="Schrift verkleinern"
        accessibilityState={{ disabled: !canDecrease }}
      >
        A−
      </Text>
      <Text style={styles.label}>{formatWebFontScaleLabel(scale)}</Text>
      <Text
        onPress={canIncrease ? increase : undefined}
        style={[
          styles.action,
          canIncrease ? webPointer : webDisabled,
          canIncrease && increaseHovered ? styles.actionHover : null,
        ]}
        onHoverIn={() => setIncreaseHovered(true)}
        onHoverOut={() => setIncreaseHovered(false)}
        accessibilityRole="button"
        accessibilityLabel="Schrift vergrößern"
        accessibilityState={{ disabled: !canIncrease }}
      >
        A+
      </Text>
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
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.55)' : 'rgba(0, 0, 0, 0.04)',
      gap: compact ? 2 : spacing.xs,
    },
    action: {
      ...typography.bodyStrong,
      fontSize: compact ? 10 : 14,
      lineHeight: compact ? 12 : 18,
      fontWeight: '600',
      color: isDark ? '#E2E8F0' : colors.textPrimary,
      userSelect: 'none',
    } as TextStyle,
    actionHover: {
      color: isDark ? '#FFFFFF' : colors.textPrimary,
      opacity: 0.85,
    } as TextStyle,
    label: {
      ...typography.caption,
      minWidth: compact ? 28 : 36,
      textAlign: 'center',
      color: isDark ? '#94A3B8' : colors.textMuted,
      fontWeight: '600',
      fontSize: compact ? 9 : 12,
      lineHeight: compact ? 11 : undefined,
      userSelect: 'none',
    } as TextStyle,
  });
}
