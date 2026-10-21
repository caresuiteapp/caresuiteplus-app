import fs from 'node:fs';

const file = process.argv[2] ?? 'docs/audit/ambulant-az-katalog-2026-10-08.json';
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
if (catalog.version !== 356 || catalog.tasks.length !== 262 || catalog.packets.length !== 97) throw Error('CP356-Katalogbasis fehlt.');

const evidence = 'CP357 ergänzt den verbundenen Web/Desktop-Einsatzweg um eine getrennte append-only Fachprüfung ausschließlich für einen vollständig abgeschlossenen, unveränderten Einsatzkopf. Anfrage, begründete Rückgabe und qualifizierte Annahme binden Kopf-ID, SHA-256 sowie den vollständigen aktuellen Tourstopp-, Quellen-, Personen- und Ereignisbestand. Öffnende, dokumentierende, ausführende, bestätigende, im Notfall handelnde, abschließende oder anfragende Personen entscheiden dieselbe Fassung nicht selbst. Aktuelle Rechte, Beschäftigung, Qualifikation, Dokument und der separat freigegebene Prüfbereich visit_execution_review sind erforderlich; eine spätere oder getrennte Nachfolgefassung erbt keine Annahme. Festes Journal, Browser-Lock, CAS, bestätigter SQL-Abbruch, unbekannter Transportausgang und ausschließlich lesende Quittungswiederaufnahme bleiben getrennt. 18/18 neue, 44/44 gemeinsam verbundene und 12385/12385 vollständige lokale Node-Fälle bestanden. Drei reine TS-Dateien bestanden die Syntaxprüfung; TSX-/React-Laufzeit/tsc fehlen. SQL nur vorbereitet. Echte PostgreSQL-/PostgREST-/RLS-/Grant-/Trigger-/Quellsperr-/Zwei-Sitzungs-/Parallelitäts-/Rollback-/SDK-/Altwriter-/Native-/Browser- und qualifizierte Funktions-, Pflege-, Einsatzfach-, Design-, Datenschutz-, Rechts- und Betriebsabnahmen fehlen.';
const next = 'Den vollständigen Einsatz- und Fachprüfvertrag in einer vorhandenen zulässigen PostgreSQL/PostgREST-/SDK-Testumgebung mit echten Mandanten-, Profil-, Tour-, Stop-, Aufnahme-, Plan-, Aufgaben-, Leistungs-, Tarif-, Kontakt-, Risiko-, Identitäts-, Dokument-, Beschäftigungs-, Qualifikations- und Prüfbereichsoriginalen ausführen. Aktuelle Feld-/Sensitiv-/Datensatzrechte, RLS/Grants/Trigger, zwei Sitzungen, Parallelität, Rollback, Altwriter-/Native-Kompatibilität, feste Quittungswiederaufnahme und die Bindung nur an vollständig abgeschlossene Einsätze prüfen. Breite/schmale Browserdarstellung, Tastatur und Screenreader sowie Funktion, Pflege, Einsatzfachlichkeit, Design, Datenschutz, Recht und Betrieb separat abnehmen.';
const taskIds = Array.from({length: 10}, (_, index) => `S-${String(index + 1).padStart(2, '0')}`);
const packetIds = Array.from({length: 4}, (_, index) => `S-P${String(index + 1).padStart(2, '0')}`);
for (const id of taskIds) {
  const task = catalog.tasks.find(item => item.id === id);
  if (!task || task.implementation !== 'Teilweise umgesetzt' || task.function !== 'Teilprüfung' || [task.care, task.design, task.legal].some(value => value !== 'Offen')) throw Error(`Unerwarteter Status ${id}.`);
  task.evidence = `${task.evidence} ${evidence}`;
  task.next = next;
}
for (const id of packetIds) {
  const packet = catalog.packets.find(item => item[0] === id);
  if (!packet || packet[5] !== 'Teilweise umgesetzt') throw Error(`Unerwarteter Paketstatus ${id}.`);
  packet[6] = `${packet[6]} ${evidence}`;
}
catalog.version = 357;
catalog.checkpointNodeLog = 'docs/audit/checks/ambulant-node-checkpoint357-2026-10-17.log';
catalog.checkpointSummary = 'CP357: S-01 bis S-10 mit eigenem, ausschließlich an einen vollständig abgeschlossenen unveränderten Einsatzkopf und SHA gebundenem Fachprüfverlauf, vollständiger Tourstopp-/Quellen-/Personen-/Ereignisbindung, aktueller Beschäftigungs-/Qualifikations-/Dokument-/Prüfbereichsprüfung, Vier-Augen-Trennung und robuster Quittungswiederaufnahme vertieft. 18 fokussierte, 44 gemeinsam verbundene und 12385 vollständige lokale Node-Fälle bestanden. SQL nicht ausgeführt; TSX/React/tsc, echte Datenbank-/SDK-/Browser- und qualifizierte Abnahmen fehlen. 262 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50 Prozent je Bereich nicht erreicht.';
fs.writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify({version: catalog.version, tasks: taskIds.length, packets: packetIds.length, changedCells: 24}));
