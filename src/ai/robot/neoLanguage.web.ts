import type { PermissionKey } from '@/types/permissions';
import { VOICE_DESTINATIONS, normalizeVoiceText, parseVoiceCommand } from './voiceCommands';
import { parseNeoCommand, type NeoCommand } from './neoCommands';
import { HELP_ARTICLES } from '../../features/help/helpCatalog';
import type { HelpArticle } from '../../features/help/helpTypes';

export type NeoDestination = { key: string; label: string; route: string; permission: PermissionKey; words: readonly string[] };
export const NEO_DESTINATIONS: readonly NeoDestination[] = [
  ...VOICE_DESTINATIONS.map(d => ({ ...d, words: [...d.words, ...(({ employees: ['personalubersicht', 'personalliste', 'mitarbeiterliste'], clients: ['kundenliste', 'klientenubersicht'], calendar: ['kalender und einsatzplanung'] } as Record<string, string[]>)[d.key] ?? [])], route: d.key === 'home' ? '/Desktop' : d.key === 'calendar' ? '/assist/kalender' : d.route })),
  { key: 'catalog', label: 'Dokumentenkatalog', route: '/business/office/document-catalog', permission: 'office.documents.view', words: ['dokumentenkatalog', 'vorlagen', 'dokumentvorlagen', 'vorlagenkatalog'] },
  { key: 'company', label: 'Unternehmen', route: '/unternehmen', permission: 'office.access', words: ['unternehmen', 'firma', 'unternehmensakte', 'firmendaten'] },
  { key: 'inventory', label: 'Inventar', route: '/unternehmen/inventar', permission: 'inventory.view', words: ['inventar', 'gerate', 'bestande'] },
  { key: 'payroll', label: 'Gehaltsstatistik', route: '/business/office/payroll', permission: 'office.employees.view', words: ['gehaltsstatistik', 'lohnstatistik', 'gehalter'] },
  { key: 'portals', label: 'Portale und Zugänge', route: '/business/office/portals', permission: 'office.access', words: ['portale', 'zugange', 'portalzugange', 'portale und zugange'] },
  { key: 'budgets', label: 'Budgets', route: '/assist/abrechnungsquellen', permission: 'office.budgets.view', words: ['budgets', 'budget', 'abrechnungsquellen'] },
  { key: 'helpCenter', label: 'Hilfe und Anleitungen', route: '/hilfe', permission: 'office.access', words: ['hilfe', 'anleitungen', 'hilfeseite', 'hilfe und anleitungen'] },
];

export function cleanNeoText(input: string): string {
  const text = normalizeVoiceText(input)
    .replace(/^(?:(?:hey|hallo|hi|okay|ok) )?(?:neo|care suite|caresuite|roboter)\b\s*/, '');
  if (!text && /neo/i.test(input)) return 'hallo';
  // These short replies carry meaning; do not strip their words as politeness fillers.
  if (/^(?:gerne|gern|doch nicht|wie bitte)$/.test(text)) return text;
  if (/^noch mal(?: bitte)?$/.test(text)) return 'nochmal';
  return text.replace(/\b(?:bitte|mal|eben|gerne|doch|einfach|kurz)\b/g, '').replace(/\s+/g, ' ').trim();
}

