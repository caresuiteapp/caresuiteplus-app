import { useState } from 'react';
import { academySafeResourceUrl, type AcademyContent } from '@/lib/akademie/workspaceModel';

type Props = { content: AcademyContent; busy: boolean; onClose: () => void };
const kindLabels = { text: 'Lesetext', video: 'Video', document: 'Dokument', quiz: 'Wissenscheck' } as const;

/** Local authoring preview. This component deliberately has no service or mutation prop. */
export function AcademyAuthorPreview({ content, busy, onClose }: Props) {
  const [selectedId, setSelectedId] = useState(content.lessons[0]?.id ?? null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, { score: number; passed: boolean }>>({});
  const selected = content.lessons.find(lesson => lesson.id === selectedId) ?? content.lessons[0] ?? null;
  const selectedIndex = selected ? content.lessons.findIndex(lesson => lesson.id === selected.id) : -1;
  const progress = content.lessons.length ? Math.round(completed.length / content.lessons.length * 100) : 0;
  const questions = selected?.questions ?? [];
  const result = selected ? results[selected.id] : null;
  const testQuiz = () => {
    if (!selected || !questions.length || busy) return;
    const score = Math.round(questions.filter(question => question.correctOptionId && answers[question.id] === question.correctOptionId).length * 100 / questions.length);
    const passed = score >= content.passPercent;
    setResults(previous => ({ ...previous, [selected.id]: { score, passed } }));
    setCompleted(previous => passed ? [...new Set([...previous, selected.id])] : previous.filter(id => id !== selected.id));
  };
  return <section className="ac-panel ac-author-preview" aria-label="Vorschau für Lernende">
    <div className="ac-panel-header"><div><p className="ac-eyebrow">KURSVORSCHAU</p><h2 className="ac-section-title">{content.title || 'Kurstitel noch ergänzen'}</h2><p className="ac-muted">{content.summary || 'Das Lernziel ist noch nicht beschrieben.'}</p></div><button type="button" className="ac-button subtle" disabled={busy} onClick={onClose}>Zurück zur Bearbeitung</button></div>
    <div className="ac-message ac-preview-banner" data-tone="info"><strong>Vorschau für Lernende</strong><p>Sie probieren den aktuellen Entwurf aus. Antworten und Fortschritt gelten nur für diese Vorschau und werden beim Schließen verworfen.</p></div>
    <div className="ac-badges"><span className="ac-status">{content.category || 'Allgemein'}</span><span className="ac-muted">Etwa {content.estimatedMinutes} Minuten</span>{content.mandatory && <span className="ac-status" data-tone="attention">Verpflichtend</span>}</div>
    <div className="ac-stat-line"><span>{completed.length} von {content.lessons.length} Lektionen in der Vorschau bearbeitet</span><strong>{progress} %</strong></div><div className="ac-progress" role="progressbar" aria-label="Vorschaufortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
    <div className="ac-editor-grid">
      <nav className="ac-lesson-list" aria-label="Lernweg in der Vorschau">{content.lessons.map((lesson, index) => <button type="button" className="ac-lesson-nav" key={lesson.id} disabled={busy} aria-current={lesson.id === selected?.id ? 'step' : undefined} onClick={() => setSelectedId(lesson.id)}><span className="ac-lesson-number">{completed.includes(lesson.id) ? '✓' : String(index + 1).padStart(2, '0')}</span><span><strong>{lesson.title || `Lektion ${index + 1}`}</strong><small>{kindLabels[lesson.kind]}</small></span></button>)}</nav>
      {selected ? <article className="ac-editor-content" key={selected.id}>
        <div className="ac-badges"><span className="ac-status">Lektion {selectedIndex + 1}</span><span className="ac-muted">{kindLabels[selected.kind]}</span></div><h3 className="ac-section-title">{selected.title || 'Lektionstitel noch ergänzen'}</h3>
        {selected.body ? <div className="ac-learning-body">{selected.body}</div> : selected.kind === 'text' ? <p className="ac-muted">Für diese Lektion fehlt noch der Lerninhalt.</p> : null}
        {(selected.kind === 'video' || selected.kind === 'document') && <div className="ac-resource"><strong>{selected.kind === 'video' ? 'Video zur Lektion' : 'Dokument zur Lektion'}</strong>{academySafeResourceUrl(selected.url) ? <a className="ac-button" href={academySafeResourceUrl(selected.url)!} target="_blank" rel="noopener noreferrer">{selected.kind === 'video' ? 'Video öffnen' : 'Dokument öffnen'} ↗</a> : <p className="ac-message" data-tone="error">Ein verwendbarer HTTPS-Link fehlt noch.</p>}</div>}
        {selected.kind === 'quiz' ? <form className="ac-quiz" onSubmit={event => { event.preventDefault(); testQuiz(); }}>
          <p className="ac-muted">Wählen Sie pro Frage eine Antwort. Die Bestehensgrenze beträgt {content.passPercent} %. Die Vorschau verbraucht keine Lernversuche.</p>
          <fieldset disabled={busy}>{questions.map((question, index) => <div className="ac-question" key={question.id} role="group" aria-labelledby={`preview-question-${question.id}`}><h4 id={`preview-question-${question.id}`}>{index + 1}. {question.prompt || 'Fragestellung noch ergänzen'}</h4>{question.options.map((option, optionIndex) => <label className="ac-quiz-option" key={option.id}><input type="radio" name={`preview-answer-${question.id}`} checked={answers[question.id] === option.id} onChange={() => setAnswers(previous => ({ ...previous, [question.id]: option.id }))} /><span>{option.text || `Antwort ${optionIndex + 1} noch ergänzen`}</span></label>)}</div>)}</fieldset>
          {result && <p className="ac-message ac-preview-result" data-tone={result.passed ? 'success' : 'info'} role="status">Vorschauergebnis: {result.score} % · {result.passed ? 'Bestehensgrenze erreicht' : 'Bestehensgrenze noch nicht erreicht'}</p>}
          <button type="submit" className="ac-button primary" disabled={busy || !questions.length || questions.some(question => !answers[question.id] || !question.correctOptionId)}>Antworten in der Vorschau prüfen</button>
        </form> : <div className="ac-lesson-actions"><button type="button" className="ac-button" disabled={busy || completed.includes(selected.id) || (selected.kind !== 'text' && !academySafeResourceUrl(selected.url))} onClick={() => setCompleted(previous => [...new Set([...previous, selected.id])])}>{completed.includes(selected.id) ? 'In Vorschau bearbeitet' : 'In Vorschau als bearbeitet markieren'}</button></div>}
        <div className="ac-card-actions"><button type="button" className="ac-button subtle" disabled={busy || selectedIndex <= 0} onClick={() => setSelectedId(content.lessons[selectedIndex - 1]!.id)}>Vorherige Lektion</button><button type="button" className="ac-button subtle" disabled={busy || selectedIndex >= content.lessons.length - 1} onClick={() => setSelectedId(content.lessons[selectedIndex + 1]!.id)}>Nächste Lektion</button></div>
      </article> : <div className="ac-empty"><h3>Der Lernweg ist noch leer</h3><p>Ergänzen Sie Lektionen in der Bearbeitung, um den Kurs hier auszuprobieren.</p></div>}
    </div>
  </section>;
}
