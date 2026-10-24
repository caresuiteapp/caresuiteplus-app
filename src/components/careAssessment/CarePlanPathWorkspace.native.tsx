// Generated native presentation from src/components/careAssessment/CarePlanPathWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { SourcePicker } from "../../screens/pflege/TreatmentSourcePicker.native.tsx";
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isDemoMode } from '@/lib/supabase/config';
import { carePermissionOwner, carePermissionOwnerIsCurrent, sameCarePermissionOwner, type CarePermissionOwner } from "../../lib/permissions/carePermissionOwner.native.ts";
import type { PermissionKey } from '@/types/permissions';
import { assertCarePlanPathSelectionCurrent, decodeCarePlanPathHistory, carePlanPathWorkspaceDefinitions, carePlanPathWorkspaceReadRights, type CarePlanPathContext, type CarePlanPathSource, type CarePlanPathState, type CarePlanPathWorkspaceKind } from "../../lib/careAssessment/carePlanPathWorkspaceDomain.native.ts";
import { carePlanPathWorkspaceRepository as repository } from "../../lib/careAssessment/carePlanPathWorkspaceRepository.supabase.native.ts";
import type { CarePlanPathAuthority } from "../../lib/careAssessment/carePlanPathWorkspaceRepository.native.ts";
import { browserCarePlanPathLock, CarePlanPathWorkflow, type CarePlanPathJournal } from "../../lib/careAssessment/carePlanPathWorkspaceWorkflow.native.ts";
import { discardCarePlanPathDraft, restoreCarePlanPathDraft, saveCarePlanPathDraft } from "../../lib/careAssessment/carePlanPathWorkspaceDraft.native.ts";
import { buildCarePlanPathCommand, carePlanPathFields, carePlanPathGroups, carePlanPathKindsForGroup, carePlanPathSourceFields, carePlanPathSourceOptions, type CarePlanPathDraft } from "../../lib/careAssessment/carePlanPathWorkspaceForm.native.ts";
import { colors, spacing } from '@/theme';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
type Boundary = {
    owner: CarePermissionOwner | null;
    grants: readonly PermissionKey[];
    number: number;
    canCurrent(): boolean;
};
const when = (value: string) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value));
const sourceCurrent = (context: CarePlanPathContext, source: CarePlanPathSource) => context.sources.rows.some(row => JSON.stringify(row) === JSON.stringify(source));
const hasKindRights = (grants: readonly PermissionKey[], kind: CarePlanPathWorkspaceKind) => { const definition = carePlanPathWorkspaceDefinitions[kind]; return [definition.right, ...(definition.extraRights ?? [])].every(right => grants.includes(right as PermissionKey)); };
export function CarePlanPathWorkspace({ assessmentId }: {
    assessmentId: string;
}) { const auth = useAuth(), permissions = usePermissions(), tenantId = useServiceTenantId(), owner = carePermissionOwner(auth, tenantId, isDemoMode()), reference = useRef<Boundary | null>(null), mounted = useRef(true); if (!reference.current || !sameCarePermissionOwner(reference.current.owner, owner) || reference.current.grants !== permissions.permissions) {
    const grants = permissions.permissions;
    reference.current = { owner, grants, number: (reference.current?.number ?? 0) + 1, canCurrent: () => permissions.permissions === grants && carePlanPathWorkspaceReadRights.every(key => permissions.can(key as PermissionKey)) };
} const boundary = reference.current; useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []); const authority = useMemo<CarePlanPathAuthority | null>(() => { if (!boundary.owner || boundary.owner.demo || !boundary.owner.accessToken || !carePlanPathWorkspaceReadRights.every(key => boundary.grants.includes(key as PermissionKey)))
    return null; const own = boundary.owner, accessToken = boundary.owner.accessToken; return { tenantId: own.tenantId, assessmentId, actorId: own.profileId, accessToken, expiresAt: own.expiresAt, isCurrent: () => mounted.current && reference.current === boundary && carePermissionOwnerIsCurrent(own) && boundary.canCurrent() }; }, [boundary, assessmentId]); if (!authority || !authority.isCurrent())
    return <InfoBanner variant="warning" title="Verbundener Pflegeplanpfadarbeitsplatz gesperrt" message={owner?.demo ? 'Verbindliche Pflegeplanpfadvorgänge benötigen ein angemeldetes berechtigtes Pflegekonto.' : 'Das aktuelle eigene Pflegeplan-Leserecht ist nicht bestätigt.'}/>; return <CarePlanPathCase key={`${authority.tenantId}:${authority.assessmentId}:${boundary.number}`} authority={authority} grants={boundary.grants}/>; }
