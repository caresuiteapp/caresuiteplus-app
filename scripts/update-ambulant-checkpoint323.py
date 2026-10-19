"""Record the tested combined Web checkpoint; never infer qualified acceptance."""
import json
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = Path('/workspace/scratch/3c71f43d7fd5/private-big0716')
CATALOG = ROOT / 'docs/audit/ambulant-az-katalog-2026-10-08.json'
c = json.loads(CATALOG.read_text())
if c['version'] != 322:
    raise ValueError('Expected the recovered CP322 catalog')
raw = (PRIVATE / 'merged-full-node.log').read_text()
for field, expected in [('tests', 11312), ('pass', 11312), ('fail', 0), ('cancelled', 0), ('skipped', 0), ('todo', 0)]:
    if len(re.findall(r'^ℹ ' + field + ' ' + str(expected) + '$', raw, re.M)) != 1:
        raise ValueError('Incomplete final Node evidence: ' + field)
duration = re.findall(r'^ℹ duration_ms ([0-9.]+)$', raw, re.M)[0]
evidence = {
    'B-09': 'Aktueller eigener Fallkontext mit nativen Kontakten, Risiken und hinterlegten Pflegeplanbezügen, eigener Zugangs-/Auffindbarkeitsangabe und ausdrücklichen Informationslücken. Die Auswahl wird als geprüfte Übergabefassung gesichert und bei bestehendem Ausgaberecht als escaped HTML ausgegeben. Geburtsdatum und Adresse stammen aus dem nativen Fall; fehlende Kontakte bleiben fehlend. Ein Pflegeplan wird nicht zur medizinischen Notfallanordnung oder zur bestätigten Erreichbarkeit umgedeutet.',
    'B-10': 'Bestehende aktive Dokumente werden aus der eigenen Akte ausgewählt; technische IDs werden nicht eingetippt. Herkunft, tatsächliches Dokumentdatum, persönliche Lesbarkeitsprüfung, korrekte Fallzuordnung und Prüfhinweis bleiben mit der vollständigen nativen Metadatenfassung gebunden. Inaktive oder nicht unterstützte MIME-Typen, fremde Fälle, ungültige Daten, fehlende Sichtprüfung und geänderte Originalfassungen werden abgewiesen. Die Pflegeakte kann zum Nachlesen mit gesichertem Hauptentwurf geöffnet werden. Eine automatisierte Dateibyte-, Virenscan- oder Speicherobjekt-Versionsprüfung ist nicht belegt.',
    'W-01': 'Der neue Web-Arbeitsbereich ersetzt den früheren manuellen UUID-/SHA-Dialog durch echte native Fall-, Quellen-, Auftrags- und Personenauswahl. Mehrere Originalbelege, Dokumente, Kontakte, Risiken, Planbezüge und Empfänger können gemeinsam als eigene Fassung übergeben werden. Jede Änderung ist append-only mit Originalkopfvergleich und Änderungsgrund; frühere Empfangsbestätigungen bleiben historisch und bestätigen die neue Fassung nicht. Übersicht, Suche, eigene offene Empfänge, Detailverlauf und Wiederaufnahme sind verbunden.',
    'W-02': 'Zugeordnete offene Kontrollaufträge behalten die vollständige native Historie, tatsächliche Zuständigkeit, Vertretung, Frist und Eskalationsregel. Die Oberfläche trennt den eingefrorenen Übergabestand vom heute geladenen Originalauftrag, zeigt fällige Eskalationsfristen und öffnet die vorhandene native Auftragsbearbeitung. Geänderte oder nicht zugängliche Aufgaben werden nicht als erfüllt behandelt. Ein Kommunikationsabschluss benötigt aktuelle exakt zugeordnete nicht mehr offene Originalaufträge; Stornierung oder begründete Nichterfüllung wird nicht zur Durchführung.',
    'W-08': 'Jede adressierte aktive Profilidentität bestätigt nur ihren eigenen Empfang der genauen aktuellen Fassung mit tatsächlicher Rückmeldung. Fremde, doppelte und veraltete Bestätigungen sowie Abschlüsse ohne alle Empfänge oder ohne vollständigen aktuellen Aufgabenstand werden abgewiesen. Empfang, Textantwort, Kommunikationsabschluss und klinische Durchführung bleiben getrennte Belege. Unklare Speicherantworten führen ausschließlich zur lesenden Prüfung der unverändert gesicherten nativen Anfrage, auch nach Neuladen oder SDK-/Rechtewechsel; kein automatisches erneutes Senden.',
}
shared = (' 67 neue Domänen-/Entwurfs-/Journal-/SDK-Grenzfälle und 95/95 verbundene Übergabefälle; '
          f'11312/11312 vollständige lokale Node-Fälle, {duration} ms, ohne Fehler, Abbruch, Skip oder Todo. '
          'Web/Desktop und gemeinsame native/Android-Verträge getrennt erhalten. SQL vorbereitet, nicht ausgeführt. '
          'Echter PostgreSQL-/RLS-/SDK-/Browsernachweis, semantischer Typecheck und Pflege-/Design-/Datenschutz-/Rechtsabnahmen offen.')
