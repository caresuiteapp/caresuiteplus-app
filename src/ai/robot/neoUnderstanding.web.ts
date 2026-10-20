import { cleanNeoText, NEO_DESTINATIONS, neoChoice } from './neoLanguage.web';

export type NeoTask = 'open' | 'create' | 'edit' | 'explain' | 'problem' | 'search';
export type NeoAnswer = { kind: 'destination'; key: string } | { kind: 'guide'; id: string } | { kind: 'clientName' };
export type NeoOption = { label: string; answers: string[]; answer: NeoAnswer };
export type NeoClarification = { question: string; options: NeoOption[] };
export type NeoSubject = {
  key: string; label: string; pattern: RegExp; destination?: string; guide: string;
  createGuide?: string; editGuide?: string;
};

// These are product concepts, not example sentences. The topic and the task can
// arrive in either order and in separate turns. Answers only reference existing
// routes and maintained articles; this layer cannot invent or execute writes.
export const NEO_SUBJECTS: readonly NeoSubject[] = [
  { key: 'leave', label: 'Urlaub und Abwesenheit', pattern: /\b(?:urlaub\w*|abwesenheit\w*|krankmeldung\w*|ferien)\b/, guide: 'personal-abwesenheit' },
  { key: 'signature', label: 'Unterschrift', pattern: /\b(?:unterschrift\w*|unterschreib\w*|signatur\w*)\b/, guide: 'unterschrift-vor-ort' },
  { key: 'logo', label: 'Firmenlogo', pattern: /\b(?:firmenlogo|logo|briefkopf)\b/, guide: 'dokument-logo' },
  { key: 'import', label: 'Dienstplan übernehmen', pattern: /\b(?:pdf|foto)\b.*\b(?:dienstplan|kalender)\b|\b(?:dienstplan|kalender)\b.*\b(?:pdf|foto)\b/, guide: 'kalender-import' },
  { key: 'login', label: 'Anmeldung', pattern: /\b(?:anmeldung|anmelden|einloggen|login|passwort\w*)\b/, guide: 'anmelden', editGuide: 'zugang-wiederherstellen' },
  { key: 'clients', label: 'Klienten', pattern: /\b(?:klient(?:in|innen|en)?|kund(?:e|en|in|innen)|patient(?:en|in|innen)?|klientenakte\w*|kundenakte\w*|akte)\b/, destination: 'clients', guide: 'klienten-akte', createGuide: 'klienten-aufnahme', editGuide: 'klienten-akte' },
  { key: 'employees', label: 'Personal', pattern: /\b(?:mitarbeiter\w*|mitarbeitende\w*|personal\w*|angestellte\w*|team)\b/, destination: 'employees', guide: 'personal-anlegen', createGuide: 'personal-anlegen' },
  { key: 'calendar', label: 'Kalender', pattern: /\b(?:kalender|dienstplan|einsatzplanung)\b/, destination: 'calendar', guide: 'kalender-verfuegbarkeit', createGuide: 'einsatz-planen' },
  { key: 'assignments', label: 'Einsätze', pattern: /\b(?:einsatz|einsatze|besuch\w*)\b/, destination: 'assignments', guide: 'einsatz-uebersicht', createGuide: 'einsatz-planen', editGuide: 'einsatz-nachbearbeitung' },
  { key: 'invoices', label: 'Rechnung', pattern: /\b(?:rechnung\w*|abrechnung|zahlung\w*|mahnung\w*)\b/, destination: 'invoices', guide: 'rechnungen', createGuide: 'abrechnung-vorbereiten' },
  { key: 'evidence', label: 'Leistungsnachweise', pattern: /\b(?:leistungsnachweis\w*|nachweis\w*)\b/, destination: 'evidence', guide: 'nachweise-pruefen' },
  { key: 'documents', label: 'Dokumente', pattern: /\b(?:dokument\w*|unterlag\w*|datei\w*)\b/, destination: 'documents', guide: 'dokument-fassung', createGuide: 'dokument-ausfuellen' },
  { key: 'catalog', label: 'Vorlagen', pattern: /\b(?:vorlage\w*|dokumentenkatalog|katalog|textbaustein\w*)\b/, destination: 'catalog', guide: 'dokument-katalog', createGuide: 'dokument-ausfuellen' },
  { key: 'company', label: 'Unternehmen', pattern: /\b(?:unternehmen\w*|firma|firmendaten|betriebsdaten)\b/, destination: 'company', guide: 'unternehmen-stammdaten' },
  { key: 'portals', label: 'Portalzugänge', pattern: /\b(?:portal\w*|zugang\w*|zugange|einladung\w*)\b/, destination: 'portals', guide: 'portal-zugaenge', createGuide: 'portal-zugaenge' },
  { key: 'messages', label: 'Nachrichten', pattern: /\b(?:nachricht\w*|postfach|chat)\b/, destination: 'messages', guide: 'nachrichten', createGuide: 'nachrichten' },
  { key: 'appointments', label: 'Termine', pattern: /\btermin\w*\b/, destination: 'appointments', guide: 'einsatz-planen', createGuide: 'einsatz-planen' },
  { key: 'logbook', label: 'Fahrtenbuch', pattern: /\b(?:fahrtenbuch|fahrt(?:en)?|kilometer)\b/, destination: 'logbook', guide: 'fahrtenbuch' },
  { key: 'time', label: 'Arbeitszeit', pattern: /\b(?:arbeitszeit\w*|zeiterfassung|stundenkonto|zeitkonto)\b/, destination: 'time', guide: 'arbeitszeit' },
  { key: 'inventory', label: 'Inventar', pattern: /\b(?:inventar|gerat\w*|bestand\w*)\b/, destination: 'inventory', guide: 'inventar', createGuide: 'inventar' },
  { key: 'payroll', label: 'Gehaltsstatistik', pattern: /\b(?:gehalt\w*|lohn\w*)\b/, destination: 'payroll', guide: 'gehaltsstatistik' },
  { key: 'budgets', label: 'Budgets', pattern: /\b(?:budget\w*|abrechnungsquelle\w*)\b/, destination: 'budgets', guide: 'budgets' },
  { key: 'settings', label: 'Einstellungen', pattern: /\b(?:einstellung\w*|profil)\b/, destination: 'settings', guide: 'profil-einstellungen' },
];

