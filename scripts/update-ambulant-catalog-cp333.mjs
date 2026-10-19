import fs from 'node:fs/promises';

const file = new URL('../docs/audit/ambulant-az-katalog-2026-10-08.json', import.meta.url);
const catalog = JSON.parse(await fs.readFile(file, 'utf8'));
if (![332, 333].includes(catalog.version)) throw new Error(`Ausgangskatalog ${catalog.version} statt 332/333`);

const fullTests = Number(process.env.CARESUITE_FULL_TESTS);
if (!Number.isInteger(fullTests) || fullTests < 11633) throw new Error('Tatsächliche vollständige Testzahl fehlt');

const specifics = {
  'V-01': 'Fassung, Freigabe, Kenntnisnahme und Berichtigung bleiben getrennt.',
  'V-02': 'Anforderung, Aktenstelle, offene Lücke und Prüfergebnis bleiben getrennt.',
  'V-03': 'Eingang, Untersuchung, Antwort und belegter Abschluss bleiben getrennt.',
  'V-04': 'Meldung, Ursache, Maßnahme, Wirksamkeit und anonyme Auswertung bleiben getrennt.',
  'V-05': 'Ereignis, Plananpassung und tatsächliche Wiederholungsprüfung bleiben getrennt.',
  'V-06': 'Plan, tatsächliche Visite, Feststellung und Folgeschritt bleiben getrennt.',
  'V-07': 'Maßnahme, Durchführung, Beobachtung, Wirksamkeit und Abschluss bleiben getrennt.',
  'V-08': 'Realszenarien und qualifizierte Fachentscheidung bleiben getrennt von Softwaretests.',
};

const proof = `CP333: Gemeinsamer V-Arbeitsplatz mit Originalauswahl, Entwurf, Reload, aktuellen Rechten, CAS, Quittungslesung und Berichtigung; 43/43 neue, 1039/1039 verbundene und ${fullTests}/${fullTests} vollständige lokale Node-Fälle bestanden. SQL/Browser/TSX/Typecheck und qualifizierte Abnahmen offen; keine neue Abnahme.`;
const next = 'Gesamtweg in einer vorhandenen zulässigen PostgreSQL/PostgREST-/SDK-Testumgebung mit echten Mandanten-, Profil-, Pflegefall-, QM-Fassungs-, Prüfungs-, Beschwerde-, Ereignis-, Pflegeplan-, Visiten-, Maßnahmen-, Qualifikations- und Szenariooriginalen ausführen. RLS/Grants, Feld-/Datensatzrechte, Quellsperren, zwei Sitzungen, CAS, Deadlock/Rollback, Altwriter-/Native-Kompatibilität, unklaren Transportausgang und reine Quittungswiederaufnahme prüfen. Breite/schmale Browserdarstellung, Tastatur und Screenreader sowie Pflege, Design, Datenschutz, Recht und Betrieb getrennt abnehmen.';

for (const task of catalog.tasks.filter(task => /^V-0[1-8]$/.test(task.id))) {
  if ([task.care, task.design, task.legal].join('|') !== 'Offen|Offen|Offen') throw new Error(`${task.id}: Abnahmestatus verändert`);
  task.implementation = 'Teilweise umgesetzt';
  task.function = 'Teilprüfung';
  const prior = task.evidence.split('\n\nCP333:')[0];
  task.evidence = `${prior}\n\n${proof} ${specifics[task.id]}`;
  task.next = next;
}

for (const packet of catalog.packets.filter(packet => /^V-P0[1-3]$/.test(packet[0]))) {
  packet[5] = 'Teilweise umgesetzt';
  const prior = packet[6].split('\n\nCP333:')[0];
  packet[6] = `${prior}\n\n${proof}`;
  packet[7] = 'Die verbundenen V-Originale in der isolierten Laufzeit prüfen; danach getrennte Pflege-, Design-, Datenschutz-, Rechts- und Betriebsabnahmen mit realen Szenarien belegen.';
}

catalog.version = 333;
catalog.date = '2026-10-16';
catalog.checkpointNodeLog = 'docs/audit/checks/ambulant-node-checkpoint333-2026-10-16-quality.log';
catalog.checkpointSummary = `CP333: V-01 bis V-08 bilden einen verbundenen privaten Web/Desktop-QM-Weg mit aktuellen nativen Originalen, Eingabe, Entwurf, Reload, Rechtewechsel, CAS, Fehlertrennung, lesender Quittungswiederaufnahme und append-only Berichtigung. Dokumentfassung, Prüfungszuordnung, Beschwerde, Fehler/Beinahefehler, Ursachenanalyse, Pflegeplananpassung, Visite, Maßnahme, tatsächliche Wirksamkeit und qualifizierte Fachentscheidung bleiben getrennt. 43/43 neue, 1039/1039 verbundene und ${fullTests}/${fullTests} vollständige lokale Node-Fälle bestanden. SQL nicht ausgeführt; echte SDK-/PostgreSQL-/RLS-/Browser- und qualifizierte Pflege-/Design-/Datenschutz-/Rechts-/Betriebsabnahmen fehlen. 260 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50%-Ziel offen.`;

await fs.writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify({ checkpoint: 333, tasks: 8, packets: 3, fullTests }));
