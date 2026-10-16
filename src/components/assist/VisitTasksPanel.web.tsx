import { AssignmentDetailStyles } from '@/components/assist/AssignmentDetailStyles.web';
import { useEffect, useRef, useState } from 'react';
import { useAsyncQuery } from '@/hooks/core';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { loadCatalogItems } from '@/lib/assistCatalog';
import type { VisitDispositionDetail, VisitTaskStatus } from '@/lib/assist/visitTypes';
import { VISIT_TASK_STATUS_LABELS } from '@/lib/assist/visitTypes';
import { AssignmentsWorkspaceStyles } from '@/components/assist/AssignmentsWorkspaceShell.web';
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
    const begin = (id: string, current: VisitTaskStatus) => { if (blocked || lock.current)
        return; setEditing(id); setStatus(current === 'open' ? 'done' : current); setReasonKey(''); setReason(''); setError(null); };
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
    return <section className="aw-panel ad-card"><AssignmentsWorkspaceStyles /><AssignmentDetailStyles /><header><h3>Aufgaben</h3><p>{visit.tasks.filter(t => t.status === 'done').length} von {visit.tasks.length} erledigt</p></header>{!visit.tasks.length ? <p className="ad-muted">Keine Aufgaben hinterlegt.</p> : visit.tasks.map(task => <div className="ad-task" key={task.id}><div className="ad-task-head"><strong>{task.title}</strong><span className="ad-badge">{VISIT_TASK_STATUS_LABELS[task.status]}</span></div>{task.isRequired ? <span className="ad-muted">Pflichtaufgabe</span> : null}{task.notDoneReason ? <p className="ad-note">Begründung: {task.notDoneReason}</p> : null}{!disabled && editing !== task.id ? <div><button className="aw-button aw-button--quiet" disabled={blocked} onClick={() => begin(task.id, task.status)} aria-label={`${task.title}: Status bearbeiten`}>Status bearbeiten</button></div> : null}{editing === task.id && !disabled ? <div className="ad-task-form"><label className="aw-field"><span className="aw-label">Aufgabenstatus</span><select className="aw-select" value={status} disabled={blocked} onChange={e => setStatus(e.target.value as VisitTaskStatus)}>{STATUSES.map(s => <option key={s} value={s}>{VISIT_TASK_STATUS_LABELS[s]}</option>)}</select></label>{needsReason ? <>{catalog.loading ? <p className="ad-muted" role="status">Auswahlgründe werden geladen…</p> : null}{catalog.error ? <p className="aw-hint">Auswahlgründe sind gerade nicht verfügbar. Sie können den Grund unten eingeben.</p> : null}<label className="aw-field"><span className="aw-label">Grund</span><select className="aw-select" value={reasonKey} disabled={blocked} onChange={e => setReasonKey(e.target.value)}><option value="">Eigene Begründung</option>{options.map(option => <option key={option.id} value={option.itemKey}>{option.label}</option>)}</select></label><label className="aw-field"><span className="aw-label">{needsText ? 'Begründung (erforderlich)' : 'Ergänzende Notiz (optional)'}</span><textarea className="aw-input" value={reason} disabled={blocked} required={needsText} onChange={e => setReason(e.target.value)} placeholder="Bitte kurz und nachvollziehbar beschreiben…"/></label></> : null}{error ? <p className="aw-alert" data-tone="danger" role="alert">{error}</p> : null}<div className="aw-actions"><button className="aw-button aw-button--primary" disabled={blocked || (needsReason && needsText && !reason.trim())} onClick={() => void save()}>{busy ? 'Wird gespeichert…' : 'Aufgabe speichern'}</button><button className="aw-button" disabled={blocked} onClick={() => { setEditing(null); setError(null); }}>Abbrechen</button></div></div> : null}</div>)}</section>;
}
