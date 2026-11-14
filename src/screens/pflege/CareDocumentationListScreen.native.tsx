// Generated native presentation from src/screens/pflege/CareDocumentationListScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumBadge, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCareDocumentationScope } from "../../hooks/pflege/useCareDocumentationScope.native.ts";
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { CareDocumentationPathWorkspace } from "../../components/pflege/CareDocumentationPathWorkspace.native.tsx";
import { CarePermissionStatus } from "./CarePermissionStatus.native.tsx";
import { readCareDocumentation } from "../../lib/pflege/careDocumentationRepository.supabase.native.ts";
import type { CareDocumentationKind } from "../../lib/pflege/careDocumentationPacket.native.ts";
import { careDocumentationDateRangeIssue, careDocumentationDisplayTime, careDocumentationKindLabels, careDocumentationQueueState, filterCareDocumentationQueue, matchesCareDocumentationName, type CareDocumentationQueueMode } from "../../lib/pflege/careDocumentationQueue.native.ts";
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { radius, spacing, typography } from '@/theme';
const pageSize = 25;
const clientPageSize = 18;
const kindOptions: {
    key: CareDocumentationKind | 'all';
    label: string;
}[] = [
    { key: 'all', label: 'Alle Eintragsarten' },
    ...(Object.entries(careDocumentationKindLabels) as [
        CareDocumentationKind,
        string
    ][]).map(([key, label]) => ({ key, label })),
];
const stateOptions: {
    key: CareDocumentationQueueMode;
    label: string;
}[] = [
    { key: 'all', label: 'Alle Fassungen' }, { key: 'unconfirmed', label: 'Ohne Bestätigung' },
    { key: 'confirmed', label: 'Inhaltsgebunden bestätigt' }, { key: 'voided', label: 'Für ungültig erklärt' },
];
const changedScope = 'Der Pflegefall oder die Dokumentationsberechtigung wurde geändert.';
export function CareDocumentationListScreen() {
    const params = useLocalSearchParams<{
        clientId?: string | string[];
    }>();
    const scope = useCareDocumentationScope();
    const linked = typeof params.clientId === 'string' && woundUuid(params.clientId) ? params.clientId : '';
    if (!scope.ready)
        return <ScreenShell title="Pflegedokumentation"><CarePermissionStatus state={scope.permissions}/></ScreenShell>;
    return <DocumentationQueue key={`${scope.revision}:${linked}`} scope={scope} linked={linked} invalidLink={params.clientId !== undefined && !linked}/>;
}
function DocumentationQueue({ scope, linked, invalidLink }: {
    scope: ReturnType<typeof useCareDocumentationScope>;
    linked: string;
    invalidLink: boolean;
}) {
    const { c } = useCareLightPalette();
    const router = useRouter();
    const { tenantId, actorId, isCurrent, can } = scope;
    const [selected, setSelected] = useState(linked);
    const [clientTerm, setClientTerm] = useState('');
    const [clientLimit, setClientLimit] = useState(clientPageSize);
    const [showFinder, setShowFinder] = useState(!linked);
    const clients = useAsyncQuery(async () => {
        if (!isCurrent())
            return { ok: false as const, error: changedScope };
        const result = await fetchEligibleCareClients(tenantId, scope.permissions.roleKey);
        if (!isCurrent())
            return { ok: false as const, error: changedScope };
        if (result.ok && (result.usedDemoFallback || result.tableMissing))
            return { ok: false as const, error: 'Die aktive Pflegefallliste konnte nicht bestätigt werden.' };
        return result;
    }, [scope.revision], { queryKey: `pflege-doku-cases:${scope.revision}`, retryCount: 0 });
    const choices = !clients.error && !clients.refreshError && !clients.previewData && !clients.tableMissing && !clients.cacheMeta.fromCache
        ? clients.data ?? [] : [];
    const filtered = choices.filter(client => matchesCareDocumentationName(clientTerm, client.firstName, client.lastName));
    const chosen = choices.find(client => client.id === selected);
    const shownCase = useRef(selected);
    shownCase.current = selected;
    return <ScreenShell title="Pflegedokumentation" subtitle="Verlauf lesen, offene Bestätigungen finden und Originalfassungen prüfen">
    <View style={styles.stack}>
      {invalidLink ? <InfoBanner variant="warning" presentation="inline" title="Pflegefall im Link nicht erkannt" message="Wählen Sie einen aktiven Pflegefall aus der Liste."/> : null}
      <SectionPanel title="Pflegefall" subtitle={selected ? chosen ? `${chosen.firstName} ${chosen.lastName}` : 'Aus dem geöffneten Fallbezug' : 'Die Dokumentation wird fallbezogen gelesen.'}>
        <View style={styles.actions}>
          <PremiumButton title={showFinder ? 'Pflegefallsuche schließen' : 'Anderen Pflegefall suchen'} variant="secondary" onPress={() => {
            if (isCurrent())
                setShowFinder(!showFinder);
        }}/>
          {selected && can('pflege.documentation.create') ? <PremiumButton title="Neuen Vorgang erfassen" onPress={() => {
                if (can('pflege.documentation.create') && shownCase.current === selected)
                    router.push(`/pflege/berichte/new?clientId=${encodeURIComponent(selected)}` as never);
            }}/> : null}
        </View>
        {showFinder ? <View style={styles.stack}>
          <PremiumInput label="Nach Vor- oder Nachname suchen" value={clientTerm} maxLength={120} onChangeText={value => { setClientTerm(value); setClientLimit(clientPageSize); }}/>
          {clients.loading ? <LoadingState presentation="inline" message="Aktive Pflegefälle werden geladen …"/>
                : clients.error || clients.refreshError ? <ErrorState presentation="inline" message={clients.error ?? clients.refreshError ?? 'Pflegefälle nicht verfügbar'} onRetry={clients.refresh}/>
                    : !filtered.length ? <Text style={[typography.body, { color: c.muted }]}>Keine passenden aktiven Pflegefälle.</Text>
                        : <View style={styles.actions}>
              {filtered.slice(0, clientLimit).map(client => <PremiumButton key={client.id} title={`${client.lastName}, ${client.firstName}`} variant={client.id === selected ? 'primary' : 'secondary'} size="sm" onPress={() => {
                                    if (isCurrent() && woundUuid(client.id)) {
                                        setSelected(client.id);
                                        setShowFinder(false);
                                    }
                                }}/>)}
            </View>}
          {filtered.length > clientLimit ? <PremiumButton title="Weitere Pflegefälle anzeigen" variant="secondary" onPress={() => setClientLimit(value => value + clientPageSize)}/> : null}
        </View> : null}
      </SectionPanel>
      {selected ? <CaseDocumentationQueue key={selected} clientId={selected} scope={scope} currentCase={() => shownCase.current === selected && isCurrent()}/>
            : <EmptyState title="Pflegefall auswählen" message="Öffnen Sie den Verlauf eines aktiven Pflegefalls."/>}
    </View>
  </ScreenShell>;
}
function CaseDocumentationQueue({ clientId, scope, currentCase }: {
    clientId: string;
    scope: ReturnType<typeof useCareDocumentationScope>;
    currentCase(): boolean;
}) {
    const { c } = useCareLightPalette();
    const router = useRouter();
    const { tenantId, actorId } = scope;
    const documents = useAsyncQuery(async () => {
        if (!currentCase())
            return { ok: false as const, error: changedScope };
        const result = await readCareDocumentation({ tenantId, clientId, actorId, isCurrent: currentCase });
        if (!currentCase())
            return { ok: false as const, error: changedScope };
        return result;
    }, [scope.revision, clientId], { queryKey: `pflege-doku:${scope.revision}:${clientId}`, retryCount: 0 });
    const [mode, setMode] = useState<CareDocumentationQueueMode>('all');
    const [kind, setKind] = useState<CareDocumentationKind | 'all'>('all');
    const [term, setTerm] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [limit, setLimit] = useState(pageSize);
    const [showPath, setShowPath] = useState(false);
    const range = { from: from.trim(), to: to.trim() };
    const rangeIssue = careDocumentationDateRangeIssue(range);
    const data = !documents.error && !documents.refreshError && !documents.previewData && !documents.tableMissing && !documents.cacheMeta.fromCache
        ? documents.data : null;
    const rows = useMemo(() => filterCareDocumentationQueue(data ?? [], { mode, kind, term, range }), [data, mode, kind, term, range.from, range.to]);
    const withoutConfirmation = data?.filter(row => careDocumentationQueueState(row) === 'unconfirmed').length;
    const reset = () => { setMode('all'); setKind('all'); setTerm(''); setFrom(''); setTo(''); setLimit(pageSize); };
    const refresh = () => {
        if (currentCase())
            void documents.refresh();
    };
    return <>
    <SectionPanel title="Verlauf des Pflegefalls" subtitle={data
            ? `${data.length} aktuelle Fassungen · ${withoutConfirmation} ohne inhaltsgebundene Bestätigung`
            : 'Der Dokumentationsbestand wird vollständig für diesen Pflegefall gelesen.'}>
      <View style={styles.actions}>
        <PremiumButton title="Verlauf aktualisieren" variant="secondary" loading={documents.refreshing} disabled={documents.loading} onPress={refresh}/>
        <PremiumButton title={showPath ? 'Dokumentationspfad schließen' : 'Dokumentationspfad öffnen'} variant="secondary" onPress={() => {
            if (currentCase())
                setShowPath(!showPath);
        }}/>
      </View>
      {data ? <>
        <FilterChipGroup wrap options={stateOptions} value={mode} onChange={value => { setMode(value); setLimit(pageSize); }}/>
        <FilterChipGroup wrap options={kindOptions} value={kind} onChange={value => { setKind(value); setLimit(pageSize); }}/>
        <PremiumInput label="Titel, Beobachtung, Maßnahme oder Ergebnis suchen" value={term} maxLength={150} onChangeText={value => { setTerm(value); setLimit(pageSize); }}/>
        <View style={styles.fields}>
          <View style={styles.field}><PremiumInput label="Ereignisse ab" placeholder="JJJJ-MM-TT" value={from} maxLength={10} onChangeText={value => { setFrom(value); setLimit(pageSize); }}/></View>
          <View style={styles.field}><PremiumInput label="Ereignisse bis" placeholder="JJJJ-MM-TT" value={to} maxLength={10} onChangeText={value => { setTo(value); setLimit(pageSize); }}/></View>
        </View>
        <View style={styles.actions}>
          <PremiumButton title="Filter zurücksetzen" variant="ghost" onPress={reset}/>
          {null}
        </View>
        {rangeIssue ? <InfoBanner variant="warning" presentation="inline" message={rangeIssue}/> : null}
      </> : null}
    </SectionPanel>
    {documents.loading ? <LoadingState presentation="inline" message="Dokumentationsverlauf wird geladen …"/>
            : documents.error || documents.refreshError ? <ErrorState presentation="inline" message={documents.error ?? documents.refreshError ?? 'Dokumentationsverlauf nicht verfügbar.'} onRetry={refresh}/>
                : data && !rangeIssue ? <SectionPanel title={`Einträge (${rows.length})`} subtitle={rows.length > limit ? `${limit} angezeigt` : undefined}>
        {rows.length ? rows.slice(0, limit).map(row => {
                        const status = careDocumentationQueueState(row);
                        return <View key={row.id} style={[styles.entry, { borderColor: c.border }]}>
            <View style={styles.entryTop}>
              <View style={styles.entryCopy}>
                <Text accessibilityRole="header" style={[typography.h3, { color: c.text }]}>{row.payload.title}</Text>
                <Text style={[typography.caption, { color: c.muted }]}>{careDocumentationKindLabels[row.kind]} · {careDocumentationDisplayTime(row.occurredAt)}</Text>
              </View>
              <PremiumBadge label={stateOptions.find(item => item.key === status)!.label} variant={status === 'confirmed' ? 'green' : status === 'voided' ? 'red' : 'warning'}/>
            </View>
            <Text numberOfLines={4} style={[typography.body, { color: c.text }]}>{row.payload.observation}</Text>
            <Text style={[typography.caption, { color: c.muted }]}>Fassung {row.revision} · erfasst {careDocumentationDisplayTime(row.recordedAt)} von {row.recordedByName}</Text>
            {row.kind === 'external' ? <Text style={[typography.caption, { color: c.muted }]}>Externer Befund. Keine eigene Durchführung.</Text>
                                : row.kind === 'refusal' ? <Text style={[typography.caption, { color: c.muted }]}>Ablehnung. Kein Nachweis für eine Durchführung.</Text> : null}
            <View style={styles.actions}><PremiumButton title="Original und Nachträge öffnen" accessibilityLabel={`Original öffnen: ${row.payload.title}`} variant="secondary" size="sm" onPress={() => {
                                if (currentCase() && row.clientId === clientId)
                                    router.push(`/pflege/dokumentation/${encodeURIComponent(row.id)}?clientId=${encodeURIComponent(clientId)}` as never);
                            }}/></View>
          </View>;
                    }) : <EmptyState title={data.length ? 'Keine passenden Einträge' : 'Noch keine Einträge'} message={data.length ? 'Ändern Sie die Suche, den Zeitraum oder den Statusfilter.' : 'Für diesen Pflegefall sind noch keine Dokumentationsfassungen hinterlegt.'}/>}
        {rows.length > limit ? <PremiumButton title="Weitere Einträge anzeigen" variant="secondary" onPress={() => setLimit(value => value + pageSize)}/> : null}
      </SectionPanel> : null}
    {showPath && currentCase() ? <CareDocumentationPathWorkspace clientId={clientId}/> : null}
  </>;
}
const styles = StyleSheet.create({
    stack: { gap: spacing.md, minWidth: 0, paddingBottom: spacing.md },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', minWidth: 0 },
    fields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    field: { flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 },
    entry: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, minWidth: 0 },
    entryTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
    entryCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 205, minWidth: 0, gap: spacing.xs },
});
