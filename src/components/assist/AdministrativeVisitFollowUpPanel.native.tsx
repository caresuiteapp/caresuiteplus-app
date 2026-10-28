// Generated native presentation from src/components/assist/AdministrativeVisitFollowUpPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeStyle,NativeDiv,NativeButton,NativeFieldset,NativeHeader,NativeH3,NativeSpan,NativeP,NativeLabel,NativeInput,NativeStrong,NativeSelect,NativeOption,NativeDetails,NativeSummary,NativeTextarea,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { documentationBlockAlreadyStored, mergeAdministrativeTaskDrafts } from '@/lib/assist/administrativeFollowUpState';
import { appendAdministrativeDocumentation, bulkUpdateAdministrativeTasks, completeAdministrativeFollowUp, correctAdministrativeVisitTimes, requestClientVisitSignature, validateAdministrativeTimes } from '@/lib/assist/administrativeVisitService';
import { fetchAdministrativeMinutes } from "../../lib/assist/administrativeMinutes.native.ts";
import { notifyWfmOfficeDataChanged } from '@/lib/wfm/wfmOfficeDataChanged';
import type { VisitDispositionDetail, VisitTaskStatus } from '@/lib/assist/visitTypes';
import { VISIT_TASK_STATUS_LABELS } from '@/lib/assist/visitTypes';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { useAssistDocumentationBlocks } from '@/hooks/assistCatalog/useAssistCatalog';
import { berlinDateTimeInput } from '@/lib/employeeLogbook/employeeLogbookDate';
import { berlinTimestamp } from '@/lib/calendar/employeeMonthPlanning';
import { useAssignmentFormGuard } from "./AssignmentFormControls.native.tsx";
type Props = {
    visit: VisitDispositionDetail;
    tenantId: string;
    onSaved: () => Promise<void>;
    onMessage: (message: string, error?: boolean) => void;
    onTaskDraftsChange?: (drafts: Record<string, VisitTaskStatus>) => void;
    onStateChange?: (state: {
        dirty: boolean;
        busy: boolean;
    }) => void;
};
type Times = {
    start: string;
    end: string;
    way: string;
    arrived: string;
    pause: string;
    travel: string;
};
const css = `
.aex-followup{display:grid;gap:20px;min-width:0;container-type:inline-size}.aex-followup fieldset{margin:0;padding:0;border:0;min-width:0;display:grid;gap:18px}.aex-followup fieldset:disabled{opacity:.68}.aex-followup h2,.aex-followup h3,.aex-followup p{margin:0}.aex-followup .aw-panel{display:grid;gap:16px;min-width:0}.aex-panel-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.aex-panel-head h3{font-size:18px;letter-spacing:-.3px;color:#163955}.aex-step{height:30px;width:30px;display:inline-grid;place-items:center;margin-right:9px;border:1px solid #c8ddf4;background:#edf6ff;border-radius:10px;color:#2467b3;font-size:13px;vertical-align:middle}.aex-timefields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.aex-timefields .aw-field{min-width:0}.aex-tasklist{display:grid;gap:9px}.aex-taskrow{display:flex;gap:16px;align-items:center;justify-content:space-between;padding:13px 15px;border:1px solid #d9e6f0;border-radius:14px;background:#ffffffbd;min-width:0}.aex-taskrow[data-dirty=true]{border-color:#86b6eb;background:#f2f8ff}.aex-taskname{min-width:0;flex:1;font-weight:650;overflow-wrap:anywhere}.aex-taskmeta{display:block;font-size:12px;font-weight:400;color:#58748b;margin-top:3px}.aex-taskrow select{width:205px;max-width:100%}.aex-doc{min-height:145px;resize:vertical;line-height:1.7}.aex-stored{padding:15px;border:1px solid #dce7ee;border-radius:13px;background:#f6f9fc;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.7}.aex-followup details summary{cursor:pointer;color:#325877;font-weight:650;padding:6px 0}.aex-followup details[open] summary{margin-bottom:10px}.aex-completion{border:1px solid #bdd5f1!important;background:linear-gradient(120deg,#eff7ff,#fff)!important}.aex-completion-list{display:flex;flex-wrap:wrap;gap:8px}.aex-completion-list span{font-size:12px;color:#45617b;border:1px solid #d7e3ed;border-radius:99px;padding:5px 10px;background:#fff}.aex-completion-list span[data-ready=true]{color:#217357;border-color:#c0e6d6;background:#f2faf6}
@container(max-width:560px){.aex-timefields{grid-template-columns:1fr}.aex-taskrow{align-items:stretch;flex-direction:column;gap:8px}.aex-taskrow select{width:100%}.aex-followup .aw-actions>*{flex-grow:1}}
`.replace(/font-size:(\d+(?:\.\d+)?)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
function localDateTime(iso?: string | null) { return iso ? berlinDateTimeInput(iso) : ''; }
function toIso(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
        return null;
    try {
        const iso = berlinTimestamp(value.slice(0, 10), value.slice(11));
        return localDateTime(iso) === value ? iso : null;
    }
    catch {
        return null;
    }
}
function visitTimes(visit: VisitDispositionDetail): Omit<Times, 'pause' | 'travel'> {
    return { start: localDateTime(visit.actualStartAt ?? visit.scheduledStart), end: localDateTime(visit.actualEndAt ?? visit.scheduledEnd), way: localDateTime(visit.onTheWayAt), arrived: localDateTime(visit.arrivedAt) };
}
/** Remount every draft and async operation when the record, company, actor or permission changes. */
export function AdministrativeVisitFollowUpPanel(props: Props) {
    const { profile } = useAuth();
    const { can, roleKey } = usePermissions();
    const allowed = Boolean(roleKey && !isPortalOnlyRole(roleKey) && can('assist.assignments.view') && can('assist.execution.manage') && props.visit.tenantId === props.tenantId);
    const scope = JSON.stringify([props.tenantId, props.visit.id, profile?.id, profile?.roleKey, roleKey, allowed]);
    return <NativeWorkspaceStyleScope key={scope} css={[css]}>{<FollowUpEditor key={scope} {...props} allowed={allowed}/>}</NativeWorkspaceStyleScope>;
}
function FollowUpEditor({ visit, tenantId, onSaved, onMessage, onTaskDraftsChange, onStateChange, allowed }: Props & {
    allowed: boolean;
}) {
    const { profile } = useAuth();
    const { blocks } = useAssistDocumentationBlocks();
    const mounted = useRef(true);
    const locked = useRef(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{
        text: string;
        error: boolean;
    } | null>(null);
    const [needsReload, setNeedsReload] = useState(false);
    const [times, setTimes] = useState<Times>(() => ({ ...visitTimes(visit), pause: '', travel: '' }));
    const baseline = useRef<Times>({ ...visitTimes(visit), pause: '', travel: '' });
    const [minutesLoading, setMinutesLoading] = useState(true);
    const [minutesError, setMinutesError] = useState<string | null>(null);
    const minutesGeneration = useRef(0);
    const [documentation, setDocumentation] = useState('');
    const savedDocumentation = useRef<string | null>(null);
    const [taskDrafts, setTaskDrafts] = useState<Record<string, VisitTaskStatus>>(() => Object.fromEntries(visit.tasks.map(task => [task.id, task.status])));
    const previousTasks = useRef(Object.fromEntries(visit.tasks.map(task => [task.id, task.status])));
    const [overlap, setOverlap] = useState(false);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; minutesGeneration.current++; }; }, []);
    const report = (text: string, error = false) => { if (mounted.current) {
        setMessage({ text, error });
        onMessage(text, error);
    } };
    const loadMinutes = useCallback(async () => {
        if (!allowed) {
            setMinutesLoading(false);
            return;
        }
        const generation = ++minutesGeneration.current;
        setMinutesLoading(true);
        setMinutesError(null);
        const result = await fetchAdministrativeMinutes(tenantId, visit.id, visit.assignmentStatus, profile?.roleKey);
        if (!mounted.current || generation !== minutesGeneration.current)
            return;
        if (result.ok) {
            const previous = baseline.current;
            setTimes(current => ({ ...current, pause: current.pause === previous.pause ? result.data.pause : current.pause, travel: current.travel === previous.travel ? result.data.travel : current.travel }));
            baseline.current = { ...baseline.current, ...result.data };
        }
        else
            setMinutesError(result.error);
        setMinutesLoading(false);
    }, [allowed, tenantId, visit.id, visit.assignmentStatus, profile?.roleKey]);
    useEffect(() => { void loadMinutes(); }, [loadMinutes, visit.updatedAt]);
    const incomingTimes = JSON.stringify(visitTimes(visit));
    useEffect(() => {
        const incoming = JSON.parse(incomingTimes) as Omit<Times, 'pause' | 'travel'>;
        const previous = baseline.current;
        setTimes(current => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, key in incoming && value === previous[key as keyof Times] ? incoming[key as keyof typeof incoming] : value])) as Times);
        baseline.current = { ...previous, ...incoming };
    }, [incomingTimes]);
    const taskSnapshot = JSON.stringify(visit.tasks.map(task => [task.id, task.status]));
    useEffect(() => {
        const next = JSON.parse(taskSnapshot).map(([id, status]: [
            string,
            VisitTaskStatus
        ]) => ({ id, status })) as VisitDispositionDetail['tasks'];
        const previous = previousTasks.current;
        setTaskDrafts(current => mergeAdministrativeTaskDrafts(previous, next, current));
        previousTasks.current = Object.fromEntries(next.map(task => [task.id, task.status]));
    }, [taskSnapshot]);
    useEffect(() => { onTaskDraftsChange?.(taskDrafts); }, [onTaskDraftsChange, taskDrafts]);
    const changes = useMemo(() => visit.tasks.filter(task => (taskDrafts[task.id] ?? task.status) !== task.status).map(task => ({ taskId: task.id, status: taskDrafts[task.id] ?? task.status })), [taskDrafts, visit.tasks]);
    const timesDirty = (Object.keys(times) as (keyof Times)[]).some(key => times[key] !== baseline.current[key]);
    const dirty = timesDirty || Boolean(documentation.trim()) || changes.length > 0;
    useAssignmentFormGuard(dirty, busy);
    useEffect(() => { onStateChange?.({ dirty, busy }); }, [dirty, busy, onStateChange]);
    const disabled = !allowed || busy || needsReload;
    const signed = Boolean(visit.persistedSignature) || visit.proofStatus === 'signed' || visit.proofStatus === 'verified';
    const requiredOpen = visit.tasks.filter(task => task.isRequired && (taskDrafts[task.id] ?? task.status) === 'open').length;
    const changeTime = (key: keyof Times, value: string) => { if (locked.current)
        return; setTimes(current => ({ ...current, [key]: value })); setOverlap(false); };
    const start = toIso(times.start), end = toIso(times.end);
    const netMinutes = start && end && /^\d+$/.test(times.pause) ? Math.round((Date.parse(end) - Date.parse(start)) / 60000) - Number(times.pause) : null;
    const run = async (operation: () => Promise<{
        ok: boolean;
        error?: string;
    }>, success: string, committed?: () => void) => {
        if (!mounted.current || locked.current || !allowed || needsReload)
            return;
        locked.current = true;
        setBusy(true);
        setMessage(null);
        onStateChange?.({ dirty: true, busy: true });
        let stored = false;
        try {
            const result = await operation();
            if (!mounted.current)
                return;
            if (!result.ok) {
                report(result.error ?? 'Die Änderung konnte nicht gespeichert werden.', true);
                return;
            }
            stored = true;
            committed?.();
            notifyWfmOfficeDataChanged(tenantId);
            await onSaved();
            if (!mounted.current)
                return;
            report(success);
        }
        catch {
            if (!mounted.current)
                return;
            if (stored)
                setNeedsReload(true);
            report(stored ? 'Änderung gespeichert. Der aktuelle Stand konnte noch nicht geladen werden. Bitte erst die Einsatzakte erneut laden.' : 'Speichern fehlgeschlagen. Ihre Eingaben bleiben erhalten.', true);
        }
        finally {
            if (mounted.current) {
                locked.current = false;
                setBusy(false);
            }
        }
    };
    const reload = async () => {
        if (locked.current)
            return;
        locked.current = true;
        setBusy(true);
        try {
            await onSaved();
            if (mounted.current) {
                setNeedsReload(false);
                report('Der gespeicherte Stand wurde geladen.');
            }
        }
        catch {
            report('Die Einsatzakte konnte noch nicht geladen werden. Bitte erneut versuchen.', true);
        }
        finally {
            if (mounted.current) {
                locked.current = false;
                setBusy(false);
            }
        }
    };
    const saveTimes = async () => {
        if (minutesLoading || minutesError)
            return;
        if (!start || !end || (times.way && !toIso(times.way)) || (times.arrived && !toIso(times.arrived))) {
            report('Bitte gültige Datums- und Uhrzeitangaben eingeben.', true);
            return;
        }
        if (!/^\d+$/.test(times.pause) || !/^\d+$/.test(times.travel) || !Number.isSafeInteger(Number(times.pause)) || !Number.isSafeInteger(Number(times.travel))) {
            report('Pause und Fahrzeit bitte als ganze, nicht negative Minuten eingeben.', true);
            return;
        }
        const input = { onTheWayAt: toIso(times.way), arrivedAt: toIso(times.arrived), startedAt: start, endedAt: end, pauseMinutes: Number(times.pause), travelMinutes: Number(times.travel), confirmOverlap: overlap };
        const invalid = validateAdministrativeTimes(input);
        if (invalid) {
            report(invalid, true);
            return;
        }
        await run(async () => {
            const result = await correctAdministrativeVisitTimes(visit.id, input);
            if (!mounted.current)
                return { ok: false };
            if (!result.ok)
                return result;
            if (result.data.overlap) {
                setOverlap(true);
                return { ok: false, error: 'Die Zeit überschneidet sich mit einem anderen Einsatz. Bitte prüfen und nur bei korrekten Angaben bestätigen.' };
            }
            setOverlap(false);
            return { ok: true };
        }, 'Arbeitszeit gespeichert und Zeitkonten aktualisiert.', () => { baseline.current = { ...times }; });
    };
    const saveDocumentation = async () => {
        const content = documentation.trim();
        if (!content)
            return;
        if (savedDocumentation.current === content || documentationBlockAlreadyStored(visit.documentationNotes, content)) {
            report('Dieser Abschnitt ist bereits gespeichert. Er wird nicht doppelt angehängt.');
            return;
        }
        await run(() => appendAdministrativeDocumentation(visit.id, content), 'Dokumentation gespeichert.', () => { savedDocumentation.current = content; setDocumentation(''); });
    };
    const ensureSavedInputs = () => {
        if (documentation.trim()) {
            report('Bitte die neue Dokumentation zuerst speichern oder verwerfen.', true);
            return false;
        }
        if (timesDirty) {
            report('Bitte die geänderten Zeiten zuerst speichern oder zurücksetzen.', true);
            return false;
        }
        return true;
    };
    const requestSignature = async () => {
        if (!ensureSavedInputs())
            return;
        if (changes.length) {
            report('Bitte die vorgemerkten Aufgaben zuerst speichern.', true);
            return;
        }
        if (signed)
            return;
        await run(() => requestClientVisitSignature(tenantId, visit), 'Unterschrift im Klientenportal angefordert. Bis zur Unterschrift bleibt die Abrechnung gesperrt.');
    };
    const complete = async () => {
        if (!ensureSavedInputs())
            return;
        if (requiredOpen) {
            report('Bitte die offenen Pflichtaufgaben zuerst prüfen.', true);
            return;
        }
        await run(() => completeAdministrativeFollowUp(visit.id, visit.tasks.map(task => ({ taskId: task.id, status: taskDrafts[task.id] ?? task.status }))), signed ? 'Nachbearbeitung abgeschlossen.' : 'Nachbearbeitung gespeichert. Die Unterschrift steht noch aus; die Abrechnung bleibt gesperrt.');
    };
    return <NativeWorkspaceStyleScope css={[css, css]}>{<NativeSection className="aex-followup" aria-label="Nachbearbeitung"><NativeStyle>{css}</NativeStyle>
    {!allowed ? <NativeDiv className="aw-alert" data-tone="warning">Sie haben keine Berechtigung zur Nachbearbeitung dieses Einsatzes.</NativeDiv> : null}
    {message ? <NativeDiv className="aw-alert" role={message.error ? 'alert' : 'status'} data-tone={message.error ? 'warning' : 'success'}>{message.text}</NativeDiv> : null}
    {needsReload ? <NativeButton type="button" className="aw-button" disabled={busy} onClick={reload}>Gespeicherten Stand erneut laden</NativeButton> : null}
    <NativeFieldset disabled={disabled}>
      <NativeSection className="aw-panel" id="execution-times"><NativeHeader className="aex-panel-head"><NativeDiv><NativeH3><NativeSpan className="aex-step">1</NativeSpan>Arbeitszeit prüfen</NativeH3><NativeP className="aw-hint">Zeiten gelten für Deutschland. Änderungen werden nachvollziehbar protokolliert.</NativeP></NativeDiv>{timesDirty ? <NativeSpan className="aw-chip">Ungespeichert</NativeSpan> : null}</NativeHeader>
        <NativeDiv className="aex-timefields">{([['start', 'Einsatzbeginn'], ['end', 'Einsatzende'], ['way', 'Unterwegs seit (optional)'], ['arrived', 'Angekommen (optional)']] as const).map(([key, label]) => <NativeLabel className="aw-field" key={key}><NativeSpan className="aw-label">{label}</NativeSpan><NativeInput className="aw-input" type="datetime-local" step="60" value={times[key]} onChange={event => changeTime(key, event.target.value)}/></NativeLabel>)}
          {([['pause', 'Pause in Minuten'], ['travel', 'Fahrzeit in Minuten']] as const).map(([key, label]) => <NativeLabel className="aw-field" key={key}><NativeSpan className="aw-label">{label}</NativeSpan><NativeInput className="aw-input" type="number" min="0" step="1" inputMode="numeric" value={times[key]} disabled={minutesLoading || Boolean(minutesError)} onChange={event => changeTime(key, event.target.value)}/></NativeLabel>)}
        </NativeDiv>
        {minutesLoading ? <NativeP className="aw-hint" role="status">Gespeicherte Pausen- und Fahrzeiten werden geladen…</NativeP> : minutesError ? <NativeDiv className="aw-alert" data-tone="warning" role="alert">{minutesError}<NativeButton type="button" className="aw-button" onClick={loadMinutes}>Minutenwerte erneut laden</NativeButton></NativeDiv> : null}
        {netMinutes != null && netMinutes >= 0 ? <NativeP className="aw-hint">Arbeitszeit ohne Pause: <NativeStrong>{netMinutes} Minuten</NativeStrong>. Fahrzeit wird getrennt erfasst.</NativeP> : null}
        {overlap ? <NativeDiv className="aw-alert" data-tone="warning">Zeitüberschneidung: Eine erneute Buchung bestätigt diese Korrektur ausdrücklich.</NativeDiv> : null}
        <NativeDiv className="aw-actions"><NativeButton type="button" className="aw-button aw-button--primary" disabled={minutesLoading || Boolean(minutesError)} onClick={saveTimes}>{overlap ? 'Überschneidung bestätigen und buchen' : 'Zeiten prüfen und buchen'}</NativeButton><NativeButton type="button" className="aw-button aw-button--quiet" disabled={!timesDirty} onClick={() => { setTimes({ ...baseline.current }); setOverlap(false); }}>Zeiten zurücksetzen</NativeButton></NativeDiv>
      </NativeSection>
      <NativeSection className="aw-panel" id="execution-tasks"><NativeHeader className="aex-panel-head"><NativeDiv><NativeH3><NativeSpan className="aex-step">2</NativeSpan>Aufgaben abgleichen</NativeH3><NativeP className="aw-hint">{changes.length ? `${changes.length} Änderungen vorgemerkt · noch nicht gespeichert.` : 'Die Aufgaben zeigen den gespeicherten Stand.'}</NativeP></NativeDiv><NativeSpan className="aw-chip">{visit.tasks.filter(task => (taskDrafts[task.id] ?? task.status) !== 'open').length} / {visit.tasks.length}</NativeSpan></NativeHeader>
        {visit.tasks.length ? <><NativeDiv className="aw-actions"><NativeButton type="button" className="aw-button" onClick={() => setTaskDrafts(Object.fromEntries(visit.tasks.map(task => [task.id, 'done'])))}>Alle erledigt</NativeButton><NativeButton type="button" className="aw-button" onClick={() => setTaskDrafts(Object.fromEntries(visit.tasks.map(task => [task.id, 'not_requested'])))}>Alle nicht gewünscht</NativeButton><NativeButton type="button" className="aw-button aw-button--quiet" disabled={!changes.length} onClick={() => setTaskDrafts(Object.fromEntries(visit.tasks.map(task => [task.id, task.status])))}>Auswahl zurücksetzen</NativeButton></NativeDiv>
          <NativeDiv className="aex-tasklist">{visit.tasks.map(task => <NativeLabel className="aex-taskrow" key={task.id} data-dirty={(taskDrafts[task.id] ?? task.status) !== task.status}><NativeSpan className="aex-taskname">{task.title}<NativeSpan className="aex-taskmeta">{task.isRequired ? 'Pflichtaufgabe' : 'Optionale Aufgabe'}{(taskDrafts[task.id] ?? task.status) !== task.status ? ' · Änderung vorgemerkt' : ''}{task.notDoneReason ? ` · ${task.notDoneReason}` : ''}</NativeSpan></NativeSpan><NativeSelect className="aw-select" aria-label={`${task.title} – Status`} value={taskDrafts[task.id] ?? task.status} onChange={event => setTaskDrafts(current => ({ ...current, [task.id]: event.target.value as VisitTaskStatus }))}>{Object.entries(VISIT_TASK_STATUS_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel>)}</NativeDiv>
          <NativeDiv className="aw-actions"><NativeButton type="button" className="aw-button aw-button--primary" disabled={!changes.length} onClick={() => run(() => bulkUpdateAdministrativeTasks(visit.id, changes), 'Aufgaben gespeichert und Vorschau aktualisiert.')}>Aufgaben speichern ({changes.length})</NativeButton></NativeDiv></> : <NativeDiv className="aw-empty">Für diesen Einsatz sind keine einzelnen Aufgaben hinterlegt.</NativeDiv>}
      </NativeSection>
      <NativeSection className="aw-panel" id="execution-documentation"><NativeHeader><NativeH3><NativeSpan className="aex-step">3</NativeSpan>Dokumentation ergänzen</NativeH3><NativeP className="aw-hint">Neue Angaben werden an die bestehende Dokumentation angehängt.</NativeP></NativeHeader>
        {visit.documentationNotes?.trim() ? <NativeDetails><NativeSummary>Gespeicherte Dokumentation ansehen</NativeSummary><NativeDiv className="aex-stored">{visit.documentationNotes}</NativeDiv></NativeDetails> : <NativeP className="aw-hint">Noch keine Dokumentation gespeichert.</NativeP>}
        {blocks.length ? <NativeDiv className="aw-actions" aria-label="Dokumentationsbausteine">{blocks.slice(0, 12).map(block => <NativeButton type="button" key={block.id} className="aw-button aw-button--quiet" onClick={() => { const text = String(block.payloadJson.textBlock ?? block.description ?? block.label); setDocumentation(current => current.trim() ? `${current.trim()}\n${text}` : text); }}>{block.label}</NativeButton>)}</NativeDiv> : null}
        <NativeLabel className="aw-field"><NativeSpan className="aw-label">Neue Dokumentation</NativeSpan><NativeTextarea className="aw-input aex-doc" value={documentation} onChange={event => setDocumentation(event.target.value)} placeholder="Durchführung, Besonderheiten und Ergebnis beschreiben…"/></NativeLabel>
        <NativeDiv className="aw-actions"><NativeButton type="button" className="aw-button aw-button--primary" disabled={!documentation.trim()} onClick={saveDocumentation}>Dokumentation speichern</NativeButton><NativeButton type="button" className="aw-button aw-button--quiet" disabled={!documentation} onClick={() => setDocumentation('')}>Text verwerfen</NativeButton></NativeDiv>
      </NativeSection>
      <NativeSection className="aw-panel aex-completion" id="execution-completion"><NativeHeader><NativeH3><NativeSpan className="aex-step">4</NativeSpan>Unterschrift & Abschluss</NativeH3><NativeP className="aw-hint">Prüfen Sie die Angaben, bevor der Einsatz abgeschlossen wird.</NativeP></NativeHeader>
        <NativeDiv className="aex-completion-list"><NativeSpan data-ready={Boolean(visit.actualStartAt && visit.actualEndAt)}>Ist-Zeiten {visit.actualStartAt && visit.actualEndAt ? 'vorhanden' : 'fehlen'}</NativeSpan><NativeSpan data-ready={!requiredOpen}>{requiredOpen ? `${requiredOpen} Pflichtaufgaben offen` : 'Pflichtaufgaben geprüft'}</NativeSpan><NativeSpan data-ready={Boolean(visit.documentationNotes?.trim())}>Dokumentation {visit.documentationNotes?.trim() ? 'vorhanden' : 'fehlt'}</NativeSpan><NativeSpan data-ready={signed}>Unterschrift {signed ? 'vorhanden' : 'offen'}</NativeSpan></NativeDiv>
        {signed ? <NativeP className="aw-hint">Die vorhandene Unterschrift bleibt dem Nachweis zugeordnet.</NativeP> : <><NativeP className="aw-hint">Solange die Unterschrift fehlt, bleibt die Abrechnung gesperrt.</NativeP><NativeDiv className="aw-actions"><NativeButton type="button" className="aw-button" onClick={requestSignature}>Unterschrift im Klientenportal anfordern</NativeButton></NativeDiv></>}
        {changes.length ? <NativeP className="aw-hint">Beim Abschluss werden die {changes.length} vorgemerkten Aufgabenänderungen gemeinsam gespeichert.</NativeP> : null}
        <NativeDiv className="aw-actions"><NativeButton type="button" className="aw-button aw-button--primary" onClick={complete}>{busy ? 'Wird gespeichert…' : 'Nachbearbeitung abschließen'}</NativeButton></NativeDiv>
      </NativeSection>
    </NativeFieldset>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
