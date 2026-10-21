import { useEffect, useRef, useState } from 'react';
import {
  ACADEMY_AUDIENCE_LABELS,
  type AcademyAudience, type AcademyCommandHandler, type AcademyContent,
  type AcademyCourse, type AcademyLesson, type AcademyLessonKind, type AcademyQuestion, type AcademyReusableTemplate,
} from '@/lib/akademie/workspaceModel';
import { academyDraftProblem, academyPublicationIssues, cloneAcademyLesson, cloneAcademyQuestion } from '@/lib/akademie/workspaceAuthoring';
import { ACADEMY_LESSON_PRESETS, createAcademyLessonPreset } from '@/lib/akademie/workspaceTemplates';
import { AcademyAuthorPreview } from './AcademyAuthorPreview.web';

type Props = {
  course: AcademyCourse | null;
  draftId: string;
  initialContent: AcademyContent;
  busy: boolean;
  mode?: 'course' | 'template';
  template?: AcademyReusableTemplate | null;
  templates?: AcademyReusableTemplate[];
  onCommand: AcademyCommandHandler;
  onClose: () => void;
};

const lessonLabels: Record<AcademyLessonKind, string> = {
  text: 'Lesetext', video: 'Video', document: 'Dokument', quiz: 'Wissenscheck',
};
const audiences: AcademyAudience[] = ['employee', 'client', 'family'];
const copyContent = (content: AcademyContent): AcademyContent => JSON.parse(JSON.stringify(content)) as AcademyContent;
function sameContent(left: AcademyContent, right: AcademyContent): boolean {
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])) : value;
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function newQuestion(): AcademyQuestion {
  const first = crypto.randomUUID();
  return { id: crypto.randomUUID(), prompt: '', options: [{ id: first, text: '' }, { id: crypto.randomUUID(), text: '' }], correctOptionId: first };
}

