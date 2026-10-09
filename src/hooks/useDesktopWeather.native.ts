import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { isWeatherPlace, parseDesktopWeather, type WeatherData, type WeatherPlace } from '@/lib/platform/desktopWeatherModel';
export type { WeatherPlace } from '@/lib/platform/desktopWeatherModel';
type State = { status: 'idle' | 'loading' | 'ready' | 'error'; message: string; data: WeatherData | null };
const initial: State = { status: 'idle', message: 'Ort wählen', data: null };

export function useDesktopWeather(owner: string) {
  const [state, setState] = useState<State>(initial); const [place, setPlace] = useState<WeatherPlace | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const selection = useRef<WeatherPlace | null>(null); const request = useRef(0); const controller = useRef<AbortController | undefined>(undefined);
  const readable = useRef(false); const ownerRef = useRef(owner); ownerRef.current = owner;
  const key = `caresuite.desktop.weather-place.v1.${owner}`;
  const load = useCallback(async (selected: WeatherPlace | null, askPermission = false) => {
    const id = ++request.current; controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setState({ status: 'loading', data: null, message: selected ? `${selected.name} · wird geladen` : 'Standort wird ermittelt' });
    const timer = setTimeout(() => abort.abort(), 20_000);
    try {
      let latitude = selected?.latitude; let longitude = selected?.longitude;
      if (!selected) {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted && askPermission) permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) throw new Error('Standort nicht freigegeben · Ort manuell wählen');
        const cached = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60_000 });
        const position = cached ?? await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
          new Promise<never>((_, reject) => abort.signal.addEventListener('abort', () => reject(new Error('Standort nicht erreichbar · Ort wählen')), { once: true })),
        ]);
        latitude = position.coords.latitude; longitude = position.coords.longitude;
      }
      if (id !== request.current || abort.signal.aborted) return;
      if (latitude == null || longitude == null) throw new Error('Standort nicht erreichbar · Ort wählen');
      const response = await fetch(`https://api.brightsky.dev/current_weather?lat=${latitude.toFixed(2)}&lon=${longitude.toFixed(2)}`, { signal: abort.signal });
      if (!response.ok) throw new Error('Wetter nicht verfügbar · erneut versuchen');
      const data = parseDesktopWeather(await response.json());
      if (id === request.current) setState({ status: 'ready', data, message: `${selected?.name ?? 'Aktueller Standort'} · ${data.time}` });
    } catch (error) {
      if (id === request.current) setState({ status: 'error', data: null, message: error instanceof Error && !abort.signal.aborted ? error.message : 'Wetter nicht verfügbar · Ort wählen' });
    } finally { clearTimeout(timer); }
  }, []);
  const choosePlace = useCallback(async (next: WeatherPlace | null) => {
    if (next !== null && !isWeatherPlace(next)) return false;
    const selectedOwner = owner;
    try { if (next) await AsyncStorage.setItem(key, JSON.stringify(next)); else await AsyncStorage.removeItem(key); }
    catch { if (ownerRef.current === selectedOwner) setPreferenceError('Der Wetterort konnte nicht gespeichert werden. Bitte erneut versuchen.'); return false; }
    if (ownerRef.current !== selectedOwner) return false;
    setPreferenceError(null); readable.current = true; selection.current = next; setPlace(next); void load(next, next === null); return true;
  }, [owner, key, load]);
  const refresh = useCallback(() => { void load(selection.current, selection.current === null); }, [load]);
  useEffect(() => {
    let active = true; request.current++; controller.current?.abort(); selection.current = null; readable.current = false; setPlace(null); setState(initial); setPreferenceError(null);
    const refreshAllowed = async () => {
      if (!active || !readable.current) return;
      if (selection.current) { void load(selection.current); return; }
      const permission = await Location.getForegroundPermissionsAsync();
      if (active && readable.current && permission.granted && !selection.current) void load(null);
    };
    void AsyncStorage.getItem(key).then(raw => {
      if (!active) return; const saved: unknown = raw ? JSON.parse(raw) : null;
      if (saved !== null && !isWeatherPlace(saved)) throw new Error('Invalid saved place');
      selection.current = saved; setPlace(saved); readable.current = true; void refreshAllowed();
    }).catch(() => { if (active) setPreferenceError('Der gespeicherte Wetterort konnte nicht geladen werden. Bitte erneut auswählen.'); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refreshAllowed().catch(() => undefined); }, 15 * 60_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refreshAllowed().catch(() => undefined); });
    return () => { active = false; request.current++; controller.current?.abort(); clearInterval(timer); subscription.remove(); };
  }, [key, load]);
  return { ...state, place, preferenceError, choosePlace, refresh };
}
