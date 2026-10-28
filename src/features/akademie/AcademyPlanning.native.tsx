// Generated native presentation from src/features/akademie/AcademyPlanning.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeSmall,NativeArticle,NativeDiv,NativeStrong,NativeSpan,NativeDetails,NativeSummary,NativeOl,NativeLi,NativeP,NativeSection,NativeH2,NativeFieldset,NativeLabel,NativeInput,NativeTextarea,NativeH3,NativeH4,NativeTime} from '@/components/layout/NativeWorkspaceElements.native';
import { useMemo, useState } from 'react';
import { ACADEMY_AUDIENCE_LABELS, ACADEMY_STATE_LABELS, isAcademyOverdue, type AcademyAudience, type AcademyCertificate, type AcademyCommandHandler, type AcademyEnrollment, type AcademyWorkspace, } from '@/lib/akademie/workspaceModel';
import { academyDateText, academyMonthDays, academyMonthText, academyRenewalEligibility, academyShiftMonth, academyToday, buildAcademyPlanning, isAcademyDateOnly, } from '@/lib/akademie/workspacePlanning';
export type AcademyPlanningProps = {
    workspace: AcademyWorkspace;
    busy: boolean;
    onCommand: AcademyCommandHandler;
    audience: AcademyAudience | 'all';
    query: string;
    mandatoryOnly: boolean;
    onOpenEnrollment: (id: string) => void;
};
type PlanEdit = {
    kind: 'deadline' | 'renewal';
    sourceId: string;
    revision: number;
    courseRevision: number | null;
};
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
        if (!/^\d{4}-\d{2}$/.test(next) || !isAcademyDateOnly(`${next}-01`))
            return;
        setMonth(next);
        setSelectedDate(null);
    }
    function beginDeadline(enrollment: AcademyEnrollment) {
        setEdit({ kind: 'deadline', sourceId: enrollment.id, revision: enrollment.revision, courseRevision: null });
        setDueDate(enrollment.dueDate ?? '');
        setNote('');
        setLocalError(null);
        setCreatedEnrollmentId(null);
    }
    function beginRenewal(enrollment: AcademyEnrollment) {
        const eligibility = academyRenewalEligibility(enrollment, workspace.courses, workspace.enrollments);
        if (eligibility.reason || !eligibility.course)
            return;
        setEdit({ kind: 'renewal', sourceId: enrollment.id, revision: enrollment.revision, courseRevision: eligibility.course.revision });
        setDueDate('');
        setNote('');
        setLocalError(null);
        setCreatedEnrollmentId(null);
    }
    async function save() {
        if (!canSave || busy || !edit || !editSource)
            return;
        setLocalError(null);
        try {
            const result = await onCommand(edit.kind === 'deadline' ? 'change_due_date' : 'renew_enrollment', {
                dueDate: dueDate || null, note: note.trim(), ...(edit.kind === 'renewal' ? { courseRevision: edit.courseRevision } : {}),
            }, { id: edit.sourceId, revision: edit.revision });
            if (result) {
                setCreatedEnrollmentId(result.createdEnrollmentId ?? null);
                setEdit(null);
                setNote('');
            }
        }
        catch {
            setLocalError('Der Vorgang konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten.');
        }
    }
    function renewalAction(enrollment: AcademyEnrollment) {
        if (!canPlan)
            return null;
        if (enrollment.nextEnrollmentId)
            return <NativeButton type="button" className="ac-button subtle small" disabled={busy} onClick={() => onOpenEnrollment(enrollment.nextEnrollmentId!)}>Folgeteilnahme ansehen</NativeButton>;
        const eligibility = academyRenewalEligibility(enrollment, workspace.courses, workspace.enrollments);
        const person = workspace.participants.find(candidate => candidate.kind === enrollment.participant.kind && candidate.id === enrollment.participant.id);
        const reason = eligibility.reason ?? (!person?.portalReady ? 'Ein aktiver, für Sie freigegebener Portalzugang ist erforderlich.' : null);
        return reason ? <NativeSmall className="ac-muted">{reason}</NativeSmall> : <NativeButton type="button" className="ac-button small" disabled={busy} onClick={() => beginRenewal(enrollment)}>Folgeschulung planen</NativeButton>;
    }
    function enrollmentRow(enrollment: AcademyEnrollment, keyPrefix = '') {
        return <NativeArticle className="ac-list-row" key={`${keyPrefix}${enrollment.id}`}>
      <NativeDiv className="ac-list-main"><NativeStrong>{enrollment.content.title}</NativeStrong><NativeSpan>{enrollment.participant.name}</NativeSpan>
        <NativeSmall className="ac-muted">{ACADEMY_AUDIENCE_LABELS[enrollment.participant.kind]} · {enrollment.dueDate ? `Frist ${academyDateText(enrollment.dueDate)}` : 'Ohne Frist'} · Fassung {enrollment.versionNumber}</NativeSmall>
        {enrollment.previousEnrollmentId && <NativeSmall className="ac-muted">Folgeschulung mit eigenem Lernstand</NativeSmall>}
        {enrollment.dateChanges && enrollment.dateChanges.length > 0 && <NativeDetails className="ac-date-history"><NativeSummary>Fristverlauf ({enrollment.dateChanges.length})</NativeSummary><NativeOl>{[...enrollment.dateChanges].reverse().map((change, index) => <NativeLi key={`${change.changedAt}:${index}`}><NativeStrong>{academyDateText(change.previousDueDate)} → {academyDateText(change.dueDate)}</NativeStrong><NativeSpan>{change.note}</NativeSpan><NativeSmall>{academyDateText(change.changedAt.slice(0, 10))}</NativeSmall></NativeLi>)}</NativeOl></NativeDetails>}
      </NativeDiv>
      <NativeDiv className="ac-list-actions"><NativeSpan className="ac-status" data-tone={isAcademyOverdue(enrollment, today) ? 'attention' : 'neutral'}>{isAcademyOverdue(enrollment, today) ? 'Überfällig' : ACADEMY_STATE_LABELS[enrollment.state]}</NativeSpan>
        <NativeButton type="button" className="ac-button subtle small" disabled={busy} onClick={() => onOpenEnrollment(enrollment.id)}>{isOffice ? 'Teilnahme ansehen' : 'Schulung öffnen'}</NativeButton>
        {canPlan && activeStates.has(enrollment.state) && <NativeButton type="button" className="ac-button small" disabled={busy} onClick={() => beginDeadline(enrollment)}>Frist ändern</NativeButton>}
      </NativeDiv>
    </NativeArticle>;
    }
    function certificateRow(certificate: AcademyCertificate, prefix: string) {
        const enrollment = workspace.enrollments.find(item => item.id === certificate.enrollmentId);
        const expired = Boolean(certificate.validUntil && certificate.validUntil < today);
        return <NativeArticle className="ac-list-row" key={`${prefix}${certificate.id}`}>
      <NativeDiv className="ac-list-main"><NativeStrong>{certificate.courseTitle}</NativeStrong><NativeSpan>{certificate.participantName}</NativeSpan><NativeSmall className="ac-muted">Nachweis {certificate.number} · Gültig bis {academyDateText(certificate.validUntil)}</NativeSmall></NativeDiv>
      <NativeDiv className="ac-list-actions"><NativeSpan className="ac-status" data-tone={expired ? 'attention' : 'neutral'}>{expired ? 'Abgelaufen' : 'Nachweis läuft aus'}</NativeSpan>{enrollment ? renewalAction(enrollment) : null}</NativeDiv>
    </NativeArticle>;
    }
    return <NativeDiv className="ac-planning">
    <NativeDiv className="ac-kpis" aria-label="Schulungsplanung im Überblick"><NativeDiv className="ac-kpi"><NativeSpan>Fristen im Monat</NativeSpan><NativeStrong className="ac-kpi-value">{monthlyCount}</NativeStrong></NativeDiv><NativeDiv className="ac-kpi"><NativeSpan>Überfällige Schulungen</NativeSpan><NativeStrong className="ac-kpi-value">{overdue.length}</NativeStrong></NativeDiv><NativeDiv className="ac-kpi"><NativeSpan>Nachweise abgelaufen / in 30 Tagen</NativeSpan><NativeStrong className="ac-kpi-value">{plan.expiringCertificates.length}</NativeStrong></NativeDiv><NativeDiv className="ac-kpi"><NativeSpan>Schulungen ohne Frist</NativeSpan><NativeStrong className="ac-kpi-value">{plan.undatedEnrollments.length}</NativeStrong></NativeDiv></NativeDiv>
    {createdEnrollmentId && <NativeDiv className="ac-message" data-tone="success" role="status"><NativeStrong>Die Folgeschulung ist angelegt.</NativeStrong><NativeP>Der bisherige Lernstand bleibt erhalten. Die neue Teilnahme erscheint im persönlichen Lernbereich.</NativeP><NativeButton type="button" className="ac-button small" disabled={busy} onClick={() => onOpenEnrollment(createdEnrollmentId)}>Neue Teilnahme ansehen</NativeButton></NativeDiv>}
    {edit && <NativeSection className="ac-panel ac-planning-editor" aria-label={edit.kind === 'deadline' ? 'Frist bearbeiten' : 'Folgeschulung planen'}><NativeDiv className="ac-panel-header"><NativeDiv><NativeP className="ac-eyebrow">{edit.kind === 'deadline' ? 'FRIST ANPASSEN' : 'ERNEUT LERNEN'}</NativeP><NativeH2 className="ac-section-title">{editSource?.content.title ?? 'Teilnahme nicht mehr verfügbar'}</NativeH2><NativeP>{editSource?.participant.name}</NativeP></NativeDiv><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => setEdit(null)}>Abbrechen</NativeButton></NativeDiv>
      {edit.kind === 'renewal' && editEligibility?.course && <NativeP className="ac-message" data-tone="info">Die Folgeschulung verwendet die aktuell veröffentlichte Fassung {editEligibility.course.versionNumber} von „{editEligibility.course.content.title}“. Sie erhält einen neuen Lernstand; bisherige Nachweise bleiben erhalten.</NativeP>}
      {conflict && <NativeDiv className="ac-message" data-tone="error" role="alert"><NativeStrong>Der gespeicherte Stand hat sich geändert.</NativeStrong><NativeP>Prüfen Sie die aktuelle Teilnahme und Kursfassung, bevor Sie Ihre Eingaben übernehmen.</NativeP><NativeButton type="button" className="ac-button small" disabled={busy} onClick={() => { if (editSource)
            setEdit({ ...edit, revision: editSource.revision, courseRevision: edit.kind === 'renewal' ? editEligibility?.course?.revision ?? null : null }); }}>Aktuellen Stand übernehmen</NativeButton></NativeDiv>}
      {edit.kind === 'renewal' && editEligibility?.reason && <NativeP className="ac-message" data-tone="error" role="alert">{editEligibility.reason}</NativeP>}
      {localError && <NativeP className="ac-message" data-tone="error" role="alert">{localError}</NativeP>}
      <NativeFieldset disabled={busy || !canPlan || !editSource}><NativeDiv className="ac-form-grid"><NativeLabel className="ac-field">{edit.kind === 'deadline' ? 'Neue Abschlussfrist' : 'Abschlussfrist der Folgeschulung'}<NativeInput className="ac-input" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}/><NativeSmall className="ac-muted">Leer lassen für eine Schulung ohne feste Frist.</NativeSmall></NativeLabel><NativeLabel className="ac-field">Begründung<NativeTextarea className="ac-input ac-textarea" rows={3} minLength={3} maxLength={4000} value={note} onChange={event => setNote(event.target.value)} placeholder={edit.kind === 'deadline' ? 'Warum wird die Frist geändert?' : 'Warum ist die erneute Schulung vorgesehen?'}/></NativeLabel></NativeDiv>{invalidDate && <NativeP role="alert">Bitte geben Sie ein gültiges Datum ein.</NativeP>}<NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button primary" disabled={busy || !canSave} onClick={() => void save()}>{edit.kind === 'deadline' ? 'Frist verbindlich ändern' : 'Folgeschulung verbindlich zuweisen'}</NativeButton></NativeDiv></NativeFieldset>
    </NativeSection>}
    <NativeSection className="ac-panel"><NativeDiv className="ac-panel-header"><NativeDiv><NativeP className="ac-eyebrow">SCHULUNGSPLAN</NativeP><NativeH2 className="ac-section-title">{academyMonthText(month)}</NativeH2><NativeP className="ac-muted">Abschlussfristen und Nachweisgültigkeit. Die Anzeige versendet keine Erinnerungen.</NativeP></NativeDiv><NativeDiv className="ac-month-controls"><NativeButton type="button" className="ac-button subtle small" aria-label="Vorheriger Monat" disabled={busy || month === '0001-01'} onClick={() => chooseMonth(academyShiftMonth(month, -1))}>←</NativeButton><NativeLabel className="ac-field">Monat<NativeInput className="ac-input" type="month" value={month} min="0001-01" max="9999-12" disabled={busy} onChange={event => chooseMonth(event.target.value)}/></NativeLabel><NativeButton type="button" className="ac-button subtle small" aria-label="Nächster Monat" disabled={busy || month === '9999-12'} onClick={() => chooseMonth(academyShiftMonth(month, 1))}>→</NativeButton><NativeButton type="button" className="ac-button subtle small" disabled={busy} onClick={() => chooseMonth(today.slice(0, 7))}>Aktueller Monat</NativeButton></NativeDiv></NativeDiv>
      <NativeDiv className="ac-calendar" aria-label={`Monatsübersicht ${academyMonthText(month)}`}><NativeDiv className="ac-calendar-week" data-grid-fixed-columns aria-hidden="true">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => <NativeSpan key={day}>{day}</NativeSpan>)}</NativeDiv><NativeDiv className="ac-calendar-days" data-grid-fixed-columns>{monthDays.map((date, index) => { const day = date ? daysByDate.get(date) : null; const count = (day?.enrollments.length ?? 0) + (day?.certificates.length ?? 0); return date ? <NativeButton type="button" className="ac-calendar-day" key={date} disabled={busy} aria-pressed={selectedDate === date} aria-current={date === today ? 'date' : undefined} aria-label={`${academyDateText(date)} · ${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`} onClick={() => setSelectedDate(selectedDate === date ? null : date)}><NativeSpan>{Number(date.slice(8))}</NativeSpan>{Boolean(day?.enrollments.length) && <NativeSmall>{day!.enrollments.length} {day!.enrollments.length === 1 ? 'Frist' : 'Fristen'}</NativeSmall>}{Boolean(day?.certificates.length) && <NativeSmall className="ac-calendar-expiry">{day!.certificates.length} {day!.certificates.length === 1 ? 'Nachweis' : 'Nachweise'}</NativeSmall>}</NativeButton> : <NativeSpan className="ac-calendar-blank" key={`blank-${index}`} aria-hidden="true"/>; })}</NativeDiv></NativeDiv>
      <NativeDiv className="ac-panel-header ac-agenda-heading"><NativeH3>{selectedDate ? `Einträge am ${academyDateText(selectedDate)}` : 'Fristen und Nachweise im Monat'}</NativeH3>{selectedDate && <NativeButton type="button" className="ac-button subtle small" disabled={busy} onClick={() => setSelectedDate(null)}>Ganzer Monat</NativeButton>}</NativeDiv>
      {agendaDays.length ? <NativeDiv className="ac-agenda">{agendaDays.map(day => <NativeDiv className="ac-agenda-day" key={day.date}><NativeH4><NativeTime dateTime={day.date}>{academyDateText(day.date)}</NativeTime></NativeH4><NativeDiv className="ac-list">{day.enrollments.map(enrollment => enrollmentRow(enrollment, 'agenda-'))}{day.certificates.map(certificate => certificateRow(certificate, 'agenda-'))}</NativeDiv></NativeDiv>)}</NativeDiv> : <NativeDiv className="ac-empty"><NativeH3>Keine Einträge für diese Auswahl</NativeH3><NativeP>Ändern Sie den Monat oder die Filter. Schulungen ohne Frist stehen weiter unten.</NativeP></NativeDiv>}
    </NativeSection>
    {overdue.length > 0 && <NativeSection className="ac-panel"><NativeDiv className="ac-panel-header"><NativeDiv><NativeH2 className="ac-section-title">Überfällige Schulungen</NativeH2><NativeP className="ac-muted">Offene Fristen aus allen Monaten. Bereits eingereichte Abschlüsse werden hier nicht als überfällig geführt.</NativeP></NativeDiv></NativeDiv><NativeDiv className="ac-list">{overdue.map(enrollment => enrollmentRow(enrollment, 'overdue-'))}</NativeDiv></NativeSection>}
    {plan.expiringCertificates.length > 0 && <NativeSection className="ac-panel"><NativeDiv className="ac-panel-header"><NativeDiv><NativeH2 className="ac-section-title">Nachweise im Blick behalten</NativeH2><NativeP className="ac-muted">Aktuellster Nachweis je Person und Kurs, bereits abgelaufen oder innerhalb der nächsten 30 Tage. Eine Folgeschulung wird bewusst zugewiesen.</NativeP></NativeDiv></NativeDiv><NativeDiv className="ac-list">{plan.expiringCertificates.map(certificate => certificateRow(certificate, 'expiry-'))}</NativeDiv></NativeSection>}
    {plan.undatedEnrollments.length > 0 && <NativeSection className="ac-panel"><NativeDiv className="ac-panel-header"><NativeDiv><NativeH2 className="ac-section-title">Noch ohne Abschlussfrist</NativeH2><NativeP className="ac-muted">Diese Schulungen sind bereits zugewiesen und im Lernbereich verfügbar.</NativeP></NativeDiv></NativeDiv><NativeDiv className="ac-list">{plan.undatedEnrollments.map(enrollment => enrollmentRow(enrollment, 'undated-'))}</NativeDiv></NativeSection>}
    {canPlan && repeatable.length > 0 && <NativeSection className="ac-panel"><NativeDetails><NativeSummary>Weitere Schulungen wiederholen ({repeatable.length})</NativeSummary><NativeP className="ac-muted">Abgeschlossene Schulungen und beendete Folgeteilnahmen können einen neuen Lernzyklus erhalten. Es wird nichts automatisch erneut zugewiesen.</NativeP><NativeDiv className="ac-list">{repeatable.map(enrollment => <NativeArticle className="ac-list-row" key={`repeat-${enrollment.id}`}><NativeDiv className="ac-list-main"><NativeStrong>{enrollment.content.title}</NativeStrong><NativeSpan>{enrollment.participant.name}</NativeSpan><NativeSmall className="ac-muted">{ACADEMY_STATE_LABELS[enrollment.state]} · Fassung {enrollment.versionNumber}</NativeSmall></NativeDiv><NativeDiv className="ac-list-actions">{renewalAction(enrollment)}</NativeDiv></NativeArticle>)}</NativeDiv></NativeDetails></NativeSection>}
  </NativeDiv>;
}
