import { useEffect, useMemo, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  auroraGlass,
  lightLiquidGlass,
  lightLiquidGlassWebFx,
  useAuroraAdaptiveText,
  useAuroraGlassPanelStyle,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { withAlpha } from '@/design/tokens/motion';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';

const TAB_WIDTH = 40;
const DEFAULT_PANEL_WIDTH = 280;
const SPRING = { damping: 22, stiffness: 280 };

type GlassSlidePanelProps = {
  open: boolean;
  onToggle: () => void;
  /** Which edge the panel attaches to. Default right — slides in from the right. */
  side?: 'left' | 'right';
  /** Expanded panel width (px). */
  width?: number;
  children: ReactNode;
  toggleLabel?: string;
  accentColor?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

export function GlassSlidePanel({
  open,
  onToggle,
  side = 'right',
  width = DEFAULT_PANEL_WIDTH,
  children,
  toggleLabel = 'Filter',
  accentColor = '#1478FF',
}: GlassSlidePanelProps) {
  const text = useAuroraAdaptiveText();
  const auroraActive = useShellHostsAurora();
  const { isLight } = useLegacyTheme();
  const panelStyle = useAuroraGlassPanelStyle();

  const animatedWidth = useSharedValue(open ? width : TAB_WIDTH);

  useEffect(() => {
    animatedWidth.value = withSpring(open ? width : TAB_WIDTH, SPRING);
  }, [open, width, animatedWidth]);

  const hostStyle = useAnimatedStyle(() => ({
    width: animatedWidth.value,
  }));

  const surface = useMemo(() => {
    if (auroraActive && isLight) {
      return {
        backgroundColor: lightLiquidGlass.sidebar,
        borderColor: lightLiquidGlass.borderAccent,
        ...lightLiquidGlassWebFx(lightLiquidGlass.blur.medium),
      } as ViewStyle;
    }
    if (auroraActive) {
      return {
        backgroundColor: auroraGlass.panel,
        borderColor: auroraGlass.borderStrong,
      } as ViewStyle;
    }
    return {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderColor: withAlpha(accentColor, 0.35),
    } as ViewStyle;
  }, [accentColor, auroraActive, isLight]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        host: {
          flexShrink: 0,
          alignSelf: 'stretch',
          minHeight: 0,
          overflow: 'hidden',
          borderLeftWidth: side === 'right' ? 1 : 0,
          borderRightWidth: side === 'left' ? 1 : 0,
          borderLeftColor: withAlpha(accentColor, auroraActive ? 0.38 : 0.28),
          borderRightColor: withAlpha(accentColor, auroraActive ? 0.38 : 0.28),
          ...surface,
        },
        inner: {
          flex: 1,
          flexDirection: side === 'right' ? 'row' : 'row-reverse',
          minHeight: 0,
        },
        tab: {
          width: TAB_WIDTH,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: careSpacing.sm,
          gap: careSpacing.xs,
          borderRightWidth: side === 'right' ? 1 : 0,
          borderLeftWidth: side === 'left' ? 1 : 0,
          borderColor: withAlpha(accentColor, 0.22),
          backgroundColor: withAlpha(accentColor, auroraActive ? 0.08 : 0.05),
        },
        tabLabel: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.4,
          color: text.secondary,
          writingDirection: 'ltr',
          transform: [{ rotate: '-90deg' }],
          width: 72,
          textAlign: 'center',
        },
        chevron: {
          fontSize: 14,
          fontWeight: '700',
          color: accentColor,
        },
        content: {
          flex: 1,
          minWidth: 0,
          padding: careSpacing.md,
          gap: careSpacing.md,
          opacity: open ? 1 : 0,
        },
        innerBorder: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: careRadius.md,
          borderWidth: 1,
          borderColor: auroraActive
            ? isLight
              ? lightLiquidGlass.innerBorder
              : auroraGlass.innerBorder
            : 'rgba(255,255,255,0.12)',
          pointerEvents: 'none',
        },
      }),
    [accentColor, auroraActive, isLight, open, side, surface, text.secondary],
  );

  const chevron = open
    ? side === 'right'
      ? '›'
      : '‹'
    : side === 'right'
      ? '‹'
      : '›';

  return (
    <Animated.View style={[styles.host, hostStyle, panelStyle]}>
      <View style={styles.innerBorder} pointerEvents="none" />
      <View style={styles.inner}>
        <Pressable
          style={[styles.tab, webCursor]}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={open ? `${toggleLabel} schließen` : `${toggleLabel} öffnen`}
        >
          <Text style={styles.chevron}>{chevron}</Text>
          <Text style={styles.tabLabel} numberOfLines={1}>
            {toggleLabel}
          </Text>
        </Pressable>
        <View style={styles.content} pointerEvents={open ? 'auto' : 'none'}>
          {children}
        </View>
      </View>
    </Animated.View>
  );
}
