import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { nativeNeoPosition, type NativeNeoPosition } from './neoPosition.native';

class NeoDeviceError extends Error {}

export function RobotNavigationAssistant() {
  const ready = useAppStartIntroReady(); const auth = useAuth(); const pathname = usePathname(); const permissions = usePermissions(); const tenantId = useServiceTenantId();
  // The current desktop owns Neo. Leaving it unmounts speech and pending work.
  const desktop = ['/', '/business', '/business/(tabs)', '/business/dashboard', '/Desktop', '/desktop'].includes(pathname);
  if (!desktop || !ready || !auth.authReady || !auth.isAuthenticated || !auth.user?.id || !tenantId || !permissions.can('office.access')) return null;
  return <NativeNeo key={`${tenantId}:${auth.user.id}`} tenantId={tenantId} />;
}

function NativeNeo({ tenantId }: { tenantId: string }) {
  const auth = useAuth(); const router = useRouter(); const permissions = usePermissions(); const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [moved, setMoved] = useState<NativeNeoPosition | null>(null);
  const position = nativeNeoPosition(width, height, insets, moved);
  const positionRef = useRef(position); positionRef.current = position;
  const dragStart = useRef(position), suppressPressUntil = useRef(0);
  const [needsLanguageModel, setNeedsLanguageModel] = useState(false), [downloading, setDownloading] = useState(false);
  const [statusHeight, setStatusHeight] = useState(0);
  const foreground = useRef(AppState.currentState ?? 'active'), permissionPending = useRef(false), permissionResume = useRef<(() => void) | null>(null);
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
    permissionResume.current?.(); permissionResume.current = null;
    if (alive.current) { setOpen(false); setBusy(false); setListening(false); setSpeaking(false); }
  };
  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', state => {
      foreground.current = state;
      if (state === 'active') { permissionResume.current?.(); permissionResume.current = null; }
      // A system permission prompt may temporarily make the app inactive. A
      // real background transition still cancels everything, including this wait.
      else if (!(state === 'inactive' && permissionPending.current)) stopSession();
    });
    return () => { alive.current = false; stopSession(); subscription.remove(); };
  }, []);

  const stopRef = useRef(stopSession); stopRef.current = stopSession;
  const drag = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.hypot(gesture.dx, gesture.dy) > 7,
    onPanResponderGrant: () => { dragStart.current = positionRef.current; stopRef.current(); },
    onPanResponderMove: (_event, gesture) => setMoved(nativeNeoPosition(width, height, insets, { x: dragStart.current.x + gesture.dx, y: dragStart.current.y + gesture.dy })),
    onPanResponderRelease: () => { suppressPressUntil.current = Date.now() + 400; },
    onPanResponderTerminate: () => { suppressPressUntil.current = Date.now() + 400; },
  }), [width, height, insets.top, insets.bottom, insets.left, insets.right]);

  const say = async (text: string, signal: AbortSignal) => {
    signal.throwIfAborted(); stopAudio(); setSpeaking(true);
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const complete = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', finish); if (speechFinish.current === finish) speechFinish.current = null; if (alive.current) setSpeaking(false); if (error) reject(error); else resolve(); };
      const finish = () => complete();
      const fail = () => complete(new NeoDeviceError('Die Sprachausgabe ist auf diesem Gerät gerade nicht verfügbar. Tippe Neo erneut an.'));
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
  const listen = async (greet = false) => {
    const intent = ++recognitionIntent.current; setSpeechError('');
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable() || !ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) throw new NeoDeviceError('Auf diesem Gerät ist keine lokale Spracherkennung verfügbar. Prüfe den Sprachdienst in den Geräteeinstellungen.');
      permissionPending.current = true;
      let permission;
      try { permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync(); }
      finally { permissionPending.current = false; }
      if (!alive.current || intent !== recognitionIntent.current || !openRef.current) return;
      if (foreground.current === 'inactive') await new Promise<void>(resolve => { permissionResume.current = resolve; });
      if (!alive.current || intent !== recognitionIntent.current || !openRef.current) return;
      if (!permission.granted) { openRef.current = false; setOpen(false); setSpeechError('Das Mikrofon ist nicht freigegeben. Erlaube CareSuite den Mikrofonzugriff und tippe Neo erneut an.'); return; }
      let language = 'de-DE';
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        const languages = await ExpoSpeechRecognitionModule.getSupportedLocales({});
        if (!alive.current || intent !== recognitionIntent.current || !openRef.current) return;
        const installed = languages.installedLocales.find(locale => locale.replace('_', '-').toLowerCase() === 'de-de')
          ?? languages.installedLocales.find(locale => /^de(?:[-_]|$)/i.test(locale));
        if (!installed) { setNeedsLanguageModel(true); throw new NeoDeviceError('Das deutsche Sprachpaket fehlt auf diesem Gerät. Lade es einmal, damit Neo zuhören kann.'); }
        language = installed; setNeedsLanguageModel(false);
      }
      if (greet) {
        const request = new AbortController(); turn.current = request;
        await say('Hallo, ich bin Neo. Wie kann ich dir helfen?', request.signal);
        if (!alive.current || intent !== recognitionIntent.current || !openRef.current) return;
      }
      recognitionActive.current = true; setListening(true);
      ExpoSpeechRecognitionModule.start({ lang: language, interimResults: false, continuous: false, requiresOnDeviceRecognition: true, addsPunctuation: false });
    } catch (cause) { if (alive.current && intent === recognitionIntent.current) { recognitionActive.current = false; openRef.current = false; setOpen(false); setListening(false); setSpeechError(cause instanceof NeoDeviceError ? cause.message : 'Die lokale Spracherkennung konnte nicht gestartet werden. Prüfe den Sprachdienst in den Geräteeinstellungen und tippe Neo erneut an.'); } }
  };
  resume.current = () => { if (alive.current && openRef.current && !lock.current) void listen(); };
  useSpeechRecognitionEvent('start', () => { if (alive.current && recognitionActive.current && openRef.current) setListening(true); });
  useSpeechRecognitionEvent('end', () => { if (alive.current) setListening(false); });
  useSpeechRecognitionEvent('result', event => {
    const text = event.results[0]?.transcript;
    if (event.isFinal && text && alive.current && recognitionActive.current && openRef.current) { recognitionActive.current = false; setListening(false); void command(text); }
  });
  useSpeechRecognitionEvent('error', event => { if (alive.current && recognitionActive.current && openRef.current && event.error !== 'aborted') { recognitionActive.current = false; openRef.current = false; setOpen(false); setListening(false); const missingModel = event.error === 'language-not-supported' && Platform.OS === 'android' && Number(Platform.Version) >= 33; setNeedsLanguageModel(missingModel); setSpeechError(missingModel ? 'Das deutsche Sprachpaket fehlt. Lade es einmal und tippe Neo erneut an.' : 'Die lokale Spracherkennung ist gerade nicht verfügbar. Prüfe den Sprachdienst und tippe Neo erneut an.'); } });
  const downloadModel = async () => {
    if (downloading) return;
    stopSession(); const serial = generation.current; setDownloading(true);
    try {
      const result = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: 'de-DE' });
      if (!alive.current || serial !== generation.current) return;
      setNeedsLanguageModel(result.status !== 'download_success');
      setSpeechError(result.status === 'download_success' ? 'Das Sprachpaket ist bereit. Tippe Neo an, um zu sprechen.' : 'Der Sprachpaket-Download wurde angefordert. Schließe ihn im Gerät ab und tippe Neo erneut an.');
    } catch { if (alive.current && serial === generation.current) setSpeechError('Das Sprachpaket konnte nicht geladen werden. Prüfe den Sprachdienst in den Geräteeinstellungen und versuche es erneut.'); }
    finally { if (alive.current) setDownloading(false); }
  };
  const activate = () => { if (Date.now() < suppressPressUntil.current || downloading) return; if (openRef.current) stopSession(); else { openRef.current = true; setOpen(true); setSpeechError(''); void listen(true); } };
  const statusWidth = Math.min(280, width - insets.left - insets.right - 24);
  const statusLeft = Math.max(insets.left + 12, Math.min(width - insets.right - statusWidth - 12, position.x + 34 - statusWidth / 2)) - position.x;
  const statusTop = Math.max(insets.top + 8, Math.min(position.y + 82, height - insets.bottom - statusHeight - 8)) - position.y;
  return <View testID="native-neo-assistant" style={[styles.host, { left: position.x, top: position.y }]} pointerEvents="box-none">
    {open || speechError ? <View testID="native-neo-status" onLayout={event => setStatusHeight(Math.ceil(event.nativeEvent.layout.height))} style={[styles.status, { width: statusWidth, left: statusLeft, top: statusTop }, speechError ? styles.errorStatus : null]} accessibilityLiveRegion="polite" accessibilityRole={speechError ? 'alert' : undefined}>
      <View style={[styles.dot, listening && styles.listening, speechError ? styles.errorDot : null]} />
      <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.statusText}>{speechError || (speaking ? 'Neo spricht …' : busy ? 'Neo denkt nach …' : listening ? 'Ich höre zu …' : 'Mikrofon wird vorbereitet …')}</Text>
        {needsLanguageModel ? <Pressable accessibilityRole="button" accessibilityLabel="Deutsches Sprachpaket laden" disabled={downloading} onPress={() => { void downloadModel(); }} style={styles.modelAction}><Text style={styles.modelActionText}>{downloading ? 'Sprachpaket wird angefordert …' : 'Deutsches Sprachpaket laden'}</Text></Pressable> : null}
      </View>
      {open ? <Pressable accessibilityRole="button" accessibilityLabel="Gespräch beenden" onPress={stopSession} style={styles.stop}><Text style={styles.stopText}>×</Text></Pressable> : null}
    </View> : null}
    <Pressable {...drag.panHandlers} accessibilityRole="button" accessibilityLabel={open ? 'Neo-Gespräch beenden' : 'Neo-Assistent öffnen'} accessibilityHint={open ? 'Beendet Mikrofon und Sprachausgabe.' : 'Antippen und mit Neo sprechen. Durch Ziehen verschieben.'} accessibilityActions={[{ name: 'reset', label: 'Neo zurücksetzen' }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'reset') { stopSession(); setMoved(null); } }} onPress={activate} style={[styles.robot, listening || speaking || busy ? styles.activeRobot : null]}>
      <Image source={CARESUITE_ROBOT_LOGO} style={styles.image} resizeMode="contain" />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', width: 68, height: 74, alignItems: 'center', zIndex: 160 },
  robot: { width: 68, height: 74, alignItems: 'center', justifyContent: 'center', borderRadius: 34, borderWidth: 2, borderColor: 'transparent' },
  activeRobot: { borderColor: '#39c8f0', backgroundColor: '#47ceff12' },
  image: { width: 64, height: 70 },
  status: { position: 'absolute', flexDirection: 'row', gap: 9, alignItems: 'flex-start', padding: 12, borderWidth: 1, borderColor: '#c5dcf1', borderRadius: 18, backgroundColor: '#f4faff', elevation: 4 },
  statusText: { color: '#16334d', fontFamily: careSuiteAppFontFamily, fontSize: 13, lineHeight: 20 },
  modelAction: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 }, modelActionText: { color: '#165aa4', fontFamily: careSuiteAppFontFamily, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  dot: { width: 8, height: 8, flexShrink: 0, marginTop: 6, borderRadius: 4, backgroundColor: '#1771d4' },
  listening: { backgroundColor: '#09816b' }, errorDot: { backgroundColor: '#b74432' }, errorStatus: { borderColor: '#d6a497' },
  stop: { minWidth: 44, minHeight: 44, marginTop: -8, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
  stopText: { fontSize: 24, lineHeight: 28, color: '#16334d' },
});
