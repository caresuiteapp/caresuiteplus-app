import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { CareSuiteImage } from '@/components/images/CareSuiteImage';
import { careSuiteAppFontFamily } from '@/design/tokens/appFontFamily';
import type { WeatherData, WeatherPlace } from '@/lib/platform/desktopWeatherModel';
import { desktopWeatherArtwork } from './desktopWeatherArtwork';

type Weather = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: WeatherData | null;
  place: WeatherPlace | null;
};

const roomyDate: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
const compactDate: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
const clockFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

export function DesktopClockWeather({ now, weather, onChoosePlace, availableWidth, renderedFontScale = 1, layoutFontScale = 1, today, style }: {
  now: Date | null;
  weather: Weather;
  onChoosePlace: () => void;
  availableWidth: number;
  renderedFontScale?: number;
  layoutFontScale?: number;
  today?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = (measuredWidth || availableWidth) / Math.max(1, layoutFontScale);
  const todayInline = Boolean(today) && width >= 590;
  const weatherWidth = width - (todayInline ? 140 : 0);
  const stack = weatherWidth < 220;
  const artworkBelow = !stack && weatherWidth < 370;
  const largeArtwork = weatherWidth >= 440 || artworkBelow;
  const displaySize = weatherWidth >= 440 ? 34 : weatherWidth >= 370 ? 28 : 24;
  const display = { fontSize: displaySize * renderedFontScale, lineHeight: (displaySize + 5) * renderedFontScale };
  const detailStyle = { fontSize: 15 * renderedFontScale, lineHeight: 20 * renderedFontScale };
  const place = weather.place?.name ?? (weather.data ? 'Aktueller Standort' : 'Ort wählen');
  const status = weather.status === 'loading' ? 'Wetter wird geladen' : weather.status === 'error' ? 'Wetter nicht verfügbar' : 'Wetter';
  const artwork = weather.data?.icon ? desktopWeatherArtwork[weather.data.icon] : null;

  return (
    <View testID="desktop-clock-weather" style={[styles.card, todayInline && styles.cardInline, style]}
      onLayout={({ nativeEvent: { layout } }) => setMeasuredWidth(layout.width)}>
      <View style={[styles.readings, stack && styles.readingsStacked]}>
        <View style={[styles.clock, stack && styles.clockStacked]}>
          <Text testID="desktop-clock-time" style={[styles.display, styles.clockDigits, display]}>{now ? clockFormat.format(now) : '\u00a0'}</Text>
          <Text style={[styles.detail, detailStyle]}>{now ? now.toLocaleDateString('de-DE', weatherWidth >= 400 ? roomyDate : compactDate) : '\u00a0'}</Text>
        </View>
        <View testID="desktop-weather" style={[styles.weather, artworkBelow && styles.artworkBelow]}>
          {artwork ? <CareSuiteImage source={artwork} resizeMode="contain" accessible={false}
            style={[styles.artwork, largeArtwork && styles.artworkLarge]} /> : null}
          <View style={styles.weatherCopy}>
            <Text testID="desktop-weather-title" accessibilityLiveRegion="polite"
              style={[styles.display, display, !weather.data && detailStyle]}>
              {weather.data ? `${weather.data.temperature}\u00a0°C\u00a0· ${weather.data.label}` : status}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Wetterort ändern" accessibilityHint={place}
              onPress={onChoosePlace} style={styles.placeButton} hitSlop={{ top: 4, bottom: 10, left: 3, right: 8 }}>
              <Text testID="desktop-weather-place" style={[styles.detail, detailStyle, styles.place]}>{place}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {today ? <View style={todayInline ? styles.todayInline : styles.todayBelow}>{today}</View> : null}
    </View>
  );
}

const divider = 'rgba(139,211,255,0.22)';
const styles = StyleSheet.create({
  card: { minWidth: 0, flexShrink: 1, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 13, borderWidth: 1, borderColor: divider, backgroundColor: 'rgba(6,27,51,0.46)' },
  cardInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readings: { flexGrow: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  readingsStacked: { flexDirection: 'column' },
  clock: { flexShrink: 0, paddingRight: 8, borderRightWidth: 1, borderRightColor: divider },
  clockStacked: { borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: divider, paddingBottom: 6 },
  display: { color: '#FFF', fontFamily: careSuiteAppFontFamily, fontWeight: '700', includeFontPadding: false, letterSpacing: -0.8, marginTop: 4 },
  clockDigits: { fontVariant: ['tabular-nums'] },
  detail: { color: '#D8EAFF', fontFamily: careSuiteAppFontFamily, fontWeight: '700', includeFontPadding: false },
  weather: { flexGrow: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  artworkBelow: { flexDirection: 'column-reverse', alignItems: 'flex-start', gap: 0 },
  artwork: { width: 57, height: 49, alignSelf: 'center', flexShrink: 0 },
  artworkLarge: { width: 80, height: 62 },
  weatherCopy: { flex: 1, minWidth: 0, alignSelf: 'stretch' },
  placeButton: { alignSelf: 'flex-start', justifyContent: 'flex-start', minHeight: 24, maxWidth: '100%' },
  place: { color: '#8FE4FF', textDecorationLine: 'underline' },
  todayInline: { width: 132, borderLeftColor: divider, borderLeftWidth: 1, paddingLeft: 8 },
  todayBelow: { borderTopColor: divider, borderTopWidth: 1, marginTop: 5, paddingTop: 1 },
});
