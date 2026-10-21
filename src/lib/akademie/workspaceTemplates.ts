import type { AcademyAudience, AcademyContent, AcademyLesson, AcademyLessonKind } from './workspaceModel';

export type AcademyStarterTemplate = {
  key: string; title: string; description: string; audiences: AcademyAudience[];
  category: string; estimatedMinutes: number; lessonCount: number;
};
export const ACADEMY_TEMPLATES: AcademyStarterTemplate[] = [
  { key: 'blank', title: 'Eigener Kurs', description: 'Mit einem leeren Kurs beginnen und Inhalte selbst gestalten.', audiences: ['employee', 'client', 'family'], category: 'Allgemein', estimatedMinutes: 15, lessonCount: 1 },
  { key: 'team', title: 'Im Team ankommen', description: 'Eine Struktur für Einarbeitung, Ansprechpersonen und interne Abläufe.', audiences: ['employee'], category: 'Einarbeitung', estimatedMinutes: 30, lessonCount: 3 },
  { key: 'client', title: 'Gut vorbereitet', description: 'Orientierung, persönliche Fragen und Vorbereitung auf den nächsten Termin.', audiences: ['client'], category: 'Orientierung', estimatedMinutes: 15, lessonCount: 3 },
  { key: 'family', title: 'Gemeinsam unterstützen', description: 'Absprachen, Fragen und verlässliche Ansprechpersonen für Angehörige.', audiences: ['family'], category: 'Angehörige', estimatedMinutes: 20, lessonCount: 3 },
  { key: 'workshop', title: 'Schulung mit Wissenscheck', description: 'Lernziele, Material, praktische Reflexion und ein eigener Wissenscheck.', audiences: ['employee', 'client', 'family'], category: 'Schulung', estimatedMinutes: 30, lessonCount: 3 },
  { key: 'mandatory', title: 'Interne Pflichtschulung', description: 'Geltungsbereich, verbindliche Abläufe, Fallbeispiel und Wissenscheck selbst festlegen.', audiences: ['employee'], category: 'Pflichtschulung', estimatedMinutes: 30, lessonCount: 4 },
  { key: 'refresher', title: 'Wissen auffrischen', description: 'Bekanntes wiederholen, Änderungen erklären und den aktuellen Wissensstand prüfen.', audiences: ['employee', 'client', 'family'], category: 'Wiederholung', estimatedMinutes: 15, lessonCount: 3 },
  { key: 'software', title: 'Das persönliche Portal nutzen', description: 'Anmeldung, Orientierung, eigene Aufgaben und passende Hilfe erklären.', audiences: ['employee', 'client', 'family'], category: 'Software & Portal', estimatedMinutes: 20, lessonCount: 4 },
  { key: 'documentation', title: 'Dokumentation im Arbeitsalltag', description: 'Einrichtungsabläufe anhand anonymisierter Beispiele erklären und üben.', audiences: ['employee'], category: 'Arbeitsabläufe', estimatedMinutes: 25, lessonCount: 4 },
  { key: 'communication', title: 'Gespräche und Absprachen', description: 'Gesprächsvorbereitung, verständliche Absprachen und Rückfragen strukturieren.', audiences: ['employee', 'family'], category: 'Kommunikation', estimatedMinutes: 20, lessonCount: 3 },
  { key: 'consultation', title: 'Auf die Pflegeberatung vorbereiten', description: 'Anliegen sammeln, den Ablauf erklären und offene Fragen für die Beratung vorbereiten.', audiences: ['client', 'family'], category: 'Beratung', estimatedMinutes: 15, lessonCount: 3 },
  { key: 'home-training', title: 'Häusliche Schulung begleiten', description: 'Lernziel, fachliche Anleitung, Übungsphase und Rückfragen vorbereiten. Fachinhalte selbst ergänzen.', audiences: ['client', 'family'], category: 'Häusliche Schulung', estimatedMinutes: 30, lessonCount: 4 },
  { key: 'case-review', title: 'Fallbesprechung im Team', description: 'Einen anonymisierten Übungsfall, Fragen, Lösungswege und gemeinsame Erkenntnisse aufbauen.', audiences: ['employee'], category: 'Praxis & Reflexion', estimatedMinutes: 30, lessonCount: 4 },
  { key: 'quick', title: 'Ein Thema in fünf Minuten', description: 'Kurzer Einstieg, Kernaussage und ein kompakter Wissenscheck.', audiences: ['employee', 'client', 'family'], category: 'Kurzschulung', estimatedMinutes: 5, lessonCount: 3 },
  { key: 'resources', title: 'Materialien und Lernimpulse', description: 'Lesetext, Dokument und Video als zusammenhängendes Lernangebot aufbauen.', audiences: ['employee', 'client', 'family'], category: 'Lernmaterialien', estimatedMinutes: 20, lessonCount: 3 },
];

