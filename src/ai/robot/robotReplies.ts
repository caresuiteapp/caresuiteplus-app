/** Fixed locally recorded replies. No names or transcripts are synthesized at runtime. */
export const ROBOT_REPLIES = {
  home: ['Klar, zur Startseite.', 'Geht klar.', 'Zurück zur Übersicht.'],
  clients: ['Klar, zu den Klienten.', 'Alles klar.', 'Ich hole dir die Übersicht.'],
  employees: ['Klar, zum Team.', 'Alles klar.', 'Zu den Mitarbeitenden.'],
  calendar: ['Klar, zum Kalender.', 'Alles klar.', 'Zum Kalender, geht klar.'],
  assignments: ['Klar, zu den Einsätzen.', 'Geht klar.', 'Ich hole dir die Einsatzübersicht.'],
  evidence: ['Klar, zu den Nachweisen.', 'Alles klar.', 'Zu den Leistungsnachweisen.'],
  invoices: ['Klar, zu den Rechnungen.', 'Geht klar.', 'Ich hole dir die Rechnungsübersicht.'],
  documents: ['Klar, zu den Dokumenten.', 'Alles klar.', 'Zur Dokumentenablage.'],
  messages: ['Klar, zu den Nachrichten.', 'Geht klar.', 'Zum Postfach.'],
  appointments: ['Klar, zu den Terminen.', 'Alles klar.', 'Ich hole dir die Terminübersicht.'],
  logbook: ['Klar, zum Fahrtenbuch.', 'Alles klar.', 'Zum Fahrtenbuch, geht klar.'],
  time: ['Klar, zur Zeiterfassung.', 'Geht klar.', 'Zu deinen Arbeitszeiten.'],
  settings: ['Klar, zu den Einstellungen.', 'Alles klar.', 'Zu den Einstellungen, geht klar.'],
  clientFound: ['Die Akte habe ich gefunden.', 'Hab sie. Ich gehe zur Akte.', 'Alles klar, zur Akte.'],
  waiting: ['Einen Moment.', 'Ich schaue kurz nach.'],
  ambiguous: ['Da passen mehrere Personen. Sag bitte noch den vollständigen Namen.'],
  duplicate: ['Auch mit dem Namen finde ich mehrere Akten. Bitte wähle die Person in der Klientenübersicht.'],
  notFound: ['Zu dem Namen finde ich keine Akte. Versuch es noch einmal mit Vor- und Nachnamen.'],
  denied: ['Dafür fehlt dir die Berechtigung.', 'Auf diese Seite hast du keinen Zugriff.'],
  unknown: ['Das habe ich nicht ganz verstanden. Wohin möchtest du?', 'Welche Seite meinst du?'],
  help: ['Sag einfach, wohin du möchtest. Zum Beispiel: Kalender öffnen. Oder: Akte von Anna Müller öffnen.'],
  cancel: ['Alles klar, lassen wir das.', 'Okay, abgebrochen.'],
  back: ['Klar, zurück.', 'Eine Seite zurück.'],
  noBack: ['Hier geht es nicht weiter zurück.'],
  error: ['Das klappt gerade leider nicht. Versuch es gleich noch einmal.', 'Das geht im Moment leider nicht.'],
  noSpeech: ['Ich habe dich nicht gehört. Versuch es noch einmal.', 'Da kam nichts an. Sag es bitte noch einmal.'],
  microphone: ['Das Mikrofon ist gesperrt. Bitte gib es im Browser frei.'],
  unsupported: ['Die Spracherkennung ist in diesem Browser gerade nicht verfügbar.'],
} as const;

export type ReplyKey = keyof typeof ROBOT_REPLIES;
export type RobotReply = { id: string; text: string };

/** One picker per signed-in assistant; avoids repeating the previous sentence. */
export function createReplyPicker(random = Math.random) {
  let previous = '';
  return (key: ReplyKey): RobotReply => {
    const variants: readonly string[] = ROBOT_REPLIES[key];
    const candidates = variants.map((text, index) => ({ id: `${key}:${index}`, text }))
      .filter((reply) => reply.text !== previous);
    const reply = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]
      ?? { id: `${key}:0`, text: variants[0] };
    previous = reply.text;
    return reply;
  };
}
