// Generated native presentation from src/components/wfm/WfmOfficeTimeHistoryPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSection,NativeStyle,NativeHeader,NativeDiv,NativeH2,NativeP,NativeButton,NativeSpan,NativeStrong,NativeLabel,NativeSelect,NativeOption,NativeForm,NativeInput,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useNavigation, useLocalSearchParams, useRouter } from 'expo-router';
import { usePreventRemove } from "@/hooks/useNativePreventRemove.native";
import { PlatformModal } from '@/components/layout/platform';
import { useWorkflowFeedback } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { applyWfmOfficeTimeCorrection, getWfmOfficeTimeOverview, reviewWfmOfficeTimeEntry } from "../../lib/wfm/wfmOfficeTimekeepingService.native.ts";
import { listOfficeWebAudit } from "../../lib/wfm/wfmOfficeAuditReader.native.ts";
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import { officeMonthPeriod, officePeriodLabel } from '@/lib/wfm/wfmOfficeMonth';
import { confirmAction } from '@/lib/platform/confirmAction';
import { approveWfmOfficeTimeSelection, canApproveWfmOfficeTimeEntry, selectedWfmApprovalEntries } from '@/lib/wfm/wfmOfficeTimeApproval';
import { resolveWfmOfficeTimeDisplay } from '@/lib/wfm/wfmOfficeTimeDisplayResolver';
import { WFM_OFFICE_PERIOD_PRESET_LABELS, WFM_OFFICE_TIME_STATUS_LABELS, WFM_OFFICE_WORK_KIND_LABELS, type WfmOfficePeriodPreset, type WfmOfficeTimePeriod, type WfmOfficeTimeEntry, type WfmOfficeTimeFilters } from '@/types/modules/wfmOfficeTimekeeping';
import { WfmOfficeTimeEntryTable } from "./WfmOfficeTimeEntryTable.native.tsx";
import { WfmOfficeTimeReviewDetailPanel } from "./WfmOfficeTimeReviewDetailPanel.native.tsx";
import { localDateTimeInput, reviewCorrectionChanged, reviewEntryProtected, validateReviewCorrection, validateReviewRange } from "./wfmOfficeReviewDraft.native.ts";
import { wfmOfficeReviewCss } from "./wfmOfficeReviewStyles.native.ts";
export type WfmEditorState = {
    dirty: boolean;
    busy: boolean;
    childOpen: boolean;
};
type Props = {
    tenantId: string;
    reviewerId: string;
    roleKey: import('@/types').RoleKey | null;
    canCorrect: boolean;
    initialFilterAmpel?: string | null;
    reviewQueueMode?: boolean;
    initialEmployeeId?: string | null;
    initialEmployeeName?: string | null;
    initialPreset?: WfmOfficePeriodPreset;
    lockEmployeeFilter?: boolean;
    period?: WfmOfficeTimePeriod;
    onChanged?: () => Promise<void>;
    onEditorStateChange?: (state: WfmEditorState) => void;
};
const PRESETS: WfmOfficePeriodPreset[] = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'last_7_days', 'last_30_days', 'custom'];
const currentDay = () => localDateTimeInput(new Date().toISOString()).slice(0, 10);
type ReviewParams = {
    preset?: string | string[];
    from?: string | string[];
    to?: string | string[];
    month?: string | string[];
    employeeId?: string | string[];
    employee?: string | string[];
    filter?: string | string[];
};
const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
type ReviewFilters = {
    preset: WfmOfficePeriodPreset;
    from: string;
    to: string;
    employee: string | null;
    filter: string | null;
};
function requestedFilters(params: ReviewParams, defaults: ReviewFilters): ReviewFilters {
    const month = firstParam(params.month);
    const monthPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? officeMonthPeriod(month) : null;
    const from = firstParam(params.from);
    const to = firstParam(params.to);
    const customRange = from && to && !validateReviewRange(from, to) ? { fromDate: from, toDate: to } : monthPeriod;
    const requestedPreset = firstParam(params.preset) as WfmOfficePeriodPreset;
    const filter = firstParam(params.filter);
    return {
        preset: PRESETS.includes(requestedPreset) ? requestedPreset : customRange ? 'custom' : defaults.preset,
        from: customRange?.fromDate ?? defaults.from, to: customRange?.toDate ?? defaults.to,
        employee: firstParam(params.employeeId) || firstParam(params.employee) || defaults.employee,
        filter: ['pending', 'rot_blau', 'office_msg'].includes(filter) ? filter : filter === 'all' ? null : defaults.filter,
    };
}
/** Changing account or permission context discards the previous scope immediately. */
export function WfmOfficeTimeHistoryPanel(props: Props) {
    const scope = JSON.stringify([props.tenantId, props.reviewerId, props.roleKey, props.canCorrect, props.initialEmployeeId, props.lockEmployeeFilter, props.period?.fromDate, props.period?.toDate]);
    return <NativeWorkspaceStyleScope key={scope} css={[wfmOfficeReviewCss]}>{<HistoryContent key={scope} {...props}/>}</NativeWorkspaceStyleScope>;
}
function HistoryContent({ tenantId, reviewerId, roleKey, canCorrect, initialFilterAmpel = null, reviewQueueMode = false, initialEmployeeId = null, initialEmployeeName = null, initialPreset, lockEmployeeFilter = false, period, onChanged, onEditorStateChange }: Props) {
    const window = useNativeWorkflowWindow();
    const feedback = useWorkflowFeedback();
    const focused = useIsFocused();
    const navigation = useNavigation();
    const router = useRouter();
    const params = useLocalSearchParams<ReviewParams>();
    const manageUrl = !period && !lockEmployeeFilter;
    const defaults: ReviewFilters = { preset: initialPreset ?? (reviewQueueMode ? 'last_30_days' : 'this_month'), from: currentDay(), to: currentDay(), employee: initialEmployeeId, filter: initialFilterAmpel };
    const requested = manageUrl ? requestedFilters(params, defaults) : defaults;
    const requestedKey = JSON.stringify(requested);
    const [preset, setPreset] = useState<WfmOfficePeriodPreset>(requested.preset);
    const [customFrom, setCustomFrom] = useState(requested.from);
    const [customTo, setCustomTo] = useState(requested.to);
    const [rangeDraft, setRangeDraft] = useState(() => ({ from: requested.from, to: requested.to }));
    const [rangeError, setRangeError] = useState<string | null>(null);
    const [filterEmployeeId, setFilterEmployeeId] = useState<string | null>(requested.employee);
    const [filterAmpel, setFilterAmpel] = useState<string | null>(requested.filter);
    const [employeeOptions, setEmployeeOptions] = useState<{
        id: string;
        name: string;
    }[]>([]);
    const [selected, setSelected] = useState<WfmOfficeTimeEntry | null>(null);
    const selectedId = selected?.id ?? null;
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const mounted = useRef(true);
    const [approvalProgress, setApprovalProgress] = useState<string | null>(null);
    const [approvalState, setApprovalState] = useState({ scope: '', selectedIds: new Set<string>() });
    const [reviewNote, setReviewNote] = useState('');
    const [correctionReason, setCorrectionReason] = useState('');
    const [editStartAt, setEditStartAt] = useState('');
    const [editEndAt, setEditEndAt] = useState('');
    const [editPauseMinutes, setEditPauseMinutes] = useState('0');
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const filters = useMemo<Partial<WfmOfficeTimeFilters>>(() => ({
        ...(filterEmployeeId ? { employeeIds: [filterEmployeeId] } : {}),
        ...(filterAmpel === 'rot_blau' ? { onlyRotBlau: true } : {}),
        ...(filterAmpel === 'pending' ? { onlyPendingReview: true } : {}),
        ...(filterAmpel === 'office_msg' ? { onlyOfficeMessages: true } : {}),
    }), [filterEmployeeId, filterAmpel]);
    const periodFrom = period?.fromDate;
    const periodTo = period?.toDate;
    const scope = JSON.stringify([tenantId, reviewerId, roleKey, canCorrect, filterEmployeeId, filterAmpel, preset, customFrom, customTo, periodFrom, periodTo]);
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const historyQuery = useAsyncQuery(useCallback(() => getWfmOfficeTimeOverview(tenantId, roleKey, {
        preset: periodFrom && periodTo ? 'custom' : preset,
        fromDate: periodFrom ?? (preset === 'custom' ? customFrom : null), toDate: periodTo ?? (preset === 'custom' ? customTo : null), filters,
    }), [tenantId, roleKey, preset, customFrom, customTo, periodFrom, periodTo, filters]), [tenantId, roleKey, preset, customFrom, customTo, periodFrom, periodTo, filters], {
        enabled: Boolean(tenantId), queryKey: `wfm-review:${scope}`,
        live: { enabled: focused && !selectedId && !saving, tenantId, subscribe: subscribeToWfmLiveChanges, pollMs: 15000, refreshOnFocus: true },
    });
    const auditQuery = useAsyncQuery(useCallback(async () => selected ? listOfficeWebAudit(tenantId, roleKey, selected.id, selected) : { ok: true as const, data: [] }, [tenantId, roleKey, selected]), [tenantId, roleKey, selectedId, selected?.officeRevision], { enabled: Boolean(tenantId && selectedId), queryKey: `wfm-audit:${tenantId}:${selectedId}:${selected?.officeRevision}` });
    const overview = historyQuery.data;
    const entries = overview?.entries ?? [];
    const queryBlocked = historyQuery.loading || Boolean(historyQuery.error || historyQuery.refreshError);
    const canQuickApprove = canCorrect && Boolean(reviewerId);
    const approvalEntries = entries.filter(entry => entry.tenantId === tenantId && canApproveWfmOfficeTimeEntry(entry));
    const selectedApprovalEntries = selectedWfmApprovalEntries(approvalEntries, approvalState.scope === scope ? approvalState.selectedIds : new Set<string>());
    const selectedApprovalIds = new Set(selectedApprovalEntries.map(entry => entry.id));
    const allApprovalSelected = approvalEntries.length > 0 && selectedApprovalEntries.length === approvalEntries.length;
    const correctionChanged = Boolean(selected && reviewCorrectionChanged(selected, editStartAt, editEndAt, editPauseMinutes));
    const dirty = Boolean(selected && (reviewNote.trim() || correctionReason.trim() || correctionChanged));
    const callbackRef = useRef(onEditorStateChange);
    callbackRef.current = onEditorStateChange;
    useEffect(() => { callbackRef.current?.({ dirty, busy: saving, childOpen: Boolean(selectedId) }); }, [dirty, saving, selectedId]);
    useEffect(() => () => callbackRef.current?.({ dirty: false, busy: false, childOpen: false }), []);
    usePreventRemove(!onEditorStateChange && (dirty || saving), async ({ data }) => {
        if (!savingRef.current && (!dirty || await confirmNativeWorkspaceAction('Ungespeicherte Änderungen verwerfen und Arbeitszeit verlassen?')))
            navigation.dispatch(data.action);
    });
    useEffect(() => {
        if (!dirty && !saving)
            return;
        const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', unload);
        return () => window.removeEventListener('beforeunload', unload);
    }, [dirty, saving]);
    const wasFocused = useRef(focused);
    useEffect(() => { if (focused && !wasFocused.current && !selectedId && !saving)
        void historyQuery.refresh(); wasFocused.current = focused; }, [focused, selectedId, saving, historyQuery.refresh]);
    useEffect(() => {
        if (!overview?.employees)
            return;
        setEmployeeOptions(previous => [...new Map([...previous, ...overview.employees].map(employee => [employee.id, employee])).values()].sort((a, b) => a.name.localeCompare(b.name, 'de')));
    }, [overview?.employees]);
    function initializeDraft(entry: WfmOfficeTimeEntry, resetReviewNote = true) {
        setEditStartAt(entry.actualStartAt ?? entry.assignmentActualStartAt ?? '');
        setEditEndAt(entry.actualEndAt ?? entry.assignmentActualEndAt ?? '');
        setEditPauseMinutes(String(entry.pauseMinutes ?? 0));
        setCorrectionReason('');
        if (resetReviewNote)
            setReviewNote('');
    }
    function selectEntry(id: string | null) {
        if (savingRef.current || selectedId)
            return;
        const entry = entries.find(item => item.id === id && item.tenantId === tenantId) ?? null;
        if (entry)
            initializeDraft(entry);
        setSelected(entry);
    }
    const closingRef = useRef(false);
    async function closeDetail() {
        if (savingRef.current || closingRef.current)
            return;
        closingRef.current = true;
        const savedScope = scope;
        try {
            if (dirty && !await confirmAction({ title: 'Buchung schließen', message: 'Ungespeicherte Änderungen verwerfen und Buchung schließen?', confirmLabel: 'Verwerfen', cancelLabel: 'Weiter bearbeiten' }))
                return;
            if (activeScope(savedScope) && !savingRef.current) {
                setSelected(null);
                setReviewNote('');
                setCorrectionReason('');
            }
        }
        finally {
            closingRef.current = false;
        }
    }
    function persistFilters(next: ReviewFilters) {
        if (!manageUrl || !focused)
            return;
        router.setParams({ preset: next.preset, from: next.preset === 'custom' ? next.from : '', to: next.preset === 'custom' ? next.to : '', month: next.preset === 'custom' && next.from.slice(0, 7) === next.to.slice(0, 7) ? next.from.slice(0, 7) : '', employeeId: next.employee ?? '', employee: '', filter: next.filter ?? 'all' });
    }
    function updateFilters(patch: Partial<ReviewFilters>) {
        if (savingRef.current)
            return;
        const next: ReviewFilters = { preset, from: customFrom, to: customTo, employee: filterEmployeeId, filter: filterAmpel, ...patch };
        setPreset(next.preset);
        setCustomFrom(next.from);
        setCustomTo(next.to);
        setFilterEmployeeId(next.employee);
        setFilterAmpel(next.filter);
        setRangeError(null);
        persistFilters(next);
    }
    useEffect(() => runNativeWorkspaceEffect(async (confirmNativeWorkspaceAction) => {
        if (!manageUrl || !focused)
            return;
        const current: ReviewFilters = { preset, from: customFrom, to: customTo, employee: filterEmployeeId, filter: filterAmpel };
        if (JSON.stringify(current) === requestedKey)
            return;
        if (savingRef.current || (dirty && !await confirmNativeWorkspaceAction('Ungespeicherte Änderungen verwerfen und die andere Auswahl öffnen?'))) {
            persistFilters(current);
            return;
        }
        setSelected(null);
        setReviewNote('');
        setCorrectionReason('');
        setPreset(requested.preset);
        setCustomFrom(requested.from);
        setCustomTo(requested.to);
        setRangeDraft({ from: requested.from, to: requested.to });
        setFilterEmployeeId(requested.employee);
        setFilterAmpel(requested.filter);
        setRangeError(null);
        // Reconcile navigation changes only; local drafts must not reset on every keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [requestedKey, manageUrl, focused]);
    function beginSave() { if (savingRef.current || !canCorrect || !reviewerId || !mounted.current)
        return false; savingRef.current = true; setSaving(true); return true; }
    function finishSave() { savingRef.current = false; if (mounted.current) {
        setSaving(false);
        setApprovalProgress(null);
    } }
    const activeScope = (savedScope: string) => mounted.current && scopeRef.current === savedScope;
    function applyConfirmed(entry: WfmOfficeTimeEntry) {
        historyQuery.setData(current => current ? { ...current, entries: current.entries.map(item => item.id === entry.id ? entry : item) } : current);
    }
    async function refreshAfterSave(savedScope: string) {
        if (!activeScope(savedScope))
            return;
        let refreshed = false;
        try {
            const results = await Promise.all([historyQuery.refreshWithResult(), auditQuery.refreshWithResult(), onChanged?.()]);
            refreshed = results[0];
        }
        catch {
            refreshed = false;
        }
        if (!refreshed && activeScope(savedScope))
            feedback.showWarning('Die Änderung ist gespeichert. Die Übersicht konnte nicht vollständig aktualisiert werden. Bitte erneut laden.', 'Übersicht aktualisieren');
    }
    function changeSelection(entryId?: string) {
        if (!canQuickApprove || savingRef.current || queryBlocked)
            return;
        const ids = new Set(selectedApprovalIds);
        if (entryId) {
            if (!approvalEntries.some(entry => entry.id === entryId))
                return;
            if (ids.has(entryId))
                ids.delete(entryId);
            else
                ids.add(entryId);
        }
        else {
            ids.clear();
            if (!allApprovalSelected)
                approvalEntries.forEach(entry => ids.add(entry.id));
        }
        setApprovalState({ scope, selectedIds: ids });
    }
    async function runQuickApproval(requested: WfmOfficeTimeEntry[]) {
        if (!canQuickApprove || selectedId || queryBlocked)
            return;
        const targets = selectedWfmApprovalEntries(approvalEntries, new Set(requested.map(entry => entry.id)));
        if (!targets.length || !beginSave())
            return;
        const savedScope = scope;
        let loadingId: ReturnType<typeof feedback.showLoading> | undefined;
        try {
            const deviations = targets.filter(entry => entry.overallAmpel === 'red' || entry.overallAmpel === 'blue').length;
            const confirmed = await confirmAction({ title: `${targets.length} ${targets.length === 1 ? 'Arbeitszeit' : 'Arbeitszeiten'} genehmigen`, message: `${overview ? officePeriodLabel(overview.period) + '\n' : ''}Die gespeicherten Ist-Zeiten der ${targets.length} angezeigten und genehmigungsfähigen Einträge werden freigegeben.${deviations ? `\n${deviations} Einträge haben rote oder blaue Abweichungen. Bitte vor der Genehmigung prüfen.` : ''}`, confirmLabel: 'Genehmigen' });
            if (!confirmed || !activeScope(savedScope))
                return;
            loadingId = feedback.showLoading('Arbeitszeiten werden genehmigt …');
            const confirmedEntries = new Map<string, WfmOfficeTimeEntry>();
            const outcome = await approveWfmOfficeTimeSelection(targets, async (entry) => {
                if (!activeScope(savedScope) || entry.tenantId !== tenantId)
                    return { ok: false as const, error: 'Die Ansicht wurde gewechselt. Bitte erneut auswählen.' };
                const result = await reviewWfmOfficeTimeEntry(tenantId, reviewerId, roleKey, entry.id, 'approved', undefined, entry);
                if (result.ok && result.data.tenantId !== tenantId)
                    return { ok: false as const, error: 'Die Antwort gehört nicht zur aktuellen Firma. Bitte neu laden.' };
                if (result.ok && result.data.id === entry.id && result.data.reviewStatus === 'approved')
                    confirmedEntries.set(entry.id, result.data);
                return result;
            }, (done, total) => { if (activeScope(savedScope))
                setApprovalProgress(`${done} von ${total} bearbeitet`); });
            if (!activeScope(savedScope))
                return;
            historyQuery.setData(current => current ? { ...current, entries: current.entries.map(entry => confirmedEntries.get(entry.id) ?? entry) } : current);
            setApprovalState(current => {
                const remaining = new Set(current.scope === savedScope ? current.selectedIds : []);
                outcome.approvedIds.forEach(id => remaining.delete(id));
                outcome.failed.forEach(({ entry }) => remaining.add(entry.id));
                return { scope: savedScope, selectedIds: remaining };
            });
            if (outcome.failed.length)
                feedback.showWarning(`${outcome.approvedIds.length} genehmigt, ${outcome.failed.length} nicht genehmigt. Nicht genehmigte Einträge bleiben ausgewählt.\n${outcome.failed.slice(0, 3).map(({ entry, error }) => `${entry.employeeName} · ${entry.workDate}: ${error}`).join('\n')}`, 'Genehmigung prüfen');
            else
                feedback.showSuccess(`${outcome.approvedIds.length} ${outcome.approvedIds.length === 1 ? 'Arbeitszeit wurde' : 'Arbeitszeiten wurden'} genehmigt.`, 'Genehmigung gespeichert');
            await refreshAfterSave(savedScope);
        }
        catch (error) {
            if (activeScope(savedScope))
                feedback.showError(error instanceof Error ? error.message : 'Genehmigung fehlgeschlagen.', 'Genehmigung nicht abgeschlossen');
        }
        finally {
            if (loadingId !== undefined)
                feedback.dismiss(loadingId);
            finishSave();
        }
    }
    async function runReview(decision: 'approved' | 'rejected' | 'needs_clarification') {
        if (!selected || selected.tenantId !== tenantId || reviewEntryProtected(selected) || queryBlocked)
            return;
        if (correctionChanged || correctionReason.trim()) {
            feedback.showWarning('Bitte zuerst die Korrektur speichern oder zurücknehmen.', 'Ungespeicherte Korrektur');
            return;
        }
        const capabilities = resolveWfmOfficeTimeDisplay(selected);
        if (decision === 'approved' && !canApproveWfmOfficeTimeEntry(selected))
            return;
        if (decision === 'rejected' && (selected.canReject === false || !capabilities.canReject))
            return;
        if (decision === 'needs_clarification' && (selected.canRequestClarification === false || !capabilities.canRequestClarification))
            return;
        if (decision !== 'approved' && !reviewNote.trim()) {
            feedback.showWarning('Bitte eine Nachricht zur Prüfung eingeben.', 'Nachricht erforderlich');
            return;
        }
        if (!beginSave())
            return;
        const savedScope = scope;
        let loadingId: ReturnType<typeof feedback.showLoading> | undefined;
        try {
            const confirmed = await confirmAction({ title: decision === 'approved' ? 'Arbeitszeit genehmigen' : decision === 'rejected' ? 'Arbeitszeit ablehnen' : 'Rückfrage speichern', message: `${selected.employeeName} · ${selected.workDate}\n${decision === 'approved' ? 'Die gespeicherten Ist-Zeiten werden genehmigt.' : reviewNote.trim()}`, confirmLabel: 'Bestätigen' });
            if (!confirmed || !activeScope(savedScope))
                return;
            loadingId = feedback.showLoading('Prüfung wird gespeichert …');
            const result = await reviewWfmOfficeTimeEntry(tenantId, reviewerId, roleKey, selected.id, decision, reviewNote.trim(), selected);
            if (!activeScope(savedScope))
                return;
            if (!result.ok) {
                feedback.showError(result.error, 'Prüfung nicht gespeichert');
                return;
            }
            if (result.data.id !== selected.id || result.data.tenantId !== tenantId || result.data.reviewStatus !== decision) {
                feedback.showError('Der Server hat den angeforderten Prüfstatus nicht bestätigt. Bitte aktualisieren.', 'Prüfung kontrollieren');
                return;
            }
            applyConfirmed(result.data);
            setSelected(null);
            setReviewNote('');
            feedback.showSuccess(`Status: ${WFM_OFFICE_TIME_STATUS_LABELS[result.data.reviewStatus]}`, 'Prüfung gespeichert');
            await refreshAfterSave(savedScope);
        }
        catch (error) {
            if (activeScope(savedScope))
                feedback.showError(error instanceof Error ? error.message : 'Prüfung fehlgeschlagen.', 'Prüfung nicht gespeichert');
        }
        finally {
            if (loadingId !== undefined)
                feedback.dismiss(loadingId);
            finishSave();
        }
    }
    async function runCorrection(adoptAssignment = false) {
        if (!selected || selected.tenantId !== tenantId || reviewEntryProtected(selected) || selected.canEdit === false || queryBlocked)
            return;
        if (!correctionReason.trim()) {
            feedback.showWarning('Bitte die Korrektur begründen.', 'Begründung erforderlich');
            return;
        }
        const invalid = validateReviewCorrection(adoptAssignment ? selected.assignmentActualStartAt ?? '' : editStartAt, adoptAssignment ? selected.assignmentActualEndAt ?? '' : editEndAt, editPauseMinutes);
        if (invalid) {
            feedback.showWarning(invalid, 'Zeiten prüfen');
            return;
        }
        if (!beginSave())
            return;
        const savedScope = scope;
        const loadingId = feedback.showLoading('Arbeitszeitkorrektur wird gespeichert …');
        try {
            const result = await applyWfmOfficeTimeCorrection(tenantId, reviewerId, roleKey, { entryId: selected.id, reason: correctionReason.trim(), actualStartAt: adoptAssignment ? selected.assignmentActualStartAt ?? '' : editStartAt, actualEndAt: adoptAssignment ? selected.assignmentActualEndAt ?? '' : editEndAt, pauseMinutes: Number(editPauseMinutes) }, selected);
            if (!activeScope(savedScope))
                return;
            if (!result.ok) {
                feedback.showError(result.error, 'Korrektur nicht gespeichert');
                return;
            }
            if (result.data.id !== selected.id || result.data.tenantId !== tenantId) {
                feedback.showError('Die gespeicherte Buchung konnte nicht zugeordnet werden. Bitte aktualisieren.', 'Buchung kontrollieren');
                return;
            }
            applyConfirmed(result.data);
            setSelected(result.data);
            initializeDraft(result.data, false);
            feedback.showSuccess('Die Korrektur ist gespeichert und kann jetzt geprüft werden.', 'Korrektur gespeichert');
            await refreshAfterSave(savedScope);
        }
        catch (error) {
            if (activeScope(savedScope))
                feedback.showError(error instanceof Error ? error.message : 'Korrektur fehlgeschlagen.', 'Korrektur nicht gespeichert');
        }
        finally {
            feedback.dismiss(loadingId);
            finishSave();
        }
    }
    const kpis = overview?.kpis;
    const stats = reviewQueueMode ? [['Offen', kpis?.pendingReviewCount], ['Fehlende Buchung', kpis?.missingBookings], ['Ungeplant', kpis?.unplannedBookings], ['Abweichungen', kpis?.planningDeviations]] : [['Erfasste Stunden', kpis?.totalHours], ['Offene Prüfungen', kpis?.pendingReviewCount], ['Fehlende Buchung', kpis?.missingBookings], ['Exportiert', kpis?.exportedCount]];
    const error = historyQuery.error || historyQuery.refreshError;
    return <NativeWorkspaceStyleScope css={[wfmOfficeReviewCss, wfmOfficeReviewCss]}>{<NativeSection data-wfm-review="workspace" aria-label={reviewQueueMode ? 'Offene Arbeitszeitprüfungen' : 'Arbeitszeit-Historie'}>
    <NativeStyle>{wfmOfficeReviewCss}</NativeStyle>
    <NativeHeader className="wr-head"><NativeDiv><NativeH2>{reviewQueueMode ? 'Offene Prüfungen' : 'Historie'}</NativeH2><NativeP className="wr-muted">{overview ? officePeriodLabel(overview.period) : 'Arbeitszeiten prüfen, korrigieren und freigeben'}</NativeP></NativeDiv><NativeButton className="wr-button" type="button" disabled={saving || historyQuery.refreshing} onClick={() => void historyQuery.refresh()}>{historyQuery.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</NativeButton></NativeHeader>
    <NativeDiv className="wr-toolbar">
      {period ? <NativeDiv className="wr-field"><NativeSpan>Zeitraum</NativeSpan><NativeStrong>{officePeriodLabel(period)}</NativeStrong></NativeDiv> : <NativeLabel className="wr-field">Zeitraum<NativeSelect value={preset} disabled={saving || Boolean(selectedId)} onChange={event => { const next = event.target.value as WfmOfficePeriodPreset; if (PRESETS.includes(next)) {
        updateFilters({ preset: next });
    } }}>{PRESETS.map(value => <NativeOption key={value} value={value}>{WFM_OFFICE_PERIOD_PRESET_LABELS[value]}</NativeOption>)}</NativeSelect></NativeLabel>}
      {lockEmployeeFilter ? <NativeDiv className="wr-field"><NativeSpan>Person</NativeSpan><NativeStrong>{initialEmployeeName || entries[0]?.employeeName || 'Ausgewählte Person'}</NativeStrong></NativeDiv> : <NativeLabel className="wr-field">Mitarbeitende<NativeSelect value={filterEmployeeId ?? ''} disabled={saving || Boolean(selectedId)} onChange={event => updateFilters({ employee: event.target.value || null })}><NativeOption value="">Alle Mitarbeitenden</NativeOption>{filterEmployeeId && !employeeOptions.some(employee => employee.id === filterEmployeeId) ? <NativeOption value={filterEmployeeId}>{initialEmployeeName || 'Ausgewählte Person'}</NativeOption> : null}{employeeOptions.map(employee => <NativeOption key={employee.id} value={employee.id}>{employee.name}</NativeOption>)}</NativeSelect></NativeLabel>}
      <NativeLabel className="wr-field">Prüffilter<NativeSelect value={filterAmpel ?? ''} disabled={saving || Boolean(selectedId)} onChange={event => updateFilters({ filter: event.target.value || null })}><NativeOption value="">Alle Einträge</NativeOption><NativeOption value="pending">Offene Prüfungen</NativeOption><NativeOption value="rot_blau">Rote / blaue Abweichungen</NativeOption><NativeOption value="office_msg">Office-Meldungen</NativeOption></NativeSelect></NativeLabel>
    </NativeDiv>
    {!period && preset === 'custom' ? <NativeForm className="wr-toolbar" onSubmit={event => { event.preventDefault(); if (savingRef.current)
        return; const invalid = validateReviewRange(rangeDraft.from, rangeDraft.to); setRangeError(invalid); if (!invalid) {
        updateFilters({ from: rangeDraft.from, to: rangeDraft.to });
    } }}><NativeLabel className="wr-field">Von<NativeInput type="date" required disabled={saving} value={rangeDraft.from} onChange={event => setRangeDraft(current => ({ ...current, from: event.target.value }))}/></NativeLabel><NativeLabel className="wr-field">Bis<NativeInput type="date" required disabled={saving} value={rangeDraft.to} onChange={event => setRangeDraft(current => ({ ...current, to: event.target.value }))}/></NativeLabel><NativeButton className="wr-button" type="submit" disabled={saving}>Zeitraum anwenden</NativeButton>{rangeError ? <NativeP role="alert">{rangeError}</NativeP> : null}</NativeForm> : null}
    {kpis ? <NativeDiv className="wr-stats">{stats.map(([label, value]) => <NativeDiv className="wr-stat" key={String(label)}><NativeStrong>{typeof value === 'number' ? value.toLocaleString('de-DE', { maximumFractionDigits: 2 }) : '—'}</NativeStrong><NativeSpan>{label}</NativeSpan></NativeDiv>)}</NativeDiv> : null}
    {historyQuery.loading ? <NativeDiv className="wr-message" role="status">Zeitbuchungen werden geladen …</NativeDiv> : null}
    {error ? <NativeDiv className="wr-message" data-tone="error" role="alert"><NativeP>{historyQuery.refreshError ? 'Aktualisierung fehlgeschlagen. Die angezeigten Daten stammen vom letzten erfolgreichen Abruf. Vor Änderungen bitte neu laden.' : 'Die Zeitbuchungen konnten nicht geladen werden.'}</NativeP><NativeP>{error}</NativeP><NativeButton className="wr-button" type="button" disabled={saving || historyQuery.refreshing} onClick={() => void historyQuery.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
    {canQuickApprove && entries.length ? <NativeDiv className="wr-batch"><NativeDiv className="wr-batch-info"><NativeStrong>{selectedApprovalEntries.length} von {approvalEntries.length} genehmigungsfähigen Einträgen ausgewählt</NativeStrong><NativeP className="wr-muted" aria-live="polite">{approvalProgress ?? 'Die Auswahl gilt für den angezeigten Zeitraum und die aktiven Filter.'}</NativeP></NativeDiv><NativeButton className="wr-button" type="button" disabled={saving || queryBlocked || !approvalEntries.length} onClick={() => changeSelection()}>{allApprovalSelected ? 'Auswahl aufheben' : 'Alle auswählen'}</NativeButton><NativeButton className="wr-button" data-primary type="button" disabled={saving || queryBlocked || !selectedApprovalEntries.length} onClick={() => void runQuickApproval(selectedApprovalEntries)}>Auswahl genehmigen ({selectedApprovalEntries.length})</NativeButton><NativeButton className="wr-button" type="button" disabled={saving || queryBlocked || !approvalEntries.length} onClick={() => void runQuickApproval(approvalEntries)}>Alle genehmigen ({approvalEntries.length})</NativeButton></NativeDiv> : null}
    {!historyQuery.loading && (!historyQuery.error || entries.length) ? <WfmOfficeTimeEntryTable entries={entries} selectedId={selectedId} onSelect={selectEntry} reviewQueueMode={reviewQueueMode} approval={canQuickApprove ? { selectedIds: selectedApprovalIds, onToggle: changeSelection, onApprove: entry => void runQuickApproval([entry]), busy: saving || queryBlocked } : undefined}/> : null}
    <PlatformModal visible={Boolean(selected)} title={selected ? `Arbeitszeit · ${selected.employeeName}` : 'Arbeitszeit'} subtitle={selected ? `${selected.workDate} · ${WFM_OFFICE_WORK_KIND_LABELS[selected.workKind]}` : undefined} onClose={() => void closeDetail()} variant="center" maxWidth={980} minWidth={300} maxHeightRatio={0.94} dismissOnBackdrop={false} surfaceScope="company" bodyStyle={{ padding: 14, backgroundColor: '#F5F9FF' }} isDirty={false}>
      {selected ? <WfmOfficeTimeReviewDetailPanel entry={selected} auditEntries={auditQuery.data ?? []} canCorrect={canCorrect} blockedReason={queryBlocked ? "Die Übersicht ist noch nicht aktuell bestätigt. Bitte Buchung schließen und die Übersicht erneut laden, bevor Sie Änderungen vornehmen." : null} onApprove={() => void runReview('approved')} onReject={() => void runReview('rejected')} onClarification={() => void runReview('needs_clarification')} onAdoptAssignment={() => void runCorrection(true)} onSaveCorrection={() => void runCorrection()} onClose={() => void closeDetail()} reviewNote={reviewNote} onReviewNoteChange={setReviewNote} correctionReason={correctionReason} onCorrectionReasonChange={setCorrectionReason} editStartAt={editStartAt} editEndAt={editEndAt} editPauseMinutes={editPauseMinutes} onEditStartAtChange={setEditStartAt} onEditEndAtChange={setEditEndAt} onEditPauseMinutesChange={setEditPauseMinutes} exportedWarning={selected.exportStatus === 'exported'} embedded saving={saving} auditLoading={auditQuery.loading || auditQuery.refreshing} auditError={auditQuery.error || auditQuery.refreshError} onRetryAudit={() => void auditQuery.refresh()}/> : null}
    </PlatformModal>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