export const ACADEMY_LESSON_PRESETS: { key: string; title: string; description: string; kind: AcademyLessonKind }[] = [
  { key: 'goals', title: 'Einstieg & Lernziele', description: 'Thema, Zielgruppe und erwartetes Lernergebnis beschreiben.', kind: 'text' },
  { key: 'keypoints', title: 'Wissen kompakt', description: 'Die wichtigsten Inhalte mit verständlichen Beispielen erklären.', kind: 'text' },
  { key: 'practice', title: 'Praxisbeispiel', description: 'Einen anonymisierten Übungsfall und passende Fragen formulieren.', kind: 'text' },
  { key: 'reflection', title: 'Reflexion', description: 'Das Gelernte auf den eigenen Alltag beziehen.', kind: 'text' },
  { key: 'checklist', title: 'Checkliste', description: 'Arbeitsschritte in sinnvoller Reihenfolge zusammenstellen.', kind: 'text' },
  { key: 'faq', title: 'Häufige Fragen', description: 'Typische Rückfragen und eigene Antworten ergänzen.', kind: 'text' },
  { key: 'video', title: 'Video mit Einführung', description: 'Ein zugängliches Video verknüpfen und den Lernauftrag erklären.', kind: 'video' },
  { key: 'document', title: 'Dokument mit Lernauftrag', description: 'Ein freigegebenes Dokument verknüpfen und die Aufgabe beschreiben.', kind: 'document' },
  { key: 'quiz', title: 'Wissenscheck', description: 'Eigene Frage und Antwortmöglichkeiten erstellen.', kind: 'quiz' },
  { key: 'true-false', title: 'Richtig oder falsch?', description: 'Eine Aussage formulieren und die richtige Bewertung auswählen.', kind: 'quiz' },
];

export function createAcademyLessonPreset(key: string): AcademyLesson {
  const preset = ACADEMY_LESSON_PRESETS.find(item => item.key === key) ?? ACADEMY_LESSON_PRESETS[0]!;
  const lesson: AcademyLesson = { id: crypto.randomUUID(), title: preset.title, kind: preset.kind, body: '' };
  if (key === 'reflection') lesson.body = 'Was nehmen Sie aus dieser Schulung mit? Welche Fragen sind noch offen? Halten Sie Ihre Gedanken für sich fest und besprechen Sie offene Punkte mit Ihrer Ansprechperson.';
  if (preset.kind === 'quiz') lesson.questions = [{ id: crypto.randomUUID(), prompt: '', options: [
    { id: crypto.randomUUID(), text: key === 'true-false' ? 'Richtig' : '' },
    { id: crypto.randomUUID(), text: key === 'true-false' ? 'Falsch' : '' },
  ] }];
  return lesson;
}