export function neoChoice(text: string): number | null {
  const value = cleanNeoText(text).replace(/^(?:ich meine |ich nehme |nimm |die |der |den |das |nummer |treffer |auswahl )+/g, '').replace(/(?: person| treffer| eintrag| option)$/, '');
  const words = [['eins', 'ein', 'erste', 'ersten', '1'], ['zwei', 'zweite', 'zweiten', '2'], ['drei', 'dritte', 'dritten', '3'], ['vier', 'vierte', 'vierten', '4'], ['funf', 'funfte', 'funften', '5']];
  const index = words.findIndex(options => options.includes(value));
  return index < 0 ? null : index;
}
export function neoSmallTalk(input: string): NeoCommand | 'capabilities' | 'privacy' | 'frustration' | 'positive' | null {
  const raw = cleanNeoText(input);
  const text = raw.replace(/^(?:kannst du|konntest du|wurdest du) (?:mir )?/, '').replace(/^(?:sag|verrat|nenne) mir /, '').replace(/ (?:sagen|nennen|verraten)$/, '');
  const is = (pattern: RegExp) => pattern.test(raw) || pattern.test(text);
  const known = parseNeoCommand(raw) ?? parseNeoCommand(text);
  if (known) return known;
  if (is(/^(?:hallo zusammen|na|guten morgen neo|bist du da|horst du mich|kannst du mich horen|kannst du mich verstehen)$/)) return 'greeting';
  if (is(/^(?:wer du bist|wie du heisst|dein name|was bist du|erzahl mir etwas uber dich)$/)) return 'identity';
  if (is(/^(?:die uhrzeit|wie spat wir es haben|wie spat ist es jetzt|wie viel uhr haben wir|hast du die uhrzeit|hast du mal die uhrzeit)$/)) return 'time';
  if (is(/^(?:das datum|den heutigen tag|welchen tag haben wir|welches datum ist|was haben wir heute fur ein datum|was haben wir heute fur einen tag)$/)) return 'date';
  if (is(/^(?:das wetter|wetterbericht|wie sieht das wetter aus|wie sieht es draussen aus|ist es kalt|ist es warm|scheint die sonne|brauche ich eine jacke)$/)) return 'weather';
  if (is(/^(?:danke schon|vielen lieben dank|danke neo|danke fur deine hilfe|besten dank|super vielen dank)$/)) return 'thanks';
  if (is(/^(?:wie geht s dir|wie geht es dir heute|wie gehts|wie laufts|wie lauft es bei dir)$/)) return 'wellbeing';
  if (is(/^(?:bis dann|bis zum nachsten mal|mach s gut|mach es gut|ciao|tschau|aufhoren|gesprach beenden|fertig|das wars|das war s)$/)) return 'goodbye';
  if (is(/^(?:was noch|was kannst du noch|wobei kannst du mir helfen|was kann ich dich fragen|erzahl mir was du kannst|kannst du mir helfen|hilf mir|was kann ich mit dir machen)$/)) return 'help';
  if (is(/^(?:was verstehst du|verstehst du ganze satze|kannst du dich unterhalten|kannst du alles|bist du eine ki)$/)) return 'capabilities';
  if (is(/^(?:horst du immer zu|horst du die ganze zeit zu|speicherst du das gesprach|was passiert mit meinen daten|datenschutz)$/)) return 'privacy';
  if (is(/^(?:du verstehst mich nicht|das hilft mir nicht|das funktioniert nicht|das ist falsch|du bist dumm|das ist doof|so ein mist)$/)) return 'frustration';
  if (is(/^(?:gut|super|prima|perfekt|mir geht es gut|alles gut|passt|sehr gut)$/)) return 'positive';
  return null;
}

/** Whole utterances, never substring-executed actions. Negations and compound requests cannot open a page. */
export function neoNavigation(input: string): NeoDestination | null {
  const text = cleanNeoText(input);
  if (/\b(?:nicht|kein\w*|losch\w*|send\w*|speicher\w*|ander\w*|bezahl\w*|und dann|danach)\b/.test(text)) return null;
  const legacy = parseVoiceCommand(input);
  if (legacy.kind === 'navigate') return NEO_DESTINATIONS.find(d => d.key === legacy.destination.key)!;
  const target = text
    .replace(/^(?:kannst du|konntest du|wurdest du) (?:mir )?/, '')
    .replace(/^(?:ich mochte|ich will|ich brauche|ich muss|ich wurde gern) /, '')
    .replace(/^(?:wo finde ich|wo ist|wo sind|bring mich|fuhr mich|lass uns|lass mich|offne|offnen|zeige|zeig|gehe|geh|wechsle|wechsel|navigiere) /, '')
    .replace(/^(?:(?:mir|mich|zu|zur|zum|in|auf|die|der|das|den|dem|meine|meinen|meinem|unseren|unsere) )+/, '')
    .replace(/ (?:sehen|ansehen|anschauen|offnen|anzeigen|zeigen|wechseln|gehen|haben)$/, '');
  return NEO_DESTINATIONS.find(d => d.words.includes(target) || (d.key === 'home' && ['desktop', 'mein desktop', 'ubersicht'].includes(target))) ?? null;
}

