// Generated native presentation from src/screens/pflege/PflegeDedicatedScreens.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
export * from './PflegeDedicatedScreens.tsx';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useCareRuntimePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useCareQualityVisitRead } from "../../hooks/pflege/useCareQualityVisitRead.native.ts";
import { getServiceMode } from '@/lib/services/mode';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import type { ClientNativeRow } from "../../lib/clients/clientRecordNativeOriginal.native.ts";
import type { VisitTimeEvidenceWeb, VisitStoredStatusWeb } from "../../lib/pflege/careQualityVisitTemporalEvidence.native.ts";
import { CareQualityVisitOriginalHistoryPanel } from "./CareQualityVisitOriginalHistoryPanel.native.tsx";
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal } from "../../lib/clients/clientRecordNativeOriginal.native.ts";
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import type { CareQualityVisitTemporalEvidenceWeb } from "../../lib/pflege/careQualityVisitTemporalEvidence.native.ts";
import { PflegeVisitsListScreen as LegacyVisitsListScreen } from './PflegeDedicatedScreens.tsx';
function text(row: ClientNativeRow, key: string): string {
    if (!Object.hasOwn(row, key))
        return 'Nicht geliefert';
    const value = row[key];
    if (value === null)
        return 'Kein Wert gespeichert';
    if (value === undefined)
        return 'Nicht geliefert';
    if (value === '')
        return 'Leer gespeichert';
    return typeof value === 'string' ? value : 'Format ungeklärt';
}
function timeText(value: VisitTimeEvidenceWeb): string {
    if (value.state === 'valid')
        return value.display!;
    if (value.state === 'not_supplied' || value.state === 'undefined')
        return 'Originalzeit nicht geliefert';
    if (value.state === 'null')
        return 'Keine Originalzeit gespeichert';
    if (value.state === 'empty')
        return 'Originalzeit leer gespeichert';
    return value.raw === null ? 'Zeitformat ungeklärt' : 'Zeitformat ungeklärt · Original: ' + value.raw;
}
function statusText(value: VisitStoredStatusWeb): string {
    if (value.state === 'known')
        return value.value === 'planned' ? 'Geplant' : value.value === 'cancelled' ? 'Abgesagt' : 'Als durchgeführt gespeichert';
    return 'Gespeicherter Status ungeklärt';
}
export type CareQualityVisitParentSelectionWeb = Readonly<{
    tenantId: string;
    clientId: string;
    visitId: string;
    owner: Readonly<Record<never, never>>;
    key: string;
}>;
type VisitListRead = ReturnType<typeof useCareQualityVisitRead>;
type VisitSelectionState = {
    alive: boolean;
    revision: number;
    current: VisitSelectionEntry | null;
};
type VisitSelectionEntry = {
    valid: boolean;
    checking: boolean;
    state: VisitSelectionState;
    revision: number;
    read: VisitListRead;
    whole: CareQualityVisitTemporalEvidenceWeb['originals'];
    row: ClientNativeRow;
    selection: CareQualityVisitParentSelectionWeb;
};
const visitSelectionFactories = new WeakMap<Function, VisitSelectionEntry>();
let visitSelectionSerial = 0;
/** Only the actual NativeVisitsListScreen may mint this registry. This fixed lookup never executes caller factories. */
export function currentCareQualityVisitParentSelectionWeb(factory: unknown, expectedSelection?: CareQualityVisitParentSelectionWeb): CareQualityVisitParentSelectionWeb | null {
    if (typeof factory !== 'function')
        return null;
    const entry = visitSelectionFactories.get(factory);
    if (!entry || !entry.valid)
        return null;
    const own = () => entry.valid && entry.state.alive && entry.state.current === entry && entry.state.revision === entry.revision;
    if (!own() || entry.checking) {
        entry.valid = false;
        return null;
    }
    entry.checking = true;
    try {
        if (expectedSelection !== undefined && expectedSelection !== entry.selection)
            return null;
        if (!entry.read.isCurrent())
            throw Error('Die eigene Visitenauswahl wurde ersetzt.');
        const view = entry.read.view();
        if (!view || !sameClientNativeOriginal(view.originals, entry.whole))
            throw Error('Der eigene Visitenauszug wurde ersetzt.');
        const row = view.originals.find(r => r.id === entry.selection.visitId && r.clientId === entry.selection.clientId && r.tenantId === entry.selection.tenantId);
        if (!row || !sameClientNativeOriginal(row, entry.row) || !entry.read.isCurrent() || !own())
            throw Error('Die eigene Visitzeile wurde ersetzt.');
        return entry.selection;
    }
    catch {
        entry.valid = false;
        return null;
    }
    finally {
        entry.checking = false;
    }
}
function NativeVisitsListScreen() {
    const runtime = useCareRuntimePermissions(), read = useCareQualityVisitRead(runtime);
    const { c } = useCareLightPalette(), styles = useMemo(() => createStyles(c), [c]);
    const selectionState = useMemo<VisitSelectionState>(() => ({ alive: false, revision: 0, current: null }), []);
    const [selectedFactory, setSelectedFactory] = useState<(() => CareQualityVisitParentSelectionWeb | null) | null>(null);
    useEffect(() => { selectionState.alive = true; return () => { selectionState.alive = false; selectionState.revision++; if (selectionState.current)
        selectionState.current.valid = false; }; }, [selectionState]);
    const view = read.view(), actionRevision = selectionState.revision;
    // The mint is lexical to this real screen and accepts only an ID from its freshly delivered whole DTO.
    function selectVisit(visitId: string) {
        if (!selectionState.alive || selectionState.revision !== actionRevision || !view || !read.isCurrent())
            return;
        const fresh = read.view();
        if (!fresh || !sameClientNativeOriginal(view.originals, fresh.originals))
            return;
        const row = fresh.originals.find(r => r.id === visitId);
        if (!row || !woundUuid(row.id) || !woundUuid(row.clientId) || !woundUuid(row.tenantId) || !read.isCurrent())
            return;
        const whole = freezeClientNativeOriginal(cloneClientNativeOriginal(fresh.originals)), originalRow = whole.find(r => r.id === visitId)!;
        if (!read.isCurrent() || selectionState.revision !== actionRevision || !selectionState.alive)
            return;
        if (selectionState.current)
            selectionState.current.valid = false;
        const revision = ++selectionState.revision;
        const selection = Object.freeze({ tenantId: row.tenantId, clientId: row.clientId, visitId: row.id, owner: Object.freeze({}), key: 'visit-selection-' + (++visitSelectionSerial) });
        const entry: VisitSelectionEntry = { valid: true, checking: false, state: selectionState, revision, read, whole, row: originalRow, selection };
        const factory = () => currentCareQualityVisitParentSelectionWeb(factory);
        visitSelectionFactories.set(factory, entry);
        selectionState.current = entry;
        setSelectedFactory(() => factory);
    }
    if (runtime.loading)
        return <ScreenShell title="Pflegevisiten"><LoadingState message="Die aktuellen Zugriffsrechte werden geprüft…"/></ScreenShell>;
    if (runtime.error)
        return <ScreenShell title="Pflegevisiten"><ErrorState message={runtime.error} onRetry={runtime.refreshPermissions}/></ScreenShell>;
    if (!runtime.can('pflege.visits.view'))
        return <ScreenShell title="Pflegevisiten"><LockedActionBanner message="Der aktuelle eigene Zugriff auf Pflegevisiten ist nicht bestätigt." roleLabel={runtime.roleLabel}/></ScreenShell>;
    if (read.state.state === 'loading' || read.state.state === 'refreshing')
        return <ScreenShell title="Pflegevisiten"><LoadingState message="Der Visitenauszug wird gelesen…"/></ScreenShell>;
    if (!view)
        return <ScreenShell title="Pflegevisiten"><ErrorState message={read.state.error ?? 'Der gelieferte Visitenauszug ist ungeklärt. Ein vollständiger leerer Bestand ist dadurch nicht bestätigt.'} onRetry={read.refresh}/></ScreenShell>;
    if (!read.isCurrent())
        return <ScreenShell title="Pflegevisiten"><LockedActionBanner message="Dieser eigene Lesezugriff ist nicht mehr aktuell." roleLabel={runtime.roleLabel}/></ScreenShell>;
    return <ScreenShell title="Pflegevisiten" subtitle="Getrennte Zeitbezüge im gelieferten Auszug"><View style={styles.content}>
  <PremiumCard><Text style={styles.heading}>Gelieferter ungeprüfter Visitenauszug</Text><Text style={styles.body}>Plantermin, gespeicherter Ereigniszeitpunkt und Folgezeitbezug bleiben getrennt. Ein gespeicherter Status oder Zeitpunkt bestätigt keine Durchführung und keinen Aufgabenabschluss.</Text><Text style={styles.note}>Vollständigkeit, Aktualität und aktive Pflegezuordnung sind nicht nachgewiesen. Autor-ID, ursprüngliche Erfassungsdaten, vereinbarte Maßnahmen und vollständige Historien sind in diesem Auszug nicht enthalten.</Text><Text style={styles.note}>Gelieferte Zeilen: {view.entries.length}</Text></PremiumCard>
  {view.entries.length === 0 ? <PremiumCard><Text style={styles.body}>Der gelieferte Auszug enthält keine Zeilen. Ein vollständiger leerer Visitenbestand ist damit nicht bestätigt.</Text></PremiumCard> : view.entries.map(entry => <PremiumCard key={text(entry.original, 'id')}><View style={styles.section}>
   <Text style={styles.heading}>{text(entry.original, 'scope')}</Text><Text selectable style={styles.note}>Visiten-ID: {text(entry.original, 'id')}</Text><Text style={styles.body}>Anzeigetext zur Person: {text(entry.original, 'clientName')}</Text><Text style={styles.body}>Besuchende: {text(entry.original, 'visitorName')} · Herkunft des Anzeigetexts nicht bestätigt</Text><Text style={styles.body}>Gespeicherter Visitenstatus: {statusText(entry.storedStatus)}</Text>
   <Text selectable style={styles.body}>Plantermin: {timeText(entry.scheduled)}</Text><Text selectable style={styles.body}>Gespeicherter Ereigniszeitpunkt: {timeText(entry.event)}</Text><Text selectable style={styles.body}>Gespeicherter Folgezeitbezug: {timeText(entry.nextVisit)}</Text><Text style={styles.note}>Der Folgezeitbezug bestätigt keine Vereinbarung.</Text>
   <Text style={styles.body}>Gespeicherte Feststellungen: {text(entry.original, 'findings')}</Text><Text style={styles.body}>Gespeicherte Abweichungen: {text(entry.original, 'deviations')}</Text><Text selectable style={styles.note}>Klienten-ID: {text(entry.original, 'clientId')} · Gespeicherter Planbezug: {text(entry.original, 'carePlanId')}</Text>
   <PremiumButton title="Originalhistorie ansehen" variant="ghost" onPress={() => selectVisit(text(entry.original, 'id'))}/>
  </View></PremiumCard>)}
  {selectedFactory ? <CareQualityVisitOriginalHistoryPanel captureSelection={selectedFactory}/> : null}
 </View></ScreenShell>;
}
/** Only this Web export is overridden. Demo and every sibling use the unchanged physical shared implementation. */
export function PflegeVisitsListScreen() { return getServiceMode() === 'demo' ? <LegacyVisitsListScreen key="legacy-visits-demo"/> : <NativeVisitsListScreen key="native-visits-supplied"/>; }
function createStyles(c: ReturnType<typeof useCareLightPalette>['c']) { return StyleSheet.create({ content: { gap: careSpacing.md, paddingBottom: careSpacing.xl, minWidth: 0, maxWidth: '100%' }, section: { gap: careSpacing.sm, minWidth: 0 }, heading: { fontSize: 18, fontWeight: '800', color: c.text, flexShrink: 1 }, body: { fontSize: 15, lineHeight: 22, color: c.text, flexShrink: 1, maxWidth: '100%' }, note: { fontSize: 13, lineHeight: 20, color: c.muted, flexShrink: 1, maxWidth: '100%' } }); }
