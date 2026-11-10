// Generated native presentation from src/features/akademie/NrwAcademyCourse.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeDiv,NativeP,NativeH2,NativeSpan,NativeImg,NativeButton,NativeStrong,NativeDetails,NativeSummary,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeArticle,NativeH3,NativeOl,NativeLi,NativeFieldset,NativeLegend,NativeTextarea} from '@/components/layout/NativeWorkspaceElements.native';
import { useState, type ReactNode } from 'react';
import { NRW_FINAL_LESSON, NRW_MODULES, nrwModuleCode, nrwModuleImage } from '@/lib/akademie/nrwCourse';
import { ACADEMY_STATE_LABELS, type AcademyCertificate, type AcademyCommandHandler, type AcademyCourse, type AcademyEnrollment, type AcademyWorkspace } from '@/lib/akademie/workspaceModel';
import { AcademyDialog } from "./AcademyDialog.native.tsx";
import { NrwModulePreview } from "./NrwModulePreview.native.tsx";
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
    <NativeSection className="ac-nrw-hero" aria-label="Alltagsbegleitung Nordrhein-Westfalen">
      <NativeDiv className="ac-nrw-hero-copy">
        <NativeP className="ac-nrw-kicker">CARESUITE AKADEMIE · NORDRHEIN-WESTFALEN</NativeP>
        <NativeH2>Alltagsbegleitung in NRW</NativeH2>
        <NativeP>Schulung Nordrhein-Westfalen (AnFöVO) mit bebilderten Fällen aus der Betreuung, Übungen für den nächsten Einsatz und einer Abschlussprüfung.</NativeP>
        <NativeDiv className="ac-nrw-facts"><NativeSpan>8 Module</NativeSpan><NativeSpan>40 UE à 45 Min.</NativeSpan><NativeSpan>Pflichtkurs</NativeSpan></NativeDiv>
      </NativeDiv>
      <NativeImg className="ac-nrw-hero-image" src={nrwModuleImage('08')} alt="Eine Alltagsbegleiterin und eine ältere Frau topfen gemeinsam Kräuter um"/>
    </NativeSection>
    <NativeSection className="ac-panel ac-nrw-section ac-nrw-workflow" aria-label="Kurs verwalten">
      <NativeDiv className="ac-nrw-workflow-copy">
        <NativeDiv className="ac-badges"><NativeSpan className="ac-status" data-tone={published ? 'good' : 'attention'}>{status}</NativeSpan>{course?.versionNumber ? <NativeSpan className="ac-muted">Fassung {course.versionNumber}</NativeSpan> : null}</NativeDiv>
        <NativeH2 className="ac-section-title">{published ? 'Pflichtkurs im Team' : 'Kurs vorbereiten und freigeben'}</NativeH2>
        <NativeP className="ac-muted">{published ? `${enrollments.length} ${enrollments.length === 1 ? 'Teilnahme' : 'Teilnahmen'} · ${enrollments.filter(item => item.state === 'completed').length} abgeschlossen. Zugewiesene Personen finden den Kurs unter „Meine Akademie“.`
            : course?.status === 'draft' ? 'Öffnen Sie unten die Module zur Durchsicht. Nach der Veröffentlichung können Sie Mitarbeitende zuweisen.'
                : course?.status === 'archived' ? 'Frühere Teilnahmen stehen im Bereich „Fortschritt und Prüfung“.'
                    : 'Übernehmen Sie die Vorlage als Entwurf, um die Unterrichtseinheiten zu öffnen und den Kurs freizugeben.'}</NativeP>
      </NativeDiv>
      <NativeDiv className="ac-card-actions">
        {!course && workspace.capabilities.manageCourses && workspace.nrwCourseId && <NativeButton className="ac-button primary" type="button" disabled={busy} onClick={() => void onCommand('install_nrw_course', {}, { id: workspace.nrwCourseId!, revision: null })}>Kurs als Entwurf übernehmen</NativeButton>}
        {course?.status === 'draft' && workspace.capabilities.manageCourses && <NativeButton className="ac-button primary" type="button" disabled={busy} onClick={() => void onCommand('publish_course', {}, course)}>Kurs veröffentlichen</NativeButton>}
        {published && workspace.capabilities.assign && <NativeButton className="ac-button primary" type="button" disabled={busy || !course.publishedVersionId} onClick={() => onAssign(course)}>Pflichtkurs zuweisen</NativeButton>}
      </NativeDiv>
      {!selected && !assignmentOpen && feedback && <NativeDiv className="ac-nrw-feedback">{feedback}</NativeDiv>}
    </NativeSection>
    <NativeSection className="ac-panel ac-nrw-section" aria-label="Kursinhalte">
      <NativeDiv className="ac-panel-header"><NativeDiv><NativeP className="ac-eyebrow">LERNWEG</NativeP><NativeH2 className="ac-section-title">Acht Module für die Praxis</NativeH2>
        <NativeP className="ac-muted">{course ? 'Jedes Modul enthält fünf Unterrichtseinheiten, ein vergrößerbares Praxisbild und einen Wissenscheck.' : 'Die Unterrichtseinheiten stehen nach Übernahme der Vorlage zur Durchsicht bereit.'}</NativeP></NativeDiv></NativeDiv>
      {course && <NativeDiv className="ac-nrw-modules">{NRW_MODULES.map((title, index) => <NativeButton type="button" className="ac-nrw-module ac-nrw-module-button" key={title} aria-haspopup="dialog" aria-label={`Modul ${index + 1} öffnen · ${title}`} onClick={() => setModuleIndex(index)}>
        <NativeImg src={nrwModuleImage(nrwModuleCode(index))} alt="" loading="lazy"/>
        <NativeSpan className="ac-nrw-module-copy"><NativeSpan className="ac-eyebrow">MODUL {nrwModuleCode(index)} · 5 UE</NativeSpan><NativeStrong>{title}</NativeStrong><NativeSpan className="ac-nrw-open-label">Modul öffnen ›</NativeSpan></NativeSpan>
      </NativeButton>)}</NativeDiv>}
      {course && <NativeDetails className="ac-nrw-solution ac-nrw-exam-info"><NativeSummary>Ablauf der Abschlussprüfung</NativeSummary><NativeP>Nach den acht Modulen und ihren Wissenschecks werden 16 Fragen gezogen. Mit mindestens 12 richtigen Antworten ist die Prüfung bestanden. Nach einem nicht bestandenen Versuch kann die Verwaltung eine Wiederholung freigeben.</NativeP></NativeDetails>}
    </NativeSection>
    {moduleIndex !== null && course && <NrwModulePreview key={moduleIndex} index={moduleIndex} lessons={course.content.lessons} onClose={() => setModuleIndex(null)}/>}
    <NativeSection className="ac-panel ac-nrw-section" aria-label="Fortschritt der Mitarbeitenden">
      <NativeDiv className="ac-panel-header"><NativeDiv><NativeP className="ac-eyebrow">PFLICHTKURS IM TEAM</NativeP><NativeH2 className="ac-section-title">Fortschritt und Prüfung</NativeH2><NativeP className="ac-muted">Nach bestandener Prüfung und fachlicher Freigabe steht das Zertifikat in der Vorlage Klarblatt zum Download bereit.</NativeP></NativeDiv></NativeDiv>
      {enrollments.length ? <>
        <NativeDiv className="ac-nrw-fields">
          <NativeLabel className="ac-field">Mitarbeitende suchen<NativeInput className="ac-input" type="search" value={query} onChange={event => setQuery(event.target.value)}/></NativeLabel>
          <NativeLabel className="ac-field">Prüfungsstand<NativeSelect className="ac-input" value={examFilter} onChange={event => setExamFilter(event.target.value)}>
            <NativeOption value="all">Alle Prüfungsstände</NativeOption><NativeOption value="learning">Lernt</NativeOption><NativeOption value="ready">Prüfung freigegeben</NativeOption><NativeOption value="failed">Nicht bestanden</NativeOption><NativeOption value="passed">Bestanden</NativeOption>
          </NativeSelect></NativeLabel>
        </NativeDiv>
        {shown.length ? <NativeDiv className="ac-list">{shown.map(enrollment => {
                    const exam = enrollment.nrwExam!;
                    return <NativeArticle className="ac-list-row" key={enrollment.id}>
            <NativeDiv className="ac-list-main"><NativeStrong>{enrollment.participant.name}</NativeStrong><NativeSpan className="ac-muted">{ACADEMY_STATE_LABELS[enrollment.state]} · {enrollment.completedLessonIds.filter(id => /-ue\d$/.test(id)).length} von 40 UE</NativeSpan>
              <NativeDiv className="ac-stat-line"><NativeSpan>Lernfortschritt</NativeSpan><NativeStrong>{enrollment.progress} %</NativeStrong></NativeDiv>
              <NativeDiv className="ac-progress" role="progressbar" aria-label="Lernfortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={enrollment.progress}><NativeSpan style={{ width: `${enrollment.progress}%` }}/></NativeDiv>
            </NativeDiv>
            <NativeDiv className="ac-list-actions"><NativeSpan className="ac-status" data-tone={exam.state === 'passed' ? 'good' : exam.state === 'failed' ? 'attention' : 'neutral'}>{labels[exam.state]}</NativeSpan><NativeButton className="ac-button small" type="button" disabled={busy} aria-haspopup="dialog" onClick={() => setSelectedId(enrollment.id)}>Teilnahme öffnen</NativeButton></NativeDiv>
          </NativeArticle>;
                })}</NativeDiv> : <NativeDiv className="ac-empty"><NativeH3>Keine passenden Teilnahmen</NativeH3><NativeP>Ändern Sie die Suche oder den Prüfungsstand.</NativeP></NativeDiv>}
      </> : <NativeDiv className="ac-empty"><NativeH3>Der Pflichtkurs wurde noch nicht zugewiesen.</NativeH3><NativeP>Nach einer Zuweisung erscheinen hier der Lernstand und die Ergebnisse.</NativeP></NativeDiv>}
    </NativeSection>
    {selected && <AcademyDialog title={selected.participant.name} busy={busy} onClose={() => setSelectedId(null)}>
      {feedback}
      <NrwReview key={selected.id} enrollment={selected} canReview={workspace.capabilities.review} busy={busy} onCommand={onCommand}/>
      {certificate && <NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button primary" disabled={busy} onClick={() => void onDownload(certificate)}>Klarblatt-Zertifikat herunterladen</NativeButton></NativeDiv>}
    </AcademyDialog>}
  </>;
}
function NrwReview({ enrollment, canReview, busy, onCommand }: {
    enrollment: AcademyEnrollment;
    canReview: boolean;
    busy: boolean;
    onCommand: AcademyCommandHandler;
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
        if (result) {
            setProvider('');
            setReference('');
        }
    };
    return <NativeSection aria-label="Teilnahme im Detail">
    <NativeDiv className="ac-badges"><NativeSpan className="ac-status">{ACADEMY_STATE_LABELS[enrollment.state]}</NativeSpan><NativeSpan className="ac-muted">{enrollment.progress} % Lernfortschritt · Fassung {enrollment.versionNumber}</NativeSpan></NativeDiv>
    {attempts.length ? <NativeDiv className="ac-list">{attempts.map(attempt => {
                const mistakes = exam.mistakes.filter(item => item.attempt === attempt.attempt);
                return <NativeArticle className="ac-nrw-attempt" key={attempt.attempt}>
        <NativeDiv className="ac-panel-header"><NativeStrong>Versuch {attempt.attempt} · {dateLabel(attempt.submittedAt)}</NativeStrong><NativeSpan className="ac-status" data-tone={attempt.passed ? 'good' : 'attention'}>{attempt.score} % · {attempt.passed ? 'Bestanden' : 'Nicht bestanden'}</NativeSpan></NativeDiv>
        {mistakes.length > 0 && <NativeDetails><NativeSummary>{mistakes.length} Fehler ansehen</NativeSummary><NativeOl>{mistakes.map(mistake => <NativeLi key={mistake.question}><NativeStrong>{mistake.question}</NativeStrong><NativeP>Gewählte Antwort · {mistake.answer}</NativeP></NativeLi>)}</NativeOl></NativeDetails>}
      </NativeArticle>;
            })}</NativeDiv> : <NativeP className="ac-muted">Die Abschlussprüfung wurde noch nicht abgegeben.</NativeP>}
    <NativeDiv className="ac-message" data-tone={exam.practice ? 'success' : 'info'}>{exam.practice ? `${exam.practice.kind === 'first_aid' ? 'Erste-Hilfe-Nachweis' : 'Praktische Notfallschulung'} vom ${dateLabel(exam.practice.date)} geprüft.` : 'Ein geprüfter Praxisnachweis steht noch aus.'}</NativeDiv>
    {canReview && active && <NativeFieldset className="ac-review-form ac-nrw-review" disabled={busy}>
      <NativeLegend>Praxisnachweis prüfen</NativeLegend>
      <NativeP className="ac-muted">Prüfen Sie das eingereichte Dokument in der Personalakte und halten Sie die Fundstelle fest. Ein Erste-Hilfe-Nachweis darf für diesen Kurs höchstens fünf Jahre alt sein.</NativeP>
      <NativeDiv className="ac-nrw-fields">
        <NativeLabel className="ac-field">Art des Nachweises<NativeSelect className="ac-input" value={kind} onChange={event => setKind(event.target.value === 'presence' ? 'presence' : 'first_aid')}><NativeOption value="first_aid">Erste-Hilfe-Kurs</NativeOption><NativeOption value="presence">Praktische Notfallschulung</NativeOption></NativeSelect></NativeLabel>
        <NativeLabel className="ac-field">Datum<NativeInput className="ac-input" type="date" max={today()} value={date} onChange={event => setDate(event.target.value)}/></NativeLabel>
        <NativeLabel className="ac-field">Durchführende Stelle<NativeInput className="ac-input" maxLength={200} value={provider} onChange={event => setProvider(event.target.value)}/></NativeLabel>
        <NativeLabel className="ac-field">Aktenreferenz<NativeInput className="ac-input" maxLength={200} value={reference} onChange={event => setReference(event.target.value)}/></NativeLabel>
      </NativeDiv>
      <NativeDiv><NativeButton className="ac-button" type="button" disabled={!date || date > today() || provider.trim().length < 2 || reference.trim().length < 2} onClick={() => void savePractice()}>Prüfung des Nachweises speichern</NativeButton></NativeDiv>
    </NativeFieldset>}
    {canReview && active && (exam.state === 'failed' || enrollment.state === 'submitted') && <NativeFieldset className="ac-review-form ac-nrw-review" disabled={busy}>
      <NativeLegend>{exam.state === 'failed' ? 'Prüfung wiederholen' : 'Abschluss freigeben'}</NativeLegend>
      <NativeLabel className="ac-field">Vermerk<NativeTextarea className="ac-input ac-textarea" rows={3} maxLength={4000} value={note} onChange={event => setNote(event.target.value)}/></NativeLabel>
      {exam.state === 'failed' ? <NativeDiv><NativeButton className="ac-button primary" type="button" disabled={note.trim().length < 3} onClick={() => void onCommand('unlock_nrw_exam', { note: note.trim() }, enrollment)}>Einen weiteren Versuch freigeben</NativeButton></NativeDiv> : <>
        <NativeLabel className="ac-checkbox-label"><NativeInput type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>Ich bestätige, dass Umfang, geeignete fachliche Vermittlung und Praxisnachweis geprüft wurden.</NativeLabel>
        <NativeDiv className="ac-card-actions">
          <NativeButton className="ac-button primary" type="button" disabled={!exam.practice || !confirmed || note.trim().length < 3} onClick={() => void onCommand('review_enrollment', { decision: 'approve', nrwConfirmed: true, note: note.trim() }, enrollment)}>Klarblatt-Zertifikat ausstellen</NativeButton>
          <NativeButton className="ac-button" type="button" disabled={note.trim().length < 3} onClick={() => void onCommand('review_enrollment', { decision: 'return', note: note.trim() }, enrollment)}>Zur Überarbeitung zurückgeben</NativeButton>
        </NativeDiv>
      </>}
    </NativeFieldset>}
  </NativeSection>;
}
