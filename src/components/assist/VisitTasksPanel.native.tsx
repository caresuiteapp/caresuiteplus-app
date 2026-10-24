// Generated native presentation from src/components/assist/VisitTasksPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeHeader,NativeH3,NativeP,NativeDiv,NativeStrong,NativeSpan,NativeButton,NativeLabel,NativeSelect,NativeOption,NativeTextarea} from '@/components/layout/NativeWorkspaceElements.native';
import { AssignmentDetailStyles } from "./AssignmentDetailStyles.native.tsx";
import { useEffect, useRef, useState } from 'react';
import { useAsyncQuery } from '@/hooks/core';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { loadCatalogItems } from '@/lib/assistCatalog';
import type { VisitDispositionDetail, VisitTaskStatus } from '@/lib/assist/visitTypes';
import { VISIT_TASK_STATUS_LABELS } from '@/lib/assist/visitTypes';
import { AssignmentsWorkspaceStyles } from "./AssignmentsWorkspaceShell.native.tsx";
const STATUSES: VisitTaskStatus[] = ['done', 'partial', 'not_requested', 'not_possible', 'cancelled', 'deferred', 'open'];
const NEEDS_REASON = new Set<VisitTaskStatus>(['partial', 'not_requested', 'not_possible', 'cancelled', 'deferred']);
type Props = {
    visit: VisitDispositionDetail;
    disabled?: boolean;
    actionLoading?: boolean;
    onDirtyChange?: (dirty: boolean) => void;
    onUpdateTask: (taskId: string, status: VisitTaskStatus, notDoneReason?: string, notCompletedReasonKey?: string) => Promise<void>;
};
export function VisitTasksPanel(props: Props) { const tenant = useServiceTenantId(); const { profile } = useAuth(); return <Tasks key={`${tenant}:${profile?.id}:${props.visit.id}`} {...props}/>; }
function Tasks({ visit, disabled = false, actionLoading = false, onUpdateTask, onDirtyChange }: Props) {
    const tenant = useServiceTenantId();
    const { profile } = useAuth();
    const [editing, setEditing] = useState<string | null>(null);
    const [status, setStatus] = useState<VisitTaskStatus>('done');
    const [reasonKey, setReasonKey] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lock = useRef(false);
    const alive = useRef(true);
    const allowed = useRef(!disabled);
    allowed.current = !disabled;
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { onDirtyChange?.(editing !== null); }, [editing, onDirtyChange]);
    useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
    const catalog = useAsyncQuery(() => tenant ? loadCatalogItems(tenant, 'assist.task.not_completed_reasons', {}, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Unternehmen ausgewählt.' }), [tenant, profile?.id, profile?.roleKey], { enabled: !!tenant && !disabled, queryKey: JSON.stringify([tenant, profile?.id, profile?.roleKey]) });
    const options = catalog.data ?? [];
    const needsReason = NEEDS_REASON.has(status);
    const needsText = !reasonKey || reasonKey === 'sonstiger_grund';
    const blocked = disabled || busy || actionLoading;
    const begin = (id: string, current: VisitTaskStatus) => {
        if (blocked || lock.current)
            return;
        setEditing(id);
        setStatus(current === 'open' ? 'done' : current);
        setReasonKey('');
        setReason('');
        setError(null);
    };
    const save = async () => {
        if (!editing || lock.current || blocked || !allowed.current)
            return;
        const selected = options.find(item => item.itemKey === reasonKey);
        const text = needsReason ? (needsText ? reason.trim() : [selected?.label, reason.trim()].filter(Boolean).join(' — ')) : undefined;
        if (needsReason && !text) {
            setError('Bitte einen Grund auswählen oder kurz beschreiben.');
            return;
        }
        lock.current = true;
        setBusy(true);
        setError(null);
        try {
            await onUpdateTask(editing, status, text, needsReason ? reasonKey || undefined : undefined);
            if (alive.current && allowed.current) {
                setEditing(null);
                setReason('');
                setReasonKey('');
            }
        }
        catch (e) {
            if (alive.current)
                setError(e instanceof Error ? e.message : 'Aufgabe konnte nicht gespeichert werden. Ihre Eingabe bleibt erhalten.');
        }
        finally {
            lock.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    return <NativeSection className="aw-panel ad-card"><AssignmentsWorkspaceStyles /><AssignmentDetailStyles /><NativeHeader><NativeH3>Aufgaben</NativeH3><NativeP>{visit.tasks.filter(t => t.status === 'done').length} von {visit.tasks.length} erledigt</NativeP></NativeHeader>{!visit.tasks.length ? <NativeP className="ad-muted">Keine Aufgaben hinterlegt.</NativeP> : visit.tasks.map(task => <NativeDiv className="ad-task" key={task.id}><NativeDiv className="ad-task-head"><NativeStrong>{task.title}</NativeStrong><NativeSpan className="ad-badge">{VISIT_TASK_STATUS_LABELS[task.status]}</NativeSpan></NativeDiv>{task.isRequired ? <NativeSpan className="ad-muted">Pflichtaufgabe</NativeSpan> : null}{task.notDoneReason ? <NativeP className="ad-note">Begründung: {task.notDoneReason}</NativeP> : null}{!disabled && editing !== task.id ? <NativeDiv><NativeButton className="aw-button aw-button--quiet" disabled={blocked} onClick={() => begin(task.id, task.status)} aria-label={`${task.title}: Status bearbeiten`}>Status bearbeiten</NativeButton></NativeDiv> : null}{editing === task.id && !disabled ? <NativeDiv className="ad-task-form"><NativeLabel className="aw-field"><NativeSpan className="aw-label">Aufgabenstatus</NativeSpan><NativeSelect className="aw-select" value={status} disabled={blocked} onChange={e => setStatus(e.target.value as VisitTaskStatus)}>{STATUSES.map(s => <NativeOption key={s} value={s}>{VISIT_TASK_STATUS_LABELS[s]}</NativeOption>)}</NativeSelect></NativeLabel>{needsReason ? <>{catalog.loading ? <NativeP className="ad-muted" role="status">Auswahlgründe werden geladen…</NativeP> : null}{catalog.error ? <NativeP className="aw-hint">Auswahlgründe sind gerade nicht verfügbar. Sie können den Grund unten eingeben.</NativeP> : null}<NativeLabel className="aw-field"><NativeSpan className="aw-label">Grund</NativeSpan><NativeSelect className="aw-select" value={reasonKey} disabled={blocked} onChange={e => setReasonKey(e.target.value)}><NativeOption value="">Eigene Begründung</NativeOption>{options.map(option => <NativeOption key={option.id} value={option.itemKey}>{option.label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="aw-field"><NativeSpan className="aw-label">{needsText ? 'Begründung (erforderlich)' : 'Ergänzende Notiz (optional)'}</NativeSpan><NativeTextarea className="aw-input" value={reason} disabled={blocked} required={needsText} onChange={e => setReason(e.target.value)} placeholder="Bitte kurz und nachvollziehbar beschreiben…"/></NativeLabel></> : null}{error ? <NativeP className="aw-alert" data-tone="danger" role="alert">{error}</NativeP> : null}<NativeDiv className="aw-actions"><NativeButton className="aw-button aw-button--primary" disabled={blocked || (needsReason && needsText && !reason.trim())} onClick={() => void save()}>{busy ? 'Wird gespeichert…' : 'Aufgabe speichern'}</NativeButton><NativeButton className="aw-button" disabled={blocked} onClick={() => { setEditing(null); setError(null); }}>Abbrechen</NativeButton></NativeDiv></NativeDiv> : null}</NativeDiv>)}</NativeSection>;
}
