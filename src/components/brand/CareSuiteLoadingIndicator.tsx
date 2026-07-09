import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import {
  CARESUITE_LOADER_DOT_COLORS,
  CARESUITE_LOADER_GRADIENT,
  CARESUITE_LOADER_STYLE_ID,
  careSuiteLoaderAnimationCss,
} from './careSuiteLoaderStyles';

const LABEL = 'CareSuite+';

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

function WebCareSuiteLoadingIndicator({ width }: { width: number }) {
  useEffect(() => {
    ensureWebLoaderStyles();
  }, []);

  const reducedMotion = usePrefersReducedMotion();
  const fontSize = Math.round(width * 0.095);
  const dotSize = Math.max(5, Math.round(width * 0.014));
  const dotGap = Math.max(8, Math.round(width * 0.024));
  const dotsTop = Math.round(width * 0.1);

  const textStyle = {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize,
    fontWeight: '600' as const,
    letterSpacing: -0.02 * fontSize,
    lineHeight: Math.round(fontSize * 1.15),
    textAlign: 'center' as const,
    backgroundImage: CARESUITE_LOADER_GRADIENT,
    backgroundSize: '200% auto',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
    ...(reducedMotion
      ? {}
      : {
          animationName: 'caresuite-loader-gradient-flow',
          animationDuration: '2.8s',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
        }),
  } as TextStyle;

  const wrapStyle: ViewStyle = {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    ...(reducedMotion
      ? {}
      : ({
          animationName: 'caresuite-loader-breathe',
          animationDuration: '2.8s',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
          filter: 'drop-shadow(0 0 10px rgba(100, 150, 255, 0.18))',
        } as ViewStyle)),
  };

  const textWrapStyle: ViewStyle = {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  };

  const shimmerStyle: ViewStyle = {
    position: 'absolute',
    top: '8%',
    left: '50%',
    width: '28%',
    height: '84%',
    marginLeft: '-14%',
    borderRadius: 999,
    backgroundImage:
      'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 48%, transparent 100%)',
    pointerEvents: 'none',
    ...(reducedMotion
      ? { opacity: 0 }
      : ({
          animationName: 'caresuite-loader-shimmer',
          animationDuration: '2.8s',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
        } as ViewStyle)),
  };

  return (
    <View style={wrapStyle} accessibilityLabel="CareSuite+ wird geladen">
      <View style={textWrapStyle}>
        <Text style={textStyle}>{LABEL}</Text>
        <View style={shimmerStyle} />
      </View>
      <View style={[styles.dotsRow, { marginTop: dotsTop, gap: dotGap }]}>
        {CARESUITE_LOADER_DOT_COLORS.map((color, index) => (
          <View
            key={color}
            style={[
              styles.dot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: color,
              },
              reducedMotion
                ? null
                : ({
                    animationName: 'caresuite-loader-dot',
                    animationDuration: '2.8s',
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDelay: `${index * 0.35}s`,
                  } as ViewStyle),
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function NativeCareSuiteLoadingIndicator({ width }: { width: number }) {
  const reducedMotion = usePrefersReducedMotion();
  const fontSize = Math.round(width * 0.095);
  const dotSize = Math.max(5, Math.round(width * 0.014));
  const dotGap = Math.max(8, Math.round(width * 0.024));
  const dotsTop = Math.round(width * 0.1);
  const breathe = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.012, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [breathe, reducedMotion]);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  return (
    <Animated.View
      style={[styles.nativeWrap, { width }, breatheStyle]}
      accessibilityLabel="CareSuite+ wird geladen"
    >
      <Text
        style={[
          styles.nativeText,
          {
            fontSize,
            lineHeight: Math.round(fontSize * 1.15),
            letterSpacing: -0.02 * fontSize,
          },
        ]}
      >
        {LABEL}
      </Text>
      <View style={[styles.dotsRow, { marginTop: dotsTop, gap: dotGap }]}>
        {CARESUITE_LOADER_DOT_COLORS.map((color, index) => (
          <NativeLoaderDot
            key={color}
            color={color}
            size={dotSize}
            index={index}
            reducedMotion={reducedMotion}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function NativeLoaderDot({
  color,
  size,
  index,
  reducedMotion,
}: {
  color: string;
  size: number;
  index: number;
  reducedMotion: boolean;
}) {
  const pulse = useSharedValue(0.32);

  useEffect(() => {
    if (reducedMotion) return;
    const delay = index * 350;
    const timer = setTimeout(() => {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.32, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [index, pulse, reducedMotion]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.88 + pulse.value * 0.2 }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        dotStyle,
      ]}
    />
  );
}

export function CareSuiteLoadingIndicator({ width = 420 }: CareSuiteLoadingIndicatorProps) {
  if (Platform.OS === 'web') {
    return <WebCareSuiteLoadingIndicator width={width} />;
  }
  return <NativeCareSuiteLoadingIndicator width={width} />;
}

const styles = StyleSheet.create({
  nativeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  nativeText: {
    fontWeight: '600',
    textAlign: 'center',
    color: '#8AAEFF',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    backgroundColor: '#6E88FF',
  },
});
