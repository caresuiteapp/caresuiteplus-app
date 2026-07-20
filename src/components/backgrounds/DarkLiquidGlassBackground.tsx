import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SYSTEM_LIQUID_GRADIENT, systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';

type Props = {
  animated?: boolean;
  dimmed?: boolean;
};

const BODY_STYLE_ID = 'caresuite-system-liquid-glass-root';

function ensureWebRoot() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(BODY_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BODY_STYLE_ID;
  style.textContent = `
    html, body, #root, #expo-root, [data-expo-root] {
      background: ${systemLiquidGlass.pageDeep} !important;
      background-color: ${systemLiquidGlass.pageDeep} !important;
      color: ${systemLiquidGlass.text.primary};
      color-scheme: dark;
    }
    * { box-sizing: border-box; }
    ::selection { background: rgba(20,120,255,.42); color: #F8FBFF; }
    :focus-visible { outline: 2px solid #1478FF !important; outline-offset: 2px; }
  `;
  document.head.appendChild(style);
}

export function DarkLiquidGlassBackground({ animated = true, dimmed = false }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    ensureWebRoot();
    if (!animated || reducedMotion) {
      drift.setValue(0.35);
      return undefined;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 18_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 18_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [animated, drift, reducedMotion]);

  const orbOne = {
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-28, 44] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 32] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.08] }) },
    ],
  };
  const orbTwo = {
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [36, -24] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [24, -30] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.06, 0.94] }) },
    ],
  };

  return (
    <View style={styles.root} pointerEvents="none" testID="system-liquid-glass-background">
      <LinearGradient
        colors={[...SYSTEM_LIQUID_GRADIENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.orb, styles.orbOne, orbOne]} />
      <Animated.View style={[styles.orb, styles.orbTwo, orbTwo]} />
      <View style={styles.grid} />
      <LinearGradient
        colors={['rgba(3,10,24,0)', dimmed ? 'rgba(3,10,24,0.58)' : 'rgba(3,10,24,0.22)']}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const webGrid: ViewStyle = Platform.OS === 'web'
  ? ({
      backgroundImage:
        'linear-gradient(rgba(248,251,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(248,251,255,.025) 1px, transparent 1px)',
      backgroundSize: '48px 48px',
      maskImage: 'linear-gradient(to bottom, rgba(0,0,0,.5), transparent 82%)',
    } as unknown as ViewStyle)
  : {};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: systemLiquidGlass.pageDeep,
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: systemLiquidGlass.glow.medium,
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(90px)' } as unknown as ViewStyle)
      : { opacity: 0.52 }),
  },
  orbOne: { width: 520, height: 520, top: -210, right: -100 },
  orbTwo: { width: 430, height: 430, left: -180, bottom: -170, opacity: 0.55 },
  grid: { ...StyleSheet.absoluteFillObject, ...webGrid },
});
