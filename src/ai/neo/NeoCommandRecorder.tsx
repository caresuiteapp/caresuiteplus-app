import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { PremiumButton } from './neoUi';
import type { NeoScope } from './neoDomain';
import { createNeoCapture } from './neoCapture';
import type { NeoCapture, NeoCaptureSource } from './neoCaptureTypes';
import { checkNeoService, transcribeNeoAudio } from './neoGateway';

export function NeoCommandRecorder({ scope, disabled, onCommand, onBusyChange }: { scope: NeoScope; disabled: boolean; onCommand(text: string): void; onBusyChange?(busy: boolean): void }) {
  const [source, setSource] = useState<NeoCaptureSource>('own'), [active, setActive] = useState(false), [message, setMessage] = useState('');
  const engine = useRef<NeoCapture | null>(null), check = useRef<AbortController | null>(null), generation = useRef(0), alive = useRef(true), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), running = useRef(false);
  const latest = useRef({ onCommand, disabled, onBusyChange }); latest.current = { onCommand, disabled, onBusyChange };
  const cancel = () => { generation.current++; engine.current?.cancel(); engine.current = null; check.current?.abort(); clearTimeout(timer.current); running.current = false; latest.current.onBusyChange?.(false); if (alive.current) setActive(false); };
  useEffect(() => {
    alive.current = true; const subscription = AppState.addEventListener('change', state => { if (state !== 'active') cancel(); });
    const visibility = () => { if (document.hidden) cancel(); };
    if (Platform.OS === 'web') { document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', cancel); }
    return () => { alive.current = false; cancel(); subscription.remove(); if (Platform.OS === 'web') { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', cancel); } };
  }, []);
  useEffect(() => { if (disabled) cancel(); }, [disabled]);
  async function toggle() {
    if (running.current) { const serial = generation.current; await engine.current?.stop(); if (serial === generation.current) cancel(); return; }
    if (disabled) return;
    const serial = ++generation.current; running.current = true; setActive(true); setMessage(''); latest.current.onBusyChange?.(true);
    const chunks: string[] = [];
    try {
      if (source === 'own') { const request = new AbortController(); check.current = request; if (!await checkNeoService(scope, request.signal)) throw Error('Der eigene NEO-Sprachdienst ist noch nicht eingerichtet.'); }
      if (!alive.current || serial !== generation.current || latest.current.disabled) return;
      engine.current = createNeoCapture(source, {
        transcribe: (wav, signal) => transcribeNeoAudio(scope, wav, signal), onStatus: () => {},
        onText: text => { if (alive.current && serial === generation.current) { chunks.push(text); latest.current.onCommand(chunks.join(' ').slice(0, 2000)); } },
        onError: text => { if (serial === generation.current && alive.current) { cancel(); setMessage(text); } },
      });
      await engine.current.start();
      if (serial === generation.current) timer.current = setTimeout(() => { cancel(); setMessage('Sprachauftrag nach 60 Sekunden beendet. Bitte den erfassten Text prüfen.'); }, 60000);
    } catch (error) { if (alive.current && serial === generation.current) { cancel(); setMessage(error instanceof Error ? error.message : 'Die Aufnahme konnte nicht beginnen.'); } }
  }
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <PremiumButton title={active ? 'Sprachauftrag abschließen' : 'Arbeitsauftrag sprechen'} disabled={disabled} onPress={() => void toggle()} />
      <PremiumButton title={source === 'own' ? 'Erkennung: Eigener NEO-Dienst' : 'Erkennung: Gerät / Browser'} variant="secondary" disabled={disabled || active} onPress={() => setSource(value => value === 'own' ? 'device' : 'own')} />
      {active ? <PremiumButton title="Aufnahme sofort abbrechen" variant="secondary" onPress={cancel} /> : null}
    </View>
    {source === 'device' && Platform.OS === 'web' ? <Text style={{ color: '#FFE2A3', lineHeight: 22 }}>Die Browsererkennung kann Audiodaten an den Browseranbieter übertragen.</Text> : null}
    {active || message ? <Text accessibilityLiveRegion="polite" style={{ color: '#D9EBF5', lineHeight: 22 }}>{message || 'Mikrofon aktiv. Anschließend Text und Auftrag prüfen.'}</Text> : null}
  </View>;
}
