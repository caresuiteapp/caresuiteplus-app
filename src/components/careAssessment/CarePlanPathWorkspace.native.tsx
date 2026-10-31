// Generated native presentation from src/components/careAssessment/CarePlanPathWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useAssessmentPathOwnership, type AssessmentPathIntegration } from "../../lib/careAssessment/useAssessmentPathOwnership.native.ts";
import { useAssessmentPathDraft } from "../../lib/careAssessment/useAssessmentPathDraft.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { SourcePicker } from "../../screens/pflege/TreatmentSourcePicker.native.tsx";
import { useAuth } from '@/lib/auth/context';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isDemoMode } from '@/lib/supabase/config';
import { carePermissionOwner, carePermissionOwnerIsCurrent, sameCarePermissionOwner, type CarePermissionOwner } from "../../lib/permissions/carePermissionOwner.native.ts";
import type { PermissionKey } from '@/types/permissions';
import { carePlanPathVersion, assertCarePlanPathSelectionCurrent, decodeCarePlanPathHistory, carePlanPathWorkspaceDefinitions, carePlanPathWorkspaceReadRights, type CarePlanPathContext, type CarePlanPathSource, type CarePlanPathState, type CarePlanPathWorkspaceKind } from "../../lib/careAssessment/carePlanPathWorkspaceDomain.native.ts";
import { carePlanPathWorkspaceRepository as repository } from "../../lib/careAssessment/carePlanPathWorkspaceRepository.supabase.native.ts";
import type { CarePlanPathAuthority } from "../../lib/careAssessment/carePlanPathWorkspaceRepository.native.ts";
import { carePlanPathJournalKey, carePlanPathLegacyJournalKey, browserCarePlanPathLock, CarePlanPathWorkflow, type CarePlanPathJournal } from "../../lib/careAssessment/carePlanPathWorkspaceWorkflow.native.ts";
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
export function CarePlanPathWorkspace({ assessmentId, ...integration }: {
    assessmentId: string;
} & AssessmentPathIntegration) { const auth = useAuth(), permissions = usePermissions(), tenantId = useServiceTenantId(), owner = carePermissionOwner(auth, tenantId, isDemoMode()), reference = useRef<Boundary | null>(null), mounted = useRef(true); if (!reference.current || !sameCarePermissionOwner(reference.current.owner, owner) || reference.current.grants !== permissions.permissions) {
    const grants = permissions.permissions;
    reference.current = { owner, grants, number: (reference.current?.number ?? 0) + 1, canCurrent: () => permissions.permissions === grants && carePlanPathWorkspaceReadRights.every(key => permissions.can(key as PermissionKey)) };
} const boundary = reference.current; useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []); const authority = useMemo<CarePlanPathAuthority | null>(() => { if (!boundary.owner || boundary.owner.demo || !boundary.owner.accessToken || !carePlanPathWorkspaceReadRights.every(key => boundary.grants.includes(key as PermissionKey)))
    return null; const own = boundary.owner, accessToken = boundary.owner.accessToken; return { tenantId: own.tenantId, assessmentId, actorId: own.profileId, accessToken, expiresAt: own.expiresAt, isCurrent: () => mounted.current && reference.current === boundary && carePermissionOwnerIsCurrent(own) && boundary.canCurrent() }; }, [boundary, assessmentId]); if (!authority || !authority.isCurrent())
    return <InfoBanner variant="warning" title="Verbundener Pflegeplanpfadarbeitsplatz gesperrt" message={owner?.demo ? 'Verbindliche Pflegeplanpfadvorgänge benötigen ein angemeldetes berechtigtes Pflegekonto.' : 'Das aktuelle eigene Pflegeplan-Leserecht ist nicht bestätigt.'}/>; return <CarePlanPathCase key={`${authority.tenantId}:${authority.assessmentId}:${boundary.number}`} authority={authority} grants={boundary.grants} integration={integration}/>; }
