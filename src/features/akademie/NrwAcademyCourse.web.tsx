import { useState, type ReactNode } from 'react';
import { NRW_FINAL_LESSON, NRW_MODULES, nrwModuleCode, nrwModuleImage } from '@/lib/akademie/nrwCourse';
import { ACADEMY_STATE_LABELS, type AcademyCertificate, type AcademyCommandHandler, type AcademyCourse, type AcademyEnrollment, type AcademyWorkspace } from '@/lib/akademie/workspaceModel';
import { AcademyDialog } from './AcademyDialog.web';
import { NrwModulePreview } from './NrwModulePreview.web';

const labels = { learning: 'Lernt', ready: 'Prüfung freigegeben', failed: 'Nicht bestanden', passed: 'Bestanden' };
const dateLabel = (value: string) => new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('de-DE');
const today = () => new Date().toLocaleDateString('sv-SE');

type Props = {
  workspace: AcademyWorkspace;
  selectedEnrollmentId: string | null;
  busy: boolean;
  onCommand: AcademyCommandHandler;
  onAssign: (course: AcademyCourse) => void;
  onDownload: (certificate: AcademyCertificate) => Promise<void>;
  feedback: ReactNode;
  assignmentOpen: boolean;
};

export function NrwAcademyCourse({ workspace, selectedEnrollmentId, busy, onCommand, onAssign, onDownload, feedback, assignmentOpen }: Props) {
  const [selectedId, setSelectedId] = useState(selectedEnrollmentId);
  const [query, setQuery] = useState('');
  const [examFilter, setExamFilter] = useState('all');
  const [moduleIndex, setModuleIndex] = useState<number | null>(null);
  const course = workspace.courses.find(item => item.id === workspace.nrwCourseId);
  const enrollments = workspace.enrollments.filter(enrollment => enrollment.courseId === workspace.nrwCourseId && enrollment.nrwExam);
  const selected = enrollments.find(enrollment => enrollment.id === selectedId);
  const certificate = workspace.certificates.find(item => item.enrollmentId === selected?.id && !item.revokedAt);
  const published = course?.status === 'published';
  const status = published ? 'Veröffentlicht' : course?.status === 'archived' ? 'Archiviert' : course ? 'Entwurf' : 'Kursvorlage';
  const shown = enrollments.filter(enrollment => enrollment.participant.name.toLocaleLowerCase('de-DE').includes(query.trim().toLocaleLowerCase('de-DE'))
    && (examFilter === 'all' || enrollment.nrwExam?.state === examFilter));

  return <>
    <section className="ac-nrw-hero" aria-label="Alltagsbegleitung Nordrhein-Westfalen">
      <div className="ac-nrw-hero-copy">
        <p className="ac-nrw-kicker">CARESUITE AKADEMIE · NORDRHEIN-WESTFALEN</p>
        <h2>Alltagsbegleitung in NRW</h2>
        <p>Schulung Nordrhein-Westfalen (AnFöVO) mit bebilderten Fällen aus der Betreuung, Übungen für den nächsten Einsatz und einer Abschlussprüfung.</p>
        <div className="ac-nrw-facts"><span>8 Module</span><span>40 UE à 45 Min.</span><span>Pflichtkurs</span></div>
      </div>
      <img className="ac-nrw-hero-image" src={nrwModuleImage('08')} alt="Eine Alltagsbegleiterin und eine ältere Frau topfen gemeinsam Kräuter um" />
    </section>
    <section className="ac-panel ac-nrw-section ac-nrw-workflow" aria-label="Kurs verwalten">
      <div className="ac-nrw-workflow-copy">
        <div className="ac-badges"><span className="ac-status" data-tone={published ? 'good' : 'attention'}>{status}</span>{course?.versionNumber ? <span className="ac-muted">Fassung {course.versionNumber}</span> : null}</div>
        <h2 className="ac-section-title">{published ? 'Pflichtkurs im Team' : 'Kurs vorbereiten und freigeben'}</h2>
        <p className="ac-muted">{published ? `${enrollments.length} ${enrollments.length === 1 ? 'Teilnahme' : 'Teilnahmen'} · ${enrollments.filter(item => item.state === 'completed').length} abgeschlossen. Zugewiesene Personen finden den Kurs unter „Meine Akademie“.`
          : course?.status === 'draft' ? 'Öffnen Sie unten die Module zur Durchsicht. Nach der Veröffentlichung können Sie Mitarbeitende zuweisen.'
          : course?.status === 'archived' ? 'Frühere Teilnahmen stehen im Bereich „Fortschritt und Prüfung“.'
          : 'Übernehmen Sie die Vorlage als Entwurf, um die Unterrichtseinheiten zu öffnen und den Kurs freizugeben.'}</p>
      </div>
      <div className="ac-card-actions">
        {!course && workspace.capabilities.manageCourses && workspace.nrwCourseId && <button className="ac-button primary" type="button" disabled={busy} onClick={() => void onCommand('install_nrw_course', {}, { id: workspace.nrwCourseId!, revision: null })}>Kurs als Entwurf übernehmen</button>}
        {course?.status === 'draft' && workspace.capabilities.manageCourses && <button className="ac-button primary" type="button" disabled={busy} onClick={() => void onCommand('publish_course', {}, course)}>Kurs veröffentlichen</button>}
        {published && workspace.capabilities.assign && <button className="ac-button primary" type="button" disabled={busy || !course.publishedVersionId} onClick={() => onAssign(course)}>Pflichtkurs zuweisen</button>}
      </div>
      {!selected && !assignmentOpen && feedback && <div className="ac-nrw-feedback">{feedback}</div>}
    </section>
    <section className="ac-panel ac-nrw-section" aria-label="Kursinhalte">
      <div className="ac-panel-header"><div><p className="ac-eyebrow">LERNWEG</p><h2 className="ac-section-title">Acht Module für die Praxis</h2>
        <p className="ac-muted">{course ? 'Jedes Modul enthält fünf Unterrichtseinheiten, ein vergrößerbares Praxisbild und einen Wissenscheck.' : 'Die Unterrichtseinheiten stehen nach Übernahme der Vorlage zur Durchsicht bereit.'}</p></div></div>
      {course && <div className="ac-nrw-modules">{NRW_MODULES.map((title, index) => <button type="button" className="ac-nrw-module ac-nrw-module-button" key={title}
        aria-haspopup="dialog" aria-label={`Modul ${index + 1} öffnen · ${title}`} onClick={() => setModuleIndex(index)}>
        <img src={nrwModuleImage(nrwModuleCode(index))} alt="" loading="lazy" />
        <span className="ac-nrw-module-copy"><span className="ac-eyebrow">MODUL {nrwModuleCode(index)} · 5 UE</span><strong>{title}</strong><span className="ac-nrw-open-label">Modul öffnen ›</span></span>
      </button>)}</div>}
      {course && <details className="ac-nrw-solution ac-nrw-exam-info"><summary>Ablauf der Abschlussprüfung</summary><p>Nach den acht Modulen und ihren Wissenschecks werden 16 Fragen gezogen. Mit mindestens 12 richtigen Antworten ist die Prüfung bestanden. Nach einem nicht bestandenen Versuch kann die Verwaltung eine Wiederholung freigeben.</p></details>}
    </section>
    {moduleIndex !== null && course && <NrwModulePreview key={moduleIndex} index={moduleIndex} lessons={course.content.lessons} onClose={() => setModuleIndex(null)} />}
    <section className="ac-panel ac-nrw-section" aria-label="Fortschritt der Mitarbeitenden">
      <div className="ac-panel-header"><div><p className="ac-eyebrow">PFLICHTKURS IM TEAM</p><h2 className="ac-section-title">Fortschritt und Prüfung</h2><p className="ac-muted">Nach bestandener Prüfung und fachlicher Freigabe steht das Zertifikat in der Vorlage Klarblatt zum Download bereit.</p></div></div>
      {enrollments.length ? <>
        <div className="ac-nrw-fields">
          <label className="ac-field">Mitarbeitende suchen<input className="ac-input" type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <label className="ac-field">Prüfungsstand<select className="ac-input" value={examFilter} onChange={event => setExamFilter(event.target.value)}>
            <option value="all">Alle Prüfungsstände</option><option value="learning">Lernt</option><option value="ready">Prüfung freigegeben</option><option value="failed">Nicht bestanden</option><option value="passed">Bestanden</option>
          </select></label>
        </div>
        {shown.length ? <div className="ac-list">{shown.map(enrollment => {
          const exam = enrollment.nrwExam!;
          return <article className="ac-list-row" key={enrollment.id}>
            <div className="ac-list-main"><strong>{enrollment.participant.name}</strong><span className="ac-muted">{ACADEMY_STATE_LABELS[enrollment.state]} · {enrollment.completedLessonIds.filter(id => /-ue\d$/.test(id)).length} von 40 UE</span>
              <div className="ac-stat-line"><span>Lernfortschritt</span><strong>{enrollment.progress} %</strong></div>
              <div className="ac-progress" role="progressbar" aria-label="Lernfortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={enrollment.progress}><span style={{ width: `${enrollment.progress}%` }} /></div>
            </div>
            <div className="ac-list-actions"><span className="ac-status" data-tone={exam.state === 'passed' ? 'good' : exam.state === 'failed' ? 'attention' : 'neutral'}>{labels[exam.state]}</span><button className="ac-button small" type="button" disabled={busy} aria-haspopup="dialog" onClick={() => setSelectedId(enrollment.id)}>Teilnahme öffnen</button></div>
          </article>;
        })}</div> : <div className="ac-empty"><h3>Keine passenden Teilnahmen</h3><p>Ändern Sie die Suche oder den Prüfungsstand.</p></div>}
      </> : <div className="ac-empty"><h3>Der Pflichtkurs wurde noch nicht zugewiesen.</h3><p>Nach einer Zuweisung erscheinen hier der Lernstand und die Ergebnisse.</p></div>}
    </section>
    {selected && <AcademyDialog title={selected.participant.name} busy={busy} onClose={() => setSelectedId(null)}>
      {feedback}
      <NrwReview key={selected.id} enrollment={selected} canReview={workspace.capabilities.review} busy={busy} onCommand={onCommand} />
      {certificate && <div className="ac-card-actions"><button type="button" className="ac-button primary" disabled={busy} onClick={() => void onDownload(certificate)}>Klarblatt-Zertifikat herunterladen</button></div>}
    </AcademyDialog>}
  </>;
}

