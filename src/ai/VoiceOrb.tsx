import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type VoiceOrbProps = {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function VoiceOrb({
  isConnected,
  isListening,
  isSpeaking,
  onPress,
  disabled = false,
}: VoiceOrbProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768 || Platform.OS !== 'web';
  const pulse = useSharedValue(1);
  const wave = useSharedValue(0.35);

  useEffect(() => {
    if (isSpeaking) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.16, { duration: 280, easing: Easing.out(Easing.quad) }),
          withTiming(1.02, { duration: 280, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        true,
      );
      wave.value = withRepeat(withTiming(1, { duration: 420 }), -1, true);
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
      wave.value = withTiming(0.55, { duration: 300 });
      return;
    }

    pulse.value = withTiming(1, { duration: 250 });
    wave.value = withTiming(0.35, { duration: 250 });
  }, [isConnected, isListening, isSpeaking, pulse, wave]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + wave.value * 0.45,
    transform: [{ scale: 0.92 + wave.value * 0.18 }],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        isMobile ? styles.containerMobile : styles.containerWeb,
        isConnected && styles.containerActive,
        containerStyle,
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="CareSuite+ VoiceCore Sprachassistent"
        style={({ pressed }) => [
          styles.pressable,
          pressed && styles.pressablePressed,
          disabled && styles.pressableDisabled,
        ]}
      >
        <Animated.View style={[styles.innerGlow, glowStyle, isListening && styles.innerListening]} />
        <View style={[styles.core, isSpeaking && styles.coreSpeaking]} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.9,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
  },
  containerWeb: {
    left: 24,
    bottom: 24,
  },
  containerMobile: {
    alignSelf: 'center',
    left: undefined,
    right: undefined,
    bottom: 88,
  },
  containerActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  pressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
  },
  pressablePressed: {
    opacity: 0.92,
  },
  pressableDisabled: {
    opacity: 0.55,
  },
  innerGlow: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  innerListening: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  core: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#FFFFFF',
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  coreSpeaking: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
});
