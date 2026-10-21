import { academySafeResourceUrl, type AcademyContent, type AcademyLesson, type AcademyQuestion } from './workspaceModel';

export function cloneAcademyQuestion(question: AcademyQuestion): AcademyQuestion {
  const ids = new Map<string, string>();
  const options = question.options.map(option => {
    const id = crypto.randomUUID(); ids.set(option.id, id); return { id, text: option.text };
  });
  const correctOptionId = question.correctOptionId ? ids.get(question.correctOptionId) : undefined;
  return { id: crypto.randomUUID(), prompt: question.prompt, options, ...(correctOptionId ? { correctOptionId } : {}) };
}

export function cloneAcademyLesson(lesson: AcademyLesson): AcademyLesson {
  return { ...lesson, id: crypto.randomUUID(), ...(lesson.questions ? { questions: lesson.questions.map(cloneAcademyQuestion) } : {}) };
}

/** Copies author content only: no participation, progress, publication or certificate identity. */
export function cloneAcademyContent(content: AcademyContent): AcademyContent {
  return { ...content, audiences: [...content.audiences], lessons: content.lessons.map(cloneAcademyLesson) };
}

const validId = (id: string) => /^[A-Za-z0-9_-]{1,100}$/.test(id);
const uniqueIds = (entries: { id: string }[]) => entries.every(entry => validId(entry.id)) && new Set(entries.map(entry => entry.id)).size === entries.length;

/** Drafts can be unfinished; unsafe links, invalid bounds and broken identifiers cannot be saved. */
export function academyDraftProblem(content: AcademyContent): string | null {
  if (!content.title.trim() || content.title.trim().length > 250) return 'Bitte geben Sie dem Kurs einen Titel mit höchstens 250 Zeichen.';
  if (content.summary.length > 10000 || content.category.length > 150) return 'Kurzbeschreibung oder Themenbereich ist zu lang.';
  if (!content.audiences.length || content.audiences.length > 3 || new Set(content.audiences).size !== content.audiences.length
    || content.audiences.some(audience => !['employee', 'client', 'family'].includes(audience))) return 'Bitte wählen Sie mindestens eine gültige Zielgruppe.';
  if (!Number.isInteger(content.estimatedMinutes) || content.estimatedMinutes < 1 || content.estimatedMinutes > 10000
    || !Number.isInteger(content.passPercent) || content.passPercent < 1 || content.passPercent > 100
    || !Number.isInteger(content.maxAttempts) || content.maxAttempts < 1 || content.maxAttempts > 20) return 'Prüfen Sie Zeitbedarf, Bestehensgrenze und Versuchsanzahl. Verwenden Sie ganze Zahlen innerhalb der angegebenen Grenzen.';
  if (content.lessons.length > 100) return 'Ein Kurs kann höchstens 100 Lektionen enthalten.';
  if (!uniqueIds(content.lessons)) return 'Die Lektionen enthalten doppelte oder ungültige Kennungen. Erstellen Sie eine neue Kopie.';
  for (const [index, lesson] of content.lessons.entries()) {
    const prefix = `Lektion ${index + 1}`;
    if (lesson.title.length > 250 || lesson.body.length > 100000) return `${prefix}: Titel oder Lerninhalt ist zu lang.`;
    if (lesson.url && (lesson.url.length > 2000 || !academySafeResourceUrl(lesson.url))) return `${prefix}: Materialadressen müssen vollständige HTTPS-Links ohne Zugangsdaten sein.`;
    if (lesson.kind !== 'quiz') continue;
    const questions = lesson.questions ?? [];
    if (questions.length > 50 || !uniqueIds(questions)) return `${prefix}: Verwenden Sie höchstens 50 Fragen mit eindeutigen Kennungen.`;
    for (const question of questions) {
      if (question.prompt.length > 3000 || question.options.length > 8 || !uniqueIds(question.options)
        || question.options.some(option => option.text.length > 2000)) return `${prefix}: Prüfen Sie Fragenlänge, Antwortlänge und die höchstens acht Antwortmöglichkeiten.`;
      if (question.correctOptionId && !question.options.some(option => option.id === question.correctOptionId)) return `${prefix}: Die markierte richtige Antwort ist nicht mehr vorhanden.`;
    }
  }
  if (JSON.stringify(content).length > 1000000) return 'Dieser Kurs ist zu umfangreich. Teilen Sie die Inhalte in mehrere Kurse auf.';
  return null;
}

export type AcademyPublicationIssue = { message: string; lessonId?: string; field?: string };
export function academyPublicationIssues(content: AcademyContent): AcademyPublicationIssue[] {
  const issues: AcademyPublicationIssue[] = [];
  const draftProblem = academyDraftProblem(content);
  if (draftProblem) issues.push({ message: draftProblem, field: !content.title.trim() ? 'title' : 'settings' });
  if (!content.summary.trim()) issues.push({ message: 'Beschreiben Sie das Lernziel und den Inhalt der Schulung.', field: 'summary' });
  if (!content.lessons.length) issues.push({ message: 'Fügen Sie mindestens eine Lektion hinzu.', field: 'lessons' });
  for (const [index, lesson] of content.lessons.entries()) {
    const prefix = `Lektion ${index + 1}`;
    const add = (message: string) => issues.push({ message: `${prefix}: ${message}`, lessonId: lesson.id });
    if (!lesson.title.trim()) add('Ergänzen Sie einen Titel.');
    if (lesson.kind === 'text' && !lesson.body.trim()) add('Ergänzen Sie den Lerninhalt.');
    if (['document', 'video'].includes(lesson.kind) && !academySafeResourceUrl(lesson.url)) add('Ergänzen Sie einen vollständigen HTTPS-Link zum Material.');
    if (lesson.kind === 'quiz') {
      if (!lesson.questions?.length) add('Fügen Sie mindestens eine Frage hinzu.');
      for (const [questionIndex, question] of (lesson.questions ?? []).entries()) {
        const questionLabel = `Frage ${questionIndex + 1}`;
        if (!question.prompt.trim()) add(`${questionLabel} benötigt eine Fragestellung.`);
        if (question.options.length < 2 || question.options.some(option => !option.text.trim())) add(`${questionLabel} benötigt mindestens zwei vollständig beschriftete Antwortmöglichkeiten.`);
        if (!question.options.some(option => option.id === question.correctOptionId)) add(`${questionLabel}: Markieren Sie die richtige Antwort.`);
      }
    }
  }
  return issues;
}
