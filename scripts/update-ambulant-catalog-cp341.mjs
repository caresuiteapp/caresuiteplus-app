import { readFileSync, writeFileSync } from 'node:fs';

const path = 'docs/audit/ambulant-az-katalog-2026-10-08.json';
const catalog = JSON.parse(readFileSync(path, 'utf8'));
const taskIds = new Set(Array.from({ length: 8 }, (_, index) => `D-${String(index + 1).padStart(2, '0')}`));
const packetIds = new Set(['D-P01', 'D-P02', 'D-P03']);
const sharedEvidence = 'CP341: Ein eigener privater Web/Desktop-Pflegeplanpfad bindet 18 getrennte Vorgangsarten an aktuelle Assessment-, Einschätzungs-, Ziel-, Maßnahmen-, Personal-, Termin-, Durchführungs-, Abweichungs-, Wirkungs-, Evaluations-, Visiten-, Prüf- und Verlaufsoriginale. Ziel, konkrete Maßnahme, Tagesstruktur, Unterstützungsgrenze, Verantwortung, Termin, Prüfanfrage, Rückgabe, Freigabeentscheidung, tatsächliche Durchführung, Nichtdurchführung, Abweichungsprüfung, Wirkungsbeobachtung, regelmäßige Evaluation, Visitenfeststellung, Visitenbeschluss, Änderungsauftrag und append-only Berichtigung bleiben getrennt. Die Oberfläche filtert generische Ereignisquellen zusätzlich nach der zulässigen fachlichen Vorgangsart; eine Zielplanung ist keine Planfreigabe, eine Planfreigabe keine Durchführung, eine Durchführung keine Wirkung und ein Visitenbeschluss keine Umsetzung oder Abnahme. Assessmentgebundener Entwurf, vollständiger Reload, aktueller Konto-/Mandanten-/Pflegefall-/Rechtewechsel, Browser-Lock, CAS, dauerhaft vor RPC gesicherte Anfrage, bestätigter SQL-Abbruch, unbekannter Transportausgang und ausschließlich lesende Quittungswiederaufnahme sind verbunden. 33/33 neue, 216/216 verbundene und 11990/11990 vollständige lokale Node-Fälle bestanden; acht aktuelle TS-/TSX-Dateien wurden mit dem vorhandenen Babel-Parser gelesen. SQL ist nur vorbereitet. Echte SDK-/PostgreSQL-/PostgREST-/RLS-/Grant-/Trigger-/Zwei-Sitzungs-/Parallelitäts-/Rollback-/Altwriter-/Native-/Browserprüfung sowie qualifizierte Funktions-, Pflege-, Design-, Datenschutz-, Rechts- und Betriebsabnahmen fehlen.';
const nextById = {
  'D-01': 'Individuelle Ziele mit tatsächlicher Ausgangslage, beobachtbaren Kriterien, gemeinsam vereinbarter Priorität, Prüftermin und unveränderlicher Historie in echter SDK-/SQL-/RLS-Laufzeit prüfen; Zielqualität pflegefachlich und rechtlich abnehmen.',
  'D-02': 'Maßnahmen mit Was, Wie, Zeitpunkt, Häufigkeit, Hilfsmitteln, Verantwortungs- und Qualifikationsgrenze gegen aktuelle Originale über zwei Sitzungen ausführen; Planung und tatsächliche Ausführung getrennt belegen.',
  'D-03': 'Tagesstruktur, Gewohnheiten, Präferenzen, Abhängigkeiten, Konflikte und Nachholregeln breit/schmal sowie mit Tastatur und Screenreader real prüfen; keine Durchführung aus der Terminplanung ableiten.',
  'D-04': 'Eigenleistung, Anleitung, Teilhilfe und Übernahme gegen Ressourcenoriginal, Maßnahme, tatsächliche Durchführung und Wirkung in einer zulässigen Testumgebung prüfen; fachliche Unterstützungsgrenzen qualifiziert abnehmen.',
  'D-05': 'Planprüfung, Rückgabe und Freigabe mit vollständigem Prüfpaket, zwei getrennten Konten, aktuellen Feld-/Datensatzrechten, Rechteentzug, Parallelität, Rollback und Native-/Altwriterkompatibilität ausführen.',
  'D-06': 'Anlassbezogene Änderung mit aktuellem freigegebenem Plan, konkretem Änderungsoriginal, zuständiger Rolle, Frist, neuer Planfassung und Nachhalten über echte Datenbank- und Browserwege prüfen.',
  'D-07': 'Regelmäßige Evaluation mit Ziel, tatsächlicher Durchführung, beobachteter Wirkung, Personenrückmeldung, Entscheidung und neuem Prüftermin real ausführen; Öffnen oder Planen darf keine Evaluation schließen.',
  'D-08': 'Pflegevisite mit aktuellem Plan, tatsächlicher Feststellung, Abweichung, getrenntem Beschluss, Umsetzungsauftrag und Nachhaltefrist real prüfen; Umsetzung und qualifizierte Abnahme eigenständig nachweisen.'
};

