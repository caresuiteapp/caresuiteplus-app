import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useMainModuleAccent } from '@/hooks/useMainModuleAccent';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { withAlpha } from '@/design/tokens/motion';
import { PLATFORM_MODULE_RAIL_WIDTH } from '@/lib/platform/shellLayoutMetrics';
import { useWebFontScale } from '@/design/web/WebFontScaleProvider';
import { formatWebFontScaleLabel } from '@/design/web/webFontScaleConfig';
import { spacing, typography } from '@/theme';

const RAIL_INNER_WIDTH = 56;
const RAIL_HORIZONTAL_PADDING = (PLATFORM_MODULE_RAIL_WIDTH - RAIL_INNER_WIDTH) / 2;

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null;

/** Web-only Schriftgröße — vertikal in der linken Modulleiste. */
export function ModuleRailFontSizeControl() {
  const moduleAccent = useMainModuleAccent();
  const { colors, isDark } = useLegacyTheme();
  const { scale, increase, decrease, canIncrease, canDecrease } = useWebFontScale();
  const styles = useMemo(
    () => createStyles(isDark, colors, moduleAccent),
    [colors, isDark, moduleAccent],
  );
  const [decreaseHovered, setDecreaseHovered] = useState(false);
  const [increaseHovered, setIncreaseHovered] = useState(false);

  if (Platform.OS !== 'web') return null;

  return (
    <View
      style={styles.root}
      accessibilityRole="group"
      accessibilityLabel={`Schriftgröße, aktuell ${formatWebFontScaleLabel(scale)}`}
    >
      <Pressable
        onPress={canIncrease ? increase : undefined}
        disabled={!canIncrease}
        style={({ pressed }) => [
          styles.actionBtn,
          webCursor,
          !canIncrease ? styles.actionDisabled : null,
          increaseHovered ? styles.actionHover : null,
          pressed && canIncrease ? styles.actionPressed : null,
        ]}
        onHoverIn={() => setIncreaseHovered(true)}
        onHoverOut={() => setIncreaseHovered(false)}
        accessibilityRole="button"
        accessibilityLabel="Schrift vergrößern"
        accessibilityState={{ disabled: !canIncrease }}
      >
        <Text style={styles.actionLarge}>A+</Text>
      </Pressable>

      <Text style={styles.label}>{formatWebFontScaleLabel(scale)}</Text>

      <Pressable
        onPress={canDecrease ? decrease : undefined}
        disabled={!canDecrease}
        style={({ pressed }) => [
          styles.actionBtn,
          webCursor,
          !canDecrease ? styles.actionDisabled : null,
          decreaseHovered ? styles.actionHover : null,
          pressed && canDecrease ? styles.actionPressed : null,
        ]}
        onHoverIn={() => setDecreaseHovered(true)}
        onHoverOut={() => setDecreaseHovered(false)}
        accessibilityRole="button"
        accessibilityLabel="Schrift verkleinern"
        accessibilityState={{ disabled: !canDecrease }}
      >
        <Text style={styles.actionSmall}>A−</Text>
      </Pressable>
    </View>
  );
}

function createStyles(
  isDark: boolean,
  colors: ReturnType<typeof useLegacyTheme>['colors'],
  moduleAccent: string,
) {
  return StyleSheet.create({
    root: {
      width: RAIL_INNER_WIDTH,
      alignSelf: 'center',
      marginHorizontal: RAIL_HORIZONTAL_PADDING,
      alignItems: 'center',
      gap: 2,
      backgroundColor: 'transparent',
    },
    actionBtn: {
      width: '100%',
      minHeight: 30,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionHover: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
    },
    actionPressed: {
      opacity: 0.88,
    },
    actionDisabled: {
      opacity: 0.35,
    },
    actionLarge: {
      ...typography.bodyStrong,
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '700',
      color: isDark ? '#F8FAFC' : colors.textPrimary,
      userSelect: 'none',
    } as TextStyle,
    actionSmall: {
      ...typography.bodyStrong,
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '700',
      color: isDark ? '#E2E8F0' : colors.textPrimary,
      userSelect: 'none',
    } as TextStyle,
    label: {
      ...typography.caption,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: withAlpha(moduleAccent, 0.85),
      textAlign: 'center',
      paddingVertical: 2,
      userSelect: 'none',
    } as TextStyle,
  });
}
