// Generated native presentation from src/components/pflege/NutritionPlanBindingCapturePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { sameClientNativeOriginal } from "../../lib/clients/clientRecordNativeOriginal.native.ts";
import { makeNutritionPlanBindingIntent, nutritionPlanBindingSelectionIssue, type NutritionPlanBindingContext, type NutritionPlanBindingReceipt, type NutritionPlanBindingScope, type NutritionPlanBindingSelection } from "../../lib/pflege/nutritionPlanBindingDomain.native.ts";
import { readNutritionPlanBindingContext } from "../../lib/pflege/nutritionPlanBindingRepository.supabase.native.ts";
import { recoverNutritionPlanBinding, saveNutritionPlanBindingDurably } from "../../lib/pflege/nutritionPlanBindingWorkflow.native.ts";
import { spacing, typography } from '@/theme';
type Props = NutritionPlanBindingScope & {
    ownerToken: object;
    canView: boolean;
    canCapture: boolean;
    blocked: boolean;
    isCurrent(): boolean;
    isLeaving?(): boolean;
    onEditingChange(active: boolean): boolean;
    registerLeave?(guard: (() => Promise<boolean>) | null): void;
    onCaptured(): void | Promise<void>;
};
type Ids = Pick<NutritionPlanBindingSelection, 'planVersionId' | 'measureId' | 'visitId' | 'assessmentId'>;
type State = Ids & {
    editing: boolean;
    booted: boolean;
    busy: boolean;
    uncertain: boolean;
    plannedAt: string;
    acknowledged: boolean;
    context: NutritionPlanBindingContext | null;
    receipt: NutritionPlanBindingReceipt | null;
    error: string | null;
};
const empty = (): State => ({ planVersionId: '', measureId: '', visitId: '', assessmentId: '', editing: false, booted: false, busy: false, uncertain: false, plannedAt: '', acknowledged: false, context: null, receipt: null, error: null });
type Frame = {
    identity: string;
    token: object;
    guard: Props['isCurrent'];
    retired: boolean;
    live: boolean;
    active: boolean;
    flight: boolean;
    operation: number;
    claiming: boolean;
    reservation: Props['onEditingChange'] | null;
    state: State;
};
export function useNutritionPlanBindingCaptureController(props: Props) {
    const latest = useRef(props);
    latest.current = props;
    const identity = `${props.tenantId}:${props.clientId}:${props.actorId}:${props.canView}:${props.canCapture}`, frameRef = useRef<Frame | null>(null), [, render] = useState(0);
    const guardCurrent = (guard: Props['isCurrent']) => { try {
        return guard() === true;
    }
    catch {
        return false;
    } };
    if (frameRef.current && (!guardCurrent(frameRef.current.guard) || !guardCurrent(props.isCurrent)))
        frameRef.current.retired = true;
    if (!frameRef.current || frameRef.current.identity !== identity || frameRef.current.token !== props.ownerToken || frameRef.current.retired && guardCurrent(props.isCurrent)) {
        if (frameRef.current)
            frameRef.current.live = false;
        frameRef.current = { identity, token: props.ownerToken, guard: props.isCurrent, retired: false, live: true, active: false, flight: false, operation: 0, claiming: false, reservation: null, state: empty() };
    }
    const own = frameRef.current;
    const current = () => { if (!own.live || frameRef.current !== own || latest.current.ownerToken !== own.token || !latest.current.canView || own.retired)
        return false; if (!guardCurrent(own.guard) || !guardCurrent(latest.current.isCurrent)) {
        own.retired = true;
        return false;
    } return true; };
    const update = (patch: Partial<State>) => { if (current()) {
        own.state = { ...own.state, ...patch };
        render(v => v + 1);
    } };
    const release = () => { own.active = false; const callback = own.reservation; own.reservation = null; update({ editing: false }); callback?.(false); };
    const claim = () => { if (own.claiming || !current() || own.flight || latest.current.blocked || latest.current.isLeaving?.())
        return false; if (own.active)
        return true; own.claiming = true; try {
        const callback = latest.current.onEditingChange;
        if (callback(true) !== true)
            return false;
        own.reservation = callback;
        if (!current() || own.flight || latest.current.blocked || latest.current.isLeaving?.()) {
            release();
            return false;
        }
        own.active = true;
        update({ editing: true });
        return true;
    }
    finally {
        own.claiming = false;
    } };
    const begin = () => { if (!claim())
        return false; own.flight = true; own.operation++; update({ busy: true, error: null }); return true; };
    const finish = (operation: number) => { if (own.operation !== operation)
        return; own.flight = false; update({ busy: false }); };
    const selection = (): NutritionPlanBindingSelection => ({ tenantId: props.tenantId, clientId: props.clientId, actorId: props.actorId, planVersionId: own.state.planVersionId.trim(), measureId: own.state.measureId.trim(), visitId: own.state.visitId.trim(), assessmentId: own.state.assessmentId.trim() });
    const snapshot = () => ({ identity, state: own.state });
    const leave = useUnsavedWebChanges(own.state.editing || own.state.uncertain, own.state.busy || own.state.uncertain, undefined, () => { const before = snapshot(); return () => current() && !own.flight && !own.state.uncertain && sameClientNativeOriginal(before, snapshot()); });
    useEffect(() => { props.registerLeave?.(leave); return () => props.registerLeave?.(null); }, [props.registerLeave, leave, own]);
    const recover = async (operationCurrent: () => boolean = current) => { if (!begin()) {
        if (current() && !own.flight)
            update({ error: 'Ein anderer Editor ist aktiv. Vor einer neuen Erfassung muss das eigene Journal erneut geprüft werden.' });
        return;
    } const operation = own.operation, liveOperation = () => operationCurrent() && own.operation === operation; try {
        const result = await recoverNutritionPlanBinding({ tenantId: props.tenantId, clientId: props.clientId, actorId: props.actorId }, liveOperation);
        if (!liveOperation())
            return;
        if (result === null) {
            update({ booted: true, error: null });
            release();
        }
        else if (result.ok)
            update({ booted: true, uncertain: false, receipt: result.data, context: null, error: null });
        else {
            update({ booted: true, error: result.error, uncertain: result.uncertain === true });
            if (result.uncertain !== true)
                release();
        }
    }
    catch (e) {
        if (liveOperation())
            update({ booted: true, uncertain: true, error: e instanceof Error ? e.message : 'Das eigene Erfassungsjournal ist ungeklärt.' });
    }
    finally {
        if (liveOperation())
            finish(operation);
    } };
    useEffect(() => { own.live = true; let active = true; void recover(() => active && current()); return () => { active = false; own.live = false; own.operation++; own.flight = false; release(); }; }, [own]);
    const open = () => { if (!own.state.booted || !latest.current.canCapture || own.state.uncertain || own.state.receipt)
        return; if (claim())
        update({ error: null }); };
    const change = (key: keyof Ids | 'plannedAt' | 'acknowledged', value: string | boolean) => { if (!current() || !latest.current.canCapture || !own.active || own.flight || own.state.uncertain || own.state.receipt || latest.current.blocked || latest.current.isLeaving?.())
        return; if (key === 'acknowledged') {
        if (typeof value === 'boolean')
            update({ acknowledged: value });
        return;
    } if (typeof value !== 'string')
        return; if (key === 'plannedAt')
        update({ plannedAt: value, acknowledged: false });
    else
        update({ [key]: value, context: null, plannedAt: '', acknowledged: false }); };
    const read = async () => { if (!latest.current.canCapture || own.state.uncertain || own.state.receipt || !begin())
        return; const operation = own.operation, liveOperation = () => current() && own.operation === operation; update({ context: null, plannedAt: '', acknowledged: false }); try {
        const selected = selection(), issue = nutritionPlanBindingSelectionIssue(selected);
        if (issue)
            throw Error('Die vier tatsächlichen nativen Kennungen müssen vollständig vorliegen.');
        const result = await readNutritionPlanBindingContext({ ...selected, isCurrent: liveOperation });
        if (!liveOperation())
            return;
        if (result.ok)
            update({ context: result.data, plannedAt: '', acknowledged: false, error: null });
        else
            update({ context: null, error: result.error });
    }
    catch (e) {
        if (liveOperation())
            update({ context: null, error: e instanceof Error ? e.message : 'Native Planungsbezüge konnten nicht bestätigt werden.' });
    }
    finally {
        finish(operation);
    } };
    const save = async () => { if (!latest.current.canCapture || !own.state.context || !own.state.acknowledged || own.state.uncertain || own.state.receipt || !begin())
        return; const operation = own.operation, liveOperation = () => current() && own.operation === operation; try {
        const intent = makeNutritionPlanBindingIntent({ ...selection(), requestId: crypto.randomUUID(), plannedAt: own.state.plannedAt.trim(), context: own.state.context! }), result = await saveNutritionPlanBindingDurably(intent.packet, intent.expectedPlanSnapshotSha256, liveOperation);
        if (!liveOperation())
            return;
        if (result.ok)
            update({ receipt: result.data, context: null, uncertain: false, error: null });
        else
            update({ error: result.error, uncertain: result.uncertain === true });
    }
    catch (e) {
        if (liveOperation())
            update({ error: e instanceof Error ? e.message : 'Die native Planbindung konnte nicht erfasst werden.' });
    }
    finally {
        finish(operation);
    } };
    const retry = () => { if (current() && !own.flight && !latest.current.isLeaving?.())
        return recover(); };
    const close = async () => { if (!current() || own.flight || own.state.uncertain || latest.current.isLeaving?.())
        return; own.flight = true; const operation = ++own.operation, liveOperation = () => current() && own.operation === operation; update({ busy: true }); const confirmed = own.state.receipt; try {
        update({ ...empty(), booted: true, busy: true });
        release();
        if (confirmed && liveOperation())
            await latest.current.onCaptured();
    }
    catch (e) {
        if (liveOperation())
            update({ error: e instanceof Error ? e.message : 'Die Planbindung ist bestätigt; das erneute Laden ist fehlgeschlagen.' });
    }
    finally {
        finish(operation);
    } };
    return { ...own.state, current, selection, open, change, read, save, retry, close };
}
export function NutritionPlanBindingCapturePanel(props: Props) {
    const c = useNutritionPlanBindingCaptureController(props);
    if (!props.canView)
        return null;
    const native = c.context?.nativeOriginals, measure = native?.measure as Record<string, unknown> | undefined, tour = native?.tour as Record<string, unknown> | undefined, visit = native?.visit as Record<string, unknown> | undefined, assessment = native?.assessment as Record<string, unknown> | undefined;
    return <SectionPanel title="Native Ernährungsplanung verbinden" subtitle="Die unveränderten nativen Originale ausdrücklich erfassen und separat bestätigen">
 {!c.booted ? <>{!c.error ? <LoadingState message="Eigenes Erfassungsjournal wird geprüft…"/> : null}<PremiumButton title="Eigenes Journal erneut prüfen" onPress={c.retry}/></> : null}{c.error ? <ErrorState message={c.error}/> : null}
 {c.booted && !c.editing ? <PremiumButton title="Vorhandene native Planung verbinden" disabled={!props.canCapture || props.blocked} onPress={c.open}/> : null}
 {c.editing ? <View style={{ gap: spacing.sm }}>{c.busy ? <LoadingState message="Eigener Erfassungsvorgang wird geprüft…"/> : null}
 {!c.uncertain && !c.receipt ? <><InfoBanner variant="info" message="Für diesen Ablauf gibt es noch keine Kandidatenliste. Tragen Sie die tatsächlichen Kennungen der vorhandenen Planfassung, Maßnahme, des Einsatzes und Assessments ein. Aus fehlenden Kennungen wird keine Verfügbarkeit abgeleitet."/>{([['planVersionId', 'Native Planfassungs-ID'], ['measureId', 'Native Maßnahmen-ID'], ['visitId', 'Native Einsatz-ID'], ['assessmentId', 'Natives Assessment-ID']] as const).map(([key, label]) => <PremiumInput key={key} label={label} value={c[key]} editable={!c.busy && props.canCapture} onChangeText={v => c.change(key, v)}/>)}<PremiumButton title="Genau diese nativen Originale vollständig lesen" disabled={c.busy || !props.canCapture || !!nutritionPlanBindingSelectionIssue(c.selection())} onPress={c.read}/>
 {c.context ? <><Text style={{ ...typography.label }}>{typeof measure?.title === 'string' ? measure.title : 'Nativer Titel nicht geliefert'}</Text><Text>{typeof tour?.tour_date === 'string' ? tour.tour_date : 'Datum nicht geliefert'} · {typeof visit?.planned_start === 'string' ? visit.planned_start : 'Beginn nicht geliefert'} bis {typeof visit?.planned_end === 'string' ? visit.planned_end : 'Ende nicht geliefert'} · Europe/Berlin</Text><Text>Assessment: {typeof assessment?.title === 'string' ? assessment.title : 'Titel nicht geliefert'}</Text><PremiumInput label="Ausdrücklicher Planzeitpunkt (ISO mit UTC oder Offset)" value={c.plannedAt} editable={!c.busy && props.canCapture} onChangeText={v => c.change('plannedAt', v)}/><InfoBanner variant="info" message="Der Zeitpunkt muss zur nativen Planung in Europe/Berlin gehören. Bei einer Zeitumstellung ist der tatsächliche Offset ausdrücklich erforderlich. Es wird kein Zeitpunkt vorausgewählt."/><FilterChipGroup wrap options={[{ key: 'yes', label: 'Originale und Planzeitpunkt ausdrücklich geprüft' }]} value={c.acknowledged ? 'yes' : ''} onChange={v => c.change('acknowledged', v === 'yes')}/><PremiumButton title="Unveränderte native Planbindung erfassen" disabled={c.busy || !props.canCapture || !c.acknowledged || !c.plannedAt.trim()} onPress={c.save}/></> : null}</> : null}
 {c.uncertain ? <><InfoBanner variant="warning" title="Erfassungsausgang ungeklärt" message="Nur der unveränderte ursprüngliche Vorgang wird anhand seiner eigenen Quittung geprüft. Es werden keine neuen Kennungen, Planzeiten oder Ersatzanfragen versendet."/><PremiumButton title="Genau diesen eigenen Ausgang erneut prüfen" disabled={c.busy} onPress={c.retry}/></> : null}
 {c.receipt ? <InfoBanner variant="success" title="Eigene Erfassung separat bestätigt" message={`${c.receipt.binding.title} · ${c.receipt.binding.plannedAt}. Schließen Sie diesen bestätigten Vorgang, um den vollständigen Bestand neu zu laden.`}/> : null}
 {!c.uncertain ? <PremiumButton title={c.receipt ? 'Bestätigte Erfassung schließen und Bestand laden' : 'Lokalen Planbindungsentwurf verwerfen'} variant="secondary" disabled={c.busy} onPress={c.close}/> : null}
 </View> : null}<InfoBanner variant="warning" message="Diese technische Planbindung belegt keine Durchführung, klinische Entscheidung oder qualifizierte Abnahme. Unbekannte native Quellen bleiben gesperrt."/>
 </SectionPanel>;
}