next_step = ('Vorhandenen autorisierten PostgreSQL-/SDK-Prüfumfang für Sitzung, aktuelle Rechte, Sensitivität, Grants/RLS, '
             'Originalfassungen, zwei Sitzungen und parallele Autoren belegen; keine produktiven Testdaten verändern. '
             'Echte Web-/Desktop-Ansicht breit und schmal, vergrößerte Schrift, Tastatur und Screenreader prüfen. '
             'Dokument-Dateibytebezug, aktuelle Erreichbarkeit und medizinische Gültigkeit separat nachweisen. '
             'Pflege-, Design-, Datenschutz- und Rechtsabnahmen bleiben offen. Größere Fortsetzung: '
             'P-01 bis P-10 als gemeinsamen Hygiene-, Material-, Geräte-, Bestell- und Bestandsablauf vertiefen.')
for task in c['tasks']:
    if task['id'] not in evidence:
        continue
    task['implementation'] = 'Teilweise umgesetzt'
    task['function'] = 'Teilprüfung'
    addition = 'CP323: ' + evidence[task['id']] + shared
    previous = task['evidence']
    if task['id'] == 'W-01':
        previous = ('CP251: Bisheriger nativer Übergabekern mit getrennten Änderungen, Originalaufträgen, '
                    'Empfängern und Empfangsbelegen bleibt erhalten. Empfang erzeugt keinen klinischen Abschluss. '
                    'Der vollständige frühere Nachweis bleibt in der kumulativen Git-Historie erhalten.')
    task['evidence'] = previous + '\n\n' + addition if previous else addition
    task['next'] = next_step
    assert [task[k] for k in ['care', 'design', 'legal']] == ['Offen', 'Offen', 'Offen']
for packet in c['packets']:
    if packet[0] in ['B-P03', 'B-P04', 'W-P01', 'W-P03']:
        packet[5] = 'Teilweise umgesetzt'
        if packet[0] == 'B-P04':
            packet[6] = 'Dokumentübernahme wird durch den neuen Fallübergabevertrag ergänzt. '
        packet[6] += ('\n\nCP323: Fallübergabe verbindet B-09/B-10/W-01/W-02/W-08 mit nativer Aktenauswahl, '
                      'Dokumentprüfung, Notfallinformationen, mehreren Empfängern, unveränderlichen Fassungen, '
                      'eigenem Empfang, Wiederaufnahme und unabhängiger Aufgabenverfolgung. 95/95 Übergabefälle '
                      'und 11312/11312 vollständige lokale Node-Fälle bestanden. SQL nicht ausgeführt; echte '
                      'SDK-/PostgreSQL-/RLS-/Browser- und alle qualifizierten Abnahmen offen.')
