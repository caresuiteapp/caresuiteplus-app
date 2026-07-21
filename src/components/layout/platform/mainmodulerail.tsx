import { useMemo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CARESUITE_ROBOT_LOGO } from '@/components/brand/brandassets';
import {
  MAIN_MODULE_RAIL,
  getVisibleMainModuleRailItems,
} from '@/lib/navigation/mainmodulerail';
import { useMainModuleAccent } from '@/hooks/useMainModuleAccent';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { usePermissions } from '@/hooks/usePermissions';
import { useTenantModuleSettings } from '@/hooks/useTenantModuleSettings';
import {
  PLATFORM_MODULE_RAIL_LOGO_SIZE,
  PLATFORM_MODULE_RAIL_WIDTH,
  PLATFORM_SHELL_HEADER_TOP_INSET,
} from '@/lib/platform/shellLayoutMetrics';
import { lightLiquidGlassWebFx } from '@/design/tokens/auroraGlass';
import { resolveLlganGlassSurface } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import type { MainModuleKey } from '@/types/navigation/platform';
import { SpaceModuleIcon } from '@/components/icons/space';
import { ModuleRailFontSizeControl } from './ModuleRailFontSizeControl';
import { NotificationBellWithCenter } from '@/components/notifications/notificationcenter';
import { spatialCare } from '@/design/tokens/spatialCareSuite';

type MainModuleRailProps = {
  activeModule: MainModuleKey;
};

const MODULE_RAIL_GAP = PLATFORM_SHELL_HEADER_TOP_INSET;

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function RailItem({
  active,
  accent,
  moduleKey,
  label,
  onPress,
}: {
  active: boolean;
  accent: string;
  moduleKey: MainModuleKey;
  label: string;
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
      <SpaceModuleIcon
        moduleKey={moduleKey}
        accentColor={accent}
        active={active}
        size={48}
        frame="rail"
      />
    </Pressable>
  );
}

/** Left icon rail — main modules only (no detail navigation). */
export function MainModuleRail({ activeModule }: MainModuleRailProps) {
  const router = useRouter();
  const moduleAccent = useMainModuleAccent();
  const { tenantId } = useModuleAccess();
  const { roleKey } = usePermissions();
  const { modules: tenantModules } = useTenantModuleSettings();
  const visibleModules = useMemo(() => {
    if (!tenantId) {
      return MAIN_MODULE_RAIL.filter(
        (module) => module.key === 'zentrale' || module.key === 'admin',
      );
    }
    return getVisibleMainModuleRailItems({ tenantId, roleKey, tenantModules });
  }, [tenantId, roleKey, tenantModules]);
  const railStyles = useMemo(
    () => createRailStyles(moduleAccent),
    [moduleAccent],
  );

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
        {visibleModules.map((module) => (
          <RailItem
            key={module.key}
            active={activeModule === module.key}
            accent={module.accentColor}
            moduleKey={module.key}
            label={module.label}
            onPress={() => router.push(module.path as never)}
          />
        ))}
      </ScrollView>
      <View style={railStyles.footer}>
        {Platform.OS === 'web' ? (
          <NotificationBellWithCenter size="rail" variant="glass" />
        ) : null}
        <ModuleRailFontSizeControl />
      </View>
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
});

function createRailStyles(moduleAccent: string) {
  const railSurface = resolveLlganGlassSurface('default');

  return StyleSheet.create({
    root: {
      width: PLATFORM_MODULE_RAIL_WIDTH,
      flexGrow: 0,
      flexShrink: 0,
      alignSelf: 'stretch',
      backgroundColor: spatialCare.navigationStrong,
      ...(lightLiquidGlassWebFx(railSurface.blurDesktop, railSurface.saturate)),
      borderRightWidth: 1,
      borderRightColor: spatialCare.borderGlow,
      alignItems: 'center',
      paddingVertical: MODULE_RAIL_GAP,
      gap: MODULE_RAIL_GAP,
    },
    brandLogo: {
      width: PLATFORM_MODULE_RAIL_LOGO_SIZE,
      height: PLATFORM_MODULE_RAIL_LOGO_SIZE,
      backgroundColor: 'transparent',
    },
    list: { flex: 1, alignSelf: 'stretch', minHeight: 0 },
    scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: MODULE_RAIL_GAP },
    footer: {
      alignItems: 'center',
      gap: MODULE_RAIL_GAP,
    },
  });
}
