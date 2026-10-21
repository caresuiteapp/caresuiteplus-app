import { useMemo, useState } from 'react';
import {
  ACADEMY_AUDIENCE_LABELS, ACADEMY_STATE_LABELS, isAcademyOverdue,
  type AcademyAudience, type AcademyCertificate, type AcademyCommandHandler,
  type AcademyEnrollment, type AcademyWorkspace,
} from '@/lib/akademie/workspaceModel';
import {
  academyDateText, academyMonthDays, academyMonthText, academyRenewalEligibility,
  academyShiftMonth, academyToday, buildAcademyPlanning, isAcademyDateOnly,
} from '@/lib/akademie/workspacePlanning';

export type AcademyPlanningProps = {
  workspace: AcademyWorkspace;
  busy: boolean;
  onCommand: AcademyCommandHandler;
  audience: AcademyAudience | 'all';
  query: string;
  mandatoryOnly: boolean;
  onOpenEnrollment: (id: string) => void;
};
type PlanEdit = { kind: 'deadline' | 'renewal'; sourceId: string; revision: number; courseRevision: number | null };
const activeStates = new Set<AcademyEnrollment['state']>(['assigned', 'in_progress', 'returned']);
const normalize = (value: string) => value.toLocaleLowerCase('de-DE').trim();

