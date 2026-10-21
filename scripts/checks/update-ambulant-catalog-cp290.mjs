import fs from 'node:fs';

const path = 'docs/audit/ambulant-az-katalog-2026-10-08.json';
const catalog = JSON.parse(fs.readFileSync(path, 'utf8'));
if (catalog.version !== 289) throw Error(`Unerwartete Katalogversion ${catalog.version}`);
const task = catalog.tasks.find((entry) => entry.id === 'A-08');
const packet = catalog.packets.find((entry) => entry[0] === 'A-P03');
if (!task || !packet || task.implementation !== 'Bestand zu prüfen' || task.function !== 'Offen' ||
    [task.care, task.design, task.legal].some((status) => status !== 'Offen') || packet[5] !== 'Teilweise umgesetzt') {
  throw Error('Unerwarteter A-08- oder A-P03-Ausgangsstatus');
}
catalog.version = 290;
task.implementation = 'Teilweise umgesetzt';
task.function = 'Teilprüfung';
task.evidence = 'CP290: Eine neue fail-closed Web/Desktop-Evidenzprojektion bindet den aktiven Mandanten-, Standort-, Konto-, Profil-, Rollen- und Generationskontext an einen summierten Quellsnapshot tatsächlich offener Aufgaben. Jeder Eintrag bildet native Aufgabenkennung, offenen Status samt Revision, Zuständigkeit, getrennten Plantermin und Aufgabenfrist sowie optionale offene kritische Rückmeldung exakt ab. Die Übersicht muss alle dem Profil zugeordneten Quellaufgaben vollständig und ohne Erfindung enthalten. Für jeden Eintrag bestätigt ein eigener Navigationsbeleg Zielaufgabe, Leserecht und dieselbe offene Statusrevision. Kritische Rückmeldungen sind beidseitig an Aufgabe und verantwortliches Profil gebunden; Mikrosekundenfolge und unveränderte Originalwerte werden geprüft. Statusänderung, Ausführung, Persistenz sowie Funktions-/Pflege-/Design-/Rechtsabnahme werden nie abgeleitet. Acht neue Risikofälle und 10144/10144 vorhandene Node-Fälle bestanden; Android unverändert. Gesamt-Typecheck nicht ausführbar (tsc fehlt). Keine aktive Produkt-, Live-SDK-, SQL-/RLS- oder Browserintegration und keine reale qualifizierte Pflege-, Design-, Datenschutz- oder Rechtsabnahme.';
task.next = 'Die Evidenzprojektion in die aktive Web/Desktop-Arbeitsübersicht integrieren. Tatsächliche offene Aufgaben, Fristen, kritische Rückmeldungen und Zuständigkeiten über Live-SDK und SQL/RLS unter Mandanten-, Standort-, Pflegefall- und Feldrechten laden; Navigation, Aktualisierung bei Statuswechsel, Rechteentzug, parallele Änderung, Offlinezustand und leere/umfangreiche Listen prüfen. Plantermin, Aufgabenfrist, historische Vereinbarung und tatsächliche Ereignisse getrennt halten. Breite und schmale Browserbedienung, Tastatur/Screenreader sowie qualifizierte Pflege-, Design-, Datenschutz- und Rechtsprüfung bleiben offen. Nächster unabhängiger Katalogpunkt: A-10 Funktionsinventar abgleichen.';
packet[6] = 'CP126/CP289/CP290: A-07 entwertet alte Rechte/Aktenbelege und isoliert den Organisationswechsel. A-08 bindet nun jeden Übersichtseintrag vollständig an eine tatsächlich offene Quellaufgabe, exakten Status samt Revision, Zuständigkeit, getrennten Plantermin und Frist, optionale kritische Rückmeldung sowie einen taskgebundenen Navigationsbeleg. Acht neue Fälle, 10144/10144 gesamt. Aktive Integration, Live-SDK, SQL/RLS, Browser und alle vier Abnahmen offen; A-09 bleibt separat abgenommen.';
catalog.checkpointSummary = 'CP290: A-08 bindet jeden Eintrag der Arbeitsübersicht vollständig an eine tatsächlich offene Quellaufgabe mit exaktem Status, Revision, Zuständigkeit, getrenntem Plantermin und Aufgabenfrist, optionaler kritischer Rückmeldung und taskgebundener Navigation. Statusänderung, Ausführung, Persistenz und Abnahmen werden nicht abgeleitet. Android unverändert. Acht neue Fälle, 10144/10144 gesamt; 194 begonnen, weiterhin nur eine vollständig abgenommen, 50%-Ziel offen.';
fs.writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
