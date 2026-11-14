// Generated native presentation from src/screens/pflege/VitalReadingsListScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { shareNativeFile } from '@/lib/platform/nativeFileDelivery.native';
import { useMemo, useState, useRef, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import { VitalHistoryChartPanel } from "../../components/pflege/VitalHistoryChartPanel.native.tsx";
import { VitalMeasurementArtwork } from '@/components/pflege/VitalMeasurementArtwork';
import { getVitalDefinition } from '@/lib/pflege/vitalCatalog';
import { stageVitalCaptureClient } from '@/lib/pflege/vitalCaptureHandoff';
import { vitalTimeDisplay } from "../../lib/pflege/vitalTimeDisplay.native.ts";
import { createVitalHistoryViewRuntimeWeb, captureVitalHistoryViewReadWeb, closeVitalHistoryViewRuntimeWeb, createVitalHistoryViewWeb, closeVitalHistoryViewWeb, bindVitalHistoryViewQueryWeb, beginVitalHistoryViewChoicesWeb, acceptVitalHistoryViewChoicesWeb, vitalHistoryViewPeopleWeb, captureVitalHistoryViewActionWeb, selectVitalHistoryViewClientWeb, selectVitalHistoryViewComponentWeb, clearVitalHistoryViewSelectionWeb, captureVitalHistoryViewFetchWeb, fetchVitalHistoryViewWeb, vitalHistoryViewRowsWeb, vitalHistoryViewCsvWeb, mayUseVitalHistoryViewActionWeb, mayUseVitalHistoryChoiceActionWeb, mayReloadVitalHistoryViewWeb, mayReloadVitalHistoryChoicesWeb, vitalHistoryViewManageWeb, captureVitalHistoryViewChartWeb, type VitalHistoryViewWeb } from "../../lib/pflege/vitalHistoryViewRuntime.native.ts";
import { fetchVitalHistoryClientsOriginalReadWeb } from "../../lib/pflege/vitalHistoryClientsOriginalRead.native.ts";
type PermissionFeedback = Pick<ReturnType<typeof usePermissions>, 'loading' | 'error' | 'refreshPermissions'>;
type CaptureScope = {
    tenantId: string;
    profileId: string;
    roleKey: string;
};
const CLIENT_PAGE = 8;
const READING_PAGE = 25;
const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase('de')
    .replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const time = (raw: unknown, state?: string) => { if (state === 'missing')
    return 'Zeitpunkt nicht bestätigt – Originalzeit wurde nicht geliefert'; const display = vitalTimeDisplay(raw); return display.state === 'valid' ? display.display : `Zeitpunkt nicht bestätigt (${display.state})${typeof raw === 'string' ? ` · Original: ${raw}` : ''}`; };
const measurementLabel = (raw: unknown) => typeof raw === 'string' && raw.trim() ? getVitalDefinition(raw)?.label ?? raw : 'Messart nicht bestätigt';
function flags<T>(query: ReturnType<typeof useAsyncQuery<T>>) { const fallback = Object.getOwnPropertyDescriptor(query.cacheMeta, 'usedDemoFallback'); return { loading: query.loading, refreshing: query.refreshing, error: query.error !== null, refreshError: query.refreshError !== null, previewData: query.previewData, tableMissing: query.tableMissing, fromCache: query.cacheMeta.fromCache, partialDetail: query.cacheMeta.partialDetail === true, usedDemoFallback: !!fallback && (!Object.hasOwn(fallback, 'value') || fallback.value !== false) }; }
export function VitalReadingsListScreen({ onReadingPress, selectedId }: {
    onReadingPress?: (id: string) => void;
    selectedId?: string | null;
    embedded?: boolean;
} = {}) {
    const auth = useAuth(), tenantId = useServiceTenantId(), permissions = usePermissions(), live = useRef({ auth, tenantId, permissions, alive: true });
    live.current = { auth, tenantId, permissions, alive: true };
    const held = useRef<{
        key: string;
        runtime: ReturnType<typeof createVitalHistoryViewRuntimeWeb>;
        scope: object | null;
        view: VitalHistoryViewWeb | null;
        version: number;
    } | null>(null), key = JSON.stringify([tenantId, auth.profile?.id, auth.profile?.roleKey]);
    if (!held.current || held.current.key !== key) {
        if (held.current) {
            closeVitalHistoryViewWeb(held.current.view ?? {});
            closeVitalHistoryViewRuntimeWeb(held.current.runtime);
        }
        const runtime = createVitalHistoryViewRuntimeWeb({ auth: () => live.current.auth, tenantId: () => live.current.tenantId, permissions: () => Object.freeze({ tenantId: live.current.permissions.tenantId, roleKey: live.current.permissions.roleKey, can: live.current.permissions.can }), alive: () => live.current.alive });
        held.current = { key, runtime, scope: null, view: null, version: 0 };
    }
    const current = held.current, scope = captureVitalHistoryViewReadWeb(current.runtime);
    if (current.scope !== scope) {
        if (current.view)
            closeVitalHistoryViewWeb(current.view);
        current.scope = scope;
        current.view = scope ? createVitalHistoryViewWeb(current.runtime, scope) : null;
        current.version++;
    }
    useEffect(() => () => { live.current.alive = false; if (held.current) {
        closeVitalHistoryViewWeb(held.current.view ?? {});
        closeVitalHistoryViewRuntimeWeb(held.current.runtime);
    } }, []);
    const profile = auth.profile;
    const handoffScope = tenantId && profile?.tenantId === tenantId && profile.id && profile.roleKey
        ? { tenantId, profileId: profile.id, roleKey: profile.roleKey } : null;
    return <VitalHistoryWorkspace key={`${key}:${current.version}`} capture={current.view} scope={scope} handoffScope={handoffScope} permissionState={{ loading: permissions.loading || auth.isLoading || !auth.authReady, error: permissions.error, refreshPermissions: permissions.refreshPermissions }} onReadingPress={onReadingPress} selectedId={selectedId}/>;
}
function VitalHistoryWorkspace({ capture, scope, handoffScope, permissionState, onReadingPress, selectedId }: {
    capture: VitalHistoryViewWeb | null;
    scope: object | null;
    handoffScope: CaptureScope | null;
    permissionState: PermissionFeedback;
    onReadingPress?: (id: string) => void;
    selectedId?: string | null;
}) {
    const router = useRouter(), styles = useStyles(), alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const [clientId, setClientId] = useState(''), [search, setSearch] = useState(''), [clientLimit, setClientLimit] = useState(CLIENT_PAGE), [pickerExpanded, setPickerExpanded] = useState(true);
    const [type, setType] = useState('all'), [component, setComponent] = useState(''), [visible, setVisible] = useState(READING_PAGE);
    const [expandedId, setExpandedId] = useState<string | null>(null), [exportError, setExportError] = useState<string | null>(null);
    const clients = useAsyncQuery(async () => { try {
        if (!alive.current || !capture || !scope)
            throw Error();
        const originalScope = beginVitalHistoryViewChoicesWeb(capture);
        if (originalScope !== scope)
            throw Error();
        const data = await fetchVitalHistoryClientsOriginalReadWeb(originalScope);
        if (!alive.current)
            throw Error();
        acceptVitalHistoryViewChoicesWeb(capture, data);
        return { ok: true as const, data };
    }
    catch {
        return { ok: false as const, error: 'Die Klientenauswahl konnte nicht geladen werden.' };
    } }, [capture, scope], { enabled: !!capture && !!scope, queryKey: `vital-history-clients`, retryCount: 0 });
    if (capture)
        bindVitalHistoryViewQueryWeb(capture, 'clients', clients.data, flags(clients));
    const people = capture ? vitalHistoryViewPeopleWeb(capture) : null, fetchScope = capture ? captureVitalHistoryViewFetchWeb(capture) : null;
    const history = useAsyncQuery(async () => { try {
        if (!alive.current || !fetchScope)
            throw Error();
        const data = await fetchVitalHistoryViewWeb(fetchScope);
        if (!alive.current)
            throw Error();
        return { ok: true as const, data };
    }
    catch {
        return { ok: false as const, error: 'Der Verlauf mit seinen Originaleinträgen konnte nicht geladen werden.' };
    } }, [capture, scope, fetchScope], { enabled: !!capture && !!fetchScope, queryKey: `vital-history:${clientId}`, retryCount: 0 });
    if (capture)
        bindVitalHistoryViewQueryWeb(capture, 'history', history.data, flags(history));
    const entries = capture ? vitalHistoryViewRowsWeb(capture) : null, choiceAction = capture ? captureVitalHistoryViewActionWeb(capture) : null, historyAction = capture ? captureVitalHistoryViewActionWeb(capture, true) : null;
    const person = people?.find(c => c.id === clientId), needle = normalizeSearch(search);
    const filteredPeople = people?.filter(p => normalizeSearch(p.name).includes(needle)) ?? [];
    const readingCounts = new Map<string, number>();
    for (const entry of entries ?? [])
        readingCounts.set(entry.type, (readingCounts.get(entry.type) ?? 0) + 1);
    const types = [...readingCounts.keys()];
    const definition = type === 'all' ? null : getVitalDefinition(type), filtered = (entries ?? []).filter(e => type === 'all' || e.type === type);
    const chartCapture = useMemo(() => historyAction && component ? captureVitalHistoryViewChartWeb(historyAction) : null, [historyAction, component]);
    const current = () => alive.current && !!historyAction && mayUseVitalHistoryViewActionWeb(historyAction);
    function choose(id: string) { if (!alive.current)
        return; if (id === clientId) {
        if (mayUseVitalHistoryChoiceActionWeb(choiceAction))
            setPickerExpanded(false);
        return;
    } if (!selectVitalHistoryViewClientWeb(choiceAction, id))
        return; setClientId(id); setType('all'); setComponent(''); setVisible(READING_PAGE); setExpandedId(null); setExportError(null); setPickerExpanded(false); }
    function filterClients(value: string) { if (alive.current && mayUseVitalHistoryChoiceActionWeb(choiceAction)) {
        setSearch(value);
        setClientLimit(CLIENT_PAGE);
    } }
    function togglePicker() { if (alive.current && mayUseVitalHistoryChoiceActionWeb(choiceAction)) {
        setPickerExpanded(open => !open);
        setSearch('');
        setClientLimit(CLIENT_PAGE);
    } }
    function moreClients() { if (alive.current && mayUseVitalHistoryChoiceActionWeb(choiceAction))
        setClientLimit(n => n + CLIENT_PAGE); }
    function chooseType(id: string) { if (id === type || !alive.current || !clearVitalHistoryViewSelectionWeb(historyAction))
        return; setType(id); setComponent(''); setVisible(READING_PAGE); setExpandedId(null); setExportError(null); }
    function chooseComponent(id: string) { const selected = definition?.components.find(c => c.key === id); if (!alive.current || !selected || !selectVitalHistoryViewComponentWeb(historyAction, { type, component: id, unit: selected.unit }))
        return; setComponent(id); setExportError(null); }
    async function reload(kind: 'clients' | 'history') { if (!alive.current)
        return; if (kind === 'history' && !mayReloadVitalHistoryViewWeb(fetchScope) || kind === 'clients' && (!capture || !mayReloadVitalHistoryChoicesWeb(capture)))
        return; await (kind === 'clients' ? clients.refresh() : history.refresh()); }
    function open(id: string) { const handler = onReadingPress ?? router.push; if (typeof handler !== 'function' || !alive.current || !mayUseVitalHistoryViewActionWeb(historyAction, id))
        return; Reflect.apply(handler, onReadingPress ? undefined : router, [onReadingPress ? id : `/pflege/vitalwerte/${id}`]); }
    function create() { const push = router.push; if (typeof push !== 'function' || !alive.current || !capture || !handoffScope || !person || !mayUseVitalHistoryChoiceActionWeb(choiceAction) || !vitalHistoryViewManageWeb(capture) || !mayUseVitalHistoryChoiceActionWeb(choiceAction))
        return; stageVitalCaptureClient(handoffScope, person.id); Reflect.apply(push, router, ['/pflege/vitalwerte/create']); }
    function toggleDetails(id: string) { if (alive.current && mayUseVitalHistoryViewActionWeb(historyAction, id))
        setExpandedId(current => current === id ? null : id); }
    function more() { if (current())
        setVisible(n => n + READING_PAGE); }
    async function download() { setExportError(null); if (!alive.current || !component || !current())
        return; try {
        const csv = vitalHistoryViewCsvWeb(historyAction);
        if (csv === null || !current())
            throw Error();
        await shareNativeFile(csv, 'vitalwertverlauf-originale.csv', 'text/csv');
    }
    catch {
        if (alive.current)
            setExportError('Originalexport konnte nicht mit aktuellem Zugriff gestartet werden. Bitte neu laden und ausdrücklich auswählen.');
    } }
    if (!capture)
        return <ScreenShell title="Vitalwerte">{permissionState.loading ? <LoadingState message="Berechtigungen werden geprüft…"/> : permissionState.error ? <ErrorState message={permissionState.error} onRetry={permissionState.refreshPermissions}/> : <ErrorState message="Aktuelle eigene Leseberechtigung für Vitalwerte fehlt."/>}</ScreenShell>;
    const canCreate = !!person && !!handoffScope && !!choiceAction && vitalHistoryViewManageWeb(capture);
    const historyCount = entries ? entries.length : null;
    const shownClients = filteredPeople.slice(0, clientLimit);
    return (<ScreenShell title="Vitalwerte" subtitle="Messungen und Verlauf je Pflegeakte" compactHeader>
   <View style={styles.content}>
    <View style={styles.columns}>
     <View style={styles.clientColumn}>
      <SectionPanel title="1 · Pflegeakte" subtitle={person ? undefined : 'Wählen Sie die Person aus, deren Vitalwerte Sie sehen möchten.'}>
       {clients.loading || clients.refreshing ? (<LoadingState message="Klient:innen werden geladen…"/>) : clients.error || clients.refreshError ? (<ErrorState message={clients.error ?? clients.refreshError ?? ''} onRetry={() => reload('clients')}/>) : !people ? (<InfoBanner variant="info" message="Die Klientenauswahl ist noch nicht bestätigt."/>) : !people.length ? (<View style={styles.stack}>
         <EmptyState title="Keine aktiven Pflegezuordnungen" message="Hier erscheinen Klient:innen, die dem Pflegemodul aktiv zugeordnet sind und für dieses Konto sichtbar sind."/>
         <PremiumButton title="Zuordnungen neu laden" variant="secondary" onPress={() => reload('clients')}/>
        </View>) : person && !pickerExpanded ? (<View style={styles.stack}>
         <View style={styles.identityCard}>
          <Text style={styles.eyebrow}>Ausgewählte Pflegeakte</Text>
          <Text style={styles.personTitle}>{person.name}</Text>
         </View>
         <PremiumButton title="Auswahl ändern" variant="secondary" onPress={togglePicker}/>
        </View>) : (<View style={styles.stack}>
         <PremiumInput label="Name suchen" accessibilityLabel="Klientenliste nach Namen filtern" value={search} onChangeText={filterClients} placeholder="Vor- oder Nachname" autoCorrect={false}/>
         {filteredPeople.length ? (<>
           <Text style={styles.note}>{shownClients.length} von {filteredPeople.length} {needle ? 'Treffern' : 'Pflegeakten'}</Text>
           <View style={styles.clientList}>
            {shownClients.map(p => {
                    const selected = p.id === clientId;
                    return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name} accessibilityState={{ selected }} onPress={() => choose(p.id)} style={({ pressed }) => [styles.clientRow, pressed && styles.pressed, selected && styles.selected]}>
              <Text style={styles.clientName}>{p.name}</Text>
              <Text style={styles.eyebrow}>{selected ? 'Ausgewählt' : 'Auswählen ›'}</Text>
             </Pressable>;
                })}
           </View>
           {shownClients.length < filteredPeople.length ? <PremiumButton title="Weitere Pflegeakten anzeigen" variant="secondary" onPress={moreClients}/> : null}
          </>) : (<View style={styles.stack}>
           <EmptyState title="Keine Treffer" message="Suchen Sie nach einem anderen Namen."/>
           <PremiumButton title="Suche zurücksetzen" variant="secondary" onPress={() => filterClients('')}/>
          </View>)}
         {person ? <PremiumButton title="Auswahl schließen" variant="ghost" onPress={togglePicker}/> : null}
        </View>)}
      </SectionPanel>
     </View>

     <View style={styles.historyColumn}>
      <SectionPanel title="2 · Messungen" subtitle={person ? 'Neue Messung erfassen oder bisherige Werte ansehen.' : undefined}>
       {!person ? (<View style={styles.placeholder}>
         <Text style={styles.subtitle}>Wählen Sie zuerst eine Pflegeakte aus.</Text>
         <Text style={styles.body}>Danach können Sie den Verlauf ansehen. Mit Schreibrecht können Sie von hier eine Messung erfassen.</Text>
        </View>) : (<View style={styles.stack}>
         <View style={styles.actionBar}>
          <View style={styles.actionIdentity}>
           <Text style={styles.eyebrow}>Verlauf für</Text>
           <Text style={styles.personTitle}>{person.name}</Text>
           {historyCount !== null ? <Text style={styles.note}>{historyCount} {historyCount === 1 ? 'Messung' : 'Messungen'} geladen</Text> : null}
          </View>
          <View style={styles.actions}>
           {canCreate ? <PremiumButton title="Messung erfassen" onPress={create}/> : null}
           <PremiumButton title="Verlauf aktualisieren" variant="secondary" loading={history.refreshing} disabled={!mayReloadVitalHistoryViewWeb(fetchScope)} onPress={() => reload('history')}/>
          </View>
         </View>

         {history.loading || history.refreshing ? (<LoadingState message="Messungen, Folgedokumentationen und Korrekturvermerke werden geladen…"/>) : history.error || history.refreshError ? (<ErrorState message={history.error ?? history.refreshError ?? ''} onRetry={() => reload('history')}/>) : !entries ? (<InfoBanner variant="info" message="Der aktuelle Verlauf ist noch nicht bestätigt. Laden Sie ihn erneut."/>) : (<>
           {types.length ? (<View style={styles.filters}>
             <Text accessibilityRole="header" style={styles.subtitle}>Nach Messart filtern</Text>
             <View style={styles.measures}>
              {[{ id: 'all', count: entries.length }, ...types.map(id => ({ id, count: readingCounts.get(id) ?? 0 }))].map(({ id, count }) => {
                        const active = id === type, label = id === 'all' ? 'Alle Messarten' : measurementLabel(id);
                        return <Pressable key={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={() => chooseType(id)} style={({ pressed }) => [styles.measureChip, pressed && styles.pressed, active && styles.selected]}>
                {id !== 'all' ? <VitalMeasurementArtwork measurementKey={id} size={28}/> : null}
                <Text style={styles.chipLabel}>{label}</Text>
                <Text style={styles.count}>{count}</Text>
               </Pressable>;
                    })}
             </View>
            </View>) : null}

           {definition ? (<View style={styles.filters}>
             <Text accessibilityRole="header" style={styles.subtitle}>Kurve und Export</Text>
             <Text style={styles.note}>Wählen Sie eine Komponente mit ihrer gespeicherten Einheit aus.</Text>
             <FilterChipGroup wrap options={definition.components.map(c => ({ key: c.key, label: `${c.label} · ${c.unit}` }))} value={component} onChange={chooseComponent}/>
             {component && chartCapture ? <VitalHistoryChartPanel capture={chartCapture} onReadingPress={open}/> : null}
             {component ? (<View style={styles.stack}>
               <PremiumButton title="Alle geladenen Originale als CSV" variant="secondary" disabled={!historyAction} onPress={download}/>
               <Text style={styles.note}>Die Datei enthält personenbezogene Pflegedaten: alle geladenen Messungen, Folgedokumentationen
                und Korrekturvermerke dieser Akte. Der Messartfilter verändert den Exportumfang nicht.</Text>
               {exportError ? <ErrorState message={exportError}/> : null}
              </View>) : null}
            </View>) : null}

           <View style={styles.readings}>
            <View style={styles.readingHeader}>
             <Text accessibilityRole="header" style={styles.subtitle}>Gespeicherte Messungen</Text>
             {filtered.length ? <Text style={styles.note}>{Math.min(visible, filtered.length)} von {filtered.length} angezeigt</Text> : null}
            </View>
            {!filtered.length ? (<EmptyState title={type === 'all' ? 'Keine Messungen vorhanden' : 'Keine Messung für diesen Filter'} message={type === 'all' ? 'Für diese Pflegeakte wurden keine Messungen geliefert.' : 'Wählen Sie eine andere Messart aus.'}/>) : filtered.slice(0, visible).map(entry => (<VitalHistoryRecordCard key={entry.id} entry={entry} styles={styles} selected={selectedId === entry.id} expanded={expandedId === entry.id} onToggle={() => toggleDetails(entry.id)} onOpen={() => open(entry.id)}/>))}
            {visible < filtered.length ? <PremiumButton title="Weitere Messungen anzeigen" variant="secondary" onPress={more}/> : null}
            {filtered.length ? <Text style={styles.note}>Die Einträge stehen in der gelieferten Reihenfolge. Neu gespeicherte Werte erscheinen nach dem Aktualisieren.</Text> : null}
           </View>
          </>)}
        </View>)}
      </SectionPanel>
     </View>
    </View>
   </View>
  </ScreenShell>);
}
type HistoryEntry = NonNullable<ReturnType<typeof vitalHistoryViewRowsWeb>>[number];
function VitalHistoryRecordCard({ entry: e, styles, selected, expanded, onToggle, onOpen }: {
    entry: HistoryEntry;
    styles: ReturnType<typeof useStyles>;
    selected: boolean;
    expanded: boolean;
    onToggle: () => void;
    onOpen: () => void;
}) {
    const label = measurementLabel(e.type);
    const hasOriginalAlert = e.flagStatus === 'outside_configured_range';
    const incompleteBalance = e.type === 'fluid_balance' && e.collectionExtent !== 'complete';
    return (<View style={[styles.reading, selected && styles.selected]}>
   <View style={styles.readingHeader}>
    <View style={styles.measureIdentity}>
     <VitalMeasurementArtwork measurementKey={e.type} size={44}/>
     <View style={styles.actionIdentity}>
      <Text accessibilityRole="header" style={styles.subtitle}>{label}</Text>
      <Text style={styles.note}>Messzeit: {time(e.occurredAt, e.occurredAtState)}</Text>
     </View>
    </View>
    <Text style={styles.value}>{e.display} {e.unit}</Text>
   </View>
   {hasOriginalAlert || incompleteBalance || e.invalidations.length || e.followUps.length ? (<View style={styles.badges}>
     {hasOriginalAlert ? <Text style={styles.badge}>Gespeicherter Grenzwertvermerk</Text> : null}
     {incompleteBalance ? <Text style={styles.badge}>Bilanzumfang nicht bestätigt</Text> : null}
     {e.invalidations.length ? <Text style={styles.badge}>{e.invalidations.length} Korrekturvermerk{e.invalidations.length === 1 ? '' : 'e'}</Text> : null}
     {e.followUps.length ? <Text style={styles.badge}>{e.followUps.length} Folgedokumentation{e.followUps.length === 1 ? '' : 'en'}</Text> : null}
    </View>) : null}
   <View style={styles.actions}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${label}: Originalangaben ${expanded ? 'ausblenden' : 'anzeigen'}`} style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]} onPress={onToggle}>
     <Text style={styles.chipLabel}>{expanded ? 'Originalangaben ausblenden' : 'Originalangaben anzeigen'}</Text>
    </Pressable>
    <PremiumButton title="Messung öffnen" accessibilityLabel={`${label}: Messung öffnen`} variant="secondary" size="sm" onPress={onOpen}/>
   </View>
   {expanded ? (<View style={styles.originals}>
     <Text style={styles.body}>Erfasst: {time(e.recordedAt, e.recordedAtState)} · Originalname: {e.actor}</Text>
     <Text style={styles.note}>Historische Zeitmetadaten: {time(e.legacyAt, e.legacyAtState)}</Text>
     {hasOriginalAlert ? <InfoBanner variant="warning" title="Gespeicherter Originalvergleich" message="Außerhalb konfigurierter Grenzen gespeichert. Dies ist ein Originalmetadatum, kein aktueller Vergleich oder Nachweis einer Reaktion; Komponenten und Einheiten in der Detailansicht prüfen."/> : null}
     {incompleteBalance ? <InfoBanner variant="warning" title="Erfassungsumfang nicht bestätigt" message="Der gelieferte Originalumfang der Bilanz ist unvollständig oder unbekannt. Daraus folgt keine vollständige oder klinisch gültige Bilanz."/> : null}
     {e.invalidations.map(r => <InfoBanner key={r.id} variant="warning" title="Originaler Korrekturvermerk" message={`${typeof r.reason === 'string' ? r.reason : 'Grund nicht lesbar'} · ${time(r.recordedAt, r.recordedAtState)} · ${typeof r.actor === 'string' ? r.actor : 'Originalname nicht geliefert'} · Kennung ${r.id}`}/>)}
     {e.followUps.map(r => (<View key={r.id} style={styles.followUp}>
       <Text style={styles.subtitle}>Folgedokumentation</Text>
       <Text style={styles.note}>Kontrolle: {time(r.observedAt, r.observedAtState)} · Vereinbarung: {time(r.nextReviewAt, r.nextReviewAtState)} · Erfasst: {time(r.recordedAt, r.recordedAtState)}</Text>
       <Text style={styles.body}>{typeof r.observation === 'string' ? r.observation : 'Originalbeobachtung nicht lesbar'}</Text>
       <Text style={styles.body}>{typeof r.action === 'string' ? r.action : 'Originalhandlung nicht lesbar'}</Text>
       <Text style={styles.note}>Originalstatus: {typeof r.outcome === 'string' ? r.outcome : 'nicht geliefert'} · Originalname: {typeof r.actor === 'string' ? r.actor : 'nicht geliefert'} · Kennung {r.id}</Text>
      </View>))}
    </View>) : null}
  </View>);
}
function useStyles() {
    const { c } = useCareLightPalette();
    return useMemo(() => StyleSheet.create({
        content: { alignSelf: 'center', width: '100%', maxWidth: 1480, minWidth: 0, paddingBottom: spacing.xl },
        columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.md, minWidth: 0 },
        clientColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 295, minWidth: 0 },
        historyColumn: { flexGrow: 2.8, flexShrink: 1, flexBasis: 510, minWidth: 0 },
        stack: { gap: spacing.sm, minWidth: 0 },
        identityCard: { gap: 5, padding: spacing.sm, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceAlt, minWidth: 0 },
        clientList: { gap: 6, minWidth: 0 },
        clientRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.border, borderRadius: 11, minHeight: 46, backgroundColor: c.surfaceAlt, minWidth: 0 },
        clientName: { ...typography.body, fontWeight: '700', color: c.text, flexShrink: 1, minWidth: 0 },
        actionBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceAlt, minWidth: 0 },
        actionIdentity: { flexShrink: 1, gap: 5, minWidth: 0 },
        actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, minWidth: 0 },
        placeholder: { padding: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: c.border, gap: 7, backgroundColor: c.surfaceAlt },
        filters: { gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border, minWidth: 0 },
        measures: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, minWidth: 0 },
        measureChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, minHeight: 42, maxWidth: '100%', borderColor: c.border, borderWidth: 1, borderRadius: 11, backgroundColor: c.surfaceAlt },
        selected: { borderColor: c.isDark ? '#63CEF4' : '#166CC1', backgroundColor: c.isDark ? '#123953' : '#EAF4FF' },
        pressed: { opacity: .76 },
        count: { ...typography.caption, fontVariant: ['tabular-nums'], fontWeight: '700', color: c.muted, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: c.surface, borderRadius: 12 },
        reading: { gap: spacing.sm, padding: spacing.sm, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, minWidth: 0 },
        readings: { gap: spacing.sm, minWidth: 0 },
        readingHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 },
        measureIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minWidth: 0 },
        badge: { ...typography.caption, fontWeight: '700', color: c.text, maxWidth: '100%', paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: c.border, borderRadius: 7, backgroundColor: c.surfaceAlt },
        originals: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.sm, gap: spacing.sm, minWidth: 0 },
        followUp: { gap: 5, padding: spacing.sm, borderLeftWidth: 3, borderLeftColor: c.border, backgroundColor: c.surfaceAlt, minWidth: 0 },
        disclosure: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: c.surfaceAlt, maxWidth: '100%' },
        body: { ...typography.body, color: c.text, maxWidth: '100%' },
        note: { ...typography.caption, color: c.muted, maxWidth: '100%' },
        eyebrow: { ...typography.caption, fontWeight: '700', color: c.muted, flexShrink: 1, maxWidth: '100%' },
        subtitle: { ...typography.body, fontWeight: '800', color: c.text, maxWidth: '100%' },
        chipLabel: { ...typography.caption, fontWeight: '700', color: c.text, flexShrink: 1 },
        personTitle: { ...typography.h3, color: c.text, maxWidth: '100%' },
        value: { ...typography.h2, fontVariant: ['tabular-nums'], color: c.text, flexShrink: 1, maxWidth: '100%' },
    }), [c]);
}
