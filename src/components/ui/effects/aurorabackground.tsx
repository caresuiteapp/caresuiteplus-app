import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { fxMotion } from '@/design/tokens/motion';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';

type AuroraBackgroundProps = {
  animated?: boolean;
  style?: ViewStyle;
};

const AnimatedView = Animated.createAnimatedComponent(View);

export function AuroraBackground({ animated = true, style }: AuroraBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimate = animated && !prefersReducedMotion;

  const cyanDrift = useSharedValue(0);
  const violetDrift = useSharedValue(0);

  useEffect(() => {
    if (!shouldAnimate) {
      cyanDrift.value = 0;
      violetDrift.value = 0;
      return;
    }

    cyanDrift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: fxMotion.drift, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: fxMotion.drift, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    violetDrift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: fxMotion.drift * 1.15, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: fxMotion.drift * 1.15, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [cyanDrift, shouldAnimate, violetDrift]);

  const cyanStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: 18 * cyanDrift.value },
      { translateY: 12 * cyanDrift.value },
    ],
    opacity: 0.85 + 0.15 * cyanDrift.value,
  }));

  const violetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -14 * violetDrift.value },
      { translateY: -10 * violetDrift.value },
    ],
    opacity: 0.8 + 0.2 * violetDrift.value,
  }));

  return (
    <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="none">
      <LinearGradient
        colors={['#0B1024', '#080D1A', '#050816']}
        style={StyleSheet.absoluteFillObject}
      />
      <AnimatedView style={[styles.glowCyan, cyanStyle]} />
      <AnimatedView style={[styles.glowViolet, violetStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  glowCyan: {
    position: 'absolute',
    top: '8%',
    left: '-10%',
    width: '50%',
    height: '35%',
    borderRadius: 999,
    backgroundColor: 'rgba(6,182,212,0.12)',
  },
  glowViolet: {
    position: 'absolute',
    bottom: '10%',
    right: '-8%',
    width: '45%',
    height: '30%',
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.10)',
  },
});
