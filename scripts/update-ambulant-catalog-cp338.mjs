import { readFileSync, writeFileSync } from 'node:fs';

const path = 'docs/audit/ambulant-az-katalog-2026-10-08.json';
const catalog = JSON.parse(readFileSync(path, 'utf8'));
const taskIds = new Set(['A-01', 'A-02', 'A-03', 'A-04', 'A-05', 'A-06', 'A-07', 'A-08']);
const sharedEvidence = 'CP338: Ein gemeinsamer privater Web/Desktop-Organisations- und Stammdatenarbeitsplatz bindet aktuelle Mandanten-, Abrechnungs-/IK-, Branding-, Standortfassungs-, Profil-, Konto-, Rollen-/Rechte-, Modul-, Katalog-, Leistungspositions-, Aufgaben-, Zugriffs- und Verlaufsoriginale an 14 getrennte Vorgangsarten. Entwurf, Prüfung, Standortfassung, Wechselprüfung, Rechtefassung, Zugriffsentscheidung, Fachkonfiguration, Aktivierungsentscheidung, Katalogfassung, Veröffentlichungsentscheidung, Kontextwechsel, Arbeitsübersicht, Navigation und append-only Berichtigung bleiben getrennt. Profil-/mandantengebundener Entwurf, Reload, aktueller Rechtewechsel, CAS, dauerhaft vor RPC gesicherte Anfrage, bestätigter Abbruch, unbekannter Transportausgang und ausschließlich lesende Quittungswiederaufnahme sind verbunden. 38/38 neue, 94/94 verbundene und 11884/11884 vollständige lokale Node-Fälle bestanden. SQL ist nur vorbereitet; echte SDK-/PostgreSQL-/PostgREST-/RLS-/Grant-/Zwei-Sitzungs-/Parallelitäts-/Rollback-/Altwriter-/Browserprüfung und qualifizierte Pflege-/Design-/Datenschutz-/Rechts-/Betriebsabnahmen fehlen.';
const nextById = {
  'A-01': 'Zwei reale Dienste mit vollständigen Stammdaten, Abrechnung/IK und Branding in einer zulässigen Testumgebung getrennt anlegen; Lese-, Schreib-, Export- und Administrationsisolation, Rechteentzug, Parallelität, Rollback und Originalhistorie über SDK/SQL/RLS nachweisen. Breite und schmale Browserbedienung sowie qualifizierte Abnahmen bleiben offen.',
  'A-02': 'Reale Standortfassungen, Zuständigkeit, Leitung und Dienstzeiten über SDK/SQL/RLS prüfen. Wechsel mit getrennten Ausgangs-/Zieloriginalen, konkurrierender Änderung, Rechteentzug, Rückwechsel und vollständiger Originalhistorie ausführen; Browser- und Fachabnahmen bleiben offen.',
  'A-03': 'Rollen- und Einzelrechte einschließlich Lesen, Schreiben, Freigeben und Exportieren mit zwei Sitzungen, Feld-/Datensatzrechten, Rechteentzug und Paralleländerung tatsächlich ausführen. Browser-, Datenschutz-, Rechts- und Betriebsabnahme bleiben offen.',
  'A-04': 'Aktive, gesperrte, abgelaufene und ausgeschiedene Konten samt bestehenden Sitzungen serverseitig über SDK/PostgREST/RLS prüfen. Tokenwechsel, BFCache, verspätete Antwort, Entwurf und erneute Anmeldung real testen; qualifizierte Abnahmen bleiben offen.',
  'A-05': 'Ungültige Fachkonfiguration und getrennte Aktivierungsentscheidung in einer zulässigen Datenbankumgebung ausführen. Quellsperre, CAS, Rechteentzug, Wiederholung, Rollback, alte Writer und unveränderte aktive Bindung nachweisen; Browser- und Fachabnahmen bleiben offen.',
  'A-06': 'Zwei reale Katalogfassungen mit Gültigkeit, Änderungsgrund und verantwortlichem Profil veröffentlichen und historische Dokumentation unverändert gegen die alte Position lesen. Lücke, Überlappung, Rückdatierung, Paralleländerung, Korrektur und Rücknahme über SDK/SQL/RLS prüfen.',
  'A-07': 'Mandanten-/Standort-/Benutzerkontext mit sichtbaren Originalen, offenem Entwurf und laufender Anfrage im echten Browser wechseln. Alte Anzeigen und Writes sperren, Rückkehr nur im exakt gleichen Kontext erlauben und Rechteentzug, Offlinezustand sowie verspätete Antworten prüfen.',
  'A-08': 'Tatsächliche offene Aufgaben, Fristen, kritische Rückmeldungen und Zuständigkeiten vollständig über SDK/SQL/RLS laden und die Navigation auf dasselbe offene Original prüfen. Statuswechsel, Paralleländerung, Rechteentzug, leere/große Listen sowie breite/schmale Browserdarstellung testen.'
};

for (const task of catalog.tasks) {
  if (!taskIds.has(task.id)) continue;
  task.evidence = `${task.evidence} ${sharedEvidence}`;
  task.next = nextById[task.id];
}

for (const packet of catalog.packets) {
  if (!['A-P01', 'A-P02', 'A-P03'].includes(packet[0])) continue;
  packet[6] = `${packet[6]} CP338 verbindet die zugeordneten A-01 bis A-08 erstmals in derselben bedienbaren Oberfläche mit aktueller Originalauswahl, Entwurf, Speichern, Reload, Rechtewechsel, Fehlertrennung, Wiederaufnahme und Berichtigung. 38 neue, 94 verbundene und 11884 vollständige lokale Fälle bestanden; echte Datenbank-, SDK-, Browser- und Fachabnahmen bleiben offen.`;
  packet[7] = 'Den verbundenen Vertrag mit echten Originalen, zwei Sitzungen, Feld-/Datensatzrechten, Rechteentzug, Parallelität, Rollback, Native-/Altwriterkompatibilität und breiter/schmaler Browserbedienung ausführen; qualifizierte Pflege-, Design-, Datenschutz-, Rechts- und Betriebsabnahmen getrennt nachweisen.';
}

catalog.version = 338;
catalog.date = '2026-10-16';
catalog.checkpointSummary = 'CP338: A-01 bis A-08 bilden einen verbundenen privaten Web/Desktop-Organisations- und Stammdatenweg mit aktuellen nativen Originalen, ausdrücklicher Auswahl, Entwurf, Reload, Rechtewechsel, CAS, dauerhaft gesicherter Anfrage, Fehlertrennung, ausschließlich lesender Quittungswiederaufnahme und append-only Berichtigung. Planung, Prüfung, Aktivierung, Veröffentlichung, Anmeldung, tatsächliche Nutzung und Abnahme bleiben getrennt. 38/38 neue, 94/94 verbundene und 11884/11884 vollständige lokale Node-Fälle bestanden. SQL nicht ausgeführt; echte SDK-/PostgreSQL-/RLS-/Browser- und qualifizierte Pflege-/Design-/Datenschutz-/Rechts-/Betriebsabnahmen fehlen. 262 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50%-Ziel offen.';
catalog.checkpointNodeLog = 'docs/audit/checks/ambulant-node-checkpoint338-2026-10-16-organization.log';
writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
