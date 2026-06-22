import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
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
import {
  lightSpaceNebulaFx,
  lightSpaceNebulaMotion,
  lightSpaceNebulaStarField,
  type LightSpaceNebulaOrb,
} from '@/design/tokens/lightSpaceNebula';
import { withAlpha } from '@/design/tokens/motion';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';

type LightSpaceNebulaBackgroundProps = {
  animated?: boolean;
  style?: ViewStyle;
  /** Leichte Abdunklung für Modals / dichte Formulare. */
  dimmed?: boolean;
};

const AnimatedView = Animated.createAnimatedComponent(View);

function driftDuration(orb: LightSpaceNebulaOrb): number {
  const span = lightSpaceNebulaMotion.driftMax - lightSpaceNebulaMotion.driftMin;
  return lightSpaceNebulaMotion.driftMin + (orb.delay % span);
}

function NebulaOrb({ orb, animate }: { orb: LightSpaceNebulaOrb; animate: boolean }) {
  const drift = useSharedValue(0);
  const breathe = useSharedValue(0.5);
  const duration = driftDuration(orb);

  useEffect(() => {
    if (!animate) {
      drift.value = 0.5;
      breathe.value = 0.65;
      return;
    }

    const half = duration / 2;
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

    const breatheHalf =
      (lightSpaceNebulaMotion.breatheMin +
        ((orb.delay * 3) % (lightSpaceNebulaMotion.breatheMax - lightSpaceNebulaMotion.breatheMin))) /
      2;

    breathe.value = withDelay(
      orb.delay / 2,
      withRepeat(
        withSequence(
          withTiming(1, { duration: breatheHalf, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.35, { duration: breatheHalf, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [animate, breathe, drift, duration, orb.delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: lightSpaceNebulaMotion.parallaxShift * 2 * (drift.value - 0.5) * orb.phase },
      { translateY: lightSpaceNebulaMotion.parallaxShift * (drift.value - 0.5) },
      { scale: 0.96 + breathe.value * 0.06 },
    ],
    opacity: 0.72 + breathe.value * 0.28,
  }));

  const webBlur =
    Platform.OS === 'web'
      ? ({
          filter: 'blur(72px)',
          WebkitFilter: 'blur(72px)',
        } as ViewStyle)
      : null;

  return (
    <AnimatedView
      style={[
        styles.orb,
        {
          top: orb.top,
          left: orb.left,
          right: orb.right,
          bottom: orb.bottom,
          width: orb.size,
          height: orb.size,
          borderRadius: orb.size / 2,
          backgroundColor: withAlpha(orb.color, orb.opacity),
        },
        webBlur,
        animatedStyle,
      ]}
      pointerEvents="none"
    />
  );
}

function NativeStarLayer({ animate }: { animate: boolean }) {
  const twinkle = useSharedValue(0.6);

  useEffect(() => {
    if (!animate) {
      twinkle.value = 0.55;
      return;
    }
    twinkle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [animate, twinkle]);

  const layerStyle = useAnimatedStyle(() => ({ opacity: 0.45 + twinkle.value * 0.35 }));

  return (
    <AnimatedView style={[StyleSheet.absoluteFillObject, layerStyle]} pointerEvents="none">
      {lightSpaceNebulaStarField.map(([x, y, intensity], index) => (
        <View
          key={`star-${index}`}
          style={[
            styles.star,
            {
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              opacity: intensity,
              backgroundColor:
                intensity > 0.48 ? lightSpaceNebulaFx.starColor : lightSpaceNebulaFx.starColorSoft,
            },
          ]}
        />
      ))}
    </AnimatedView>
  );
}

function WebStarCanvas({ animate }: { animate: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(parent.clientWidth * dpr);
      canvas.height = Math.floor(parent.clientHeight * dpr);
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const t = (Date.now() - startRef.current) / 1000;

      for (let i = 0; i < lightSpaceNebulaStarField.length; i += 1) {
        const [nx, ny, intensity] = lightSpaceNebulaStarField[i];
        const twinkle = animate
          ? 0.55 + 0.35 * Math.sin(t * 0.35 + i * 0.7)
          : 0.55 + intensity * 0.25;
        const alpha = intensity * twinkle * 1.05;
        const radius = intensity > 0.48 ? 1.35 : 0.95;
        ctx.beginPath();
        ctx.fillStyle =
          intensity > 0.48
            ? `rgba(124,157,255,${alpha.toFixed(3)})`
            : `rgba(99,211,255,${(alpha * 0.85).toFixed(3)})`;
        ctx.arc(nx * w, ny * h, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [animate]);

  if (Platform.OS !== 'web') return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      aria-hidden
    />
  );
}

function CenterCalmLayer() {
  const webRadial =
    Platform.OS === 'web'
      ? ({
          backgroundImage: `radial-gradient(ellipse 58% 52% at 50% 46%, ${lightSpaceNebulaFx.centerCalm} 0%, rgba(247,250,255,0.28) 48%, ${lightSpaceNebulaFx.centerCalmEdge} 78%)`,
        } as ViewStyle)
      : null;

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.centerCalmNative, webRadial]} pointerEvents="none">
      {Platform.OS !== 'web' ? (
        <View style={styles.centerCalmOrb} pointerEvents="none" />
      ) : null}
    </View>
  );
}

function EdgeGlowLayer() {
  return (
    <>
      <LinearGradient
        colors={['rgba(124,157,255,0.14)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.22, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(99,211,255,0.12)']}
        start={{ x: 0.78, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(182,156,255,0.11)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.18 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(168,230,255,0.10)']}
        start={{ x: 0.5, y: 0.82 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
    </>
  );
}

/**
 * Helle, futuristische Space-/Nebula-Atmosphäre für Liquid-Glass-Oberflächen.
 * Mount once unter dem gesamten UI (GlobalAnimatedBackground).
 */
export function LightSpaceNebulaBackground({
  animated = true,
  style,
  dimmed = false,
}: LightSpaceNebulaBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimate = animated && !prefersReducedMotion;

  const starLayer = useMemo(
    () =>
      Platform.OS === 'web' ? (
        <WebStarCanvas animate={shouldAnimate} />
      ) : (
        <NativeStarLayer animate={shouldAnimate} />
      ),
    [shouldAnimate],
  );

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.root, style]} pointerEvents="none">
      <LinearGradient colors={[...lightSpaceNebulaFx.base]} style={StyleSheet.absoluteFillObject} />
      {lightSpaceNebulaFx.orbs.map((orb, index) => (
        <NebulaOrb key={`${orb.color}-${index}`} orb={orb} animate={shouldAnimate} />
      ))}
      <LinearGradient
        colors={[...lightSpaceNebulaFx.mesh]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {starLayer}
      <EdgeGlowLayer />
      <CenterCalmLayer />
      {dimmed ? <View style={styles.dimOverlay} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: lightSpaceNebulaFx.base[0],
  },
  orb: {
    position: 'absolute',
  },
  star: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    marginLeft: -1,
    marginTop: -1,
  },
  centerCalmNative: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCalmOrb: {
    width: '78%',
    height: '68%',
    borderRadius: 999,
    backgroundColor: lightSpaceNebulaFx.centerCalm,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(247,250,255,0.35)',
  },
});
