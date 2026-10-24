// Generated native presentation from src/components/pflege/PressurePreventionHistoryPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import { EmptyState, ErrorState, InfoBanner, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import { PRESSURE_INJURY_CLASSIFICATIONS } from '@/lib/pflege/bodyMap3d/pressureInjuryCatalog';
import { mountPressurePreventionPanelWeb, disposePressurePreventionPanelWeb, subscribePressurePreventionPanelWeb, pressurePreventionPanelViewWeb, readPressurePreventionPanelWeb, selectPressurePreventionPanelWeb, expandPressurePreventionPanelWeb, morePressurePreventionPanelWeb, type PressurePreventionPanelToken, type PressurePreventionPanelLifetime } from "../../lib/pflege/pressurePreventionPanelBinding.native.ts";
import type { PressureHistoryField, PressureHistoryTime } from "../../lib/pflege/pressurePreventionHistory.native.ts";
type Props = {
    token: PressurePreventionPanelToken;
};
const labels: Record<string, string> = { positioning: 'Individuelle Positionierung', interval: 'Vereinbartes Intervall', aids: 'Hilfsmittel', mobility: 'Mobilität', cleansing: 'Reinigung', dressing: 'Verband',
    length_cm: 'Länge (cm)', width_cm: 'Breite (cm)', depth_cm: 'Tiefe (cm)', area_cm2: 'Native Fläche (cm²)', undermining_clock_from: 'Unterminierung von (Uhr)', undermining_clock_to: 'Unterminierung bis (Uhr)', undermining_max_depth_cm: 'Tiefe der Unterminierung (cm)',
    granulation: 'Granulation (%)', fibrin: 'Fibrin (%)', nekrose: 'Nekrose (%)' };
