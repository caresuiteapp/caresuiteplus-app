import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import {
  formatGermanDateLong,
  formatGermanWeekday,
  formatScreensaverClock,
} from '@/lib/screensaver/screensaverFormat';

type ScreensaverClockDateProps = {
  use24h: boolean;
  showSeconds: boolean;
  showDate: boolean;
  showWeekday: boolean;
};

export function ScreensaverClockDate({
  use24h,
  showSeconds,
  showDate,
  showWeekday,
}: ScreensaverClockDateProps) {
  const text = useAuroraAdaptiveText();
  const tenantName = useTenantDisplayName();
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
  const weekday = showWeekday ? formatGermanWeekday(now) : '';
  const dateLabel = showDate ? formatGermanDateLong(now) : '';
  const subline =
    weekday && dateLabel ? `${weekday}, ${dateLabel}` : weekday || dateLabel;

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.card, { opacity: pulse }]}>
        <Text style={[styles.time, { color: text.primary }]}>{timeLabel}</Text>
        {subline ? <Text style={[styles.date, { color: text.secondary }]}>{subline}</Text> : null}
      </Animated.View>
      {tenantName ? <Text style={[styles.tenant, { color: text.muted }]}>{tenantName}</Text> : null}
      <Text style={[styles.brand, { color: text.muted }]}>CareSuite+</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 20,
  },
  card: {
    paddingHorizontal: 72,
    paddingVertical: 56,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    gap: 16,
  },
  time: {
    fontSize: 112,
    fontWeight: '300',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  date: {
    fontSize: 40,
    fontWeight: '400',
  },
  tenant: {
    fontSize: 32,
  },
  brand: {
    fontSize: 22,
  },
});
