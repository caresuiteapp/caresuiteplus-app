import fs from 'node:fs/promises';

const file = new URL('../docs/audit/ambulant-az-katalog-2026-10-08.json', import.meta.url);
const catalog = JSON.parse(await fs.readFile(file, 'utf8'));
if (catalog.version !== 323) throw new Error(`Ausgangskatalog ${catalog.version} statt 323`);

const specifics = {
  'P-01': 'Hygieneplan, Tätigkeit, Einsatzstelle, Schutzbedarf und exakte aktive Fassungsquelle bleiben gemeinsam gebunden; bloße Titel oder Tags erzeugen keine Gültigkeit.',
  'P-02': 'Infektionsstatus unterscheidet Verdacht, Bestätigung und Ausschluss mit eigener Quelle und Quellzeit; daraus wird keine klinische Feststellung abgeleitet.',
  'P-03': 'Artikel, Einheit, Bestellung, physischer Wareneingang, Verbrauch und Bestandsbewegung sind getrennte append-only Ereignisse; eine Bestellung macht nichts verfügbar.',
  'P-04': 'Charge, Haltbarkeit, Sperre, Freigabe, Verbrauch, Entsorgung und Korrektur bleiben getrennt; abgelaufene oder gesperrte Lose sind nicht verwendbar.',
  'P-05': 'Geräteprüfung, persönliche Einweisung, Reinigung, explizite Freigabe, Planbezug und tatsächliche Anwendung müssen für dieselbe Gerätefassung vorliegen.',
  'P-06': 'Reinigung, Entsorgung, Rücknahme und Bestandskorrektur besitzen eigene Ereignisse; keines davon wird aus Notizen, Rückgabe oder Verbrauch abgeleitet.',
  'P-07': 'Hauswirtschaft und Alltagshilfe bleiben von Behandlung, Körperpflege und bestätigter Versorgung getrennt und können diese nicht durch Freitext ersetzen.',
  'P-08': 'Ausgabe, Rückgabe, Verlust und Sperre binden den tatsächlichen Halter; PIN, Passwort und andere Zugangscodes werden nicht gespeichert.',
  'P-09': 'Bestellung, Teillieferung, Differenz und Bestand sind getrennt; Wareneingang kann die bestellte Menge nicht überschreiten und benötigt eine eigene Charge.',
  'P-10': 'Inventurzählung ändert noch keinen Bestand; Abweichung braucht eine zweite Person, aktuelle Ausgangsmenge und eine eigene Korrekturbuchung mit Prüfsperre.',
};
const proof = 'CP324: Der verbundene Web/Desktop-Arbeitsplatz P-01 bis P-10 lädt vollständige native Artikel-, Hygiene-, Infektions-, Dokument-, Plan-, Los-, Geräte-, Reinigungs-, Hauswirtschafts-, Schlüssel-, Bestell-, Liefer- und Bestandsquellen. Oberfläche, lokale Entwurfswiederaufnahme, aktuelle Rechteprüfung, exakte CAS-Fassung, dauerhaft vor RPC gesicherte Anfrage, unbekannter Transportausgang mit rein lesender Quittungsprüfung und append-only Ereignisverlauf sind verbunden. 30/30 neue, 367/367 verbundene und 11342/11342 vollständige lokale Node-Fälle bestanden; letzter Lauf 226457.955204 ms, ohne Fehler, Abbruch, Skip oder Todo. Acht TS-/TSX-Dateien bestanden den vorhandenen Babel-Parser; dies ist kein semantischer Typecheck. SQL vorbereitet, nicht ausgeführt. Native/Android-Einstiege unverändert. Keine Pflege-, Design-, Datenschutz-, Rechts- oder Betriebsabnahme.';
const next = 'Gesamtweg in einer vorhandenen zulässigen PostgreSQL/PostgREST-/SDK-Testumgebung mit echten Mandanten-, Profil-, Pflegefall-, Artikel-, Hygieneplan-, Infektions-, Dokument-, Plan-, Los-, Geräte-, Schulungs-, Reinigungs-, Schlüssel-, Bestell-, Liefer- und Bestandsoriginalen ausführen. Aktuelle Feld-/Standort-/Sensitivrechte, RLS/Grants/Trigger, zwei Sitzungen, parallele Autoren, Rollback, Altwriter-Kompatibilität und Quittungswiederaufnahme prüfen. Breite/schmale Browserdarstellung, Tastatur, Screenreader sowie Pflege, Hygiene, Medizinprodukte, Datenschutz und Recht separat abnehmen.';

for (const task of catalog.tasks.filter(task => /^P-(?:0[1-9]|10)$/.test(task.id))) {
  task.implementation = 'Teilweise umgesetzt';
  task.function = 'Teilprüfung';
  task.evidence = `${proof} ${specifics[task.id]}`;
  task.next = next;
  if ([task.care, task.design, task.legal].join('|') !== 'Offen|Offen|Offen') {
    throw new Error(`${task.id}: qualifizierte Status dürfen nicht verändert sein`);
  }
}

for (const packet of catalog.packets.filter(packet => /^P-P0[1-4]$/.test(packet[0]))) {
  packet[5] = 'Teilweise umgesetzt';
  packet[6] = proof;
}

catalog.version = 324;
catalog.date = '2026-10-16';
catalog.checkpointNodeLog = 'docs/audit/checks/ambulant-node-checkpoint324-2026-10-16-large-supply.log';
catalog.checkpointSummary = 'CP324: P-01 bis P-10 sind als zusammenhängender Web/Desktop-Hygiene-, Infektionsschutz-, Material-, Chargen-, Geräte-/Wartungs-, Reinigungs-/Entsorgungs-, Hauswirtschafts-/Zugangs-, Bestell-/Liefer- und Bestandsweg mit vollständigen nativen Quellen, Entwurf, aktueller Rechteprüfung, dauerhaftem Anfragejournal, unbekanntem Transportausgang, lesender Wiederaufnahme, CAS und append-only Korrektur verbunden. Planung, Gültigkeit, Ausgabe, Verbrauch, Anwendung, Bestellung, Lieferung, Einweisung, Rückruf, Reinigung und tatsächliche Durchführung bleiben getrennt. 30/30 neue, 367/367 verbundene und 11342/11342 vollständige lokale Node-Fälle bestanden; letzter vollständiger Lauf 226457.955204 ms ohne Fehler, Abbruch, Skip oder Todo. Acht TS-/TSX-Dateien bestanden eine vorhandene Babel-Syntaxtransformation; Gesamt-Typecheck endet mangels tsc mit Exit127. SQL nicht ausgeführt; echte SDK-/PostgreSQL-/RLS-/Browser- und Pflege-/Design-/Datenschutz-/Rechtsabnahmen fehlen. 260 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50%-Ziel offen.';

await fs.writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify({ checkpoint: 324, tasks: 10, packets: 4, fullTests: 11342 }));
