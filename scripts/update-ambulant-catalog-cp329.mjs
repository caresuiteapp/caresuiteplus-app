import fs from 'node:fs/promises';

const file = new URL('../docs/audit/ambulant-az-katalog-2026-10-08.json', import.meta.url);
const catalog = JSON.parse(await fs.readFile(file, 'utf8'));
if (catalog.version !== 328) throw new Error(`Ausgangskatalog ${catalog.version} statt 328`);

const specifics = {
  'S-01': 'Öffnung bindet genau denselben Tourstopp, Pflegefall, die eine gültige Aufnahme, den einen aktiven Pflegeplan und dessen vollständige Aufgabenfassung; eine Namens- oder Statusanzeige ersetzt keinen Originalvergleich.',
  'S-02': 'Beginn, Pause, Fortsetzung und Ende bleiben geordnete tatsächliche Ereignisse; Planzeit und freiwilliger Standortkontext werden weder als Istzeit noch als Standortbestätigung umgedeutet.',
  'S-03': 'Jede gebundene Planaufgabe benötigt ein eigenes Ergebnis mit tatsächlicher Zeit, Fachdokumentation und Abweichung; Häkchen oder Plantext erzeugen keine Durchführung.',
  'S-04': 'Mehrere Kontaktversuche, Risikooriginal, Entscheidung, Bericht und Folgeauftrag bleiben gemeinsam gebunden; Nichtbesuch erzeugt weder positive Leistung noch Versorgungsaussage.',
  'S-05': 'Mehrere Leistungen bleiben getrennte Positionen mit eigener Aufgaben-, Leistungs-, Tarif-, Rechtsgrundlagen-, Einheits-, Mengen- und tatsächlicher Zeitbindung.',
  'S-06': 'Bestätigung bindet die exakten Leistungsereignisse, Rolle, Person, Zeitpunkt, Inhalts-Hash und Erklärung; eine spätere Berichtigung erbt diese Bestätigung nicht.',
  'S-07': 'Berichtigung ist ein neues append-only Ereignis gegen genau ein noch aktives Original; Öffnung und Abschluss verlangen eine getrennte Nachfolgefassung.',
  'S-08': 'Abschluss verlangt das tatsächliche Ende, Ergebnisse aller Öffnungsaufgaben und für jede positive Leistungsposition eine eigene Inhaltsbestätigung; offene Notfälle sperren.',
  'S-09': 'Notfallphasen halten Tatsachen, Sofortmaßnahmen, Kontakt, Übergabe, Zuständigkeit, Folgeauftrag und Abschluss auseinander; der Arbeitsweg löst selbst keinen Notruf aus.',
  'S-10': 'Die exakte Anfrage ist vor dem RPC dauerhaft gesichert; unbekannter Transportausgang bleibt gesperrt und wird nur durch eine passende native Quittung lesend geklärt, nie durch Ersatzwrite.',
};
const proof = 'CP329: S-01 bis S-10 sind als gemeinsamer Web/Desktop-Einsatzarbeitsplatz verbunden. Der Arbeitsplatz lädt vollständige aktuelle Tourstopp-, Tour-, Aufnahme-, Pflegeplan-, Aufgaben-, Leistungs-, Tarif-, Kontakt-, Risiko-, Übergabe-, Identitäts- und Dokumentoriginale sowie aktive Personen. Er verbindet Originalauswahl, Eingabe, lokalen Entwurf, Reload, aktuelle Basis-/Schreibrechte, CAS-Kopf, dauerhaft vor RPC gesicherte exakte Anfrage, bekannten Abbruch, unbekannten Transportausgang mit rein lesender Quittungswiederaufnahme, append-only Berichtigung, Notfallverlauf und Abschluss. 26/26 neue, 157/157 verbundene und 11461/11461 vollständige lokale Node-Fälle bestanden; letzter vollständiger Lauf ohne Fehler, Abbruch, Skip oder Todo. Acht TS-/TSX-Dateien bestanden den vorhandenen Babel-Parser; dies ist kein semantischer Typecheck. SQL vorbereitet, nicht ausgeführt. Native/Android-Einstiege unverändert. Keine Browser-/Layout-, Pflege-, Design-, Datenschutz-, Rechts- oder Betriebsabnahme.';
const next = 'Gesamtweg in einer vorhandenen zulässigen PostgreSQL/PostgREST-/SDK-Testumgebung mit echten Mandanten-, Profil-, Tour-, Stop-, Aufnahme-, Plan-, Aufgaben-, Leistungs-, Tarif-, Kontakt-, Risiko-, Identitäts-, Dokument- und Personenoriginalen ausführen. Aktuelle Feld-/Sensitiv-/Datensatzrechte, RLS/Grants/Trigger, zwei Sitzungen, Parallelität, Rollback, Altwriter-/Native-Kompatibilität und reine Quittungswiederaufnahme prüfen. Breite/schmale Browserdarstellung, Tastatur und Screenreader sowie Pflege, Notfallorganisation, Datenschutz und Recht separat abnehmen.';

for (const task of catalog.tasks.filter(task => /^S-(?:0[1-9]|10)$/.test(task.id))) {
  task.implementation = 'Teilweise umgesetzt';
  task.function = 'Teilprüfung';
  task.evidence = `${proof} ${specifics[task.id]}`;
  task.next = next;
  if ([task.care, task.design, task.legal].join('|') !== 'Offen|Offen|Offen') {
    throw new Error(`${task.id}: qualifizierte Status dürfen nicht verändert sein`);
  }
}

for (const packet of catalog.packets.filter(packet => /^S-P0[1-4]$/.test(packet[0]))) {
  packet[5] = 'Teilweise umgesetzt';
  packet[6] = proof;
}

catalog.version = 329;
catalog.date = '2026-10-16';
catalog.checkpointNodeLog = 'docs/audit/checks/ambulant-node-checkpoint329-2026-10-16-visit-execution.log';
catalog.checkpointSummary = 'CP329: S-01 bis S-10 sind als zusammenhängender Web/Desktop-Einsatz-, Aufgaben-, Nichtbesuchs-, Mehrfachleistungs-, Inhaltsbestätigungs-, Berichtigungs-, Abschluss-, Notfall- und Quittungswiederaufnahmeweg mit vollständigen aktuellen Originalen, Eingabe, Entwurf, Reload, Rechtewechsel, CAS und append-only Historie verbunden. Planung, tatsächliche Zeit, Aufgabe, Leistung, Bestätigung, Notfall, Berichtigung und Abschluss bleiben getrennt. 26/26 neue, 157/157 verbundene und 11461/11461 vollständige lokale Node-Fälle bestanden. Acht TS-/TSX-Dateien bestanden eine vorhandene Babel-Syntaxtransformation; Gesamt-Typecheck endet mangels tsc mit Exit127. SQL nicht ausgeführt; echte SDK-/PostgreSQL-/RLS-/Browser- und Pflege-/Design-/Datenschutz-/Rechtsabnahmen fehlen. 260 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50%-Ziel offen.';

await fs.writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify({ checkpoint: 329, tasks: 10, packets: 4, fullTests: 11461 }));
