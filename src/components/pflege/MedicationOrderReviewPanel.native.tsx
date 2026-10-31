// Generated native presentation from src/components/pflege/MedicationOrderReviewPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorState, InfoBanner, LoadingState, PremiumBadge, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { readMedicationOrderReviewWorkspace, type MedicationOrderReviewWorkspace } from "../../lib/pflege/medicationOrderReviewService.native.ts";
import { inspectMedicationOrderReviewJournal, recoverMedicationOrderReviewDurably, saveMedicationOrderReviewDurably, type MedicationOrderReviewJournal } from "../../lib/pflege/medicationOrderReviewWorkflow.native.ts";
import { makeMedicationOrderReviewPacket, medicationOrderReviewActionAllowed, medicationOrderReviewState, type MedicationOrderReviewPacket, type MedicationOrderReviewItem, type MedicationOrderApplyPacket } from "../../lib/pflege/medicationOrderReviewDomain.native.ts";
import { readMedicationOrderRevisionWorkspace } from "../../lib/pflege/medicationOrderRevisionService.native.ts";
import { medicationOrderRevisionFieldMap, type MedicationOrderRevision } from "../../lib/pflege/medicationOrderRevisionDomain.native.ts";
import { medicationTimeDisplay } from "../../lib/pflege/medicationTimeDisplay.native.ts";
import { sameWoundJson, woundUuid } from '@/lib/pflege/woundCareDomain';
import type { RoleKey } from '@/types';
import { spacing, typography } from '@/theme';
type ReviewAction = 'request' | 'authorize' | 'reject' | 'revoke' | 'apply';
type ReviewWorkspace = MedicationOrderReviewWorkspace & {
    revisions: MedicationOrderRevision[];
};
type ReviewDraft = {
    action: ReviewAction;
    reason: string;
    revision: MedicationOrderRevision;
    item: MedicationOrderReviewItem | null;
};
type ReviewPending = {
    kind: 'review';
    packet: MedicationOrderReviewPacket;
} | {
    kind: 'apply';
    packet: MedicationOrderApplyPacket;
    item: MedicationOrderReviewItem;
};
type ReviewPanelContext = {
    tenantId: string;
    clientId: string;
    medicationId: string;
    actorId: string;
    role: RoleKey | null;
    profileRole: RoleKey | null;
    canView: boolean;
    canSources: boolean;
    canManage: boolean;
    canReview?: boolean;
    blocked: boolean;
    currentOrderVersion: string;
    registerLeave?(fn: (() => Promise<boolean>) | null): void;
    onEditingChange?(editing: boolean): boolean | void;
    onApplied?(): void;
    isLeaving?(): boolean;
};
const actionLabels: Record<ReviewAction, string> = { request: 'Prüfung anfordern', authorize: 'Abgleich bestätigen', reject: 'Zurückgeben', revoke: 'Berechtigung widerrufen', apply: 'Angaben übernehmen' };
const reviewStateLabels = { pending: 'Prüfung offen', expired: 'Abgelaufen', authorized: 'Übertragung zeitlich berechtigt', rejected: 'Zur Überarbeitung zurückgegeben', revoked: 'Berechtigung widerrufen' };
const reviewFields: Record<keyof typeof medicationOrderRevisionFieldMap, string> = { medicationName: 'Präparat', activeIngredient: 'Wirkstoff', strength: 'Stärke', form: 'Form', dose: 'Dosis', unit: 'Einheit', route: 'Applikationsweg', prescriber: 'Verordnende Person', validFrom: 'Gültig ab', validUntil: 'Gültig bis', indication: 'Indikation', isPrn: 'Bedarfsmedikation', minimumIntervalMinutes: 'Mindestabstand in Minuten', maximumDose: 'Höchstmenge', maximumDoseUnit: 'Einheit der Höchstmenge', maximumPeriodHours: 'Bezugszeitraum in Stunden' };
const reviewTime = (v: unknown) => typeof v === 'string' ? medicationTimeDisplay(v).display : 'Nicht hinterlegt';
const reviewValue = (v: unknown) => v === null || v === undefined || v === '' ? 'Nicht hinterlegt' : v === true ? 'Ja' : v === false ? 'Nein' : String(v);
function useMedicationOrderReviewController(context: ReviewPanelContext) {
    const [owner] = useState(() => ({ tenantId: context.tenantId, clientId: context.clientId, medicationId: context.medicationId, actorId: context.actorId, role: context.profileRole }));
    const current = useRef(context);
    current.current = context;
    const alive = useRef(true), editing = useRef(false), flight = useRef(false), loadFlight = useRef(false), pending = useRef<ReviewPending | null>(null), journalRef = useRef<MedicationOrderReviewJournal | null>(null), saved = useRef(false), valid = useRef(false), generation = useRef(0), epoch = useRef(0);
    const [workspace, setWorkspace] = useState<ReviewWorkspace | null>(null), [draft, setDraft] = useState<ReviewDraft | null>(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [uncertain, setUncertain] = useState(false), [confirmed, setConfirmed] = useState(false), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null);
    const workspaceRef = useRef(workspace), draftRef = useRef(draft);
    workspaceRef.current = workspace;
    draftRef.current = draft;
    const localOwner = () => { const c = current.current; return alive.current && c.tenantId === owner.tenantId && c.clientId === owner.clientId && c.medicationId === owner.medicationId && c.actorId === owner.actorId && c.role === owner.role && c.profileRole === owner.role; };
    const ownRead = useCallback(() => localOwner() && [owner.tenantId, owner.clientId, owner.medicationId, owner.actorId].every(woundUuid) && !!owner.role && current.current.canView && current.current.canSources && current.current.canManage, []);
    const scope = () => ({ tenantId: owner.tenantId, clientId: owner.clientId, medicationId: owner.medicationId });
    const canOperate = () => ownRead() && !current.current.isLeaving?.() && !current.current.blocked && !flight.current && !loadFlight.current && !pending.current && !journalRef.current && !saved.current && valid.current && workspaceRef.current?.order.updated_at === current.current.currentOrderVersion;
    const load = useCallback(async () => {
        if (!ownRead() || current.current.isLeaving?.() || current.current.blocked || flight.current || pending.current || editing.current && !journalRef.current || loadFlight.current)
            return;
        valid.current = false;
        loadFlight.current = true;
        const ticket = ++generation.current;
        setLoading(true);
        setError(null);
        const active = () => ownRead() && !current.current.blocked && generation.current === ticket;
        try {
            const inspected = inspectMedicationOrderReviewJournal({ ...scope(), actorId: owner.actorId });
            if (!inspected.ok) {
                setUncertain(true);
                throw Error(inspected.error);
            }
            if (inspected.data) {
                if (!editing.current && current.current.onEditingChange?.(true) === false)
                    throw Error('Die gespeicherte Prüfung wartet auf das Schließen einer anderen Bearbeitung.');
                editing.current = true;
                journalRef.current = inspected.data;
                setUncertain(true);
            }
            else if (!pending.current && !journalRef.current)
                setUncertain(false);
            const [reviews, revisions] = await Promise.all([readMedicationOrderReviewWorkspace(scope(), current.current.role, active), readMedicationOrderRevisionWorkspace(scope(), current.current.role, active)]);
            if (!active())
                return;
            if (!reviews.ok || !revisions.ok) {
                setError(!reviews.ok ? reviews.error : !revisions.ok ? revisions.error : 'Bestand unvollständig.');
                return;
            }
            if (!sameWoundJson(reviews.data.order, revisions.data.order))
                throw Error('Verordnung wurde während des Ladens geändert. Neu laden.');
            const latest = await readMedicationOrderReviewWorkspace(scope(), current.current.role, active);
            if (!active())
                return;
            if (!latest.ok || !sameWoundJson(reviews.data, latest.data))
                throw Error('Originalabgleich wurde während des Ladens fortgeschrieben.');
            const loaded = { ...reviews.data, revisions: revisions.data.items };
            workspaceRef.current = loaded;
            setWorkspace(loaded);
            valid.current = true;
            if (inspected.data) {
                const operation = inspected.data.operation;
                let reviewItem: MedicationOrderReviewItem | undefined;
                let originalRevision: MedicationOrderRevision | undefined;
                if (operation.kind === 'apply') {
                    const p = operation.packet;
                    reviewItem = loaded.items.find(v => v.request.revisionId === p.revisionId && v.authorization?.id === p.authorizationId);
                }
                else {
                    const p = operation.packet;
                    if (p.action === 'request') {
                        const revisionId = p.revisionId;
                        reviewItem = loaded.items.find(v => v.request.revisionId === revisionId && v.request.creatorId === owner.actorId);
                        originalRevision = loaded.revisions.find(v => v.id === revisionId);
                    }
                    else {
                        const reviewRequestId = p.reviewRequestId;
                        reviewItem = loaded.items.find(v => v.request.id === reviewRequestId);
                    }
                }
                originalRevision = reviewItem?.request.revision ?? originalRevision;
                if (!originalRevision || operation.kind === 'apply' && !reviewItem)
                    throw Error('Der ursprüngliche gespeicherte Auftrag bleibt erhalten. Seine Originale konnten noch nicht vollständig geladen werden.');
                const restoredDraft: ReviewDraft = { action: operation.kind === 'apply' ? 'apply' : operation.packet.action, reason: operation.kind === 'apply' ? operation.packet.reason : operation.packet.action === 'request' ? operation.packet.reason : operation.packet.reviewReference, revision: structuredClone(originalRevision), item: reviewItem ? structuredClone(reviewItem) : null };
                draftRef.current = restoredDraft;
                setDraft(restoredDraft);
                pending.current = operation.kind === 'review' ? { kind: 'review', packet: operation.packet } : { kind: 'apply', packet: operation.packet, item: structuredClone(reviewItem!) };
                const restored = await recoverMedicationOrderReviewDurably({ ...scope(), actorId: owner.actorId }, current.current.role, () => active() && !current.current.isLeaving?.(), reviewItem);
                if (!active())
                    return;
                if (restored?.ok) {
                    journalRef.current = null;
                    pending.current = null;
                    saved.current = true;
                    valid.current = false;
                    setUncertain(false);
                    setConfirmed(true);
                    setSuccess('Der ursprüngliche gespeicherte Auftrag wurde anhand seines eigenen Serverbelegs wiederhergestellt.');
                    if (restored.kind === 'apply') {
                        try {
                            current.current.onApplied?.();
                        }
                        catch {
                            setError('Die Übernahme ist bestätigt. Die Aktenübersicht bitte erneut laden.');
                        }
                    }
                }
                else {
                    setUncertain(true);
                    setError(restored && !restored.ok ? restored.error : 'Der gespeicherte Auftrag bleibt zur unveränderten Prüfung erhalten.');
                }
            }
        }
        catch (cause) {
            if (active())
                setError(cause instanceof Error ? cause.message : 'Originalabgleich konnte nicht vollständig geladen werden.');
        }
        finally {
            loadFlight.current = false;
            if (alive.current && generation.current === ticket)
                setLoading(false);
        }
    }, []);
    useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; editing.current = false; current.current.onEditingChange?.(false); }; }, []);
    useEffect(() => { if (ownRead() && !context.blocked)
        void load(); }, [context.canView, context.canSources, context.canManage, context.blocked, context.role, context.profileRole, context.currentOrderVersion]);
    const snapshot = () => { const c = current.current; return structuredClone({ tenantId: c.tenantId, clientId: c.clientId, medicationId: c.medicationId, actorId: c.actorId, role: c.role, profileRole: c.profileRole, canView: c.canView, canSources: c.canSources, canManage: c.canManage, canReview: c.canReview ?? false, blocked: c.blocked, leaving: c.isLeaving?.() ?? false, currentOrderVersion: c.currentOrderVersion, draft: draftRef.current, generation: generation.current, epoch: epoch.current, saved: saved.current }); };
    const prompt = useUnsavedWebChanges(!!draft && !confirmed, busy || uncertain, undefined, () => { const before = snapshot(); return () => localOwner() && !flight.current && !pending.current && !journalRef.current && sameWoundJson(before, snapshot()); }), promptRef = useRef(prompt);
    promptRef.current = prompt;
    const guardedLeave = useCallback(async () => { if (!localOwner() || flight.current || pending.current || journalRef.current)
        return false; const before = snapshot(), ask = promptRef.current; if (!await ask())
        return false; return localOwner() && !flight.current && !pending.current && !journalRef.current && promptRef.current === ask && sameWoundJson(before, snapshot()); }, []);
    useEffect(() => { context.registerLeave?.(guardedLeave); return () => context.registerLeave?.(null); }, [context.registerLeave, guardedLeave]);
    function allowed(action: ReviewAction, targetId: string) {
        if (!canOperate())
            return false;
        const w = workspaceRef.current!;
        if (action === 'request') {
            const r = w.revisions.find(v => v.id === targetId);
            return !!r && r.recorded_by === owner.actorId && r.state === 'proposed' && sameWoundJson(r.before_snapshot, w.order);
        }
        const item = w.items.find(v => v.request.id === targetId);
        return !!item && medicationOrderReviewActionAllowed(item, action, owner.actorId, current.current.canReview === true, w.order, w.revisions.find(r => r.id === item.request.revisionId));
    }
    function start(action: ReviewAction, targetId: string) {
        if (editing.current || !allowed(action, targetId))
            return;
        const w = workspaceRef.current!, item = action === 'request' ? null : w.items.find(v => v.request.id === targetId)!;
        const revision = action === 'request' ? w.revisions.find(v => v.id === targetId)! : item!.request.revision;
        if (current.current.onEditingChange?.(true) === false)
            return;
        editing.current = true;
        epoch.current++;
        saved.current = false;
        const next: ReviewDraft = { action, reason: '', revision: structuredClone(revision), item: item ? structuredClone(item) : null };
        draftRef.current = next;
        setDraft(next);
        setConfirmed(false);
        setError(null);
        setSuccess(null);
    }
    function changeReason(value: string) { const d = draftRef.current; if (d && editing.current && canOperate()) {
        epoch.current++;
        const next = { ...d, reason: value };
        draftRef.current = next;
        setDraft(next);
    } }
    async function submit() {
        if (!editing.current || !ownRead() || current.current.isLeaving?.() || flight.current || saved.current)
            return;
        const replay = pending.current !== null;
        if (!pending.current) {
            const d = draftRef.current;
            if (!d || !canOperate() || !allowed(d.action, d.action === 'request' ? d.revision.id : d.item!.request.id))
                return;
            try {
                if (d.reason.trim().length < 10 || d.reason.length > 2000)
                    throw Error('Begründung mit mindestens zehn Zeichen eintragen.');
                const requestId = crypto.randomUUID();
                pending.current = d.action === 'apply' ? { kind: 'apply', item: structuredClone(d.item!), packet: { requestId, revisionId: d.revision.id, authorizationId: d.item!.authorization!.id, reason: d.reason } } : { kind: 'review', packet: makeMedicationOrderReviewPacket(d.action === 'request' ? { schemaVersion: 1, ...scope(), requestId, actorId: owner.actorId, action: 'request', revisionId: d.revision.id, reason: d.reason } : { schemaVersion: 1, ...scope(), requestId, actorId: owner.actorId, action: d.action, reviewRequestId: d.item!.request.id, reviewReference: d.reason }) };
            }
            catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Prüfauftrag vollständig prüfen.');
                return;
            }
        }
        const attempt = pending.current;
        if (!attempt)
            return;
        const writeCurrent = () => ownRead() && !current.current.isLeaving?.() && (attempt.kind === 'apply' || attempt.packet.action === 'request' || attempt.packet.action === 'revoke' && draftRef.current?.item?.request.creatorId === owner.actorId || current.current.canReview === true);
        if (!writeCurrent())
            return;
        flight.current = true;
        setBusy(true);
        setError(null);
        try {
            const operation = attempt.kind === 'review' ? { kind: 'review' as const, packet: attempt.packet } : { kind: 'apply' as const, packet: attempt.packet };
            const result = await saveMedicationOrderReviewDurably({ ...scope(), actorId: owner.actorId }, operation, current.current.role, writeCurrent, attempt.kind === 'apply' ? attempt.item : undefined);
            if (!alive.current)
                return;
            if (!result.ok) {
                setError(result.error);
                const rejected = result.rejected === true;
                setUncertain(!rejected && (replay || result.uncertain === true));
                if (rejected || !replay && result.uncertain !== true) {
                    pending.current = null;
                    if (rejected)
                        journalRef.current = null;
                }
                return;
            }
            if (!writeCurrent()) {
                setUncertain(true);
                setError('Die Bestätigung unter dem ursprünglichen eigenen Bezug erneut prüfen.');
                return;
            }
            journalRef.current = null;
            pending.current = null;
            saved.current = true;
            valid.current = false;
            setUncertain(false);
            setConfirmed(true);
            setSuccess(attempt.kind === 'apply' ? 'Die strukturierten Angaben wurden übernommen und unter Ihren Rechten vollständig zurückgelesen. Status und weitere Sicherheitsangaben wurden dabei nicht freigegeben.' : 'Der Originalabgleich wurde gespeichert und mit dem unveränderten eigenen Prüfbeleg bestätigt. Nach dem Schließen den aktuellen Bestand neu laden.');
            if (attempt.kind === 'apply') {
                try {
                    current.current.onApplied?.();
                }
                catch {
                    setError('Die Übertragung ist bestätigt. Die Aktenübersicht bitte erneut laden.');
                }
            }
        }
        catch {
            if (alive.current) {
                setUncertain(true);
                setError('Das Ergebnis ist ungeklärt. Dieselbe unveränderte Anfrage erneut prüfen.');
            }
        }
        finally {
            flight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    async function close() { if (!await guardedLeave() || !localOwner())
        return; editing.current = false; current.current.onEditingChange?.(false); epoch.current++; saved.current = false; journalRef.current = null; draftRef.current = null; setDraft(null); setConfirmed(false); setError(null); setSuccess(null); }
    return { workspace, draft, busy, loading, uncertain, confirmed, error, success, canRead: ownRead(), canOperate: canOperate(), load, start, allowed, changeReason, submit, close, confirmLeave: guardedLeave };
}
export function MedicationOrderReviewPanel(context: ReviewPanelContext) {
    const styles = useReviewStyles(), c = useMedicationOrderReviewController(context), [open, setOpen] = useState<string | null>(null);
    if (!c.canRead)
        return <SectionPanel title="Originalabgleich"><InfoBanner variant="warning" message="Der eigene Zugriff auf die vertraulichen Originale fehlt. Eine angefangene Prüfung und ihre unveränderte Anfrage bleiben in dieser Ansicht erhalten."/></SectionPanel>;
    const fields = Object.entries(medicationOrderRevisionFieldMap) as Array<[
        keyof typeof medicationOrderRevisionFieldMap,
        string
    ]>;
    return <SectionPanel title="Originalabgleich und Übertragung" subtitle="Getrennte Prüfung der erfassten Angaben vor der technischen Übernahme"><View style={styles.body}>
  <InfoBanner variant="info" message="Eine andere berechtigte Person gleicht den Vorschlag mit der archivierten Originalunterlage ab. Die Bestätigung berechtigt zeitlich begrenzt zur Übertragung der Angaben. Sie ersetzt keine ärztliche Verordnung, Qualifikationsprüfung oder Freigabe zur Medikamentengabe."/>
  {c.error ? <ErrorState message={c.error}/> : null}{c.success ? <SuccessState message={c.success}/> : null}{context.blocked ? <InfoBanner variant="warning" message="Die Medikationsakte wird aktualisiert oder anderweitig bearbeitet. Ein angefangener Originalabgleich bleibt erhalten."/> : null}
  {c.loading ? <LoadingState message="Originale, Prüfanträge und Entscheidungen werden vollständig geladen…"/> : null}
  {!c.draft ? <PremiumButton title="Prüfbestand aktualisieren" variant="secondary" disabled={c.loading || c.busy || context.blocked} onPress={c.load}/> : null}
  {c.draft ? <View style={styles.form}><Text style={styles.heading}>{actionLabels[c.draft.action]}</Text><Text style={styles.note}>Vorschlag vom {reviewTime(c.draft.revision.recorded_at)} · {c.draft.revision.recorded_by_name}</Text>
   <Text style={styles.note}>Originalunterlage: {reviewValue((c.draft.revision.source_snapshot.document_snapshot as Record<string, unknown> | undefined)?.title)}. Den archivierten Dateiinhalt im Quellenabschnitt öffnen und vor einer Prüfbestätigung vollständig abgleichen.</Text>
   {fields.map(([key, native]) => <View key={key} style={styles.comparison}><Text style={styles.label}>{reviewFields[key]}</Text><View style={styles.columns}><View style={styles.column}><Text style={styles.note}>Ausgangsstand</Text><Text style={styles.text}>{reviewValue(c.draft!.revision.before_snapshot[native])}</Text></View><View style={styles.column}><Text style={styles.note}>Vorgeschlagene Angabe</Text><Text style={styles.text}>{reviewValue(c.draft!.revision.proposed_order[key])}</Text></View></View></View>)}
   <PremiumInput label="Begründung und Originalabgleich (mindestens 10 Zeichen) *" accessibilityLabel="Begründung des Originalabgleichs" value={c.draft.reason} editable={c.canOperate && !c.confirmed} onChangeText={c.changeReason} maxLength={2000} multiline/>
   {c.uncertain ? <InfoBanner variant="warning" message="Das Speicherergebnis ist ungeklärt. Anfrage und Inhalt bleiben unverändert, bis dieselbe Anfrage bestätigt ist."/> : null}
   <View style={styles.actions}>{!c.confirmed ? <PremiumButton title={c.busy ? 'Bestätigung prüfen…' : c.uncertain ? 'Anfrage erneut prüfen' : actionLabels[c.draft.action]} disabled={c.busy || (!c.uncertain && (!c.canOperate || c.draft.reason.trim().length < 10))} onPress={c.submit}/> : null}<PremiumButton title="Prüfung schließen" variant="secondary" disabled={c.busy || c.uncertain} onPress={c.close}/></View>
  </View> : null}
  {!c.draft ? c.workspace?.revisions.filter(r => r.recorded_by === context.actorId && r.state === 'proposed' && sameWoundJson(r.before_snapshot, c.workspace!.order)).map(r => <View key={r.id} style={styles.record}><Text style={styles.label}>Eigener Übertragungsvorschlag vom {reviewTime(r.recorded_at)}</Text><Text style={styles.text}>{r.reason}</Text><PremiumButton title="Prüfung anfordern" variant="secondary" disabled={!c.allowed('request', r.id)} onPress={() => c.start('request', r.id)}/></View>) : null}
  {c.workspace && !c.workspace.items.length ? <Text style={styles.note}>Für diese Verordnung liegen keine Prüfanträge im vollständig geladenen Verlauf vor.</Text> : null}
  {c.workspace?.items.map(item => {
            const state = medicationOrderReviewState(item), expanded = open === item.request.id;
            return <View key={item.request.id} style={styles.record}><View style={styles.actions}><Text style={styles.label}>Prüfantrag vom {reviewTime(item.request.createdAt)}</Text><PremiumBadge label={reviewStateLabels[state]} variant={state === 'authorized' ? 'green' : 'orange'}/></View><Text style={styles.text}>{item.request.reason}</Text><Text style={styles.note}>Erfassende Person: {item.request.revision.recorded_by_name} · Antrag gültig bis {reviewTime(item.request.expiresAt)}</Text>
   {item.decision ? <Text style={styles.note}>Prüfentscheid vom {reviewTime(item.decision.recordedAt)} · {item.decision.reviewReference}</Text> : null}{item.authorization ? <Text style={styles.note}>Technische Übertragung berechtigt bis {reviewTime(item.authorization.expiresAt)}.</Text> : null}{item.revocation ? <Text style={styles.note}>Widerrufen am {reviewTime(item.revocation.recordedAt)} · {item.revocation.reviewReference}</Text> : null}
   <PremiumButton title={expanded ? 'Originaldetails schließen' : 'Originaldetails anzeigen'} variant="secondary" onPress={() => setOpen(expanded ? null : item.request.id)}/>
   {expanded ? <View style={styles.body}>{fields.map(([key, native]) => <View key={key} style={styles.comparison}><Text style={styles.label}>{reviewFields[key]}</Text><Text style={styles.text}>Ausgangsstand: {reviewValue(item.request.revision.before_snapshot[native])}</Text><Text style={styles.text}>Vorschlag: {reviewValue(item.request.revision.proposed_order[key])}</Text></View>)}</View> : null}
   {!c.draft ? <View style={styles.actions}>{(['authorize', 'reject', 'revoke', 'apply'] as const).filter(action => c.allowed(action, item.request.id)).map(action => <PremiumButton key={action} title={actionLabels[action]} variant={action === 'apply' ? 'primary' : 'secondary'} onPress={() => c.start(action, item.request.id)}/>)}</View> : null}
  </View>;
        })}
 </View></SectionPanel>;
}
function useReviewStyles() { const { c } = useCareLightPalette(); return useMemo(() => StyleSheet.create({ body: { gap: spacing.md, minWidth: 0 }, form: { gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: c.border, borderRadius: 16, minWidth: 0 }, record: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.border, minWidth: 0 }, heading: { ...typography.bodyStrong, color: c.text }, label: { ...typography.label, color: c.text }, text: { ...typography.body, color: c.text }, note: { ...typography.caption, color: c.muted }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 }, comparison: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.border, minWidth: 0 }, columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, minWidth: 0 }, column: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0, gap: spacing.xs } }), [c]); }
