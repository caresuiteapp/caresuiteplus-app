import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CareSuiteImage } from '@/components/images/CareSuiteImage';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useLocalMinute } from '@/hooks/useLocalMinute';
import { employeePortalDesign as c } from './employeePortalDesign';
import { EmployeePortalWeatherLocationDialog, neoHeaderArtwork, useEmployeePortalWeather } from './employeePortalHeaderPlatform';

const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const compactDateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

function EmployeePortalWeather({ owner }: { owner: string }) {
  const weather = useEmployeePortalWeather(owner);
  const [locationOpen, setLocationOpen] = useState(false);
  const loading = weather.status === 'loading';
  const summary = weather.data ? `${weather.data.temperature} °C · ${weather.data.label}` : null;
  const locationAction = weather.status === 'idle' ? 'Wetterort wählen' : 'Wetterort ändern';
  return (
    <View style={styles.weather} testID="employee-portal-weather">
      <Pressable accessibilityRole="button" accessibilityLabel={weather.status === 'idle' ? locationAction : [summary, weather.message, locationAction].filter(Boolean).join('. ')}
        accessibilityState={{ expanded: locationOpen }} onPress={() => setLocationOpen(true)}
        style={({ pressed }) => [styles.weatherChoice, pressed && styles.pressed]}>
        <Text style={styles.weatherTitle}>
          {weather.data ? `${weather.data.glyph}  ${summary}` : 'Wetter'}
        </Text>
        {weather.status !== 'idle' ? <Text style={styles.detail} accessibilityLiveRegion="polite">{weather.message}</Text> : null}
        <Text style={styles.weatherLink}>{weather.status === 'idle' ? 'Ort wählen' : 'Ort ändern'}</Text>
      </Pressable>
      {weather.status !== 'idle' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Wetter aktualisieren" accessibilityState={{ disabled: loading, busy: loading }}
          disabled={loading} onPress={weather.refresh} style={({ pressed }) => [styles.weatherRefresh, pressed && styles.pressed]}>
          <Ionicons name="refresh-outline" size={19} color={loading ? c.muted : c.accent} />
        </Pressable>
      ) : null}
      {locationOpen ? <EmployeePortalWeatherLocationDialog visible place={weather.place} preferenceError={weather.preferenceError}
        eyebrow="MITARBEITENDENPORTAL" onChoose={weather.choosePlace} onClose={() => setLocationOpen(false)} /> : null}
    </View>
  );
}

export function EmployeePortalHeaderStatus({ owner, compact, stacked }: { owner: string | null; compact: boolean; stacked: boolean }) {
  const now = useLocalMinute();
  const time = now ? timeFormat.format(now) : '–:–';
  const date = now ? (compact ? compactDateFormat : dateFormat).format(now) : 'Datum';
  return (
    <View style={[styles.status, compact && styles.statusCompact, stacked && styles.statusStacked]} testID="employee-portal-header-status">
      <CareSuiteImage source={neoHeaderArtwork} resizeMode="contain" accessible={false}
        style={compact ? styles.neoCompact : styles.neo} testID="employee-portal-neo" />
      <View style={styles.clock} testID="employee-portal-clock">
        <Text accessibilityLabel={now ? `${time} Uhr` : 'Uhrzeit'} style={[styles.time, compact && styles.timeCompact]}>{time}</Text>
        <Text style={styles.detail}>{date}</Text>
      </View>
      {owner ? <EmployeePortalWeather key={owner} owner={owner} /> : null}
    </View>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  status: {
    minWidth: 0, maxWidth: '100%', flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.panel,
  },
  statusStacked: { flexBasis: '100%', justifyContent: 'center' },
  statusCompact: { gap: 8, paddingHorizontal: 8 },
  neo: { width: 62, height: 72, flexShrink: 0 },
  neoCompact: { width: 46, height: 54, flexShrink: 0 },
  clock: { flexShrink: 0, gap: 1 },
  time: { color: c.text, fontSize: font(32), lineHeight: font(37), fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeCompact: { fontSize: font(24), lineHeight: font(29) },
  detail: { color: c.muted, fontSize: font(12), lineHeight: font(16) },
  weather: { flexBasis: 177, flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 1, borderColor: c.line },
  weatherChoice: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', paddingVertical: 4, paddingLeft: 9, gap: 1 },
  weatherTitle: { color: c.text, fontSize: font(14), lineHeight: font(19), fontWeight: '700' },
  weatherLink: { color: c.accent, fontSize: font(12), lineHeight: font(16), fontWeight: '700' },
  weatherRefresh: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.74 },
}));
