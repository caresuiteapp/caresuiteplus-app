import { useCallback, useEffect, useRef, useState } from 'react';

type WeatherData = { temperature: number; label: string; glyph: string; station: string; time: string };
type WeatherState = { status: 'idle' | 'loading' | 'ready' | 'error'; message: string; data: WeatherData | null };
const initial: WeatherState = { status: 'idle', message: 'Standort verwenden', data: null };
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

export function useDesktopWeather(owner: string) {
  const [state, setState] = useState<WeatherState>(initial);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ status: 'error', data: null, message: 'Standort im Browser nicht verfügbar' });
      return;
    }
    busy.current = true;
    const id = ++request.current;
    setState({ status: 'loading', data: null, message: 'Standort und Wetter werden geladen' });
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    let locationTimer: ReturnType<typeof setTimeout> | undefined;
    const fetchTimer = setTimeout(() => abort.abort(), 20_000);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        locationTimer = setTimeout(() => reject({ code: 3 }), 10_000);
        navigator.geolocation.getCurrentPosition(resolve, reject,
          { enableHighAccuracy: false, maximumAge: 15 * 60_000, timeout: 10_000 });
      });
      clearTimeout(locationTimer);
      if (id !== request.current) return;
      // Weather needs only an approximate location. No coordinates are stored or logged.
      const lat = position.coords.latitude.toFixed(2);
      const lon = position.coords.longitude.toFixed(2);
      const response = await fetch(`https://api.brightsky.dev/current_weather?lat=${lat}&lon=${lon}`, {
        signal: abort.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error('Weather request failed');
      const data = parseDesktopWeather(await response.json());
      if (id === request.current) setState({ status: 'ready', data, message: `${data.station} · ${data.time}` });
    } catch (error) {
      if (id === request.current) setState({ status: 'error', data: null,
        message: (error as { code?: number })?.code === 1 ? 'Standort im Browser gesperrt'
          : (error as { code?: number })?.code === 3 ? 'Standort nicht erreichbar · erneut versuchen'
          : 'Wetter nicht verfügbar · erneut versuchen' });
    } finally {
      clearTimeout(locationTimer);
      clearTimeout(fetchTimer);
      if (id === request.current) busy.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    setState(initial);
    // Do not open an unsolicited permission prompt; a visible button initiates first use.
    const loadIfGranted = () => {
      if (typeof navigator === 'undefined' || !navigator.permissions) return;
      const version = request.current;
      void navigator.permissions.query({ name: 'geolocation' }).then(permission => {
        if (active && request.current === version && permission.state === 'granted') void refresh();
      }).catch(() => undefined);
    };
    loadIfGranted();
    const timer = setInterval(loadIfGranted, 15 * 60_000);
    return () => { active = false; request.current++; busy.current = false; controller.current?.abort(); clearInterval(timer); };
  }, [owner, refresh]);
  return { ...state, refresh };
}
