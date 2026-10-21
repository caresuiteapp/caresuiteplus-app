import fs from 'node:fs';

const path = 'docs/audit/ambulant-az-katalog-2026-10-08.json';
const catalog = JSON.parse(fs.readFileSync(path, 'utf8'));
if (catalog.version !== 284) throw Error(`Unerwartete Katalogversion ${catalog.version}`);
const task = catalog.tasks.find((entry) => entry.id === 'A-01');
const packet = catalog.packets.find((entry) => entry[0] === 'A-P01');
if (!task || !packet || task.implementation !== 'Bestand zu prüfen' || task.function !== 'Offen' || [task.care, task.design, task.legal].some((status) => status !== 'Offen') || packet[5] !== 'Teilweise umgesetzt') {
  throw Error('Unerwarteter A-01- oder A-P01-Ausgangsstatus');
}
catalog.version = 285;
task.implementation = 'Teilweise umgesetzt';
task.function = 'Teilprüfung';
task.evidence = 'CP285: Eine neue fail-closed Web/Desktop-Evidenzprojektion prüft genau zwei getrennte native Mandanten- und Dienstkennungen. Jeder Dienstbeleg bewahrt Anlagevorgang, Dienst, Niederlassung, neunstellige IK, mindestens eine exakt gebundene Adresse mit genau einer Primäradresse, verantwortliches Profil und Rolle, Anfrage-/Quittungssummen, positive Revision sowie Mikrosekundenzeiten. Isolation gilt nur bei zwei gerichteten, exakt an Quell- und Zieldienst gebundenen Verweigerungsbelegen mit versionierter Richtlinie, eigenem Entscheidungsbeleg und null zurückgegebenen Zeilen. Eigentliche Anlage, Datenpersistenz sowie Funktions-/Pflege-/Design-/Rechtsabnahme werden nie abgeleitet. Acht neue Risikofälle und 10104/10104 vorhandene Node-Fälle bestanden; Android unverändert. Gesamt-Typecheck nicht ausführbar (tsc fehlt). Keine aktive Produkt-, Live-SDK-, SQL-/RLS- oder Browserintegration und keine reale Mandantenanlage bzw. qualifizierte Pflege-, Design-, Datenschutz- oder Rechtsabnahme.';
task.next = 'Die Evidenzprojektion in den aktiven Mandanten-Einrichtungsablauf integrieren. Zwei reale Dienste mit vollständigen Stammdaten in getrennten Mandanten anlegen und Lese-, Schreib-, Export- und Administrationszugriffe beidseitig über Live-SDK und SQL/RLS verweigern; Protokollfrische, Rechteentzug, Parallelität, Rollback und Originalhistorie prüfen. Breite und schmale Browserbedienung, Tastatur/Screenreader sowie qualifizierte Pflege-, Design-, Datenschutz- und Rechtsprüfung bleiben offen. Nächster unabhängiger Katalogpunkt: A-02 Standorte verwalten.';
packet[6] = 'CP196/CP285: A-03 besitzt Server-/Profilbestätigung für private Webrechte. A-01 ergänzt eine strikte lokale Dienstanlage-/Isolationsevidenz für zwei native Mandanten mit Dienst, Niederlassung, IK, Adressen, Verantwortlichen und beidseitigen Verweigerungsbelegen ohne Datenzeilen. Acht neue Fälle, 10104/10104 gesamt. Aktive Anlage, A-02, Live-SDK, SQL/RLS, Browser und alle vier Abnahmen offen.';
catalog.checkpointSummary = 'CP285: A-01 bewahrt vollständige Dienstanlagebelege für zwei native getrennte Mandanten und akzeptiert Isolation nur bei beidseitig gebundenen Verweigerungsbelegen ohne zurückgegebene Daten. Anlage, Persistenz und Abnahmen werden nicht abgeleitet. Android unverändert. Acht neue Fälle, 10104/10104 gesamt; 190 begonnen, weiterhin nur eine vollständig abgenommen, 50%-Ziel offen.';
fs.writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