for (const task of catalog.tasks) {
  if (!taskIds.has(task.id)) continue;
  task.evidence = `${task.evidence} ${sharedEvidence}`;
  task.next = nextById[task.id];
  task.implementation = 'Teilweise umgesetzt';
  task.function = 'Teilprüfung';
  task.care = 'Offen';
  task.design = 'Offen';
  task.legal = 'Offen';
}

for (const packet of catalog.packets) {
  if (!packetIds.has(packet[0])) continue;
  packet[5] = 'Teilweise umgesetzt';
  packet[6] = `${packet[6]} CP341 verbindet D-01 bis D-08 erstmals als eigenen bedienbaren Pflegeplanpfad mit aktueller Originalauswahl, fachlicher Vorgangsartprüfung, Eingabe, Speichern, Reload, Rechtewechsel, Fehlertrennung, ausschließlich lesender Wiederaufnahme und Berichtigung. 33 neue, 216 verbundene und 11990 vollständige lokale Fälle bestanden; echte Datenbank-, SDK-, Native-, Browser- und Fachabnahmen bleiben offen.`;
  packet[7] = 'Den verbundenen D-Vertrag mit echten Originalen, zwei Sitzungen, Feld-/Datensatzrechten, Rechteentzug, Quellsperren, Parallelität, Rollback, Native-/Altwriterkompatibilität und breiter/schmaler Browserbedienung ausführen; Funktions-, Pflege-, Design-, Datenschutz-, Rechts- und Betriebsabnahmen getrennt qualifiziert nachweisen.';
}

catalog.version = 341;
catalog.date = '2026-10-16';
catalog.checkpointSummary = 'CP341: D-01 bis D-08 bilden einen eigenen verbundenen privaten Web/Desktop-Pflegeplan-, Durchführungs-, Abweichungs-, Wirkungs-, Evaluations- und Visitenweg mit aktuellen nativen Originalen, fachlicher Ereignisartprüfung, ausdrücklicher Auswahl, assessmentgebundenem Entwurf, Reload, Rechtewechsel, CAS, dauerhaft gesicherter Anfrage, Fehlertrennung, ausschließlich lesender Quittungswiederaufnahme und append-only Berichtigung. Assessment, Planung, tatsächliche Durchführung, Wirkung, Freigabe, Umsetzung und Abnahme bleiben getrennt. 33/33 neue, 216/216 verbundene und 11990/11990 vollständige lokale Node-Fälle bestanden. SQL nicht ausgeführt; echte SDK-/PostgreSQL-/RLS-/Native-/Browser- und qualifizierte Funktions-/Pflege-/Design-/Datenschutz-/Rechts-/Betriebsabnahmen fehlen. 262 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50%-Ziel offen.';
catalog.checkpointNodeLog = 'docs/audit/checks/ambulant-node-checkpoint341-2026-10-16-care-plan.log';
writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