export function neoTask(input: string): NeoTask | null {
  const text = cleanNeoText(input);
  if (/\b(?:problem\w*|fehler\w*|fehl(?:t|en)|falsch|verschwunden)\b|\b(?:nicht|kein\w*)\b.*\b(?:klapp\w*|funktionier\w*|speicher\w*|lad\w*|weiter|anmelden|einloggen)\b|\b(?:klapp\w*|funktionier\w*)\b.*\bnicht\b/.test(text)) return 'problem';
  if (/\b(?:anleg\w*|erstelle?\w*|eintrag\w*|erfass\w*|aufnehm\w*|hinzufug\w*|einricht\w*|ubernehm\w*|importier\w*)\b|\b(?:lege|leg|nimmt|nehme|nimm|richte|trag|trage|tragen)\b.*\b(?:an|auf|ein)\b/.test(text) || ['neu', 'eine neue', 'einen neuen', 'ein neues'].map(cleanNeoText).includes(text)) return 'create';
  if (/\b(?:bearbeit\w*|ander\w*|korrigier\w*|aktualisier\w*|anpass\w*)\b/.test(text)) return 'edit';
  if (/\b(?:wie|erklar\w*|anleitung|erlauter\w*)\b|\b(?:wissen|verstehen)\b/.test(text)) return 'explain';
  if (/\b(?:such\w*|finde\w*)\b/.test(text)) return 'search';
  if (/\b(?:offne\w*|aufmachen|ansehen|anschauen|anzeigen|zeigen|zeige|zeig|ubersicht|liste)\b|\bmach\w*\b.*\bauf\b/.test(text)) return 'open';
  return null;
}

export function neoSubjects(input: string): NeoSubject[] {
  const text = cleanNeoText(input);
  let subjects = NEO_SUBJECTS.filter(subject => subject.pattern.test(text));
  const has = (key: string) => subjects.some(subject => subject.key === key);
  const omit = (...keys: string[]) => { subjects = subjects.filter(subject => !keys.includes(subject.key)); };
  if (has('leave')) omit('employees', 'calendar');
  if (has('logo')) omit('company', 'documents');
  if (has('import')) omit('calendar', 'documents');
  if (has('signature')) omit('evidence', 'clients');
  if (has('catalog')) omit('documents');
  if (has('portals')) omit('employees', 'clients');
  if (has('login')) omit('portals');
  // A recipient/owner is context, not a second requested task.
  if (subjects.length > 1 && /\b(?:fur|von|eines|einer)\b.*\b(?:klient\w*|kund\w*|mitarbeiter\w*)\b/.test(text)) omit('clients', 'employees');
  return subjects;
}

