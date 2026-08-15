import { useEffect } from 'react';
import { Image, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import {
  CARESUITE_LOADER_STYLE_ID,
  careSuiteLoaderAnimationCss,
} from './careSuiteLoaderStyles';

const HEALTHOS_LOGO = require('../../../assets/brand/caresuite-healthos-logo.png');

type CareSuiteLoadingIndicatorProps = {
  width?: number;
};

function ensureWebLoaderStyles() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(CARESUITE_LOADER_STYLE_ID)) return;

  const tag = document.createElement('style');
  tag.id = CARESUITE_LOADER_STYLE_ID;
  tag.textContent = careSuiteLoaderAnimationCss;
  document.head.appendChild(tag);
}

function loaderMetrics(width: number) {
  const logoWidth = Math.round(width * 0.88);
  return {
    logoWidth,
    logoHeight: Math.round(logoWidth / 8),
    orbitWidth: Math.round(width * 0.96),
    orbitHeight: Math.round(width * 0.34),
    stageHeight: Math.round(width * 0.39),
    particleSize: Math.max(7, Math.round(width * 0.032)),
  };
}

function WebCareSuiteLoadingIndicator({ width }: { width: number }) {
  useEffect(() => {
    ensureWebLoaderStyles();
  }, []);

  const reducedMotion = usePrefersReducedMotion();
  const metrics = loaderMetrics(width);
  const orbitAnimation = reducedMotion
    ? null
    : ({
        animationName: 'caresuite-healthos-orbit',
        animationDuration: '2.6s',
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
      } as ViewStyle);

  return (
    <View
      accessibilityLabel="CareSuite HealthOS wird geladen"
      accessibilityRole="progressbar"
      style={[styles.stage, { width, height: metrics.stageHeight }]}
    >
      <View
        style={[
          styles.webOrbitGlow,
          { width: metrics.orbitWidth, height: metrics.orbitHeight },
          orbitAnimation,
        ]}
      >
        <View
          style={[
            styles.particle,
            {
              width: metrics.particleSize,
              height: metrics.particleSize,
              borderRadius: metrics.particleSize / 2,
              right: Math.round(metrics.orbitWidth * 0.06),
              top: Math.round(metrics.orbitHeight * 0.2),
            },
          ]}
        />
      </View>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={HEALTHOS_LOGO}
        style={{ width: metrics.logoWidth, height: metrics.logoHeight }}
      />
    </View>
  );
}

function NativeCareSuiteLoadingIndicator({ width }: { width: number }) {
  const reducedMotion = usePrefersReducedMotion();
  const metrics = loaderMetrics(width);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      rotation.value = 0;
      return;
    }
    rotation.value = withRepeat(
      withTiming(360, { duration: 2600, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reducedMotion, rotation]);

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View
      accessibilityLabel="CareSuite HealthOS wird geladen"
      accessibilityRole="progressbar"
      style={[styles.stage, { width, height: metrics.stageHeight }]}
    >
      <Animated.View
        style={[
          styles.nativeOrbit,
          { width: metrics.orbitWidth, height: metrics.orbitHeight },
          orbitStyle,
        ]}
      >
        <View
          style={[
            styles.particle,
            {
              width: metrics.particleSize,
              height: metrics.particleSize,
              borderRadius: metrics.particleSize / 2,
              right: Math.round(metrics.orbitWidth * 0.06),
              top: Math.round(metrics.orbitHeight * 0.2),
            },
          ]}
        />
      </Animated.View>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={HEALTHOS_LOGO}
        style={{ width: metrics.logoWidth, height: metrics.logoHeight }}
      />
    </View>
  );
}

export function CareSuiteLoadingIndicator({ width = 420 }: CareSuiteLoadingIndicatorProps) {
  if (Platform.OS === 'web') {
    return <WebCareSuiteLoadingIndicator width={width} />;
  }
  return <NativeCareSuiteLoadingIndicator width={width} />;
}

const styles = StyleSheet.create({
  stage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  webOrbitGlow: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderTopColor: '#55D8FF',
    borderRightColor: '#2C8DFF',
    borderBottomColor: '#8B7CFF',
    borderLeftColor: 'rgba(139, 124, 255, 0.2)',
    shadowColor: '#55D8FF',
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  nativeOrbit: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderTopColor: '#55D8FF',
    borderRightColor: '#2C8DFF',
    borderBottomColor: '#8B7CFF',
    borderLeftColor: 'rgba(139, 124, 255, 0.2)',
    shadowColor: '#55D8FF',
    shadowOpacity: 0.72,
    shadowRadius: 10,
    elevation: 7,
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#F4FAFF',
    borderWidth: 2,
    borderColor: '#55D8FF',
    shadowColor: '#55D8FF',
    shadowOpacity: 1,
    shadowRadius: 9,
    elevation: 8,
  },
});