function CarePlanPathCase({ authority, grants, integration }: {
    authority: CarePlanPathAuthority;
    grants: readonly PermissionKey[];
    integration: AssessmentPathIntegration;
}) { const window = useNativeWorkflowWindow(); const styles = useStyles(), [context, setContext] = useState<CarePlanPathContext | null>(null), [state, setState] = useState<CarePlanPathState | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0), [journal, setJournal] = useState<CarePlanPathJournal | null>(null), [journalError, setJournalError] = useState(''), alive = useRef(true), ticket = useRef(0), contextOwner = useRef<object | null>(null); const current = () => alive.current && authority.isCurrent() && integration.isCurrent?.() !== false; const control = useAssessmentPathOwnership({ ...integration, owner: authority, current, onBusy: setBusy, initiallyReady: false }); const scopedAuthority = useMemo(() => ({ ...authority, isCurrent: control.current }), [authority, control.ownerToken]); const workflow = useMemo(() => new CarePlanPathWorkflow({ tenantId: authority.tenantId, assessmentId: authority.assessmentId, actorId: authority.actorId }, { storage: { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: key => window.localStorage.removeItem(key) }, lock: browserCarePlanPathLock, isCurrent: control.current, commit: command => repository.commit(scopedAuthority, command), confirm: command => repository.confirm(scopedAuthority, command) }), [scopedAuthority]); const readJournal = () => { try {
    const next = workflow.read();
    control.setJournal(!!next);
    setJournal(next);
    setJournalError('');
}
catch (caught) {
    control.setJournal(true);
    setJournalError(caught instanceof Error ? caught.message : 'Gesicherter Vorgang ist beschädigt.');
} }; useEffect(() => { alive.current = true; readJournal(); const listener = (event: StorageEvent) => { if (event.key === null || [carePlanPathJournalKey({ tenantId: authority.tenantId, assessmentId: authority.assessmentId, actorId: authority.actorId }), carePlanPathLegacyJournalKey({ tenantId: authority.tenantId, assessmentId: authority.assessmentId, actorId: authority.actorId })].includes(event.key))
    readJournal(); }; window.addEventListener('storage', listener); return () => { alive.current = false; ticket.current += 1; window.removeEventListener('storage', listener); }; }, [workflow]); useEffect(() => { const own = ++ticket.current; control.setReady(false); setLoading(true); setContext(null); setState(null); setError(''); void repository.context(scopedAuthority).then(result => { if (!control.current() || own !== ticket.current)
    return; if (!result.ok) {
    setError(result.error);
    setLoading(false);
    return;
} try {
    contextOwner.current = control.ownerToken;
    setContext(result.data);
    setState(decodeCarePlanPathHistory(result.data.history, result.data).state);
    control.setReady(true);
}
catch (caught) {
    setError(caught instanceof Error ? caught.message : 'Pflegeplanpfadverlauf ist widersprüchlich.');
}
finally {
    if (control.current() && own === ticket.current)
        setLoading(false);
} }); }, [scopedAuthority, revision, control.ownerToken]); async function run(action: (current: () => boolean) => Promise<void>, write = false) { try {
    await control.run(action, write);
}
catch (caught) {
    if (control.current())
        setError(caught instanceof Error ? caught.message : 'Vorgang konnte nicht bestätigt werden.');
}
finally {
    if (control.current())
        readJournal();
} } const reload = async () => { if (await control.leave() && control.current()) {
    control.setReady(false);
    setRevision(value => value + 1);
} }; const recovery = journal ? <SectionPanel title="Gesicherter Pflegeplanpfadvorgang"><Text style={styles.body}>{journal.phase === 'dispatched' ? 'Die Speicherantwort ist unklar. Die exakt gesicherte Anfrage wird nicht erneut gesendet; ausschließlich ihre native Quittung wird gelesen.' : journal.phase === 'confirmed' ? 'Die Quittung ist gesichert. Vor einem neuen Vorgang muss derselbe Beleg im vollständig neu geladenen Originalverlauf erscheinen.' : journal.phase === 'rejected' ? journal.rejection : 'Die Anfrage wurde dauerhaft vorbereitet, aber noch nicht gesendet.'}</Text>{journal.phase === 'dispatched' ? <PremiumButton title="Gesicherten Vorgang ausschließlich prüfen" disabled={busy} loading={busy} onPress={() => void run(async (own) => { const result = await workflow.confirm(); if (!own())
    return; if (!result.ok)
    throw Error(result.error); setRevision(x => x + 1); })}/> : null}{journal.phase === 'confirmed' ? <PremiumButton title="Quittung mit Originalverlauf abgleichen" disabled={busy} loading={busy} onPress={() => void run(async (own) => { const result = await repository.context(scopedAuthority); if (!own())
    return; if (!result.ok || !control.current())
    throw Error('Originalverlauf konnte nicht abgeglichen werden.'); await workflow.releaseConfirmed(result.data); if (!own())
    return; control.setReady(false); setRevision(x => x + 1); })}/> : null}{['prepared', 'rejected'].includes(journal.phase) ? <PremiumButton title="Abgewiesenen oder ungesendeten Vorgang freigeben" variant="secondary" disabled={busy} onPress={() => void run(async (own) => { await workflow.discardUnsentOrRejected(); if (!own())
    return; control.setReady(false); setRevision(value => value + 1); })}/> : null}</SectionPanel> : null; return <View style={styles.stack}><SectionPanel title="Verbundener Pflegeplan-, Durchführungs- und Evaluationsweg" subtitle="Ziel, Maßnahme, Verantwortung, Termin, Planfreigabe, tatsächliche Durchführung, Abweichung, Wirkung, Evaluation, Visite und Berichtigung getrennt erfassen"><InfoBanner variant="info" title="Aktuell: Planung und Prüfweitergabe" message="Neue klinische Freigaben und tatsächliche Leistungen bleiben gesperrt. Assessment und Planung bleiben getrennte Originale. Eine Planung beweist keine tatsächliche Durchführung; eine Durchführung beweist keine Wirkung; eine Visitenentscheidung beweist keine Umsetzung oder qualifizierte Abnahme. Dieser Arbeitsplatz erfindet keine Pflegeleistung, Wirkung, Freigabe oder Abnahme."/></SectionPanel>{journalError ? <ErrorState message={journalError}/> : null}{recovery}{error ? <ErrorState message={error} onRetry={busy ? undefined : () => void reload()}/> : null}{notice ? <SuccessState message={notice}/> : null}<PremiumButton title="Aktuelle vollständige Pflegeplanpfadoriginale neu laden" variant="secondary" disabled={busy} onPress={() => void reload()}/>{loading ? <LoadingState message="Assessment-, Ziel-, Maßnahmen-, Personal-, Termin-, Durchführungs-, Abweichungs-, Wirkungs-, Evaluations-, Visiten- und Verlaufsoriginale werden vollständig geladen…"/> : null}{context && state ? <><CarePlanPathOverview context={context} state={state}/><CarePlanPathEditor key={`${context.loadedAt}:${state.headId ?? 'empty'}`} context={context} state={state} grants={grants} disabled={busy || loading || !!error || !!journal || !!journalError || !!integration.blocked || !control.current() || contextOwner.current !== control.ownerToken} isCurrent={control.current} isLeaving={control.isLeaving} registerLeave={control.registerEditorLeave} onDirty={control.editorState} onSubmit={command => void run(async (own) => { if (workflow.read())
    throw Error('Zuerst den gesicherten Vorgang abgleichen.'); if (!context.supportedWriteKinds.includes(command.kind) || !hasKindRights(grants, command.kind) || !control.current())
    throw Error('Das aktuelle Recht für diese Vorgangsart fehlt.'); assertCarePlanPathSelectionCurrent(command, context); const result = await workflow.dispatch(command); if (!own())
    return; if (!result.ok)
    throw Error(result.error); discardCarePlanPathDraft(window.sessionStorage, { tenantId: authority.tenantId, assessmentId: authority.assessmentId, actorId: authority.actorId }); setNotice('Technischer Pflegeplanpfadbeleg ist bestätigt gespeichert. Assessment, Planung, tatsächliche Durchführung, Wirkung, Freigabe und qualifizierte Abnahme bleiben getrennt.'); setRevision(x => x + 1); }, true)}/></> : null}</View>; }
