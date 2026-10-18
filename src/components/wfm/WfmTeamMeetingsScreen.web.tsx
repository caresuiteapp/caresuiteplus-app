import { useCallback, useEffect, useRef, useState } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createWfmTeamMeeting, listWfmMeetingEmployees, listWfmTeamMeetings, setWfmTeamMeetingStatus, type WfmTeamMeeting } from '@/lib/wfm';
import { cancelOfficeTeamMeeting } from '@/lib/wfm/wfmOfficePlanningActions.web';
import { WfmSecondaryWorkspace, WfmWebNotice, useWfmUnsavedChanges } from './WfmSecondaryWorkspace.web';

const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const initial = () => ({ title: '', date: today(), start: '09:00', end: '10:00', location: '', description: '', attendeeIds: [] as string[], paid: true });

export function WfmTeamMeetingsScreen() {
  const tenantId = useServiceTenantId(); const { user, profile } = useAuth(); const actorId = user?.id ?? profile?.id ?? ''; const { can, check, roleKey, permissions } = usePermissions(); const canManage = can('time.settings.manage');
  const scope = `${tenantId}:${actorId}:${roleKey}:${canManage}`; const scopeRef = useRef(scope); scopeRef.current = scope;
  const [form, setForm] = useState(initial); const [open, setOpen] = useState(false); const [dirty, setDirty] = useState(false); const [peopleSearch, setPeopleSearch] = useState(''); const [filter, setFilter] = useState('scheduled');
  const [busy, setBusy] = useState(false); const lock = useRef(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useWfmUnsavedChanges(dirty, busy);
  useEffect(() => { setForm(initial()); setOpen(false); setDirty(false); setPeopleSearch(''); setError(''); setMessage(''); setBusy(false); lock.current = false; }, [scope]);
  const query = useAsyncQuery(useCallback(async () => {
    if (!tenantId) return { ok: true as const, data: { meetings: [], employees: [] } };
    const [meetings, employees] = await Promise.all([listWfmTeamMeetings(tenantId), listWfmMeetingEmployees(tenantId)]);
    if (!meetings.ok) return meetings; if (!employees.ok) return employees;
    return { ok: true as const, data: { meetings: meetings.data, employees: employees.data } };
  }, [tenantId]), [tenantId], { enabled: !!tenantId && !!actorId && canManage, queryKey: scope });
  const change = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => { setDirty(true); setForm(previous => ({ ...previous, [key]: value })); };
  const create = async () => {
    if (lock.current || !tenantId || !actorId || !canManage || query.loading || query.error || query.refreshError) return;
    const start = new Date(`${form.date}T${form.start}:00`); const end = new Date(`${form.date}T${form.end}:00`);
    if (!form.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) { setError('Bitte Titel, Datum und gültige Uhrzeiten eingeben. Das Ende muss nach dem Beginn liegen.'); return; }
    if (form.paid && !form.attendeeIds.length) { setError('Bitte mindestens eine teilnehmende Person auswählen.'); return; }
    if (form.attendeeIds.some(id => !query.data?.employees.some(employee => employee.id === id))) { setError('Die Auswahl enthält nicht mehr verfügbare Mitarbeitende. Bitte aktualisieren und erneut wählen.'); return; }
    lock.current = true; setBusy(true); setError(''); setMessage(''); const requestedScope = scope;
    try {
      const result = await createWfmTeamMeeting({ tenantId, actorId, title: form.title.trim(), description: form.description.trim(), location: form.location.trim(), startsAt: start.toISOString(), endsAt: end.toISOString(), countsAsWorkTime: form.paid, attendeeIds: form.attendeeIds });
      if (scopeRef.current !== requestedScope) return;
      if (!result.ok) { setError(result.error); return; }
      query.setData(previous => previous ? { ...previous, meetings: [result.data, ...previous.meetings] } : null); setForm(initial()); setDirty(false); setOpen(false); setMessage('Team-Meeting gespeichert. Arbeitszeiten werden beim Abschluss gebucht.'); await query.refresh();
    } catch (cause) { if (scopeRef.current === requestedScope) setError(cause instanceof Error ? cause.message : 'Meeting konnte nicht angelegt werden.'); }
    finally { if (scopeRef.current === requestedScope) { lock.current = false; setBusy(false); } }
  };
  const changeStatus = async (meeting: WfmTeamMeeting, status: 'completed' | 'cancelled') => {
    if (lock.current || !tenantId || !actorId || !canManage || meeting.status !== 'scheduled' || query.refreshError) return;
    if (status === 'completed' && new Date(meeting.endsAt).getTime() > Date.now()) { setError('Ein Meeting kann erst nach seinem geplanten Ende abgeschlossen werden.'); return; }
    const confirmation = status === 'cancelled' ? `„${meeting.title}“ absagen?` : meeting.countsAsWorkTime ? `„${meeting.title}“ abschließen und Arbeitszeiten für ${meeting.attendeeNames.length} Teilnehmende buchen?` : `„${meeting.title}“ abschließen? Es werden keine Arbeitszeiten gebucht.`;
    if (!window.confirm(confirmation)) return;
    lock.current = true; setBusy(true); setError(''); setMessage(''); const requestedScope = scope;
    try {
      const result = status === 'cancelled' ? await cancelOfficeTeamMeeting(tenantId, meeting.id, roleKey, permissions) : await setWfmTeamMeetingStatus(tenantId, meeting.id, status, actorId);
      if (scopeRef.current !== requestedScope) return;
      if (!result.ok) { setError(result.error); return; }
      query.setData(previous => previous ? { ...previous, meetings: previous.meetings.map(item => item.id === meeting.id ? { ...item, status } : item) } : null);
      setMessage(status === 'cancelled' ? 'Meeting abgesagt.' : meeting.countsAsWorkTime ? 'Meeting abgeschlossen und Arbeitszeiten gebucht.' : 'Meeting abgeschlossen.'); await query.refresh();
    } catch (cause) { if (scopeRef.current === requestedScope) setError(cause instanceof Error ? cause.message : 'Status konnte nicht gespeichert werden.'); }
    finally { if (scopeRef.current === requestedScope) { lock.current = false; setBusy(false); } }
  };
  const meetings = (query.data?.meetings ?? []).filter(meeting => filter === 'all' || meeting.status === filter);
  return <WfmSecondaryWorkspace title="Team-Meetings" description="Besprechungen planen und bestätigte Arbeitszeiten buchen." actions={<div className="wts-actions"><button onClick={() => void query.refresh()} disabled={!canManage || busy || query.refreshing}>Aktualisieren</button><button className="wts-primary" disabled={!canManage || busy || query.loading || !!query.error} onClick={() => setOpen(true)}>Meeting planen</button></div>}>
    {!canManage ? <WfmWebNotice>{check('time.settings.manage').reason ?? 'Keine Berechtigung.'}</WfmWebNotice> : <>
      {query.loading && <WfmWebNotice>Team-Meetings werden geladen…</WfmWebNotice>}{(query.error || query.refreshError) && <WfmWebNotice tone="error">{query.error || query.refreshError}</WfmWebNotice>}{error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}
      {open && <form className="wts-panel" onSubmit={event => { event.preventDefault(); void create(); }}><h3>Neues Team-Meeting</h3><fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}><div className="wts-stack"><label className="wts-field">Titel<input value={form.title} onChange={e => change('title', e.target.value)} required maxLength={180} /></label><div className="wts-grid"><label className="wts-field">Datum<input type="date" value={form.date} onChange={e => change('date', e.target.value)} required /></label><label className="wts-field">Beginn<input type="time" value={form.start} onChange={e => change('start', e.target.value)} required /></label><label className="wts-field">Ende<input type="time" value={form.end} onChange={e => change('end', e.target.value)} required /></label><label className="wts-field">Ort / Videolink<input value={form.location} onChange={e => change('location', e.target.value)} /></label></div><label className="wts-field">Tagesordnung<textarea value={form.description} onChange={e => change('description', e.target.value)} /></label><label className="wts-field">Teilnehmende suchen ({form.attendeeIds.length} ausgewählt)<input value={peopleSearch} onChange={e => setPeopleSearch(e.target.value)} placeholder="Name" /></label><div className="wts-choice-grid">{(query.data?.employees ?? []).filter(employee => employee.name.toLocaleLowerCase('de-DE').includes(peopleSearch.toLocaleLowerCase('de-DE'))).map(employee => <label className="wts-check" key={employee.id}><input type="checkbox" checked={form.attendeeIds.includes(employee.id)} onChange={e => change('attendeeIds', e.target.checked ? [...form.attendeeIds, employee.id] : form.attendeeIds.filter(id => id !== employee.id))} />{employee.name}</label>)}{!(query.data?.employees ?? []).length && <p>Keine aktiven Mitarbeitenden verfügbar.</p>}</div><label className="wts-check"><input type="checkbox" checked={form.paid} onChange={e => change('paid', e.target.checked)} />Beim Abschluss als Arbeitszeit buchen</label></div></fieldset><div className="wts-actions"><button className="wts-primary" disabled={busy || query.loading || !!query.error || !!query.refreshError}>{busy ? 'Wird gespeichert…' : 'Meeting anlegen'}</button><button type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Ungespeicherte Änderungen verwerfen?')) { setForm(initial()); setDirty(false); setOpen(false); } }}>Abbrechen</button></div></form>}
      <div className="wts-filters"><label className="wts-field">Meetings anzeigen<select value={filter} onChange={e => setFilter(e.target.value)}><option value="scheduled">Geplant</option><option value="completed">Abgeschlossen</option><option value="cancelled">Abgesagt</option><option value="all">Alle</option></select></label></div>
      <section className="wts-panel"><h3>Meetings · {meetings.length}</h3><p>Die Übersicht zeigt bis zu 100 der zuletzt angesetzten Meetings.</p>{!query.loading && !query.error && !meetings.length && <div className="wts-empty">Keine Meetings für diese Auswahl.</div>}{meetings.map(meeting => <article key={meeting.id} className="wts-row"><div className="wts-row-head"><strong>{meeting.title}</strong><span className="wts-badge" data-tone={meeting.status === 'completed' ? 'good' : meeting.status === 'cancelled' ? 'muted' : 'warning'}>{meeting.status === 'completed' ? 'Abgeschlossen' : meeting.status === 'cancelled' ? 'Abgesagt' : 'Geplant'}</span></div><p>{new Date(meeting.startsAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} – {new Date(meeting.endsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}{meeting.location ? ` · ${meeting.location}` : ''}</p><p>{meeting.attendeeNames.length} Teilnehmende · {meeting.countsAsWorkTime ? meeting.status === 'completed' ? 'Arbeitszeit gebucht' : 'Arbeitszeit bei Abschluss' : 'Keine Zeitbuchung'}</p><details><summary>Teilnehmende und Tagesordnung</summary><p>{meeting.attendeeNames.join(', ') || 'Keine Teilnehmenden'}</p><p>{meeting.description || 'Keine Tagesordnung hinterlegt.'}</p></details>{meeting.status === 'scheduled' && <div className="wts-actions"><button className="wts-primary" disabled={busy || !!query.refreshError || dirty || new Date(meeting.endsAt).getTime() > Date.now()} onClick={() => void changeStatus(meeting, 'completed')}>{meeting.countsAsWorkTime ? 'Abschließen und Zeiten buchen' : 'Abschließen'}</button><button disabled={busy || !!query.refreshError || dirty} onClick={() => void changeStatus(meeting, 'cancelled')}>Absagen</button></div>}</article>)}</section>
    </>}
  </WfmSecondaryWorkspace>;
}
