// Generated native presentation from src/components/pflege/BasicCareBindingPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { sameClientNativeOriginal } from "../../lib/clients/clientRecordNativeOriginal.native.ts";
import { makeBasicCareBindingPacket, type BasicCareBindingCandidate, type BasicCareBindingContext, type BasicCareBindingPacket, type BasicCareBindingScope, type BasicCareBindingStatus } from "../../lib/pflege/basicCareBinding.native.ts";
import { readBasicCareBindingContext } from "../../lib/pflege/basicCareBindingRepository.supabase.native.ts";
import { browserBasicCareBindingWorkflow, type BasicCareBindingJournal } from "../../lib/pflege/basicCareBindingWorkflow.native.ts";
import { spacing } from '@/theme';
type Props = BasicCareBindingScope & {
    ownerToken: object;
    canView: boolean;
    canPlan: boolean;
    blocked: boolean;
    isCurrent(): boolean;
    isLeaving?(): boolean;
    onEditingChange(active: boolean): boolean;
    onBound(): void | Promise<void>;
};
type State = {
    editing: boolean;
    booted: boolean;
    busy: boolean;
    uncertain: boolean;
    context: BasicCareBindingContext | null;
    selected: string;
    plannedAt: string;
    secondPersonRequired: string;
    reason: string;
    packet: BasicCareBindingPacket | null;
    status: BasicCareBindingStatus | null;
    journal: BasicCareBindingJournal | null;
    error: string | null;
};
const empty = (): State => ({ editing: false, booted: false, busy: false, uncertain: false, context: null, selected: '', plannedAt: '', secondPersonRequired: '', reason: '', packet: null, status: null, journal: null, error: null });
export function useBasicCareBindingController(props: Props) {
    const latest = useRef(props);
    latest.current = props;
    const identity = `${props.tenantId}:${props.clientId}:${props.actorId}:${props.canView}:${props.canPlan}`, holder = useRef<{
        identity: string;
        token: object;
        live: boolean;
        generation: number;
        guard: Props['isCurrent'];
        retired: boolean;
        flight: boolean;
        claiming: boolean;
        active: boolean;
        reservation: Props['onEditingChange'] | null;
        state: State;
        workflow: ReturnType<typeof browserBasicCareBindingWorkflow> | null;
    } | null>(null), [, render] = useState(0);
    const guardCurrent = (guard: Props['isCurrent']) => { try {
        return guard() === true;
    }
    catch {
        return false;
    } };
    if (holder.current && (!guardCurrent(holder.current.guard) || !guardCurrent(props.isCurrent)))
        holder.current.retired = true;
    if (!holder.current || holder.current.identity !== identity || holder.current.token !== props.ownerToken || holder.current.retired && guardCurrent(props.isCurrent)) {
        if (holder.current)
            holder.current.live = false;
        holder.current = { identity, token: props.ownerToken, live: true, generation: 0, guard: props.isCurrent, retired: false, flight: false, claiming: false, active: false, reservation: null, state: empty(), workflow: null };
    }
    const own = holder.current;
    const current = () => { try {
        if (!guardCurrent(own.guard) || !guardCurrent(latest.current.isCurrent))
            own.retired = true;
        return own.live && !own.retired && holder.current === own && latest.current.ownerToken === own.token && latest.current.canView;
    }
    catch {
        return false;
    } };
    const update = (patch: Partial<State>) => { if (current()) {
        own.state = { ...own.state, ...patch };
        render(v => v + 1);
    } };
    const release = () => { own.active = false; const cb = own.reservation; own.reservation = null; update({ editing: false }); cb?.(false); };
    const claim = () => { if (own.claiming || !current() || own.flight || latest.current.blocked || latest.current.isLeaving?.())
        return false; if (own.active)
        return true; own.claiming = true; try {
        const cb = latest.current.onEditingChange;
        if (cb(true) !== true)
            return false;
        own.reservation = cb;
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
        return false; own.flight = true; update({ busy: true, error: null }); return true; };
    const finish = () => { own.flight = false; update({ busy: false }); };
    const workflow = () => { if (!own.workflow) {
        const generation = own.generation;
        own.workflow = browserBasicCareBindingWorkflow({ tenantId: props.tenantId, clientId: props.clientId, actorId: props.actorId }, () => current() && generation === own.generation);
    } return own.workflow; };
    const snap = () => ({ identity, state: own.state });
    const leave = useUnsavedWebChanges(own.state.editing || own.state.uncertain, own.state.busy || own.state.uncertain, undefined, () => { const before = snap(); return () => current() && !own.flight && !own.state.uncertain && sameClientNativeOriginal(before, snap()); });
    const recover = () => { if (!begin()) {
        if (current() && !own.flight)
            update({ error: 'Ein anderer Editor ist aktiv. Vor neuer Planung muss das eigene Journal geprüft werden.' });
        return;
    } try {
        const j = workflow().read();
        update({ booted: true, journal: j, uncertain: !!j && ['preparing', 'committing', 'cancelling'].includes(j.phase) });
        if (!j)
            release();
    }
    catch (e) {
        update({ booted: true, uncertain: true, error: e instanceof Error ? e.message : 'Planbindungsjournal ungeklärt.' });
    }
    finally {
        finish();
    } };
    useEffect(() => { own.live = true; recover(); return () => { own.live = false; own.generation++; own.workflow = null; own.flight = false; release(); }; }, [own]);
    const open = async () => { const generation = own.generation, operationCurrent = () => current() && generation === own.generation; if (!own.state.booted || own.active || !props.canPlan || own.state.journal || !begin())
        return; try {
        const result = await readBasicCareBindingContext({ tenantId: props.tenantId, clientId: props.clientId, actorId: props.actorId, isCurrent: operationCurrent });
        if (!operationCurrent())
            return;
        if (!result.ok)
            update({ error: result.error });
        else
            update({ context: result.data });
    }
    catch (e) {
        if (operationCurrent())
            update({ error: e instanceof Error ? e.message : 'Planungsbezüge fehlen.' });
    }
    finally {
        if (operationCurrent())
            finish();
    } };
    const change = (key: 'selected' | 'plannedAt' | 'secondPersonRequired' | 'reason', value: string) => { if (!current() || !props.canPlan || !own.active || own.flight || own.state.journal || own.state.uncertain || latest.current.blocked || latest.current.isLeaving?.())
        return; update(key === 'selected' ? { selected: value, plannedAt: '', secondPersonRequired: '', reason: '' } : { [key]: value }); };
    const prepare = async () => { const generation = own.generation, operationCurrent = () => current() && generation === own.generation; if (!props.canPlan || own.state.journal || !begin())
        return; try {
        const s = own.state, candidate = s.context?.candidates.find(c => `${c.planVersionId}:${c.measureId}:${c.visitId}` === s.selected);
        if (!candidate || !['yes', 'no'].includes(s.secondPersonRequired))
            throw Error('Maßnahme, eindeutigen Zeitpunkt und Zwei-Personen-Entscheidung ausdrücklich wählen.');
        const packet = makeBasicCareBindingPacket(props, candidate, { plannedAt: s.plannedAt, secondPersonRequired: s.secondPersonRequired === 'yes', reason: s.reason }, crypto.randomUUID()), flow = workflow();
        const result = await flow.prepare(packet);
        if (!operationCurrent())
            return;
        update({ packet, journal: flow.read(), ...(result.ok ? { status: result.data, uncertain: false } : { error: result.error, uncertain: true }) });
    }
    catch (e) {
        if (operationCurrent()) {
            let journal: BasicCareBindingJournal | null = null, verified = false;
            try {
                journal = workflow().read();
                verified = true;
            }
            catch { /* Originaljournal unverändert erhalten. */ }
            update({ journal, error: e instanceof Error ? e.message : 'Planung konnte nicht vorbereitet werden.', uncertain: !verified || !!journal });
        }
    }
    finally {
        if (operationCurrent())
            finish();
    } };
    const act = async (action: 'confirm' | 'commit' | 'cancel') => { const generation = own.generation, operationCurrent = () => current() && generation === own.generation; if (action === 'commit' && !props.canPlan || !begin())
        return; const flow = workflow(); try {
        const result = await flow[action]();
        if (!operationCurrent())
            return;
        update({ journal: flow.read(), ...(result.ok ? { status: result.data, uncertain: false } : { error: result.error, uncertain: true }) });
    }
    catch (e) {
        if (operationCurrent())
            update({ error: e instanceof Error ? e.message : 'Planbindungsausgang ungeklärt.', uncertain: true });
    }
    finally {
        if (operationCurrent())
            finish();
    } };
    const close = async () => { const generation = own.generation, operationCurrent = () => current() && generation === own.generation; if (!current() || own.flight || own.state.uncertain || latest.current.isLeaving?.())
        return; const flow = own.workflow, j = own.state.journal; if (j && !['committed', 'cancelled'].includes(j.phase))
        return; own.flight = true; update({ busy: true }); try {
        let committed = false;
        if (j && flow) {
            const result = await flow.close();
            if (!operationCurrent())
                return;
            if (!result.ok) {
                update({ error: result.error, uncertain: true });
                return;
            }
            committed = result.data.state === 'committed';
        }
        update({ ...empty(), booted: true, busy: true });
        release();
        if (committed && operationCurrent())
            await latest.current.onBound();
    }
    catch (e) {
        if (operationCurrent())
            update({ error: e instanceof Error ? e.message : 'Bestätigte Planung konnte nicht geschlossen werden.' });
    }
    finally {
        if (operationCurrent())
            finish();
    } };
    return { ...own.state, current, open, change, prepare, confirm: () => act('confirm'), commit: () => act('commit'), cancel: () => act('cancel'), close, recover, canCommit: () => { try {
            return workflow().canCommit();
        }
        catch {
            return false;
        } } };
}
export function BasicCareBindingPanel(props: Props) {
    const c = useBasicCareBindingController(props), candidate = c.context?.candidates.find(x => `${x.planVersionId}:${x.measureId}:${x.visitId}` === c.selected);
    if (!props.canView)
        return null;
    return <SectionPanel title="Grundpflege aus nativer Planung verbinden" subtitle="Planentscheidung und Pflegeereignis getrennt bestätigen">
 {!c.booted ? <><LoadingState message="Eigenes Planbindungsjournal wird geprüft…"/><PremiumButton title="Eigenes Journal erneut prüfen" onPress={c.recover}/></> : null}
 {c.error ? <ErrorState message={c.error}/> : null}
 {c.booted && !c.editing ? <PremiumButton title="Native Planbindung ausdrücklich erfassen" disabled={!props.canPlan || props.blocked} onPress={c.open}/> : null}
 {c.editing ? <View style={{ gap: spacing.sm }}>{c.busy ? <LoadingState message="Eigene Planentscheidung wird bestätigt…"/> : null}
 {!c.journal && c.context ? <><FilterChipGroup wrap options={c.context.candidates.map(x => ({ key: `${x.planVersionId}:${x.measureId}:${x.visitId}`, label: `${x.title} · ${x.localDate} ${x.localStart}` }))} value={c.selected} onChange={v => c.change('selected', v)}/>{candidate ? <><Text>Europe/Berlin · {candidate.localDate} {candidate.localStart}</Text>{candidate.plannedInstants.length ? <FilterChipGroup wrap options={candidate.plannedInstants.map(at => ({ key: at, label: at }))} value={c.plannedAt} onChange={v => c.change('plannedAt', v)}/> : <InfoBanner variant="warning" message="Für diesen lokalen Zeitpunkt gibt es keinen gültigen UTC-Zeitpunkt. Die native Planung muss geprüft werden."/>}<FilterChipGroup wrap options={[{ key: 'no', label: 'Keine zweite Person erforderlich' }, { key: 'yes', label: 'Zweite Person erforderlich' }]} value={c.secondPersonRequired} onChange={v => c.change('secondPersonRequired', v)}/><PremiumInput label="Konkreter Grund dieser Planentscheidung" value={c.reason} onChangeText={v => c.change('reason', v)} multiline/><PremiumButton title="Planentscheidung unverändert vorbereiten" disabled={c.busy || !c.plannedAt || !c.secondPersonRequired || c.reason.trim().length < 10} onPress={c.prepare}/></> : null}</> : null}
 {c.uncertain && !c.journal ? <PremiumButton title="Eigenes ungeklärtes Journal erneut lesen" disabled={c.busy} onPress={c.recover}/> : null}{c.journal ? <><InfoBanner variant={c.journal.phase === 'committed' ? 'success' : 'info'} title={`Eigener Stand: ${c.journal.phase}`} message={c.packet ? `${c.packet.sources.measure.title} · ${c.packet.plannedAt} · Zweite Person: ${c.packet.secondPersonRequired ? 'erforderlich' : 'nicht erforderlich'}` : 'Wiederhergestellter Vorgang: nur unveränderten Ausgang prüfen oder eine noch offene Absicht verwerfen. Die frühere Planentscheidung wird nicht rekonstruiert.'}/><PremiumButton title="Eigenen Ausgang unverändert prüfen" disabled={c.busy} onPress={c.confirm}/>{c.canCommit() ? <PremiumButton title="Geprüfte Planentscheidung verbindlich speichern" disabled={c.busy || !props.canPlan} onPress={c.commit}/> : null}{!['committed', 'cancelled'].includes(c.journal.phase) ? <PremiumButton title="Offene Planabsicht sicher verwerfen" variant="secondary" disabled={c.busy} onPress={c.cancel}/> : null}</> : null}
 {!c.uncertain && (!c.journal || ['committed', 'cancelled'].includes(c.journal.phase)) ? <PremiumButton title={c.journal?.phase === 'committed' ? 'Bestätigte Planung schließen und neu laden' : 'Bearbeitung schließen'} variant="secondary" disabled={c.busy} onPress={c.close}/> : null}
 </View> : null}<InfoBanner variant="info" message="Diese technische Planbindung belegt keine Durchführung, Einwilligung oder fachliche Qualifikation. Bereits ungeklärte Vorgänge werden nicht ersetzt."/>
 </SectionPanel>;
}
