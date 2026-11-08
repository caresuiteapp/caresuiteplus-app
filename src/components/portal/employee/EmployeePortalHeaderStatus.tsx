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

function EmployeePortalWeather({ owner, compact }: { owner: string; compact: boolean }) {
  const weather = useEmployeePortalWeather(owner);
  const [locationOpen, setLocationOpen] = useState(false);
  const loading = weather.status === 'loading';
  const summary = weather.data ? `${weather.data.temperature} °C · ${weather.data.label}` : null;
  const locationAction = weather.status === 'idle' ? 'Wetterort wählen' : 'Wetterort ändern';
  const location = weather.place?.name ?? (compact ? 'Standort' : 'Aktueller Standort');
  return (
    <View style={[styles.weather, compact && styles.weatherCompact]} testID="employee-portal-weather">
      <Pressable accessibilityRole="button" accessibilityLabel={weather.status === 'idle' ? locationAction : [summary, weather.message, locationAction].filter(Boolean).join('. ')}
        accessibilityState={{ expanded: locationOpen }} onPress={() => setLocationOpen(true)}
        style={({ pressed }) => [styles.weatherChoice, pressed && styles.pressed]}>
        <Text style={styles.weatherTitle}>
          {weather.data ? <><Text style={styles.weatherGlyph}>{weather.data.glyph}</Text>{`  ${summary}`}</> : 'Wetter'}
        </Text>
        {weather.data ? <Text style={styles.detail} numberOfLines={1}>{location}</Text> :
          weather.status !== 'idle' ? <Text style={styles.detail} accessibilityLiveRegion="polite">{weather.message}</Text> : null}
        <View style={styles.weatherMeta}>
          <Text style={styles.weatherLink}>{weather.status === 'idle' ? 'Ort wählen' : 'Ort ändern'}</Text>
          {weather.data && !compact ? <Text style={styles.observationTime}>Stand {weather.data.time}</Text> : null}
        </View>
      </Pressable>
      {weather.status !== 'idle' ? (
        <View style={styles.weatherTools}>
          <Pressable accessibilityRole="button" accessibilityLabel="Wetter aktualisieren" accessibilityState={{ disabled: loading, busy: loading }}
            disabled={loading} onPress={weather.refresh} style={({ pressed }) => [styles.weatherRefresh, pressed && styles.pressed]}>
            <Ionicons name="refresh-outline" size={19} color={loading ? c.muted : c.accent} />
          </Pressable>
          {weather.data && compact ? <Text accessibilityLabel={`Stand ${weather.data.time} Uhr`} style={styles.observationTime}>{weather.data.time}</Text> : null}
        </View>
      ) : null}
      {locationOpen ? <EmployeePortalWeatherLocationDialog visible place={weather.place} preferenceError={weather.preferenceError}
        eyebrow="MITARBEITENDENPORTAL" onChoose={weather.choosePlace} onClose={() => setLocationOpen(false)} /> : null}
    </View>
  );
}

export function EmployeePortalHeaderStatus({ owner, compact, stacked, centered }: { owner: string | null; compact: boolean; stacked: boolean; centered: boolean }) {
  const now = useLocalMinute();
  const time = now ? timeFormat.format(now) : '–:–';
  const date = now ? (compact ? compactDateFormat : dateFormat).format(now) : 'Datum';
  return (
    <View style={[styles.status, compact && styles.statusCompact, stacked && styles.statusStacked, centered && styles.statusCentered]}
      testID="employee-portal-header-status">
      <View style={[styles.clockGroup, compact && styles.clockGroupCompact]}>
        <View style={styles.neoPocket}>
          <CareSuiteImage source={neoHeaderArtwork} resizeMode="contain" accessible={false}
            style={compact ? styles.neoCompact : styles.neo} testID="employee-portal-neo" />
        </View>
        <View style={styles.clock} testID="employee-portal-clock">
          <Text accessibilityLabel={now ? `${time} Uhr` : 'Uhrzeit'} style={[styles.time, compact && styles.timeCompact]}>{time}</Text>
          <Text style={styles.detail}>{date}</Text>
        </View>
      </View>
      {owner ? <EmployeePortalWeather key={owner} owner={owner} compact={compact} /> : null}
    </View>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  status: {
    minWidth: 0, maxWidth: '100%', flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(213,235,252,0.18)',
    borderRadius: 17, backgroundColor: 'rgba(13,31,49,0.32)',
  },
  statusStacked: { flexBasis: '100%', justifyContent: 'center' },
  statusCentered: { flexShrink: 0 },
  statusCompact: { gap: 8, paddingHorizontal: 8 },
  clockGroup: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 11 },
  clockGroupCompact: { gap: 7 },
  neoPocket: { alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(154,225,249,0.08)' },
  neo: { width: 60, height: 64 },
  neoCompact: { width: 44, height: 50 },
  clock: { flexShrink: 0, gap: 1 },
  time: { color: c.text, fontSize: font(32), lineHeight: font(35), fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeCompact: { fontSize: font(24), lineHeight: font(29) },
  detail: { color: c.muted, fontSize: font(12), lineHeight: font(16) },
  weather: { flexBasis: 225, flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 1, borderColor: c.line },
  weatherCompact: { flexBasis: 188 },
  weatherChoice: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', paddingVertical: 3, paddingLeft: 10, gap: 1 },
  weatherTitle: { color: c.text, fontSize: font(14), lineHeight: font(19), fontWeight: '700' },
  weatherGlyph: { color: c.accent },
  weatherMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10 },
  weatherLink: { color: c.accent, fontSize: font(12), lineHeight: font(16), fontWeight: '700' },
  observationTime: { color: c.muted, fontSize: font(11), lineHeight: font(15), fontVariant: ['tabular-nums'] },
  weatherTools: { alignItems: 'center', flexShrink: 0 },
  weatherRefresh: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.74 },
}));
