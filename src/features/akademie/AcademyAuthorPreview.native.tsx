// Generated native presentation from src/features/akademie/AcademyAuthorPreview.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeDiv,NativeP,NativeH2,NativeButton,NativeStrong,NativeSpan,NativeNav,NativeSmall,NativeArticle,NativeH3,NativeA,NativeForm,NativeFieldset,NativeH4,NativeLabel,NativeInput} from '@/components/layout/NativeWorkspaceElements.native';
import { useState } from 'react';
import { academySafeResourceUrl, type AcademyContent } from '@/lib/akademie/workspaceModel';
type Props = {
    content: AcademyContent;
    busy: boolean;
    onClose: () => void;
};
const kindLabels = { text: 'Lesetext', video: 'Video', document: 'Dokument', quiz: 'Wissenscheck' } as const;
/** Local authoring preview. This component deliberately has no service or mutation prop. */
export function AcademyAuthorPreview({ content, busy, onClose }: Props) {
    const [selectedId, setSelectedId] = useState(content.lessons[0]?.id ?? null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [completed, setCompleted] = useState<string[]>([]);
    const [results, setResults] = useState<Record<string, {
        score: number;
        passed: boolean;
    }>>({});
    const selected = content.lessons.find(lesson => lesson.id === selectedId) ?? content.lessons[0] ?? null;
    const selectedIndex = selected ? content.lessons.findIndex(lesson => lesson.id === selected.id) : -1;
    const progress = content.lessons.length ? Math.round(completed.length / content.lessons.length * 100) : 0;
    const questions = selected?.questions ?? [];
    const result = selected ? results[selected.id] : null;
    const testQuiz = () => {
        if (!selected || !questions.length || busy)
            return;
        const score = Math.round(questions.filter(question => question.correctOptionId && answers[question.id] === question.correctOptionId).length * 100 / questions.length);
        const passed = score >= content.passPercent;
        setResults(previous => ({ ...previous, [selected.id]: { score, passed } }));
        setCompleted(previous => passed ? [...new Set([...previous, selected.id])] : previous.filter(id => id !== selected.id));
    };
    return <NativeSection className="ac-panel ac-author-preview" aria-label="Vorschau für Lernende">
    <NativeDiv className="ac-panel-header"><NativeDiv><NativeP className="ac-eyebrow">KURSVORSCHAU</NativeP><NativeH2 className="ac-section-title">{content.title || 'Kurstitel noch ergänzen'}</NativeH2><NativeP className="ac-muted">{content.summary || 'Das Lernziel ist noch nicht beschrieben.'}</NativeP></NativeDiv><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={onClose}>Zurück zur Bearbeitung</NativeButton></NativeDiv>
    <NativeDiv className="ac-message ac-preview-banner" data-tone="info"><NativeStrong>Vorschau für Lernende</NativeStrong><NativeP>Sie probieren den aktuellen Entwurf aus. Antworten und Fortschritt gelten nur für diese Vorschau und werden beim Schließen verworfen.</NativeP></NativeDiv>
    <NativeDiv className="ac-badges"><NativeSpan className="ac-status">{content.category || 'Allgemein'}</NativeSpan><NativeSpan className="ac-muted">Etwa {content.estimatedMinutes} Minuten</NativeSpan>{content.mandatory && <NativeSpan className="ac-status" data-tone="attention">Verpflichtend</NativeSpan>}</NativeDiv>
    <NativeDiv className="ac-stat-line"><NativeSpan>{completed.length} von {content.lessons.length} Lektionen in der Vorschau bearbeitet</NativeSpan><NativeStrong>{progress} %</NativeStrong></NativeDiv><NativeDiv className="ac-progress" role="progressbar" aria-label="Vorschaufortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><NativeSpan style={{ width: `${progress}%` }}/></NativeDiv>
    <NativeDiv className="ac-editor-grid">
      <NativeNav className="ac-lesson-list" aria-label="Lernweg in der Vorschau">{content.lessons.map((lesson, index) => <NativeButton type="button" className="ac-lesson-nav" key={lesson.id} disabled={busy} aria-current={lesson.id === selected?.id ? 'step' : undefined} onClick={() => setSelectedId(lesson.id)}><NativeSpan className="ac-lesson-number">{completed.includes(lesson.id) ? '✓' : String(index + 1).padStart(2, '0')}</NativeSpan><NativeSpan><NativeStrong>{lesson.title || `Lektion ${index + 1}`}</NativeStrong><NativeSmall>{kindLabels[lesson.kind]}</NativeSmall></NativeSpan></NativeButton>)}</NativeNav>
      {selected ? <NativeArticle className="ac-editor-content" key={selected.id}>
        <NativeDiv className="ac-badges"><NativeSpan className="ac-status">Lektion {selectedIndex + 1}</NativeSpan><NativeSpan className="ac-muted">{kindLabels[selected.kind]}</NativeSpan></NativeDiv><NativeH3 className="ac-section-title">{selected.title || 'Lektionstitel noch ergänzen'}</NativeH3>
        {selected.body ? <NativeDiv className="ac-learning-body">{selected.body}</NativeDiv> : selected.kind === 'text' ? <NativeP className="ac-muted">Für diese Lektion fehlt noch der Lerninhalt.</NativeP> : null}
        {(selected.kind === 'video' || selected.kind === 'document') && <NativeDiv className="ac-resource"><NativeStrong>{selected.kind === 'video' ? 'Video zur Lektion' : 'Dokument zur Lektion'}</NativeStrong>{academySafeResourceUrl(selected.url) ? <NativeA className="ac-button" href={academySafeResourceUrl(selected.url)!} target="_blank" rel="noopener noreferrer">{selected.kind === 'video' ? 'Video öffnen' : 'Dokument öffnen'} ↗</NativeA> : <NativeP className="ac-message" data-tone="error">Ein verwendbarer HTTPS-Link fehlt noch.</NativeP>}</NativeDiv>}
        {selected.kind === 'quiz' ? <NativeForm className="ac-quiz" onSubmit={event => { event.preventDefault(); testQuiz(); }}>
          <NativeP className="ac-muted">Wählen Sie pro Frage eine Antwort. Die Bestehensgrenze beträgt {content.passPercent} %. Die Vorschau verbraucht keine Lernversuche.</NativeP>
          <NativeFieldset disabled={busy}>{questions.map((question, index) => <NativeDiv className="ac-question" key={question.id} role="group" aria-labelledby={`preview-question-${question.id}`}><NativeH4 id={`preview-question-${question.id}`}>{index + 1}. {question.prompt || 'Fragestellung noch ergänzen'}</NativeH4>{question.options.map((option, optionIndex) => <NativeLabel className="ac-quiz-option" key={option.id}><NativeInput type="radio" name={`preview-answer-${question.id}`} checked={answers[question.id] === option.id} onChange={() => setAnswers(previous => ({ ...previous, [question.id]: option.id }))}/><NativeSpan>{option.text || `Antwort ${optionIndex + 1} noch ergänzen`}</NativeSpan></NativeLabel>)}</NativeDiv>)}</NativeFieldset>
          {result && <NativeP className="ac-message ac-preview-result" data-tone={result.passed ? 'success' : 'info'} role="status">Vorschauergebnis: {result.score} % · {result.passed ? 'Bestehensgrenze erreicht' : 'Bestehensgrenze noch nicht erreicht'}</NativeP>}
          <NativeButton type="submit" className="ac-button primary" disabled={busy || !questions.length || questions.some(question => !answers[question.id] || !question.correctOptionId)}>Antworten in der Vorschau prüfen</NativeButton>
        </NativeForm> : <NativeDiv className="ac-lesson-actions"><NativeButton type="button" className="ac-button" disabled={busy || completed.includes(selected.id) || (selected.kind !== 'text' && !academySafeResourceUrl(selected.url))} onClick={() => setCompleted(previous => [...new Set([...previous, selected.id])])}>{completed.includes(selected.id) ? 'In Vorschau bearbeitet' : 'In Vorschau als bearbeitet markieren'}</NativeButton></NativeDiv>}
        <NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button subtle" disabled={busy || selectedIndex <= 0} onClick={() => setSelectedId(content.lessons[selectedIndex - 1]!.id)}>Vorherige Lektion</NativeButton><NativeButton type="button" className="ac-button subtle" disabled={busy || selectedIndex >= content.lessons.length - 1} onClick={() => setSelectedId(content.lessons[selectedIndex + 1]!.id)}>Nächste Lektion</NativeButton></NativeDiv>
      </NativeArticle> : <NativeDiv className="ac-empty"><NativeH3>Der Lernweg ist noch leer</NativeH3><NativeP>Ergänzen Sie Lektionen in der Bearbeitung, um den Kurs hier auszuprobieren.</NativeP></NativeDiv>}
    </NativeDiv>
  </NativeSection>;
}
