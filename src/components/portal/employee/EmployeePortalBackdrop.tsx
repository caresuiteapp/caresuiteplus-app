import { useEffect, useState } from 'react';
import { Animated, AppState, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import { employeePortalDesign as c } from './employeePortalDesign';

const isWeb = Platform.OS === 'web';
const driftDuration = 10_000;
const webMotion = `
  @media (prefers-reduced-motion: no-preference) {
    [data-employee-portal-light-motion="on"] [data-employee-portal-light="blue"] {
      animation: employee-portal-light-drift ${driftDuration}ms ease-in-out -3800ms infinite alternate;
    }
    [data-employee-portal-light-motion="on"] [data-employee-portal-light="teal"] {
      animation: employee-portal-light-drift 14800ms ease-in-out -6400ms infinite alternate-reverse;
    }
  }
  @keyframes employee-portal-light-drift {
    from { transform: translate3d(-17%, -4%, 0); }
    to { transform: translate3d(17%, 4%, 0); }
  }
`;

const lightBands = [
  {
    name: 'blue', direction: 1,
    colors: ['rgba(91,173,245,0)', 'rgba(91,173,245,0.06)', 'rgba(91,173,245,0.24)', 'rgba(91,173,245,0.08)', 'rgba(91,173,245,0)'],
    locations: [0, 0.23, 0.48, 0.68, 1],
    start: { x: 0.05, y: 0.12 }, end: { x: 0.95, y: 0.88 },
  },
  {
    name: 'teal', direction: -1,
    colors: ['rgba(70,205,198,0)', 'rgba(70,205,198,0.035)', 'rgba(70,205,198,0.12)', 'rgba(70,205,198,0.04)', 'rgba(70,205,198,0)'],
    locations: [0, 0.3, 0.56, 0.73, 1],
    start: { x: 0.22, y: 0.04 }, end: { x: 0.78, y: 0.96 },
  },
] as const;

/** Continuous light bands sit behind the translucent chrome and scroll area. */
export function EmployeePortalBackdrop({ animated }: { animated: boolean }) {
  const reducedMotion = usePrefersReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const { width, height } = useWindowDimensions();
  const animateNative = !isWeb && animated && !reducedMotion;

  useEffect(() => {
    if (!animateNative) return;
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
  }, [animateNative, progress]);

  return (
    <View testID="employee-portal-backdrop" style={[StyleSheet.absoluteFill, styles.backdrop]} pointerEvents="none"
      aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      {...(isWeb ? { dataSet: { employeePortalLightMotion: animated ? 'on' : 'off' } } : {})}>
      <LinearGradient colors={['#14283C', '#13273C', c.canvas]} locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {isWeb ? <style>{webMotion}</style> : null}
      {lightBands.map(({ name, direction, colors, locations, start, end }) => (
        <Animated.View key={name}
          {...(isWeb ? { dataSet: { employeePortalLight: name } } : {})}
          style={[styles.band, animateNative && {
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.32 * direction, width * 0.32 * direction] }) },
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-height * 0.064 * direction, height * 0.064 * direction] }) },
            ],
          }]}>
          <LinearGradient colors={colors} locations={locations} start={start} end={end} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { overflow: 'hidden' },
  // The enlarged layers cover the viewport even at the ends of their travel.
  band: { position: 'absolute', top: '-30%', bottom: '-30%', left: '-45%', right: '-45%' },
});
