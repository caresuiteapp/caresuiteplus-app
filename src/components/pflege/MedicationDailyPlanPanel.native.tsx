// Generated native presentation from src/components/pflege/MedicationDailyPlanPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumBadge, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { MedicationEventTimeInput, medicationEventInstant, type MedicationEventTime } from "./MedicationEventTimeInput.native.tsx";
import { MedicationSourceFileButton } from "./MedicationSourceFileButton.native.tsx";
import type { MedicationDocumentation } from "../../lib/pflege/medicationAdministrationService.native.ts";
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { makeMedicationDailyPlanPacket, makeMedicationExecutionAssessmentPacket, type MedicationDailyPlanEntry, type MedicationDailyPlanPacket, type MedicationDailyPlan, type MedicationDailyPlanReviewItem, type MedicationDailyPlanAuthorizationPacket, type MedicationDailyPlanWithdrawalPacket } from "../../lib/pflege/medicationDailyPlanDomain.native.ts";
import { assessMedicationExecution, proposeMedicationDailyPlan, readMedicationDailyPlanWorkspace, readMedicationDailyPlanReviews, readMedicationDailyPlanReviewContext, requestMedicationDailyPlanReview, requestMedicationDailyPlanWithdrawal, authorizeMedicationDailyPlan, type MedicationDailyPlanWorkspace } from "../../lib/pflege/medicationDailyPlanService.native.ts";
import { sameWoundJson, woundUuid } from '@/lib/pflege/woundCareDomain';
import { medicationTimeDisplay } from "../../lib/pflege/medicationTimeDisplay.native.ts";
import type { RoleKey } from '@/types';
import { spacing, typography } from '@/theme';
type Row = Record<string, unknown>;
type Mode = 'plan' | 'assessment' | 'request_review' | 'withdraw' | 'review' | null;
type Workspace = MedicationDailyPlanWorkspace & {
    reviews: MedicationDailyPlanReviewItem[];
};
type ReviewDraft = {
    plan: MedicationDailyPlan;
    item: MedicationDailyPlanReviewItem | null;
    reference: string;
    effectiveFrom: string;
    accepted: boolean;
};
type ReviewPending = {
    kind: 'request';
    plan: MedicationDailyPlan;
    requestId: string;
} | {
    kind: 'withdraw';
    plan: MedicationDailyPlan;
    packet: MedicationDailyPlanWithdrawalPacket;
} | {
    kind: 'authorize';
    item: MedicationDailyPlanReviewItem;
    packet: MedicationDailyPlanAuthorizationPacket;
};
type PlanDraft = {
    effectiveFrom: string;
    effectiveUntil: string;
    reason: string;
    entries: MedicationDailyPlanEntry[];
    sourceAccepted: boolean;
};
type AssessmentDraft = {
    time: MedicationEventTime;
    dose: string;
    unit: string;
    route: string;
    indication: string;
    planId: string;
    entryId: string;
    sourceAccepted: boolean;
};
type AssessmentResult = Extract<Awaited<ReturnType<typeof assessMedicationExecution>>, {
    ok: true;
}>['data'];
type PlanPanelContext = {
    tenantId: string;
    clientId: string;
    medicationId: string;
    actorId: string;
    role: RoleKey | null;
    profileRole: RoleKey | null;
    canView: boolean;
    canSources: boolean;
    canManage: boolean;
    canAdminister: boolean;
    canReview?: boolean;
    sourceOrder?: MedicationDocumentation;
    blocked: boolean;
    currentOrderVersion: string;
    isLeaving?(): boolean;
    registerLeave?(fn: (() => Promise<boolean>) | null): void;
    onEditingChange?(editing: boolean): boolean | void;
};
const display = (v: unknown) => v === null || v === undefined || v === '' ? 'Nicht hinterlegt' : typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v);
const time = (v: unknown) => typeof v === 'string' ? medicationTimeDisplay(v).display : 'Zeitpunkt nicht hinterlegt';
const emptyPlan = (): PlanDraft => ({ effectiveFrom: '', effectiveUntil: '', reason: '', entries: [], sourceAccepted: false });
const emptyAssessment = (): AssessmentDraft => ({ time: { date: '', time: '', selected: '' }, dose: '', unit: '', route: '', indication: '', planId: '', entryId: '', sourceAccepted: false });
const nativeReviewFields = [['name', 'Präparat'], ['active_ingredient', 'Wirkstoff'], ['strength', 'Stärke'], ['form', 'Darreichungsform'], ['prescribed_dose', 'Dosis'], ['dose_unit', 'Einheit'], ['route', 'Applikation'], ['prescribed_by', 'Verordnende Person'], ['start_date', 'Gültig ab'], ['end_date', 'Gültig bis'], ['indication', 'Indikation'], ['is_prn', 'Bedarfsmedikation'], ['minimum_interval_minutes', 'Mindestabstand in Minuten'], ['maximum_dose', 'Höchstmenge'], ['maximum_dose_unit', 'Höchstmenge: Einheit'], ['maximum_period_hours', 'Bezugszeitraum in Stunden']] as const;
function frozenOriginal<T>(value: T): T { if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(frozenOriginal);
} return value; }
const scope = (c: PlanPanelContext) => ({ tenantId: c.tenantId, clientId: c.clientId, medicationId: c.medicationId });
function useMedicationDailyPlanController(context: PlanPanelContext) {
    const [owner] = useState(() => ({ ...scope(context), actorId: context.actorId, role: context.profileRole }));
    const alive = useRef(true), current = useRef(context);
    current.current = context;
    const [workspace, setWorkspace] = useState<Workspace | null>(null), [mode, setMode] = useState<Mode>(null), [plan, setPlan] = useState(emptyPlan), [assessment, setAssessment] = useState(emptyAssessment), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null), [uncertain, setUncertain] = useState(false), [confirmed, setConfirmed] = useState(false), [result, setResult] = useState<AssessmentResult | null>(null), [review, setReview] = useState<ReviewDraft | null>(null);
    const editing = useRef<Mode>(null), session = useRef(0), epoch = useRef(0), generation = useRef(0), loadFlight = useRef(false), flight = useRef(false), saved = useRef(false), pending = useRef<MedicationDailyPlanPacket | null>(null), baseline = useRef<Workspace | null>(null), reviewPending = useRef<ReviewPending | null>(null), latest = useRef({ workspace, plan, assessment, review });
    latest.current = { workspace, plan, assessment, review };
    const renderedSession = session.current;
    const localOwner = () => { const c = current.current; return alive.current && [owner.tenantId, owner.clientId, owner.medicationId, owner.actorId].every(woundUuid) && !!owner.role && c.tenantId === owner.tenantId && c.clientId === owner.clientId && c.medicationId === owner.medicationId && c.actorId === owner.actorId && c.role === owner.role && c.profileRole === owner.role; };
    const ownRead = useCallback(() => localOwner() && current.current.canView && current.current.canSources && current.current.canManage, []);
    const live = () => ownRead() && !current.current.blocked;
    const changed = () => !!baseline.current && baseline.current.order.updated_at !== current.current.currentOrderVersion;
    const workspaceCurrent = () => live() && !!latest.current.workspace && latest.current.workspace.order.updated_at === current.current.currentOrderVersion;
    const eligible = () => { const w = latest.current.workspace; return workspaceCurrent() && w!.order.status === 'active' && !!w!.orderApplication && !!w!.source; };
    const editable = () => !current.current.isLeaving?.() && editing.current !== null && (editing.current !== 'assessment' || current.current.canAdminister) && (editing.current !== 'review' || current.current.canReview === true) && (['withdraw', 'review'].includes(editing.current) ? workspaceCurrent() : eligible()) && !changed() && !flight.current && !loadFlight.current && !pending.current && !reviewPending.current && !saved.current;
    const load = useCallback(async () => {
        if (!live() || editing.current || loadFlight.current || flight.current || pending.current || reviewPending.current)
            return;
        const request = ++generation.current;
        loadFlight.current = true;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const active = () => live() && generation.current === request;
            const [response, reviews] = await Promise.all([readMedicationDailyPlanWorkspace(scope(current.current), current.current.role, active), readMedicationDailyPlanReviews(scope(current.current), current.current.role, active)]);
            if (!active())
                return;
            if (!response.ok || !reviews.ok) {
                setWorkspace(null);
                setError(!response.ok ? response.error : !reviews.ok ? reviews.error : 'Planprüfung unvollständig.');
                return;
            }
            if (response.data.ledgerFingerprint !== reviews.data.ledgerFingerprint || reviews.data.items.some(item => !sameWoundJson(item.currentOrder, response.data.order)))
                throw Error('Der native Stand wurde während des Ladens geändert.');
            setWorkspace({ ...response.data, reviews: reviews.data.items });
        }
        catch {
            if (ownRead() && generation.current === request) {
                setWorkspace(null);
                setError('Tagesplangrundlage und vollständiger Verlauf konnten nicht geladen werden.');
            }
        }
        finally {
            loadFlight.current = false;
            if (alive.current && generation.current === request)
                setLoading(false);
        }
    }, []);
    useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; editing.current = null; current.current.onEditingChange?.(false); }; }, []);
    useEffect(() => { if (live())
        void load(); }, [context.canView, context.canSources, context.canManage, context.blocked, context.role, context.profileRole, context.currentOrderVersion]);
    const confirmPrompt = useUnsavedWebChanges(mode !== null && !confirmed || uncertain, busy || uncertain, undefined, () => { if (!localOwner() || flight.current || pending.current || reviewPending.current)
        return null; const captured = snapshot(); return () => localOwner() && !flight.current && !pending.current && !reviewPending.current && sameWoundJson(captured, snapshot()); }), prompt = useRef(confirmPrompt);
    prompt.current = confirmPrompt;
    const snapshot = () => structuredClone({ ...current.current, registerLeave: undefined, onEditingChange: undefined, isLeaving: undefined, mode: editing.current, session: session.current, review: latest.current.review, epoch: epoch.current, generation: generation.current, plan: latest.current.plan, assessment: latest.current.assessment, baseline: baseline.current, saved: saved.current });
    const guardedLeave = useCallback(async () => { if (!localOwner() || flight.current || pending.current || reviewPending.current)
        return false; const before = snapshot(), leave = prompt.current; if (!await leave())
        return false; return localOwner() && !flight.current && !pending.current && !reviewPending.current && leave === prompt.current && sameWoundJson(before, snapshot()); }, []);
    useEffect(() => { context.registerLeave?.(guardedLeave); return () => context.registerLeave?.(null); }, [context.registerLeave, guardedLeave]);
    function start(next: 'plan' | 'assessment') {
        if (current.current.isLeaving?.() || editing.current || flight.current || pending.current || reviewPending.current || loadFlight.current || !eligible())
            return;
        const w = latest.current.workspace!;
        if (next === 'plan' && w.order.is_prn !== false || next === 'assessment' && (!current.current.canAdminister || ![true, false].includes(w.order.is_prn as boolean)))
            return;
        if (current.current.onEditingChange?.(true) === false)
            return;
        editing.current = next;
        session.current++;
        epoch.current++;
        latest.current = { ...latest.current, plan: emptyPlan(), assessment: emptyAssessment(), review: null };
        baseline.current = structuredClone(w);
        saved.current = false;
        setMode(next);
        setPlan(emptyPlan());
        setAssessment(emptyAssessment());
        setConfirmed(false);
        setError(null);
        setSuccess(null);
        setResult(null);
        setReview(null);
    }
    function changePlan(value: Partial<PlanDraft>) { if (renderedSession !== session.current || editing.current !== 'plan' || !editable())
        return; epoch.current++; const next = { ...latest.current.plan, ...value }; latest.current = { ...latest.current, plan: next }; setPlan(next); setError(null); }
    function changeAssessment(value: Partial<AssessmentDraft>) { if (renderedSession !== session.current || editing.current !== 'assessment' || !editable())
        return; epoch.current++; const next = { ...latest.current.assessment, ...value }; latest.current = { ...latest.current, assessment: next }; setAssessment(next); setResult(null); setError(null); }
    function addEntry() { if (editing.current !== 'plan' || !editable() || latest.current.plan.entries.length >= 24)
        return; changePlan({ entries: [...latest.current.plan.entries, { id: crypto.randomUUID(), time: '', dose: '', unit: '', route: '' }] }); }
    function changeEntry(id: string, key: 'time' | 'dose' | 'unit' | 'route', value: string) { if (!latest.current.plan.entries.some(e => e.id === id))
        return; changePlan({ entries: latest.current.plan.entries.map(e => e.id === id ? { ...e, [key]: value } : e) }); }
    function removeEntry(id: string) { changePlan({ entries: latest.current.plan.entries.filter(e => e.id !== id) }); }
    async function submit() {
        if (renderedSession !== session.current || current.current.isLeaving?.() || editing.current !== 'plan' || flight.current || saved.current || !ownRead())
            return;
        const replay = pending.current !== null;
        if (!pending.current) {
            if (!editable() || !baseline.current)
                return;
            const d = latest.current.plan, b = baseline.current;
            try {
                if (!d.sourceAccepted)
                    throw Error('Archivierte Originalquelle und technische Übernahme ausdrücklich auswählen.');
                pending.current = makeMedicationDailyPlanPacket({ requestId: crypto.randomUUID(), ...scope(current.current), actorId: owner.actorId, expectedUpdatedAt: String(b.order.updated_at), orderApplicationId: String(b.orderApplication?.id ?? ''), sourceId: String(b.source?.source.id ?? ''), reason: d.reason, effectiveFrom: d.effectiveFrom, effectiveUntil: d.effectiveUntil || null, timezone: 'Europe/Berlin', entries: d.entries }, b.order);
            }
            catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Tagesplan vollständig erfassen.');
                return;
            }
        }
        const packet = pending.current!;
        flight.current = true;
        setBusy(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await proposeMedicationDailyPlan(packet, current.current.role, ownRead);
            if (!alive.current)
                return;
            if (!response.ok) {
                setError(response.error);
                setUncertain(replay || response.uncertain === true);
                if (!replay && response.uncertain !== true)
                    pending.current = null;
                return;
            }
            if (!ownRead()) {
                setUncertain(true);
                setError('Eigene Tagesplanbestätigung unter dem ursprünglichen Bezug erneut prüfen.');
                return;
            }
            pending.current = null;
            saved.current = true;
            setUncertain(false);
            setConfirmed(true);
            setWorkspace(previous => previous ? { ...previous, items: [response.data, ...previous.items.filter(item => item.id !== response.data.id)] } : previous);
            setSuccess('Tagesplanentwurf gespeichert und vollständig bestätigt. Die getrennte Planprüfung bleibt erforderlich; eine Gabe wurde nicht gespeichert.');
        }
        catch {
            if (alive.current) {
                setUncertain(true);
                setError('Die Bestätigung fehlt. Dieselbe unveränderte Tagesplananfrage erneut prüfen.');
            }
        }
        finally {
            flight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    async function assess() {
        if (renderedSession !== session.current || editing.current !== 'assessment' || !editable() || !baseline.current)
            return;
        const b = baseline.current, d = latest.current.assessment;
        try {
            if (!d.sourceAccepted)
                throw Error('Archivierte Originalquelle und technischen Verordnungsstand ausdrücklich auswählen.');
            if (b.order.is_prn === false && !b.items.some(item => item.id === d.planId && item.state === 'authorized' && item.order_application_id === b.orderApplication?.id && item.expected_updated_at === b.order.updated_at && item.entries.some(entry => entry.id === d.entryId)))
                throw Error('Eine unabhängig autorisierte passende Planposition ausdrücklich auswählen.');
            const packet = makeMedicationExecutionAssessmentPacket({ requestId: crypto.randomUUID(), ...scope(current.current), actorId: owner.actorId, expectedUpdatedAt: String(b.order.updated_at), orderApplicationId: String(b.orderApplication?.id ?? ''), kind: b.order.is_prn === true ? 'prn' : 'regular', planId: b.order.is_prn === true ? null : d.planId, entryId: b.order.is_prn === true ? null : d.entryId, occurredAt: medicationEventInstant(d.time), actualDose: d.dose, unit: d.unit, route: d.route, prnIndication: b.order.is_prn === true ? d.indication : '' }, b.order);
            const captured = epoch.current;
            flight.current = true;
            setBusy(true);
            setError(null);
            setResult(null);
            const response = await assessMedicationExecution(packet, current.current.role, () => live() && current.current.canAdminister && !changed() && epoch.current === captured);
            if (!live() || !current.current.canAdminister || changed() || epoch.current !== captured)
                return;
            if (!response.ok) {
                setError(response.error);
                return;
            }
            setResult(response.data);
        }
        catch (cause) {
            if (ownRead())
                setError(cause instanceof Error ? cause.message : 'Die getrennte Grenzenprüfung konnte nicht bestätigt werden.');
        }
        finally {
            flight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    function reviewAllowed(action: 'request_review' | 'withdraw' | 'review', id: string) {
        if (current.current.isLeaving?.() || !workspaceCurrent() || editing.current || flight.current || pending.current || reviewPending.current || loadFlight.current)
            return false;
        const w = latest.current.workspace!;
        if (action === 'review') {
            const item = w.reviews.find(value => value.request.id === id);
            return !!item && item.state === 'pending' && item.canReview && current.current.canReview === true && item.request.actor_id !== owner.actorId && sameWoundJson(item.currentOrder, w.order);
        }
        const row = w.items.find(value => value.id === id);
        if (!row)
            return false;
        return action === 'request_review' ? eligible() && row.recorded_by === owner.actorId && sameWoundJson(row.native_snapshot, w.order) && row.order_application_id === w.orderApplication?.id && row.state === 'proposed' && !w.reviews.some(item => item.plan.id === id && item.request.action === 'authorize' && item.state === 'pending') : row.state === 'authorized' && row.withdrawal === null && !w.reviews.some(item => item.plan.id === id && item.request.action === 'withdraw' && item.state === 'pending');
    }
    async function startReview(action: 'request_review' | 'withdraw' | 'review', id: string) {
        if (!reviewAllowed(action, id))
            return;
        const w = latest.current.workspace!;
        if (current.current.onEditingChange?.(true) === false)
            return;
        editing.current = action;
        session.current++;
        epoch.current++;
        latest.current = { ...latest.current, review: null };
        baseline.current = structuredClone(w);
        saved.current = false;
        setMode(action);
        setConfirmed(false);
        setError(null);
        setSuccess(null);
        setResult(null);
        setReview(null);
        if (action !== 'review') {
            const draft = { plan: structuredClone(w.items.find(item => item.id === id)!), item: null, reference: '', effectiveFrom: '', accepted: false };
            latest.current = { ...latest.current, review: draft };
            setReview(draft);
            return;
        }
        const captured = epoch.current;
        flight.current = true;
        setBusy(true);
        try {
            const active = () => live() && current.current.canReview === true && !changed() && editing.current === 'review' && epoch.current === captured;
            const response = await readMedicationDailyPlanReviewContext(scope(current.current), id, current.current.role, active);
            if (!active())
                return;
            if (!response.ok) {
                setError(response.error);
                return;
            }
            const item = response.data;
            if (!item.canReview || item.state !== 'pending' || item.request.actor_id === owner.actorId || !sameWoundJson(item.currentOrder, w.order))
                throw Error('Die unabhängige aktuelle Planprüfberechtigung fehlt.');
            const draft = { plan: structuredClone(item.plan), item: structuredClone(item), reference: '', effectiveFrom: '', accepted: false };
            latest.current = { ...latest.current, review: draft };
            setReview(draft);
        }
        catch (cause) {
            if (ownRead())
                setError(cause instanceof Error ? cause.message : 'Der aktuelle Prüfstand konnte nicht geladen werden.');
        }
        finally {
            flight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    function changeReview(value: Partial<Pick<ReviewDraft, 'reference' | 'effectiveFrom' | 'accepted'>>) { if (renderedSession !== session.current || !['request_review', 'withdraw', 'review'].includes(editing.current ?? '') || !editable() || !latest.current.review)
        return; epoch.current++; const next = { ...latest.current.review, ...value }; latest.current = { ...latest.current, review: next }; setReview(next); }
    async function submitReview() {
        if (renderedSession !== session.current || current.current.isLeaving?.() || !['request_review', 'withdraw', 'review'].includes(editing.current ?? '') || flight.current || saved.current || !ownRead())
            return;
        const replay = reviewPending.current !== null;
        if (!reviewPending.current) {
            const d = latest.current.review;
            if (!d || !editable() || !baseline.current)
                return;
            try {
                if (!d.accepted)
                    throw Error('Den vollständigen Plan und seinen archivierten Originalstand ausdrücklich übernehmen.');
                const requestId = crypto.randomUUID();
                if (editing.current === 'request_review') {
                    if (d.plan.recorded_by !== owner.actorId || d.plan.state !== 'proposed')
                        throw Error('Der eigene unveränderte Entwurf fehlt.');
                    reviewPending.current = { kind: 'request', plan: frozenOriginal(structuredClone(d.plan)), requestId };
                }
                else if (editing.current === 'withdraw') {
                    if (d.plan.state !== 'authorized' || d.plan.withdrawal !== null || !/^\d{4}-\d{2}-\d{2}$/.test(d.effectiveFrom) || d.reference.trim().length < 10)
                        throw Error('Zukünftigen Beendigungstag und Begründung ab zehn Zeichen ausdrücklich eintragen.');
                    reviewPending.current = { kind: 'withdraw', plan: frozenOriginal(structuredClone(d.plan)), packet: frozenOriginal({ planId: d.plan.id, requestId, effectiveFrom: d.effectiveFrom, reason: d.reference }) };
                }
                else {
                    if (current.current.canReview !== true || !d.item || !d.item.canReview || d.item.state !== 'pending' || d.item.request.actor_id === owner.actorId || d.reference.trim().length < 10)
                        throw Error('Unabhängige Prüfberechtigung und dokumentierten Originalabgleich bestätigen.');
                    reviewPending.current = { kind: 'authorize', item: frozenOriginal(structuredClone(d.item)), packet: frozenOriginal({ planId: d.plan.id, reviewRequestId: String(d.item.request.id), requestId, reviewReference: d.reference, expectedReviewFingerprint: d.item.reviewFingerprint }) };
                }
            }
            catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Planprüfauftrag vervollständigen.');
                return;
            }
        }
        const attempt = reviewPending.current!;
        const originalRead = () => ownRead() && (attempt.kind !== 'authorize' || current.current.canReview === true);
        if (!originalRead())
            return;
        flight.current = true;
        setBusy(true);
        setError(null);
        setSuccess(null);
        try {
            const response = attempt.kind === 'request' ? await requestMedicationDailyPlanReview(attempt.plan, owner.actorId, attempt.requestId, current.current.role, originalRead) : attempt.kind === 'withdraw' ? await requestMedicationDailyPlanWithdrawal(attempt.plan, attempt.packet, owner.actorId, current.current.role, originalRead) : await authorizeMedicationDailyPlan(attempt.item, attempt.packet, owner.actorId, current.current.role, originalRead);
            if (!alive.current)
                return;
            if (!response.ok) {
                setError(response.error);
                setUncertain(replay || response.uncertain === true);
                if (!replay && response.uncertain !== true)
                    reviewPending.current = null;
                return;
            }
            if (!originalRead()) {
                setUncertain(true);
                setError('Eigene Planprüfbestätigung unter dem ursprünglichen Bezug erneut prüfen.');
                return;
            }
            reviewPending.current = null;
            saved.current = true;
            setUncertain(false);
            setConfirmed(true);
            setSuccess(attempt.kind === 'authorize' ? 'Der unabhängige technische Planentscheid wurde bestätigt. Frühere Planstände bleiben erhalten. Die Gabespeicherung bleibt gesperrt.' : 'Die eigene Prüfanfrage wurde gespeichert und unverändert bestätigt. Die unabhängige Entscheidung bleibt offen.');
        }
        catch {
            if (alive.current) {
                setUncertain(true);
                setError('Die Bestätigung ist ungeklärt. Dieselbe unveränderte Planprüfanfrage erneut prüfen.');
            }
        }
        finally {
            flight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    async function close() { if (renderedSession !== session.current || !await guardedLeave() || !localOwner() || renderedSession !== session.current)
        return; editing.current = null; session.current++; latest.current = { ...latest.current, plan: emptyPlan(), assessment: emptyAssessment(), review: null }; current.current.onEditingChange?.(false); epoch.current++; baseline.current = null; saved.current = false; setMode(null); setPlan(emptyPlan()); setAssessment(emptyAssessment()); setReview(null); setConfirmed(false); setError(null); setSuccess(null); setResult(null); }
    return { workspace, mode, plan, assessment, review, result: live() && current.current.canAdminister && !changed() ? result : null, loading, busy, error, success, uncertain, confirmed, baseline: baseline.current, changed: changed(), canRead: ownRead(), canStart: eligible() && !loadFlight.current && !flight.current && !editing.current, locked: !editable(), canReplay: ownRead() && (reviewPending.current?.kind !== 'authorize' || current.current.canReview === true), load, start, changePlan, changeAssessment, addEntry, changeEntry, removeEntry, submit, assess, reviewAllowed, startReview, changeReview, submitReview, close, confirmLeave: guardedLeave };
}
export function MedicationDailyPlanPanel(context: PlanPanelContext) {
    const styles = usePlanStyles(), c = useMedicationDailyPlanController(context), [visiblePlans, setVisiblePlans] = useState(20), [visibleReviews, setVisibleReviews] = useState(20);
    if (!c.canRead)
        return <SectionPanel title="Tagespläne und Grenzenprüfung"><InfoBanner variant="warning" message="Der eigene Zugriff auf Verordnung, Verwaltung und vertrauliche Originalquelle fehlt. Ein angefangener Entwurf mit unveränderter Anfrage bleibt erhalten."/></SectionPanel>;
    const w = c.workspace, b = c.baseline, source = b?.source ?? w?.source, document = source?.source.document_snapshot as Row | undefined;
    const expected = b?.order ?? w?.order;
    const authorized = (b?.items ?? w?.items ?? []).filter(item => item.state === 'authorized' && item.order_application_id === (b?.orderApplication ?? w?.orderApplication)?.id && item.expected_updated_at === expected?.updated_at);
    const selectedPlan = authorized.find(item => item.id === c.assessment.planId);
    return <SectionPanel title="Tagespläne und Grenzenprüfung" subtitle="Explizite Regelpläne aus einer archivierten Quelle · Prüfung ohne Gabespeicherung">
  <View style={styles.body}>
   <InfoBanner variant="info" message="Ein Tagesplanentwurf benötigt eine autorisierte strukturierte Verordnung mit archivierter Originalquelle. Seine eigene unabhängige Planprüfung bleibt getrennt. Die rechnerische Prüfung dokumentiert keine Gabe und schaltet deren Durchführung nicht frei."/>
   {c.error ? <ErrorState message={c.error}/> : null}{c.success ? <SuccessState message={c.success}/> : null}
   {context.blocked ? <InfoBanner variant="warning" message="Die Akte wird neu geladen oder in einem anderen Formular bearbeitet. Angefangene Angaben bleiben erhalten."/> : null}
   {c.loading ? <LoadingState message="Vollständige Verordnungsgrundlage und Tagesplanoriginale werden geladen…"/> : null}
   <View style={styles.actions}><PremiumButton title="Bestand aktualisieren" variant="secondary" disabled={!!c.mode || c.loading || c.busy || c.uncertain || context.blocked} onPress={c.load}/>{!c.mode ? <><PremiumButton title="Tagesplan entwerfen" disabled={!c.canStart || w?.order.is_prn !== false} onPress={() => c.start('plan')}/><PremiumButton title="Grenzen prüfen" variant="secondary" disabled={!c.canStart || !context.canAdminister} onPress={() => c.start('assessment')}/></> : null}</View>
   {w && !w.orderApplication ? <InfoBanner variant="warning" message="Für den aktuellen vollständigen Verordnungsstand fehlt eine autorisierte technische Übernahme mit archivierter Originalquelle. Erst einen strukturierten Übertragungsvorschlag erstellen und getrennt prüfen lassen."/> : null}
   {c.mode ? <View style={styles.editor}>
    <Text style={styles.heading}>{c.mode === 'plan' ? 'Täglichen Regelplan ausdrücklich erfassen' : c.mode === 'assessment' ? 'Getrennte Grenzenprüfung' : c.mode === 'request_review' ? 'Unabhängige Planprüfung anfordern' : c.mode === 'withdraw' ? 'Zukünftige Planbeendigung anfragen' : 'Unabhängigen Originalabgleich dokumentieren'}</Text>
    <Text style={styles.note}>Ausgangsstand: {time(b?.order.updated_at)} · Deutschland / Europe/Berlin</Text>
    {c.changed ? <InfoBanner variant="warning" message="Der native Verordnungsstand wurde geändert. Neue Anfragen sind gesperrt. Ein ungeklärter Tagesplan bleibt mit seiner unveränderten ursprünglichen Anfrage prüfbar."/> : null}
    {c.uncertain ? <InfoBanner variant="warning" title="Speicherbestätigung fehlt" message="Anfrage und Inhalt bleiben unverändert. Erneutes Prüfen bestätigt denselben Entwurf."/> : null}
    {['plan', 'assessment'].includes(c.mode) ? <><Text style={styles.label}>Archivierte Originalgrundlage *</Text><Text style={styles.note}>{display(document?.title)} · {display(document?.file_name)} · Dokumentstand {time(document?.updated_at)}</Text>
    <FilterChipGroup wrap options={[{ key: 'accepted', label: 'Originalgrundlage geprüft' }]} value={(c.mode === 'plan' ? c.plan.sourceAccepted : c.assessment.sourceAccepted) ? 'accepted' : ''} onChange={c.locked ? undefined : () => c.mode === 'plan' ? c.changePlan({ sourceAccepted: true }) : c.changeAssessment({ sourceAccepted: true })}/>
    <Text style={styles.note}>Strukturierte Verordnung: {display(expected?.prescribed_dose)} {display(expected?.dose_unit)} · {display(expected?.route)}. Jede Eingabe erfolgt ausdrücklich; fehlende Werte und Zeitpunkte werden nicht ergänzt.</Text></> : null}
    {c.mode === 'plan' ? <>
     <View style={styles.fields}><View style={styles.field}><PremiumInput label="Täglich gültig ab *" accessibilityLabel="Tagesplan gültig ab" placeholder="JJJJ-MM-TT" value={c.plan.effectiveFrom} editable={!c.locked} onChangeText={effectiveFrom => c.changePlan({ effectiveFrom })}/></View><View style={styles.field}><PremiumInput label="Gültig bis (optional)" accessibilityLabel="Tagesplan gültig bis" placeholder="JJJJ-MM-TT" value={c.plan.effectiveUntil} editable={!c.locked} onChangeText={effectiveUntil => c.changePlan({ effectiveUntil })}/></View></View>
     {c.plan.entries.map((entry, index) => <View key={entry.id} style={styles.entry}><Text style={styles.label}>Tägliche Position {index + 1}</Text><View style={styles.fields}>{([{ key: 'time', label: 'Uhrzeit *', placeholder: 'HH:MM' }, { key: 'dose', label: 'Dosis *', placeholder: 'Dezimalwert mit Punkt' }, { key: 'unit', label: 'Einheit *' }, { key: 'route', label: 'Applikation *' }] as const).map(field => <View key={field.key} style={styles.field}><PremiumInput label={field.label} accessibilityLabel={`Position ${index + 1}: ${field.label}`} value={entry[field.key]} placeholder={'placeholder' in field ? field.placeholder : undefined} editable={!c.locked} onChangeText={value => c.changeEntry(entry.id, field.key, value)}/></View>)}</View><PremiumButton title="Position entfernen" variant="secondary" disabled={c.locked} onPress={() => c.removeEntry(entry.id)}/></View>)}
     <Text style={styles.note}>1 bis 24 Positionen in aufsteigender, eindeutiger Uhrzeit. Dosis, Einheit und Applikation müssen genau der strukturierten Verordnung entsprechen.</Text><PremiumButton title="Position hinzufügen" variant="secondary" disabled={c.locked || c.plan.entries.length >= 24} onPress={c.addEntry}/>
     <PremiumInput label="Begründung (mindestens 10 Zeichen) *" accessibilityLabel="Begründung des Tagesplanentwurfs" value={c.plan.reason} editable={!c.locked} onChangeText={reason => c.changePlan({ reason })} maxLength={2000} multiline/>
     {!c.confirmed ? <PremiumButton title={c.busy ? 'Wird geprüft…' : c.uncertain ? 'Anfrage erneut prüfen' : 'Entwurf speichern'} disabled={c.busy || (c.uncertain ? !c.canReplay : c.locked)} onPress={c.submit}/> : null}
    </> : c.mode === 'assessment' ? <>
     {expected?.is_prn === false ? <><Text style={styles.label}>Unabhängig autorisierter Tagesplan *</Text>{authorized.length ? <FilterChipGroup wrap options={authorized.map(item => ({ key: item.id, label: `${item.effective_from} · ${item.entries.length} Positionen` }))} value={c.assessment.planId} onChange={c.locked ? undefined : planId => c.changeAssessment({ planId, entryId: '' })}/> : <InfoBanner variant="warning" message="Es ist kein unabhängig autorisierter Plan zum aktuellen Verordnungsstand vorhanden. Ein Vorschlag genügt nicht für eine Regelgabenprüfung."/>}{selectedPlan ? <FilterChipGroup wrap options={selectedPlan.entries.map(entry => ({ key: entry.id, label: `${entry.time} · ${entry.dose} ${entry.unit} · ${entry.route}` }))} value={c.assessment.entryId} onChange={c.locked ? undefined : entryId => c.changeAssessment({ entryId })}/> : null}</> : null}
     <MedicationEventTimeInput label="Zu prüfender tatsächlicher Zeitpunkt" value={c.assessment.time} disabled={c.locked} onChange={value => c.changeAssessment({ time: value })}/>
     <View style={styles.fields}>{([{ key: 'dose', label: 'Zu prüfende Dosis *' }, { key: 'unit', label: 'Originaleinheit *' }, { key: 'route', label: 'Applikation *' }] as const).map(field => <View key={field.key} style={styles.field}><PremiumInput label={field.label} accessibilityLabel={field.label} value={c.assessment[field.key]} editable={!c.locked} onChangeText={value => c.changeAssessment({ [field.key]: value })}/></View>)}</View>
     {expected?.is_prn === true ? <PremiumInput label="Aktuelle Bedarfsindikation *" accessibilityLabel="Bedarfsindikation für Grenzenprüfung" value={c.assessment.indication} editable={!c.locked} onChangeText={indication => c.changeAssessment({ indication })} maxLength={2000} multiline/> : null}
     <PremiumButton title={c.busy ? 'Grenzen werden geprüft…' : 'Rechnerisch prüfen'} disabled={c.locked} onPress={c.assess}/>
     {c.result ? <View style={styles.result}><PremiumBadge label="Gabespeicherung gesperrt" variant="orange"/><Text style={styles.bodyText}>{c.result.violations.length ? 'Die Grenzenprüfung weist offene oder verletzte Bedingungen aus.' : 'Die abgefragten rechnerischen Bedingungen wurden geprüft. Daraus folgt keine Berechtigung zur Durchführung.'}</Text><Text style={styles.note}>Serverprüfung: {time(c.result.assessedAt)} · Tatsächlicher Prüfbestand {time(c.result.historyWindow.from)} bis {time(c.result.historyWindow.through)}</Text><Text style={styles.note}>Vollständige Historie: {c.result.checks.historyComplete ? 'Bestätigt' : 'Nicht bestätigt'} · Mindestabstand: {c.result.checks.intervalSatisfied === null ? 'Nicht anwendbar' : c.result.checks.intervalSatisfied ? 'Eingehalten' : 'Verletzt'} · Höchstmenge: {c.result.checks.cumulativeSatisfied === null ? 'Nicht anwendbar' : c.result.checks.cumulativeSatisfied ? 'Eingehalten' : 'Verletzt'}</Text><Text style={styles.note}>Beobachtete Fenstermenge: {display(c.result.checks.maximumObservedWindowDose)} · Höchstmenge {display(c.result.checks.maximumDose)} · Zeitraum {display(c.result.checks.maximumPeriodHours)} Stunden</Text>{c.result.violations.length ? <Text style={styles.note}>Prüfhinweise: {c.result.violations.map(violation => assessmentViolation(violation)).join(' ')}</Text> : null}</View> : null}
    </> : c.review ? <>
     <Text style={styles.label}>Unveränderter täglicher Plan</Text><Text style={styles.note}>Gültig {c.review.plan.effective_from} bis {c.review.plan.effective_until ?? 'offen'} · {c.review.plan.timezone} · Erfasst durch {c.review.plan.recorded_by_name}</Text>{c.review.plan.entries.map(entry => <Text key={entry.id} style={styles.bodyText}>{entry.time} · {entry.dose} {entry.unit} · {entry.route}</Text>)}
     <View style={styles.fields}>{nativeReviewFields.map(([key, label]) => <View key={key} style={styles.field}><Text style={styles.label}>{label} · Verordnungsoriginal</Text><Text style={styles.bodyText}>{key === 'is_prn' ? (c.review!.plan.native_snapshot[key] === true ? 'Ja' : c.review!.plan.native_snapshot[key] === false ? 'Nein' : 'Nicht hinterlegt') : display(c.review!.plan.native_snapshot[key])}</Text></View>)}</View><Text style={styles.bodyText}>{c.review.plan.reason}</Text><Text style={styles.note}>Archivierte Originalunterlage: {display((c.review.plan.source_snapshot.document_snapshot as Row | undefined)?.title)} · {display((c.review.plan.source_snapshot.document_snapshot as Row | undefined)?.file_name)}</Text>
     {context.sourceOrder && context.sourceOrder.tenantId === context.tenantId && context.sourceOrder.clientId === context.clientId && context.sourceOrder.id === context.medicationId ? <MedicationSourceFileButton key={`${context.actorId}:${context.profileRole}:${c.review.plan.source_id}`} order={context.sourceOrder} linkId={c.review.plan.source_id} tenantId={context.tenantId} role={context.role}/> : null}
     {c.mode === 'review' && c.review.item?.request.action === 'withdraw' ? <InfoBanner variant="warning" title="Zukünftige Beendigung prüfen" message={`Angefragt ab ${display(c.review.item.request.effective_from)}: ${display(c.review.item.request.reason)}. Frühere Tage und frühere Gaben bleiben unverändert.`}/> : null}
     {c.mode === 'withdraw' ? <PremiumInput label="Beendigung ab zukünftigem Tag *" accessibilityLabel="Planbeendigung ab" placeholder="JJJJ-MM-TT" value={c.review.effectiveFrom} editable={!c.locked} onChangeText={effectiveFrom => c.changeReview({ effectiveFrom })}/> : null}
     {c.mode !== 'request_review' ? <PremiumInput label={c.mode === 'withdraw' ? 'Begründung der Beendigung *' : 'Originalabgleich und Prüfbezug *'} accessibilityLabel="Begründung des Planprüfauftrags" value={c.review.reference} editable={!c.locked} onChangeText={reference => c.changeReview({ reference })} maxLength={2000} multiline/> : null}
     <Text style={styles.note}>{c.mode === 'review' ? 'Die archivierte Datei öffnen und mit jedem Zeitpunkt, der genauen Dosis, Einheit, Applikation und Gültigkeit abgleichen. Die Bestätigung gilt ausschließlich dem angezeigten unveränderten technischen Prüfstand.' : 'Der Plan bleibt bis zur Entscheidung einer anderen berechtigten Person unverändert. Für Beendigungen wird ausschließlich ein ausdrücklich zukünftiger Tag angenommen.'}</Text>
     <FilterChipGroup wrap options={[{ key: 'accepted', label: c.mode === 'review' ? 'Originalabgleich bestätigt' : 'Planstand übernehmen' }]} value={c.review.accepted ? 'accepted' : ''} onChange={c.locked ? undefined : () => c.changeReview({ accepted: true })}/>
     {!c.confirmed ? <PremiumButton title={c.busy ? 'Wird geprüft…' : c.uncertain ? 'Anfrage erneut prüfen' : c.mode === 'review' ? 'Technisch bestätigen' : 'Prüfung anfordern'} disabled={c.busy || (c.uncertain ? !c.canReplay : c.locked)} onPress={c.submitReview}/> : null}
    </> : c.busy ? <LoadingState message="Eigener aktueller Originalprüfstand wird geladen…"/> : null}
    <PremiumButton title="Bearbeitung schließen" variant="secondary" disabled={c.busy || c.uncertain} onPress={c.close}/>
   </View> : null}
   <Text style={styles.heading}>Unveränderter Tagesplanverlauf</Text>{w && !w.items.length ? <Text style={styles.note}>Keine Tagesplanentwürfe im vollständig geladenen Verlauf vorhanden.</Text> : null}
   {w?.items.slice(0, visiblePlans).map(item => <View key={item.id} style={styles.record}><View style={styles.recordHeader}><Text style={styles.label}>{item.effective_from} bis {item.effective_until ?? 'offen'} · {item.timezone}</Text><PremiumBadge label={item.state === 'authorized' ? 'Plan technisch autorisiert' : 'Entwurf · Prüfung offen'} variant={item.state === 'authorized' ? 'green' : 'orange'}/></View><Text style={styles.bodyText}>{item.reason}</Text><Text style={styles.note}>Erfasst {time(item.recorded_at)} · {item.recorded_by_name} · Verordnungsstand {time(item.expected_updated_at)}</Text>{item.entries.map(entry => <Text key={entry.id} style={styles.bodyText}>{entry.time} · {entry.dose} {entry.unit} · {entry.route}</Text>)}<Text style={styles.note}>Originalquelle: {display((item.source_snapshot.document_snapshot as Row | undefined)?.title)} · {display((item.source_snapshot.document_snapshot as Row | undefined)?.file_name)}</Text>{item.withdrawal ? <InfoBanner variant="warning" message={`Planbeendigung ab ${display(item.withdrawal.effective_from)} bestätigt. Frühere Planstände bleiben erhalten. ${display(item.withdrawal.reason)}`}/> : null}{!c.mode ? <View style={styles.actions}>{c.reviewAllowed('request_review', item.id) ? <PremiumButton title="Planprüfung anfragen" variant="secondary" onPress={() => c.startReview('request_review', item.id)}/> : null}{c.reviewAllowed('withdraw', item.id) ? <PremiumButton title="Beendigung anfragen" variant="secondary" onPress={() => c.startReview('withdraw', item.id)}/> : null}</View> : null}{item.authorization ? <Text style={styles.note}>Unabhängiger technischer Prüfbezug: {display(item.authorization.review_reference)} · {time(item.authorization.recorded_at)}</Text> : <Text style={styles.note}>Die unabhängige Planprüfung ist offen. Der Entwurf berechtigt nicht zur Durchführung.</Text>}</View>)}
   {w && visiblePlans < w.items.length ? <PremiumButton title="Weitere Pläne anzeigen" variant="secondary" onPress={() => setVisiblePlans(value => value + 20)}/> : null}
   <Text style={styles.heading}>Unabhängige Planprüfungen</Text>{w && !w.reviews.length ? <Text style={styles.note}>Keine Prüfanfragen im vollständig geladenen Verlauf vorhanden.</Text> : null}{w?.reviews.slice(0, visibleReviews).map(item => <View key={String(item.request.id)} style={styles.record}><View style={styles.recordHeader}><Text style={styles.label}>{item.request.action === 'withdraw' ? 'Zukünftige Beendigung' : 'Tagesplanprüfung'} · {time(item.request.recorded_at)}</Text><PremiumBadge label={item.state === 'pending' ? 'Prüfung offen' : item.state === 'authorized' ? 'Technisch bestätigt' : item.state === 'expired' ? 'Prüfanfrage abgelaufen' : 'Prüfstand veraltet'} variant={item.state === 'authorized' ? 'green' : 'orange'}/></View><Text style={styles.note}>Plan erfasst durch {item.plan.recorded_by_name} · Gültig bis {time(item.request.expires_at)}</Text>{item.request.action === 'withdraw' ? <Text style={styles.bodyText}>Beendigung ab {display(item.request.effective_from)} · {display(item.request.reason)}</Text> : null}{!c.mode && c.reviewAllowed('review', String(item.request.id)) ? <PremiumButton title="Originalabgleich öffnen" variant="secondary" onPress={() => c.startReview('review', String(item.request.id))}/> : null}</View>)}
   {w && visibleReviews < w.reviews.length ? <PremiumButton title="Weitere Prüfungen" variant="secondary" onPress={() => setVisibleReviews(value => value + 20)}/> : null}
  </View>
 </SectionPanel>;
}
function assessmentViolation(code: string) { const labels: Record<string, string> = { legacy_execution_writers_unclosed: 'Die technische Abschlussprüfung der Gabewege ist offen.', clinical_execution_acceptance_unproven: 'Die fachliche Abnahme der Durchführung ist nicht bestätigt.', regular_plan_slot_not_confirmed: 'Die unabhängig autorisierte Planposition und Prüfzeit stimmen nicht überein.', non_actual_row_contains_dose: 'Eine Nichtgabe enthält widersprüchliche tatsächliche Dosisangaben.', actual_time_or_outcome_unknown: 'Ein tatsächlicher Zeitpunkt oder ein Gabeergebnis ist ungeklärt.', actual_dose_not_structured: 'Eine tatsächliche Dosis ist nicht eindeutig strukturiert.', actual_unit_or_route_unconfirmed: 'Einheit oder Applikation einer tatsächlichen Gabe sind nicht bestätigt.', regular_slot_already_documented: 'Die tägliche Planposition wurde bereits als tatsächliche Gabe dokumentiert.', minimum_interval_not_satisfied: 'Der verordnete Mindestabstand ist verletzt.', rolling_maximum_not_satisfied: 'Die Höchstmenge im tatsächlichen Bezugszeitraum wird überschritten.', controlled_or_unknown_witness_requirement: 'Die erforderliche Gegenkontrolle ist offen oder ungeklärt.', high_alert_or_unknown_review_requirement: 'Die erforderliche Hochrisikoprüfung ist offen oder ungeklärt.' }; return labels[code] ?? 'Eine serverseitige Prüfbedingung ist nicht bestätigt.'; }
function usePlanStyles() { const { c } = useCareLightPalette(); return useMemo(() => StyleSheet.create({ body: { gap: spacing.md, minWidth: 0 }, bodyText: { ...typography.body, color: c.text }, note: { ...typography.caption, color: c.muted }, label: { ...typography.label, color: c.text, flexShrink: 1 }, heading: { ...typography.bodyStrong, color: c.text }, fields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, minWidth: 0 }, field: { flexGrow: 1, flexBasis: 220, minWidth: 0 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 }, editor: { borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: spacing.md, gap: spacing.md, minWidth: 0 }, entry: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.md, gap: spacing.sm, minWidth: 0 }, result: { borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: spacing.md, gap: spacing.sm, minWidth: 0 }, record: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.md, gap: spacing.sm, minWidth: 0 }, recordHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm, minWidth: 0 } }), [c]); }
