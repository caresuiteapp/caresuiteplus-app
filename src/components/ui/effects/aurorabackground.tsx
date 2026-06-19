import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { auroraFx, fxMotion, withAlpha } from '@/design/tokens/motion';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';

type AuroraBackgroundProps = {
  animated?: boolean;
  style?: ViewStyle;
};

type OrbConfig = (typeof auroraFx.orbs)[number];

const AnimatedView = Animated.createAnimatedComponent(View);

function AuroraOrb({ orb, animate }: { orb: OrbConfig; animate: boolean }) {
  const drift = useSharedValue(0);
  const phase = orb.delay % 2 === 0 ? 1 : -1;

  useEffect(() => {
    if (!animate) {
      drift.value = 0;
      return;
    }

    const half = (fxMotion.drift + orb.delay) / 2;
    drift.value = withDelay(
      orb.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: half, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: half, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [animate, drift, orb.delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: 22 * drift.value * phase },
      { translateY: 14 * drift.value },
    ],
    opacity: 0.82 + 0.18 * drift.value,
  }));

  return (
    <AnimatedView
      style={[
        styles.orb,
        {
          top: orb.top,
          left: orb.left,
          width: orb.size,
          height: orb.size,
          borderRadius: orb.size / 2,
          backgroundColor: withAlpha(orb.color, Math.min(orb.opacity, 0.38)),
        },
        animatedStyle,
      ]}
    />
  );
}

/** Animated deep-space aurora — shared by AppScreen landing/auth and PlatformShell. */
export function AuroraBackground({ animated = true, style }: AuroraBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimate = animated && !prefersReducedMotion;

  return (
    <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="none">
      <LinearGradient colors={[...auroraFx.base]} style={StyleSheet.absoluteFillObject} />
      {auroraFx.orbs.map((orb, index) => (
        <AuroraOrb key={`${orb.color}-${index}`} orb={orb} animate={shouldAnimate} />
      ))}
      <LinearGradient
        colors={[...auroraFx.mesh]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={[StyleSheet.absoluteFillObject, styles.vignette]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
  },
  vignette: {
    backgroundColor: auroraFx.vignette,
  },
});