function NrwReview({ enrollment, canReview, busy, onCommand }: {
  enrollment: AcademyEnrollment; canReview: boolean; busy: boolean; onCommand: AcademyCommandHandler;
}) {
  const exam = enrollment.nrwExam!;
  const attempts = enrollment.attempts.filter(attempt => attempt.lessonId === NRW_FINAL_LESSON);
  const active = !['completed', 'cancelled'].includes(enrollment.state);
  const [kind, setKind] = useState<'first_aid' | 'presence'>(exam.practice?.kind ?? 'first_aid');
  const [date, setDate] = useState(exam.practice?.date ?? '');
  const [provider, setProvider] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const savePractice = async () => {
    const result = await onCommand('record_nrw_practice', { kind, date, provider: provider.trim(), reference: reference.trim() }, enrollment);
    if (result) { setProvider(''); setReference(''); }
  };
  return <section aria-label="Teilnahme im Detail">
    <div className="ac-badges"><span className="ac-status">{ACADEMY_STATE_LABELS[enrollment.state]}</span><span className="ac-muted">{enrollment.progress} % Lernfortschritt · Fassung {enrollment.versionNumber}</span></div>
    {attempts.length ? <div className="ac-list">{attempts.map(attempt => {
      const mistakes = exam.mistakes.filter(item => item.attempt === attempt.attempt);
      return <article className="ac-nrw-attempt" key={attempt.attempt}>
        <div className="ac-panel-header"><strong>Versuch {attempt.attempt} · {dateLabel(attempt.submittedAt)}</strong><span className="ac-status" data-tone={attempt.passed ? 'good' : 'attention'}>{attempt.score} % · {attempt.passed ? 'Bestanden' : 'Nicht bestanden'}</span></div>
        {mistakes.length > 0 && <details><summary>{mistakes.length} Fehler ansehen</summary><ol>{mistakes.map(mistake => <li key={mistake.question}><strong>{mistake.question}</strong><p>Gewählte Antwort · {mistake.answer}</p></li>)}</ol></details>}
      </article>;
    })}</div> : <p className="ac-muted">Die Abschlussprüfung wurde noch nicht abgegeben.</p>}
    <div className="ac-message" data-tone={exam.practice ? 'success' : 'info'}>{exam.practice ? `${exam.practice.kind === 'first_aid' ? 'Erste-Hilfe-Nachweis' : 'Praktische Notfallschulung'} vom ${dateLabel(exam.practice.date)} geprüft.` : 'Ein geprüfter Praxisnachweis steht noch aus.'}</div>
    {canReview && active && <fieldset className="ac-review-form ac-nrw-review" disabled={busy}>
      <legend>Praxisnachweis prüfen</legend>
      <p className="ac-muted">Prüfen Sie das eingereichte Dokument in der Personalakte und halten Sie die Fundstelle fest. Ein Erste-Hilfe-Nachweis darf für diesen Kurs höchstens fünf Jahre alt sein.</p>
      <div className="ac-nrw-fields">
        <label className="ac-field">Art des Nachweises<select className="ac-input" value={kind} onChange={event => setKind(event.target.value === 'presence' ? 'presence' : 'first_aid')}><option value="first_aid">Erste-Hilfe-Kurs</option><option value="presence">Praktische Notfallschulung</option></select></label>
        <label className="ac-field">Datum<input className="ac-input" type="date" max={today()} value={date} onChange={event => setDate(event.target.value)} /></label>
        <label className="ac-field">Durchführende Stelle<input className="ac-input" maxLength={200} value={provider} onChange={event => setProvider(event.target.value)} /></label>
        <label className="ac-field">Aktenreferenz<input className="ac-input" maxLength={200} value={reference} onChange={event => setReference(event.target.value)} /></label>
      </div>
      <div><button className="ac-button" type="button" disabled={!date || date > today() || provider.trim().length < 2 || reference.trim().length < 2} onClick={() => void savePractice()}>Prüfung des Nachweises speichern</button></div>
    </fieldset>}
    {canReview && active && (exam.state === 'failed' || enrollment.state === 'submitted') && <fieldset className="ac-review-form ac-nrw-review" disabled={busy}>
      <legend>{exam.state === 'failed' ? 'Prüfung wiederholen' : 'Abschluss freigeben'}</legend>
      <label className="ac-field">Vermerk<textarea className="ac-input ac-textarea" rows={3} maxLength={4000} value={note} onChange={event => setNote(event.target.value)} /></label>
      {exam.state === 'failed' ? <div><button className="ac-button primary" type="button" disabled={note.trim().length < 3} onClick={() => void onCommand('unlock_nrw_exam', { note: note.trim() }, enrollment)}>Einen weiteren Versuch freigeben</button></div> : <>
        <label className="ac-checkbox-label"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Ich bestätige, dass Umfang, geeignete fachliche Vermittlung und Praxisnachweis geprüft wurden.</label>
        <div className="ac-card-actions">
          <button className="ac-button primary" type="button" disabled={!exam.practice || !confirmed || note.trim().length < 3} onClick={() => void onCommand('review_enrollment', { decision: 'approve', nrwConfirmed: true, note: note.trim() }, enrollment)}>Klarblatt-Zertifikat ausstellen</button>
          <button className="ac-button" type="button" disabled={note.trim().length < 3} onClick={() => void onCommand('review_enrollment', { decision: 'return', note: note.trim() }, enrollment)}>Zur Überarbeitung zurückgeben</button>
        </div>
      </>}
    </fieldset>}
  </section>;
}