function fieldText(field: PressureHistoryField): string {
    if (field.state === 'missing')
        return 'Nicht im gelieferten Bestand enthalten';
    if (field.state === 'null')
        return 'Kein Wert hinterlegt';
    if (field.state === 'empty')
        return 'Leer hinterlegt';
    if (field.state !== 'value')
        return 'Angabe nicht bestätigt';
    return typeof field.value === 'boolean' ? (field.value ? 'Ja' : 'Nein') : String(field.value);
}
function classification(field: PressureHistoryField): string {
    return field.state === 'value' && typeof field.value === 'string' ? PRESSURE_INJURY_CLASSIFICATIONS.find(item => item.id === field.value)?.label ?? field.value : fieldText(field);
}
function TimeRow({ label, time }: {
    label: string;
    time: PressureHistoryTime;
}) {
    const { c } = useCareLightPalette();
    return <View style={staticStyles.time}><DetailInfoRow label={label} value={time.display}/>{time.raw !== null ? <Text selectable style={[staticStyles.rawTime, { color: c.muted }]}>Gelieferte Zeit: {time.raw}</Text> : null}</View>;
}
/** Unbound private read panel. A token is not a route, product release, raw-original prop or clinical permission. */
export function PressurePreventionHistoryPanel({ token }: Props) {
    const { c } = useCareLightPalette();
    const [lifetime, setLifetime] = useState<PressurePreventionPanelLifetime | null>(null), [, invalidate] = useState(0), [contentWidth, setContentWidth] = useState(0);
    useEffect(() => {
        const current = mountPressurePreventionPanelWeb(token);
        setLifetime(current);
        if (!current)
            return;
        const unsubscribe = subscribePressurePreventionPanelWeb(token, current, () => invalidate(value => value + 1));
        const timer = setInterval(() => invalidate(value => value + 1), 1000);
        return () => { clearInterval(timer); unsubscribe(); disposePressurePreventionPanelWeb(token, current); };
    }, [token]);
    const view = lifetime ? pressurePreventionPanelViewWeb(token, lifetime) : null;
    const read = () => { if (lifetime && view)
        void readPressurePreventionPanelWeb(token, lifetime, view); };
    const select = (kind: 'assessment' | 'history', id: string) => { if (lifetime && view)
        selectPressurePreventionPanelWeb(token, lifetime, view, kind, id); };
    const expand = () => { if (lifetime && view)
        expandPressurePreventionPanelWeb(token, lifetime, view); };
    const more = (kind: 'assessment' | 'history') => { if (lifetime && view)
        morePressurePreventionPanelWeb(token, lifetime, view, kind); };
    const styles = StyleSheet.create({ root: { gap: spacing.md, minWidth: 0 }, columns: { gap: spacing.md, minWidth: 0 }, wide: { flexDirection: 'row', alignItems: 'flex-start' },
        column: { flex: 1, minWidth: 0, gap: spacing.sm }, row: { gap: spacing.xs, minWidth: 0, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
        body: { ...typography.body, color: c.text, flexShrink: 1 }, muted: { ...typography.caption, color: c.muted, flexShrink: 1 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 } });
    const selected = view?.selectedAssessment, event = view?.selectedEvent;
    return (<View style={styles.root} onLayout={layout => setContentWidth(Math.max(0, layout.nativeEvent.layout.width))}>
   <SectionPanel title="Gespeicherte Druckentlastungsplanung" subtitle="Befund, Erfassung und Kontrollvereinbarung getrennt prüfen">
    <InfoBanner presentation="inline" variant="info" message="Hier steht der aktuell gelieferte historische Bestand. Eine gespeicherte Planung oder Kontrollvereinbarung bestätigt keine durchgeführte Druckentlastung, Kontrolle oder neue Pflegeaufgabe. Die heutige Zeilenversion ist keine vollständige frühere Planfassung."/>
    {!view ? <LoadingState presentation="inline" message="Eigener historischer Lesebezug wird geprüft…"/> : null}
    {view?.stage === 'blocked' ? <ErrorState presentation="inline" message="Der aktuelle eigene Zugriff ist nicht bestätigt. Den Bereich mit einem neuen eigenen Lesebezug erneut öffnen."/> : null}
    {view?.stage === 'loading' ? <LoadingState presentation="inline" message="Gesamter eigener Befund- und Verlaufbestand wird geladen…"/> : null}
    {view?.stage === 'error' ? <ErrorState presentation="inline" message="Der gesamte eigene Bestand ist ungeklärt. Es wird kein älterer Teilbestand angezeigt." onRetry={view.canRead ? read : undefined}/> : null}
    {view?.stage === 'idle' ? <PremiumButton title="Eigenen gespeicherten Bestand laden" variant="secondary" disabled={!view.canRead} onPress={read}/> : null}
    {view?.stage === 'ready' ? <View style={styles.actions}><PremiumButton title="Gesamten Bestand erneut laden" variant="secondary" onPress={read}/></View> : null}
    {view?.stage === 'ready' ? <Text selectable style={styles.muted}>Befundkennung: {view.markerId}</Text> : null}
   </SectionPanel>
   {view?.stage === 'ready' ? <View style={[styles.columns, contentWidth >= 880 && styles.wide]}>
    <View style={styles.column}><SectionPanel title={`Assessmentangaben (${view.assessmentCount})`}>
     {!view.assessmentCount ? <EmptyState title="Gelieferter Assessmentbestand leer" message="Es sind keine Assessmentzeilen im eigenen Lesestand enthalten. Daraus folgt keine Risiko- oder Leistungsbewertung."/> : null}
     {view.assessmentRows.map(row => <View key={row.id} style={styles.row}>
      <Text style={styles.body}>{classification(row.classification)}</Text><TimeRow label="Assessmentzeit" time={row.assessedAt}/><TimeRow label="Gespeichert" time={row.recordedAt}/>
      <DetailInfoRow label="Native Autorenkennung" value={fieldText(row.assessor)}/><Text selectable style={styles.muted}>Assessmentkennung: {row.id}</Text>
      <PremiumButton title={selected?.id === row.id ? 'Ausgewähltes Assessment' : 'Assessmentangaben auswählen'} variant="secondary" onPress={() => select('assessment', row.id)}/>
     </View>)}
     {view.assessmentRemaining > 0 ? <PremiumButton title={`Weitere Assessmentangaben (${view.assessmentRemaining})`} variant="secondary" onPress={() => more('assessment')}/> : null}
    </SectionPanel></View>
    <View style={styles.column}><SectionPanel title={`Verlaufseinträge (${view.historyCount})`}>
     {!view.historyCount ? <EmptyState title="Gelieferter Verlauf leer" message="Es sind keine Verlaufseinträge im eigenen Lesestand enthalten. Eine vollständige Assessment-Revisionshistorie wird dadurch nicht bestätigt."/> : null}
     {view.historyRows.map(row => <View key={row.id} style={styles.row}>
      <DetailInfoRow label="Gelieferte Ereignisart" value={fieldText(row.eventType)}/><TimeRow label="Erfasst" time={row.recordedAt}/><DetailInfoRow label="Native Autorenkennung" value={fieldText(row.author)}/>
      <Text selectable style={styles.muted}>Verlaufskennung: {row.id}</Text><PremiumButton title={event?.id === row.id ? 'Ausgewählter Verlaufseintrag' : 'Verlaufsangaben auswählen'} variant="secondary" onPress={() => select('history', row.id)}/>
     </View>)}
     {view.historyRemaining > 0 ? <PremiumButton title={`Weitere Verlaufsangaben (${view.historyRemaining})`} variant="secondary" onPress={() => more('history')}/> : null}
    </SectionPanel></View>
   </View> : null}
   {selected ? <SectionPanel title="Ausgewählte Assessmentangaben">
    <DetailInfoRow label="Gelieferte Einordnung" value={classification(selected.classification)}/><DetailInfoRow label="Bei Aufnahme vorhanden" value={fieldText(selected.presentOnAdmission)}/>
    <TimeRow label="Assessmentzeit" time={selected.assessedAt}/><TimeRow label="Gespeichert" time={selected.recordedAt}/><TimeRow label="Änderungsstand der aktuell gelieferten Zeile" time={selected.updatedAt}/>
    <TimeRow label="Gespeicherte Kontrollvereinbarung · keine bestätigte Kontrolle" time={selected.reviewAgreement}/>
    <PremiumButton title={view?.expanded ? 'Weitere Angaben schließen' : 'Plan- und Befundangaben anzeigen'} variant="secondary" onPress={expand}/>
    {view?.expanded ? <View style={styles.root}>
     <SectionPanel title="Individuelle Druckentlastungsplanung · aktuell gelieferte Angaben">{Object.entries(selected.pressureReliefPlan).map(([key, value]) => <DetailInfoRow key={key} label={labels[key] ?? key} value={fieldText(value)}/>)}</SectionPanel>
     <SectionPanel title="Gespeicherte Behandlungsplanung">{Object.entries(selected.treatmentPlan).map(([key, value]) => <DetailInfoRow key={key} label={labels[key] ?? key} value={fieldText(value)}/>)}</SectionPanel>
     <SectionPanel title="Gespeicherte Mess- und Gewebeangaben">{[...Object.entries(selected.measurements), ...Object.entries(selected.tissue)].map(([key, value]) => <DetailInfoRow key={key} label={labels[key] ?? key} value={fieldText(value)}/>)}</SectionPanel>
     <SectionPanel title="Gelieferte Eskalationsmerkmale · kein Kontakt- oder Diagnoseabschluss"><Text selectable style={styles.body}>{selected.escalationFlags.state === 'value' ? selected.escalationFlags.values.join(' · ') : fieldText({ state: selected.escalationFlags.state })}</Text></SectionPanel>
    </View> : null}
   </SectionPanel> : null}
   {event ? <SectionPanel title="Ausgewählter Verlaufseintrag">
    <TimeRow label="Erfasst" time={event.recordedAt}/><DetailInfoRow label="Native Autorenkennung" value={fieldText(event.author)}/>
    <PremiumButton title={view?.expanded ? 'Weitere Angaben schließen' : 'Verlaufsangaben anzeigen'} variant="secondary" onPress={expand}/>
    {view?.expanded ? <View style={styles.root}><Text selectable style={styles.body}>{fieldText(event.note)}</Text><DetailInfoRow label="Gelieferter Assessmentbezug" value={event.assessmentReference.state === 'supplied_reference' ? event.assessmentReference.assessmentId ?? 'Bezug nicht bestätigt' : event.assessmentReference.state === 'not_supplied' ? 'Kein Assessmentbezug geliefert' : 'Bezug ungeklärt'}/><InfoBanner presentation="inline" variant="info" message="Eine gelieferte Ereignisreferenz ist keine vollständige frühere Assessment- oder Planfassung."/></View> : null}
   </SectionPanel> : null}
  </View>);
}
const staticStyles = StyleSheet.create({ time: { gap: spacing.xs, minWidth: 0 }, rawTime: { ...typography.caption, flexShrink: 1 } });
