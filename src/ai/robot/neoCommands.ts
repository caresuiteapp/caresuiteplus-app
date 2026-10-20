import { normalizeVoiceText } from './voiceCommands';

export type NeoCommand = 'greeting' | 'identity' | 'time' | 'date' | 'weather' | 'weatherUnsupported' | 'thanks' | 'wellbeing' | 'goodbye' | 'repeat' | 'help';
export const NEO_INTRODUCTION = 'Ich bin Neo, dein kleiner Assistent in deinem CareSuite Health OS.';

/** Small explicit intent set. Does not execute arbitrary instructions or actions. */
export function parseNeoCommand(input: string): NeoCommand | null {
  if (input.length > 240) return null;
  const text = normalizeVoiceText(input).replace(/^(?:hey |hallo )?neo[, ]*/, '').replace(/ bitte$/, '').trim();
  if (/^(?:hallo|hi|hey|servus|moin|guten morgen|guten tag|guten abend)(?: neo)?$/.test(text) || !text && /neo/i.test(input)) return 'greeting';
  if (/^(?:wer bist du|wie heisst du|wie ist dein name|stell dich vor)$/.test(text)) return 'identity';
  if (/^(?:wie spat ist es|wie viel uhr ist es|wieviel uhr ist es|sag mir die uhrzeit|uhrzeit)$/.test(text)) return 'time';
  if (/^(?:welcher tag ist heute|was fur ein tag ist heute|welches datum haben wir|welches datum ist heute|welches datum haben wir heute|sag mir das datum|datum|was ist heute fur ein tag)$/.test(text)) return 'date';
  if (/^(?:wie ist (?:heute |gerade |aktuell )?das wetter(?: heute| gerade| aktuell| draussen| hier)?|wie ist das wetter bei mir|wie warm ist es(?: draussen| heute| gerade)?|wetter|regnet es(?: gerade| draussen)?|brauche ich einen regenschirm)$/.test(text)) return 'weather';
  if (/\b(?:wetter|regnet|regenschirm|warm)\b/.test(text) && /\b(?:morgen|ubermorgen|gestern|nachste|wochenende|in)\b/.test(text)) return 'weatherUnsupported';
  if (/^(?:danke|dankeschon|vielen dank|danke dir|super danke|alles klar danke)$/.test(text)) return 'thanks';
  if (/^(?:wie geht es dir|wie gehts dir|alles gut bei dir)$/.test(text)) return 'wellbeing';
  if (/^(?:tschuss|tschus|auf wiedersehen|bis spater|bis bald|gute nacht)$/.test(text)) return 'goodbye';
  if (/^(?:noch einmal|nochmal|wiederhole das|wiederholen|was hast du gesagt|sag das nochmal)$/.test(text)) return 'repeat';
  if (/^(?:hilfe|was kannst du|was kannst du alles|was kann ich sagen|welche befehle gibt es)$/.test(text)) return 'help';
  return null;
}

export function neoProfileName(profile?: { displayName?: string | null; firstName?: string | null; lastName?: string | null } | null, user?: { displayName?: string | null } | null): string {
  const values = [profile?.displayName, [profile?.firstName, profile?.lastName].filter(Boolean).join(' '), user?.displayName];
  for (const raw of values) {
    const name = raw?.normalize('NFC').replace(/[\u0000-\u001f\u007f<>\[\]{}]/g, '').replace(/\s+/g, ' ').trim();
    if (name && name.length <= 64 && !name.includes('@') && /\p{L}/u.test(name) && !/https?:|www\./i.test(name)) return name;
  }
  return '';
}

function number(value: number): string {
  const small = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
  if (value < 20) return small[value];
  const tens = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig'];
  return (value % 10 ? (value % 10 === 1 ? 'ein' : small[value % 10]) + 'und' : '') + tens[Math.floor(value / 10)];
}
export function neoTime(now = new Date()): string {
  const hours = now.getHours(), minutes = now.getMinutes();
  return `Es ist ${hours === 1 ? 'ein' : number(hours)} Uhr${minutes ? ` ${number(minutes)}` : ''}.`;
}
export function neoDate(now = new Date()): string {
  return `Heute ist ${new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(now)}, der ${new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(now)}.`;
}

export function createNeoReplies(random = Math.random) {
  let previous = '';
  return (command: Exclude<NeoCommand, 'weather' | 'repeat'>, name: string, now = new Date()): string => {
    const choices: Record<Exclude<NeoCommand, 'weather' | 'repeat'>, readonly string[]> = {
      greeting: [`Hallo${name ? ` ${name}` : ''}. Schön, dass du da bist.`, `Hey${name ? ` ${name}` : ''}. Was kann ich für dich tun?`],
      identity: [NEO_INTRODUCTION], time: [neoTime(now)], date: [neoDate(now)],
      weatherUnsupported: ['Ich kann dir das aktuelle Wetter an deinem Standort sagen. Vorhersagen und andere Orte unterstütze ich noch nicht.'],
      thanks: ['Gerne.', 'Na klar.', 'Immer gern.'],
      wellbeing: ['Bereit, dir zu helfen. Was möchtest du erledigen?', 'Alles startklar. Was steht an?'],
      goodbye: ['Bis später.', 'Mach es gut. Ich bin hier, wenn du mich brauchst.'],
      help: ['Ich öffne Seiten und Klientenakten. Frag mich auch nach Uhrzeit, Datum oder dem Wetter. Mit: Wer bist du, stelle ich mich vor. Zum Stoppen klickst du mich nochmal an.'],
    };
    const options = choices[command].filter(text => text !== previous);
    const available = options.length ? options : choices[command];
    const text = available[Math.min(available.length - 1, Math.floor(random() * available.length))];
    previous = text; return text;
  };
}
