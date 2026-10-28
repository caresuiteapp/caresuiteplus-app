// Generated native presentation from src/screens/pflege/ControlAgreementPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { controlAgreementQueue, type ControlAgreement, type ControlLaunch } from '@/lib/pflege/clinicalControlWorklist';
import { controlTaskStatusLabel, controlSourceLabels } from '@/lib/pflege/clinicalControlForm';
import type { ControlSource } from '@/lib/pflege/clinicalControlDomain';
import type { ControlRecord } from '@/lib/pflege/clinicalControlGateway';
import { woundInstant } from '@/lib/pflege/woundCareDomain';
import { useTreatmentCorrectionStyles } from "./TreatmentCorrectionScreen.native.tsx";
type Props = {
    tenant: string;
    client: string;
    sources: ControlSource[] | null;
    records: ControlRecord[] | null;
    now: number;
    loading: boolean;
    error: string | null;
    launch: ControlLaunch | null;
    canCreate: boolean;
    onRefresh: () => void;
    onAdopt: (a: ControlAgreement) => void;
    onOpen: (r: ControlRecord) => void;
};
const labels = { scheduled: 'Im Original vereinbart', pending: 'Im Original Abstimmung offen', not_required: 'Im Original begründet kein Bedarf', completed: 'Im Original Kontrolle erfolgt', unavailable: 'Keine angebundene strukturierte Vereinbarung' };
const date = (v: string) => woundInstant(v) === null ? 'Kein bestätigter Zeitpunkt' : new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
export function ControlAgreementPanel(p: Props) {
    const styles = useTreatmentCorrectionStyles(), [filter, setFilter] = useState(p.launch ? 'linked_source' : 'unassigned'), [search, setSearch] = useState(''), [count, setCount] = useState(20);
    const result = useMemo(() => { try {
        return { data: p.sources && p.records ? controlAgreementQueue(p.sources, p.records, p.tenant, p.client, p.now) : null, error: null };
    }
    catch (e) {
        return { data: null, error: e instanceof Error ? e.message : 'Originalvereinbarungen nicht vollständig lesbar.' };
    } }, [p.sources, p.records, p.tenant, p.client, p.now]);
    const q = result.data, rows = (q?.rows ?? []).filter(r => (filter === 'all' || filter === 'needs_review' && r.needsReview || filter === 'unassigned' && ['scheduled', 'pending'].includes(r.state) && !r.linked.length || filter === 'assigned' && r.linked.length > 0 || filter === 'unavailable' && r.state === 'unavailable' || filter === 'linked_source' && r.source.kind === p.launch?.sourceKind && r.source.id === p.launch?.sourceId && (!p.launch?.evaluationMeasureId || r.evaluationMeasureId === p.launch?.evaluationMeasureId)) && [r.title, r.reason, labels[r.state], controlSourceLabels[r.source.kind], r.source.id].join(' ').toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
    const blocked = p.loading || !!p.error || !!result.error;
    return <View style={styles.group}>
  <InfoBanner variant="info" message="Diese Übersicht zeigt ausdrücklich dokumentierte Vereinbarungen einzelner Originalbelege. Spätere Befunde, Berichtigungen und bereits erfolgte Kontrollen im Quellverlauf prüfen. Eine ältere Vereinbarung begründet keinen automatischen neuen Auftrag. Die Zuordnung zeigt sämtliche zugänglichen Aufträge zum Originalbeleg."/>
  <PremiumInput label="Originalbezeichnung, Vereinbarung oder Belegkennung suchen" accessibilityLabel="Kontrollvereinbarungen suchen" value={search} onChangeText={v => { setSearch(v); setCount(20); }}/>
  <FilterChipGroup wrap value={filter} onChange={v => { setFilter(v); setCount(20); }} options={[...(p.launch ? [{ key: 'linked_source', label: 'Geöffneter Originalbeleg' }] : []), { key: 'needs_review', label: 'Zuordnung erneut prüfen' }, { key: 'unassigned', label: 'Vereinbarung ohne zugeordneten Auftrag' }, { key: 'assigned', label: 'Mit zugeordneten Aufträgen' }, { key: 'unavailable', label: 'Strukturierte Vereinbarung fehlt' }, { key: 'all', label: 'Alle Originalbelege' }]}/>
  {p.loading && !q ? <LoadingState message="Originalvereinbarungen und vollständige Kontrollverläufe werden geladen…"/> : null}
  {p.error || result.error ? <ErrorState message={p.error ?? result.error ?? 'Originalbestand fehlt.'} onRetry={p.onRefresh}/> : null}
  {q ? <><Text style={styles.body}>{q.count} zugängliche Vereinbarungen einschließlich Einzelmaßnahmen · {q.withoutLinkedTask} Originalvereinbarungen ohne zugeordneten Auftrag · {q.needsReview} ohne aktuellen offenen oder durchgeführten Auftrag · {q.unavailable} ohne lesbare strukturierte Vereinbarung · {rows.length} Treffer.</Text>
   {!rows.length ? <InfoBanner variant={p.launch && filter === 'linked_source' ? 'warning' : 'info'} message={p.launch && filter === 'linked_source' ? 'Der geöffnete Originalbeleg ist nicht im aktuellen zugänglichen Quellenbestand. Er kann inzwischen berichtigt oder unzugänglich sein. Keine automatische Übernahme.' : 'Keine passenden Originalvereinbarungen. Suchbegriff oder Filter ändern.'}/> : null}
   {rows.slice(0, count).map(r => <SectionPanel key={r.key} title={r.title}>
    <Text style={styles.body}>{controlSourceLabels[r.source.kind]} · {r.source.id}</Text>{r.evaluationMeasureId ? <Text style={styles.body}>Originalmaßnahme: {r.evaluationMeasureId}</Text> : null}<Text style={styles.body}>{labels[r.state]}{r.occurredAt ? ` · Originalereignis: ${date(r.occurredAt)}` : ''}</Text>
    {r.reason ? <Text style={styles.body}>Originalvereinbarung: {r.reason}</Text> : null}{r.dueAt ? <Text style={styles.body}>Im Original vereinbarte Frist: {date(r.dueAt)}{r.originalOverdue ? ' · Datum erreicht / überschritten' : ''}</Text> : null}
    {r.needsReview && r.linked.length ? <InfoBanner variant="warning" message="Zum aktuellen Originalumfang ist kein offener oder tatsächlich durchgeführter Auftrag zugeordnet. Frühere Aufträge können storniert, nicht erfüllt oder an eine andere Originalfassung gebunden sein. Weiteren Bedarf ausdrücklich prüfen."/> : null}{r.issue ? <InfoBanner variant="warning" message={r.issue}/> : null}
    {r.linked.map(l => <View key={l.record.task.id} style={styles.group}><Text style={styles.body}>Zugeordneter Auftrag: {l.state.title} · {controlTaskStatusLabel(l.state.source.kind, l.state.status)} · {l.record.task.id}</Text>{r.evaluationMeasureId ? <Text style={styles.body}>{l.state.evaluationMeasureId ? 'Auftrag für diese Einzelmaßnahme' : 'Gesamtauftrag umfasst diese Originalmaßnahme'}</Text> : null}{!l.sameOriginal ? <InfoBanner variant="warning" message="Der Auftrag bewahrt eine andere Fassung dieses Originalbelegs. Quellenänderung vor einer weiteren Übernahme prüfen."/> : null}<PremiumButton title="Diesen Auftrag mit vollständigem Verlauf öffnen" variant="secondary" disabled={blocked} onPress={() => p.onOpen(l.record)}/></View>)}
    {!r.linked.length ? <Text style={styles.body}>Kein zugänglicher Auftrag zu diesem Originalbeleg geladen. Dies belegt keine vollständige Prüfung sämtlicher klinischer Folgeereignisse.</Text> : null}
    {p.canCreate && ['scheduled', 'pending'].includes(r.state) ? <><PremiumButton title={r.linked.length ? 'Weiteren individuellen Auftrag ausdrücklich vorbereiten' : 'Originalvereinbarung ausdrücklich in Auftrag übernehmen'} disabled={blocked} onPress={() => p.onAdopt(r)}/>{r.linked.length ? <Text style={styles.body}>Bereits zugeordnete Aufträge prüfen. Eine weitere Übernahme erzeugt einen eigenständigen Auftrag und erledigt keinen bestehenden.</Text> : null}</> : null}
   </SectionPanel>)}{count < rows.length ? <PremiumButton title="Weitere Originalvereinbarungen anzeigen" variant="secondary" onPress={() => setCount(n => n + 20)}/> : null}
  </> : !p.loading && !p.error && !result.error ? <ErrorState message="Originalbestand noch nicht vollständig verfügbar." onRetry={p.onRefresh}/> : null}
  <PremiumButton title="Originalvereinbarungen und Aufträge aktualisieren" variant="secondary" onPress={p.onRefresh}/>
 </View>;
}
