import { useMemo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CARESUITE_ROBOT_LOGO } from '@/components/brand/brandassets';
import { MAIN_MODULE_RAIL } from '@/lib/navigation/mainmodulerail';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { glassFx, withAlpha } from '@/design/tokens/motion';
import { spacing } from '@/theme';
import type { MainModuleKey } from '@/types/navigation/platform';

type MainModuleRailProps = {
  activeModule: MainModuleKey;
};

const MODULE_RAIL_WIDTH = 88;
const MODULE_RAIL_LOGO_SIZE = 72;
const MODULE_RAIL_GAP = spacing.lg;

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
  return (
    <Pressable
      onPress={onPress}
      style={[styles.itemWrap, webCursor]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {active ? <View style={[styles.activeBar, { backgroundColor: accent }]} /> : null}
      <View
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
            shadowOpacity: active ? 0.6 : 0,
            shadowRadius: active ? 14 : 0,
            elevation: active ? 8 : 0,
          },
        ]}
      >
        <Text style={styles.iconText}>{icon}</Text>
      </View>
    </Pressable>
  );
}

/** Left icon rail — main modules only (no detail navigation). */
export function MainModuleRail({ activeModule }: MainModuleRailProps) {
  const router = useRouter();
  const { colors, isDark } = useLegacyTheme();
  const railStyles = useMemo(() => createRailStyles(isDark, colors), [isDark, colors]);

  return (
    <View style={railStyles.root}>
      <Image
        source={CARESUITE_ROBOT_LOGO}
        style={railStyles.brandLogo}
        resizeMode="contain"
        accessibilityLabel="CareSuite+ Logo"
      />
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
  itemWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  activeBar: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 4, borderRadius: 4 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 28 },
});

function createRailStyles(isDark: boolean, colors: ReturnType<typeof useLegacyTheme>['colors']) {
  const glassBorder = isDark ? glassFx.border : colors.borderSoft;

  return StyleSheet.create({
    root: {
      width: MODULE_RAIL_WIDTH,
      backgroundColor: isDark ? 'rgba(11,16,32,0.32)' : 'rgba(255,255,255,0.92)',
      borderRightWidth: 1,
      borderRightColor: glassBorder,
      alignItems: 'center',
      paddingVertical: MODULE_RAIL_GAP,
      gap: MODULE_RAIL_GAP,
    },
    brandLogo: {
      width: MODULE_RAIL_LOGO_SIZE,
      height: MODULE_RAIL_LOGO_SIZE,
      backgroundColor: 'transparent',
    },
    list: { flex: 1, alignSelf: 'stretch' },
    scroll: { alignItems: 'center', gap: MODULE_RAIL_GAP },
  });
}
