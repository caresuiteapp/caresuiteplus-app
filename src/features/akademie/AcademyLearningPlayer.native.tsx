// Generated native presentation from src/features/akademie/AcademyLearningPlayer.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeDiv,NativeP,NativeH2,NativeButton,NativeSpan,NativeStrong,NativeNav,NativeSmall,NativeArticle,NativeH3,NativeA,NativeForm,NativeFieldset,NativeH4,NativeLabel,NativeInput} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useState } from 'react';
import { ACADEMY_STATE_LABELS, academySafeResourceUrl, isAcademyOverdue, type AcademyAttempt, type AcademyCertificate, type AcademyCommandHandler, type AcademyEnrollment, type AcademyEnrollmentState, type AcademyLesson, } from '@/lib/akademie/workspaceModel';
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
    const lessons = enrollment.content.lessons;
    const selected = lessons.find(lesson => lesson.id === selectedId) ?? lessons[0] ?? null;
    const selectedIndex = selected ? lessons.findIndex(lesson => lesson.id === selected.id) : -1;
    const writable = !busy && (state === 'in_progress' || state === 'returned');
    const allDone = lessons.length > 0 && lessons.every(lesson => completed.includes(lesson.id));
    const progress = lessons.length ? Math.round(lessons.filter(lesson => completed.includes(lesson.id)).length / lessons.length * 100) : 0;
    const lessonAttempts = selected ? attempts.filter(attempt => attempt.lessonId === selected.id) : [];
    const attemptCount = lessonAttempts.reduce((maximum, attempt) => Math.max(maximum, attempt.attempt), 0);
    const latestAttempt = [...lessonAttempts].sort((a, b) => b.attempt - a.attempt)[0];
    const exhausted = attemptCount >= enrollment.content.maxAttempts;
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
    const submitQuiz = async (lesson: AcademyLesson) => {
        const submittedAnswers = Object.fromEntries((lesson.questions ?? []).map(question => [question.id, answers[question.id]]));
        const result = await onCommand('submit_quiz', { lessonId: lesson.id, answers: submittedAnswers }, { id: enrollment.id, revision });
        if (!result)
            return;
        setRevision(result.revision);
        if (typeof result.score === 'number' && typeof result.passed === 'boolean') {
            const attempt: AcademyAttempt = { lessonId: lesson.id, attempt: attemptCount + 1, score: result.score, passed: result.passed, submittedAt: new Date().toISOString() };
            setAttempts(previous => [...previous, attempt]);
            if (result.passed)
                setCompleted(previous => [...new Set([...previous, lesson.id])]);
            setFeedback(result.passed ? `Wissenscheck bestanden: ${result.score} %. Ihr Ergebnis wurde gespeichert.` : `Ergebnis: ${result.score} %. Die Bestehensgrenze liegt bei ${enrollment.content.passPercent} %.`);
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
    <NativeDiv className="ac-badges"><NativeSpan className="ac-status" data-tone={state === 'completed' ? 'good' : state === 'returned' ? 'attention' : 'neutral'}>{ACADEMY_STATE_LABELS[state]}</NativeSpan><NativeSpan className="ac-status" data-tone={isAcademyOverdue({ ...enrollment, state }) ? 'attention' : 'neutral'}>{enrollment.dueDate ? `Frist: ${displayDate(enrollment.dueDate)}` : 'Ohne Frist'}</NativeSpan><NativeSpan className="ac-muted">Etwa {enrollment.content.estimatedMinutes} Minuten</NativeSpan></NativeDiv>
    <NativeDiv className="ac-stat-line"><NativeSpan>{completed.filter(id => lessons.some(lesson => lesson.id === id)).length} von {lessons.length} Lektionen bearbeitet</NativeSpan><NativeStrong>{progress} %</NativeStrong></NativeDiv><NativeDiv className="ac-progress" role="progressbar" aria-label="Lernfortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><NativeSpan style={{ width: `${progress}%` }}/></NativeDiv>
    {enrollment.reviewNote && <NativeDiv className="ac-message" data-tone={state === 'returned' ? 'info' : 'success'}><NativeStrong>Rückmeldung zur Schulung</NativeStrong><NativeP>{enrollment.reviewNote}</NativeP></NativeDiv>}
    {feedback && <NativeDiv className="ac-message" data-tone="info" role="status">{feedback}</NativeDiv>}
    {state === 'assigned' && <NativeDiv className="ac-message" data-tone="info"><NativeP>Beginnen Sie in Ihrem eigenen Tempo. Bestätigte Lernschritte bleiben gespeichert, damit Sie später weiterlernen können.</NativeP><NativeButton type="button" className="ac-button primary" disabled={busy} onClick={() => void start()}>Schulung starten</NativeButton></NativeDiv>}
    {state === 'submitted' && <NativeDiv className="ac-message" data-tone="info">Ihre Schulung ist eingereicht. Die zuständige Person prüft den Abschluss.</NativeDiv>}
    {state === 'cancelled' && <NativeDiv className="ac-message" data-tone="info">Diese Zuweisung wurde beendet. Der bisherige Lernstand bleibt einsehbar.</NativeDiv>}
    {state === 'completed' && <NativeDiv className="ac-message" data-tone="success"><NativeStrong>Die Schulung ist abgeschlossen.</NativeStrong><NativeP>{certificate?.revokedAt ? 'Der zugehörige Nachweis wurde zurückgenommen.' : 'Die Prüfung Ihres Abschlusses ist bestätigt.'}</NativeP>{certificate && !certificate.revokedAt && <NativeButton type="button" className="ac-button primary" disabled={busy || downloading} onClick={() => void download()}>{downloading ? 'Nachweis wird geöffnet…' : 'Nachweis als PDF'}</NativeButton>}{certificate?.revokedReason && <NativeP>{certificate.revokedReason}</NativeP>}{downloadError && <NativeP role="alert">{downloadError}</NativeP>}</NativeDiv>}
    <NativeDiv className="ac-editor-grid">
      <NativeNav className="ac-lesson-list" aria-label="Mein Lernweg">{lessons.map((lesson, index) => <NativeButton type="button" className="ac-lesson-nav" key={lesson.id} aria-current={selected?.id === lesson.id ? 'step' : undefined} disabled={busy} onClick={() => { setSelectedId(lesson.id); setFeedback(null); }}><NativeSpan className="ac-lesson-number">{completed.includes(lesson.id) ? '✓' : String(index + 1).padStart(2, '0')}</NativeSpan><NativeSpan><NativeStrong>{lesson.title}</NativeStrong><NativeSmall>{kindLabels[lesson.kind]}{completed.includes(lesson.id) ? ' · Bearbeitet' : ''}</NativeSmall></NativeSpan></NativeButton>)}</NativeNav>
      {selected ? <NativeArticle className="ac-editor-content" key={selected.id}>
        <NativeDiv className="ac-badges"><NativeSpan className="ac-status" data-tone="neutral">Lektion {selectedIndex + 1}</NativeSpan><NativeSpan className="ac-muted">{kindLabels[selected.kind]}</NativeSpan>{completed.includes(selected.id) && <NativeSpan className="ac-status" data-tone="good">Bearbeitet</NativeSpan>}</NativeDiv>
        <NativeH3 className="ac-section-title">{selected.title}</NativeH3>
        {selected.body && <NativeDiv className="ac-learning-body">{selected.body}</NativeDiv>}
        {(selected.kind === 'video' || selected.kind === 'document') && <NativeDiv className="ac-resource"><NativeStrong>{selected.kind === 'video' ? 'Video zur Lektion' : 'Dokument zur Lektion'}</NativeStrong><NativeP className="ac-muted">Das Material wird auf der verlinkten Seite geöffnet. Kehren Sie anschließend hierher zurück, um Ihre Bearbeitung zu bestätigen.</NativeP>{academySafeResourceUrl(selected.url) ? <NativeA className="ac-button" href={academySafeResourceUrl(selected.url)!} target="_blank" rel="noopener noreferrer">{selected.kind === 'video' ? 'Video öffnen' : 'Dokument öffnen'} ↗</NativeA> : <NativeP className="ac-message" data-tone="error">Für diese Lektion ist kein verwendbarer Link hinterlegt. Bitte wenden Sie sich an die zuständige Person.</NativeP>}</NativeDiv>}
        {selected.kind === 'quiz' ? <NativeForm className="ac-quiz" onSubmit={event => { event.preventDefault(); void submitQuiz(selected); }}>
          <NativeP className="ac-muted">Wählen Sie pro Frage eine Antwort. Zum Bestehen benötigen Sie {enrollment.content.passPercent} %. Bisher genutzt: {attemptCount} von {enrollment.content.maxAttempts} Versuchen.</NativeP>
          <NativeFieldset disabled={!writable || completed.includes(selected.id) || exhausted}>
            {(selected.questions ?? []).map((question, index) => <NativeDiv className="ac-question" key={question.id} role="group" aria-labelledby={`question-${question.id}`}><NativeH4 id={`question-${question.id}`}>{index + 1}. {question.prompt}</NativeH4>{question.options.map(option => <NativeLabel className="ac-quiz-option" key={option.id}><NativeInput type="radio" name={`answer-${question.id}`} checked={answers[question.id] === option.id} onChange={() => setAnswers(previous => ({ ...previous, [question.id]: option.id }))}/><NativeSpan>{option.text}</NativeSpan></NativeLabel>)}</NativeDiv>)}
          </NativeFieldset>
          {latestAttempt && <NativeP className="ac-message" data-tone={latestAttempt.passed ? 'success' : 'info'}>Letztes Ergebnis: {latestAttempt.score} % · {latestAttempt.passed ? 'Bestanden' : 'Noch nicht bestanden'}</NativeP>}
          {exhausted && !completed.includes(selected.id) && <NativeP className="ac-message" data-tone="info">Ihre Versuche sind aufgebraucht. Bitte klären Sie die nächsten Schritte mit der zuständigen Person.</NativeP>}
          <NativeButton type="submit" className="ac-button primary" disabled={!writable || completed.includes(selected.id) || exhausted || !selected.questions?.length || selected.questions.some(question => !answers[question.id])}>{completed.includes(selected.id) ? 'Wissenscheck bestanden' : 'Antworten abgeben'}</NativeButton>
        </NativeForm> : <NativeDiv className="ac-lesson-actions"><NativeLabel className="ac-checkbox-label"><NativeInput type="checkbox" disabled={!writable || completed.includes(selected.id)} checked={completed.includes(selected.id) || Boolean(acknowledged[selected.id])} onChange={event => setAcknowledged(previous => ({ ...previous, [selected.id]: event.target.checked }))}/>Ich habe das Material bearbeitet.</NativeLabel><NativeP className="ac-muted">Diese Bestätigung dokumentiert Ihre Bearbeitung. Sie ersetzt keine praktische Prüfung.</NativeP><NativeButton type="button" className="ac-button primary" disabled={!writable || completed.includes(selected.id) || !acknowledged[selected.id] || (selected.kind !== 'text' && !academySafeResourceUrl(selected.url))} onClick={() => void markComplete(selected)}>{completed.includes(selected.id) ? 'Bearbeitung gespeichert' : 'Bearbeitung bestätigen'}</NativeButton></NativeDiv>}
        <NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button subtle" disabled={busy || selectedIndex <= 0} onClick={() => { setSelectedId(lessons[selectedIndex - 1]!.id); setFeedback(null); }}>Vorherige Lektion</NativeButton><NativeButton type="button" className="ac-button subtle" disabled={busy || selectedIndex >= lessons.length - 1} onClick={() => { setSelectedId(lessons[selectedIndex + 1]!.id); setFeedback(null); }}>Nächste Lektion</NativeButton></NativeDiv>
      </NativeArticle> : <NativeDiv className="ac-empty"><NativeH3>Keine Lerninhalte verfügbar</NativeH3><NativeP>Die zugewiesene Fassung enthält keine Lektionen. Bitte wenden Sie sich an die zuständige Person.</NativeP></NativeDiv>}
    </NativeDiv>
    <NativeDiv className="ac-editor-footer"><NativeDiv><NativeStrong>{allDone ? 'Alle Lektionen bearbeitet' : 'Schritt für Schritt zum Abschluss'}</NativeStrong><NativeP className="ac-muted">{allDone ? 'Reichen Sie die Schulung zur Prüfung ein. Ihr Nachweis entsteht nach bestätigter Freigabe.' : 'Bearbeiten Sie alle Lektionen und bestehen Sie die Wissenschecks, bevor Sie einreichen.'}</NativeP></NativeDiv><NativeButton type="button" className="ac-button primary" disabled={!writable || !allDone} onClick={() => void submit()}>Zur Prüfung einreichen</NativeButton></NativeDiv>
  </NativeSection>;
}
