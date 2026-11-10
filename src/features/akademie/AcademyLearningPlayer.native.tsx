// Generated native presentation from src/features/akademie/AcademyLearningPlayer.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeDiv,NativeP,NativeH2,NativeButton,NativeSpan,NativeStrong,NativeA,NativeNav,NativeLabel,NativeSelect,NativeOption,NativeSmall,NativeArticle,NativeH3,NativeImg,NativeH4,NativeForm,NativeFieldset,NativeInput,NativeFigure,NativeFigcaption,NativeDetails,NativeSummary} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useState } from 'react';
import { ACADEMY_STATE_LABELS, academySafeResourceUrl, isAcademyOverdue, type AcademyAttempt, type AcademyCertificate, type AcademyCommandHandler, type AcademyEnrollment, type AcademyEnrollmentState, type AcademyLesson, } from '@/lib/akademie/workspaceModel';
import { NRW_FINAL_LESSON, NRW_MODULES, NRW_PRACTICE_UPLOAD, nrwModuleCode, nrwModuleImage } from '@/lib/akademie/nrwCourse';
type Props = {
    enrollment: AcademyEnrollment;
    certificate: AcademyCertificate | null;
    busy: boolean;
    onCommand: AcademyCommandHandler;
    onDownloadCertificate: (certificate: AcademyCertificate) => Promise<void>;
    onBack: () => void;
};
const kindLabels = { text: 'Lesetext', video: 'Video', document: 'Dokument', quiz: 'Wissenscheck' } as const;
const displayDate = (value: string | null) => value ? new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('de-DE') : 'Ohne Frist';
const nextLesson = (enrollment: AcademyEnrollment) => enrollment.content.lessons.find(lesson => !enrollment.completedLessonIds.includes(lesson.id))?.id ?? enrollment.content.lessons[0]?.id ?? null;
export function AcademyLearningPlayer({ enrollment, certificate, busy, onCommand, onDownloadCertificate, onBack }: Props) {
    const [revision, setRevision] = useState(enrollment.revision);
    const [state, setState] = useState<AcademyEnrollmentState>(enrollment.state);
    const [completed, setCompleted] = useState(enrollment.completedLessonIds);
    const [attempts, setAttempts] = useState<AcademyAttempt[]>(enrollment.attempts);
    const [selectedId, setSelectedId] = useState<string | null>(() => nextLesson(enrollment));
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
    const [feedback, setFeedback] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const exam = enrollment.nrwExam;
    const lessons = enrollment.content.lessons;
    const selected = lessons.find(lesson => lesson.id === selectedId) ?? lessons[0] ?? null;
    const selectedIndex = selected ? lessons.findIndex(lesson => lesson.id === selected.id) : -1;
    const isFinal = Boolean(exam && selected?.id === NRW_FINAL_LESSON);
    const chapter = exam && selected ? /^nrw-(\d{2})-/.exec(selected.id)?.[1] : undefined;
    const chapterLessons = chapter ? lessons.filter(lesson => lesson.id.startsWith(`nrw-${chapter}-`)) : lessons;
    const caseLesson = Boolean(chapter && selected?.id.endsWith('-case'));
    const chosenAnswers = isFinal ? exam?.draftAnswers ?? {} : answers;
    const writable = !busy && (state === 'in_progress' || state === 'returned');
    const allDone = lessons.length > 0 && lessons.every(lesson => completed.includes(lesson.id));
    const progress = lessons.length ? Math.round(lessons.filter(lesson => completed.includes(lesson.id)).length / lessons.length * 100) : 0;
    const lessonAttempts = selected ? attempts.filter(attempt => attempt.lessonId === selected.id) : [];
    const attemptCount = lessonAttempts.reduce((maximum, attempt) => Math.max(maximum, attempt.attempt), 0);
    const latestAttempt = [...lessonAttempts].sort((a, b) => b.attempt - a.attempt)[0];
    const exhausted = exam ? isFinal && exam.state === 'failed' : attemptCount >= enrollment.content.maxAttempts;
    const answerLocked = !writable || completed.includes(selected?.id ?? '') || exhausted || (isFinal && exam?.state !== 'ready');
    const selectLesson = (id: string) => { setSelectedId(id); setFeedback(null); };
    const selectChapter = (code: string) => {
        const group = lessons.filter(lesson => lesson.id.startsWith(`nrw-${code}-`));
        const next = group.find(lesson => !completed.includes(lesson.id)) ?? group[0];
        if (next)
            selectLesson(next.id);
    };
    useEffect(() => {
        if (enrollment.revision < revision)
            return;
        setRevision(enrollment.revision);
        setState(enrollment.state);
        setCompleted(enrollment.completedLessonIds);
        setAttempts(enrollment.attempts);
    }, [enrollment.revision, enrollment.state, enrollment.completedLessonIds, enrollment.attempts, revision]);
    const start = async () => {
        const result = await onCommand('start_enrollment', {}, { id: enrollment.id, revision });
        if (result) {
            setRevision(result.revision);
            setState('in_progress');
            setFeedback(null);
        }
    };
    const markComplete = async (lesson: AcademyLesson) => {
        const result = await onCommand('complete_lesson', { lessonId: lesson.id }, { id: enrollment.id, revision });
        if (!result)
            return;
        setRevision(result.revision);
        setCompleted(previous => [...new Set([...previous, lesson.id])]);
        setFeedback('Ihre Bearbeitung wurde gespeichert.');
    };
    const selectAnswer = async (questionId: string, optionId: string) => {
        if (!isFinal) {
            setAnswers(previous => ({ ...previous, [questionId]: optionId }));
            return;
        }
        const result = await onCommand('save_nrw_exam_answer', { questionId, optionId }, { id: enrollment.id, revision });
        if (result)
            setRevision(result.revision);
    };
    const submitQuiz = async (lesson: AcademyLesson) => {
        const submittedAnswers = Object.fromEntries((lesson.questions ?? []).map(question => [question.id, answers[question.id]]));
        const result = await onCommand('submit_quiz', isFinal ? { lessonId: lesson.id } : { lessonId: lesson.id, answers: submittedAnswers }, { id: enrollment.id, revision });
        if (!result)
            return;
        setRevision(result.revision);
        if (typeof result.score === 'number' && typeof result.passed === 'boolean') {
            const attempt: AcademyAttempt = { lessonId: lesson.id, attempt: attemptCount + 1, score: result.score, passed: result.passed, submittedAt: new Date().toISOString() };
            setAttempts(previous => [...previous, attempt]);
            if (result.passed) {
                setCompleted(previous => [...new Set([...previous, lesson.id])]);
                if (isFinal)
                    setState('submitted');
            }
            const threshold = exam && !isFinal ? 'Für den Modulcheck sind zwei richtige Antworten nötig.' : `Die Bestehensgrenze liegt bei ${enrollment.content.passPercent} %.`;
            setFeedback(result.passed ? `${isFinal ? 'Abschlussprüfung' : 'Wissenscheck'} bestanden · ${result.score} %. Ihr Ergebnis wurde gespeichert.` : `Ergebnis · ${result.score} %. ${threshold}`);
        }
        else
            setFeedback('Ihre Antworten wurden gespeichert. Der aktuelle Lernstand wird geladen.');
    };
    const submit = async () => {
        const result = await onCommand('submit_enrollment', {}, { id: enrollment.id, revision });
        if (result) {
            setRevision(result.revision);
            setState('submitted');
            setFeedback('Ihre Schulung wurde zur Prüfung eingereicht. Sie sehen die Rückmeldung hier.');
        }
    };
    const download = async () => {
        if (!certificate)
            return;
        setDownloading(true);
        setDownloadError(null);
        try {
            await onDownloadCertificate(certificate);
        }
        catch {
            setDownloadError('Der Nachweis konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.');
        }
        finally {
            setDownloading(false);
        }
    };
    return <NativeSection className="ac-panel" aria-label="Lernbereich">
    <NativeDiv className="ac-panel-header"><NativeDiv><NativeP className="ac-eyebrow">MEINE SCHULUNG · FASSUNG {enrollment.versionNumber}</NativeP><NativeH2 className="ac-section-title">{enrollment.content.title}</NativeH2><NativeP className="ac-muted">{enrollment.content.summary}</NativeP></NativeDiv><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={onBack}>Zur Übersicht</NativeButton></NativeDiv>
    <NativeDiv className="ac-badges"><NativeSpan className="ac-status" data-tone={state === 'completed' ? 'good' : state === 'returned' ? 'attention' : 'neutral'}>{ACADEMY_STATE_LABELS[state]}</NativeSpan><NativeSpan className="ac-status" data-tone={isAcademyOverdue({ ...enrollment, state }) ? 'attention' : 'neutral'}>{enrollment.dueDate ? `Frist: ${displayDate(enrollment.dueDate)}` : 'Ohne Frist'}</NativeSpan><NativeSpan className="ac-muted">{exam ? '40 UE à 45 Minuten' : `Etwa ${enrollment.content.estimatedMinutes} Minuten`}</NativeSpan></NativeDiv>
    {exam && <NativeP className="ac-muted">{completed.filter(id => /-ue\d$/.test(id)).length} von 40 Unterrichtseinheiten bearbeitet</NativeP>}
    <NativeDiv className="ac-stat-line"><NativeSpan>{exam ? 'Gesamtfortschritt inkl. Prüfung' : `${completed.filter(id => lessons.some(lesson => lesson.id === id)).length} von ${lessons.length} Lektionen bearbeitet`}</NativeSpan><NativeStrong>{progress} %</NativeStrong></NativeDiv><NativeDiv className="ac-progress" role="progressbar" aria-label="Lernfortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><NativeSpan style={{ width: `${progress}%` }}/></NativeDiv>
    {enrollment.reviewNote && <NativeDiv className="ac-message" data-tone={state === 'returned' ? 'info' : 'success'}><NativeStrong>Rückmeldung zur Schulung</NativeStrong><NativeP>{enrollment.reviewNote}</NativeP></NativeDiv>}
    {feedback && <NativeDiv className="ac-message" data-tone="info" role="status">{feedback}</NativeDiv>}
    {state === 'assigned' && <NativeDiv className="ac-message" data-tone="info"><NativeP>Beginnen Sie in Ihrem eigenen Tempo. Bestätigte Lernschritte bleiben gespeichert, damit Sie später weiterlernen können.</NativeP><NativeButton type="button" className="ac-button primary" disabled={busy} onClick={() => void start()}>Schulung starten</NativeButton></NativeDiv>}
    {state === 'submitted' && <NativeDiv className="ac-message" data-tone="info">{exam ? 'Die Abschlussprüfung ist bestanden. Die Verwaltung prüft den Lernabschluss und den Praxisnachweis.' : 'Ihre Schulung ist eingereicht. Die zuständige Person prüft den Abschluss.'}</NativeDiv>}
    {state === 'cancelled' && <NativeDiv className="ac-message" data-tone="info">Diese Zuweisung wurde beendet. Der bisherige Lernstand bleibt einsehbar.</NativeDiv>}
    {state === 'completed' && <NativeDiv className="ac-message" data-tone="success"><NativeStrong>Die Schulung ist abgeschlossen.</NativeStrong><NativeP>{certificate?.revokedAt ? 'Der zugehörige Nachweis wurde zurückgenommen.' : 'Die Prüfung Ihres Abschlusses ist bestätigt.'}</NativeP>{certificate && !certificate.revokedAt && <NativeButton type="button" className="ac-button primary" disabled={busy || downloading} onClick={() => void download()}>{downloading ? 'Nachweis wird geöffnet…' : exam ? 'Zertifikat als PDF' : 'Nachweis als PDF'}</NativeButton>}{certificate?.revokedReason && <NativeP>{certificate.revokedReason}</NativeP>}{downloadError && <NativeP role="alert">{downloadError}</NativeP>}</NativeDiv>}
    {exam && <>
      <NativeDiv className="ac-nrw-practice"><NativeDiv><NativeStrong>Praxisnachweis</NativeStrong><NativeP className="ac-muted">{exam.practice ? `Nachweis vom ${displayDate(exam.practice.date)} geprüft.` : 'Reichen Sie den Nachweis der praktischen Notfallschulung oder eines passenden Erste-Hilfe-Kurses ein.'}</NativeP></NativeDiv>{!exam.practice && !['completed', 'cancelled'].includes(state) && <NativeA className="ac-button subtle" href={NRW_PRACTICE_UPLOAD}>Nachweis hochladen</NativeA>}</NativeDiv>
      <NativeNav className="ac-nrw-chapters" aria-label="Kursmodule">{NRW_MODULES.map((title, index) => {
                const code = nrwModuleCode(index);
                const done = lessons.filter(lesson => lesson.id.startsWith(`nrw-${code}-`)).every(lesson => completed.includes(lesson.id));
                return <NativeButton type="button" className="ac-nrw-chapter" key={code} aria-current={chapter === code ? 'step' : undefined} aria-label={`Modul ${index + 1} · ${title}${done ? ' · Bearbeitet' : ''}`} disabled={busy} onClick={() => selectChapter(code)}>{done ? '✓ ' : ''}{code}</NativeButton>;
            })}<NativeButton type="button" className="ac-nrw-chapter" aria-current={isFinal ? 'step' : undefined} aria-label="Abschlussprüfung" disabled={busy} onClick={() => selectLesson(NRW_FINAL_LESSON)}>Prüfung</NativeButton></NativeNav>
    </>}
    {chapter && <NativeLabel className="ac-field ac-nrw-compact-lesson">Lektion im Modul
      <NativeSelect className="ac-input" value={selectedId ?? ''} disabled={busy} onChange={event => selectLesson(event.target.value)}>
        {chapterLessons.map(lesson => <NativeOption key={lesson.id} value={lesson.id}>{completed.includes(lesson.id) ? '✓ ' : ''}{lesson.title}</NativeOption>)}
      </NativeSelect>
    </NativeLabel>}
    <NativeDiv className={exam ? `ac-editor-grid ac-nrw-editor${isFinal ? ' ac-nrw-final' : ''}` : 'ac-editor-grid'}>
      {(!exam || chapter) && <NativeNav className="ac-lesson-list" aria-label="Mein Lernweg">{chapterLessons.map((lesson, index) => <NativeButton type="button" className="ac-lesson-nav" key={lesson.id} aria-current={selected?.id === lesson.id ? 'step' : undefined} disabled={busy} onClick={() => { setSelectedId(lesson.id); setFeedback(null); }}><NativeSpan className="ac-lesson-number">{completed.includes(lesson.id) ? '✓' : String(index + 1).padStart(2, '0')}</NativeSpan><NativeSpan><NativeStrong>{lesson.title}</NativeStrong><NativeSmall>{chapter && lesson.id.endsWith('-case') ? 'Bildbeispiel' : kindLabels[lesson.kind]}{completed.includes(lesson.id) ? ' · Bearbeitet' : ''}</NativeSmall></NativeSpan></NativeButton>)}</NativeNav>}
      {selected ? <NativeArticle className="ac-editor-content" key={selected.id}>
        <NativeDiv className="ac-badges"><NativeSpan className="ac-status" data-tone="neutral">Lektion {selectedIndex + 1}</NativeSpan><NativeSpan className="ac-muted">{isFinal ? 'Abschlussprüfung' : caseLesson ? 'Bildbeispiel' : kindLabels[selected.kind]}</NativeSpan>{completed.includes(selected.id) && <NativeSpan className="ac-status" data-tone="good">Bearbeitet</NativeSpan>}</NativeDiv>
        <NativeH3 className="ac-section-title">{selected.title}</NativeH3>
        {chapter === '03' && selected.id.endsWith('-ue3') && <NativeA className="ac-button subtle small" href="https://www.drk.de/hilfe-in-deutschland/erste-hilfe/bewusstlosigkeit/" target="_blank" rel="noopener noreferrer">Erste Hilfe beim DRK nachlesen</NativeA>}
        {caseLesson && chapter ? <NrwIllustratedCase code={chapter} body={selected.body}/>
                : exam && chapter && selected.kind === 'text' ? <>
            <NativeImg className="ac-nrw-lesson-art" src={nrwModuleImage(chapter)} alt=""/>
            <NativeDiv className="ac-nrw-unit">{selected.body.split('\n\n').map((part, index) => {
                        const [heading, ...body] = part.split('\n');
                        return <NativeSection key={heading}><NativeH4>{heading}</NativeH4>{index > 0 && <NativeP>{body.join('\n')}</NativeP>}</NativeSection>;
                    })}</NativeDiv>
          </> : selected.body && <NativeDiv className="ac-learning-body">{selected.body}</NativeDiv>}
        {(selected.kind === 'video' || selected.kind === 'document') && <NativeDiv className="ac-resource"><NativeStrong>{selected.kind === 'video' ? 'Video zur Lektion' : 'Dokument zur Lektion'}</NativeStrong><NativeP className="ac-muted">Das Material wird auf der verlinkten Seite geöffnet. Kehren Sie anschließend hierher zurück, um Ihre Bearbeitung zu bestätigen.</NativeP>{academySafeResourceUrl(selected.url) ? <NativeA className="ac-button" href={academySafeResourceUrl(selected.url)!} target="_blank" rel="noopener noreferrer">{selected.kind === 'video' ? 'Video öffnen' : 'Dokument öffnen'} ↗</NativeA> : <NativeP className="ac-message" data-tone="error">Für diese Lektion ist kein verwendbarer Link hinterlegt. Bitte wenden Sie sich an die zuständige Person.</NativeP>}</NativeDiv>}
        {selected.kind === 'quiz' ? <NativeForm className="ac-quiz" onSubmit={event => { event.preventDefault(); void submitQuiz(selected); }}>
          {isFinal && exam ? <>
            <NativeP className="ac-muted">Versuche · {attemptCount} von {exam.attemptLimit}</NativeP>
            {exam.state === 'learning' && <NativeP className="ac-message" data-tone="info">Schließen Sie zuerst die acht Module mit den Praxisfällen und Wissenschecks ab.</NativeP>}
            {exam.state === 'ready' && <NativeP className="ac-message" data-tone="info" role="status">{Object.keys(chosenAnswers).length} von 16 Antworten gespeichert</NativeP>}
          </> : <NativeP className="ac-muted">{exam ? 'Für den Modulcheck sind zwei richtige Antworten nötig. Wiederholen Sie ihn bei Bedarf.' : `Wählen Sie pro Frage eine Antwort. Zum Bestehen benötigen Sie ${enrollment.content.passPercent} %. Bisher genutzt: ${attemptCount} von ${enrollment.content.maxAttempts} Versuchen.`}</NativeP>}
          <NativeFieldset disabled={answerLocked}>
            {(selected.questions ?? []).map((question, index) => <NativeDiv className="ac-question" key={question.id} role="group" aria-labelledby={`question-${question.id}`}><NativeH4 id={`question-${question.id}`}>{index + 1}. {question.prompt}</NativeH4>{question.options.map(option => <NativeLabel className="ac-quiz-option" key={option.id}><NativeInput type="radio" name={`answer-${question.id}`} checked={chosenAnswers[question.id] === option.id} onChange={() => void selectAnswer(question.id, option.id)}/><NativeSpan>{option.text}</NativeSpan></NativeLabel>)}</NativeDiv>)}
          </NativeFieldset>
          {latestAttempt && <NativeP className="ac-message" data-tone={latestAttempt.passed ? 'success' : 'info'}>Letztes Ergebnis: {latestAttempt.score} % · {latestAttempt.passed ? 'Bestanden' : 'Noch nicht bestanden'}</NativeP>}
          {exhausted && !completed.includes(selected.id) && <NativeP className="ac-message" data-tone="info">{isFinal ? 'Die Verwaltung kann nach der Rücksprache einen weiteren Versuch freigeben.' : 'Ihre Versuche sind aufgebraucht. Bitte klären Sie die nächsten Schritte mit der zuständigen Person.'}</NativeP>}
          <NativeButton type="submit" className="ac-button primary" disabled={answerLocked || !selected.questions?.length || selected.questions.some(question => !chosenAnswers[question.id])}>{completed.includes(selected.id) ? isFinal ? 'Abschlussprüfung bestanden' : 'Wissenscheck bestanden' : isFinal ? 'Prüfung abgeben' : 'Antworten abgeben'}</NativeButton>
        </NativeForm> : <NativeDiv className="ac-lesson-actions"><NativeLabel className="ac-checkbox-label"><NativeInput type="checkbox" disabled={!writable || completed.includes(selected.id)} checked={completed.includes(selected.id) || Boolean(acknowledged[selected.id])} onChange={event => setAcknowledged(previous => ({ ...previous, [selected.id]: event.target.checked }))}/>Ich habe das Material bearbeitet.</NativeLabel><NativeP className="ac-muted">Diese Bestätigung dokumentiert Ihre Bearbeitung. Sie ersetzt keine praktische Prüfung.</NativeP><NativeButton type="button" className="ac-button primary" disabled={!writable || completed.includes(selected.id) || !acknowledged[selected.id] || (selected.kind !== 'text' && !academySafeResourceUrl(selected.url))} onClick={() => void markComplete(selected)}>{completed.includes(selected.id) ? 'Bearbeitung gespeichert' : 'Bearbeitung bestätigen'}</NativeButton></NativeDiv>}
        <NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button subtle" disabled={busy || selectedIndex <= 0} onClick={() => { setSelectedId(lessons[selectedIndex - 1]!.id); setFeedback(null); }}>Vorherige Lektion</NativeButton><NativeButton type="button" className="ac-button subtle" disabled={busy || selectedIndex >= lessons.length - 1} onClick={() => { setSelectedId(lessons[selectedIndex + 1]!.id); setFeedback(null); }}>Nächste Lektion</NativeButton></NativeDiv>
      </NativeArticle> : <NativeDiv className="ac-empty"><NativeH3>Keine Lerninhalte verfügbar</NativeH3><NativeP>Die zugewiesene Fassung enthält keine Lektionen. Bitte wenden Sie sich an die zuständige Person.</NativeP></NativeDiv>}
    </NativeDiv>
    {(!exam || state === 'returned') && <NativeDiv className="ac-editor-footer"><NativeDiv><NativeStrong>{allDone ? 'Alle Lektionen bearbeitet' : 'Schritt für Schritt zum Abschluss'}</NativeStrong><NativeP className="ac-muted">{allDone ? 'Reichen Sie die Schulung zur Prüfung ein. Ihr Nachweis entsteht nach bestätigter Freigabe.' : 'Bearbeiten Sie alle Lektionen und bestehen Sie die Wissenschecks, bevor Sie einreichen.'}</NativeP></NativeDiv><NativeButton type="button" className="ac-button primary" disabled={!writable || !allDone} onClick={() => void submit()}>Zur Prüfung einreichen</NativeButton></NativeDiv>}
  </NativeSection>;
}
function NrwIllustratedCase({ code, body }: {
    code: string;
    body: string;
}) {
    const [scene, question, solution] = body.split('\n\n').map(part => part.split('\n').slice(1).join('\n'));
    const source = nrwModuleImage(code, true);
    return <NativeDiv className="ac-nrw-case">
    <NativeFigure>
      <NativeImg src={source} alt={scene}/>
      <NativeFigcaption><NativeStrong>Aus der Praxis</NativeStrong><NativeA className="ac-button subtle small" href={source} target="_blank" rel="noopener noreferrer">Bild vergrößern</NativeA></NativeFigcaption>
    </NativeFigure>
    <NativeSection className="ac-nrw-observe"><NativeH4>Was fällt Ihnen auf?</NativeH4><NativeP>{question}</NativeP></NativeSection>
    <NativeDetails className="ac-nrw-solution"><NativeSummary>Auflösung ansehen</NativeSummary><NativeP>{solution}</NativeP></NativeDetails>
  </NativeDiv>;
}
