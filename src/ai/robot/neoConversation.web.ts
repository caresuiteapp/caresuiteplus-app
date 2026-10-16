import { createNeoReplies } from './neoCommands';
import { normalizeVoiceText, parseVoiceCommand, type VoiceClient } from './voiceCommands';
import { cleanNeoText, findNeoHelp, neoChoice, neoNavigation, neoSmallTalk, NEO_DESTINATIONS, type NeoDestination } from './neoLanguage.web';
import { neoClarification, neoClarificationAnswer, neoGuideFor, neoMissingTask, neoSubjectReply, neoSubjects, neoTask, neoTaskOnly, type NeoAnswer, type NeoClarification, type NeoSubject, type NeoTask } from './neoUnderstanding.web';
import { HELP_ARTICLES } from '../../features/help/helpCatalog';
import type { HelpArticle } from '../../features/help/helpTypes';

export type NeoAction = { kind: 'navigate'; destination: NeoDestination } | { kind: 'client'; id: string } | { kind: 'back' };
export type NeoResponse = { text: string; suggestions?: string[]; action?: NeoAction; end?: boolean };
export type NeoConversationDependencies = {
  canNavigate: (destination: NeoDestination) => boolean;
  canSearchClients: () => boolean;
  canGoBack?: () => boolean;
  searchClients: (name: string) => Promise<VoiceClient[]>;
  getProfileName?: () => string;
  getWeather?: (signal: AbortSignal) => Promise<string>;
};
type Pending = { kind: 'name' } | { kind: 'clients'; clients: VoiceClient[] } | { kind: 'topics'; articles: HelpArticle[] }
  | { kind: 'clarify'; subject: NeoSubject; clarification: NeoClarification }
  | { kind: 'task'; task: NeoTask } | { kind: 'subjects'; subjects: NeoSubject[]; task: NeoTask | null } | null;
const YES = /^(?:ja|ja gerne|ja gern|ja klar|ja mach das|ja bitte|mach das|klar|gerne|gern|okay|ok|in ordnung|los|weiter|gerne weiter)$/;
const NO = /^(?:nein|nein danke|lieber nicht|doch nicht|nicht jetzt|lassen wir das)$/;
const STOP = /^(?:stopp?|abbrechen|abbruch|vergiss es|aufhoren|gesprach beenden|sei still|ruhe|mikrofon aus|schliessen)$/;
const REPEAT = /^(?:nochmal|noch einmal|wiederhole das|wiederholen|was hast du gesagt|sag das nochmal|wie bitte|wiederhole den schritt)$/;
const OPEN = /^(?:ja )?(?:offne (?:das|es|die seite)|das offnen|offnen|dorthin|bring mich dorthin|zeig mir (?:das|die seite)|mach (?:das|es) auf)$/;
const NEXT = /^(?:weiter|und dann|was dann|was kommt danach|was kommt als nachstes|nachster schritt|den nachsten schritt|verstanden|erledigt|habe ich|hab ich|ja|okay|ok|das habe ich gemacht|das hab ich gemacht|ich bin so weit|ich bin soweit|wie geht es weiter|was muss ich jetzt machen|und jetzt)$/;
const EXAMPLE = /^(?:ein )?beispiel(?: dazu)?$|^(?:(?:kannst|konntest|wurdest) du )?(?:zeig|gib|nenne)? ?mir (?:dazu )?ein beispiel(?: (?:zeigen|geben|nennen))?$|^zum beispiel$/;
const PREVIOUS = /^(?:zuruck|einen schritt zuruck|vorheriger schritt|den vorherigen schritt|noch mal zuruck)$/;
const defaultSuggestions = ['Was kannst du?', 'Wie lege ich Klienten an?', 'Kalender öffnen'];
const nameOf = (c: VoiceClient) => [c.firstName, c.lastName].filter(Boolean).join(' ');
const clientLabel = (c: VoiceClient) => `${nameOf(c)}${c.city ? `, ${c.city}` : ''}`;

