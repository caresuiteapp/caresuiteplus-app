// Generated native presentation from src/features/akademie/NrwModulePreview.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeP,NativeDiv,NativeLabel,NativeSelect,NativeOption,NativeButton,NativeArticle,NativeH3,NativeOl,NativeLi,NativeStrong,NativeUl} from '@/components/layout/NativeWorkspaceElements.native';
import { useState } from 'react';
import { nrwModuleCode, NRW_MODULES } from '@/lib/akademie/nrwCourse';
import type { AcademyLesson } from '@/lib/akademie/workspaceModel';
import { AcademyDialog } from "./AcademyDialog.native.tsx";
import { NrwLessonContent } from "./NrwLessonContent.native.tsx";
export function NrwModulePreview({ index, lessons, onClose }: {
    index: number;
    lessons: AcademyLesson[];
    onClose: () => void;
}) {
    const code = nrwModuleCode(index);
    const moduleLessons = lessons.filter(lesson => lesson.id.startsWith(`nrw-${code}-`));
    const [selectedId, setSelectedId] = useState(moduleLessons[0]?.id);
    const lesson = moduleLessons.find(item => item.id === selectedId);
    return <AcademyDialog title={`Modul ${code} · ${NRW_MODULES[index]}`} onClose={onClose}>
    <NativeP className="ac-muted">Kursvorschau für die Verwaltung · 5 Unterrichtseinheiten, Praxisfall und Wissenscheck</NativeP>
    <NativeDiv className="ac-nrw-preview-navigation">
      <NativeLabel className="ac-field">Lektion in der Vorschau
        <NativeSelect className="ac-input" value={selectedId ?? ''} onChange={event => setSelectedId(event.target.value)}>
          {moduleLessons.map(item => <NativeOption key={item.id} value={item.id}>{item.title}</NativeOption>)}
        </NativeSelect>
      </NativeLabel>
      {moduleLessons.some(item => item.id.endsWith('-case')) && <NativeButton type="button" className="ac-button" onClick={() => setSelectedId(`nrw-${code}-case`)}>Praxisbild ansehen</NativeButton>}
    </NativeDiv>
    {lesson && <NativeArticle className="ac-editor-content" key={lesson.id}>
      <NativeH3 className="ac-section-title">{lesson.title}</NativeH3>
      {lesson.kind === 'quiz' ? <>
        <NativeP className="ac-muted">{lesson.body}</NativeP>
        <NativeOl className="ac-nrw-preview-questions">{lesson.questions?.map(question => <NativeLi key={question.id}>
          <NativeStrong>{question.prompt}</NativeStrong>
          <NativeUl>{question.options.map(option => <NativeLi key={option.id}>{option.text}</NativeLi>)}</NativeUl>
        </NativeLi>)}</NativeOl>
      </> : <NrwLessonContent lesson={lesson} code={code}/>}
      <NativeDiv className="ac-card-actions">
        <NativeButton type="button" className="ac-button" disabled={moduleLessons[0]?.id === lesson.id} onClick={() => setSelectedId(moduleLessons[moduleLessons.indexOf(lesson) - 1]?.id)}>Vorherige Lektion</NativeButton>
        <NativeButton type="button" className="ac-button" disabled={moduleLessons.at(-1)?.id === lesson.id} onClick={() => setSelectedId(moduleLessons[moduleLessons.indexOf(lesson) + 1]?.id)}>Nächste Lektion</NativeButton>
      </NativeDiv>
    </NativeArticle>}
  </AcademyDialog>;
}
