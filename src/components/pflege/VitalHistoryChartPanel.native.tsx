// Generated native presentation from src/components/pflege/VitalHistoryChartPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvg,NativeSvgLine,NativeSvgCircle,NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { EmptyState, InfoBanner, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import { cloneClientNativeOriginal as clone, freezeClientNativeOriginal as freeze } from "../../lib/clients/clientRecordNativeOriginal.native.ts";
import { getVitalDefinition } from '@/lib/pflege/vitalCatalog';
import { vitalTimeDisplay } from "../../lib/pflege/vitalTimeDisplay.native.ts";
import { vitalHistoryViewChartWeb, mayUseVitalHistoryViewChartPointWeb, type VitalHistoryChartCaptureWeb } from "../../lib/pflege/vitalHistoryViewRuntime.native.ts";
import { vitalHistoryNativeTimeWeb } from "../../lib/pflege/vitalHistoryProjection.native.ts";
type Snapshot = NonNullable<ReturnType<typeof vitalHistoryViewChartWeb>>;
type Mark = Snapshot['marks'][number];
const width = 600, height = 240, padding = 28;
/** Private finite display geometry. It carries neither own-read nor clinical authority. */
function vitalChartGeometry(input: Snapshot) { try {
    const data = clone(input);
    if (!data || typeof data !== 'object' || Array.isArray(data) || !['kind', 'authority', 'selection', 'marks', 'undatedIds', 'clinicalCompletion'].every(k => Object.hasOwn(data, k)) || data.kind !== 'current_technical_vital_history_chart' || data.authority !== 'inspection_only' || data.clinicalCompletion !== 'not_inferred' || !data.selection || typeof data.selection !== 'object' || !['type', 'component', 'unit'].every(k => Object.hasOwn(data.selection, k)) || !Array.isArray(data.marks) || !Array.isArray(data.undatedIds) || data.marks.some(m => !m || typeof m !== 'object' || !['id', 'type', 'actual', 'state', 'value', 'reasons'].every(k => Object.hasOwn(m, k)) || typeof m.id !== 'string' || !m.actual || typeof m.actual !== 'object' || !['state', 'raw', 'microseconds'].every(k => Object.hasOwn(m.actual, k))))
        return null;
    const selected = data.marks.filter(m => m.type === data.selection.type), dated = selected.filter(m => m.actual.state === 'valid' && m.actual.microseconds !== null), technical = dated.filter(m => m.state === 'technical_point' && typeof m.value === 'number' && Number.isFinite(m.value));
    let minTime: bigint | null = null, maxTime: bigint | null = null, minValue: number | null = null, maxValue: number | null = null;
    const ids = new Set<string>();
    for (const mark of selected) {
        if (ids.has(mark.id.toLowerCase()))
            return null;
        ids.add(mark.id.toLowerCase());
    }
    for (const mark of dated) {
        const instant = BigInt(mark.actual.microseconds!);
        if (minTime === null || instant < minTime)
            minTime = instant;
        if (maxTime === null || instant > maxTime)
            maxTime = instant;
    }
    for (const mark of technical) {
        const value = mark.value!;
        if (minValue === null || value < minValue)
            minValue = value;
        if (maxValue === null || value > maxValue)
            maxValue = value;
    }
    const ratioX = (microseconds: string) => { if (minTime === null || maxTime === null || minTime === maxTime)
        return 0.5; return Number((BigInt(microseconds) - minTime) * 1000000n / (maxTime - minTime)) / 1000000; };
    const absScale = Math.max(Math.abs(minValue ?? 0), Math.abs(maxValue ?? 0)) || 1, minScaled = (minValue ?? 0) / absScale, maxScaled = (maxValue ?? 0) / absScale;
    const ratioY = (value: number) => minScaled === maxScaled ? 0.5 : (value / absScale - minScaled) / (maxScaled - minScaled);
    const points = technical.map(mark => ({ mark, x: padding + ratioX(mark.actual.microseconds!) * (width - 2 * padding), y: height - padding - ratioY(mark.value!) * (height - 2 * padding) })), markers = dated.filter(m => m.state !== 'technical_point').map(mark => ({ mark, x: padding + ratioX(mark.actual.microseconds!) * (width - 2 * padding) }));
    if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < padding || p.x > width - padding || p.y < padding - 1e-8 || p.y > height - padding + 1e-8) || markers.some(m => !Number.isFinite(m.x) || m.x < padding || m.x > width - padding))
        return null;
    return freeze({ points, markers, unlocated: selected.filter(m => m.actual.state !== 'valid' || m.actual.microseconds === null), otherCount: data.marks.length - selected.length, minValue, maxValue, minTime: minTime?.toString() ?? null, maxTime: maxTime?.toString() ?? null, selection: data.selection, clinicalCompletion: 'not_inferred' });
}
catch {
    return null;
} }
const originalTime = (time: Mark['actual']) => time.state === 'valid' ? vitalTimeDisplay(time.raw).display : `Zeitpunkt nicht bestätigt (${time.state})${typeof time.raw === 'string' ? ` · Original: ${time.raw}` : ''}`;
const reasonLabels: Record<string, string> = { native_invalidation_reference: 'Eigener Korrekturvermerk vorhanden', actual_time_not_confirmed: 'Tatsächlicher Messzeitpunkt nicht bestätigt', numeric_component_not_confirmed: 'Eigene numerische Komponente nicht bestätigt', unit_not_confirmed: 'Einheit nicht kongruent bestätigt', catalog_components_not_confirmed: 'Originalkatalog nicht kongruent bestätigt', collection_extent_not_confirmed: 'Bilanzumfang nicht vollständig bestätigt', unknown_selected_component: 'Komponente nicht bekannt', different_measurement_type: 'Andere Messart' };
const reason = (key: string) => reasonLabels[key] ?? key;
type Period = {
    from: string;
    to: string;
    fromMicroseconds: string;
    toMicroseconds: string;
};
function chartTime(time: Mark['actual'], purpose: Mark['actual']['purpose']) { if (!time || typeof time !== 'object' || Array.isArray(time) || !['purpose', 'state', 'raw', 'microseconds'].every(k => Object.hasOwn(time, k)) || time.purpose !== purpose || !['valid', 'missing', 'undefined', 'null', 'empty', 'invalid'].includes(time.state))
    return false; const calculated = vitalHistoryNativeTimeWeb(time.state === 'missing' ? {} : { value: time.raw }, 'value', purpose); if (time.state === 'invalid' && time.raw === undefined)
    return time.microseconds === null; return !!calculated && calculated.state === time.state && calculated.microseconds === time.microseconds && calculated.raw === time.raw; }
