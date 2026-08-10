import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { SpatialCareBackground } from '@/components/backgrounds';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';

type GlobalAnimatedBackgroundProps = {
  mode?: 'light' | 'dark';
  animated?: boolean;
  style?: ViewStyle;
  children?: ReactNode;
  dimmed?: boolean;
};

function OrbitLightBackground({ animated, dimmed }: { animated: boolean; dimmed: boolean }) {
  const reduceMotion = usePrefersReducedMotion();
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated || reduceMotion) {
      drift.stopAnimation();
      drift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 18000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 18000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, drift, reduceMotion]);

  const motionStyle = useMemo(
    () => ({
      transform: [
        { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-28, 34] }) },
        { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [18, -24] }) },
        { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
      ],
    }),
    [drift],
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#FFFFFF', '#F5FAFF', '#EEF7FF', '#F7F3FF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.orbitField, motionStyle]}>
        <View style={[styles.orb, styles.orbBlue]} />
        <View style={[styles.orb, styles.orbViolet]} />
        <View style={[styles.orb, styles.orbCyan]} />
        <View style={styles.orbitLineLarge} />
        <View style={styles.orbitLineSmall} />
      </Animated.View>
      {dimmed ? <View style={styles.dim} /> : null}
    </View>
  );
}

export function GlobalAnimatedBackground({
  mode: _modeOverride,
  animated = true,
  style,
  children,
  dimmed = false,
}: GlobalAnimatedBackgroundProps) {
  const pathname = usePathname();
  const portalRoute = pathname.startsWith('/portal/');

  return (
    <View style={[styles.root, style]} pointerEvents="none">
      {portalRoute ? (
        <SpatialCareBackground dimmed={dimmed} />
      ) : (
        <OrbitLightBackground animated={animated} dimmed={dimmed} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  orbitField: { ...StyleSheet.absoluteFillObject },
  orb: { position: 'absolute', borderRadius: 999 },
  orbBlue: {
    width: 520,
    height: 520,
    right: -150,
    top: -210,
    backgroundColor: 'rgba(22,131,255,0.12)',
  },
  orbViolet: {
    width: 440,
    height: 440,
    left: -180,
    bottom: -190,
    backgroundColor: 'rgba(155,124,246,0.10)',
  },
  orbCyan: {
    width: 320,
    height: 320,
    left: '38%',
    top: '32%',
    backgroundColor: 'rgba(85,221,246,0.08)',
  },
  orbitLineLarge: {
    position: 'absolute',
    width: 760,
    height: 270,
    right: -220,
    top: 110,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(22,131,255,0.10)',
    transform: [{ rotate: '-18deg' }],
  },
  orbitLineSmall: {
    position: 'absolute',
    width: 420,
    height: 150,
    left: -100,
    bottom: 80,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(155,124,246,0.12)',
    transform: [{ rotate: '14deg' }],
  },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,35,63,0.16)' },
});
