import { useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { PlatformProfileMenu } from '@/components/layout/platform/PlatformProfileMenu';
import {
  MOBILE_APP_BAR_HEIGHT,
} from '@/lib/platform/shellLayoutMetrics';
import {
  lightLiquidGlass,
  lightLiquidGlassWebFx,
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  auroraGlass,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type ShellAppBarProps = {
  title: string;
  subtitle?: string;
  accentColor?: string;
  onMenuPress: () => void;
  menuOpen?: boolean;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

/** Fixed top app bar for compact mobile/tablet shell — hamburger, title, profile. */
export function ShellAppBar({
  title,
  subtitle,
  accentColor,
  onMenuPress,
  menuOpen = false,
}: ShellAppBarProps) {
  const text = useAuroraAdaptiveText();
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const { isPhone } = useDeviceClass();
  const useLightBar = auroraActive && isLight;
  const subtitleColor = isPhone && useLightBar ? text.primary : text.muted;

  const barStyle = useMemo(() => {
    if (useLightBar) {
      return {
        backgroundColor: lightLiquidGlass.panel,
        borderBottomColor: lightLiquidGlass.borderAccent,
        ...lightLiquidGlassWebFx(lightLiquidGlass.blur.light),
      } as ViewStyle;
    }
    return {
      backgroundColor: auroraGlass.panel,
      borderBottomColor: auroraGlass.border,
    } as ViewStyle;
  }, [useLightBar]);

  return (
    <View style={[styles.root, barStyle]} testID="shell-app-bar">
      <Pressable
        onPress={onMenuPress}
        style={[styles.menuBtn, webCursor]}
        accessibilityRole="button"
        accessibilityLabel="Menü öffnen"
        accessibilityState={{ expanded: menuOpen }}
        testID="shell-hamburger"
      >
        <Text style={[styles.menuIcon, { color: text.primary }]}>☰</Text>
      </Pressable>

      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <PlatformProfileMenu accentColor={accentColor} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MOBILE_APP_BAR_HEIGHT,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: careSpacing.xs,
    borderBottomWidth: 1,
    zIndex: 20,
    flexShrink: 0,
  },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: careSpacing.xs,
    justifyContent: 'center',
  },
  title: {
    ...careTypography.body,
    fontWeight: '800',
    fontSize: 17,
  },
  subtitle: {
    ...careTypography.caption,
    fontWeight: '600',
  },
  actions: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
});
