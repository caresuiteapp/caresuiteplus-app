import { useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import { resolvePlatformShellSideInsets } from '@/lib/platform/shellLayoutMetrics';
import { spacing } from '@/theme';
import { VoiceWave } from './VoiceWave';
import type { AiStatus } from './aiToolTypes';

export type VoiceOrbProps = {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isToolLoading?: boolean;
  hasPending?: boolean;
  status?: AiStatus;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
};

export function VoiceOrbCore({
  isConnected,
  isListening,
  isSpeaking,
  isToolLoading = false,
  hasPending = false,
  status = 'ready',
  onPress,
  onLongPress,
  disabled = false,
  containerStyle,
}: VoiceOrbProps & { containerStyle?: ViewStyle }) {
  const { containerStyle: placementStyle } = useVoiceOrbPlacement();
  const pulse = useSharedValue(1);
  const orbit = useSharedValue(0);
  const errorGlow = useSharedValue(0);

  useEffect(() => {
    if (status === 'error') {
      errorGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0.35, { duration: 500 }),
        ),
        -1,
        true,
      );
      return;
    }
    errorGlow.value = withTiming(0, { duration: 200 });
  }, [errorGlow, status]);

  useEffect(() => {
    if (isToolLoading) {
      orbit.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1, false);
      pulse.value = withTiming(1.04, { duration: 250 });
      return;
    }

    if (isSpeaking) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.14, { duration: 280, easing: Easing.out(Easing.quad) }),
          withTiming(1.02, { duration: 280, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        true,
      );
      return;
    }

    if (isListening || isConnected) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      return;
    }

    if (hasPending) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 700 }),
          withTiming(1, { duration: 700 }),
        ),
        -1,
        true,
      );
      return;
    }

    pulse.value = withTiming(1, { duration: 250 });
  }, [hasPending, isConnected, isListening, isSpeaking, isToolLoading, orbit, pulse]);

  const animatedContainer = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + errorGlow.value * 0.55,
    transform: [{ rotate: `${orbit.value * 360}deg` }],
  }));

  const errorHaloStyle = useAnimatedStyle(() => ({
    opacity: status === 'error' ? 0.35 + errorGlow.value * 0.65 : 1,
  }));

  const longPressTriggered = useRef(false);

  return (
    <Animated.View
      style={[
        styles.container,
        placementStyle,
        containerStyle,
        animatedContainer,
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => {
          if (longPressTriggered.current) {
            longPressTriggered.current = false;
            return;
          }
          onPress();
        }}
        onLongPress={() => {
          longPressTriggered.current = true;
          onLongPress?.();
        }}
        delayLongPress={450}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="CareSuite+ KI"
        style={({ pressed }) => [
          styles.pressable,
          pressed && styles.pressablePressed,
          disabled && styles.pressableDisabled,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.stateHalo,
            styles.stateHaloReady,
            hasPending && styles.stateHaloPending,
            status === 'error' && styles.stateHaloError,
            status === 'error' && errorHaloStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.orbitRing,
            glowStyle,
            isToolLoading && styles.orbitActive,
            status === 'error' && styles.orbitError,
            hasPending && styles.orbitPending,
          ]}
        />
        <View style={[styles.core, isSpeaking && styles.coreSpeaking, isListening && styles.coreListening]} />
        {isSpeaking ? (
          <View style={styles.waveWrap}>
            <VoiceWave active />
          </View>
        ) : null}
      </Pressable>
      <Text style={styles.label}>CareSuite+ KI</Text>
    </Animated.View>
  );
}

const webOrbGlow = Platform.OS === 'web'
  ? ({ boxShadow: '0 0 24px rgba(255,255,255,0.72)' } as ViewStyle)
  : ({
      shadowColor: '#FFFFFF',
      shadowOpacity: 0.75,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 0 },
    } as ViewStyle);

const webCoreGlow = Platform.OS === 'web'
  ? ({ boxShadow: '0 0 18px rgba(255,255,255,0.95)' } as ViewStyle)
  : ({
      shadowColor: '#FFFFFF',
      shadowOpacity: 1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 },
    } as ViewStyle);

const webPendingGlow = Platform.OS === 'web'
  ? ({ boxShadow: '0 0 18px rgba(255,213,79,0.55)' } as ViewStyle)
  : ({
      shadowColor: '#FFD54F',
      shadowOpacity: 0.55,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 },
    } as ViewStyle);

const webErrorGlow = Platform.OS === 'web'
  ? ({ boxShadow: '0 0 20px rgba(255,90,90,0.65)' } as ViewStyle)
  : ({
      shadowColor: '#FF5A5A',
      shadowOpacity: 0.65,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 0 },
    } as ViewStyle);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 200,
    alignItems: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  pressable: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: 'transparent',
    overflow: 'visible',
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', outlineStyle: 'none' } as ViewStyle)
      : null),
  },
  stateHalo: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'transparent',
  },
  stateHaloReady: webOrbGlow,
  stateHaloPending: webPendingGlow,
  stateHaloError: webErrorGlow,
  pressablePressed: {
    opacity: 0.92,
  },
  pressableDisabled: {
    opacity: 0.55,
  },
  orbitRing: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderTopColor: 'rgba(255,255,255,0.75)',
  },
  orbitActive: {
    borderTopColor: 'rgba(255, 180, 80, 0.95)',
  },
  orbitPending: {
    borderTopColor: 'rgba(255, 210, 80, 0.95)',
  },
  orbitError: {
    borderTopColor: 'rgba(255, 90, 90, 0.95)',
  },
  core: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...webCoreGlow,
  },
  coreListening: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  coreSpeaking: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  waveWrap: {
    position: 'absolute',
    bottom: 8,
  },
  label: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export function useVoiceOrbPlacement() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const isMobile = width < 768 || Platform.OS !== 'web';

  const containerStyle = useMemo((): ViewStyle => {
    const hasBottomNav = isMobile && pathname.startsWith('/portal');
    const bottomNavOffset = hasBottomNav ? PORTAL_MOBILE_NAV_HEIGHT + careSpacing.sm : 0;

    const shellLeftInset =
      Platform.OS === 'web' && !isMobile
        ? resolvePlatformShellSideInsets(width, resolveMainModuleFromPath(pathname)).left
        : 0;

    return {
      ...(Platform.OS === 'web' ? ({ position: 'fixed' } as ViewStyle) : null),
      left: shellLeftInset + spacing.lg + Math.max(insets.left, 0),
      bottom: spacing.lg + Math.max(insets.bottom, 0) + bottomNavOffset,
    };
  }, [insets.bottom, insets.left, isMobile, pathname, width]);

  return { isMobile, containerStyle };
}