/** Per-mount memory only. No transcript persistence, generated routes or write operations. */
export function createNeoConversation(deps: NeoConversationDependencies) {
  const reply = createNeoReplies();
  let pending: Pending = null;
  let guide: { article: HelpArticle; step: number } | null = null;
  let last: NeoResponse | null = null;
  let touched = Date.now();
  const remember = (value: NeoResponse) => { last = value; touched = Date.now(); return value; };
  const clearTopic = () => { pending = null; guide = null; };
  const denied = () => ({ text: 'Für diesen Bereich fehlen dir die nötigen Rechte oder die Freigabe. Deine Verwaltung kann den Zugang prüfen.', suggestions: ['Andere Frage', 'Was kannst du?'] });
  const navigate = (destination: NeoDestination): NeoResponse => {
    clearTopic();
    return deps.canNavigate(destination) ? { text: `Ich öffne „${destination.label}“.`, action: { kind: 'navigate', destination } } : denied();
  };
  const helpDestination = (article: HelpArticle): NeoDestination => ({ key: 'helpArticle', label: article.title, route: `/hilfe?artikel=${encodeURIComponent(article.id)}`, permission: 'office.access', words: [] });
  const guideResponse = (): NeoResponse => {
    if (!guide) return { text: 'Wobei möchtest du Unterstützung?', suggestions: defaultSuggestions };
    const { article, step } = guide;
    if (step >= article.steps.length) return {
      text: `Das waren alle Schritte zu „${article.title}“. Prüfe zum Abschluss: ${article.checks.join(' ')} Soll ich die vollständige Anleitung öffnen?`,
      suggestions: ['Anleitung öffnen', 'Beispiel', 'Von vorne'],
    };
    const item = article.steps[step];
    return { text: `${step === 0 ? article.title + '.\n\n' : ''}Schritt ${step + 1} von ${article.steps.length}: ${item.title}.\n${item.text}\n\n${step + 1 < article.steps.length ? 'Sag „weiter“ für den nächsten Schritt.' : 'Möchtest du ein Beispiel oder die vollständige Anleitung?'}`, suggestions: step + 1 < article.steps.length ? ['Weiter', 'Beispiel', 'Anleitung öffnen'] : ['Beispiel', 'Anleitung öffnen', 'Von vorne'] };
  };
  const beginGuide = (article: HelpArticle): NeoResponse => { pending = null; guide = { article, step: 0 }; return guideResponse(); };
  const askName = (): NeoResponse => {
    guide = null;
    if (!deps.canSearchClients()) { pending = null; return denied(); }
    pending = { kind: 'name' };
    return { text: 'Von welcher Person möchtest du die Klientenakte öffnen?', suggestions: ['Klienten öffnen', 'Abbrechen'] };
  };
  const answerOption = (answer: NeoAnswer): NeoResponse => {
    if (answer.kind === 'clientName') return askName();
    if (answer.kind === 'destination') {
      const destination = NEO_DESTINATIONS.find(d => d.key === answer.key);
      if (destination) return navigate(destination);
    } else {
      const article = HELP_ARTICLES.find(a => a.id === answer.id && a.audiences.includes('verwaltung'));
      if (article) return beginGuide(article);
    }
    clearTopic();
    return { text: 'Dafür finde ich gerade keine passende Anleitung. Welche Aufgabe möchtest du erledigen?', suggestions: defaultSuggestions };
  };
  const clarify = (subject: NeoSubject): NeoResponse => {
    guide = null;
    const clarification = neoClarification(subject);
    pending = { kind: 'clarify', subject, clarification };
    return { text: clarification.question, suggestions: clarification.options.map(option => option.label) };
  };
  const resolveTask = (subject: NeoSubject, task: NeoTask, input: string): NeoResponse => {
    if (task === 'search' && subject.key === 'clients') return askName();
    if (task === 'open' || task === 'search') return subject.destination ? answerOption({ kind: 'destination', key: subject.destination }) : clarify(subject);
    return answerOption({ kind: 'guide', id: neoGuideFor(subject, task, input) });
  };
  const askTask = (task: NeoTask): NeoResponse => {
    guide = null; pending = { kind: 'task', task };
    return { text: neoMissingTask(task), suggestions: task === 'problem' ? ['Anmeldung klappt nicht', 'Speichern funktioniert nicht'] : task === 'open' ? ['Kalender', 'Rechnungen', 'Klienten'] : ['Klienten', 'Personal', 'Urlaub'] };
  };
  const chooseClient = (client: VoiceClient): NeoResponse => {
    pending = null;
    return deps.canSearchClients() ? { text: `Ich öffne die Akte von ${nameOf(client)}.`, action: { kind: 'client', id: client.id } } : denied();
  };
  const search = async (name: string, signal: AbortSignal): Promise<NeoResponse> => {
    guide = null;
    if (!deps.canSearchClients()) { pending = null; return denied(); }
    const clients = await deps.searchClients(name);
    signal.throwIfAborted();
    if (!deps.canSearchClients()) { pending = null; return denied(); }
    if (!clients.length) {
      pending = { kind: 'name' };
      return { text: `Zu „${name}“ finde ich keine passende Klientenakte. Wie lautet der Vor- und Nachname?`, suggestions: ['Klienten öffnen', 'Abbrechen'] };
    }
    if (clients.length === 1) return chooseClient(clients[0]);
    if (clients.length > 5 || new Set(clients.map(clientLabel)).size !== clients.length) {
      pending = { kind: 'name' };
      return { text: `Es gibt ${clients.length} passende Akten. Nenne bitte den vollständigen Namen. Bei identischen Namen kannst du die richtige Akte in der Klientenübersicht auswählen.`, suggestions: ['Klienten öffnen', 'Abbrechen'] };
    }
    pending = { kind: 'clients', clients };
    return { text: `Welche Person meinst du?\n${clients.map((c, i) => `${i + 1}. ${clientLabel(c)}`).join('\n')}\nDu kannst den Namen oder die Nummer sagen.`, suggestions: clients.map((_c, i) => `Nummer ${i + 1}`) };
  };
  const askTopics = (articles: HelpArticle[]): NeoResponse => {
    guide = null; pending = { kind: 'topics', articles: articles.slice(0, 3) };
    return { text: `Dazu passen mehrere Anleitungen. Welche brauchst du?\n${pending.articles.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}`, suggestions: pending.articles.map((_a, i) => `Nummer ${i + 1}`) };
  };
  const safeName = (raw: string): string | null => {
    const name = raw.trim().replace(/[.!?,]+$/g, '').replace(/^(?:nein[, ]+)?(?:ich meine|gemeint ist|es ist|es geht um|der name ist|(?:die person|der klient|die klientin|sie|er) (?:heißt|heisst))\s+/i, '').replace(/^(?:(?:die|der|den)\s+)?(?:frau|herrn?)\s+/i, '').trim();
    const normalized = normalizeVoiceText(name);
    if (!/^[\p{L} '-]{2,100}$/u.test(name) || name.split(/\s+/).length > 6 || /\b(?:und|oder|dann|nicht|kein\w*|ja|nein|hilfe|akte|klientenakte|offne|suche|frage|weiss|weis|vielleicht|warum|wie|geht|danke|ich|mochte|offnen|eintragen|erstellen|anlegen)\b/.test(normalized)) return null;
    return name;
  };

  const respond = async (input: string, signal: AbortSignal): Promise<NeoResponse> => {
    signal.throwIfAborted();
    if (Date.now() - touched > 5 * 60_000) { clearTopic(); last = null; }
    const text = cleanNeoText(input);
    if (!text || input.length > 1000) return remember({ text: 'Sag oder schreibe bitte eine kurze Frage zu CareSuite.', suggestions: defaultSuggestions });
    if (STOP.test(text) || neoSmallTalk(text) === 'goodbye') {
      clearTopic(); return remember({ text: 'Alles klar. Das Mikrofon ist aus. Bis später.', end: true });
    }
    if (REPEAT.test(text)) return last ? { ...last, action: undefined, end: undefined } : remember({ text: 'Frag mich etwas oder nenne die Seite, die du öffnen möchtest.', suggestions: defaultSuggestions });
    if (/^(?:andere frage|neues thema|von vorn anfangen|thema wechseln)$/.test(text)) {
      clearTopic(); return remember({ text: 'Was möchtest du wissen oder erledigen?', suggestions: defaultSuggestions });
    }
    if (NO.test(text)) { clearTopic(); return remember({ text: 'Okay. Wobei kann ich dir stattdessen helfen?', suggestions: defaultSuggestions }); }
    if (/^(?:(?:ich bin|ich weiss|ich weis|weiss ich|weis ich) )?(?:noch )?(?:nicht sicher|nicht|unsicher|keine ahnung)$/.test(text)) {
      if (pending?.kind === 'clarify') return remember({ text: pending.clarification.question, suggestions: pending.clarification.options.map(option => option.label) });
      if (pending?.kind === 'name') return remember(askName());
      if (pending?.kind === 'task') return remember({ text: neoMissingTask(pending.task), suggestions: defaultSuggestions });
      return remember({ text: 'Beschreibe, was du erledigen möchtest. Wir können auch mit einem Thema wie Urlaub, Rechnungen oder Klienten anfangen.', suggestions: ['Urlaub', 'Eine Rechnung', 'Klient'] });
    }

    const subjects = neoSubjects(input);
    const task = neoTask(input);
    if (pending?.kind === 'name' && /^(?:(?:die person|der klient|die klientin|sie|er) (?:heißt|heisst)|es geht um|der name ist)\s+/i.test(input)) {
      const name = safeName(input);
      if (name) return remember(await search(name, signal));
    }
    // A direct answer belongs to the question Neo just asked. For example,
    // "Kalender" after the vacation question selects the calendar guide.
    if (pending?.kind === 'clarify') {
      const option = neoClarificationAnswer(input, pending.clarification);
      if (option) return remember(answerOption(option.answer));
      if (YES.test(text) || neoChoice(text) !== null) return remember({ text: `Welche Möglichkeit meinst du? ${pending.clarification.question}`, suggestions: pending.clarification.options.map(option => option.label) });
      const incomplete = neoTaskOnly(input);
      if (incomplete) return remember(resolveTask(pending.subject, incomplete, input));
      if (subjects.length === 1 && subjects[0].key === pending.subject.key && task && task !== 'open' && task !== 'search') return remember(resolveTask(subjects[0], task, input));
    }
    if (pending?.kind === 'task' && subjects.length === 1 && !task && neoSubjectReply(input, subjects[0])) return remember(resolveTask(subjects[0], pending.task, input));
    if (pending?.kind === 'subjects') {
      const index = neoChoice(text);
      const selected = index !== null ? pending.subjects[index] : subjects.length === 1 && !task && neoSubjectReply(input, subjects[0]) ? pending.subjects.find(s => s.key === subjects[0].key) : undefined;
      if (selected) return remember(pending.task ? resolveTask(selected, pending.task, input) : clarify(selected));
      if (YES.test(text) || index !== null) return remember({ text: 'Welches Thema meinst du? Nenne eines der angezeigten Themen.', suggestions: pending.subjects.map(s => s.label) });
    }

    if (subjects.length === 1 && !task && neoSubjectReply(input, subjects[0])) return remember(clarify(subjects[0]));

    // Explicit new requests always take priority over a pending name/number.
    const destination = neoNavigation(input);
    if (destination) return remember(navigate(destination));
    const legacy = parseVoiceCommand(input);
    if (/^(?:offne|suche|zeig mir|ich suche|ich brauche) (?:eine |die )?(?:akte|klientenakte)(?: von)?$/.test(text)) {
      return remember(askName());
    }
    const clientRequest = input.trim().replace(/[.!?]+$/g, '')
      .replace(/^(?:(?:hey|hallo)\s+)?(?:neo|care suite|caresuite|roboter)[, ]+/i, '')
      .replace(/\b(?:bitte|mal|gerne|kurz|eben|einmal|für mich|fuer mich)\b/gi, '').replace(/\s+/g, ' ').trim()
      .replace(/^(?:kannst|könntest|koenntest|würdest|wuerdest) du (?:mir )?/i, '')
      .replace(/^(?:ich möchte|ich moechte|ich würde(?: gern)?|ich will|ich brauche|ich suche|suche|such|finde|zeig(?:e)?(?: mir)?|öffne|oeffne|offne)\s+/i, '')
      .replace(/^(?:für mich|fuer mich|mir)\s+/i, '')
      .match(/^(?:(?:die|eine|den|einen)\s+)?(?:akte|klient(?:en|innen)\s*akte|kunden\s*akte|klient(?:in|en)?|kund(?:e|in|en))\s+(?:(?:von|für|fuer|heißt|heisst)\s+)?(.+?)(?:\s+(?:öffnen|oeffnen|offnen|anzeigen|zeigen|ansehen|sehen|finden|suchen|heraussuchen|raussuchen|aufmachen))?$/i);
    if (clientRequest && task !== 'create' && task !== 'edit' && task !== 'explain' && task !== 'problem' && !/\b(?:nicht|kein\w*|anlegen|erstellen|loschen|losche|andern|speichern|neu\w*|nuen|nue)\b/.test(text)) {
      const name = safeName(clientRequest[1]);
      if (name) return remember(await search(name, signal));
    }

    const smallTalk = neoSmallTalk(input);
    if (smallTalk === 'weather') {
      clearTopic();
      try {
        if (!deps.getWeather) throw new Error('weather-unavailable');
        const weather = await deps.getWeather(signal); signal.throwIfAborted();
        return remember({ text: weather, suggestions: ['Wie spät ist es?', 'Andere Frage'] });
      } catch (error) {
        signal.throwIfAborted();
        return remember({ text: error instanceof Error && error.message === 'weather-location-denied' ? 'Bitte erlaube den Standort im Browser. Dann kann ich das Wetter in deiner Nähe abrufen.' : 'Ich bekomme gerade keine verlässlichen Wetterdaten. Möchtest du etwas anderes wissen?', suggestions: defaultSuggestions });
      }
    }
    if (smallTalk && smallTalk !== 'repeat' && smallTalk !== 'goodbye') {
      if (smallTalk === 'thanks' && guide) return remember({ text: 'Gern. Möchtest du mit der Anleitung weitermachen?', suggestions: ['Weiter', 'Beispiel', 'Andere Frage'] });
      if (smallTalk === 'positive' && guide) { guide.step++; return remember(guideResponse()); }
      if (smallTalk === 'frustration' && !guide) return remember(askTask('problem'));
      if (smallTalk === 'privacy') return remember({ text: 'Das Mikrofon läuft nur nach deinem Start und solange das Gespräch aktiv ist. Während ich spreche, ist die Erkennung pausiert. Stoppen, Schließen oder ein Seitenwechsel schaltet es aus. Der Verlauf bleibt nur in diesem geöffneten Gespräch. Die Spracherkennung nutzt den Sprachdienst deines Browsers.', suggestions: ['Was kannst du?', 'Gespräch beenden'] });
      if (smallTalk === 'capabilities' || smallTalk === 'help') {
        clearTopic(); return remember({ text: 'Ich helfe dir bei CareSuite: Seiten und Klientenakten öffnen, Abläufe Schritt für Schritt erklären und passende Anleitungen finden. Du kannst Rückfragen stellen, „weiter“ oder „Beispiel“ sagen und Antworten korrigieren. Welche Aufgabe steht an?', suggestions: defaultSuggestions.slice(1).concat('Wie richte ich Portalzugänge ein?') });
      }
      if (smallTalk === 'positive') return remember({ text: 'Was möchtest du als Nächstes machen?', suggestions: defaultSuggestions });
      if (smallTalk === 'greeting' || smallTalk === 'wellbeing' || smallTalk === 'identity') clearTopic();
      if (smallTalk !== 'frustration') return remember({ text: reply(smallTalk, deps.getProfileName?.() ?? ''), suggestions: guide ? ['Weiter', 'Beispiel', 'Andere Frage'] : defaultSuggestions });
    }

    if (pending?.kind === 'topics') {
      const index = neoChoice(text);
      if (index !== null && pending.articles[index]) return remember(beginGuide(pending.articles[index]));
      const matches = findNeoHelp(input).filter(m => pending?.kind === 'topics' && pending.articles.some(a => a.id === m.article.id));
      if (matches.length === 1 || matches.length && matches[0].score > (matches[1]?.score ?? 0) * 1.3) return remember(beginGuide(matches[0].article));
      if (index !== null || YES.test(text)) return remember({ text: 'Welche Anleitung meinst du? Sag den Titel oder eine der angezeigten Nummern.', suggestions: pending.articles.map((_a, i) => `Nummer ${i + 1}`) });
    }
    if (pending?.kind === 'clients') {
      if (!deps.canSearchClients()) { pending = null; return remember(denied()); }
      const index = neoChoice(text);
      if (index !== null && pending.clients[index]) return remember(chooseClient(pending.clients[index]));
      const refined = text.replace(/^(?:nein )?(?:ich meine |die |der |den |frau |herrn? |aus )+/g, '');
      const tokens = refined.split(' ').filter(Boolean);
      const matches = pending.clients.filter(c => {
        const available = normalizeVoiceText(clientLabel(c)).split(' ');
        return tokens.length && tokens.every(t => available.includes(t));
      });
      if (matches.length === 1) return remember(chooseClient(matches[0]));
      if (index !== null || YES.test(text)) return remember({ text: 'Welche Person meinst du genau? Nenne eine der angezeigten Nummern oder den vollständigen Namen.', suggestions: pending.clients.map((_c, i) => `Nummer ${i + 1}`) });
      // A correction may name someone outside the original search result.
      if (/^(?:nein )?ich meine /.test(text)) {
        const name = safeName(input); if (name) return remember(await search(name, signal));
      }
    }
    const help = findNeoHelp(input);
    if (pending?.kind === 'name' && !help.length && !subjects.length && !task) {
      const name = safeName(input);
      if (name) return remember(await search(name, signal));
    }
    if (guide) {
      if (/^(?:anleitung offnen|vollstandige anleitung|alles anzeigen|zur anleitung)$/.test(text) || OPEN.test(text)) return remember(navigate(helpDestination(guide.article)));
      if (EXAMPLE.test(text)) return remember({ text: `Beispiel mit erfundenen Angaben: ${guide.article.example.title}.\n${guide.article.example.text}`, suggestions: ['Weiter', 'Schritt wiederholen', 'Anleitung öffnen'] });
      if (REPEAT.test(text) || text === 'schritt wiederholen') return remember(guideResponse());
      if (text === 'von vorne' || text === 'von vorn' || text === 'nochmal von vorne') { guide.step = 0; return remember(guideResponse()); }
      if (PREVIOUS.test(text)) { guide.step = Math.max(0, guide.step - 1); return remember(guideResponse()); }
      if (NEXT.test(text) || YES.test(text)) {
        if (guide.step >= guide.article.steps.length) return remember(navigate(helpDestination(guide.article)));
        guide.step++; return remember(guideResponse());
      }
      if (/^(?:und wenn das nicht klappt|das klappt nicht|das funktioniert nicht|geht nicht|ich komme nicht weiter|was kann schiefgehen|ich habe das nicht verstanden|das habe ich nicht verstanden|das verstehe ich nicht)$/.test(text)) return remember({ text: guide.article.troubleshooting.map(t => `${t.problem} ${t.solution}`).join('\n\n') || 'Beschreibe bitte, bei welchem Schritt du festhängst.', suggestions: ['Schritt wiederholen', 'Anleitung öffnen', 'Andere Frage'] });
    }
    if (legacy.kind === 'back') { clearTopic(); return remember(deps.canGoBack?.() === false ? { text: 'Hier gibt es keine vorherige Seite. Wohin möchtest du?', suggestions: defaultSuggestions } : { text: 'Ich gehe zur vorherigen Seite.', action: { kind: 'back' } }); }

    const exactArticle = HELP_ARTICLES.find(article => article.audiences.includes('verwaltung') && cleanNeoText(article.title) === text);
    if (exactArticle) return remember(beginGuide(exactArticle));

    const incomplete = neoTaskOnly(input);
    if (incomplete) return remember(askTask(incomplete));
    if (subjects.length > 1 && (!help.length || task === 'open' || /\b(?:und|oder|danach)\b/.test(text))) {
      guide = null; pending = { kind: 'subjects', subjects: subjects.slice(0, 5), task: task === 'open' ? 'open' : null };
      return remember({ text: `Du hast mehrere Themen genannt. Womit möchtest du anfangen: ${pending.subjects.map(s => s.label).join(', ')}?`, suggestions: pending.subjects.map(s => s.label) });
    }
    if (subjects.length === 1) {
      const subject = subjects[0];
      if (!task || task === 'open' || task === 'search') return remember(clarify(subject));
      if (task === 'create' || task === 'edit' || !help.length) return remember(resolveTask(subject, task, input));
    }
    if (help.length) {
      if (help[1] && help[0].score < help[1].score * 1.18) return remember(askTopics(help.slice(0, 3).map(item => item.article)));
      return remember(beginGuide(help[0].article));
    }
    if (/^(?:offne|offnen|zeige|zeig|bring mich|wohin|ich mochte etwas offnen)$/.test(text)) {
      return remember(askTask('open'));
    }
    if (YES.test(text) || OPEN.test(text) || neoChoice(text) !== null) return remember({ text: 'Worauf beziehst du dich? Nenne bitte die Seite oder die Aufgabe.', suggestions: defaultSuggestions });
    if (/\b(?:losch\w*|send\w*|speicher\w*|bezahl\w*|genehmig\w*)\b/.test(text)) return remember({ text: 'Daten ändern, freigeben oder versenden musst du selbst im jeweiligen Bereich. Ich kann dir den passenden Ablauf erklären. Worum geht es?', suggestions: ['Rechnungen öffnen', 'Nachrichten öffnen', 'Andere Frage'] });
    if (pending?.kind === 'clarify') return remember({ text: `Ich bin noch beim Thema „${pending.subject.label}“. ${pending.clarification.question} Für etwas anderes sag „Andere Frage“.`, suggestions: pending.clarification.options.map(option => option.label) });
    if (pending?.kind === 'task') return remember({ text: neoMissingTask(pending.task), suggestions: defaultSuggestions });
    if (pending?.kind === 'name') return remember(askName());
    return remember({ text: 'Das kann ich noch keiner CareSuite-Aufgabe zuordnen. Möchtest du eine Seite öffnen, eine Klientenakte suchen oder einen Ablauf erklärt bekommen?', suggestions: defaultSuggestions.slice(1).concat('Was kannst du?') });
  };
  return { respond, reset: () => { clearTopic(); last = null; touched = Date.now(); } };
}
