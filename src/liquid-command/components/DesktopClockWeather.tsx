import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { CareSuiteImage } from '@/components/images/CareSuiteImage';
import { careSuiteAppFontFamily } from '@/design/tokens/appFontFamily';
import type { WeatherData, WeatherPlace } from '@/lib/platform/desktopWeatherModel';
import { DesktopToday, type DesktopTodayOptions } from './DesktopToday';
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
  today?: DesktopTodayOptions;
  style?: StyleProp<ViewStyle>;
}) {
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = measuredWidth || availableWidth;
  const scale = Math.max(0.9, layoutFontScale);
  const compactToday = width / scale < 530;
  const todayWidth = Math.ceil((compactToday ? 60 : 172) * scale);
  const weatherWidth = (width - (today ? todayWidth + 8 : 0)) / scale;
  const compactWeather = weatherWidth < 350;
  const roomyWeather = weatherWidth >= 460;
  const displaySize = roomyWeather ? 34 : weatherWidth >= 350 ? 28 : weatherWidth >= 275 ? 23 : weatherWidth >= 195 ? 18 : 16;
  const display = { fontSize: displaySize * renderedFontScale, lineHeight: (displaySize + 5) * renderedFontScale };
  const detailStyle = {
    fontSize: (compactWeather ? 12 : 15) * renderedFontScale,
    lineHeight: (compactWeather ? 16 : 20) * renderedFontScale,
  };
  const artworkSize = roomyWeather ? styles.artworkLarge : compactWeather ? styles.artworkCompact : styles.artworkMedium;
  const place = weather.place?.name ?? (weather.data ? 'Aktueller Standort' : 'Ort wählen');
  const status = weather.status === 'loading' ? 'Wetter wird geladen' : weather.status === 'error' ? 'Wetter nicht verfügbar' : 'Wetter';
  const artwork = weather.data?.icon ? desktopWeatherArtwork[weather.data.icon] : null;
  const temperature = weather.data ? `${weather.data.temperature}\u00a0°C` : null;
  const condition = weather.data?.label ?? '';
  const forecast = temperature ? `${temperature}\u00a0· ${condition}` : status;
  const shortForecast = Boolean(temperature && temperature.length + condition.length <= 12);
  const largeCondition = weatherWidth >= 620 || (weatherWidth >= (roomyWeather ? 470 : 350) && shortForecast);
  const secondaryCondition = temperature && !largeCondition && weatherWidth >= 215 ? condition : '';

  const renderReadings = (todayTrigger?: ReactNode, details?: ReactNode) => (
    <View style={[styles.container, style]} onLayout={({ nativeEvent: { layout } }) => setMeasuredWidth(layout.width)}>
      <View testID="desktop-clock-weather" style={[styles.card, compactWeather && styles.cardCompact]}>
        <View style={[styles.clock, compactWeather && styles.clockCompact]}>
          <Text testID="desktop-clock-time" numberOfLines={1} style={[styles.display, styles.clockDigits, display]}>{now ? clockFormat.format(now) : '\u00a0'}</Text>
          <View style={styles.detailRow}>
            <Text numberOfLines={1} style={[styles.detail, detailStyle]}>{now ? now.toLocaleDateString('de-DE', roomyWeather ? roomyDate : compactDate) : '\u00a0'}</Text>
          </View>
        </View>
        <View testID="desktop-weather" style={[styles.weather, compactWeather && styles.weatherCompact]}>
          {artwork ? <CareSuiteImage source={artwork} resizeMode="contain" accessible={false}
            style={[styles.artwork, artworkSize]} /> : null}
          <View style={styles.weatherCopy}>
            <View style={styles.forecastLine}>
              <Text testID="desktop-weather-title" accessibilityLiveRegion="polite" accessibilityLabel={forecast} numberOfLines={1}
                style={[styles.display, styles.forecastTitle, display, !weather.data && detailStyle]}>
                {temperature && !largeCondition ? temperature : forecast}
              </Text>
              {secondaryCondition ? <Text accessible={false} aria-hidden numberOfLines={1} style={[styles.detail, detailStyle, styles.forecastCondition]}>{secondaryCondition}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Wetterort ändern" accessibilityHint={place}
              onPress={onChoosePlace} style={[styles.detailRow, styles.placeButton]} hitSlop={{ top: 4, bottom: 10, left: 3, right: 8 }}>
              <Text testID="desktop-weather-place" numberOfLines={1} style={[styles.detail, detailStyle, styles.place]}>{place}</Text>
            </Pressable>
          </View>
        </View>
        {todayTrigger ? <View style={[styles.today, { width: todayWidth }]}>{todayTrigger}</View> : null}
      </View>
      {details ? <View style={[styles.todayDetails, { width: Math.min(width, 300 * scale) }, Platform.OS === 'web' && styles.todayDetailsWeb]}>{details}</View> : null}
    </View>
  );
  return today && now ? (
    <DesktopToday {...today} now={now} compact={compactToday} fontScale={renderedFontScale}>
      {renderReadings}
    </DesktopToday>
  ) : renderReadings();
}

const divider = 'rgba(139,211,255,0.22)';
const styles = StyleSheet.create({
  container: { minWidth: 0, flexShrink: 1 },
  card: { flexDirection: 'row', alignItems: 'stretch', gap: 8, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 13, borderWidth: 1, borderColor: divider, backgroundColor: 'rgba(6,27,51,0.46)' },
  cardCompact: { paddingHorizontal: 6, gap: 6 },
  clock: { justifyContent: 'center', flexShrink: 0, paddingRight: 8, borderRightWidth: 1, borderRightColor: divider },
  clockCompact: { paddingRight: 5 },
  display: { color: '#FFF', fontFamily: careSuiteAppFontFamily, fontWeight: '700', includeFontPadding: false, letterSpacing: -0.8, marginTop: 4 },
  clockDigits: { fontVariant: ['tabular-nums'] },
  detail: { color: '#D8EAFF', fontFamily: careSuiteAppFontFamily, fontWeight: '700', includeFontPadding: false },
  detailRow: { minHeight: 24, justifyContent: 'center' },
  weather: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  weatherCompact: { gap: 4 },
  artwork: { flexShrink: 0 },
  artworkLarge: { width: 80, height: 62 },
  artworkMedium: { width: 57, height: 49 },
  artworkCompact: { width: 38, height: 40 },
  weatherCopy: { flex: 1, minWidth: 0 },
  forecastLine: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  forecastTitle: { flexShrink: 1 },
  forecastCondition: { flexShrink: 1 },
  placeButton: { alignSelf: 'flex-start', maxWidth: '100%' },
  place: { color: '#8FE4FF', textDecorationLine: 'underline' },
  today: { justifyContent: 'center', flexShrink: 0, borderLeftColor: divider, borderLeftWidth: 1 },
  todayDetails: { alignSelf: 'flex-end', marginTop: 6 },
  todayDetailsWeb: { position: 'absolute', top: '100%', right: 0 },
});
