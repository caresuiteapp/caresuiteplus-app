// Generated native presentation from src/screens/pflege/VisitExecutionWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window,nativeStructuredClone as structuredClone,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { carePermissionOwner, carePermissionOwnerIsCurrent, sameCarePermissionOwner, type CarePermissionOwner } from "../../lib/permissions/carePermissionOwner.native.ts";
import { isDemoMode } from '@/lib/supabase/config';
import { visitExecutionRepository as repository } from "../../lib/pflege/visitExecutionWorkspaceRepository.supabase.native.ts";
import type { VisitAuthority } from "../../lib/pflege/visitExecutionWorkspaceRepository.native.ts";
import { browserVisitLock, VisitExecutionWorkflow, type VisitJournal } from "../../lib/pflege/visitExecutionWorkspaceWorkflow.native.ts";
import { discardVisitDraft, restoreVisitDraft, saveVisitDraft } from "../../lib/pflege/visitExecutionWorkspaceDraft.native.ts";
import { buildVisitCommand, visitFields, visitLocalTime, visitSourceOptions } from "../../lib/pflege/visitExecutionWorkspaceForm.native.ts";
import { assertVisitSelectionCurrent, decodeVisitHistory, visitExecutionBaseRights, visitExecutionKinds, visitExecutionLabels, visitExecutionWriteRights, type VisitContext, type VisitExecutionKind, type VisitRow, type VisitState } from "../../lib/pflege/visitExecutionWorkspaceDomain.native.ts";
import { VisitExecutionWorkspaceReviewPanel } from "../../components/pflege/VisitExecutionWorkspaceReviewPanel.native.tsx";
import { makeVisitExecutionReviewSource } from "../../lib/pflege/visitExecutionWorkspaceReview.native.ts";
import type { PermissionKey } from '@/types/permissions';
import { SourcePicker } from "./TreatmentSourcePicker.native.tsx";
import { colors, spacing } from '@/theme';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
type Boundary = {
    owner: CarePermissionOwner | null;
    grants: readonly PermissionKey[];
    number: number;
    canCurrent(): boolean;
};
const baseRights = [...visitExecutionBaseRights] as PermissionKey[];
const label = (row: VisitRow) => `${String(row.client_name_snapshot ?? row.clientName ?? 'Pflegefall')} · ${String(row.planned_start ?? row.plannedStart ?? '')} · ${String(row.status ?? '')}`;
const when = (value: string) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
/** Web/Desktop-only connected on-site execution workspace. Native and Android routes remain unchanged. */
export function VisitExecutionWorkspace() {
    const auth = useAuth(), tenantId = useServiceTenantId(), permissions = useCareRuntimePermissions(), owner = carePermissionOwner(auth, tenantId, isDemoMode()), reference = useRef<Boundary | null>(null), mounted = useRef(true);
    if (!reference.current || !sameCarePermissionOwner(reference.current.owner, owner) || reference.current.grants !== permissions.permissions) {
        const grants = permissions.permissions;
        reference.current = { owner, grants, number: (reference.current?.number ?? 0) + 1, canCurrent: () => permissions.canAll([...grants]) };
    }
    const boundary = reference.current;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const authority = useMemo<VisitAuthority | null>(() => { if (!boundary.owner || boundary.owner.demo || !boundary.owner.accessToken || !baseRights.every(right => boundary.grants.includes(right)))
        return null; const own = boundary.owner, accessToken = boundary.owner.accessToken; return { tenantId: own.tenantId, actorId: own.profileId, accessToken, expiresAt: own.expiresAt, isCurrent: () => mounted.current && reference.current === boundary && carePermissionOwnerIsCurrent(own) && boundary.canCurrent() }; }, [boundary]);
    const body = permissions.loading ? <LoadingState message="Aktuelle Einsatzrechte werden geprüft…"/> : permissions.error ? <ErrorState message={permissions.error} onRetry={permissions.refreshPermissions}/> : !authority ? <InfoBanner variant="warning" message={owner?.demo ? 'Verbindliche Vor-Ort-Dokumentation benötigt ein angemeldetes Betriebskonto.' : 'Das aktuelle Recht zum Lesen des Einsatzablaufs ist nicht bestätigt.'}/> : <Authorized authority={authority} grants={boundary.grants}/>;
    return <ScreenShell title="Einsatz vor Ort" subtitle="Öffnung, Zeiten, Aufgaben, Nichtbesuch, Leistungen, Bestätigung, Notfall und Abschluss getrennt belegen">{body}</ScreenShell>;
}
function Authorized({ authority, grants }: {
    authority: VisitAuthority;
    grants: readonly PermissionKey[];
}) {
    const styles = useStyles(), [stops, setStops] = useState<VisitRow[] | null>(null), [stopId, setStopId] = useState(''), [error, setError] = useState(''), [revision, setRevision] = useState(0);
    useEffect(() => { let active = true; setStops(null); setError(''); void repository.stops(authority).then(result => { if (!active || !authority.isCurrent())
        return; result.ok ? setStops(result.data) : setError(result.error); }); return () => { active = false; }; }, [authority, revision]);
    return <View style={styles.stack}>{!stops ? error ? <ErrorState message={error} onRetry={() => setRevision(x => x + 1)}/> : <LoadingState message="Vollständig zugängliche Einsätze werden geladen…"/> : <><SectionPanel title="Nativen Einsatz auswählen"><SourcePicker label="Tourstopp / Pflegefall" rows={stops.map(row => ({ id: String(row.id), label: label(row) }))} value={stopId} onChange={setStopId} disabled={false}/>{!stops.length ? <Text style={styles.body}>Keine vollständig zugängliche Einsatzfassung vorhanden.</Text> : null}</SectionPanel>{stopId && stops.some(row => row.id === stopId) ? <Workspace key={stopId} authority={authority} grants={grants} stopId={stopId}/> : stopId ? <ErrorState message="Dieser Einsatz ist nicht mehr im aktuell zugänglichen Bestand enthalten."/> : <InfoBanner variant="info" message="Einen nativen Einsatz auswählen. Plan, Zeit, Aufgabe, Leistung, Bestätigung, Notfall und Abschluss bleiben getrennte Originale."/>}</>}</View>;
}
function Workspace({ authority, grants, stopId }: {
    authority: VisitAuthority;
    grants: readonly PermissionKey[];
    stopId: string;
}) {
    const window = useNativeWorkflowWindow();
    const styles = useStyles(), [context, setContext] = useState<VisitContext | null>(null), [state, setState] = useState<VisitState | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [reading, setReading] = useState(true), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0), [journal, setJournal] = useState<VisitJournal | null>(null), [journalError, setJournalError] = useState(''), alive = useRef(true), action = useRef(false), ticket = useRef(0);
    const workflow = useMemo(() => new VisitExecutionWorkflow({ tenantId: authority.tenantId, stopId, actorId: authority.actorId }, { storage: window.localStorage, lock: browserVisitLock, isCurrent: () => alive.current && authority.isCurrent(), commit: command => repository.commit(authority, command), confirm: command => repository.confirm(authority, command) }), [authority, stopId]);
    const current = () => alive.current && authority.isCurrent();
    const readJournal = () => { try {
        setJournal(workflow.read());
        setJournalError('');
    }
    catch (caught) {
        setJournalError(caught instanceof Error ? caught.message : 'Der gesicherte Einsatzvorgang ist beschädigt.');
    } };
    useEffect(() => { alive.current = true; readJournal(); const listener = (event: StorageEvent) => { if (event.key?.startsWith('caresuite.visit-execution-workspace.v1:'))
        readJournal(); }; window.addEventListener('storage', listener); return () => { alive.current = false; ticket.current += 1; window.removeEventListener('storage', listener); }; }, [workflow]);
    useEffect(() => { const own = ++ticket.current; setReading(true); setError(''); void repository.context(authority, stopId).then(result => { if (!current() || own !== ticket.current)
        return; if (!result.ok) {
        setError(result.error);
        setReading(false);
        return;
    } try {
        const folded = decodeVisitHistory(result.data.history, result.data);
        setContext(result.data);
        setState(folded.state);
    }
    catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Der vollständige Einsatzverlauf ist widersprüchlich.');
        setContext(null);
        setState(null);
    }
    finally {
        if (current() && own === ticket.current)
            setReading(false);
    } }); }, [authority, stopId, revision]);
    async function run(operation: () => Promise<void>) { if (action.current || !current())
        return; action.current = true; setBusy(true); setError(''); try {
        await operation();
    }
    catch (caught) {
        if (current())
            setError(caught instanceof Error ? caught.message : 'Der Einsatzvorgang konnte nicht bestätigt werden.');
    }
    finally {
        action.current = false;
        if (current()) {
            setBusy(false);
            readJournal();
        }
    } }
    const recovery = journal ? <SectionPanel title="Gesicherter Einsatzvorgang"><Text style={styles.body}>{journal.phase === 'dispatched' ? 'Die Speicherantwort ist unklar. Die exakt gesicherte Anfrage wird nicht erneut gesendet; nur ihre native Quittung wird gelesen.' : journal.phase === 'confirmed' ? 'Die Quittung ist gesichert und muss im vollständig neu geladenen Verlauf erscheinen.' : journal.phase === 'rejected' ? journal.rejection : 'Die Anfrage wurde dauerhaft vorbereitet, aber noch nicht gesendet.'}</Text>{journal.phase === 'dispatched' ? <PremiumButton title="Gesicherten Vorgang ausschließlich prüfen" disabled={busy} onPress={() => void run(async () => { const result = await workflow.confirm(); if (!result.ok)
        throw Error(result.error); setRevision(x => x + 1); })}/> : null}{journal.phase === 'confirmed' ? <PremiumButton title="Quittung mit Originalverlauf abgleichen" disabled={busy} onPress={() => void run(async () => { const result = await repository.context(authority, stopId); if (!result.ok || !current())
        throw Error('Der Originalverlauf konnte nicht abgeglichen werden.'); await workflow.releaseConfirmed(result.data.history.events); setRevision(x => x + 1); })}/> : null}{['prepared', 'rejected'].includes(journal.phase) ? <PremiumButton title="Abgewiesenen oder ungesendeten Vorgang freigeben" variant="secondary" disabled={busy} onPress={() => void run(() => workflow.discardUnsentOrRejected())}/> : null}</SectionPanel> : null;
    const complete = state?.events.at(-1)?.command.kind === 'complete';
    return <View style={styles.stack}>{journalError ? <ErrorState message={journalError}/> : null}{recovery}{error ? <ErrorState message={error} onRetry={busy ? undefined : () => setRevision(x => x + 1)}/> : null}{notice ? <SuccessState message={notice}/> : null}<PremiumButton title="Vollständigen Einsatz neu laden" variant="secondary" disabled={busy} onPress={() => setRevision(x => x + 1)}/>{reading ? <LoadingState message="Plan-, Aufgaben-, Leistungs-, Kontakt-, Risiko- und Verlauforiginale werden vollständig geladen…"/> : null}{context && state ? <><Overview context={context} state={state}/>{complete ? <VisitExecutionWorkspaceReviewPanel key={`review:${state.headId}`} tenantId={authority.tenantId} stopId={stopId} actorId={authority.actorId} canView={current()} canRequest={grants.includes('pflege.proofs.review' as PermissionKey)} canReview={grants.includes('pflege.proofs.review' as PermissionKey) && grants.includes('pflege.documentation.sign' as PermissionKey)} visitOriginal={makeVisitExecutionReviewSource(context)}/> : <InfoBanner variant="info" message="Eine Fachprüfung kann erst nach dem vollständigen fachlichen Einsatzabschluss angefragt werden."/>}<Editor context={context} state={state} grants={grants} disabled={busy || reading || !!journal || !!journalError} isCurrent={current} onSubmit={command => void run(async () => { if (workflow.read())
        throw Error('Zuerst den gesicherten Vorgang abgleichen.'); const required = visitExecutionWriteRights(command.kind) as unknown as PermissionKey[]; if (!required.every(right => grants.includes(right)) || !current())
        throw Error('Das aktuelle Schreibrecht für diesen Einsatzvorgang fehlt.'); assertVisitSelectionCurrent(command, context); const result = await workflow.dispatch(command); if (!result.ok)
        throw Error(result.error); discardVisitDraft(window.sessionStorage, { tenantId: authority.tenantId, stopId, actorId: authority.actorId }); setNotice('Der native Einsatzbeleg ist bestätigt gespeichert. Durchführung, Bestätigung, Notfallübergabe und Abrechnung bleiben getrennt.'); setRevision(x => x + 1); })}/></> : null}</View>;
}
function Overview({ context, state }: {
    context: VisitContext;
    state: VisitState;
}) { const styles = useStyles(), [count, setCount] = useState(20); return <><SectionPanel title="Aktueller vollständiger Einsatzstand"><Text style={styles.body}>{context.sources.count} aktuelle Originalquellen · {context.people.count} aktive Personen · {state.events.length} unveränderliche Ereignisse.</Text><Text style={styles.caption}>Plan, Gültigkeit, Zeit, Einzeldokumentation, Leistungsposition, Bestätigung und tatsächliche Versorgung werden nicht voneinander abgeleitet.</Text></SectionPanel><SectionPanel title="Unveränderlicher Einsatzverlauf">{state.events.slice(-count).reverse().map(e => <View key={e.id} style={styles.item}><Text style={styles.heading}>{visitExecutionLabels[e.command.kind]}{state.corrected.includes(e.id) ? ' · berichtigt' : ''}</Text><Text style={styles.body}>{e.actorName} · Ereignis {when(e.command.occurredAt)} · gespeichert {when(e.recordedAt)}</Text><Text style={styles.body}>{e.command.note}</Text></View>)}{!state.events.length ? <Text style={styles.body}>Noch kein verbundenes Einsatzereignis gespeichert.</Text> : null}{count < state.events.length ? <PremiumButton title="Frühere Ereignisse anzeigen" variant="secondary" onPress={() => setCount(x => x + 20)}/> : null}</SectionPanel></>; }
function Editor({ context, state, grants, disabled, isCurrent, onSubmit }: {
    context: VisitContext;
    state: VisitState;
    grants: readonly PermissionKey[];
    disabled: boolean;
    isCurrent(): boolean;
    onSubmit(command: ReturnType<typeof buildVisitCommand>): void;
}) {
    const styles = useStyles(), scope = { tenantId: context.tenantId, stopId: context.stopId, actorId: context.actorId };
    const [restored] = useState(() => { try {
        return { value: restoreVisitDraft(window.sessionStorage, scope, state.headId, value => context.sources.rows.some(row => JSON.stringify(row) === JSON.stringify(value)) || context.people.rows.some(row => JSON.stringify(row) === JSON.stringify(value))), error: '' };
    }
    catch (caught) {
        return { value: null, error: caught instanceof Error ? caught.message : 'Der Entwurf konnte nicht gelesen werden.' };
    } });
    const old = restored.value?.draft, [kind, setKind] = useState<VisitExecutionKind>(old?.kind ?? 'open'), [occurredAt, setOccurredAt] = useState(old?.occurredAt ?? visitLocalTime(new Date().toISOString())), [note, setNote] = useState(old?.note ?? ''), [values, setValues] = useState<Record<string, string>>(old?.values ?? {}), [selected, setSelected] = useState<Record<string, unknown>>(old?.selected ?? {}), [error, setError] = useState(restored.error || (restored.value?.changed ? 'Entwurf wiederhergestellt. Originale wegen geänderter Einsatzfassung erneut auswählen.' : restored.value ? 'Entwurf wiederhergestellt. Angaben und Originale erneut prüfen.' : '')), [saved, setSaved] = useState(false), fields = visitFields(kind), allowed = (visitExecutionWriteRights(kind) as unknown as PermissionKey[]).every(right => grants.includes(right));
    const draft = () => ({ version: context.version, scope, headId: state.headId, kind, occurredAt, note, values, selected });
    return <SectionPanel title="Neues verbundenes Einsatzereignis"><InfoBanner variant="info" message="Jede Aktion erzeugt genau ein append-only Ereignis. Häkchen, Empfang, Zeit oder Bestätigung ersetzen weder fachliche Detaildokumentation noch tatsächliche Versorgung."/><FilterChipGroup wrap options={visitExecutionKinds.map(key => ({ key, label: visitExecutionLabels[key] }))} value={kind} onChange={value => { setKind(value as VisitExecutionKind); setValues({}); setSelected({}); setSaved(false); setError('Vorgangsart geändert. Pflichtangaben und Originale vollständig neu erfassen.'); }}/>{!allowed ? <InfoBanner variant="warning" message="Das aktuelle Schreibrecht für diese Vorgangsart fehlt."/> : null}<PremiumInput label="Tatsächlicher Ereigniszeitpunkt *" value={occurredAt} onChangeText={value => { setOccurredAt(value); setSaved(false); }} editable={!disabled}/><PremiumInput label="Anlass / nachvollziehbare Notiz *" value={note} onChangeText={value => { setNote(value); setSaved(false); }} multiline editable={!disabled}/>{fields.map(definition => {
            const options = visitSourceOptions(definition, context, state);
            const isMultiple = definition.type === 'sources' || definition.type === 'events' && ['proofEventIds', 'taskEventIds'].includes(definition.key);
            if (isMultiple)
                return <MultiOriginalPicker key={`${kind}:${definition.key}`} label={definition.label} rows={options.map(option => ({ id: option.id, label: option.label }))} value={values[definition.key] ?? ''} disabled={disabled} onChange={value => { setValues(previous => ({ ...previous, [definition.key]: value })); setSaved(false); }}/>;
            if (['source', 'person', 'events'].includes(definition.type))
                return <SourcePicker key={definition.key} label={`${definition.label} *`} rows={options.map(option => ({ id: option.id, label: option.label }))} value={String((selected[definition.key] as VisitRow | undefined)?.id ?? values[definition.key] ?? '')} disabled={disabled} onChange={id => { const option = options.find(candidate => candidate.id === id); if (definition.type === 'events')
                    setValues(previous => ({ ...previous, [definition.key]: id }));
                else if (option)
                    setSelected(previous => ({ ...previous, [definition.key]: structuredClone(option.value) })); setSaved(false); }}/>;
            if (definition.type === 'choice')
                return <View key={definition.key} style={styles.stack}><Text style={styles.heading}>{definition.label} *</Text><FilterChipGroup wrap options={definition.options ?? []} value={values[definition.key] ?? ''} onChange={disabled ? undefined : value => { setValues(previous => ({ ...previous, [definition.key]: value })); setSaved(false); }}/></View>;
            return <PremiumInput key={definition.key} label={`${definition.label} *`} value={values[definition.key] ?? ''} onChangeText={value => { setValues(previous => ({ ...previous, [definition.key]: value })); setSaved(false); }} multiline={['json', 'text'].includes(definition.type)} editable={!disabled}/>;
        })}{error ? <ErrorState message={error}/> : null}{saved ? <SuccessState message="Entwurf auf diesem Gerät für genau Konto, Einsatz und Ereigniskopf gesichert."/> : null}<View style={styles.actions}><PremiumButton title="Entwurf auf diesem Gerät sichern" variant="secondary" disabled={disabled} onPress={() => { try {
        saveVisitDraft(window.sessionStorage, draft());
        setSaved(true);
        setError('');
    }
    catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Entwurf konnte nicht gesichert werden.');
    } }}/><PremiumButton title="Als neues Originalereignis speichern" disabled={disabled || !allowed} onPress={() => { try {
        if (!isCurrent())
            throw Error('Konto, Einsatz oder Rechte wurden geändert.');
        onSubmit(buildVisitCommand(draft(), context, state, crypto.randomUUID(), crypto.randomUUID()));
        setError('');
    }
    catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Einsatzvorgang ist unvollständig.');
    } }}/></View></SectionPanel>;
}
function MultiOriginalPicker({ label, rows, value, disabled, onChange }: {
    label: string;
    rows: {
        id: string;
        label: string;
    }[];
    value: string;
    disabled: boolean;
    onChange(value: string): void;
}) {
    const styles = useStyles(), [candidate, setCandidate] = useState(''), ids = value.split(',').map(id => id.trim()).filter(Boolean), selected = ids.map(id => rows.find(row => row.id === id)).filter((row): row is {
        id: string;
        label: string;
    } => !!row), available = rows.filter(row => !ids.includes(row.id));
    return <View style={styles.stack}><Text style={styles.heading}>{label} *</Text><SourcePicker label={`${label} hinzufügen`} rows={available} value={candidate} disabled={disabled} onChange={setCandidate}/><PremiumButton title="Ausgewähltes Original übernehmen" variant="secondary" disabled={disabled || !candidate || !available.some(row => row.id === candidate)} onPress={() => { onChange([...ids, candidate].join(',')); setCandidate(''); }}/>{selected.length ? selected.map(row => <View key={row.id} style={styles.item}><Text style={styles.body}>{row.label}</Text><PremiumButton title="Aus Auswahl entfernen" variant="secondary" disabled={disabled} onPress={() => onChange(ids.filter(id => id !== row.id).join(','))}/></View>) : <Text style={styles.caption}>Noch kein Original ausgewählt.</Text>}</View>;
}
function useStyles() { const { c } = useCareLightPalette(); const adaptive = useAdaptiveContentStyles(); return useMemo(() => StyleSheet.create({ stack: { gap: spacing.md }, actions: { gap: spacing.sm }, item: { backgroundColor: c.surfaceAlt, borderColor: c.border, padding: spacing.md, gap: spacing.xs }, heading: { color: colors.textPrimary, fontWeight: '700' }, body: { color: colors.textPrimary, lineHeight: 21 }, caption: { color: colors.textSecondary, lineHeight: 19 } }), [adaptive, c]); }
export default VisitExecutionWorkspace;
