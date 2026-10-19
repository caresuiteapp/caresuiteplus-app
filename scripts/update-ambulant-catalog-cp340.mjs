import { readFileSync, writeFileSync } from 'node:fs';

const path = 'docs/audit/ambulant-az-katalog-2026-10-08.json';
const catalog = JSON.parse(readFileSync(path, 'utf8'));
const taskIds = new Set(Array.from({ length: 10 }, (_, index) => `C-${String(index + 1).padStart(2, '0')}`));
const packetIds = new Set(['C-P01', 'C-P02', 'C-P03', 'C-P04']);
const sharedEvidence = 'CP340: Ein gemeinsamer privater Web/Desktop-Assessmentpfad bindet 20 getrennte Vorgangsarten an aktuelle native Modell-, Assessment-, Themenfeld-, Risiko-, Instrument-, Maßnahmen-, Durchführungs-, Wirkungs-, Prüf- und Verlaufsoriginale. Beobachtung, Einschätzung, Risiko, Instrumentenwahl, Planung, tatsächliche Durchführung, Wirkung, Prüfanfrage, Rückgabe, Freigabeentscheidung, Wiederholungsanlass, Wiederholungsbeginn und append-only Berichtigung bleiben getrennt. Assessmentgebundener Entwurf, vollständiger Reload, aktueller Konto-/Mandanten-/Pflegefall-/Rechtewechsel, Browser-Lock, CAS, dauerhaft vor RPC gesicherte Anfrage, bestätigter SQL-Abbruch, unbekannter Transportausgang und ausschließlich lesende Quittungswiederaufnahme sind verbunden. 35/35 neue, 342/342 verbundene und 11957/11957 vollständige lokale Node-Fälle bestanden; acht aktuelle TS-/TSX-Dateien wurden mit dem vorhandenen Babel-Parser gelesen. SQL ist nur vorbereitet. Echte SDK-/PostgreSQL-/PostgREST-/RLS-/Grant-/Trigger-/Zwei-Sitzungs-/Parallelitäts-/Rollback-/Altwriter-/Native-/Browserprüfung sowie qualifizierte Funktions-, Pflege-, Design-, Datenschutz-, Rechts- und Betriebsabnahmen fehlen.';
const nextById = {
  'C-01': 'Das konkrete CareSuite-Modell und eine ggf. beanspruchte EinSTEP-/SIS-Abbildung fachlich und rechtlich mit freigegebener Fassung, Nutzungsbedingungen und vollständiger Historie prüfen. Modellwechsel, Rechteentzug, Paralleländerung, Quittung und Korrektur über echte SDK-/SQL-/RLS-Wege ausführen.',
  'C-02': 'Personenperspektive mit tatsächlicher Quelle, Vertretung, Nichtbeantwortbarkeit, Berichtigung und Historie im echten Browser und Backend prüfen. Beobachtung, Aussage, Einschätzung, Maßnahme, Durchführung und Wirkung getrennt fachlich abnehmen.',
  'C-03': 'Kognition und Kommunikation mit vollständigen Originalen, konkreter fachlicher Begründung, Rechtewechsel, Feldrechten, Paralleländerung und Wiederaufnahme real ausführen; Pflege-, Design-, Datenschutz- und Rechtsabnahme getrennt dokumentieren.',
  'C-04': 'Mobilität und Bewegung mit aktuellen Originalen, Hilfsmittelbezug, Risikovertiefung, Maßnahmenplanung, tatsächlicher Durchführung und Wirkung über zwei Sitzungen prüfen. Keine Durchführung oder Wirksamkeit aus Planung ableiten.',
  'C-05': 'Krankheitsbezogene Anforderungen mit Diagnose-/Medikationsoriginalen, Beobachtung, fachlicher Einschätzung, Risiko, Maßnahme, tatsächlicher Durchführung und Wirkung in einer zulässigen Testumgebung prüfen; Feldrechte und Korrektur nachweisen.',
  'C-06': 'Selbstversorgung und Haushalt mit getrennten Beobachtungs-, Einschätzungs-, Planungs-, Durchführungs- und Wirkungsbelegen über SDK/SQL/RLS prüfen. Rechteentzug, Parallelität, Rollback, Wiederaufnahme und breite/schmale Browserbedienung einbeziehen.',
  'C-07': 'Soziale Beziehungen und Alltag mit Personenperspektive, Vertretungsquelle, Datenschutzumfang, Maßnahmenplan, tatsächlichem Ereignis und Wirkung getrennt real prüfen; keine Kommunikation oder Teilhabehandlung aus Dokumentation ableiten.',
  'C-08': 'Risikomatrix und Vertiefung mit mehreren aktuellen Risiken, ausdrücklich ausgewähltem Original, Begründung, Instrument, Maßnahmenbezug, Prüftermin, Korrektur und Paralleländerung über echte Datenbank- und Browserwege ausführen.',
  'C-09': 'Instrumentenkatalog, Lizenz-/Nutzungsrechte, Fassung, Berechnungsregel, Risikobezug, historische Auswahl und Korrektur qualifiziert prüfen. Unverfügbare oder unklare Instrumente, Rechteentzug und Altwriter in echter SDK-/SQL-/RLS-Laufzeit nachweisen.',
  'C-10': 'Wiederholungsanlass und Wiederholungsbeginn gegen unveränderte frühere Assessmentfassungen, aktuelle Originale und tatsächliche Rechte in zwei Sitzungen ausführen. Rückgabe, Freigabeentscheidung, unklaren Ausgang, Rollback und Berichtigung getrennt prüfen.'
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
  packet[6] = `${packet[6]} CP340 verbindet C-01 bis C-10 erstmals in derselben bedienbaren Oberfläche mit aktueller Originalauswahl, Eingabe, Speichern, Reload, Rechtewechsel, Fehlertrennung, ausschließlich lesender Wiederaufnahme und Berichtigung. 35 neue, 342 verbundene und 11957 vollständige lokale Fälle bestanden; echte Datenbank-, SDK-, Native-, Browser- und Fachabnahmen bleiben offen.`;
  packet[7] = 'Den verbundenen C-Vertrag mit echten Originalen, zwei Sitzungen, Feld-/Datensatzrechten, Rechteentzug, Quellsperren, Parallelität, Rollback, Native-/Altwriterkompatibilität und breiter/schmaler Browserbedienung ausführen; qualifizierte Funktions-, Pflege-, Design-, Datenschutz-, Rechts- und Betriebsabnahmen getrennt nachweisen.';
}

catalog.version = 340;
catalog.date = '2026-10-16';
catalog.checkpointSummary = 'CP340: C-01 bis C-10 bilden einen verbundenen privaten Web/Desktop-SIS-/Assessment-/Risiko-/Maßnahmenplan-/Evaluation-/Freigabeweg mit aktuellen nativen Originalen, ausdrücklicher Auswahl, assessmentgebundenem Entwurf, Reload, Rechtewechsel, CAS, dauerhaft gesicherter Anfrage, Fehlertrennung, ausschließlich lesender Quittungswiederaufnahme und append-only Berichtigung. Beobachtung, Einschätzung, Planung, tatsächliche Durchführung, Wirkung, Freigabe und Abnahme bleiben getrennt. 35/35 neue, 342/342 verbundene und 11957/11957 vollständige lokale Node-Fälle bestanden. SQL nicht ausgeführt; echte SDK-/PostgreSQL-/RLS-/Native-/Browser- und qualifizierte Funktions-/Pflege-/Design-/Datenschutz-/Rechts-/Betriebsabnahmen fehlen. 262 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50%-Ziel offen.';
catalog.checkpointNodeLog = 'docs/audit/checks/ambulant-node-checkpoint340-2026-10-16-assessment.log';
writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
