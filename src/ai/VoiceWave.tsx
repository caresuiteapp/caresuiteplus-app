import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type VoiceWaveProps = {
  active: boolean;
  bars?: number;
  color?: string;
};

function WaveBar({
  active,
  delay,
  color,
}: {
  active: boolean;
  delay: number;
  color: string;
}) {
  const height = useSharedValue(0.35);

  useEffect(() => {
    if (!active) {
      height.value = withTiming(0.25, { duration: 200 });
      return;
    }

    height.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
          withTiming(0.3, { duration: 260, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
  }, [active, delay, height]);

  const style = useAnimatedStyle(() => ({
    height: 8 + height.value * 18,
    opacity: 0.55 + height.value * 0.45,
  }));

  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

export function VoiceWave({ active, bars = 5, color = 'rgba(255,255,255,0.92)' }: VoiceWaveProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: bars }, (_, index) => (
        <WaveBar key={`wave-${index}`} active={active} delay={index * 70} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 28,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
});
