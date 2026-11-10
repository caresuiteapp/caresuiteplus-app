import type { AcademyLesson } from '@/lib/akademie/workspaceModel';
import { nrwModuleImage } from '@/lib/akademie/nrwCourse';

export function NrwLessonContent({ lesson, code }: { lesson: AcademyLesson; code: string }) {
  if (lesson.id.endsWith('-case')) return <NrwIllustratedCase code={code} body={lesson.body} />;
  return <>
    <img className="ac-nrw-lesson-art" src={nrwModuleImage(code)} alt="" />
    <div className="ac-nrw-unit">{lesson.body.split('\n\n').map((part, index) => {
      const [heading, ...body] = part.split('\n');
      return <section key={heading}><h4>{heading}</h4>{index > 0 && <p>{body.join('\n')}</p>}</section>;
    })}</div>
    {code === '03' && lesson.id.endsWith('-ue3') && <a className="ac-button subtle small" href="https://www.drk.de/hilfe-in-deutschland/erste-hilfe/bewusstlosigkeit/" target="_blank" rel="noopener noreferrer">Erste Hilfe beim DRK nachlesen</a>}
  </>;
}

function NrwIllustratedCase({ code, body }: { code: string; body: string }) {
  const [scene, question, solution] = body.split('\n\n').map(part => part.split('\n').slice(1).join('\n'));
  const source = nrwModuleImage(code, true);
  return <div className="ac-nrw-case">
    <figure>
      <img src={source} alt={scene} />
      <figcaption><strong>Aus der Praxis</strong><a className="ac-button subtle small" href={source} target="_blank" rel="noopener noreferrer">Bild vergrößern</a></figcaption>
    </figure>
    <section className="ac-nrw-observe"><h4>Was fällt Ihnen auf?</h4><p>{question}</p></section>
    <details className="ac-nrw-solution"><summary>Auflösung ansehen</summary><p>{solution}</p></details>
  </div>;
}