export function neoGuideFor(subject: NeoSubject, task: NeoTask, input: string): string {
  const text = cleanNeoText(input);
  if (subject.key === 'leave' && /\b(?:kalender|planung|verfugbarkeit\w*)\b/.test(text)) return 'kalender-verfuegbarkeit';
  if (subject.key === 'signature' && /\b(?:spater|nachtrag\w*|nachhol\w*|fehlt|fehlend\w*|vergessen|portal)\b/.test(text)) return 'unterschrift-spaeter';
  if (subject.key === 'login' && (task === 'problem' || /\b(?:vergessen|zurucksetz\w*)\b/.test(text))) return 'zugang-wiederherstellen';
  if (subject.key === 'documents' && /\b(?:hochlad\w*|upload)\b/.test(text)) return 'dokument-upload';
  if (subject.key === 'assignments' && /\b(?:wiederkehr\w*|jede\w*|serie\w*|regelmassig)\b/.test(text)) return 'einsatz-serie';
  if (subject.key === 'clients' && /\b(?:kostentrager|versichertennummer|pflegekasse|krankenkasse)\b/.test(text)) return 'klienten-kostentraeger';
  if (subject.key === 'clients' && /\b(?:telefon\w*|anschrift|adresse|kontakt\w*|angehorige\w*)\b/.test(text)) return 'klienten-kontakte';
  if (subject.key === 'employees' && /\b(?:austritt|ausscheid\w*|gekundigt|kundig\w*)\b/.test(text)) return 'personal-austritt';
  if (task === 'create') return subject.createGuide ?? subject.guide;
  if (task === 'edit') return subject.editGuide ?? subject.guide;
  return subject.guide;
}

const guideOption = (label: string, id: string, answers: string[]): NeoOption => ({ label, answers, answer: { kind: 'guide', id } });
export function neoClarification(subject: NeoSubject): NeoClarification {
  if (subject.key === 'leave') return {
    question: 'Möchtest du Urlaub beim Personal erfassen oder eine Abwesenheit im Kalender berücksichtigen?',
    options: [guideOption('Beim Personal erfassen', 'personal-abwesenheit', ['personal', 'beim personal', 'eintragen', 'erfassen', 'urlaub eintragen']), guideOption('Im Kalender berücksichtigen', 'kalender-verfuegbarkeit', ['kalender', 'im kalender', 'planung', 'verfugbarkeit'])],
  };
  if (subject.key === 'signature') return {
    question: 'Möchtest du eine Unterschrift vor Ort erfassen oder eine fehlende Unterschrift später einholen?',
    options: [guideOption('Vor Ort erfassen', 'unterschrift-vor-ort', ['vor ort', 'jetzt', 'direkt']), guideOption('Später einholen', 'unterschrift-spaeter', ['spater', 'nachholen', 'fehlt', 'vergessen', 'im portal'])],
  };
  if (subject.key === 'login') return {
    question: 'Möchtest du wissen, welchen Zugang du brauchst, oder klappt die Anmeldung nicht?',
    options: [guideOption('Passenden Zugang finden', 'anmelden', ['welcher zugang', 'den zugang finden', 'anmelden']), guideOption('Anmeldeproblem lösen', 'zugang-wiederherstellen', ['klappt nicht', 'geht nicht', 'passwort vergessen', 'problem'])],
  };
  if (subject.key === 'logo') return {
    question: 'Möchtest du wissen, wie du dein Firmenlogo hochlädst und den Briefkopf einstellst?',
    options: [guideOption('Logo und Briefkopf erklären', 'dokument-logo', ['ja', 'erklaren', 'hochladen', 'briefkopf', 'logo hochladen'])],
  };
  const options: NeoOption[] = [];
  const destination = NEO_DESTINATIONS.find(d => d.key === subject.destination);
  if (destination) options.push({ label: `${destination.label} öffnen`, answers: ['offnen', 'aufmachen', 'ubersicht', 'die ubersicht', 'ansehen', 'anzeigen', 'liste'], answer: { kind: 'destination', key: destination.key } });
  if (subject.key === 'clients') options.push({ label: 'Eine Akte suchen', answers: ['suchen', 'eine akte', 'eine akte suchen', 'eine person', 'eine person suchen'], answer: { kind: 'clientName' } });
  const creationLabels: Record<string, string> = { invoices: 'Rechnung vorbereiten', employees: 'Mitarbeitende anlegen', calendar: 'Einsatz planen', assignments: 'Einsatz planen', appointments: 'Einsatztermin planen', documents: 'Dokument ausfüllen', catalog: 'Dokument ausfüllen', messages: 'Nachricht schreiben', inventory: 'Inventar erfassen', portals: 'Portalzugang einrichten' };
  if (subject.createGuide) options.push(guideOption(creationLabels[subject.key] ?? `${subject.label} anlegen`, subject.createGuide, ['anlegen', 'neu', 'eine neue', 'einen neuen', 'erstellen', 'eintragen', 'erfassen', 'einrichten', 'vorbereiten']));
  if (options.length < 3) options.push(guideOption('Ablauf erklären', subject.guide, ['erklaren', 'anleitung', 'wie geht das', 'wie das geht', 'hilfe', 'bearbeiten']));
  return { question: subject.key === 'clients'
    ? 'Möchtest du die Klientenübersicht öffnen, eine bestimmte Akte suchen oder einen neuen Klienten anlegen?'
    : subject.key === 'invoices' ? 'Möchtest du die Rechnungsübersicht öffnen, eine Rechnung vorbereiten oder den Ablauf erklärt bekommen?'
    : `Wobei brauchst du Unterstützung zum Thema „${subject.label}“? Du kannst wählen:\n${options.map((option, index) => `${index + 1}. ${option.label}`).join('\n')}`, options };
}