function CarePlanPathCase({ authority, grants }: {
    authority: CarePlanPathAuthority;
    grants: readonly PermissionKey[];
}) { const window = useNativeWorkflowWindow(); const styles = useStyles(), [context, setContext] = useState<CarePlanPathContext | null>(null), [state, setState] = useState<CarePlanPathState | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0), [journal, setJournal] = useState<CarePlanPathJournal | null>(null), [journalError, setJournalError] = useState(''), alive = useRef(true), ticket = useRef(0), running = useRef(false); const workflow = useMemo(() => new CarePlanPathWorkflow({ tenantId: authority.tenantId, assessmentId: authority.assessmentId, actorId: authority.actorId }, { storage: { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: key => window.localStorage.removeItem(key) }, lock: browserCarePlanPathLock, isCurrent: () => alive.current && authority.isCurrent(), commit: command => repository.commit(authority, command), confirm: command => repository.confirm(authority, command) }), [authority]); const current = () => alive.current && authority.isCurrent(); const readJournal = () => { try {
    setJournal(workflow.read());
    setJournalError('');
}
catch (caught) {
    setJournalError(caught instanceof Error ? caught.message : 'Gesicherter Vorgang ist beschädigt.');
} }; useEffect(() => { alive.current = true; readJournal(); const listener = (event: StorageEvent) => { if (event.key?.startsWith('caresuite.carePlanPath-workspace-journal.v1:'))
    readJournal(); }; window.addEventListener('storage', listener); return () => { alive.current = false; ticket.current += 1; window.removeEventListener('storage', listener); }; }, [workflow]); useEffect(() => { const own = ++ticket.current; setLoading(true); setContext(null); setState(null); setError(''); void repository.context(authority).then(result => { if (!current() || own !== ticket.current)
    return; if (!result.ok) {
    setError(result.error);
    setLoading(false);
    return;
} try {
    setContext(result.data);
    setState(decodeCarePlanPathHistory(result.data.history, result.data).state);
}
catch (caught) {
    setError(caught instanceof Error ? caught.message : 'Pflegeplanpfadverlauf ist widersprüchlich.');
}
finally {
    if (current() && own === ticket.current)
        setLoading(false);
} }); }, [authority, revision]); async function run(action: () => Promise<void>) { if (running.current || !current())
    return; running.current = true; setBusy(true); setError(''); try {
    await action();
}
catch (caught) {
    if (current())
        setError(caught instanceof Error ? caught.message : 'Vorgang konnte nicht bestätigt werden.');
}
finally {
    running.current = false;
    if (current()) {
        setBusy(false);
        readJournal();
    }
} } const recovery = journal ? <SectionPanel title="Gesicherter Pflegeplanpfadvorgang"><Text style={styles.body}>{journal.phase === 'dispatched' ? 'Die Speicherantwort ist unklar. Die exakt gesicherte Anfrage wird nicht erneut gesendet; ausschließlich ihre native Quittung wird gelesen.' : journal.phase === 'confirmed' ? 'Die Quittung ist gesichert. Vor einem neuen Vorgang muss derselbe Beleg im vollständig neu geladenen Originalverlauf erscheinen.' : journal.phase === 'rejected' ? journal.rejection : 'Die Anfrage wurde dauerhaft vorbereitet, aber noch nicht gesendet.'}</Text>{journal.phase === 'dispatched' ? <PremiumButton title="Gesicherten Vorgang ausschließlich prüfen" disabled={busy} loading={busy} onPress={() => void run(async () => { const result = await workflow.confirm(); if (!result.ok)
    throw Error(result.error); setRevision(x => x + 1); })}/> : null}{journal.phase === 'confirmed' ? <PremiumButton title="Quittung mit Originalverlauf abgleichen" disabled={busy} loading={busy} onPress={() => void run(async () => { const result = await repository.context(authority); if (!result.ok || !current())
    throw Error('Originalverlauf konnte nicht abgeglichen werden.'); await workflow.releaseConfirmed(result.data.history.events); setRevision(x => x + 1); })}/> : null}{['prepared', 'rejected'].includes(journal.phase) ? <PremiumButton title="Abgewiesenen oder ungesendeten Vorgang freigeben" variant="secondary" disabled={busy} onPress={() => void run(() => workflow.discardUnsentOrRejected())}/> : null}</SectionPanel> : null; return <View style={styles.stack}><SectionPanel title="Verbundener Pflegeplan-, Durchführungs- und Evaluationsweg" subtitle="Ziel, Maßnahme, Verantwortung, Termin, Planfreigabe, tatsächliche Durchführung, Abweichung, Wirkung, Evaluation, Visite und Berichtigung getrennt erfassen"><InfoBanner variant="info" message="Assessment und Planung bleiben getrennte Originale. Eine Planung beweist keine tatsächliche Durchführung; eine Durchführung beweist keine Wirkung; eine Visitenentscheidung beweist keine Umsetzung oder qualifizierte Abnahme. Dieser Arbeitsplatz erfindet keine Pflegeleistung, Wirkung, Freigabe oder Abnahme."/></SectionPanel>{journalError ? <ErrorState message={journalError}/> : null}{recovery}{error ? <ErrorState message={error} onRetry={busy ? undefined : () => setRevision(x => x + 1)}/> : null}{notice ? <SuccessState message={notice}/> : null}<PremiumButton title="Aktuelle vollständige Pflegeplanpfadoriginale neu laden" variant="secondary" disabled={busy} onPress={() => setRevision(x => x + 1)}/>{loading ? <LoadingState message="Assessment-, Ziel-, Maßnahmen-, Personal-, Termin-, Durchführungs-, Abweichungs-, Wirkungs-, Evaluations-, Visiten- und Verlaufsoriginale werden vollständig geladen…"/> : null}{context && state ? <><CarePlanPathOverview context={context} state={state}/><CarePlanPathEditor key={`${context.loadedAt}:${state.headId ?? 'empty'}`} context={context} state={state} grants={grants} disabled={busy || loading || !!error || !!journal || !!journalError || !current()} isCurrent={current} onSubmit={command => void run(async () => { if (workflow.read())
    throw Error('Zuerst den gesicherten Vorgang abgleichen.'); if (!hasKindRights(grants, command.kind) || !current())
    throw Error('Das aktuelle Recht für diese Vorgangsart fehlt.'); assertCarePlanPathSelectionCurrent(command, context); const result = await workflow.dispatch(command); if (!result.ok)
    throw Error(result.error); discardCarePlanPathDraft(window.sessionStorage, { tenantId: authority.tenantId, assessmentId: authority.assessmentId, actorId: authority.actorId }); setNotice('Nativer Pflegeplanpfadbeleg ist bestätigt gespeichert. Assessment, Planung, tatsächliche Durchführung, Wirkung, Freigabe und qualifizierte Abnahme bleiben getrennt.'); setRevision(x => x + 1); })}/></> : null}</View>; }
