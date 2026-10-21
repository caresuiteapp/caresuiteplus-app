import fs from 'node:fs/promises';

const file = new URL('../docs/audit/ambulant-az-katalog-2026-10-08.json', import.meta.url);
const catalog = JSON.parse(await fs.readFile(file, 'utf8'));
if (catalog.version !== 329) throw new Error(`Ausgangskatalog ${catalog.version} statt 329`);

const specifics = {
  'R-01': 'Planfassung und Gültigkeit bilden den Kopf des Verlaufs; eine geänderte Planbasis verlangt eine neue vollständige Prüfung und Veröffentlichung.',
  'R-02': 'Arbeitszeitprüfung bindet die native Regel- und Schichtfassung. Ein neues zurückgewiesenes oder ausnahmepflichtiges Ergebnis sperrt Zuordnung und Veröffentlichung; technische Prüfung genehmigt keine Ausnahme.',
  'R-03': 'Jeder Besuch bleibt an dieselbe Tour, Aufnahme, denselben Pflegeplan und Pflegefall gebunden. Der aktuelle blockierte Besuch kann nicht durch ein älteres positives Ereignis übergangen werden.',
  'R-04': 'Zuordnung verlangt aktuellen Beschäftigungs-, Qualifikations-, Dokumentprüf-, Abwesenheits-, Rückkehr-, Schicht- und Intervallbestand je Person sowie eine ausdrückliche Fahrzeugfreigabe; Doppelbesetzung prüft beide Personen getrennt.',
  'R-05': 'Eine erforderliche Präferenzabweichung bleibt bis zu ihrer ausdrücklichen aktuellen Entscheidung veröffentlichungssperrend; Wunsch, Termin und tatsächliche Versorgung bleiben getrennt.',
  'R-06': 'Kurzfristige Umplanung bindet vorherige Zuordnung, tatsächliche Abwesenheit, vollständige Ersatzpersonen- und Qualifikationskette, dasselbe Tätigkeitsintervall und dokumentierte Benachrichtigung.',
  'R-07': 'Serienausnahme referenziert einen bestehenden Einzelbesuch, denselben Pflegefall und die geprüfte Kalenderfassung; sie erfindet keinen nativen Fremdschlüssel und keine Durchführung.',
  'R-08': 'Veröffentlichung enthält den vollständigen empfängerbezogenen Planbestand und sämtliche zugeordneten Profile. Der persönliche Posteingang zeigt nur adressierte Inhalte und quittiert je Person genau einmal; Empfang ist kein Dienstantritt.',
  'R-09': 'Fahrtbeginn und -ende binden eigene fahrende Person, Tour, freigegebenes Fahrzeug, tatsächliche Zeiten und monotone Kilometerstände; fremde oder überlappende Fahrten sperren.',
  'R-10': 'Neuester Wartungs-/Sperr-/Freigabestand gilt; eine ältere Freigabe kann Fälligkeit, Sperre oder geänderte Fahrzeugfassung nicht verdecken.',
  'R-11': 'Hausnotruf und weitere Zusatzleistungen besitzen getrennte Anfrage und tatsächliche Anbieterantwort mit Vertragsreferenz, Kontakt-/Notfallkette, Ergebnisbeleg und offenen Schritten; Anfrage oder Zusage beweist keine Versorgung.',
  'R-12': 'Essensanfrage, tatsächliche Teil-/Nicht-/Voll-Lieferungen und Restmenge bleiben an Besuch, Aufnahme, Liefertag und Originalreferenz gebunden; Lieferung, Annahme und Verzehr werden nicht gleichgesetzt.',
};
const proof = 'CP328/329: Der verbundene Web/Desktop-Dienst- und Tourenplanungsweg umfasst jetzt R-01 bis R-12 mit vollständiger aktueller Plan-, Personal-, Qualifikations-, Dokumentprüf-, Abwesenheits-, Rückkehr-, Schicht-, Besuchs-, Aufnahme-, Pflegeplan-, Präferenz-, Serien-, Fahrzeug-, Wartungs- und Empfängerbindung. Eigener adressierter Posteingang und persönliche Quittung, Zusatzleistungsanfrage/-antwort sowie Essensanfrage und Teil-/Nicht-/Voll-Lieferung sind in derselben append-only Historie verbunden. Aktuelle Rechte, Entwurfsmigration, Reload, CAS, unbekannter Ausgang und rein lesende Quittungswiederaufnahme bleiben erhalten. 110/110 R-Arbeitsplatzfälle und 136/136 verbundene R/S-Fälle bestanden. SQL vorbereitet, nicht ausgeführt; Native/Android-Einstiege unverändert. Keine Browser-/Layout-, Pflege-, Arbeitszeit-, Fuhrpark-, Datenschutz-, Rechts- oder Betriebsabnahme.';
const next = 'Gesamtweg in einer vorhandenen zulässigen PostgreSQL/PostgREST-/SDK-Testumgebung mit vollständigen Plan-, Personal-, Qualifikations-, Abwesenheits-, Schicht-, Besuchs-, Fahrzeug-, Wartungs-, Empfänger-, Anbieter- und Lieferoriginalen ausführen. Aktuelle Feld-/Datensatzrechte, RLS/Grants/Trigger, zwei Sitzungen, Intervall- und Fahrzeugparallelität, Rollback, Altwriter-/Native-Kompatibilität, persönlicher Empfang und reine Quittungswiederaufnahme prüfen. Arbeitszeit, Disposition, Fuhrpark, Zusatzleistungen, Mahlzeiten, Pflege, Design, Datenschutz und Recht getrennt abnehmen.';

