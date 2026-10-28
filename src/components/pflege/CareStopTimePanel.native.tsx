// Generated native presentation from src/components/pflege/CareStopTimePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import type { RoleKey } from '@/types';
import { fetchCareStopTimeContext, fetchPortalCareStopTimeContext, recordCareStopTimeEvent, recordPortalCareStopTimeEvent, type CareStopTimeContext } from '@/lib/pflege/careStopTimeService';
import { formatTime } from '@/lib/formatters/dateTimeFormatters';
const labels = { start: 'Beginn', pause: 'Pause', resume: 'Fortsetzung', end: 'Ende', correction: 'Korrektur' } as const;
export function CareStopTimePanel({ stopId, tenantId, role, portal = false, disabled, onChanged }: {
    stopId: string;
    tenantId?: string | null;
    role?: RoleKey | null;
    portal?: boolean;
    disabled?: boolean;
    onChanged: () => void | Promise<void>;
}) {
    const { c } = useCareLightPalette();
    const [context, setContext] = useState<CareStopTimeContext | null>(null);
    const [location, setLocation] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const alive = useRef(true);
    async function load() { if (!portal && !tenantId)
        return; setBusy(true); setError(''); const r = portal ? await fetchPortalCareStopTimeContext(stopId) : await fetchCareStopTimeContext(tenantId!, role, stopId); if (!alive.current)
        return; setBusy(false); if (!r.ok)
        setError(r.error);
    else
        setContext(r.data); }
    useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [stopId, tenantId, role, portal]);
    async function record(kind: 'pause' | 'resume' | 'end') { if (!context || busy || (!portal && !tenantId))
        return; setBusy(true); setError(''); const r = portal ? await recordPortalCareStopTimeEvent(context, kind, location) : await recordCareStopTimeEvent(tenantId!, role, context, kind, location); if (!alive.current)
        return; if (!r.ok) {
        setBusy(false);
        setError(r.error);
        return;
    } setLocation(''); await load(); await onChanged(); }
    const next = context?.state === 'running' ? ['pause', 'end'] as const : context?.state === 'paused' ? ['resume'] as const : [] as const;
    return <SectionPanel title="Tatsächlicher Zeitverlauf" subtitle="Serverzeit · Originalereignisse bleiben unverändert">
    {busy && !context ? <LoadingState message="Zeitverlauf wird geladen…"/> : null}{error ? <ErrorState message={error} onRetry={() => void load()}/> : null}
    {context ? <><Text style={{ color: c.muted }}>Geplant: {context.plannedStart.slice(0, 5)}–{context.plannedEnd.slice(0, 5)} · Zustand: {context.state === 'running' ? 'läuft' : context.state === 'paused' ? 'pausiert' : context.state === 'ended' ? 'beendet' : 'nicht begonnen'}</Text>
      {context.events.map((event) => <Text key={event.id} style={{ color: c.text }}>{formatTime(event.occurredAt)} · {labels[event.kind]} · {event.recordedByName}{typeof event.locationContext.label === 'string' && event.locationContext.label ? ` · ${event.locationContext.label}` : ''}{event.kind === 'correction' ? ` · Grund: ${event.correctionReason ?? ''}` : ''}</Text>)}
      {!context.events.length ? <Text style={{ color: c.muted }}>Noch kein tatsächliches Zeitereignis gespeichert.</Text> : null}
      {next.length ? <><PremiumInput label="Standortkontext (optional, keine GPS-Bestätigung)" value={location} onChangeText={setLocation} editable={!busy && !disabled}/>
        {next.map((kind) => <PremiumButton key={kind} title={kind === 'pause' ? 'Pause beginnen' : kind === 'resume' ? 'Versorgung fortsetzen' : 'Versorgungszeit beenden'} disabled={busy || disabled} loading={busy} onPress={() => void record(kind)}/>)}</> : null}
      <Text style={{ color: c.muted }}>Eine Zeitkorrektur überschreibt kein Originalereignis und benötigt serverseitig einen eigenen Grund. Leistungsdokumentation und Freigabe erfolgen getrennt.</Text></> : null}
  </SectionPanel>;
}