export function AcademyPlanning({ workspace, busy, onCommand, audience, query, mandatoryOnly, onOpenEnrollment }: AcademyPlanningProps) {
  const today = academyToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [edit, setEdit] = useState<PlanEdit | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [createdEnrollmentId, setCreatedEnrollmentId] = useState<string | null>(null);
  const isOffice = workspace.viewer.mode === 'office';
  const canPlan = isOffice && workspace.capabilities.assign;
  const plan = useMemo(() => buildAcademyPlanning(workspace, { month, today, audience, query, mandatoryOnly }), [workspace, month, today, audience, query, mandatoryOnly]);
  const daysByDate = new Map(plan.days.map(day => [day.date, day]));
  const monthDays = academyMonthDays(month);
  const filteredEnrollments = workspace.enrollments.filter(enrollment => (audience === 'all' || enrollment.participant.kind === audience)
    && (!mandatoryOnly || enrollment.content.mandatory)
    && normalize(`${enrollment.participant.name} ${enrollment.participant.contextLabel} ${enrollment.content.title} ${enrollment.content.category}`).includes(normalize(query)));
  const overdue = filteredEnrollments.filter(enrollment => isAcademyOverdue(enrollment, today));
  const monthlyCount = plan.days.reduce((count, day) => count + day.enrollments.length, 0);
  const agendaDays = plan.days.filter(day => (!selectedDate || day.date === selectedDate) && (day.enrollments.length || day.certificates.length));
  const editSource = workspace.enrollments.find(enrollment => enrollment.id === edit?.sourceId) ?? null;
  const editEligibility = editSource ? academyRenewalEligibility(editSource, workspace.courses, workspace.enrollments) : null;
  const editPerson = editSource ? workspace.participants.find(person => person.kind === editSource.participant.kind && person.id === editSource.participant.id) : null;
  const conflict = Boolean(edit && editSource && (edit.revision !== editSource.revision || (edit.kind === 'renewal' && edit.courseRevision !== editEligibility?.course?.revision)));
  const invalidDate = Boolean(dueDate && !isAcademyDateOnly(dueDate));
  const canSave = Boolean(canPlan && edit && editSource && !conflict && !invalidDate && note.trim().length >= 3
    && (edit.kind === 'deadline' ? activeStates.has(editSource.state) && (dueDate || null) !== editSource.dueDate
      : !editEligibility?.reason && editEligibility?.course && editPerson?.portalReady));
  const expirySourceIds = new Set(plan.expiringCertificates.map(certificate => certificate.enrollmentId));
  const repeatable = filteredEnrollments.filter(enrollment => !enrollment.nextEnrollmentId && !expirySourceIds.has(enrollment.id)
    && (enrollment.state === 'completed' || (enrollment.state === 'cancelled' && enrollment.previousEnrollmentId)));

  function chooseMonth(next: string) {
    if (!/^\d{4}-\d{2}$/.test(next) || !isAcademyDateOnly(`${next}-01`)) return;
    setMonth(next); setSelectedDate(null);
  }
  function beginDeadline(enrollment: AcademyEnrollment) {
    setEdit({ kind: 'deadline', sourceId: enrollment.id, revision: enrollment.revision, courseRevision: null });
    setDueDate(enrollment.dueDate ?? ''); setNote(''); setLocalError(null); setCreatedEnrollmentId(null);
  }
  function beginRenewal(enrollment: AcademyEnrollment) {
    const eligibility = academyRenewalEligibility(enrollment, workspace.courses, workspace.enrollments);
    if (eligibility.reason || !eligibility.course) return;
    setEdit({ kind: 'renewal', sourceId: enrollment.id, revision: enrollment.revision, courseRevision: eligibility.course.revision });
    setDueDate(''); setNote(''); setLocalError(null); setCreatedEnrollmentId(null);
  }
  async function save() {
    if (!canSave || busy || !edit || !editSource) return;
    setLocalError(null);
    try {
      const result = await onCommand(edit.kind === 'deadline' ? 'change_due_date' : 'renew_enrollment', {
        dueDate: dueDate || null, note: note.trim(), ...(edit.kind === 'renewal' ? { courseRevision: edit.courseRevision } : {}),
      }, { id: edit.sourceId, revision: edit.revision });
      if (result) { setCreatedEnrollmentId(result.createdEnrollmentId ?? null); setEdit(null); setNote(''); }
    } catch { setLocalError('Der Vorgang konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten.'); }
  }
  function renewalAction(enrollment: AcademyEnrollment) {
    if (!canPlan) return null;
    if (enrollment.nextEnrollmentId) return <button type="button" className="ac-button subtle small" disabled={busy} onClick={() => onOpenEnrollment(enrollment.nextEnrollmentId!)}>Folgeteilnahme ansehen</button>;
    const eligibility = academyRenewalEligibility(enrollment, workspace.courses, workspace.enrollments);
    const person = workspace.participants.find(candidate => candidate.kind === enrollment.participant.kind && candidate.id === enrollment.participant.id);
    const reason = eligibility.reason ?? (!person?.portalReady ? 'Ein aktiver, für Sie freigegebener Portalzugang ist erforderlich.' : null);
    return reason ? <small className="ac-muted">{reason}</small> : <button type="button" className="ac-button small" disabled={busy} onClick={() => beginRenewal(enrollment)}>Folgeschulung planen</button>;
  }
  function enrollmentRow(enrollment: AcademyEnrollment, keyPrefix = '') {
    return <article className="ac-list-row" key={`${keyPrefix}${enrollment.id}`}>
      <div className="ac-list-main"><strong>{enrollment.content.title}</strong><span>{enrollment.participant.name}</span>
        <small className="ac-muted">{ACADEMY_AUDIENCE_LABELS[enrollment.participant.kind]} · {enrollment.dueDate ? `Frist ${academyDateText(enrollment.dueDate)}` : 'Ohne Frist'} · Fassung {enrollment.versionNumber}</small>
        {enrollment.previousEnrollmentId && <small className="ac-muted">Folgeschulung mit eigenem Lernstand</small>}
        {enrollment.dateChanges && enrollment.dateChanges.length > 0 && <details className="ac-date-history"><summary>Fristverlauf ({enrollment.dateChanges.length})</summary><ol>{[...enrollment.dateChanges].reverse().map((change, index) => <li key={`${change.changedAt}:${index}`}><strong>{academyDateText(change.previousDueDate)} → {academyDateText(change.dueDate)}</strong><span>{change.note}</span><small>{academyDateText(change.changedAt.slice(0, 10))}</small></li>)}</ol></details>}
      </div>
      <div className="ac-list-actions"><span className="ac-status" data-tone={isAcademyOverdue(enrollment, today) ? 'attention' : 'neutral'}>{isAcademyOverdue(enrollment, today) ? 'Überfällig' : ACADEMY_STATE_LABELS[enrollment.state]}</span>
        <button type="button" className="ac-button subtle small" disabled={busy} onClick={() => onOpenEnrollment(enrollment.id)}>{isOffice ? 'Teilnahme ansehen' : 'Schulung öffnen'}</button>
        {canPlan && activeStates.has(enrollment.state) && <button type="button" className="ac-button small" disabled={busy} onClick={() => beginDeadline(enrollment)}>Frist ändern</button>}
      </div>
    </article>;
  }
  function certificateRow(certificate: AcademyCertificate, prefix: string) {
    const enrollment = workspace.enrollments.find(item => item.id === certificate.enrollmentId);
    const expired = Boolean(certificate.validUntil && certificate.validUntil < today);
    return <article className="ac-list-row" key={`${prefix}${certificate.id}`}>
      <div className="ac-list-main"><strong>{certificate.courseTitle}</strong><span>{certificate.participantName}</span><small className="ac-muted">Nachweis {certificate.number} · Gültig bis {academyDateText(certificate.validUntil)}</small></div>
      <div className="ac-list-actions"><span className="ac-status" data-tone={expired ? 'attention' : 'neutral'}>{expired ? 'Abgelaufen' : 'Nachweis läuft aus'}</span>{enrollment ? renewalAction(enrollment) : null}</div>
    </article>;
  }

  return <div className="ac-planning">
    <div className="ac-kpis" aria-label="Schulungsplanung im Überblick"><div className="ac-kpi"><span>Fristen im Monat</span><strong className="ac-kpi-value">{monthlyCount}</strong></div><div className="ac-kpi"><span>Überfällige Schulungen</span><strong className="ac-kpi-value">{overdue.length}</strong></div><div className="ac-kpi"><span>Nachweise abgelaufen / in 30 Tagen</span><strong className="ac-kpi-value">{plan.expiringCertificates.length}</strong></div><div className="ac-kpi"><span>Schulungen ohne Frist</span><strong className="ac-kpi-value">{plan.undatedEnrollments.length}</strong></div></div>
    {createdEnrollmentId && <div className="ac-message" data-tone="success" role="status"><strong>Die Folgeschulung ist angelegt.</strong><p>Der bisherige Lernstand bleibt erhalten. Die neue Teilnahme erscheint im persönlichen Lernbereich.</p><button type="button" className="ac-button small" disabled={busy} onClick={() => onOpenEnrollment(createdEnrollmentId)}>Neue Teilnahme ansehen</button></div>}
    {edit && <section className="ac-panel ac-planning-editor" aria-label={edit.kind === 'deadline' ? 'Frist bearbeiten' : 'Folgeschulung planen'}><div className="ac-panel-header"><div><p className="ac-eyebrow">{edit.kind === 'deadline' ? 'FRIST ANPASSEN' : 'ERNEUT LERNEN'}</p><h2 className="ac-section-title">{editSource?.content.title ?? 'Teilnahme nicht mehr verfügbar'}</h2><p>{editSource?.participant.name}</p></div><button type="button" className="ac-button subtle" disabled={busy} onClick={() => setEdit(null)}>Abbrechen</button></div>
      {edit.kind === 'renewal' && editEligibility?.course && <p className="ac-message" data-tone="info">Die Folgeschulung verwendet die aktuell veröffentlichte Fassung {editEligibility.course.versionNumber} von „{editEligibility.course.content.title}“. Sie erhält einen neuen Lernstand; bisherige Nachweise bleiben erhalten.</p>}
      {conflict && <div className="ac-message" data-tone="error" role="alert"><strong>Der gespeicherte Stand hat sich geändert.</strong><p>Prüfen Sie die aktuelle Teilnahme und Kursfassung, bevor Sie Ihre Eingaben übernehmen.</p><button type="button" className="ac-button small" disabled={busy} onClick={() => { if (editSource) setEdit({ ...edit, revision: editSource.revision, courseRevision: edit.kind === 'renewal' ? editEligibility?.course?.revision ?? null : null }); }}>Aktuellen Stand übernehmen</button></div>}
      {edit.kind === 'renewal' && editEligibility?.reason && <p className="ac-message" data-tone="error" role="alert">{editEligibility.reason}</p>}
      {localError && <p className="ac-message" data-tone="error" role="alert">{localError}</p>}
      <fieldset disabled={busy || !canPlan || !editSource}><div className="ac-form-grid"><label className="ac-field">{edit.kind === 'deadline' ? 'Neue Abschlussfrist' : 'Abschlussfrist der Folgeschulung'}<input className="ac-input" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /><small className="ac-muted">Leer lassen für eine Schulung ohne feste Frist.</small></label><label className="ac-field">Begründung<textarea className="ac-input ac-textarea" rows={3} minLength={3} maxLength={4000} value={note} onChange={event => setNote(event.target.value)} placeholder={edit.kind === 'deadline' ? 'Warum wird die Frist geändert?' : 'Warum ist die erneute Schulung vorgesehen?'} /></label></div>{invalidDate && <p role="alert">Bitte geben Sie ein gültiges Datum ein.</p>}<div className="ac-card-actions"><button type="button" className="ac-button primary" disabled={busy || !canSave} onClick={() => void save()}>{edit.kind === 'deadline' ? 'Frist verbindlich ändern' : 'Folgeschulung verbindlich zuweisen'}</button></div></fieldset>
    </section>}
    <section className="ac-panel"><div className="ac-panel-header"><div><p className="ac-eyebrow">SCHULUNGSPLAN</p><h2 className="ac-section-title">{academyMonthText(month)}</h2><p className="ac-muted">Abschlussfristen und Nachweisgültigkeit. Die Anzeige versendet keine Erinnerungen.</p></div><div className="ac-month-controls"><button type="button" className="ac-button subtle small" aria-label="Vorheriger Monat" disabled={busy || month === '0001-01'} onClick={() => chooseMonth(academyShiftMonth(month, -1))}>←</button><label className="ac-field">Monat<input className="ac-input" type="month" value={month} min="0001-01" max="9999-12" disabled={busy} onChange={event => chooseMonth(event.target.value)} /></label><button type="button" className="ac-button subtle small" aria-label="Nächster Monat" disabled={busy || month === '9999-12'} onClick={() => chooseMonth(academyShiftMonth(month, 1))}>→</button><button type="button" className="ac-button subtle small" disabled={busy} onClick={() => chooseMonth(today.slice(0, 7))}>Aktueller Monat</button></div></div>
      <div className="ac-calendar" aria-label={`Monatsübersicht ${academyMonthText(month)}`}><div className="ac-calendar-week" aria-hidden="true">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => <span key={day}>{day}</span>)}</div><div className="ac-calendar-days">{monthDays.map((date, index) => { const day = date ? daysByDate.get(date) : null; const count = (day?.enrollments.length ?? 0) + (day?.certificates.length ?? 0); return date ? <button type="button" className="ac-calendar-day" key={date} disabled={busy} aria-pressed={selectedDate === date} aria-current={date === today ? 'date' : undefined} aria-label={`${academyDateText(date)} · ${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`} onClick={() => setSelectedDate(selectedDate === date ? null : date)}><span>{Number(date.slice(8))}</span>{Boolean(day?.enrollments.length) && <small>{day!.enrollments.length} {day!.enrollments.length === 1 ? 'Frist' : 'Fristen'}</small>}{Boolean(day?.certificates.length) && <small className="ac-calendar-expiry">{day!.certificates.length} {day!.certificates.length === 1 ? 'Nachweis' : 'Nachweise'}</small>}</button> : <span className="ac-calendar-blank" key={`blank-${index}`} aria-hidden="true" />; })}</div></div>
      <div className="ac-panel-header ac-agenda-heading"><h3>{selectedDate ? `Einträge am ${academyDateText(selectedDate)}` : 'Fristen und Nachweise im Monat'}</h3>{selectedDate && <button type="button" className="ac-button subtle small" disabled={busy} onClick={() => setSelectedDate(null)}>Ganzer Monat</button>}</div>
      {agendaDays.length ? <div className="ac-agenda">{agendaDays.map(day => <div className="ac-agenda-day" key={day.date}><h4><time dateTime={day.date}>{academyDateText(day.date)}</time></h4><div className="ac-list">{day.enrollments.map(enrollment => enrollmentRow(enrollment, 'agenda-'))}{day.certificates.map(certificate => certificateRow(certificate, 'agenda-'))}</div></div>)}</div> : <div className="ac-empty"><h3>Keine Einträge für diese Auswahl</h3><p>Ändern Sie den Monat oder die Filter. Schulungen ohne Frist stehen weiter unten.</p></div>}
    </section>
    {overdue.length > 0 && <section className="ac-panel"><div className="ac-panel-header"><div><h2 className="ac-section-title">Überfällige Schulungen</h2><p className="ac-muted">Offene Fristen aus allen Monaten. Bereits eingereichte Abschlüsse werden hier nicht als überfällig geführt.</p></div></div><div className="ac-list">{overdue.map(enrollment => enrollmentRow(enrollment, 'overdue-'))}</div></section>}
    {plan.expiringCertificates.length > 0 && <section className="ac-panel"><div className="ac-panel-header"><div><h2 className="ac-section-title">Nachweise im Blick behalten</h2><p className="ac-muted">Aktuellster Nachweis je Person und Kurs, bereits abgelaufen oder innerhalb der nächsten 30 Tage. Eine Folgeschulung wird bewusst zugewiesen.</p></div></div><div className="ac-list">{plan.expiringCertificates.map(certificate => certificateRow(certificate, 'expiry-'))}</div></section>}
    {plan.undatedEnrollments.length > 0 && <section className="ac-panel"><div className="ac-panel-header"><div><h2 className="ac-section-title">Noch ohne Abschlussfrist</h2><p className="ac-muted">Diese Schulungen sind bereits zugewiesen und im Lernbereich verfügbar.</p></div></div><div className="ac-list">{plan.undatedEnrollments.map(enrollment => enrollmentRow(enrollment, 'undated-'))}</div></section>}
    {canPlan && repeatable.length > 0 && <section className="ac-panel"><details><summary>Weitere Schulungen wiederholen ({repeatable.length})</summary><p className="ac-muted">Abgeschlossene Schulungen und beendete Folgeteilnahmen können einen neuen Lernzyklus erhalten. Es wird nichts automatisch erneut zugewiesen.</p><div className="ac-list">{repeatable.map(enrollment => <article className="ac-list-row" key={`repeat-${enrollment.id}`}><div className="ac-list-main"><strong>{enrollment.content.title}</strong><span>{enrollment.participant.name}</span><small className="ac-muted">{ACADEMY_STATE_LABELS[enrollment.state]} · Fassung {enrollment.versionNumber}</small></div><div className="ac-list-actions">{renewalAction(enrollment)}</div></article>)}</div></details></section>}
  </div>;
}