/** Pure descriptor-first derivation. Copied data never grants an original action. */
function vitalChartPeriod(input: Snapshot, range: unknown) {
    try {
        const source = clone(input);
        if (!vitalChartGeometry(source))
            return null;
        const definition = getVitalDefinition(source.selection.type), component = definition?.components.find(c => c.key === source.selection.component);
        if (!component || component.unit !== source.selection.unit)
            return null;
        const ids = new Set<string>();
        for (const mark of source.marks) {
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mark.id) || ids.has(mark.id.toLowerCase()) || mark.type !== null && typeof mark.type !== 'string' || !['unit', 'recorded', 'legacy', 'followUpIds', 'invalidationIds'].every(k => Object.hasOwn(mark, k)) || mark.unit !== null && typeof mark.unit !== 'string' || !chartTime(mark.recorded, 'recorded') || !chartTime(mark.legacy, 'legacy') || [mark.followUpIds, mark.invalidationIds].some(ids => !Array.isArray(ids) || new Set(ids.map(id => typeof id === 'string' ? id.toLowerCase() : id)).size !== ids.length || ids.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) || !['technical_point', 'excluded'].includes(mark.state) || mark.value !== null && (typeof mark.value !== 'number' || !Number.isFinite(mark.value)) || mark.state === 'technical_point' && (mark.type !== source.selection.type || mark.unit !== source.selection.unit || typeof mark.value !== 'number' || !Number.isFinite(mark.value) || mark.actual.state !== 'valid') || mark.state === 'excluded' && mark.value !== null || !Array.isArray(mark.reasons) || mark.reasons.some(r => typeof r !== 'string') || !Object.hasOwn(mark.actual, 'purpose') || mark.actual.purpose !== 'actual')
                return null;
            ids.add(mark.id.toLowerCase());
            if (!chartTime(mark.actual, 'actual'))
                return null;
        }
        if (source.undatedIds.some(id => typeof id !== 'string') || source.undatedIds.length !== source.marks.filter(m => m.actual.microseconds === null).length || source.undatedIds.some((id, i) => id !== source.marks.filter(m => m.actual.microseconds === null)[i].id))
            return null;
        let period: Period | null = null;
        if (range !== null) {
            const candidate = clone(range);
            if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
                return null;
            const supplied = candidate as Record<string, unknown>;
            if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied) || Object.keys(supplied).length !== 2 || !['from', 'to'].every(k => Object.hasOwn(supplied, k) && typeof supplied[k] === 'string'))
                return null;
            const from = vitalHistoryNativeTimeWeb({ value: supplied.from }, 'value', 'actual'), to = vitalHistoryNativeTimeWeb({ value: supplied.to }, 'value', 'actual');
            if (from?.state !== 'valid' || to?.state !== 'valid' || BigInt(from.microseconds!) > BigInt(to.microseconds!))
                return null;
            period = { from: supplied.from as string, to: supplied.to as string, fromMicroseconds: from.microseconds!, toMicroseconds: to.microseconds! };
        }
        const included = (mark: Mark) => mark.actual.state === 'valid' && mark.actual.microseconds !== null && (!period || BigInt(mark.actual.microseconds) >= BigInt(period.fromMicroseconds) && BigInt(mark.actual.microseconds) <= BigInt(period.toMicroseconds));
        const selected = source.marks.filter(m => m.type === source.selection.type), dated = selected.filter(included), unlocated = selected.filter(m => m.actual.state !== 'valid' || m.actual.microseconds === null);
        const positions: {
            microseconds: string;
            originals: {
                id: string;
                raw: string;
                state: string;
            }[];
        }[] = [];
        for (const mark of [...dated].sort((a, b) => BigInt(a.actual.microseconds!) < BigInt(b.actual.microseconds!) ? -1 : BigInt(a.actual.microseconds!) > BigInt(b.actual.microseconds!) ? 1 : 0)) {
            let position = positions.at(-1);
            if (!position || position.microseconds !== mark.actual.microseconds) {
                position = { microseconds: mark.actual.microseconds!, originals: [] };
                positions.push(position);
            }
            position.originals.push({ id: mark.id, raw: mark.actual.raw as string, state: mark.state });
        }
        const intervals = positions.slice(1).map((to, i) => ({ from: positions[i], to, elapsedMicroseconds: (BigInt(to.microseconds) - BigInt(positions[i].microseconds)).toString() }));
        const snapshot = { ...source, marks: source.marks.filter(m => m.type !== source.selection.type || included(m) || unlocated.includes(m)) };
        return freeze({ snapshot, period, positions, intervals, datedIds: dated.map(m => m.id), unlocatedIds: unlocated.map(m => m.id), excludedByPeriod: selected.length - dated.length - unlocated.length, clinicalCompletion: 'not_inferred' });
    }
    catch {
        return null;
    }
}
type ChildFrame = {
    capture: VitalHistoryChartCaptureWeb;
    closed: boolean;
    draft: {
        from: string;
        to: string;
    };
    applied: {
        range: {
            from: string;
            to: string;
        } | null;
    };
    selected: string | null;
    more: {
        count: number;
    };
    error: string | null;
};
function childFrame(capture: VitalHistoryChartCaptureWeb): ChildFrame { return { capture, closed: false, draft: { from: '', to: '' }, applied: { range: null }, selected: null, more: { count: 20 }, error: null }; }
export function VitalHistoryChartPanel({ capture, onReadingPress }: {
    capture: VitalHistoryChartCaptureWeb | null;
    onReadingPress: (id: string) => void;
}) {
    const { c } = useCareLightPalette(), styles = useStyles(), held = useRef<ChildFrame | null>(null), [, redraw] = useState(0);
    const source = capture ? vitalHistoryViewChartWeb(capture) : null;
    if (held.current?.capture !== capture) {
        if (held.current)
            held.current.closed = true;
        held.current = capture && source ? childFrame(capture) : null;
    }
    const frame = held.current, draft = frame?.draft, applied = frame?.applied, moreTicket = frame?.more;
    useEffect(() => { if (!capture || !vitalHistoryViewChartWeb(capture))
        return; let setup = held.current; if (!setup || setup.closed || setup.capture !== capture) {
        setup = childFrame(capture);
        held.current = setup;
        redraw(n => n + 1);
    } const own = setup; return () => { own.closed = true; }; }, [capture]);
    const observation = source ? vitalChartPeriod(source, applied?.range ?? null) : null, data = observation?.snapshot ?? null, geometry = data ? vitalChartGeometry(data) : null, selected = frame?.selected ?? null;
    const own = () => { if (!frame || frame.closed || held.current !== frame || frame.capture !== capture || !capture)
        return false; const current = vitalHistoryViewChartWeb(capture); return !!current && !frame.closed && held.current === frame && frame.capture === capture; };
    const bound = () => own() && frame!.draft === draft && frame!.applied === applied;
    const current = (id: string) => { if (!bound() || !capture || !mayUseVitalHistoryViewChartPointWeb(capture, id))
        return false; const latest = vitalHistoryViewChartWeb(capture), slice = latest ? vitalChartPeriod(latest, applied!.range) : null; return !!slice && (slice.datedIds.includes(id) || slice.unlocatedIds.includes(id)) && bound(); };
    function changeBound(key: 'from' | 'to', value: string) { if (typeof value !== 'string' || !bound())
        return; frame!.draft = { ...draft!, [key]: value }; frame!.selected = null; frame!.error = null; redraw(n => n + 1); }
    function applyPeriod() { if (!bound() || !capture)
        return; const latest = vitalHistoryViewChartWeb(capture), slice = latest ? vitalChartPeriod(latest, draft) : null; if (!bound())
        return; if (!slice) {
        frame!.error = 'Beide Originalgrenzen mit Zeitzone und gültiger Reihenfolge eingeben.';
        redraw(n => n + 1);
        return;
    } frame!.applied = { range: { from: draft!.from, to: draft!.to } }; frame!.selected = null; frame!.more = { count: 20 }; frame!.error = null; redraw(n => n + 1); }
    function clearPeriod() { if (!bound())
        return; frame!.draft = { from: '', to: '' }; frame!.applied = { range: null }; frame!.selected = null; frame!.more = { count: 20 }; frame!.error = null; redraw(n => n + 1); }
    function moreIntervals() { if (!bound() || frame!.more !== moreTicket)
        return; frame!.more = { count: moreTicket!.count + 20 }; redraw(n => n + 1); }
    function inspect(id: string) { if (current(id)) {
        frame!.selected = id;
        redraw(n => n + 1);
    } }
    function open(id: string) { const callback = onReadingPress; if (typeof callback !== 'function' || !current(id))
        return; Reflect.apply(callback, undefined, [id]); }
    function keyPoint(id: string, key: string, prevent: () => void) { const callback = prevent; if (key !== 'Enter' && key !== ' ' || typeof callback !== 'function' || !current(id))
        return; Reflect.apply(callback, undefined, []); if (current(id))
        inspect(id); }
    const selectedMark = selected && data?.marks.find(m => m.id === selected && m.type === data.selection.type), definition = data ? getVitalDefinition(data.selection.type) : null, component = definition?.components.find(c => c.key === data?.selection.component);
    if (!data || !geometry)
        return <SectionPanel title="Technisches Punktdiagramm"><InfoBanner variant="info" message="Aktueller eigener Originalbestand oder ausdrückliche Komponentenauswahl ist nicht bestätigt."/></SectionPanel>;
    return <SectionPanel title={`${definition?.label ?? 'Messart nicht bestätigt'} · ${component?.label ?? 'Komponente nicht bestätigt'} (${data.selection.unit})`}>
  <Text style={styles.note}>Technische Originalpunkte, keine Verbindungslinien, Glättung oder klinische Bewertung. Unbekannte Zeitpunkte werden nicht auf der Achse platziert. Ohne vereinbarte Solltermine sind fehlende Messungen nicht bestimmbar.</Text>
  <View style={styles.detail}><Text style={styles.body}>Zeitraum bewusst auswählen</Text><View style={styles.bounds}><View style={styles.bound}><PremiumInput label="Von · einschließlich" value={draft?.from ?? ''} placeholder="2026-10-08 10:00:00.123456+00:00" onChangeText={value => changeBound('from', value)}/></View><View style={styles.bound}><PremiumInput label="Bis · einschließlich" value={draft?.to ?? ''} placeholder="2026-10-08T12:00:00.123456Z" onChangeText={value => changeBound('to', value)}/></View></View><View style={styles.bounds}><PremiumButton title="Zeitraum anwenden" onPress={applyPeriod}/><PremiumButton title="Ganzen gelieferten Verlauf zeigen" variant="secondary" onPress={clearPeriod}/></View>{frame?.error ? <InfoBanner variant="warning" message={frame.error}/> : null}<Text selectable style={styles.note}>{observation?.period ? `Angewandte Originalgrenzen: ${observation.period.from} bis ${observation.period.to} · einschließlich. ${observation.excludedByPeriod} datierte Originale außerhalb.` : 'Ganze gelieferte Zeitraumansicht; kein Teilzeitraum angewandt.'} Undatierte Originale werden keinem Zeitraum zugeordnet. Liste und Originaldatei bleiben vollständig unverändert.</Text></View>
  <View style={styles.detail}><Text style={styles.body}>Abstände gelieferter Originalzeitpositionen</Text><Text style={styles.note}>Korrekturmarker zählen als Zeitposition. Gleiche Instants behalten alle Kennungen und Originalzeiten. Die Abstände belegen keine fehlenden Sollmessungen oder Versorgungsmängel.</Text>{observation && observation.intervals.length ? observation.intervals.slice(0, moreTicket?.count ?? 20).map(interval => <View style={styles.detail} key={interval.from.microseconds + ':' + interval.to.microseconds}><Text selectable style={styles.body}>{interval.elapsedMicroseconds} µs zwischen gelieferten Positionen</Text><Text selectable style={styles.note}>Von: {interval.from.originals.map(o => `${o.id} · ${o.raw}`).join(' ; ')}</Text><Text selectable style={styles.note}>Bis: {interval.to.originals.map(o => `${o.id} · ${o.raw}`).join(' ; ')}</Text></View>) : <Text style={styles.note}>Weniger als zwei verschiedene bestätigte Zeitpositionen: kein Abstand aus diesem Auszug bestimmbar.</Text>}{observation && observation.intervals.length > (moreTicket?.count ?? 20) ? <PremiumButton title="Weitere Beobachtungsabstände" variant="secondary" onPress={moreIntervals}/> : null}</View>
  {geometry.points.length || geometry.markers.length ? <View style={styles.diagram}>
   <NativeSvg color={c.text} width="100%" height="240" viewBox="0 0 600 240" preserveAspectRatio="xMidYMid meet" accessible={false} accessibilityLabel="Technisches Vitalpunktdiagramm; Punkte und Zeitmarker können mit Tab, Enter oder Leertaste gewählt werden">
    <NativeSvgLine x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" opacity="0.45"/><NativeSvgLine x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" opacity="0.45"/>
    {geometry.points.map(p => <NativeSvgCircle key={p.mark.id} cx={p.x} cy={p.y} r="5" fill="currentColor" accessible accessibilityLabel={`${p.mark.value} ${data.selection.unit} · ${originalTime(p.mark.actual)} · ${p.mark.id}`} onPress={() => inspect(p.mark.id)}></NativeSvgCircle>)}
    {geometry.markers.map(m => <NativeSvgPath key={m.mark.id} d={`M ${m.x - 4} ${height - padding - 5} L ${m.x + 4} ${height - padding + 3} M ${m.x + 4} ${height - padding - 5} L ${m.x - 4} ${height - padding + 3}`} stroke="currentColor" strokeWidth="2" accessible accessibilityLabel={`Zeitmarker ohne bestätigten Zahlenwert · ${originalTime(m.mark.actual)} · ${m.mark.reasons.map(reason).join('; ')} · ${m.mark.id}`} onPress={() => inspect(m.mark.id)}></NativeSvgPath>)}
   </NativeSvg>
   <Text style={styles.note}>Y-Bereich der gelieferten technischen Werte: {geometry.minValue === null ? 'nicht bestätigt' : String(geometry.minValue)} bis {geometry.maxValue === null ? 'nicht bestätigt' : String(geometry.maxValue)} {data.selection.unit}. Dies sind keine Normal- oder Therapiegrenzen.</Text>
   <Text style={styles.note}>X-Achse: bestätigte tatsächliche Originalzeit. {geometry.points.length} Punkte · {geometry.markers.length} Zeitmarker ohne Y-Wert. Gleichzeitige oder sehr nahe Punkte können sich in Pixeln überlagern; alle Kennungen bleiben in den Originalbelegen erhalten.</Text>
  </View> : <EmptyState title="Keine technisch platzierbaren Punkte" message="Unbestätigte oder undatierte Originale bleiben darunter und in der bestehenden Originalliste erhalten."/>}
  {selectedMark ? <View style={styles.detail}><Text style={styles.body}>Originalkennung: {selectedMark.id}</Text><Text style={styles.body}>{originalTime(selectedMark.actual)}</Text><Text style={styles.note}>Erfasst: {originalTime(selectedMark.recorded)} · Historische Zeitmetadaten: {originalTime(selectedMark.legacy)}</Text><Text style={styles.body}>{selectedMark.state === 'technical_point' ? `${selectedMark.value} ${data.selection.unit}` : selectedMark.reasons.map(reason).join('; ')}</Text><Text style={styles.note}>Korrekturkennungen: {selectedMark.invalidationIds.join(', ') || 'keine geliefert'} · Folgebelege: {selectedMark.followUpIds.join(', ') || 'keine geliefert'}</Text><PremiumButton title="Eigenen Originalbeleg öffnen" variant="secondary" onPress={() => open(selectedMark.id)}/></View> : null}
  <View style={styles.detail}><Text style={styles.note}>Gelieferter Zeitraum bestätigter Originalmesszeiten: {originalTime(data.marks.find(m => m.type === data.selection.type && m.actual.microseconds !== null && m.actual.microseconds === geometry.minTime)?.actual ?? { purpose: 'actual', state: 'missing', raw: undefined, microseconds: null })} bis {originalTime(data.marks.find(m => m.type === data.selection.type && m.actual.microseconds !== null && m.actual.microseconds === geometry.maxTime)?.actual ?? { purpose: 'actual', state: 'missing', raw: undefined, microseconds: null })}.</Text></View>
  {geometry.unlocated.length ? <View style={styles.detail}><Text style={styles.body}>{geometry.unlocated.length} Originale ohne bestätigte Kalenderposition</Text>{geometry.unlocated.map(mark => <View key={mark.id} style={styles.detail}><Text style={styles.note}>{mark.id} · {originalTime(mark.actual)} · {mark.reasons.map(reason).join('; ')}</Text><PremiumButton title="Undatierten Originalbeleg öffnen" variant="secondary" onPress={() => open(mark.id)}/></View>)}</View> : null}
  <Text style={styles.note}>{geometry.otherCount} gelieferte Originale außerhalb der ausgewählten Messart, darunter möglicherweise ungeklärte Messarten, bleiben in der bestehenden Liste und der ganzen Originaldatei erhalten. Korrekturen und Folgedokumentationen bestätigen weder Durchführung noch Aufgabenabschluss/Freigabe. Keine vollständige/atomare Pflegefall- oder Verlaufsaussage.</Text>
 </SectionPanel>;
}
function useStyles() { const { c } = useCareLightPalette(); return useMemo(() => StyleSheet.create({ diagram: { minWidth: 0, width: '100%' }, bounds: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, bound: { flexGrow: 1, flexBasis: 280, minWidth: 0 }, body: { ...typography.body, color: c.text }, note: { ...typography.caption, color: c.muted }, detail: { gap: spacing.sm, paddingTop: spacing.sm } }), [c]); }