/** Templates are editable drafts, never automatically published or assigned. */
export function createAcademyTemplate(key: string): AcademyContent {
  const template = ACADEMY_TEMPLATES.find(item => item.key === key) ?? ACADEMY_TEMPLATES[0];
  const base: AcademyContent = {
    title: key === 'blank' ? '' : template.title,
    summary: '', category: template.category, audiences: [...template.audiences],
    estimatedMinutes: template.estimatedMinutes, mandatory: key === 'mandatory', passPercent: 80, maxAttempts: 3, lessons: [],
  };
  const lesson = (title: string, body: string) => ({ id: crypto.randomUUID(), kind: 'text' as const, title, body });
  if (key === 'team') return { ...base, category: 'Einarbeitung', lessons: [
    lesson('Willkommen im Team', 'Beschreiben Sie hier das Lernziel, die zuständige Ansprechperson und den Ablauf der Einarbeitung.'),
    lesson('Unsere Abläufe', 'Ergänzen Sie die verbindlichen Abläufe Ihrer Einrichtung, die benötigten Unterlagen und passende Beispiele aus dem Arbeitsalltag.'),
    lesson('Fragen und nächste Schritte', 'Halten Sie fest, an wen sich Mitarbeitende bei Fragen wenden können und wie offene Punkte gemeinsam geklärt werden.'),
  ] };
  if (key === 'client') return { ...base, category: 'Orientierung', lessons: [
    lesson('Was Sie erwartet', 'Beschreiben Sie das Thema, das Lernziel und die Unterstützung, die Ihre Einrichtung anbietet.'),
    lesson('Ihre Fragen vorbereiten', 'Welche Fragen möchten Sie beim nächsten Gespräch klären? Sie können diese für sich notieren und zum Termin mitbringen.'),
    lesson('Kontakt und Unterstützung', 'Ergänzen Sie die passenden Ansprechpersonen, Kontaktwege und die nächsten Schritte.'),
  ] };
  if (key === 'family') return { ...base, category: 'Angehörige', lessons: [
    lesson('Rollen und Absprachen', 'Beschreiben Sie, welche Absprachen für die Unterstützung wichtig sind und wie Wünsche der betroffenen Person berücksichtigt werden.'),
    lesson('Fragen gemeinsam klären', 'Welche Fragen sind noch offen? Bereiten Sie Ihre Fragen für das nächste Gespräch mit der zuständigen Ansprechperson vor.'),
    lesson('Verlässlich in Kontakt bleiben', 'Ergänzen Sie die zuständigen Ansprechpersonen und die vereinbarten Kontaktwege. Die Lernteilnahme ersetzt keine individuelle Beratung.'),
  ] };
  if (key === 'workshop') {
    const yes = crypto.randomUUID();
    const no = crypto.randomUUID();
    return { ...base, title: 'Neue Schulung', category: 'Schulung', lessons: [
      lesson('Lernziele und Einstieg', 'Formulieren Sie die Lernziele und erläutern Sie, für wen diese Schulung gedacht ist.'),
      lesson('Wissen und Anwendung', 'Fügen Sie fachlich geprüfte Lerninhalte, Quellen und ein passendes Anwendungsbeispiel ein.'),
      { id: crypto.randomUUID(), title: 'Wissenscheck', kind: 'quiz', body: 'Ersetzen Sie die Beispielfrage vor der Veröffentlichung durch eine Frage zu Ihren Lernzielen.', questions: [
        { id: crypto.randomUUID(), prompt: 'Beispielfrage: An wen wenden Sie sich bei offenen Fragen?', options: [
          { id: yes, text: 'An die in der Schulung genannte Ansprechperson.' },
          { id: no, text: 'Ich lasse die Frage ungeklärt.' },
        ], correctOptionId: yes },
      ] },
    ] };
  }
  const structures: Record<string, [string, string][]> = {
    mandatory: [['goals', 'Für wen diese Schulung gilt'], ['keypoints', 'Unsere verbindlichen Abläufe'], ['practice', 'Anwendung im Arbeitsalltag'], ['quiz', 'Wissenscheck']],
    refresher: [['goals', 'Was sich geändert hat'], ['keypoints', 'Wichtiges wiederholen'], ['quiz', 'Wissen überprüfen']],
    software: [['goals', 'Ihr Zugang und die erste Anmeldung'], ['keypoints', 'Orientierung im Portal'], ['practice', 'Eine typische Aufgabe bearbeiten'], ['faq', 'Hilfe bei offenen Fragen']],
    documentation: [['goals', 'Ziel und Ablauf unserer Dokumentation'], ['keypoints', 'Ein anonymisiertes Beispiel'], ['practice', 'Eine Dokumentation selbst verfassen'], ['quiz', 'Wissenscheck']],
    communication: [['goals', 'Ein Gespräch vorbereiten'], ['practice', 'Absprachen verständlich festhalten'], ['reflection', 'Rückfragen und nächste Schritte']],
    consultation: [['goals', 'Ihr Anliegen und der Beratungsablauf'], ['checklist', 'Fragen und vorhandene Unterlagen sammeln'], ['reflection', 'Offene Fragen für das Gespräch']],
    'home-training': [['goals', 'Das gemeinsame Lernziel'], ['keypoints', 'Fachliche Anleitung und Lernmaterial'], ['practice', 'Die angeleitete Übungsphase'], ['reflection', 'Rückfragen und weitere Unterstützung']],
    'case-review': [['goals', 'Der anonymisierte Übungsfall'], ['practice', 'Fragen und mögliche Vorgehensweisen'], ['keypoints', 'Gemeinsam vereinbarte Erkenntnisse'], ['reflection', 'Übertragung in den Arbeitsalltag']],
    quick: [['goals', 'Das Lernziel'], ['keypoints', 'Die Kernaussage'], ['quiz', 'Kurzer Wissenscheck']],
    resources: [['goals', 'Einführung und Lernauftrag'], ['document', 'Dokument zum Thema'], ['video', 'Ergänzendes Video']],
  };
  if (structures[key]) return { ...base, lessons: structures[key].map(([preset, title]) => ({ ...createAcademyLessonPreset(preset), title })) };
  return { ...base, lessons: [lesson('', '')] };
}
