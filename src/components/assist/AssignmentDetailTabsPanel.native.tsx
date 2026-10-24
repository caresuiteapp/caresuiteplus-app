// Generated native presentation from src/components/assist/AssignmentDetailTabsPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeDt,NativeDd,NativeSection,NativeHeader,NativeH3,NativeP,NativeButton,NativeDl,NativeUl,NativeLi,NativeSpan,NativeSmall,NativeOl,NativeStrong,NativeTime,NativeH2,NativeLabel,NativeSelect,NativeOption} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useVisitDispositionDetail } from '@/hooks/useVisitDispositionDetail';
import { useAsyncQuery } from '@/hooks/core';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { usePermissions } from '@/hooks/usePermissions';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { buildVisitProofPreview, deleteVisitDisposition, fetchVisitStatusHistory, updateVisitTaskStatus } from '@/lib/assist';
import type { VisitSeriesMutationScope } from '@/lib/assist/visitService';
import type { VisitDispositionDetail, VisitTaskStatus } from '@/lib/assist/visitTypes';
import { VISIT_BILLING_STATUS_LABELS, VISIT_EXECUTION_STATUS_LABELS, VISIT_PLANNING_STATUS_LABELS, VISIT_PORTAL_STATUS_LABELS, VISIT_PROOF_STATUS_LABELS, VISIT_TASK_STATUS_LABELS } from '@/lib/assist/visitTypes';
import { ASSIGNMENT_STATUS_LABELS, isCancelledAssignmentStatus, type AssignmentStatus } from '@/types/modules/assignmentStatus';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { VisitProofPreviewPanel } from "./VisitProofPreviewPanel.native.tsx";
import { VisitInternalAttachmentsPanel } from "./VisitInternalAttachmentsPanel.native.tsx";
import { VisitTasksPanel } from "./VisitTasksPanel.native.tsx";
import { AssignmentsWorkspaceStyles } from "./AssignmentsWorkspaceShell.native.tsx";
import { AssignmentDetailStyles } from "./AssignmentDetailStyles.native.tsx";
import { notifyWfmOfficeDataChanged } from '@/lib/wfm/wfmOfficeDataChanged';
const TABS = [['overview', 'Übersicht'], ['planning', 'Planung'], ['tasks', 'Aufgaben'], ['budget', 'Budget & Abrechnung'], ['execution', 'Durchführung'], ['proof', 'Nachweis'], ['history', 'Verlauf']] as const;
export type AssignmentDetailTabKey = typeof TABS[number][0];
export function isAssignmentDetailTabKey(value: string): value is AssignmentDetailTabKey { return TABS.some(([key]) => key === value); }
type Props = {
    assignmentId: string;
    mode?: 'preview' | 'full';
    layout?: 'page' | 'modal';
    onOpenFullRecord?: () => void;
    onEdit?: (visit: VisitDispositionDetail) => void;
    onClose?: () => void;
    onDeleted?: () => void;
    refreshTrigger?: number;
    onStatusChange?: (dirty: boolean, busy: boolean) => void;
    initialTab?: AssignmentDetailTabKey;
};
const date = (iso?: string | null) => !iso || !Number.isFinite(Date.parse(iso)) ? 'Noch nicht erfasst' : new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const duration = (value?: number | null) => value == null || value <= 0 ? 'Noch nicht erfasst' : `${Math.floor(value / 60) ? `${Math.floor(value / 60)} Std. ` : ''}${value % 60 ? `${value % 60} Min.` : ''}`.trim();
const money = (value?: number | null, currency = 'EUR') => value == null ? 'Noch nicht ermittelt' : new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value / 100);
const snapshot = (visit: VisitDispositionDetail, key: string, fallback?: string | null) => { const value = visit.catalogSnapshotJson?.[key]; return typeof value === 'string' && value.trim() ? value : Array.isArray(value) ? value.filter(v => typeof v === 'string').join(', ') : fallback || 'Nicht hinterlegt'; };
function Row({ label, children }: {
    label: string;
    children: ReactNode;
}) { return <NativeDiv className="ad-row"><NativeDt>{label}</NativeDt><NativeDd>{children || 'Nicht hinterlegt'}</NativeDd></NativeDiv>; }
function Card({ title, hint, children, className = '' }: {
    title: string;
    hint?: string;
    children: ReactNode;
    className?: string;
}) { return <NativeSection className={`aw-panel ad-card ${className}`}><NativeHeader><NativeH3>{title}</NativeH3>{hint ? <NativeP>{hint}</NativeP> : null}</NativeHeader>{children}</NativeSection>; }
export function AssignmentDetailTabsPanel(props: Props) {
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can, roleKey } = usePermissions();
    if (!roleKey || isPortalOnlyRole(roleKey) || !can('assist.assignments.view'))
        return <NativeDiv className="aw-workspace ad-root"><AssignmentsWorkspaceStyles /><NativeDiv className="aw-alert" data-tone="info" role="status">Sie haben keine Berechtigung, diesen Einsatz zu öffnen.</NativeDiv></NativeDiv>;
    return <SurfaceContrastProvider tone="light"><AssignmentsWorkspaceStyles /><AssignmentDetailStyles /><Detail key={`${tenantId}:${profile?.id}:${profile?.roleKey}:${props.assignmentId}`} {...props}/></SurfaceContrastProvider>;
}
function Detail({ assignmentId, mode = 'full', onOpenFullRecord, onEdit, onClose, onDeleted, refreshTrigger, onStatusChange, initialTab = 'overview' }: Props) {
    const router = useRouter();
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can, roleKey } = usePermissions();
    const { data: visit, loading, error, notFound, refresh, refreshAfterSave, refreshError, actionError, actionLoading, successMessage, changeStatus } = useVisitDispositionDetail(assignmentId);
    const [tab, setTab] = useState<AssignmentDetailTabKey>(initialTab);
    const [localBusy, setLocalBusy] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleted, setDeleted] = useState(false);
    const [deleteScope, setDeleteScope] = useState<VisitSeriesMutationScope>('this_only');
    const alive = useRef(true);
    const lock = useRef(false);
    const permissions = useRef({ manage: false, execute: false });
    permissions.current = { manage: Boolean(roleKey && !isPortalOnlyRole(roleKey) && can('assist.assignments.view') && can('assist.assignments.manage')), execute: Boolean(roleKey && !isPortalOnlyRole(roleKey) && can('assist.assignments.view') && can('assist.execution.manage')) };
    const tabId = useId();
    const busy = localBusy || actionLoading;
    const [taskDirty, setTaskDirty] = useState(false);
    const confirmLeave = useUnsavedWebChanges(taskDirty, busy);
    const leave = async (action: () => void) => {
        if (await confirmLeave())
            action();
    };
    useEffect(() => { onStatusChange?.(taskDirty, busy); }, [taskDirty, busy, onStatusChange]);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { setTab(initialTab); }, [initialTab]);
    useEffect(() => {
        if (refreshTrigger)
            void refresh();
    }, [refreshTrigger, refresh]);
    const history = useAsyncQuery(() => tenantId ? fetchVisitStatusHistory(assignmentId, tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Unternehmen ausgewählt.' }), [tenantId, assignmentId, profile?.id, profile?.roleKey], { enabled: mode === 'full' && tab === 'history' && !!tenantId, queryKey: JSON.stringify([tenantId, profile?.id, assignmentId]) });
    if (loading && !visit)
        return <NativeDiv className="aw-workspace ad-root"><NativeDiv className="aw-empty" role="status">Einsatz wird geladen…</NativeDiv></NativeDiv>;
    if (!visit || error || notFound)
        return <NativeDiv className="aw-workspace ad-root"><NativeDiv className="aw-alert" data-tone="danger" role="alert">{error || 'Dieser Einsatz wurde nicht gefunden.'}</NativeDiv><NativeButton className="aw-button" onClick={() => void refresh()}>Erneut laden</NativeButton></NativeDiv>;
    if (deleted)
        return <NativeDiv className="aw-workspace ad-root"><NativeDiv className="aw-alert" data-tone="success" role="status">Der Einsatz wurde gelöscht.</NativeDiv><NativeButton className="aw-button" onClick={() => router.replace('/assist/assignments')}>Zur Einsatzübersicht</NativeButton></NativeDiv>;
    const cancelled = isCancelledAssignmentStatus(visit.assignmentStatus) || visit.executionStatus === 'cancelled';
    const protectedTasks = visit.proofStatus === 'signed' || visit.proofStatus === 'verified' || visit.assignmentStatus === 'abgeschlossen' || visit.billingStatus === 'invoiced' || visit.billingStatus === 'paid';
    const manage = permissions.current.manage;
    const series = Boolean(visit.seriesMasterId && visit.seriesOccurrenceDate);
    const transitions = visit.allowedStatusTransitions ?? [];
    const updateTask = async (taskId: string, status: VisitTaskStatus, reason?: string) => {
        if (lock.current || actionLoading || !tenantId || !permissions.current.execute || cancelled || protectedTasks)
            throw new Error('Die Aufgabe kann derzeit nicht geändert werden.');
        lock.current = true;
        setLocalBusy(true);
        setLocalError(null);
        setNotice(null);
        try {
            const result = await updateVisitTaskStatus(assignmentId, taskId, tenantId, status, profile?.roleKey, reason);
            if (!alive.current)
                return;
            if (!result.ok)
                throw new Error(result.error);
            // A policy can hide a concurrently signed/finalized task from UPDATE
            // without returning a SQL error. Confirm the persisted task itself.
            const persistedTask = result.data.tasks.find(task => task.id === taskId);
            const reasonMatches = reason === undefined ||
                persistedTask?.notDoneReason?.trim() === reason.trim();
            if (!persistedTask || persistedTask.status !== status || !reasonMatches)
                throw new Error('Die Aufgabenänderung wurde nicht übernommen. Der Einsatz wurde möglicherweise inzwischen unterschrieben oder abgeschlossen. Bitte aktualisieren Sie die Ansicht.');
            notifyWfmOfficeDataChanged(tenantId);
            await refreshAfterSave();
            if (alive.current)
                setNotice('Aufgabe gespeichert.');
        }
        catch (e) {
            if (alive.current)
                setLocalError(e instanceof Error ? e.message : 'Aufgabe konnte nicht gespeichert werden.');
            throw e;
        }
        finally {
            lock.current = false;
            if (alive.current)
                setLocalBusy(false);
        }
    };
    const statusChange = async (status: AssignmentStatus) => {
        if (lock.current || actionLoading || !permissions.current.manage || cancelled || !transitions.includes(status))
            return;
        lock.current = true;
        setLocalBusy(true);
        setLocalError(null);
        setNotice(null);
        try {
            await changeStatus(status);
            if (alive.current && tenantId)
                notifyWfmOfficeDataChanged(tenantId);
        }
        finally {
            lock.current = false;
            if (alive.current)
                setLocalBusy(false);
        }
    };
    const remove = async () => {
        if (lock.current || actionLoading || !tenantId || !permissions.current.manage)
            return;
        lock.current = true;
        setLocalBusy(true);
        setLocalError(null);
        try {
            const result = await deleteVisitDisposition(assignmentId, tenantId, profile?.roleKey, deleteScope);
            if (!alive.current)
                return;
            if (!result.ok) {
                setLocalError(result.error);
                return;
            }
            notifyWfmOfficeDataChanged(tenantId);
            setDeleted(true);
            onDeleted?.();
        }
        catch (e) {
            if (alive.current)
                setLocalError(e instanceof Error ? e.message : 'Einsatz konnte nicht gelöscht werden.');
        }
        finally {
            lock.current = false;
            if (alive.current)
                setLocalBusy(false);
        }
    };
    const renderOverview = () => <NativeDiv className="ad-grid">
    <Card title="Zeit & Ort"><NativeDl className="ad-rows"><Row label="Beginn">{date(visit.scheduledStart)}</Row><Row label="Ende">{date(visit.scheduledEnd)}</Row><Row label="Geplante Dauer">{duration(visit.durationMinutes)}</Row><Row label="Einsatzort">{visit.location === '—' ? 'Noch kein Ort hinterlegt' : visit.location}</Row>{visit.locationNotes ? <Row label="Ortshinweise">{visit.locationNotes}</Row> : null}</NativeDl></Card>
    <Card title="Stand des Einsatzes"><NativeDl className="ad-rows"><Row label="Planung">{VISIT_PLANNING_STATUS_LABELS[visit.planningStatus]}</Row><Row label="Durchführung">{VISIT_EXECUTION_STATUS_LABELS[visit.executionStatus]}</Row><Row label="Nachweis">{VISIT_PROOF_STATUS_LABELS[visit.proofStatus]}</Row><Row label="Abrechnung">{VISIT_BILLING_STATUS_LABELS[visit.billingStatus]}</Row><Row label="Budget-Vorschau">{money(visit.budget?.budgetAmountCents, visit.budget?.currency)}</Row></NativeDl>{visit.budget?.warning ? <NativeP className="aw-alert" data-tone="warning">{visit.budget.warning}</NativeP> : null}</Card>
    <Card title="Aufgaben" hint={`${visit.tasks.filter(t => t.status === 'done').length} von ${visit.tasks.length} erledigt`} className="ad-wide">{visit.tasks.length ? <NativeUl className="ad-task-summary">{visit.tasks.map(t => <NativeLi key={t.id}><NativeSpan>{t.title}{t.isRequired ? ' · Pflichtaufgabe' : ''}</NativeSpan><NativeSmall>{VISIT_TASK_STATUS_LABELS[t.status]}</NativeSmall></NativeLi>)}</NativeUl> : <NativeP className="ad-muted">Für diesen Einsatz sind noch keine Aufgaben hinterlegt.</NativeP>}</Card>
    {visit.description ? <Card title="Beschreibung" className="ad-wide"><NativeP className="ad-note">{visit.description}</NativeP></Card> : null}
    {visit.notes ? <Card title="Notizen" className="ad-wide"><NativeP className="ad-note">{visit.notes}</NativeP></Card> : null}
    {visit.employeeNotes || visit.clientVisibleNotes || visit.riskFlagKeys?.length ? <Card title="Hinweise & Risiken" className="ad-wide"><NativeDl className="ad-rows">{visit.employeeNotes ? <Row label="Für Mitarbeitende">{visit.employeeNotes}</Row> : null}{visit.clientVisibleNotes ? <Row label="Für Klient:innen">{visit.clientVisibleNotes}</Row> : null}{visit.riskFlagKeys?.length ? <Row label="Risiken">{snapshot(visit, 'riskFlagLabels', visit.riskFlagKeys.join(', '))}</Row> : null}</NativeDl></Card> : null}
    {visit.employeeInternalNotes ? <Card title="Interne Mitarbeitenden-Notiz" hint="Nur für die Verwaltung" className="ad-wide"><NativeP className="ad-note">{visit.employeeInternalNotes}</NativeP></Card> : null}
    {visit.internalPhotoReferences?.length ? <NativeDiv className="ad-wide"><VisitInternalAttachmentsPanel storagePaths={visit.internalPhotoReferences}/></NativeDiv> : null}
  </NativeDiv>;
    const renderTab = () => {
        switch (mode === 'preview' ? 'overview' : tab) {
            case 'planning': return <Card title="Planung" hint="Termin, Zuständigkeit und Leistung"><NativeDl className="ad-rows"><Row label="Planungsstatus">{VISIT_PLANNING_STATUS_LABELS[visit.planningStatus]}</Row><Row label="Leistung">{visit.serviceName ?? visit.title}</Row><Row label="Betreff">{snapshot(visit, 'subjectLabel', visit.subjectKey)}</Row><Row label="Einsatzart">{snapshot(visit, 'assignmentTypeLabel', visit.assignmentTypeKey)}</Row><Row label="Leistungskategorie">{snapshot(visit, 'serviceCategoryLabel', visit.serviceCategoryKey)}</Row><Row label="Klient:in">{visit.clientName}</Row><Row label="Mitarbeitende:r">{visit.employeeName}</Row><Row label="Beginn">{date(visit.scheduledStart)}</Row><Row label="Ende">{date(visit.scheduledEnd)}</Row><Row label="Dauer">{duration(visit.durationMinutes)}</Row><Row label="Ort">{visit.location === '—' ? 'Noch kein Ort hinterlegt' : visit.location}</Row>{visit.locationNotes ? <Row label="Ortshinweise">{visit.locationNotes}</Row> : null}<Row label="Mitarbeitendenportal">{visit.employeePortalVisible ? 'Sichtbar' : 'Nicht sichtbar'}</Row><Row label="Klient:innenportal">{VISIT_PORTAL_STATUS_LABELS[visit.portalStatus]}</Row></NativeDl></Card>;
            case 'tasks': return <>{protectedTasks ? <NativeP className="aw-alert" data-tone="info">Der Einsatz ist abgeschlossen oder bereits unterschrieben. Korrekturen erfolgen über die administrative Nachbearbeitung unter „Durchführung“.</NativeP> : null}<VisitTasksPanel visit={visit} disabled={cancelled || protectedTasks || !permissions.current.execute} actionLoading={busy} onUpdateTask={updateTask} onDirtyChange={setTaskDirty}/></>;
            case 'budget': return <Card title="Budget & Abrechnung" hint="Gespeicherte Budgetübersicht zu diesem Einsatz"><NativeDl className="ad-rows"><Row label="Abrechnungsstatus">{VISIT_BILLING_STATUS_LABELS[visit.billingStatus]}</Row><Row label="Budget-Vorschau">{money(visit.budget?.budgetAmountCents, visit.budget?.currency)}</Row>{visit.budget ? <><Row label="Bereits verwendet">{money(visit.budget.usedAmountCents, visit.budget.currency)}</Row><Row label="Verbleibend">{money(visit.budget.remainingAmountCents, visit.budget.currency)}</Row></> : null}</NativeDl>{visit.budget?.warning ? <NativeP className="aw-alert" data-tone="warning">{visit.budget.warning}</NativeP> : null}{!visit.budget ? <NativeP className="ad-muted">Es liegen noch keine Budgetdaten vor.</NativeP> : null}</Card>;
            case 'execution': return <Card title="Durchführung"><NativeDl className="ad-rows"><Row label="Status">{VISIT_EXECUTION_STATUS_LABELS[visit.executionStatus]}</Row><Row label="Unterwegs ab">{date(visit.onTheWayAt)}</Row><Row label="Angekommen">{date(visit.arrivedAt)}</Row><Row label="Begonnen">{date(visit.actualStartAt)}</Row><Row label="Beendet">{date(visit.actualEndAt)}</Row>{visit.employeeNotes ? <Row label="Hinweis">{visit.employeeNotes}</Row> : null}{visit.employeeInternalNotes ? <Row label="Interne Notiz">{visit.employeeInternalNotes}</Row> : null}{visit.documentationNotes ? <Row label="Dokumentation">{visit.documentationNotes}</Row> : null}</NativeDl>{can('assist.execution.view') && !cancelled ? <NativeButton className="aw-button aw-button--primary" disabled={busy} onClick={() => void leave(() => router.push(`/assist/assignments/${visit.id}/execute` as never))}>Durchführung öffnen</NativeButton> : null}</Card>;
            case 'proof': return <><VisitProofPreviewPanel preview={buildVisitProofPreview(visit, visit.documentationNotes)}/>{can('assist.records.view') ? <NativeDiv className="aw-actions"><NativeButton className="aw-button" disabled={busy} onClick={() => router.push('/assist/nachweise' as never)}>Zu den Leistungsnachweisen</NativeButton></NativeDiv> : null}</>;
            case 'history': return <Card title="Verlauf" hint="Gespeicherte Statusänderungen und Zeitpunkte"><NativeDl className="ad-rows"><Row label="Erstellt">{date(visit.createdAt)}</Row><Row label="Aktualisiert">{date(visit.updatedAt)}</Row><Row label="Portalstatus">{VISIT_PORTAL_STATUS_LABELS[visit.portalStatus]}</Row></NativeDl>{history.loading ? <NativeP role="status">Statusverlauf wird geladen…</NativeP> : history.error || history.refreshError ? <NativeDiv className="aw-alert" data-tone="danger" role="alert">{history.error || history.refreshError}<NativeButton className="aw-button" onClick={() => void history.refresh()}>Erneut laden</NativeButton></NativeDiv> : history.data?.length ? <NativeOl className="ad-history">{history.data.map(item => <NativeLi key={item.id}><NativeStrong>{item.dimensionLabel}: {item.fromStatusLabel ? `${item.fromStatusLabel} → ` : ''}{item.toStatusLabel}</NativeStrong><NativeTime dateTime={item.changedAt}>{date(item.changedAt)}</NativeTime>{item.note ? <NativeP className="ad-note">{item.note}</NativeP> : null}</NativeLi>)}</NativeOl> : <NativeP className="ad-muted">Noch keine Statusänderungen protokolliert.</NativeP>}</Card>;
            default: return renderOverview();
        }
    };
    return <NativeDiv className="aw-workspace ad-root" aria-busy={busy}>
    <NativeDiv className="ad-hero"><NativeDiv className="ad-eyebrow">{mode === 'preview' ? 'Einsatzvorschau' : 'Einsatzdetails'}{series ? ' · Serientermin' : ''}</NativeDiv><NativeH2>{visit.serviceName ?? visit.title}</NativeH2><NativeP>{visit.clientName} · {visit.employeeName}</NativeP><NativeDiv className="ad-badges"><NativeSpan className="ad-badge" data-tone={cancelled ? 'danger' : undefined}>{ASSIGNMENT_STATUS_LABELS[visit.assignmentStatus]}</NativeSpan>{!cancelled ? <NativeSpan className="ad-badge">{VISIT_PROOF_STATUS_LABELS[visit.proofStatus]}</NativeSpan> : null}{visit.isAtRisk && !cancelled ? <NativeSpan className="ad-badge" data-tone="warning">Planung prüfen</NativeSpan> : null}{visit.isIncomplete && !cancelled ? <NativeSpan className="ad-badge" data-tone="warning">Angaben unvollständig</NativeSpan> : null}</NativeDiv></NativeDiv>
    {cancelled ? <NativeDiv className="aw-alert" data-tone="warning">Dieser Einsatz ist abgesagt. Durchführung und Aufgabenänderungen sind gesperrt; vorhandene Informationen bleiben einsehbar.</NativeDiv> : null}
    {!manage && !permissions.current.execute ? <NativeDiv className="aw-alert" data-tone="info">Lesemodus: Sie können diesen Einsatz ansehen.</NativeDiv> : null}
    {visit.errorMessage ? <NativeDiv className="aw-alert" data-tone="danger" role="alert">{visit.errorMessage}</NativeDiv> : null}
    {localError || actionError ? <NativeDiv className="aw-alert" data-tone="danger" role="alert">{localError || actionError}</NativeDiv> : null}
    {refreshError ? <NativeDiv className="aw-alert" data-tone="warning" role="alert">Die Aktualisierung konnte nicht bestätigt werden. {refreshError}<NativeButton className="aw-button" disabled={busy} onClick={() => void refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
    {notice || successMessage ? <NativeDiv className="aw-alert" data-tone="success" role="status">{notice || successMessage}</NativeDiv> : null}
    {mode === 'full' ? <NativeDiv className="ad-tabs" role="tablist" aria-label="Einsatzbereiche">{TABS.map(([key, label], i) => <NativeButton type="button" key={key} role="tab" id={`${tabId}-${key}`} aria-controls={`${tabId}-panel`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} onClick={() => void leave(() => setTab(key))} onKeyDown={event => {
                    let next: number | undefined;
                    if (event.key === 'ArrowRight')
                        next = (i + 1) % TABS.length;
                    if (event.key === 'ArrowLeft')
                        next = (i - 1 + TABS.length) % TABS.length;
                    if (event.key === 'Home')
                        next = 0;
                    if (event.key === 'End')
                        next = TABS.length - 1;
                    if (next !== undefined) {
                        event.preventDefault();
                        const target = event.currentTarget.parentElement?.children[next] as HTMLElement;
                        const targetKey = TABS[next]![0];
                        void leave(() => { setTab(targetKey); target?.focus(); });
                    }
                }}>{label}</NativeButton>)}</NativeDiv> : null}
    <NativeDiv className="ad-content" id={`${tabId}-panel`} role={mode === 'full' ? 'tabpanel' : undefined} aria-labelledby={mode === 'full' ? `${tabId}-${tab}` : undefined} tabIndex={mode === 'full' ? 0 : undefined}>{renderTab()}</NativeDiv>
    {mode === 'full' && manage && !cancelled ? <Card title="Status ändern" hint="Verfügbare Schritte für den aktuellen Einsatzstatus">{transitions.length ? <NativeDiv className="aw-actions">{transitions.map(status => <NativeButton className={`aw-button${status === 'storniert' ? ' aw-button--danger' : ''}`} key={status} disabled={busy || taskDirty} onClick={() => void statusChange(status)}>{ASSIGNMENT_STATUS_LABELS[status]}</NativeButton>)}</NativeDiv> : <NativeP className="ad-muted">Für den aktuellen Stand sind keine weiteren Statuswechsel vorgesehen.</NativeP>}</Card> : null}
    {deleting && manage ? <NativeDiv className="ad-delete" role="group" aria-label="Einsatz löschen bestätigen"><NativeStrong>{visit.clientName}: Einsatz endgültig löschen?</NativeStrong><NativeP>Diese Aktion kann nicht rückgängig gemacht werden.</NativeP>{series ? <NativeLabel>Löschbereich<NativeSelect className="aw-select" disabled={busy} value={deleteScope} onChange={e => setDeleteScope(e.target.value as VisitSeriesMutationScope)}><NativeOption value="this_only">Nur dieser Termin</NativeOption><NativeOption value="this_and_following">Dieser und folgende Termine</NativeOption></NativeSelect><NativeSpan className="aw-hint">{deleteScope === 'this_only' ? 'Andere Termine der Serie bleiben bestehen.' : 'Der gewählte Termin und folgende Termine werden gelöscht. Vorhandene Schutzregeln werden geprüft.'}</NativeSpan></NativeLabel> : null}<NativeDiv className="aw-actions"><NativeButton className="aw-button aw-button--danger" disabled={busy} onClick={() => void remove()}>{busy ? 'Wird gelöscht…' : 'Endgültig löschen'}</NativeButton><NativeButton className="aw-button" disabled={busy} onClick={() => setDeleting(false)}>Abbrechen</NativeButton></NativeDiv></NativeDiv> : null}
    <NativeDiv className="ad-toolbar">{mode === 'preview' && onOpenFullRecord ? <NativeButton className="aw-button aw-button--primary" disabled={busy} onClick={() => void leave(() => onOpenFullRecord())}>Vollständig öffnen</NativeButton> : null}{manage ? <NativeButton className="aw-button" disabled={busy} onClick={() => void leave(() => onEdit ? onEdit(visit) : router.push(`/assist/assignments/${visit.id}/edit` as never))}>Bearbeiten</NativeButton> : null}{mode === 'preview' && manage && !cancelled && transitions.includes('bestaetigt') ? <NativeButton className="aw-button" disabled={busy || taskDirty} onClick={() => void statusChange('bestaetigt')}>Freigeben</NativeButton> : null}{can('assist.execution.view') && !cancelled ? <NativeButton className="aw-button" disabled={busy} onClick={() => void leave(() => router.push(`/assist/assignments/${visit.id}/execute` as never))}>Durchführung öffnen</NativeButton> : null}<NativeButton className="aw-button aw-button--quiet" disabled={busy} onClick={() => void leave(() => { void refresh(); })}>Aktualisieren</NativeButton>{manage ? <NativeButton className="aw-button aw-button--danger" disabled={busy || deleting} onClick={() => void leave(() => { setTab('overview'); setTaskDirty(false); setDeleting(true); })}>Einsatz löschen</NativeButton> : null}{onClose ? <NativeButton className="aw-button aw-button--quiet" disabled={busy} onClick={() => void leave(onClose)}>Schließen</NativeButton> : null}</NativeDiv>
  </NativeDiv>;
}
