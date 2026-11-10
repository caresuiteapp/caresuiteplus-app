// Generated native presentation from src/features/akademie/NrwLessonContent.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeImg,NativeDiv,NativeSection,NativeH4,NativeP,NativeA,NativeFigure,NativeFigcaption,NativeStrong,NativeDetails,NativeSummary} from '@/components/layout/NativeWorkspaceElements.native';
import type { AcademyLesson } from '@/lib/akademie/workspaceModel';
import { nrwModuleImage } from '@/lib/akademie/nrwCourse';
export function NrwLessonContent({ lesson, code }: {
    lesson: AcademyLesson;
    code: string;
}) {
    if (lesson.id.endsWith('-case'))
        return <NrwIllustratedCase code={code} body={lesson.body}/>;
    return <>
    <NativeImg className="ac-nrw-lesson-art" src={nrwModuleImage(code)} alt=""/>
    <NativeDiv className="ac-nrw-unit">{lesson.body.split('\n\n').map((part, index) => {
            const [heading, ...body] = part.split('\n');
            return <NativeSection key={heading}><NativeH4>{heading}</NativeH4>{index > 0 && <NativeP>{body.join('\n')}</NativeP>}</NativeSection>;
        })}</NativeDiv>
    {code === '03' && lesson.id.endsWith('-ue3') && <NativeA className="ac-button subtle small" href="https://www.drk.de/hilfe-in-deutschland/erste-hilfe/bewusstlosigkeit/" target="_blank" rel="noopener noreferrer">Erste Hilfe beim DRK nachlesen</NativeA>}
  </>;
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
