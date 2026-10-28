import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { CareSuiteImage as Image } from '@/components/images/CareSuiteImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { useFlowRouter as useRouter } from '@/hooks/useFlowRouter';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useDesktopWeather } from '@/hooks/useDesktopWeather.native';
import { fetchClientList } from '@/lib/office/clientListService';
import { CARESUITE_ROBOT_LOGO } from '@/components/brand/brandassets';
import { useAppStartIntroReady } from '@/components/brand/appStartIntroSession';
import { nativeAdministrationRoute } from '@/liquid-command/navigation/nativeAdministrationModel';
import { careSuiteAppFontFamily } from '@/design/tokens/appFontFamily';
import { createNeoConversation } from './neoConversation.native';
import { neoProfileName } from './neoCommands';
import { matchVoiceClients, type VoiceClient } from './voiceCommands';
import { NATIVE_NEO_AUDIO } from './neoAudio.native';

export function RobotNavigationAssistant() {
  const ready = useAppStartIntroReady(); const auth = useAuth(); const pathname = usePathname(); const permissions = usePermissions(); const tenantId = useServiceTenantId();
  // The current desktop owns Neo. Leaving it unmounts speech and pending work.
  const desktop = pathname === '/business' || pathname === '/business/dashboard' || pathname === '/Desktop' || pathname === '/desktop';
  if (!desktop || !ready || !auth.authReady || !auth.isAuthenticated || !auth.user?.id || !tenantId || !permissions.can('office.access')) return null;
  return <NativeNeo key={`${tenantId}:${auth.user.id}`} tenantId={tenantId} />;
}