c['version'] = 323
c['checkpointNodeLog'] = 'docs/audit/checks/ambulant-node-checkpoint323-2026-10-16-large-handover.log'
c['checkpointSummary'] = ('CP323: B-09/B-10/W-01/W-02/W-08 sind als zusammenhängender Web/Desktop-Fallübergabeweg '
    'mit nativer Mehrfachauswahl, Dokumentprüfung, Notfallinformationen, gesichertem Entwurf, unbekannter '
    'Speicherantwort, lesender Wiederaufnahme, mehreren Empfängern, eigener fassungsgebundener Rückmeldung, '
    'append-only Änderung und unabhängigen Originalaufträgen verbunden. CP322 O-01 bis O-08 ist kumulativ '
    'mit seinen Beratungs-/Koordinationsabläufen und Belegen erhalten. 67 neue und 95/95 verbundene Übergabefälle; '
    f'11312/11312 vollständige lokale Node-Fälle in {duration} ms, ohne Fehler, Abbruch, Skip oder Todo. '
    'Syntaxprüfung der neuen TS-/TSX-Dateien bestanden; semantischer Typecheck mangels tsc nicht ausführbar (Exit127). '
    'SQL nicht ausgeführt; echte SDK-/PostgreSQL-/RLS-/Browser- und Pflege-/Design-/Datenschutz-/Rechtsabnahmen fehlen. '
    '260 Aufgaben begonnen, nur A-09 vollständig abgenommen; 50%-Ziel offen. '
    'Die ältere kanonische Arbeitsliste wird mit den kumulativ vorhandenen N-/O-Änderungen und dem neuen Übergabeblock abgeglichen.')
CATALOG.write_text(json.dumps(c, ensure_ascii=False, indent=2) + '\n')
checks = ROOT / 'docs/audit/checks'
for src, dst in [('merged-full-node.log', Path(c['checkpointNodeLog']).name), ('syntax-final.json', 'ambulant-syntax-checkpoint323-2026-10-16.json'), ('typecheck-final.log', 'ambulant-typecheck-checkpoint323-2026-10-16.log'), ('o322-snapshot-proof.json', 'ambulant-cp322-stable-source-recovery-2026-10-16.json')]:
    shutil.copyfile(PRIVATE / src, checks / dst)
handoff = ROOT / 'docs/audit/ambulant-fortsetzung-2026-10-08.md'
with handoff.open('a') as stream:
    stream.write('\n\n## CP323 – größerer Gesamtblock Fallübergabe und kumulative Beratung\n\n' + c['checkpointSummary'] + '\n\n')
    stream.write('Arbeitsbereich: `app/pflege/uebergaben/index.web.tsx`, `new.web.tsx` und `src/screens/pflege/CaseHandoverWorkspace.web.tsx`. '
                 'Detaillierter Ablauf und Prüfgrenzen: `docs/audit/ambulant-falluebergabe-gesamtweg-2026-10-16.md`. '
                 'Die jüngere stabile lokale CP322-Fassung wurde lesend gesichert, als eigener Recovery-Commit erhalten '
                 'und mit dem unabhängigen Übergabeblock zusammengeführt; der ursprüngliche Arbeitsbaum blieb unberührt. '
                 'Der ältere kanonische ZIP-Stand CP319 wurde zuvor vollständig über CRC/SHA, alle 6636 Quellen '
                 'mit 348098024 Bytes und den zugehörigen nativen Git-Commit geprüft. Die kanonische Arbeitsliste '
                 'hatte vor diesem Abgleich 48 Abweichungen allein zu den bereits vorliegenden CP321-Nachweisen. '
                 'Keine dieser Lücken wird als Abnahme gezählt.\n\n')
    stream.write('Weitere Ausführung erfolgt in zusammenhängenden fachlichen Abläufen über mehrere Katalogpunkte hinweg. '
                 'Nicht nach einem einzelnen Hilfstest oder einer kleinen Projektion stoppen. Nächster großer '
                 'fachlicher Bereich ist P-01 bis P-10 mit Hygiene, Material, Geräten, Reinigung, Zugang, Bestellung '
                 'und Bestandsabgleich. Pro Fachaufgabe bleibt die tatsächliche Abnahme getrennt nachvollziehbar. '
                 'Die Grenze von 50 % gilt unverändert für jeden der 26 Bereiche; Softwaretests ersetzen keine '
                 'Pflege-, Design- oder Rechtsabnahme.\n')
print(json.dumps({'checkpoint': 323, 'nodeTests': 11312, 'started': 260, 'accepted': 1, 'goalReached': False}))
