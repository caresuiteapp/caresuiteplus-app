import { useEffect, useState } from 'react';
import { Animated, AppState, Easing, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import { employeePortalDesign as c } from './employeePortalDesign';

const isWeb = Platform.OS === 'web';
const driftDuration = 18_000;
const webMotion = `
  @media (prefers-reduced-motion: no-preference) {
    [data-employee-portal-reflections="moving"] {
      animation: employee-portal-reflections ${driftDuration}ms ease-in-out infinite alternate;
    }
    [data-employee-portal-specks="moving"] {
      animation: employee-portal-specks 9000ms ease-in-out infinite alternate;
    }
  }
  @keyframes employee-portal-reflections {
    from { transform: translate3d(0, 0, 0); opacity: .82; }
    to { transform: translate3d(42px, -24px, 0); opacity: 1; }
  }
  @keyframes employee-portal-specks {
    from { opacity: .36; }
    to { opacity: .85; }
  }
`;

const specks = [
  [107, 130, 1.4], [318, 282, 1.9], [590, 168, 1.5], [858, 144, 1.6],
  [487, 518, 1.5], [942, 410, 1.7], [172, 622, 1.6], [735, 665, 1.8],
] as const;

/** One decorative layer stays behind the shared portal chrome and scroll area. */
export function EmployeePortalBackdrop({ animated }: { animated: boolean }) {
  const reducedMotion = usePrefersReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isWeb || !animated || reducedMotion) return;
    const move = (toValue: number) => Animated.timing(progress, {
      toValue, duration: driftDuration, easing: Easing.inOut(Easing.sin),
      useNativeDriver: true, isInteraction: false,
    });
    const loop = Animated.loop(Animated.sequence([move(1), move(0)]));
    let running = false;
    const sync = (state: string) => {
      const active = state === 'active';
      if (active === running) return;
      running = active;
      if (active) {
        loop.reset();
        loop.start();
      } else {
        loop.stop();
      }
    };
    sync(AppState.currentState);
    const subscription = AppState.addEventListener('change', sync);
    return () => {
      subscription.remove();
      loop.stop();
      progress.setValue(0);
    };
  }, [animated, progress, reducedMotion]);

  const movement = animated ? 'moving' : 'still';
  return (
    <View testID="employee-portal-backdrop" style={[StyleSheet.absoluteFill, styles.backdrop]} pointerEvents="none"
      aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LinearGradient colors={['#233B52', '#1A3148', c.canvas]} locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {isWeb ? <style>{webMotion}</style> : null}
      <Animated.View
        {...(isWeb ? { dataSet: { employeePortalReflections: movement } } : {})}
        style={[styles.reflections, !isWeb && {
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 42] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) },
          ],
        }]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 1000 760" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="employeePortalCoolReflection">
              <Stop offset="0" stopColor="#86CBEE" stopOpacity={0.13} />
              <Stop offset="1" stopColor="#86CBEE" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="employeePortalSoftReflection">
              <Stop offset="0" stopColor="#B8C0E9" stopOpacity={0.075} />
              <Stop offset="1" stopColor="#B8C0E9" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={200} cy={190} rx={455} ry={350} fill="url(#employeePortalCoolReflection)" />
          <Ellipse cx={835} cy={480} rx={390} ry={290} fill="url(#employeePortalSoftReflection)" />
        </Svg>
      </Animated.View>
      <Animated.View
        {...(isWeb ? { dataSet: { employeePortalSpecks: movement } } : {})}
        style={[StyleSheet.absoluteFill, styles.specks, !isWeb && {
          opacity: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.36, 0.85, 0.48] }),
        }]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 1000 760" preserveAspectRatio="none">
          {specks.map(([x, y, radius]) => (
            <Circle key={x} cx={x} cy={y} r={radius} fill="#B6DCFA" opacity={0.32} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { overflow: 'hidden' },
  reflections: { position: 'absolute', top: -30, bottom: -30, left: -48, right: -48, opacity: 0.82 },
  specks: { opacity: 0.36 },
});
