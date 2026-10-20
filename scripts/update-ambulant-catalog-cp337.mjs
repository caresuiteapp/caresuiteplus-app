import fs from 'node:fs/promises';

const file = new URL('../docs/audit/ambulant-az-katalog-2026-10-08.json', import.meta.url);
const catalog = JSON.parse(await fs.readFile(file, 'utf8'));
if (![336, 337].includes(catalog.version)) throw Error(`Ausgangskatalog ${catalog.version} statt 336/337`);

const ids = Array.from({ length: 8 }, (_, index) => `Z-${String(index + 1).padStart(2, '0')}`);
const packetIds = ['Z-P01', 'Z-P02', 'Z-P03'];
const evidence = 'CP337: Der private Web/Desktop-Assistenz- und Innovationsarbeitsplatz verbindet Z-01 bis Z-08 in sieben Bediengruppen und 18 streng getrennten Vorgangsarten. Er lädt die aktuell zugänglichen nativen QM-Entwurfs-, Dokument-, Fassungs-, Pflegeplan-, Aufgaben-, Tour-, Besuchs-, Kontakt-, Einwilligungs-, Kommunikations-, Release- und Betriebsauditoriginale vollständig und verlangt ihre ausdrückliche Auswahl. Entwurf, Reload, aktueller Konto-/Mandanten-/Token-/SDK-/Rechtewechsel, Browser-Lock, CAS-Verlaufskopf, dauerhaft vor dem RPC gesicherte Anfrage, bestätigter SQL-Abbruch, unklarer Transportausgang, ausschließlich lesende Quittungswiederaufnahme und append-only Berichtigung sind verbunden. Sprachaufnahme, Transkript, Quellenmenge, KI-Entwurf, Fachprüfung, Widerspruch, Klärung, Aufgabenbündel, Tourvorschlag, Verlaufsübersicht, Angehörigenvorschau, Nutzenanalyse und Freigabeentscheidung bleiben getrennt. Der Arbeitsplatz führt weder Pflegeleistung, Aufgabenabschluss, Tourplanung, Nachricht noch Freigabe aus. 41/41 neue Arbeitsplatz-/Oberflächenfälle, 105/105 verbundene Z-Fälle und 11846/11846 vollständige lokale Node-Fälle bestanden. Sechs reine TS-Dateien wurden syntaktisch geprüft; React-Strukturprüfung ohne erforderliche Änderung. Für TSX fehlen Parser/tsc und ein echter Browser; Typecheck Exit 127. SQL vorbereitet und nicht ausgeführt. Echte PostgreSQL-/PostgREST-/RLS-/Grant-/SDK-/Zwei-Sitzungs-/Parallelitäts-/Rollback-/Browser-/Layout- sowie Pflege-/Design-/Datenschutz-/Rechts-/Betriebsabnahmen bleiben offen.';
const next = 'Den vollständigen Z-Vertrag in einer vorhandenen zulässigen Testumgebung mit echten QM-Entwurfs-, Dokument-, Pflegeplan-, Aufgaben-, Tour-, Kontakt-, Einwilligungs-, Kommunikations-, Release- und Auditreferenzen, getrennten Konten, Feld-/Datensatzrechten, Rechteentzug, zwei Sitzungen, Quellsperren, Parallelität, Rollback/Deadlock, Native-/Altwriterkompatibilität und reiner Quittungswiederaufnahme ausführen. Web/Desktop breit und schmal, große Schrift, Tastatur und Screenreader prüfen; Pflege, Design, Datenschutz, Recht und Betrieb qualifiziert abnehmen. Ohne diese Umgebung als nächsten großen unabhängigen Block A-01 bis A-08 gemeinsam als Mandanten-, Organisations-, Standort-, Rollen-, Produkt-, Vertragspartner- und Stammdatenlebenszyklus vertiefen.';

for (const id of ids) {
  const task = catalog.tasks.find(entry => entry.id === id);
  if (!task) throw Error(`${id} fehlt`);
  if (!['Teilweise umgesetzt', 'Bestand zu prüfen'].includes(task.implementation) || !['Teilprüfung', 'Offen'].includes(task.function) || [task.care, task.design, task.legal].some(value => value !== 'Offen')) throw Error(`${id} besitzt unerwarteten Status`);
  task.implementation = 'Teilweise umgesetzt';
  task.function = 'Teilprüfung';
  task.evidence = `${task.evidence.split('\n\nCP337:')[0]}\n\n${evidence}`;
  task.next = next;
}

for (const id of packetIds) {
  const packet = catalog.packets.find(entry => entry[0] === id);
  if (!packet) throw Error(`${id} fehlt`);
  if (packet[5] !== 'Teilweise umgesetzt') throw Error(`${id} besitzt unerwarteten Status`);
  packet[6] = `${String(packet[6]).split('\n\nCP337:')[0]}\n\nCP337: Alle zugeordneten Z-Aufgaben sind im gemeinsamen Assistenz- und Innovationsarbeitsplatz verbunden. 41/41 neue, 105/105 verbundene und 11846/11846 vollständige lokale Node-Fälle bestanden. SQL bleibt vorbereitet; echte Laufzeit-, Browser- und qualifizierte Abnahmen bleiben offen.`;
  packet[7] = 'Den vollständigen verbundenen Z-Vertrag in der vorhandenen zulässigen Testumgebung mit echten Originalen, aktuellen Feld-/Datensatzrechten, getrennten Konten, zwei Sitzungen, Parallelität, Rollback und reiner Wiederaufnahme ausführen; echte Browser- und qualifizierte Abnahmen bleiben offen.';
}

catalog.version = 337;
catalog.date = '2026-10-16';
catalog.checkpointSummary = 'CP337: Z-01 bis Z-08 bilden einen verbundenen privaten Web/Desktop-Assistenz- und Innovationsweg mit aktuellen nativen Originalen, ausdrücklicher Auswahl, Entwurf, Reload, Rechtewechsel, CAS, dauerhaft gesicherter Anfrage, Fehlertrennung, ausschließlich lesender Quittungswiederaufnahme und append-only Berichtigung. Vorschlag, Prüfung, Dokumentation, Kommunikation, Planung, Durchführung, Nutzenanalyse, Freigabe und Abnahme bleiben voneinander getrennt. 41/41 neue, 105/105 verbundene und 11846/11846 vollständige lokale Node-Fälle bestanden. SQL nicht ausgeführt; echte SDK-/PostgreSQL-/RLS-/Browser- und qualifizierte Pflege-/Design-/Datenschutz-/Rechts-/Betriebsabnahmen fehlen. 262 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50%-Ziel offen.';
catalog.checkpointNodeLog = 'docs/audit/checks/ambulant-node-checkpoint337-2026-10-16-innovation.log';
await fs.writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify({ version: catalog.version, tasks: ids.length, packets: packetIds.length }));