/** Only a genuine topic answer may fill a missing slot. A negation, a new task
 * or a condition must not inherit an earlier request to open a page. */
export function neoSubjectReply(input: string, subject: NeoSubject): boolean {
  const text = cleanNeoText(input).replace(/^(?:nein )?(?:ich meine|gemeint ist|es geht um|es handelt sich um|zum thema) /, '');
  if (!subject.pattern.test(text)) return false;
  const rest = text.replace(new RegExp(subject.pattern.source, 'g'), ' ').split(' ').filter(Boolean);
  return rest.every(word => ['die', 'der', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'einem', 'einer', 'beim', 'im', 'mit', 'und'].includes(word));
}

/** Match a clarification answer as a whole. "Ja" never chooses between options. */
export function neoClarificationAnswer(input: string, clarification: NeoClarification): NeoOption | null {
  const text = cleanNeoText(input).replace(/^(?:nein )?(?:ich meine|ich mochte|ich will|ich wurde gern|ich meinte) /, '').replace(/^(?:nur |lieber |eher |eigentlich )/, '');
  const index = neoChoice(text);
  if (index !== null) return clarification.options[index] ?? null;
  const matches = clarification.options.filter(option => [option.label, ...option.answers].some(answer => cleanNeoText(answer) === text));
  return matches.length === 1 ? matches[0] : null;
}

export function neoMissingTask(task: NeoTask): string {
  switch (task) {
    case 'create': return 'Was möchtest du anlegen oder eintragen, zum Beispiel einen Klienten, einen Mitarbeitenden oder Urlaub?';
    case 'edit': return 'Was möchtest du bearbeiten? Nenne zum Beispiel eine Rechnung, eine Klientenakte oder Unternehmensdaten.';
    case 'problem': return 'Wobei klappt es nicht: bei der Anmeldung, beim Speichern oder bei einer bestimmten Aufgabe?';
    case 'search': return 'Was suchst du: eine Klientenakte, eine Seite oder eine Anleitung?';
    case 'open': return 'Welche Seite möchtest du öffnen?';
    case 'explain': return 'Welchen Ablauf soll ich dir erklären? Nenne zum Beispiel Urlaub, Rechnungen oder Portalzugänge.';
  }
}

export function neoTaskOnly(input: string): NeoTask | null {
  const text = cleanNeoText(input);
  if (['neu', 'eine neue', 'einen neuen', 'ein neues'].map(cleanNeoText).includes(text)) return 'create';
  // Never retain an operation from an unrelated sentence such as "Ich möchte
  // eine Rakete bauen". These are genuinely incomplete requests.
  if (/^(?:(?:ich mochte|ich will|ich muss|ich wurde gern|kannst du mir|konntest du mir) )?(?:(?:etwas|was|das|es|eine neu\w*|einen neu\w*) )?(?:offnen|offne|zeigen|zeige|zeig|anlegen|erstellen|eintragen|erfassen|bearbeiten|andern|suchen|suche|erklaren|erklar|erklar mir|einrichten)(?: (?:etwas|was|das|es))?$/.test(text)) return neoTask(text);
  if (/^(?:ich brauche hilfe|ich habe ein problem|es geht nicht|geht nicht|klappt nicht|funktioniert nicht|das klappt nicht|ich komme nicht weiter)$/.test(text)) return 'problem';
  return null;
}