export function AcademyCourseEditor({ course, draftId, initialContent, busy, mode = 'course', template = null, templates = [], onCommand, onClose }: Props) {
  const templateMode = mode === 'template';
  const saved = templateMode ? template : course;
  const [content, setContent] = useState<AcademyContent>(() => copyContent(initialContent));
  const [revision, setRevision] = useState<number | null>(saved?.revision ?? null);
  const [recordId, setRecordId] = useState(saved?.id ?? draftId);
  const [status, setStatus] = useState<AcademyCourse['status']>(templateMode ? template?.status === 'archived' ? 'archived' : 'draft' : course?.status ?? 'draft');
  const [templateName, setTemplateName] = useState(template?.name ?? initialContent.title);
  const [templateDescription, setTemplateDescription] = useState(template?.description ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(initialContent.lessons[0]?.id ?? null);
  const [dirty, setDirty] = useState(!saved);
  const [message, setMessage] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [loadSavedOpen, setLoadSavedOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeQuestionId, setRemoveQuestionId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateId, setNewTemplateId] = useState<string | null>(null);
  const templateRequest = useRef<{ id: string; name: string; description: string; content: AcademyContent } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const selected = content.lessons.find(lesson => lesson.id === selectedId) ?? content.lessons[0] ?? null;
  const locked = busy || submitting;
  const writable = !locked && status !== 'archived';
  const changedElsewhere = Boolean(saved && (revision === null || saved.revision > revision));
  const issues = academyPublicationIssues(content);

  useEffect(() => {
    if (!dirty && !templateSaveOpen) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, templateSaveOpen]);
  useEffect(() => {
    const request = templateRequest.current;
    if (!request) return;
    const confirmed = templates.find(item => item.id === request.id);
    if (!confirmed || confirmed.name !== request.name || confirmed.description !== request.description
      || !sameContent(confirmed.content, request.content)) return;
    templateRequest.current = null;
    setTemplateSaveOpen(false);
    setMessage('Die eigene Vorlage ist gespeichert und steht in der Vorlagensammlung Ihres Unternehmens bereit.');
  }, [templates]);
  useEffect(() => {
    if (revision !== null || !saved || saved.id !== recordId || !sameContent(saved.content, content)) return;
    if (templateMode && (!template || template.name !== templateName.trim() || template.description !== templateDescription.trim())) return;
    // A retry may have been acknowledged by the surrounding workspace after the initial call timed out.
    setRevision(saved.revision); setDirty(false);
    setStatus(templateMode ? saved.status === 'archived' ? 'archived' : 'draft' : course!.status);
    setMessage(templateMode ? 'Die gespeicherte Vorlage wurde bestätigt.' : 'Der gespeicherte Kursentwurf wurde bestätigt.');
  }, [saved, revision, recordId, content, templateMode, template, templateName, templateDescription, course]);

  const change = (patch: Partial<AcademyContent>) => {
    setContent(previous => ({ ...previous, ...patch })); setDirty(true); setMessage(null);
  };
  const updateLesson = (id: string, patch: Partial<AcademyLesson>) => {
    setContent(previous => ({ ...previous, lessons: previous.lessons.map(lesson => lesson.id === id ? { ...lesson, ...patch } : lesson) }));
    setDirty(true); setMessage(null);
  };
  const updateQuestion = (lesson: AcademyLesson, questionId: string, patch: Partial<AcademyQuestion>) => {
    updateLesson(lesson.id, { questions: (lesson.questions ?? []).map(question => question.id === questionId ? { ...question, ...patch } : question) });
  };
  const addLesson = (kind: AcademyLessonKind) => {
    if (!writable || content.lessons.length >= 100) return;
    const lesson: AcademyLesson = { id: crypto.randomUUID(), title: '', kind, body: '', ...(kind === 'quiz' ? { questions: [newQuestion()] } : {}) };
    change({ lessons: [...content.lessons, lesson] }); setSelectedId(lesson.id);
  };
  const duplicateLesson = (lesson: AcademyLesson) => {
    if (!writable || content.lessons.length >= 100) return;
    const copy = cloneAcademyLesson(lesson);
    copy.title = `${lesson.title || 'Lektion'} (Kopie)`.slice(0, 250);
    const index = content.lessons.findIndex(item => item.id === lesson.id);
    const lessons = [...content.lessons]; lessons.splice(index + 1, 0, copy);
    change({ lessons }); setSelectedId(copy.id);
  };
  const duplicateQuestion = (lesson: AcademyLesson, question: AcademyQuestion) => {
    if (!writable || (lesson.questions?.length ?? 0) >= 50) return;
    const questions = [...(lesson.questions ?? [])];
    questions.splice(questions.findIndex(item => item.id === question.id) + 1, 0, cloneAcademyQuestion(question));
    updateLesson(lesson.id, { questions });
  };
  const moveQuestion = (lesson: AcademyLesson, index: number, step: number) => {
    const questions = [...(lesson.questions ?? [])]; const next = index + step;
    if (!writable || next < 0 || next >= questions.length) return;
    [questions[index], questions[next]] = [questions[next]!, questions[index]!]; updateLesson(lesson.id, { questions });
  };
  const addPreset = (key: string) => {
    if (!writable || content.lessons.length >= 100) return;
    const lesson = createAcademyLessonPreset(key);
    change({ lessons: [...content.lessons, lesson] }); setSelectedId(lesson.id); setPresetsOpen(false);
  };
  const moveLesson = (id: string, step: number) => {
    const list = [...content.lessons]; const index = list.findIndex(lesson => lesson.id === id); const next = index + step;
    if (index < 0 || next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next]!, list[index]!]; change({ lessons: list });
  };
  const save = async () => {
    if (!writable || changedElsewhere) return;
    setMessage(null);
    const problem = academyDraftProblem(content);
    if (problem) { setMessage(problem); return; }
    if (templateMode && (!templateName.trim() || templateName.trim().length > 150 || templateDescription.trim().length > 2000)) {
      setMessage('Benennen Sie Ihre Vorlage mit höchstens 150 Zeichen. Die Beschreibung darf höchstens 2.000 Zeichen enthalten.'); return;
    }
    setSubmitting(true);
    try {
      const result = await onCommand(templateMode ? 'save_template' : 'save_course', templateMode
        ? { name: templateName.trim(), description: templateDescription.trim(), content: copyContent(content) }
        : { content: copyContent(content) }, { id: recordId, revision });
      if (!result) return;
      setRecordId(result.recordId); setRevision(result.revision); setDirty(false); setStatus('draft');
      setMessage(templateMode ? 'Vorlage gespeichert. Sie kann als Ausgangspunkt für neue Kurse verwendet werden.' : 'Entwurf gespeichert. Prüfen Sie den Inhalt vor der Veröffentlichung.');
    } catch { setMessage('Die Speicherung konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten.'); }
    finally { setSubmitting(false); }
  };
  const publish = async () => {
    if (!writable || templateMode || changedElsewhere) return;
    if (issues.length) { setMessage(issues[0]!.message); return; }
    if (dirty || revision === null) { setMessage('Speichern Sie zuerst den aktuellen Entwurf.'); return; }
    setSubmitting(true);
    try {
      const result = await onCommand('publish_course', {}, { id: recordId, revision });
      if (!result) return;
      setRevision(result.revision); setStatus('published'); setMessage('Die Fassung ist veröffentlicht und kann zugewiesen werden.');
    } catch { setMessage('Die Veröffentlichung konnte nicht bestätigt werden. Bitte den aktuellen Stand prüfen.'); }
    finally { setSubmitting(false); }
  };
  const loadSaved = () => {
    if (!saved || locked) return;
    setContent(copyContent(saved.content)); setRecordId(saved.id); setRevision(saved.revision);
    setStatus(templateMode ? saved.status === 'archived' ? 'archived' : 'draft' : course!.status); setSelectedId(saved.content.lessons[0]?.id ?? null); setDirty(false);
    if (template) { setTemplateName(template.name); setTemplateDescription(template.description); }
    setLoadSavedOpen(false); setDiscardOpen(false); setRemoveId(null);
    setMessage('Der aktuelle gespeicherte Stand wurde übernommen.');
  };
  const openTemplateSave = () => {
    setNewTemplateId(crypto.randomUUID()); setNewTemplateName(content.title.slice(0, 150));
    setNewTemplateDescription(content.summary.slice(0, 2000)); setTemplateSaveOpen(true); setMessage(null); templateRequest.current = null;
  };
  const saveAsTemplate = async () => {
    if (!writable || !newTemplateId) return;
    if (!newTemplateName.trim() || newTemplateName.trim().length > 150 || newTemplateDescription.trim().length > 2000) {
      setMessage('Benennen Sie Ihre Vorlage mit höchstens 150 Zeichen. Die Beschreibung darf höchstens 2.000 Zeichen enthalten.'); return;
    }
    const problem = academyDraftProblem(content);
    if (problem) { setMessage(problem); return; }
    if (templates.some(item => item.id === newTemplateId)) { setMessage('Die Vorlage ist bereits vorhanden. Öffnen Sie sie in der Vorlagensammlung, um sie weiter zu bearbeiten.'); return; }
    const request = { id: newTemplateId, name: newTemplateName.trim(), description: newTemplateDescription.trim(), content: copyContent(content) };
    templateRequest.current = request; setSubmitting(true);
    try {
      const result = await onCommand('save_template', { name: request.name, description: request.description, content: request.content }, { id: request.id, revision: null });
      if (!result) return;
      templateRequest.current = null; setTemplateSaveOpen(false);
      setMessage('Die eigene Vorlage ist gespeichert und steht in der Vorlagensammlung Ihres Unternehmens bereit.');
    } catch { setMessage('Die Vorlage konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten.'); }
    finally { setSubmitting(false); }
  };
  const jumpToIssue = (issue: ReturnType<typeof academyPublicationIssues>[number]) => {
    if (issue.lessonId) setSelectedId(issue.lessonId);
    requestAnimationFrame(() => {
      const settings = [...(formRef.current?.querySelectorAll<HTMLInputElement>('[data-author-settings]') ?? [])];
      const invalidSetting = settings.find(field => !field.validity.valid || !Number.isInteger(Number(field.value)));
      const field = issue.lessonId ? formRef.current?.querySelector<HTMLElement>('[data-lesson-title]')
        : issue.field === 'summary' ? formRef.current?.querySelector<HTMLElement>('[data-author-summary]')
          : issue.field === 'settings' ? invalidSetting ?? settings[0]
            : issue.field === 'lessons' ? formRef.current?.querySelector<HTMLElement>('[data-author-lessons]')
              : formRef.current?.querySelector<HTMLElement>('[data-course-title]');
      field?.focus(); field?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    });
  };

  if (preview) return <AcademyAuthorPreview content={content} busy={locked} onClose={() => setPreview(false)} />;

  return <section className="ac-panel" aria-label={templateMode ? 'Vorlage bearbeiten' : 'Kurs bearbeiten'}>
    <div className="ac-panel-header">
      <div><p className="ac-eyebrow">{templateMode ? 'EIGENE VORLAGE' : 'KURSREDAKTION'}</p><h2 className="ac-section-title">{templateMode ? template ? 'Vorlage bearbeiten' : 'Neue Vorlage gestalten' : course ? 'Kurs bearbeiten' : 'Neuen Kurs gestalten'}</h2>
        <p className="ac-muted">{templateMode ? 'Ihre Vorlage steht berechtigten Kursverantwortlichen Ihres Unternehmens zur Verfügung. Daraus erstellte Kurse werden unabhängig bearbeitet.' : 'Bestehende Teilnahmen behalten ihre zugewiesene Fassung. Änderungen werden erst nach Veröffentlichung für neue Zuweisungen verfügbar.'}</p></div>
      <button type="button" className="ac-button subtle" disabled={locked} onClick={() => dirty || templateSaveOpen ? setDiscardOpen(true) : onClose()}>Schließen</button>
    </div>
    {discardOpen && <div className="ac-message" data-tone="info" role="alert"><p>Ungespeicherte Änderungen verwerfen?</p><div className="ac-card-actions"><button type="button" className="ac-button danger small" disabled={locked} onClick={onClose}>Änderungen verwerfen</button><button type="button" className="ac-button subtle small" disabled={locked} onClick={() => setDiscardOpen(false)}>Weiter bearbeiten</button></div></div>}
    {changedElsewhere && <div className="ac-message" data-tone="error" role="alert"><strong>{templateMode ? 'Die gespeicherte Vorlage wurde inzwischen geändert.' : 'Der gespeicherte Kurs wurde inzwischen geändert.'}</strong><p>Ihr Entwurf bleibt hier erhalten. Übernehmen Sie bewusst den aktuellen gespeicherten Stand, bevor Sie weiter speichern.</p><button type="button" className="ac-button subtle" disabled={locked} onClick={() => setLoadSavedOpen(true)}>Aktuellen gespeicherten Stand laden</button>{loadSavedOpen && <><p>Dadurch werden Ihre ungespeicherten Angaben ersetzt. Möchten Sie „{saved?.content.title}“ aus dem gespeicherten Stand übernehmen?</p><div className="ac-card-actions"><button type="button" className="ac-button danger" disabled={locked} onClick={loadSaved}>Gespeicherten Stand übernehmen</button><button type="button" className="ac-button subtle" disabled={locked} onClick={() => setLoadSavedOpen(false)}>Meinen Entwurf behalten</button></div></>}</div>}
    {message && <div className="ac-message" data-tone="info" role="status">{message}</div>}
    <div className="ac-author-tools"><button type="button" className="ac-button" disabled={locked} onClick={() => setPreview(true)}>Vorschau für Lernende</button>{!templateMode && <button type="button" className="ac-button subtle" disabled={!writable || templateSaveOpen} onClick={openTemplateSave}>Als eigene Vorlage speichern</button>}<span className="ac-muted">{content.lessons.length} Lektionen · {content.lessons.reduce((total, lesson) => total + (lesson.questions?.length ?? 0), 0)} Fragen</span></div>
    {templateSaveOpen && <section className="ac-template-save-form ac-message" data-tone="info" aria-label="Kurs als eigene Vorlage speichern"><h3>Eigene Vorlage speichern</h3><p>Der aktuelle Inhalt wird als wiederverwendbare Vorlage für Ihr Unternehmen gespeichert. Der Kursentwurf bleibt separat erhalten.</p><fieldset disabled={!writable}><div className="ac-form-grid"><label className="ac-field">Name der neuen Vorlage<input className="ac-input" maxLength={150} value={newTemplateName} onChange={event => setNewTemplateName(event.target.value)} /></label><label className="ac-field">Beschreibung der neuen Vorlage<textarea className="ac-input ac-textarea" rows={2} maxLength={2000} value={newTemplateDescription} onChange={event => setNewTemplateDescription(event.target.value)} /></label></div><div className="ac-card-actions"><button type="button" className="ac-button primary" disabled={!newTemplateName.trim()} onClick={() => void saveAsTemplate()}>Eigene Vorlage verbindlich speichern</button><button type="button" className="ac-button subtle" onClick={() => { setTemplateSaveOpen(false); templateRequest.current = null; }}>Vorlagenspeicherung abbrechen</button></div></fieldset></section>}
    <details className="ac-readiness"><summary>{issues.length ? `${issues.length} ${issues.length === 1 ? 'Punkt' : 'Punkte'} vor der Veröffentlichung ergänzen` : 'Inhalt für die Veröffentlichung vollständig ausgefüllt'}</summary>{issues.length ? <ol>{issues.map((issue, index) => <li key={`${issue.lessonId ?? issue.field ?? 'course'}-${index}`}><button type="button" className="ac-button subtle small" disabled={locked} onClick={() => jumpToIssue(issue)}>{issue.message}</button></li>)}</ol> : <p className="ac-muted">Prüfen Sie die fachliche Richtigkeit und alle Materiallinks, bevor Sie einen Kurs veröffentlichen.</p>}</details>
    <form ref={formRef} onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={!writable}>
        <div className="ac-form-grid">
          {templateMode && <><label className="ac-field">Vorlagenname<input className="ac-input" maxLength={150} value={templateName} onChange={event => { setTemplateName(event.target.value); setDirty(true); setMessage(null); }} required /></label><label className="ac-field">Vorlagenbeschreibung<textarea className="ac-input ac-textarea" rows={2} maxLength={2000} value={templateDescription} onChange={event => { setTemplateDescription(event.target.value); setDirty(true); setMessage(null); }} /></label></>}
          <label className="ac-field ac-span-all">Kurstitel<input className="ac-input" data-course-title value={content.title} maxLength={250} onChange={event => change({ title: event.target.value })} placeholder="Worum geht es in diesem Kurs?" required /></label>
          <label className="ac-field ac-span-all">Kurzbeschreibung und Lernziel<textarea className="ac-input ac-textarea" data-author-summary rows={3} maxLength={10000} value={content.summary} onChange={event => change({ summary: event.target.value })} placeholder="Was können die Teilnehmenden nach dieser Schulung?" /></label>
          <label className="ac-field">Themenbereich<input className="ac-input" value={content.category} maxLength={150} onChange={event => change({ category: event.target.value })} placeholder="Zum Beispiel Einarbeitung" /></label>
          <label className="ac-field">Geschätzter Zeitbedarf in Minuten<input className="ac-input" data-author-settings type="number" min={1} max={10000} value={content.estimatedMinutes} onChange={event => change({ estimatedMinutes: Number(event.target.value) })} /></label>
          <div className="ac-field ac-span-all"><span>Zielgruppen</span><div className="ac-inline-fields">{audiences.map(audience => <label className="ac-checkbox-label" key={audience}><input type="checkbox" checked={content.audiences.includes(audience)} onChange={event => change({ audiences: event.target.checked ? [...content.audiences, audience] : content.audiences.filter(value => value !== audience) })} />{ACADEMY_AUDIENCE_LABELS[audience]}</label>)}</div></div>
          <label className="ac-checkbox-label ac-span-all"><input type="checkbox" checked={content.mandatory} onChange={event => change({ mandatory: event.target.checked })} />Als verpflichtende Schulung kennzeichnen</label>
          <label className="ac-field">Bestehensgrenze in Prozent<input className="ac-input" data-author-settings type="number" min={1} max={100} value={content.passPercent} onChange={event => change({ passPercent: Number(event.target.value) })} /></label>
          <label className="ac-field">Versuche je Wissenscheck<input className="ac-input" data-author-settings type="number" min={1} max={20} value={content.maxAttempts} onChange={event => change({ maxAttempts: Number(event.target.value) })} /></label>
        </div>
        <div className="ac-editor-toolbar"><div><h3 className="ac-section-title">Lernweg</h3><p className="ac-muted">{content.lessons.length} {content.lessons.length === 1 ? 'Lektion' : 'Lektionen'} · Reihenfolge und Inhalte festlegen</p></div><div className="ac-card-actions">{(Object.keys(lessonLabels) as AcademyLessonKind[]).map(kind => <button key={kind} className="ac-button subtle small" data-author-lessons={kind === 'text' ? true : undefined} type="button" disabled={content.lessons.length >= 100} onClick={() => addLesson(kind)}>+ {lessonLabels[kind]}</button>)}<button type="button" className="ac-button small" disabled={content.lessons.length >= 100} aria-expanded={presetsOpen} onClick={() => setPresetsOpen(previous => !previous)}>Bausteine auswählen</button></div></div>
        {presetsOpen && <section className="ac-lesson-presets" aria-label="Lektionsbausteine"><p className="ac-muted">Fügen Sie einen Baustein ein und passen Sie ihn an Ihr Lernziel an.</p><div className="ac-template-grid">{ACADEMY_LESSON_PRESETS.map(preset => <button type="button" className="ac-template-card" key={preset.key} disabled={content.lessons.length >= 100} onClick={() => addPreset(preset.key)}><strong>{preset.title}</strong><span>{preset.description}</span></button>)}</div></section>}
        <div className="ac-editor-grid">
          <nav className="ac-lesson-list" aria-label="Lektionen bearbeiten">{content.lessons.map((lesson, index) => <div key={lesson.id}>
            <button type="button" className="ac-lesson-nav" aria-current={selected?.id === lesson.id ? 'step' : undefined} onClick={() => setSelectedId(lesson.id)}><span className="ac-lesson-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{lesson.title || 'Neue Lektion'}</strong><small>{lessonLabels[lesson.kind]}</small></span></button>
            <div className="ac-card-actions"><button type="button" className="ac-button subtle small" disabled={index === 0} aria-label={`${lesson.title || `Lektion ${index + 1}`} nach oben`} onClick={() => moveLesson(lesson.id, -1)}>↑</button><button type="button" className="ac-button subtle small" disabled={index === content.lessons.length - 1} aria-label={`${lesson.title || `Lektion ${index + 1}`} nach unten`} onClick={() => moveLesson(lesson.id, 1)}>↓</button></div>
          </div>)}</nav>
          {selected ? <div className="ac-editor-content" key={selected.id}>
            <div className="ac-panel-header"><span className="ac-status" data-tone="neutral">{lessonLabels[selected.kind]}</span><div className="ac-card-actions"><button type="button" className="ac-button subtle small" disabled={content.lessons.length >= 100} onClick={() => duplicateLesson(selected)}>Lektion duplizieren</button><button type="button" className="ac-button danger small" onClick={() => setRemoveId(selected.id)}>Lektion entfernen</button></div></div>
            {removeId === selected.id && <div className="ac-message" data-tone="info"><p>Diese Lektion aus dem Entwurf entfernen?</p><div className="ac-card-actions"><button type="button" className="ac-button danger small" onClick={() => { const lessons = content.lessons.filter(lesson => lesson.id !== selected.id); change({ lessons }); setSelectedId(lessons[0]?.id ?? null); setRemoveId(null); }}>Entfernen</button><button type="button" className="ac-button subtle small" onClick={() => setRemoveId(null)}>Behalten</button></div></div>}
            <label className="ac-field">Lektionstitel<input className="ac-input" data-lesson-title value={selected.title} maxLength={250} onChange={event => updateLesson(selected.id, { title: event.target.value })} /></label>
            <label className="ac-field">{selected.kind === 'text' ? 'Lerninhalt' : 'Einführung und Hinweise'}<textarea className="ac-input ac-textarea" maxLength={100000} rows={selected.kind === 'text' ? 12 : 4} value={selected.body} onChange={event => updateLesson(selected.id, { body: event.target.value })} placeholder="Formulieren Sie verständlich und konkret. Inhalte werden als Text angezeigt." /></label>
            {(selected.kind === 'video' || selected.kind === 'document') && <label className="ac-field">{selected.kind === 'video' ? 'Link zum Video' : 'Link zum Dokument'}<input className="ac-input" type="url" maxLength={2000} value={selected.url ?? ''} onChange={event => updateLesson(selected.id, { url: event.target.value })} placeholder="https://…" /><small className="ac-muted">Das Material öffnet sich erst, wenn die lernende Person den Link auswählt. Verwenden Sie zugängliche, freigegebene Inhalte.</small></label>}
            {selected.kind === 'quiz' && <div className="ac-quiz">
              {(selected.questions ?? []).map((question, questionIndex) => <section className="ac-question" key={question.id} aria-label={`Frage ${questionIndex + 1}`}>
                <div className="ac-panel-header"><h4>Frage {questionIndex + 1}</h4><div className="ac-question-actions ac-card-actions"><button type="button" className="ac-button subtle small" disabled={questionIndex === 0} aria-label={`Frage ${questionIndex + 1} nach oben`} onClick={() => moveQuestion(selected, questionIndex, -1)}>↑</button><button type="button" className="ac-button subtle small" disabled={questionIndex === (selected.questions?.length ?? 0) - 1} aria-label={`Frage ${questionIndex + 1} nach unten`} onClick={() => moveQuestion(selected, questionIndex, 1)}>↓</button><button type="button" className="ac-button subtle small" disabled={(selected.questions?.length ?? 0) >= 50} aria-label={`Frage ${questionIndex + 1} duplizieren`} onClick={() => duplicateQuestion(selected, question)}>Duplizieren</button><button type="button" className="ac-button danger small" onClick={() => setRemoveQuestionId(question.id)}>Frage entfernen</button></div></div>
                {removeQuestionId === question.id && <div className="ac-message" data-tone="info"><p>Frage {questionIndex + 1} einschließlich Antwortmöglichkeiten entfernen?</p><div className="ac-card-actions"><button type="button" className="ac-button danger small" onClick={() => { updateLesson(selected.id, { questions: selected.questions?.filter(item => item.id !== question.id) }); setRemoveQuestionId(null); }}>Frage endgültig aus Entwurf entfernen</button><button type="button" className="ac-button subtle small" onClick={() => setRemoveQuestionId(null)}>Frage behalten</button></div></div>}
                <label className="ac-field">Fragestellung<textarea className="ac-input ac-textarea" rows={2} maxLength={3000} value={question.prompt} onChange={event => updateQuestion(selected, question.id, { prompt: event.target.value })} /></label>
                <p className="ac-muted">Eine richtige Antwort markieren. Lernende sehen diese Markierung nicht.</p>
                {question.options.map((option, optionIndex) => <div className="ac-option" key={option.id}>
                  <input className="ac-radio" type="radio" name={`correct-${question.id}`} aria-label={`Antwort ${optionIndex + 1} ist richtig`} checked={question.correctOptionId === option.id} onChange={() => updateQuestion(selected, question.id, { correctOptionId: option.id })} />
                  <input className="ac-input" aria-label={`Antwort ${optionIndex + 1} zu Frage ${questionIndex + 1}`} maxLength={2000} value={option.text} onChange={event => updateQuestion(selected, question.id, { options: question.options.map(value => value.id === option.id ? { ...value, text: event.target.value } : value) })} />
                  <button type="button" className="ac-button subtle small" disabled={question.options.length <= 2} aria-label={`Antwort ${optionIndex + 1} entfernen`} onClick={() => { const options = question.options.filter(value => value.id !== option.id); updateQuestion(selected, question.id, { options, correctOptionId: question.correctOptionId === option.id ? undefined : question.correctOptionId }); }}>×</button>
                </div>)}
                <button type="button" className="ac-button subtle small" disabled={question.options.length >= 8} onClick={() => updateQuestion(selected, question.id, { options: [...question.options, { id: crypto.randomUUID(), text: '' }] })}>+ Antwortmöglichkeit</button>
              </section>)}
              <button type="button" className="ac-button subtle" disabled={(selected.questions?.length ?? 0) >= 50} onClick={() => updateLesson(selected.id, { questions: [...(selected.questions ?? []), newQuestion()] })}>+ Frage hinzufügen</button>
            </div>}
          </div> : <div className="ac-empty"><h3>Der Lernweg ist noch leer</h3><p>Beginnen Sie mit einem Lesetext, einem Video oder einem Dokument. Ein Wissenscheck kann das Gelernte abfragen.</p></div>}
        </div>
      </fieldset>
      <div className="ac-editor-footer"><div><strong>{status === 'archived' ? 'Archiviert' : status === 'published' && !dirty ? 'Veröffentlicht' : dirty ? 'Ungespeicherte Änderungen' : templateMode ? 'Vorlage gespeichert' : 'Entwurf gespeichert'}</strong><p className="ac-muted">{templateMode ? status === 'archived' ? 'Stellen Sie die Vorlage in der Vorlagensammlung wieder her, um sie weiter zu bearbeiten.' : 'Aus Ihrer Vorlage können neue Kurse mit eigenständigen Inhalten entstehen.' : dirty ? 'Vor der Veröffentlichung muss der aktuelle Entwurf gespeichert sein.' : 'Veröffentlichen Sie nur fachlich geprüfte und vollständige Inhalte.'}</p></div><div className="ac-card-actions"><button type="submit" className="ac-button" disabled={!writable || !dirty || changedElsewhere}>{templateMode ? 'Vorlage speichern' : 'Entwurf speichern'}</button>{!templateMode && <button type="button" className="ac-button primary" disabled={!writable || dirty || revision === null || status === 'published' || changedElsewhere} onClick={() => void publish()}>Veröffentlichen</button>}</div></div>
    </form>
  </section>;
}
