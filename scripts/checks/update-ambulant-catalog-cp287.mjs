import fs from 'node:fs';

const path = 'docs/audit/ambulant-az-katalog-2026-10-08.json';
const catalog = JSON.parse(fs.readFileSync(path, 'utf8'));
if (catalog.version !== 286) throw Error(`Unerwartete Katalogversion ${catalog.version}`);
const task = catalog.tasks.find((entry) => entry.id === 'A-05');
const packet = catalog.packets.find((entry) => entry[0] === 'A-P02');
if (!task || !packet || task.implementation !== 'Bestand zu prüfen' || task.function !== 'Offen' ||
    [task.care, task.design, task.legal].some((status) => status !== 'Offen') || packet[5] !== 'Teilweise umgesetzt') {
  throw Error('Unerwarteter A-05- oder A-P02-Ausgangsstatus');
}

catalog.version = 287;
task.implementation = 'Teilweise umgesetzt';
task.function = 'Teilprüfung';
task.evidence = 'CP287: Eine neue fail-closed Web/Desktop-Evidenzprojektion bewahrt native Mandanten- und Konfigurationskennung, versioniertes Dienstmodell, native sortierte Leistungsarten mit konkreten Katalogfassungen, versioniertes Dokumentationsmodell, Konfigurationsfassung, Prüfsumme, Revision und Mikrosekundenzeit. Ein ungültiger Stand gilt nur bei mindestens einem eindeutig sortierten blockierenden Fehler eines konkret versionierten Regelwerks. Aktivierungsanfrage und Ablehnung müssen exakt dieselbe Konfiguration und denselben Validierungsbericht, handelndes Profil, eigene Berechtigung, Richtlinienfassung und Fehlercodes binden. Die verbindliche Vorher-/Nachher-Bindung muss einschließlich aktiver Konfiguration, Fassung, Revision und Prüfsumme unverändert sein; Aktivierungskennung, -fassung und Commitzeit bleiben null. Tatsächliche Aktivierung, Datenpersistenz sowie Funktions-/Pflege-/Design-/Rechtsabnahme werden nie abgeleitet. Acht neue Risikofälle und 10120/10120 vorhandene Node-Fälle bestanden; Android unverändert. Gesamt-Typecheck nicht ausführbar (tsc fehlt). Keine aktive Produkt-, Live-SDK-, SQL-/RLS- oder Browserintegration und keine reale Konfigurationsaktivierung bzw. qualifizierte Pflege-, Design-, Datenschutz- oder Rechtsabnahme.';
task.next = 'Die Evidenzprojektion in den aktiven Fachkonfigurationsablauf integrieren. Ungültige Kombinationen aus Dienstmodell, Leistungsarten und Dokumentationsmodell real über Live-SDK und SQL/RLS gegen verbindliche Aktivierung sperren; Paralleländerung, veraltetes Regelwerk, Rechteentzug, Wiederholung und Rollback prüfen. Unveränderte aktive Bindung und vollständige Originalhistorie nachweisen. Breite und schmale Browserbedienung, Tastatur/Screenreader sowie qualifizierte Pflege-, Design-, Datenschutz- und Rechtsprüfung bleiben offen. Nächster unabhängiger Katalogpunkt: A-06 Katalogversionen.';
packet[6] = 'CP196/CP287: Neues Webrecht nur bei aktivem eigenen Serverprofil. A-05 bindet Dienstmodell, Leistungsarten, Dokumentationsmodell und Version an blockierende Validierung sowie eine fail-closed Ablehnung ohne Änderung der aktiven Bindung. Acht neue Fälle, 10120/10120 gesamt. A-06, aktive Integration, Live-SDK, SQL/RLS, Browser und alle vier Abnahmen offen.';
catalog.checkpointSummary = 'CP287: A-05 bewahrt die vollständige versionierte Fachkonfiguration und verlangt bei ungültigem Stand eine exakt gebundene Ablehnung sowie unveränderte Vorher-/Nachher-Bindung. Aktivierung, Persistenz und Abnahmen werden nicht abgeleitet. Android unverändert. Acht neue Fälle, 10120/10120 gesamt; 192 begonnen, weiterhin nur eine vollständig abgenommen, 50%-Ziel offen.';
fs.writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
