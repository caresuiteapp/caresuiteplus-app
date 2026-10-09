import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { CareSuiteImage as Image } from '@/components/images/CareSuiteImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
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
import { NativeAction, NativeField, NativeWorkspaceDialog, nativeWorkspaceStyles as ui } from '@/components/ui/NativeWorkspaceUi';
import { createNeoReplies, neoProfileName, parseNeoCommand } from './neoCommands';
import { createReplyPicker } from './robotReplies';
import { matchVoiceClients, parseVoiceCommand, type VoiceClient } from './voiceCommands';
import { NATIVE_NEO_AUDIO } from './neoAudio.native';

export function RobotNavigationAssistant() {
  const ready = useAppStartIntroReady(); const auth = useAuth(); const pathname = usePathname(); const permissions = usePermissions(); const tenantId = useServiceTenantId();
  if (!ready || !auth.authReady || !auth.isAuthenticated || !auth.user?.id || !tenantId || !permissions.can('office.access') || /^\/(auth|portal)(\/|$)/.test(pathname)) return null;
  return <NativeNeo key={`${tenantId}:${auth.user.id}`} tenantId={tenantId} />;
}

function NativeNeo({ tenantId }: { tenantId: string }) {
  const auth = useAuth(); const router = useRouter(); const permissions = usePermissions(); const insets = useSafeAreaInsets();
  const weather = useDesktopWeather(JSON.stringify([tenantId, auth.user!.id]));
  const [open, setOpen] = useState(false); const [input, setInput] = useState(''); const [reply, setReply] = useState('Ich bin Neo. Wohin möchten Sie?');
  const [busy, setBusy] = useState(false); const [listening, setListening] = useState(false); const [audioEnabled, setAudioEnabled] = useState(true);
  const [choices, setChoices] = useState<VoiceClient[]>([]); const [speechError, setSpeechError] = useState('');
  const permissionsRef = useRef(permissions); permissionsRef.current = permissions;
  const openRef = useRef(open); openRef.current = open;
  const recognitionActive = useRef(false); const recognitionIntent = useRef(0);
  const picker = useRef(createReplyPicker()); const neo = useRef(createNeoReplies()); const player = useRef<AudioPlayer | null>(null); const generation = useRef(0); const lock = useRef(false); const alive = useRef(true);
  const stopAudio = () => { player.current?.remove(); player.current = null; void Speech.stop(); };
  const say = (text: string, speak = true) => {
    if (!alive.current) return; setReply(text); stopAudio();
    if (!audioEnabled || !speak) return;
    try { if (NATIVE_NEO_AUDIO[text]) { player.current = createAudioPlayer(NATIVE_NEO_AUDIO[text]); player.current.play(); } else Speech.speak(text, { language: 'de-DE', rate: 0.95, onError: () => { if (alive.current) setSpeechError('Die Sprachausgabe ist auf diesem Gerät gerade nicht verfügbar.'); } }); }
    catch { setSpeechError('Die Sprachausgabe ist auf diesem Gerät gerade nicht verfügbar.'); }
  };
  const answer = (key: Parameters<ReturnType<typeof createReplyPicker>>[0]) => say(picker.current(key).text);
  const close = () => { generation.current++; recognitionIntent.current++; recognitionActive.current = false; openRef.current = false; lock.current = false; setBusy(false); setOpen(false); setChoices([]); setInput(''); ExpoSpeechRecognitionModule.abort(); stopAudio(); };
  useEffect(() => { alive.current = true; const subscription = AppState.addEventListener('change', state => { if (state !== 'active') { generation.current++; recognitionIntent.current++; recognitionActive.current = false; lock.current = false; setBusy(false); setListening(false); ExpoSpeechRecognitionModule.abort(); stopAudio(); } }); return () => { alive.current = false; generation.current++; recognitionIntent.current++; recognitionActive.current = false; ExpoSpeechRecognitionModule.abort(); stopAudio(); subscription.remove(); }; }, []);
  const selectClient = (client: VoiceClient) => {
    if (!permissions.can('office.clients.view') || !permissions.hasModuleGate('office') || !choices.some(item => item.id === client.id)) { answer('denied'); return; }
    answer('clientFound'); setChoices([]); setOpen(false); router.push(`/office/clients/${encodeURIComponent(client.id)}` as never);
  };
  const command = async (text: string) => {
    if (lock.current || !text.trim()) return; lock.current = true; const id = ++generation.current; setBusy(true); setSpeechError('');
    try {
      const small = parseNeoCommand(text);
      if (small) {
        if (small === 'repeat') say(reply);
        else if (small === 'weather') { if (weather.data) say(`Aktuell sind es ${weather.data.temperature} Grad. ${weather.data.label}. Messstation ${weather.data.station}, Stand ${weather.data.time}.`); else { weather.refresh(); say('Ich lade das aktuelle Wetter. Den Ort kannst du auf deinem Desktop auswählen.'); } }
        else say(neo.current(small, neoProfileName(auth.profile, auth.user)));
        return;
      }
      const parsed = parseVoiceCommand(text);
      if (parsed.kind === 'navigate') { const destination = parsed.destination; if (!permissions.can(destination.permission) || !permissions.hasModuleGate(destination.route.startsWith('/assist') ? 'assist' : 'office')) { answer('denied'); return; } answer(destination.key); setOpen(false); setChoices([]); router.push((destination.route === '/' ? '/business' : destination.route) as never); }
      else if (parsed.kind === 'back') { if (router.canGoBack()) { answer('back'); setOpen(false); router.back(); } else answer('noBack'); }
      else if (parsed.kind === 'cancel') { setChoices([]); answer('cancel'); }
      else if (parsed.kind === 'help') answer('help');
      else if (parsed.kind === 'choice') { const chosen = choices[parsed.index]; if (chosen) selectClient(chosen); else answer('unknown'); }
      else if (parsed.kind === 'client') {
        if (!permissions.can('office.clients.view') || !permissions.hasModuleGate('office')) { answer('denied'); return; }
        answer('waiting'); const last = parsed.name.split(/\s+/).at(-1)!; const variants = [...new Set([last, last.replace(/ae/gi, 'ä').replace(/oe/gi, 'ö').replace(/ue/gi, 'ü')])];
        const results = await Promise.all(variants.map(search => fetchClientList(tenantId, auth.profile?.roleKey, { search, lifecycleFilter: 'all' })));
        if (!alive.current || id !== generation.current) return;
        if (!permissionsRef.current.can('office.clients.view') || !permissionsRef.current.hasModuleGate('office')) { answer('denied'); return; }
        const candidates = new Map<string, VoiceClient>(); for (const result of results) { if (!result.ok || !result.data || result.data.length >= 1000) throw new Error('Search unavailable'); for (const client of result.data) { if (client.tenantId === tenantId) candidates.set(client.id, client); } }
        const found = matchVoiceClients(parsed.name, [...candidates.values()]); setChoices(found);
        if (!found.length) answer('notFound'); else if (found.length === 1) { answer('clientFound'); setOpen(false); setChoices([]); router.push(`/office/clients/${encodeURIComponent(found[0].id)}` as never); } else answer('ambiguous');
      } else answer('unknown');
    } catch { if (alive.current && id === generation.current) answer('error'); }
    finally { if (alive.current && id === generation.current) { lock.current = false; setBusy(false); } }
  };
  useSpeechRecognitionEvent('start', () => setListening(true)); useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', event => { const text = event.results[0]?.transcript; if (event.isFinal && text && alive.current && recognitionActive.current && openRef.current) { recognitionActive.current = false; setInput(text); void command(text); } });
  useSpeechRecognitionEvent('error', event => { if (alive.current && event.error !== 'aborted') { setListening(false); setSpeechError('Die lokale Spracherkennung ist gerade nicht verfügbar. Sie können den Befehl eingeben.'); } });
  const listen = async () => {
    const intent = ++recognitionIntent.current;
    setSpeechError(''); stopAudio(); if (listening) { ExpoSpeechRecognitionModule.stop(); return; }
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable() || !ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) { setSpeechError('Auf diesem Gerät ist keine lokale Spracherkennung verfügbar. Geben Sie den Befehl unten ein.'); return; }
    try { const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync(); if (!permission.granted) { setSpeechError('Das Mikrofon ist nicht freigegeben. Sie können den Befehl eingeben.'); return; } if (alive.current && intent === recognitionIntent.current && openRef.current) { recognitionActive.current = true; ExpoSpeechRecognitionModule.start({ lang: 'de-DE', interimResults: false, continuous: false, requiresOnDeviceRecognition: true, addsPunctuation: false }); } }
    catch { setSpeechError('Die lokale Spracherkennung konnte nicht gestartet werden.'); }
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Neo-Assistent öffnen" onPress={() => setOpen(true)} style={{ position: 'absolute', right: 16, bottom: Math.max(insets.bottom, 12) + 72, width: 60, height: 60, borderRadius: 30, backgroundColor: '#123451', borderWidth: 1, borderColor: '#9bcfff', alignItems: 'center', justifyContent: 'center', elevation: 5 }}><Image source={CARESUITE_ROBOT_LOGO} style={{ width: 48, height: 48 }} resizeMode="contain" /></Pressable>
    <NativeWorkspaceDialog visible={open} title="Neo · Ihr App-Assistent" onClose={close}>
      <Text accessibilityLiveRegion="polite" style={ui.body}>{reply}</Text>{speechError ? <Text accessibilityRole="alert" style={ui.error}>{speechError}</Text> : null}
      <NativeField label="Befehl für Neo" value={input} onChangeText={setInput} maxLength={240} placeholder="Zum Beispiel: Kalender öffnen" onSubmitEditing={() => void command(input)} editable={!busy && !listening} />
      <View style={ui.row}><NativeAction label="Ausführen" primary busy={busy} disabled={listening} onPress={() => void command(input)} /><NativeAction label={listening ? 'Aufnahme beenden' : 'Befehl sprechen'} disabled={busy} selected={listening} onPress={() => void listen()} /><NativeAction label={audioEnabled ? 'Ton ausschalten' : 'Ton einschalten'} selected={audioEnabled} onPress={() => { stopAudio(); setAudioEnabled(!audioEnabled); }} /></View>
      {choices.map((client, index) => <NativeAction key={client.id} label={`${index + 1}. ${client.firstName} ${client.lastName}${client.city ? ` · ${client.city}` : ''}`} onPress={() => selectClient(client)} />)}
      <Text style={ui.muted}>Neo öffnet freigegebene Seiten und findet Klientenakten. Gleiche Namen werden zur Auswahl angezeigt. Sprachbefehle werden nur mit lokaler Spracherkennung verarbeitet. Sprachausgabe nutzt lokale Aufnahmen und die Gerätestimme.</Text>
    </NativeWorkspaceDialog>
  </>;
}