function NativeNeo({ tenantId }: { tenantId: string }) {
  const auth = useAuth(); const router = useRouter(); const permissions = usePermissions(); const insets = useSafeAreaInsets();
  const weather = useDesktopWeather(JSON.stringify([tenantId, auth.user!.id]));
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [listening, setListening] = useState(false); const [speaking, setSpeaking] = useState(false); const [speechError, setSpeechError] = useState('');
  const current = useRef({ permissions, auth, weather, router }); current.current = { permissions, auth, weather, router };
  const openRef = useRef(false), alive = useRef(true), recognitionActive = useRef(false), recognitionIntent = useRef(0), generation = useRef(0), lock = useRef(false);
  const player = useRef<AudioPlayer | null>(null), speechFinish = useRef<(() => void) | null>(null), turn = useRef<AbortController | null>(null), resume = useRef<() => void>(() => {});
  const allowedClientIds = useRef(new Set<string>());
  const canSearchClients = () => current.current.permissions.can('office.clients.view') && current.current.permissions.hasModuleGate('office');
  const [conversation] = useState(() => createNeoConversation({
    canNavigate: destination => current.current.permissions.can(destination.permission) && current.current.permissions.hasModuleGate(destination.route.startsWith('/assist') ? 'assist' : 'office'),
    canSearchClients, canGoBack: () => current.current.router.canGoBack(),
    getProfileName: () => neoProfileName(current.current.auth.profile, current.current.auth.user),
    getWeather: async signal => { signal.throwIfAborted(); const data = current.current.weather.data; if (!data) { current.current.weather.refresh(); return 'Ich lade das aktuelle Wetter. Den Ort kannst du auf deinem Desktop auswählen.'; } return `Aktuell sind es ${data.temperature} Grad. ${data.label}. Messstation ${data.station}, Stand ${data.time}.`; },
    searchClients: async name => {
      if (!canSearchClients()) return [];
      const last = name.split(/\s+/).at(-1)!;
      const variants = [...new Set([last, last.replace(/ae/gi, 'ä').replace(/oe/gi, 'ö').replace(/ue/gi, 'ü')])];
      const results = await Promise.all(variants.map(search => fetchClientList(tenantId, current.current.auth.profile?.roleKey, { search, lifecycleFilter: 'all' })));
      if (!alive.current || !openRef.current || !canSearchClients()) return [];
      const found = new Map<string, VoiceClient>();
      for (const result of results) {
        if (!result.ok || !result.data || result.data.length >= 1000) throw new Error('Die Suche konnte nicht sicher abgeschlossen werden.');
        for (const client of result.data) if (client.tenantId === tenantId) found.set(client.id, client);
      }
      const matches = matchVoiceClients(name, [...found.values()]);
      allowedClientIds.current = new Set(matches.map(client => client.id));
      return matches;
    },
  }));
  const stopAudio = () => { speechFinish.current?.(); speechFinish.current = null; player.current?.remove(); player.current = null; void Speech.stop(); };
  const stopSession = () => {
    openRef.current = false; generation.current++; recognitionIntent.current++; recognitionActive.current = false; lock.current = false;
    turn.current?.abort(); turn.current = null; ExpoSpeechRecognitionModule.abort(); stopAudio();
    if (alive.current) { setOpen(false); setBusy(false); setListening(false); setSpeaking(false); }
  };
  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stopSession(); });
    return () => { alive.current = false; stopSession(); subscription.remove(); };
  }, []);

  const say = async (text: string, signal: AbortSignal) => {
    signal.throwIfAborted(); stopAudio(); setSpeaking(true);
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const complete = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', finish); if (speechFinish.current === finish) speechFinish.current = null; if (alive.current) setSpeaking(false); if (error) reject(error); else resolve(); };
      const finish = () => complete();
      const fail = () => complete(new Error('Die Sprachausgabe ist auf diesem Gerät gerade nicht verfügbar. Tippe Neo erneut an.'));
      const timer = setTimeout(fail, 120000); speechFinish.current = finish; signal.addEventListener('abort', finish, { once: true });
      try {
        if (NATIVE_NEO_AUDIO[text]) {
          const audio = createAudioPlayer(NATIVE_NEO_AUDIO[text]); player.current = audio;
          audio.addListener('playbackStatusUpdate', status => { if (status.didJustFinish) finish(); }); audio.play();
        } else Speech.speak(text, { language: 'de-DE', rate: 0.95, onDone: finish, onStopped: finish, onError: fail });
      } catch { fail(); }
    });
    signal.throwIfAborted();
  };
  const command = async (text: string) => {
    if (lock.current || !text.trim() || !openRef.current) return;
    lock.current = true; const serial = ++generation.current, request = new AbortController(); turn.current?.abort(); turn.current = request; setBusy(true); setSpeechError('');
    try {
      const response = await conversation.respond(text, request.signal);
      if (!alive.current || !openRef.current || serial !== generation.current) return;
      await say(response.text, request.signal);
      if (!alive.current || !openRef.current || serial !== generation.current) return;
      if (response.action?.kind === 'navigate') {
        const destination = response.action.destination;
        if (!current.current.permissions.can(destination.permission) || !current.current.permissions.hasModuleGate(destination.route.startsWith('/assist') ? 'assist' : 'office')) throw new Error('Die Freigabe für diesen Bereich hat sich geändert.');
        stopSession(); current.current.router.push(nativeAdministrationRoute(destination.route) as never);
      } else if (response.action?.kind === 'client') {
        if (!canSearchClients() || !allowedClientIds.current.has(response.action.id)) throw new Error('Die Klientenakte kann mit diesem Zugang nicht geöffnet werden.');
        stopSession(); current.current.router.push(`/office/clients/${encodeURIComponent(response.action.id)}` as never);
      } else if (response.action?.kind === 'back') { stopSession(); if (current.current.router.canGoBack()) current.current.router.back(); }
      else if (response.end) stopSession();
    } catch (cause) { if (!request.signal.aborted && alive.current && serial === generation.current) { setSpeechError(cause instanceof Error ? cause.message : 'Neo konnte nicht antworten. Tippe Neo erneut an.'); openRef.current = false; setOpen(false); } }
    finally { if (alive.current && serial === generation.current) { lock.current = false; setBusy(false); if (openRef.current && !request.signal.aborted) resume.current(); } }
  };
  const listen = async () => {
    const intent = ++recognitionIntent.current; setSpeechError('');
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable() || !ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) { openRef.current = false; setOpen(false); setSpeechError('Auf diesem Gerät ist keine lokale Spracherkennung verfügbar. Die Seiten bleiben über Apps und Navigation erreichbar.'); return; }
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!alive.current || intent !== recognitionIntent.current || !openRef.current) return;
      if (!permission.granted) { openRef.current = false; setOpen(false); setSpeechError('Das Mikrofon ist nicht freigegeben. Erlaube CareSuite den Mikrofonzugriff und tippe Neo erneut an.'); return; }
      recognitionActive.current = true; setListening(true);
      ExpoSpeechRecognitionModule.start({ lang: 'de-DE', interimResults: false, continuous: false, requiresOnDeviceRecognition: true, addsPunctuation: false });
    } catch { if (alive.current) { recognitionActive.current = false; openRef.current = false; setOpen(false); setListening(false); setSpeechError('Die lokale Spracherkennung konnte nicht gestartet werden. Tippe Neo erneut an.'); } }
  };
  resume.current = () => { if (alive.current && openRef.current && !lock.current) void listen(); };
  useSpeechRecognitionEvent('start', () => { if (alive.current && recognitionActive.current && openRef.current) setListening(true); });
  useSpeechRecognitionEvent('end', () => { if (alive.current) setListening(false); });
  useSpeechRecognitionEvent('result', event => {
    const text = event.results[0]?.transcript;
    if (event.isFinal && text && alive.current && recognitionActive.current && openRef.current) { recognitionActive.current = false; setListening(false); void command(text); }
  });
  useSpeechRecognitionEvent('error', event => { if (alive.current && recognitionActive.current && openRef.current && event.error !== 'aborted') { recognitionActive.current = false; openRef.current = false; setOpen(false); setListening(false); setSpeechError('Die lokale Spracherkennung ist gerade nicht verfügbar. Tippe Neo erneut an.'); } });
  const activate = () => { if (openRef.current) stopSession(); else { openRef.current = true; setOpen(true); setSpeechError(''); void listen(); } };
  return <View style={[styles.host, { bottom: Math.max(insets.bottom, 12) + 72 }]} pointerEvents="box-none">
    {open || speechError ? <View style={[styles.status, speechError ? styles.errorStatus : null]} accessibilityLiveRegion="polite" accessibilityRole={speechError ? 'alert' : undefined}>
      <View style={[styles.dot, listening && styles.listening, speechError ? styles.errorDot : null]} />
      <Text style={styles.statusText}>{speechError || (speaking ? 'Neo spricht …' : busy ? 'Neo denkt nach …' : listening ? 'Ich höre zu …' : 'Du kannst direkt antworten.')}</Text>
      {open ? <Pressable accessibilityRole="button" accessibilityLabel="Gespräch beenden" onPress={stopSession} style={styles.stop}><Text style={styles.stopText}>×</Text></Pressable> : null}
    </View> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={open ? 'Neo-Gespräch beenden' : 'Neo-Assistent öffnen'} accessibilityHint={open ? 'Beendet Mikrofon und Sprachausgabe.' : 'Antippen und mit Neo sprechen.'} onPress={activate} style={[styles.robot, listening || speaking || busy ? styles.activeRobot : null]}>
      <Image source={CARESUITE_ROBOT_LOGO} style={styles.image} resizeMode="contain" />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', right: 16, alignItems: 'flex-end', gap: 8, zIndex: 160 },
  robot: { width: 68, height: 74, alignItems: 'center', justifyContent: 'center', borderRadius: 34, borderWidth: 2, borderColor: 'transparent' },
  activeRobot: { borderColor: '#39c8f0', backgroundColor: '#47ceff12' },
  image: { width: 64, height: 70 },
  status: { width: 280, maxWidth: '100%', flexDirection: 'row', gap: 9, alignItems: 'flex-start', padding: 12, borderWidth: 1, borderColor: '#c5dcf1', borderRadius: 18, backgroundColor: '#f4faff', elevation: 4 },
  statusText: { color: '#16334d', fontFamily: careSuiteAppFontFamily, fontSize: 13, lineHeight: 20, flexShrink: 1, flexGrow: 1 },
  dot: { width: 8, height: 8, flexShrink: 0, marginTop: 6, borderRadius: 4, backgroundColor: '#1771d4' },
  listening: { backgroundColor: '#09816b' }, errorDot: { backgroundColor: '#b74432' }, errorStatus: { borderColor: '#d6a497' },
  stop: { minWidth: 44, minHeight: 44, marginTop: -8, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
  stopText: { fontSize: 24, lineHeight: 28, color: '#16334d' },
});
