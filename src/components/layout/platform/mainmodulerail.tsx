import { useMemo, type ComponentType } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { MAIN_MODULE_RAIL } from '@/lib/navigation/mainmodulerail';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { fxMotion, glassFx, neonGlow, withAlpha } from '@/design/tokens/motion';
import { radius, spacing, typography } from '@/theme';
import type { MainModuleKey } from '@/types/navigation/platform';

type MainModuleRailProps = {
  activeModule: MainModuleKey;
};

type HoverProps = { onHoverIn?: () => void; onHoverOut?: () => void };
const HoverPressable = Pressable as unknown as ComponentType<PressableProps & HoverProps>;
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function RailItem({
  active,
  accent,
  icon,
  label,
  isDark,
  onPress,
}: {
  active: boolean;
  accent: string;
  icon: string;
  label: string;
  isDark: boolean;
  onPress: () => void;
}) {
  const hovered = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.08 * hovered.value }, { translateY: -2 * hovered.value }],
    shadowOpacity: active ? 0.6 : 0.18 * hovered.value,
    shadowRadius: active ? 14 : 8 + 6 * hovered.value,
  }));

  return (
    <HoverPressable
      onPress={onPress}
      onHoverIn={() => {
        hovered.value = withTiming(1, { duration: fxMotion.fast });
      }}
      onHoverOut={() => {
        hovered.value = withTiming(0, { duration: fxMotion.base });
      }}
      style={[styles.itemWrap, webCursor]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {active ? <View style={[styles.activeBar, { backgroundColor: accent }]} /> : null}
      <Animated.View
        style={[
          styles.icon,
          {
            backgroundColor: active
              ? withAlpha(accent, 0.9)
              : isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(15,23,42,0.05)',
            borderColor: active ? withAlpha(accent, 0.9) : isDark ? glassFx.innerBorder : 'transparent',
            shadowColor: accent,
            shadowOffset: { width: 0, height: 4 },
            elevation: active ? 8 : 0,
          },
          animStyle,
        ]}
      >
        <Text style={styles.iconText}>{icon}</Text>
      </Animated.View>
    </HoverPressable>
  );
}

/** Left icon rail — main modules only (no detail navigation). */
export function MainModuleRail({ activeModule }: MainModuleRailProps) {
  const router = useRouter();
  const { colors, isDark } = useLegacyTheme();
  const railStyles = useMemo(() => createRailStyles(isDark, colors), [isDark, colors]);

  return (
    <View style={railStyles.root}>
      <View style={[railStyles.brand, { borderColor: withAlpha(colors.violet, 0.5) }]}>
        <Text style={[railStyles.brandText, { color: colors.violet }]}>C+</Text>
      </View>
      <View style={railStyles.divider} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={railStyles.scroll}
        style={railStyles.list}
      >
        {MAIN_MODULE_RAIL.map((module) => (
          <RailItem
            key={module.key}
            active={activeModule === module.key}
            accent={module.accentColor}
            icon={module.icon}
            label={module.label}
            isDark={isDark}
            onPress={() => router.push(module.path as never)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  itemWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  activeBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 4, borderRadius: 4 },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 20 },
});

function createRailStyles(isDark: boolean, colors: ReturnType<typeof useLegacyTheme>['colors']) {
  const glassBorder = isDark ? glassFx.border : colors.borderSoft;

  return StyleSheet.create({
    root: {
      width: 76,
      backgroundColor: isDark ? 'rgba(11,16,32,0.32)' : 'rgba(255,255,255,0.92)',
      borderRightWidth: 1,
      borderRightColor: glassBorder,
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    brand: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? withAlpha(colors.violet, 0.16) : 'rgba(139,92,246,0.10)',
      ...(isDark ? neonGlow(colors.violet, 0.4, 14, 0) : null),
    },
    brandText: { ...typography.button, fontWeight: '800' },
    divider: {
      width: 28,
      height: 1,
      backgroundColor: glassBorder,
      marginVertical: spacing.sm,
    },
    list: { flex: 1, alignSelf: 'stretch' },
    scroll: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  });
}