for (const task of catalog.tasks.filter(task => /^R-(?:0[1-9]|1[0-2])$/.test(task.id))) {
  task.implementation = 'Teilweise umgesetzt';
  task.function = 'Teilprüfung';
  task.evidence = `${proof} ${specifics[task.id]}`;
  task.next = next;
  if ([task.care, task.design, task.legal].join('|') !== 'Offen|Offen|Offen') throw new Error(`${task.id}: qualifizierte Status dürfen nicht verändert sein`);
}
for (const packet of catalog.packets.filter(packet => /^R-P0[1-4]$/.test(packet[0]))) {
  packet[5] = 'Teilweise umgesetzt';
  packet[6] = proof;
}
for (const task of catalog.tasks.filter(task => /^S-(?:0[1-9]|10)$/.test(task.id))) {
  task.evidence = task.evidence.replace('157/157 verbundene und 11461/11461 vollständige', '157/157 S-verbundene, 136/136 R/S-Arbeitsplatz- und 11548/11548 vollständige');
}
for (const packet of catalog.packets.filter(packet => /^S-P0[1-4]$/.test(packet[0]))) {
  packet[6] = packet[6].replace('157/157 verbundene und 11461/11461 vollständige', '157/157 S-verbundene, 136/136 R/S-Arbeitsplatz- und 11548/11548 vollständige');
}
catalog.checkpointNodeLog = 'docs/audit/checks/ambulant-node-checkpoint329-2026-10-16-connected-rs.log';
catalog.checkpointSummary = 'CP329: R-01 bis R-12 und S-01 bis S-10 bilden zwei verbundene Web/Desktop-Gesamtwege für Dienst-/Tourenplanung, persönlichen Empfang, Zusatzleistungen/Mahlzeiten sowie Einsatz, Aufgabe, Nichtbesuch, Leistung, Inhaltsbestätigung, Berichtigung, Notfall, Abschluss und Quittungswiederaufnahme. Vollständige aktuelle Originale, Eingabe, Entwurf, Reload, Rechtewechsel, CAS und append-only Historien sind gebunden. Planung, Empfang, Fahrt, Lieferung, tatsächliche Zeit, Aufgabe, Leistung, Bestätigung, Notfall, Berichtigung und Abschluss bleiben getrennt. 110/110 R-, 157/157 S-verbundene, 136/136 gemeinsame R/S-Arbeitsplatz- und 11548/11548 vollständige lokale Node-Fälle bestanden. SQL nicht ausgeführt; semantischer Typecheck, echte SDK-/PostgreSQL-/RLS-/Browser- und qualifizierte Pflege-/Design-/Datenschutz-/Rechtsabnahmen fehlen. 260 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50%-Ziel offen.';

await fs.writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify({ checkpoint: 329, rTasks: 12, rPackets: 4, fullTests: 11548 }));