function CarePlanPathOverview({ context, state }: {
    context: CarePlanPathContext;
    state: CarePlanPathState;
}) { const styles = useStyles(), [limit, setLimit] = useState(20), active = state.events.filter(event => !state.corrected.includes(event.id)).toReversed(); return <><SectionPanel title="Aktueller Originalbestand"><Text style={styles.body}>{context.sources.count} zugängliche Originalquellen · {state.events.length} unveränderliche Vorgänge · {state.corrected.length} kenntlich gemachte Berichtigungen.</Text><Text style={styles.caption}>Lesezeitpunkt {when(context.loadedAt)} · Verlaufskopf {state.headId ?? 'noch leer'}</Text></SectionPanel><SectionPanel title="Pflegeplanpfadverlauf">{active.slice(0, limit).map(event => <View key={event.id} style={styles.item}><Text style={styles.heading}>{carePlanPathWorkspaceDefinitions[event.command.kind].label}</Text><Text style={styles.body}>{event.actorName} · Vorgang {when(event.command.occurredAt)} · gespeichert {when(event.recordedAt)}</Text><Text style={styles.body}>{event.command.note}</Text><Text selectable style={styles.caption}>Beleg {event.id} · Anfrage {event.command.requestId}</Text></View>)}{limit < active.length ? <PremiumButton title="Weitere Originalvorgänge anzeigen" variant="secondary" onPress={() => setLimit(x => x + 20)}/> : null}</SectionPanel></>; }
function CarePlanPathEditor({ context, state, grants, disabled, isCurrent, onSubmit }: {
    context: CarePlanPathContext;
    state: CarePlanPathState;
    grants: readonly PermissionKey[];
    disabled: boolean;
    isCurrent(): boolean;
    onSubmit(command: ReturnType<typeof buildCarePlanPathCommand>): void;
}) { const styles = useStyles(), scope = { tenantId: context.tenantId, assessmentId: context.assessmentId, actorId: context.actorId }, availableGroups = carePlanPathGroups.filter(group => carePlanPathKindsForGroup(group).some(kind => hasKindRights(grants, kind))), firstGroup = availableGroups[0] ?? carePlanPathGroups[0]!, restored = useMemo(() => { try {
    return { value: restoreCarePlanPathDraft(window.sessionStorage, scope, state.headId, source => sourceCurrent(context, source)), error: '' };
}
catch (caught) {
    return { value: null, error: caught instanceof Error ? caught.message : 'Entwurf ist beschädigt.' };
} }, [context.loadedAt, state.headId]), old = restored.value?.draft, [group, setGroup] = useState(old && availableGroups.includes(carePlanPathWorkspaceDefinitions[old.kind].group) ? carePlanPathWorkspaceDefinitions[old.kind].group : firstGroup), availableKinds = carePlanPathKindsForGroup(group).filter(kind => hasKindRights(grants, kind)), [kind, setKind] = useState<CarePlanPathWorkspaceKind>(old && availableKinds.includes(old.kind) ? old.kind : availableKinds[0] ?? 'correction'), [occurredAt, setOccurredAt] = useState(old?.occurredAt ?? new Date().toISOString()), [note, setNote] = useState(old?.note ?? ''), [values, setValues] = useState<Record<string, string>>(old?.values ?? {}), [selected, setSelected] = useState(old?.selected ?? {}), [formError, setFormError] = useState(restored.error), [saved, setSaved] = useState(false), draft: CarePlanPathDraft = { version: '2026-10-16.4', scope, headId: state.headId, kind, occurredAt, note, values, selected }; useEffect(() => { if (disabled)
    return; const timer = setTimeout(() => { try {
    saveCarePlanPathDraft(window.sessionStorage, draft);
    setSaved(true);
}
catch (caught) {
    setFormError(caught instanceof Error ? caught.message : 'Entwurf konnte nicht gesichert werden.');
} }, 250); return () => clearTimeout(timer); }, [disabled, kind, occurredAt, note, JSON.stringify(values), JSON.stringify(selected), state.headId]); const changeKind = (next: CarePlanPathWorkspaceKind) => { setKind(next); setValues({}); setSelected({}); setSaved(false); }; if (!availableGroups.length)
    return <InfoBanner variant="warning" message="Die Pflegeplanoriginale sind lesbar; für die gewählte Vorgangsart fehlen die aktuellen Pflege- oder Prüfrechte."/>; return <SectionPanel title="Neuen Pflegeplanpfadvorgang erfassen oder berichtigen"><FilterChipGroup wrap options={availableGroups.map(key => ({ key, label: key }))} value={group} onChange={disabled ? undefined : value => { setGroup(value); changeKind(carePlanPathKindsForGroup(value).find(next => hasKindRights(grants, next)) ?? 'correction'); }}/><FilterChipGroup wrap options={availableKinds.map(key => ({ key, label: carePlanPathWorkspaceDefinitions[key].label }))} value={kind} onChange={disabled ? undefined : value => changeKind(value as CarePlanPathWorkspaceKind)}/>{restored.value?.changed ? <InfoBanner variant="warning" message="Entwurf wiederhergestellt. Wegen geänderter Originale oder Verlaufskopf wurden bisherige Originalauswahlen zurückgesetzt; Texte bleiben erhalten."/> : null}<PremiumInput label="Tatsächlicher Vorgangszeitpunkt *" value={occurredAt} onChangeText={setOccurredAt} editable={!disabled}/><PremiumInput label="Nachvollziehbarer Anlass *" value={note} onChangeText={setNote} editable={!disabled} multiline maxLength={4000}/>{carePlanPathSourceFields(kind).map(field => { const options = carePlanPathSourceOptions(field, context); return <View key={field.key} style={styles.stack}><SourcePicker label={`${field.label} *`} rows={options} value={selected[field.key]?.id ?? ''} onChange={disabled ? () => { } : id => { const choice = options.find(option => option.id === id); setSelected(previous => { const next = { ...previous }; if (choice)
    next[field.key] = { id: choice.id, value: choice.value };
else
    delete next[field.key]; return next; }); }} disabled={disabled}/>{!options.length ? <Text style={styles.caption}>Keine aktuell vollständig zugängliche Originalquelle dieser Art.</Text> : null}</View>; })}{carePlanPathFields(kind).map(field => <PremiumInput key={field.key} label={`${field.label} *`} value={values[field.key] ?? ''} onChangeText={value => setValues(previous => ({ ...previous, [field.key]: value }))} placeholder={field.type === 'date' ? 'JJJJ-MM-TT' : field.type === 'enum' ? field.values?.join(' / ') : undefined} editable={!disabled} multiline={field.type === 'text'} maxLength={4000}/>)}{formError ? <ErrorState message={formError}/> : null}{saved ? <Text style={styles.caption}>Entwurf für dieses Konto, diesen Mandanten und dieses Assessment auf diesem Gerät gesichert.</Text> : null}<PremiumButton title="Pflegeplanpfadvorgang verbindlich speichern" disabled={disabled} onPress={() => { try {
    if (!isCurrent())
        throw Error('Konto, Mandant oder Rechte wurden geändert.');
    onSubmit(buildCarePlanPathCommand(draft, state, crypto.randomUUID(), crypto.randomUUID()));
    setFormError('');
}
catch (caught) {
    setFormError(caught instanceof Error ? caught.message : 'Vorgang ist unvollständig.');
} }}/></SectionPanel>; }
function useStyles() { const { c } = useCareLightPalette(); const adaptive = useAdaptiveContentStyles(); return useMemo(() => StyleSheet.create({ stack: { minWidth: 0, gap: spacing.md }, item: { backgroundColor: c.surfaceAlt, borderColor: c.border, minWidth: 0, padding: spacing.md, gap: spacing.xs }, heading: { color: colors.textPrimary, fontWeight: '700', flexShrink: 1 }, body: { color: colors.textPrimary, lineHeight: 21, flexShrink: 1 }, caption: { color: colors.textSecondary, lineHeight: 19, flexShrink: 1 } }), [adaptive, c]); }
