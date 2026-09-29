type WeatherPayload = { weather?: { source_id?: number; timestamp?: string; temperature?: number | null; icon?: string | null }; sources?: Array<{ id?: number; distance?: number; station_name?: string }> };
const conditions: Record<string, string> = { 'clear-day': 'klar', 'clear-night': 'klar', 'partly-cloudy-day': 'teilweise bewölkt', 'partly-cloudy-night': 'teilweise bewölkt', cloudy: 'bewölkt', rain: 'regnerisch', sleet: 'mit Schneeregen', snow: 'verschneit', wind: 'windig', fog: 'neblig', hail: 'mit Hagel', thunderstorm: 'gewittrig' };

export function describeNeoWeather(data: WeatherPayload, now = Date.now()): string {
  const w = data.weather;
  const source = data.sources?.find(item => item.id === w?.source_id);
  const time = w?.timestamp ? Date.parse(w.timestamp) : NaN;
  if (!w || typeof w.temperature !== 'number' || !Number.isFinite(w.temperature) || w.temperature < -70 || w.temperature > 60 ||
    !Number.isFinite(time) || now - time > 90 * 60_000 || time - now > 5 * 60_000 ||
    !source || typeof source.distance !== 'number' || !Number.isFinite(source.distance) || source.distance < 0 || source.distance > 50_000) {
    throw new Error('weather-unreliable');
  }
  const temperature = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(w.temperature);
  const condition = w.icon && Object.prototype.hasOwnProperty.call(conditions, w.icon) ? conditions[w.icon] : undefined;
  // Observations may come from nearby stations. Never claim a precise street location.
  return `In deiner Nähe sind es etwa ${temperature} Grad${condition ? `, ${condition}` : ''}. Die Daten stammen vom Deutschen Wetterdienst.`;
}

function location(signal: AbortSignal): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    if (!navigator.geolocation || !window.isSecureContext) { reject(new Error('weather-location-unavailable')); return; }
    const finish = (error?: Error, coordinates?: GeolocationCoordinates) => { signal.removeEventListener('abort', abort); error ? reject(error) : resolve(coordinates!); };
    const abort = () => finish(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    navigator.geolocation.getCurrentPosition(position => finish(undefined, position.coords), error => finish(new Error(error.code === 1 ? 'weather-location-denied' : 'weather-location-unavailable')),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 });
  });
}

/** Only the coarse location goes to the weather service; never profile or voice text. */
export async function getNeoWeather(signal: AbortSignal): Promise<string> {
  const coordinates = await location(signal); signal.throwIfAborted();
  if (!Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude) || Math.abs(coordinates.latitude) > 90 || Math.abs(coordinates.longitude) > 180 || coordinates.accuracy > 50_000) throw new Error('weather-location-unavailable');
  const query = new URLSearchParams({ lat: coordinates.latitude.toFixed(2), lon: coordinates.longitude.toFixed(2), max_dist: '50000' });
  const response = await fetch(`https://api.brightsky.dev/current_weather?${query}`, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('weather-unavailable');
  const data = await response.json(); signal.throwIfAborted();
  return describeNeoWeather(data);
}
