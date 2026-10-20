export type WeatherPlace = { name: string; postcode: string; region: string; district: string; latitude: number; longitude: number };
export type WeatherData = { temperature: number; label: string; glyph: string; station: string; time: string };
const icons: Record<string, [string, string]> = {
  'clear-day': ['Sonnig', '☀'], 'clear-night': ['Klar', '☾'],
  'partly-cloudy-day': ['Wolkig', '⛅'], 'partly-cloudy-night': ['Wolkig', '☁'],
  cloudy: ['Bedeckt', '☁'], fog: ['Nebel', '≋'], wind: ['Windig', '≋'],
  rain: ['Regen', '☂'], sleet: ['Schneeregen', '❄'], snow: ['Schnee', '❄'],
  hail: ['Hagel', '❄'], thunderstorm: ['Gewitter', 'ϟ'],
};

/** DWD observations, never a fabricated temperature or an assumed user location. */
export function parseDesktopWeather(payload: unknown, now = Date.now()): WeatherData {
  const body = payload as { weather?: { temperature?: unknown; icon?: string; timestamp?: string; source_id?: number; source_ids?: { temperature?: number } }; sources?: { id: number; station_name?: string }[] };
  const weather = body?.weather;
  const timestamp = Date.parse(weather?.timestamp ?? '');
  if (!weather || typeof weather.temperature !== 'number' || !Number.isFinite(weather.temperature)
    || !Number.isFinite(timestamp) || now - timestamp > 90 * 60_000 || timestamp - now > 5 * 60_000) {
    throw new Error('No current observation');
  }
  const [label, glyph] = icons[weather.icon ?? ''] ?? ['Wetter', '☁'];
  const sourceId = weather.source_ids?.temperature ?? weather.source_id;
  const source = Array.isArray(body.sources) ? body.sources.find(item => item.id === sourceId) : undefined;
  return { temperature: Math.round(weather.temperature), label, glyph,
    station: source?.station_name || 'DWD-Messstation',
    time: new Date(timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) };
}

export function isWeatherPlace(value: unknown): value is WeatherPlace {
  if (!value || typeof value !== 'object') return false;
  const p = value as WeatherPlace;
  return typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 200
    && typeof p.postcode === 'string' && /^\d{5}$/.test(p.postcode)
    && typeof p.region === 'string' && typeof p.district === 'string'
    && Number.isFinite(p.latitude) && p.latitude >= 47 && p.latitude <= 56
    && Number.isFinite(p.longitude) && p.longitude >= 5 && p.longitude <= 16;
}