function CarePlanPathOverview({ context, state }: {
    context: CarePlanPathContext;
    state: CarePlanPathState;
}) { const styles = useStyles(), [limit, setLimit] = useState(20), active = state.events.toReversed(); return <><SectionPanel title="Technischer V2-Originalbestand"><Text style={styles.body}>{context.sources.count} zugängliche Originalquellen · {state.events.length} unveränderliche Vorgänge · {state.corrected.length} kenntlich gemachte Berichtigungen.</Text><Text style={styles.caption}>Lesezeitpunkt {when(context.loadedAt)} · Verlaufskopf {state.headId ?? 'noch leer'}</Text></SectionPanel><SectionPanel title="Technischer Pflegeplanpfadverlauf">{active.slice(0, limit).map(event => <View key={event.id} style={styles.item}><Text style={styles.heading}>{carePlanPathWorkspaceDefinitions[event.command.kind].label}</Text><Text style={styles.body}>{event.actorName} · Vorgang {when(event.command.occurredAt)} · gespeichert {when(event.recordedAt)}</Text><Text style={styles.body}>{event.command.note}</Text>{state.corrected.includes(event.id) ? <Text style={styles.caption}>Durch einen späteren Originalvorgang berichtigt.</Text> : null}<Text selectable style={styles.caption}>Beleg {event.id} · Anfrage {event.command.requestId}</Text></View>)}{limit < active.length ? <PremiumButton title="Weitere Originalvorgänge anzeigen" variant="secondary" onPress={() => setLimit(x => x + 20)}/> : null}</SectionPanel></>; }
function CarePlanPathEditor({ context, state, grants, disabled, isCurrent, isLeaving, registerLeave, onDirty, onSubmit }: {
    context: CarePlanPathContext;
    state: CarePlanPathState;
    grants: readonly PermissionKey[];
    disabled: boolean;
    isCurrent(): boolean;
    isLeaving(): boolean;
    registerLeave(guard: (() => Promise<boolean>) | null): void;
    onDirty(dirty: boolean): void;
    onSubmit(command: ReturnType<typeof buildCarePlanPathCommand>): void;
}) {
    const styles = useStyles(), scope = { tenantId: context.tenantId, assessmentId: context.assessmentId, actorId: context.actorId };
    const available = (kind: CarePlanPathWorkspaceKind) => context.supportedWriteKinds.includes(kind) && hasKindRights(grants, kind) && carePlanPathSourceFields(kind).every(field => carePlanPathSourceOptions(field, context).length > 0);
    const groups = carePlanPathGroups.filter(group => carePlanPathKindsForGroup(group).some(available));
    const restored = useMemo(() => { try {
        return { value: restoreCarePlanPathDraft(window.sessionStorage, scope, state.headId, source => sourceCurrent(context, source)), error: '' };
    }
    catch (caught) {
        return { value: null, error: caught instanceof Error ? caught.message : 'Entwurf ist beschädigt.' };
    } }, [context]);
    const old = restored.value?.draft, initialKind = old ? old.kind : carePlanPathKindsForGroup(groups[0] ?? carePlanPathGroups[0]!).find(available) ?? 'goal_plan';
    const initial: CarePlanPathDraft = { version: carePlanPathVersion, scope, headId: state.headId, kind: initialKind, occurredAt: old?.occurredAt ?? '', note: old?.note ?? '', values: old?.values ?? {}, selected: old?.selected ?? {} };
    const form = useAssessmentPathDraft({ initial, restored: !!old, disabled, isCurrent, isLeaving, registerLeave, onDirty, save: draft => saveCarePlanPathDraft(window.sessionStorage, draft) }), draft = form.draft;
    const group = carePlanPathWorkspaceDefinitions[draft.kind].group, kinds = carePlanPathKindsForGroup(group).filter(available), choose = !disabled && form.current() && !isLeaving(), edit = choose && available(draft.kind);
    const change = (patch: Parameters<typeof form.change>[0]) => { if (edit && form.snapshot().kind === draft.kind)
        form.change(patch); };
    const changeKind = (kind: CarePlanPathWorkspaceKind) => { if (available(kind))
        form.change({ kind, values: {}, selected: {} }); };
    if (!groups.length)
        return <InfoBanner variant="info" message="Die Originale sind lesbar. Für eine neue unterstützte Planung fehlen aktuelle Rechte oder vollständige Originalquellen."/>;
    return <SectionPanel title="Pflegeplanpfad planen oder berichtigen" subtitle="Verfügbare Aktionen folgen den bestätigten Serverrechten und Originalquellen.">
  <FilterChipGroup wrap options={groups.map(key => ({ key, label: key }))} value={group} onChange={choose ? value => { const next = carePlanPathKindsForGroup(value).find(available); if (next)
        changeKind(next); } : undefined}/>
  <FilterChipGroup wrap options={kinds.map(key => ({ key, label: carePlanPathWorkspaceDefinitions[key].label }))} value={draft.kind} onChange={choose ? value => changeKind(value as CarePlanPathWorkspaceKind) : undefined}/>
  {!available(draft.kind) ? <InfoBanner variant="warning" message="Dieser frühere Entwurf ist aktuell nicht für neue Schreibvorgänge freigegeben. Seine Angaben bleiben lesbar; wählen Sie für einen neuen Vorgang eine verfügbare Planungsart."/> : null}
  {restored.value?.changed ? <InfoBanner variant="warning" message="Entwurf wiederhergestellt. Geänderte Originalauswahlen wurden zurückgesetzt; Texte bleiben erhalten."/> : null}
  <PremiumInput label="Tatsächlicher Vorgangszeitpunkt *" placeholder="JJJJ-MM-TTTHH:mm:ss+02:00" value={draft.occurredAt} onChangeText={occurredAt => change({ occurredAt })} editable={edit}/>
  <PremiumInput label="Nachvollziehbarer Anlass *" value={draft.note} onChangeText={note => change({ note })} editable={edit} multiline maxLength={4000}/>
  {carePlanPathSourceFields(draft.kind).map(field => { const options = carePlanPathSourceOptions(field, context); return <View key={field.key} style={styles.stack}><SourcePicker label={`${field.label} *`} rows={options} value={draft.selected[field.key]?.id ?? ''} disabled={!edit} onChange={id => change(current => { const choice = options.find(option => option.id === id), selected = { ...current.selected }; if (choice)
        selected[field.key] = { id: choice.id, value: choice.value };
    else
        delete selected[field.key]; return { selected }; })}/>{!options.length ? <Text style={styles.caption}>Keine vollständig zugängliche Originalquelle.</Text> : null}</View>; })}
  {carePlanPathFields(draft.kind).map(field => <PremiumInput key={field.key} label={`${field.label} *`} value={draft.values[field.key] ?? ''} onChangeText={value => change(current => ({ values: { ...current.values, [field.key]: value } }))} placeholder={field.type === 'date' ? 'JJJJ-MM-TT' : field.type === 'enum' ? field.values?.join(' / ') : undefined} editable={edit} multiline={field.type === 'text'} maxLength={4000}/>)}
  {restored.error || form.error ? <ErrorState message={form.error || restored.error}/> : null}
  {form.saved ? <Text style={styles.caption}>Entwurf für dieses Konto und Assessment auf diesem Gerät gesichert.</Text> : null}
  <PremiumButton title="Pflegeplanpfadplanung speichern" disabled={!edit || !available(draft.kind)} onPress={() => { if (!edit || !form.current() || isLeaving() || !available(draft.kind))
        return; try {
        onSubmit(buildCarePlanPathCommand(form.snapshot(), state, crypto.randomUUID(), crypto.randomUUID()));
        form.setError('');
    }
    catch (caught) {
        form.setError(caught instanceof Error ? caught.message : 'Vorgang ist unvollständig.');
    } }}/>
 </SectionPanel>;
}
function useStyles() { const { c } = useCareLightPalette(); const adaptive = useAdaptiveContentStyles(); return useMemo(() => StyleSheet.create({ stack: { minWidth: 0, gap: spacing.md }, item: { backgroundColor: c.surfaceAlt, borderColor: c.border, minWidth: 0, padding: spacing.md, gap: spacing.xs }, heading: { color: colors.textPrimary, fontWeight: '700', flexShrink: 1 }, body: { color: colors.textPrimary, lineHeight: 21, flexShrink: 1 }, caption: { color: colors.textSecondary, lineHeight: 19, flexShrink: 1 } }), [adaptive, c]); }
