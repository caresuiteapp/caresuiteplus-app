import { useCallback, useEffect, useRef, useState } from 'react';

export type WeatherPlace = { name: string; postcode: string; region: string; district: string; latitude: number; longitude: number };
type WeatherData = { temperature: number; label: string; glyph: string; station: string; time: string };
type WeatherState = { status: 'idle' | 'loading' | 'ready' | 'error'; message: string; data: WeatherData | null };
const initial: WeatherState = { status: 'idle', message: 'Ort wählen', data: null };
const storagePrefix = 'caresuite.desktop.weather-place.v1.';

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

function isWeatherPlace(value: unknown): value is WeatherPlace {
  if (!value || typeof value !== 'object') return false;
  const p = value as WeatherPlace;
  return typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 200
    && typeof p.postcode === 'string' && /^\d{5}$/.test(p.postcode)
    && typeof p.region === 'string' && typeof p.district === 'string'
    && Number.isFinite(p.latitude) && p.latitude >= 47 && p.latitude <= 56
    && Number.isFinite(p.longitude) && p.longitude >= 5 && p.longitude <= 16;
}

export function useDesktopWeather(owner: string) {
  const [state, setState] = useState<WeatherState>(initial);
  const [place, setPlace] = useState<WeatherPlace | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const selection = useRef<WeatherPlace | null>(null);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const preferencesReadable = useRef(true);
  const key = `${storagePrefix}${owner}`;

  const loadWeather = useCallback(async (selected: WeatherPlace | null) => {
    const id = ++request.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: 'loading', data: null, message: selected ? `${selected.name} · wird geladen` : 'Standort wird ermittelt' });
    let locationTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => abort.abort(), 20_000);
    try {
      let latitude = selected?.latitude;
      let longitude = selected?.longitude;
      if (!selected) {
        if (typeof navigator === 'undefined' || !navigator.geolocation) throw new Error('Geolocation unavailable');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          locationTimer = setTimeout(() => reject({ code: 3 }), 10_000);
          navigator.geolocation.getCurrentPosition(resolve, reject,
            { enableHighAccuracy: false, maximumAge: 15 * 60_000, timeout: 10_000 });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        clearTimeout(locationTimer);
      }
      if (id !== request.current) return;
      if (abort.signal.aborted) throw new Error('Weather request timed out');
      if (latitude == null || longitude == null) throw new Error('Missing location');
      // Browser coordinates remain transient. A manually selected postal area is stored separately.
      const response = await fetch(`https://api.brightsky.dev/current_weather?lat=${latitude.toFixed(2)}&lon=${longitude.toFixed(2)}`, {
        signal: abort.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error('Weather request failed');
      const data = parseDesktopWeather(await response.json());
      if (id === request.current) setState({ status: 'ready', data,
        message: `${selected?.name ?? 'Aktueller Standort'} · ${data.time}` });
    } catch (error) {
      if (id === request.current) setState({ status: 'error', data: null,
        message: (error as { code?: number })?.code === 1 ? 'Standort gesperrt · Ort manuell wählen'
          : (error as { code?: number })?.code === 3 ? 'Standort nicht erreichbar · Ort wählen'
          : selected ? `${selected.name} · Wetter nicht verfügbar` : 'Wetter nicht verfügbar · Ort wählen' });
    } finally {
      clearTimeout(locationTimer);
      clearTimeout(timeout);
    }
  }, []);

  const choosePlace = useCallback((next: WeatherPlace | null) => {
    if (next !== null && !isWeatherPlace(next)) return false;
    try {
      if (next) window.localStorage.setItem(key, JSON.stringify(next));
      else window.localStorage.removeItem(key);
    } catch {
      setPreferenceError('Der Wetterort konnte nicht gespeichert werden. Bitte den Browserspeicher freigeben und erneut versuchen.');
      return false;
    }
    setPreferenceError(null);
    preferencesReadable.current = true;
    selection.current = next;
    setPlace(next);
    void loadWeather(next);
    return true;
  }, [key, loadWeather]);

  const refresh = useCallback(() => { void loadWeather(selection.current); }, [loadWeather]);

  useEffect(() => {
    let active = true;
    request.current++;
    controller.current?.abort();
    selection.current = null;
    setPlace(null);
    setState(initial);
    setPreferenceError(null);
    const refreshIfAllowed = () => {
      if (!active || !preferencesReadable.current) return;
      if (selection.current) { void loadWeather(selection.current); return; }
      if (typeof navigator === 'undefined' || !navigator.permissions) return;
      const version = request.current;
      void navigator.permissions.query({ name: 'geolocation' }).then(permission => {
        if (active && request.current === version && !selection.current && permission.state === 'granted') void loadWeather(null);
      }).catch(() => undefined);
    };
    const restore = () => {
      request.current++;
      controller.current?.abort();
      try {
        const raw = window.localStorage.getItem(key);
        const saved: unknown = raw ? JSON.parse(raw) : null;
        if (saved !== null && !isWeatherPlace(saved)) throw new Error('Invalid stored place');
        selection.current = saved;
        setPlace(saved);
        preferencesReadable.current = true;
        setPreferenceError(null);
        setState(initial);
        refreshIfAllowed();
      } catch {
        preferencesReadable.current = false;
        selection.current = null;
        setPlace(null);
        setState({ status: 'error', data: null, message: 'Gespeicherten Wetterort erneut wählen' });
        setPreferenceError('Der gespeicherte Wetterort konnte nicht geladen werden. Bitte erneut auswählen.');
      }
    };
    restore();
    const storageChanged = (event: StorageEvent) => { if (event.key === key || event.key === null) restore(); };
    window.addEventListener('storage', storageChanged);
    const timer = setInterval(refreshIfAllowed, 15 * 60_000);
    return () => {
      active = false;
      request.current++;
      controller.current?.abort();
      clearInterval(timer);
      window.removeEventListener('storage', storageChanged);
    };
  }, [key, loadWeather]);
  return { ...state, place, preferenceError, choosePlace, refresh };
}
