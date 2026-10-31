// Generated native presentation from src/components/wfm/WfmTeamMeetingsScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeButton,NativeForm,NativeH3,NativeFieldset,NativeLabel,NativeInput,NativeTextarea,NativeP,NativeSelect,NativeOption,NativeSection,NativeArticle,NativeStrong,NativeSpan,NativeDetails,NativeSummary} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createWfmTeamMeeting, listWfmMeetingEmployees, listWfmTeamMeetings, setWfmTeamMeetingStatus, type WfmTeamMeeting } from '@/lib/wfm';
import { cancelOfficeTeamMeeting } from "../../lib/wfm/wfmOfficePlanningActions.native.ts";
import { WfmSecondaryWorkspace, WfmWebNotice, useWfmUnsavedChanges } from "./WfmSecondaryWorkspace.native.tsx";
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const initial = () => ({ title: '', date: today(), start: '09:00', end: '10:00', location: '', description: '', attendeeIds: [] as string[], paid: true });
export function WfmTeamMeetingsScreen() {
    const tenantId = useServiceTenantId();
    const { user, profile } = useAuth();
    const actorId = user?.id ?? profile?.id ?? '';
    const { can, check, roleKey, permissions } = usePermissions();
    const canManage = can('time.settings.manage');
    const scope = `${tenantId}:${actorId}:${roleKey}:${canManage}`;
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const [form, setForm] = useState(initial);
    const [open, setOpen] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [peopleSearch, setPeopleSearch] = useState('');
    const [filter, setFilter] = useState('scheduled');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    useWfmUnsavedChanges(dirty, busy);
    useEffect(() => { setForm(initial()); setOpen(false); setDirty(false); setPeopleSearch(''); setError(''); setMessage(''); setBusy(false); lock.current = false; }, [scope]);
    const query = useAsyncQuery(useCallback(async () => {
        if (!tenantId)
            return { ok: true as const, data: { meetings: [], employees: [] } };
        const [meetings, employees] = await Promise.all([listWfmTeamMeetings(tenantId), listWfmMeetingEmployees(tenantId)]);
        if (!meetings.ok)
            return meetings;
        if (!employees.ok)
            return employees;
        return { ok: true as const, data: { meetings: meetings.data, employees: employees.data } };
    }, [tenantId]), [tenantId], { enabled: !!tenantId && !!actorId && canManage, queryKey: scope });
    const change = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => { setDirty(true); setForm(previous => ({ ...previous, [key]: value })); };
    const create = async () => {
        if (lock.current || !tenantId || !actorId || !canManage || query.loading || query.error || query.refreshError)
            return;
        const start = new Date(`${form.date}T${form.start}:00`);
        const end = new Date(`${form.date}T${form.end}:00`);
        if (!form.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
            setError('Bitte Titel, Datum und gültige Uhrzeiten eingeben. Das Ende muss nach dem Beginn liegen.');
            return;
        }
        if (form.paid && !form.attendeeIds.length) {
            setError('Bitte mindestens eine teilnehmende Person auswählen.');
            return;
        }
        if (form.attendeeIds.some(id => !query.data?.employees.some(employee => employee.id === id))) {
            setError('Die Auswahl enthält nicht mehr verfügbare Mitarbeitende. Bitte aktualisieren und erneut wählen.');
            return;
        }
        lock.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        const requestedScope = scope;
        try {
            const result = await createWfmTeamMeeting({ tenantId, actorId, title: form.title.trim(), description: form.description.trim(), location: form.location.trim(), startsAt: start.toISOString(), endsAt: end.toISOString(), countsAsWorkTime: form.paid, attendeeIds: form.attendeeIds });
            if (scopeRef.current !== requestedScope)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            query.setData(previous => previous ? { ...previous, meetings: [result.data, ...previous.meetings] } : null);
            setForm(initial());
            setDirty(false);
            setOpen(false);
            setMessage('Team-Meeting gespeichert. Arbeitszeiten werden beim Abschluss gebucht.');
            await query.refresh();
        }
        catch (cause) {
            if (scopeRef.current === requestedScope)
                setError(cause instanceof Error ? cause.message : 'Meeting konnte nicht angelegt werden.');
        }
        finally {
            if (scopeRef.current === requestedScope) {
                lock.current = false;
                setBusy(false);
            }
        }
    };
    const changeStatus = async (meeting: WfmTeamMeeting, status: 'completed' | 'cancelled') => {
        if (lock.current || !tenantId || !actorId || !canManage || meeting.status !== 'scheduled' || query.refreshError)
            return;
        if (status === 'completed' && new Date(meeting.endsAt).getTime() > Date.now()) {
            setError('Ein Meeting kann erst nach seinem geplanten Ende abgeschlossen werden.');
            return;
        }
        const confirmation = status === 'cancelled' ? `„${meeting.title}“ absagen?` : meeting.countsAsWorkTime ? `„${meeting.title}“ abschließen und Arbeitszeiten für ${meeting.attendeeNames.length} Teilnehmende buchen?` : `„${meeting.title}“ abschließen? Es werden keine Arbeitszeiten gebucht.`;
        if (!await confirmNativeWorkspaceAction(confirmation))
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        const requestedScope = scope;
        try {
            const result = status === 'cancelled' ? await cancelOfficeTeamMeeting(tenantId, meeting.id, roleKey, permissions) : await setWfmTeamMeetingStatus(tenantId, meeting.id, status, actorId);
            if (scopeRef.current !== requestedScope)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            query.setData(previous => previous ? { ...previous, meetings: previous.meetings.map(item => item.id === meeting.id ? { ...item, status } : item) } : null);
            setMessage(status === 'cancelled' ? 'Meeting abgesagt.' : meeting.countsAsWorkTime ? 'Meeting abgeschlossen und Arbeitszeiten gebucht.' : 'Meeting abgeschlossen.');
            await query.refresh();
        }
        catch (cause) {
            if (scopeRef.current === requestedScope)
                setError(cause instanceof Error ? cause.message : 'Status konnte nicht gespeichert werden.');
        }
        finally {
            if (scopeRef.current === requestedScope) {
                lock.current = false;
                setBusy(false);
            }
        }
    };
    const meetings = (query.data?.meetings ?? []).filter(meeting => filter === 'all' || meeting.status === filter);
    return <WfmSecondaryWorkspace title="Team-Meetings" description="Besprechungen planen und bestätigte Arbeitszeiten buchen." actions={<NativeDiv className="wts-actions"><NativeButton onClick={() => void query.refresh()} disabled={!canManage || busy || query.refreshing}>Aktualisieren</NativeButton><NativeButton className="wts-primary" disabled={!canManage || busy || query.loading || !!query.error} onClick={() => setOpen(true)}>Meeting planen</NativeButton></NativeDiv>}>
    {!canManage ? <WfmWebNotice>{check('time.settings.manage').reason ?? 'Keine Berechtigung.'}</WfmWebNotice> : <>
      {query.loading && <WfmWebNotice>Team-Meetings werden geladen…</WfmWebNotice>}{(query.error || query.refreshError) && <WfmWebNotice tone="error">{query.error || query.refreshError}</WfmWebNotice>}{error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}
      {open && <NativeForm className="wts-panel" onSubmit={event => { event.preventDefault(); void create(); }}><NativeH3>Neues Team-Meeting</NativeH3><NativeFieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}><NativeDiv className="wts-stack"><NativeLabel className="wts-field">Titel<NativeInput value={form.title} onChange={e => change('title', e.target.value)} required maxLength={180}/></NativeLabel><NativeDiv className="wts-grid"><NativeLabel className="wts-field">Datum<NativeInput type="date" value={form.date} onChange={e => change('date', e.target.value)} required/></NativeLabel><NativeLabel className="wts-field">Beginn<NativeInput type="time" value={form.start} onChange={e => change('start', e.target.value)} required/></NativeLabel><NativeLabel className="wts-field">Ende<NativeInput type="time" value={form.end} onChange={e => change('end', e.target.value)} required/></NativeLabel><NativeLabel className="wts-field">Ort / Videolink<NativeInput value={form.location} onChange={e => change('location', e.target.value)}/></NativeLabel></NativeDiv><NativeLabel className="wts-field">Tagesordnung<NativeTextarea value={form.description} onChange={e => change('description', e.target.value)}/></NativeLabel><NativeLabel className="wts-field">Teilnehmende suchen ({form.attendeeIds.length} ausgewählt)<NativeInput value={peopleSearch} onChange={e => setPeopleSearch(e.target.value)} placeholder="Name"/></NativeLabel><NativeDiv className="wts-choice-grid">{(query.data?.employees ?? []).filter(employee => employee.name.toLocaleLowerCase('de-DE').includes(peopleSearch.toLocaleLowerCase('de-DE'))).map(employee => <NativeLabel className="wts-check" key={employee.id}><NativeInput type="checkbox" checked={form.attendeeIds.includes(employee.id)} onChange={e => change('attendeeIds', e.target.checked ? [...form.attendeeIds, employee.id] : form.attendeeIds.filter(id => id !== employee.id))}/>{employee.name}</NativeLabel>)}{!(query.data?.employees ?? []).length && <NativeP>Keine aktiven Mitarbeitenden verfügbar.</NativeP>}</NativeDiv><NativeLabel className="wts-check"><NativeInput type="checkbox" checked={form.paid} onChange={e => change('paid', e.target.checked)}/>Beim Abschluss als Arbeitszeit buchen</NativeLabel></NativeDiv></NativeFieldset><NativeDiv className="wts-actions"><NativeButton className="wts-primary" disabled={busy || query.loading || !!query.error || !!query.refreshError}>{busy ? 'Wird gespeichert…' : 'Meeting anlegen'}</NativeButton><NativeButton type="button" disabled={busy} onClick={async () => { if (!dirty || await confirmNativeWorkspaceAction('Ungespeicherte Änderungen verwerfen?')) {
            setForm(initial());
            setDirty(false);
            setOpen(false);
        } }}>Abbrechen</NativeButton></NativeDiv></NativeForm>}
      <NativeDiv className="wts-filters"><NativeLabel className="wts-field">Meetings anzeigen<NativeSelect value={filter} onChange={e => setFilter(e.target.value)}><NativeOption value="scheduled">Geplant</NativeOption><NativeOption value="completed">Abgeschlossen</NativeOption><NativeOption value="cancelled">Abgesagt</NativeOption><NativeOption value="all">Alle</NativeOption></NativeSelect></NativeLabel></NativeDiv>
      <NativeSection className="wts-panel"><NativeH3>Meetings · {meetings.length}</NativeH3><NativeP>Die Übersicht zeigt bis zu 100 der zuletzt angesetzten Meetings.</NativeP>{!query.loading && !query.error && !meetings.length && <NativeDiv className="wts-empty">Keine Meetings für diese Auswahl.</NativeDiv>}{meetings.map(meeting => <NativeArticle key={meeting.id} className="wts-row"><NativeDiv className="wts-row-head"><NativeStrong>{meeting.title}</NativeStrong><NativeSpan className="wts-badge" data-tone={meeting.status === 'completed' ? 'good' : meeting.status === 'cancelled' ? 'muted' : 'warning'}>{meeting.status === 'completed' ? 'Abgeschlossen' : meeting.status === 'cancelled' ? 'Abgesagt' : 'Geplant'}</NativeSpan></NativeDiv><NativeP>{new Date(meeting.startsAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} – {new Date(meeting.endsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}{meeting.location ? ` · ${meeting.location}` : ''}</NativeP><NativeP>{meeting.attendeeNames.length} Teilnehmende · {meeting.countsAsWorkTime ? meeting.status === 'completed' ? 'Arbeitszeit gebucht' : 'Arbeitszeit bei Abschluss' : 'Keine Zeitbuchung'}</NativeP><NativeDetails><NativeSummary>Teilnehmende und Tagesordnung</NativeSummary><NativeP>{meeting.attendeeNames.join(', ') || 'Keine Teilnehmenden'}</NativeP><NativeP>{meeting.description || 'Keine Tagesordnung hinterlegt.'}</NativeP></NativeDetails>{meeting.status === 'scheduled' && <NativeDiv className="wts-actions"><NativeButton className="wts-primary" disabled={busy || !!query.refreshError || dirty || new Date(meeting.endsAt).getTime() > Date.now()} onClick={() => void changeStatus(meeting, 'completed')}>{meeting.countsAsWorkTime ? 'Abschließen und Zeiten buchen' : 'Abschließen'}</NativeButton><NativeButton disabled={busy || !!query.refreshError || dirty} onClick={() => void changeStatus(meeting, 'cancelled')}>Absagen</NativeButton></NativeDiv>}</NativeArticle>)}</NativeSection>
    </>}
  </WfmSecondaryWorkspace>;
}
