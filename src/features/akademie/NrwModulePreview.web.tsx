import { useState } from 'react';
import { nrwModuleCode, NRW_MODULES } from '@/lib/akademie/nrwCourse';
import type { AcademyLesson } from '@/lib/akademie/workspaceModel';
import { AcademyDialog } from './AcademyDialog.web';
import { NrwLessonContent } from './NrwLessonContent.web';

export function NrwModulePreview({ index, lessons, onClose }: {
  index: number; lessons: AcademyLesson[]; onClose: () => void;
}) {
  const code = nrwModuleCode(index);
  const moduleLessons = lessons.filter(lesson => lesson.id.startsWith(`nrw-${code}-`));
  const [selectedId, setSelectedId] = useState(moduleLessons[0]?.id);
  const lesson = moduleLessons.find(item => item.id === selectedId);
  return <AcademyDialog title={`Modul ${code} · ${NRW_MODULES[index]}`} onClose={onClose}>
    <p className="ac-muted">Kursvorschau für die Verwaltung · 5 Unterrichtseinheiten, Praxisfall und Wissenscheck</p>
    <div className="ac-nrw-preview-navigation">
      <label className="ac-field">Lektion in der Vorschau
        <select className="ac-input" value={selectedId ?? ''} onChange={event => setSelectedId(event.target.value)}>
          {moduleLessons.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      {moduleLessons.some(item => item.id.endsWith('-case')) && <button type="button" className="ac-button" onClick={() => setSelectedId(`nrw-${code}-case`)}>Praxisbild ansehen</button>}
    </div>
    {lesson && <article className="ac-editor-content" key={lesson.id}>
      <h3 className="ac-section-title">{lesson.title}</h3>
      {lesson.kind === 'quiz' ? <>
        <p className="ac-muted">{lesson.body}</p>
        <ol className="ac-nrw-preview-questions">{lesson.questions?.map(question => <li key={question.id}>
          <strong>{question.prompt}</strong>
          <ul>{question.options.map(option => <li key={option.id}>{option.text}</li>)}</ul>
        </li>)}</ol>
      </> : <NrwLessonContent lesson={lesson} code={code} />}
      <div className="ac-card-actions">
        <button type="button" className="ac-button" disabled={moduleLessons[0]?.id === lesson.id} onClick={() => setSelectedId(moduleLessons[moduleLessons.indexOf(lesson) - 1]?.id)}>Vorherige Lektion</button>
        <button type="button" className="ac-button" disabled={moduleLessons.at(-1)?.id === lesson.id} onClick={() => setSelectedId(moduleLessons[moduleLessons.indexOf(lesson) + 1]?.id)}>Nächste Lektion</button>
      </div>
    </article>}
  </AcademyDialog>;
}
