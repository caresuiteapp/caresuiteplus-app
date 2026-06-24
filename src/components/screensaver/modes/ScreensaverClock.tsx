import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { formatScreensaverClock } from '@/lib/screensaver/screensaverFormat';

type ScreensaverClockProps = {
  use24h: boolean;
  showSeconds: boolean;
};

export function ScreensaverClock({ use24h, showSeconds }: ScreensaverClockProps) {
  const text = useAuroraAdaptiveText();
  const [now, setNow] = useState(() => new Date());
  const pulse = useState(() => new Animated.Value(1))[0];

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showSeconds) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.94,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 500,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, showSeconds]);

  const timeLabel = formatScreensaverClock(now, use24h, showSeconds);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.card, { opacity: pulse }]}>
        <Text style={[styles.time, { color: text.primary }]}>{timeLabel}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  card: {
    paddingHorizontal: 72,
    paddingVertical: 56,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  time: {
    fontSize: 112,
    fontWeight: '300',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
});
