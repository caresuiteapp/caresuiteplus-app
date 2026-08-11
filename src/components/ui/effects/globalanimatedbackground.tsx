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
          duration: 24000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 24000,
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
        { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-12, 18] }) },
        { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [8, -12] }) },
        { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) },
      ],
    }),
    [drift],
  );

  const counterMotionStyle = useMemo(
    () => ({
      opacity: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.42, 0.7, 0.48] }),
      transform: [
        { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [16, -14] }) },
        { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [-6, 10] }) },
      ],
    }),
    [drift],
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#FFFFFF', '#F8FBFF', '#F2F8FE', '#F7FBFF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.ambientField, motionStyle]}>
        <LinearGradient
          colors={['rgba(37,99,235,0)', 'rgba(37,99,235,0.055)', 'rgba(14,165,233,0.075)', 'rgba(37,99,235,0)']}
          locations={[0, 0.34, 0.68, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.lightStreamPrimary}
        />
        <View style={styles.orbitArcPrimary} />
        <View style={styles.orbitArcSecondary} />
        <View style={[styles.signalNode, styles.signalNodeOne]}>
          <View style={styles.signalCore} />
        </View>
        <View style={[styles.signalNode, styles.signalNodeTwo]}>
          <View style={styles.signalCore} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.counterField, counterMotionStyle]}>
        <LinearGradient
          colors={['rgba(14,165,233,0)', 'rgba(14,165,233,0.05)', 'rgba(59,130,246,0.06)', 'rgba(14,165,233,0)']}
          locations={[0, 0.38, 0.66, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.lightStreamSecondary}
        />
        <View style={[styles.signalNode, styles.signalNodeThree]}>
          <View style={styles.signalCore} />
        </View>
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
  ambientField: { ...StyleSheet.absoluteFillObject },
  counterField: { ...StyleSheet.absoluteFillObject },
  lightStreamPrimary: {
    position: 'absolute',
    width: 1180,
    height: 150,
    right: -160,
    top: '24%',
    borderRadius: 999,
    transform: [{ rotate: '-9deg' }],
  },
  lightStreamSecondary: {
    position: 'absolute',
    width: 900,
    height: 110,
    left: -170,
    bottom: '15%',
    borderRadius: 999,
    transform: [{ rotate: '11deg' }],
  },
  orbitArcPrimary: {
    position: 'absolute',
    width: 980,
    height: 250,
    right: -270,
    top: '10%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.09)',
    transform: [{ rotate: '-12deg' }],
  },
  orbitArcSecondary: {
    position: 'absolute',
    width: 720,
    height: 190,
    left: -190,
    bottom: '7%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.08)',
    transform: [{ rotate: '10deg' }],
  },
  signalNode: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.14)',
  },
  signalCore: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.42)',
  },
  signalNodeOne: {
    right: '24%',
    top: '28%',
  },
  signalNodeTwo: {
    left: '31%',
    bottom: '22%',
  },
  signalNodeThree: {
    left: '62%',
    top: '58%',
  },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,35,63,0.16)' },
});
