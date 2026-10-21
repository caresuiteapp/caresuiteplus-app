import fs from 'node:fs/promises';

const file = new URL('../docs/audit/ambulant-az-katalog-2026-10-08.json', import.meta.url);
const catalog = JSON.parse(await fs.readFile(file, 'utf8'));
if (![335, 336].includes(catalog.version)) throw Error(`Ausgangskatalog ${catalog.version} statt 335/336`);

const ids = Array.from({ length: 12 }, (_, index) => `Y-${String(index + 1).padStart(2, '0')}`);
const packetIds = ['Y-P01', 'Y-P02', 'Y-P03', 'Y-P04'];
const evidence = 'CP336: Der private Web/Desktop-Technik- und Betriebsarbeitsplatz verbindet Y-01 bis Y-12 in neun Bediengruppen und 24 streng getrennten Vorgangsarten. Er lädt die aktuell zugänglichen nativen Systemzustands-, Fehler-, Incident-, Sicherungs-, Restore-, Wartungs-, Release- und Betriebsauditoriginale vollständig und verlangt ihre ausdrückliche Auswahl. Entwurf, Reload, aktueller Konto-/Mandanten-/Token-/SDK-/Rechtewechsel, Browser-Lock, CAS-Verlaufskopf, dauerhaft vor dem RPC gesicherte Anfrage, bestätigter SQL-Abbruch, unklarer Transportausgang, ausschließlich lesende Quittungswiederaufnahme und append-only Berichtigung sind verbunden. Entwurf, lokale Persistenz, Serverannahme, Konflikt, Outbox, Sync, Löschanforderung, Import, Mapping, Migration, Rollback, Sicherung, Rücksicherung, Browser-/Barrierefreiheitsbeleg, Listen-/Leistungsmessung, Kandidat, Abnahmegate, Release, Absturz, Wiederaufnahme und Android-Vertragsprüfung bleiben getrennt. 46/46 neue Arbeitsplatz-/Oberflächenfälle, 94/94 verbundene Y-Fälle und 11805/11805 vollständige lokale Node-Fälle bestanden. Sechs reine TS-Dateien wurden syntaktisch geprüft; React-Strukturprüfung ohne erforderliche Änderung. Für TSX fehlen Parser/tsc und ein echter Browser; Typecheck Exit 127. SQL vorbereitet und nicht ausgeführt. Echte PostgreSQL-/PostgREST-/RLS-/Grant-/SDK-/Zwei-Sitzungs-/Parallelitäts-/Rollback-/Browser-/Layout- sowie Pflege-/Design-/Datenschutz-/Rechts-/Betriebsabnahmen bleiben offen.';
const next = 'Den vollständigen Y-Vertrag in einer vorhandenen zulässigen Testumgebung mit echten Systemzustands-, Fehler-, Incident-, Sicherungs-, Restore-, Wartungs-, Release- und Betriebsauditoriginalen, getrennten Konten, Feld-/Datensatzrechten, Rechteentzug, zwei Sitzungen, Quellsperren, Parallelität, Rollback/Deadlock, Native-/Altwriterkompatibilität und reiner Quittungswiederaufnahme ausführen. Web/Desktop breit und schmal, große Schrift, Tastatur und Screenreader prüfen; Pflege, Design, Datenschutz, Recht und Betrieb qualifiziert abnehmen. Ohne diese Umgebung als nächsten großen unabhängigen Block Z-01 bis Z-12 gemeinsam vertiefen.';

for (const id of ids) {
  const task = catalog.tasks.find(entry => entry.id === id);
  if (!task) throw Error(`${id} fehlt`);
  if (!['Teilweise umgesetzt', 'Bestand zu prüfen'].includes(task.implementation) || !['Teilprüfung', 'Offen'].includes(task.function) || [task.care, task.design, task.legal].some(value => value !== 'Offen')) throw Error(`${id} besitzt unerwarteten Status`);
  task.implementation = 'Teilweise umgesetzt';
  task.function = 'Teilprüfung';
  task.evidence = `${task.evidence.split('\n\nCP336:')[0]}\n\n${evidence}`;
  task.next = next;
}

for (const id of packetIds) {
  const packet = catalog.packets.find(entry => entry[0] === id);
  if (!packet) throw Error(`${id} fehlt`);
  if (packet[5] !== 'Teilweise umgesetzt') throw Error(`${id} besitzt unerwarteten Status`);
  packet[6] = `${String(packet[6]).split('\n\nCP336:')[0]}\n\nCP336: Alle zugeordneten Y-Aufgaben sind im gemeinsamen Technik- und Betriebsarbeitsplatz verbunden. 46/46 neue, 94/94 verbundene und 11805/11805 vollständige lokale Node-Fälle bestanden. SQL bleibt vorbereitet; echte Laufzeit-, Browser- und qualifizierte Abnahmen bleiben offen.`;
  packet[7] = 'Den vollständigen verbundenen Y-Vertrag in der vorhandenen zulässigen Testumgebung mit echten Originalen, aktuellen Feld-/Datensatzrechten, getrennten Konten, zwei Sitzungen, Parallelität, Rollback und reiner Wiederaufnahme ausführen; echte Browser- und qualifizierte Abnahmen bleiben offen.';
}

catalog.version = 336;
catalog.date = '2026-10-16';
catalog.checkpointSummary = 'CP336: Y-01 bis Y-12 bilden einen verbundenen privaten Web/Desktop-Technik- und Betriebsweg mit aktuellen nativen Originalen, ausdrücklicher Auswahl, Entwurf, Reload, Rechtewechsel, CAS, dauerhaft gesicherter Anfrage, Fehlertrennung, ausschließlich lesender Quittungswiederaufnahme und append-only Berichtigung. Planung, Persistenz, Serverannahme, Synchronisierung, Import, Migration, Rollback, Sicherung, Rücksicherung, Messung, Abnahme, Release, Absturz, Wiederaufnahme und Android-Vertragsprüfung bleiben voneinander getrennt. 46/46 neue, 94/94 verbundene und 11805/11805 vollständige lokale Node-Fälle bestanden. SQL nicht ausgeführt; echte SDK-/PostgreSQL-/RLS-/Browser- und qualifizierte Pflege-/Design-/Datenschutz-/Rechts-/Betriebsabnahmen fehlen. 262 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50%-Ziel offen.';
catalog.checkpointNodeLog = 'docs/audit/checks/ambulant-node-checkpoint336-2026-10-16-technical.log';
await fs.writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify({ version: catalog.version, tasks: ids.length, packets: packetIds.length }));