// Product vocabulary is shared with the maintained help catalogue. This is retrieval,
// not invented knowledge or a claim to understand arbitrary requests.
const aliases: Record<string, string> = {
  patient: 'klient', patienten: 'klient', patientin: 'klient', kunden: 'klient', kunde: 'klient', klientinnen: 'klient',
  mitarbeiter: 'personal', mitarbeitende: 'personal', mitarbeiterin: 'personal', angestellte: 'personal', team: 'personal',
  login: 'anmeld', einloggen: 'anmeld', einloggenproblem: 'anmeld', passwort: 'passwort',
  signatur: 'unterschrift', signieren: 'unterschrift', unterschreiben: 'unterschrift', unterschrieben: 'unterschrift',
  upload: 'hochlad', hochladen: 'hochlad', importieren: 'import', uebernehmen: 'ubernahm',
  urlaub: 'abwesenheit', krank: 'abwesenheit', krankheit: 'abwesenheit', ferien: 'abwesenheit',
  dokumentenkatalog: 'katalog', dienstplan: 'dienstplan', logo: 'logo', firmenlogo: 'logo',
  lohn: 'gehalt', stundenkonto: 'arbeitszeit', zeiterfassung: 'arbeitszeit', zeiten: 'arbeitszeit',
  lege: 'anleg', legean: 'anleg', erfasse: 'anleg', erstelle: 'anleg', nuen: 'anleg', nue: 'anleg', nuer: 'anleg', lade: 'hochlad', anlegen: 'anleg', erstellen: 'anleg', erfassen: 'anleg', aufnehmen: 'anleg', neuer: 'anleg', neue: 'anleg', neuen: 'anleg',
};
const stopWords = new Set('hoch ich du sie wir man es ist sind bin bist hat haben habe kann kannst konnte konntest wie was wo wann warum weshalb wieso wer welche welcher welches welchen den dem der die das ein eine einen einer einem eines und oder aber denn zu zum zur auf in im am an aus mit ohne fur von uber mir mich dich dir sich uns bitte mal eben gerne gern doch noch einfach kurz zeig zeige sag erklar erklare erzahl mochte will muss sollte hilfe helfen funktioniert funktionierts funktioniertes geht gehe machen mache bekomme finde findeich brauche dann jetzt heute mein meine meinen meinem unser unsere unseren richtig genau weiter damit dazu dies diese dieser dieses eines einer tut tun'.split(' '));
function stem(word: string): string {
  if (aliases[word]) return aliases[word];
  return word.length > 5 ? word.replace(/(?:innen|enden|ern|en|er|es|e|n|s)$/, '') : word;
}
export function neoSearchTokens(input: string): string[] {
  return [...new Set(cleanNeoText(input).split(' ').filter(w => w.length > 1 && !stopWords.has(w)).map(stem))];
}
const helpIndex = HELP_ARTICLES.filter(a => a.audiences.includes('verwaltung')).map(article => ({
  article,
  title: neoSearchTokens(article.title + ' ' + article.keywords.join(' ')),
  summary: neoSearchTokens(article.summary),
  body: neoSearchTokens(article.steps.map(s => s.title + ' ' + s.text).join(' ') + ' ' + article.troubleshooting.map(t => t.problem + ' ' + t.solution).join(' ')),
}));
function closeWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, errors = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++errors > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return errors + a.length - i + b.length - j <= 1;
}
export function findNeoHelp(input: string): { article: HelpArticle; score: number }[] {
  const tokens = neoSearchTokens(input);
  if (!tokens.length) return [];
  return helpIndex.flatMap(entry => {
    let score = 0, matched = 0, strong = 0;
    for (const token of tokens) {
      const title = entry.title.some(w => closeWord(token, w));
      const summary = entry.summary.some(w => closeWord(token, w));
      const body = entry.body.some(w => closeWord(token, w));
      if (title || summary || body) matched++;
      if (title) strong++;
      score += title ? 12 : summary ? 5 : body ? 1 : 0;
    }
    // Unrelated words cannot silently disappear from the query.
    if (!strong || matched / tokens.length < 0.6) return [];
    return [{ article: entry.article, score: score / Math.sqrt(entry.title.length) + matched / tokens.length * 2 }];
  }).sort((a, b) => b.score - a.score);
}
