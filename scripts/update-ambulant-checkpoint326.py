"""Record the connected Q personnel lifecycle without changing acceptance."""
from pathlib import Path
import json, os, re, subprocess

ROOT = Path(__file__).resolve().parents[1]
CP = 326

def atomic(path, text):
    temp = path.with_name(path.name + '.cp326.tmp')
    temp.write_text(text)
    os.replace(temp, path)

def summary(path):
    text = path.read_text()
    result = {}
    for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']:
        values = re.findall(r'^ℹ ' + key + r' ([0-9]+)\s*$', text, re.M)
        if len(values) != 1:
            raise ValueError(f'Incomplete test log: {path}')
        result[key] = int(values[0])
    if result['tests'] != result['pass'] or any(result[k] for k in ['fail', 'cancelled', 'skipped', 'todo']):
        raise ValueError(f'Failed test log: {path}')
    result['durationMs'] = re.findall(r'^ℹ duration_ms ([0-9.]+)\s*$', text, re.M)[-1]
    return result

checks = ROOT / 'docs/audit/checks'
full = summary(checks / 'ambulant-node-checkpoint326-2026-10-16-large-personnel.log')
targeted = summary(checks / 'ambulant-pq-checkpoint326-targeted-2026-10-16.log')
assert full['tests'] == 11410 and targeted['tests'] == 98

catalog = ROOT / 'docs/audit/ambulant-az-katalog-2026-10-08.json'
c = json.loads(catalog.read_text())
assert c['version'] == 325

items = {
    'Q-01': 'Beschäftigungsfassung mit Standort, Rolle und Gültigkeit; Austritt bleibt ein getrenntes Ereignis mit ausgewählten aktuellen Zugangsoriginalen.',
    'Q-02': 'Qualifikation bindet den exakten Dokument- und Qualifikationsbestand, konkrete Tätigkeit, Gültigkeit und eine ausdrückliche Prüfung.',
    'Q-03': 'Delegation bindet eine konkrete Person, Tätigkeit und zeitliche Grenze an das passende verifizierte Qualifikationsereignis.',
    'Q-04': 'Teilnahme, Einweisung und Nichtbestehen bleiben getrennte Ergebnisse mit Thema, Gerätefassung, Dokument, Einweisendem und Gültigkeit.',
    'Q-05': 'Doppelbesetzung verlangt zwei verschiedene aktuelle Beschäftigte, gemeinsames Intervall, Anlass und jeweils eigene Bestätigung der eingeplanten Profile.',
    'Q-06': 'Zuweisung, Erinnerung, Abschluss, Prüfung und Ablehnung bleiben eigene Fortbildungsstände mit Frist und Originalnachweis.',
    'Q-07': 'Vertretung bindet Abwesenheitsoriginal, Person, Zweck, Intervall und einen spätestens gleichzeitig endenden begrenzten Zugriff.',
    'Q-08': 'Gefährdung, Maßnahme, Status, zuständige Person und Dokument werden als interner Personalvorgang verbunden.',
    'Q-09': 'Tatsächlicher Zeitquellenbeleg, Intervall, Lohnklassifikation und Prüfung bleiben getrennt; daraus entsteht keine Auszahlung.',
    'Q-10': 'Abwesenheit und spätere Rückkehrentscheidung bleiben getrennt; eingeschränkte Rückkehr benötigt eine eigene Befristung und Einschränkung.',
}
remaining = {
    'Q-01': 'Vollständige Vertrags-/Rollen-/Standortänderungshistorie und tatsächlichen providerübergreifenden Zugriffsentzug nachweisen.',
    'Q-02': 'Fachlich qualifizierte Prüfung, Dokumentinhalt, Tätigkeitsschema und Ablaufwirkung in allen Zuweisungspfaden nachweisen.',
    'Q-03': 'Delegationsbefugnis, Aufsicht, Widerruf und tatsächliche Touren-/Aufgabensperre serverseitig nachweisen.',
    'Q-04': 'Geräte-/Herstelleranforderung, Einweisungsberechtigung und getrennte Kompetenzfeststellung fachlich nachweisen.',
    'Q-05': 'Atomare Reservierung beider Personen und Konflikt-, Ausfall- und Ersatzbehandlung in der Dienstplanung nachweisen.',
    'Q-06': 'Verbindliche Pflichtregel, Originalinhalt und fachlich begründete Gültigkeit/Wiedervorlage qualifiziert prüfen.',
    'Q-07': 'Tatsächlichen befristeten Rechteumfang, Erreichbarkeit, Widerruf und automatischen Rechteablauf nachweisen.',
    'Q-08': 'Arbeitsschutzprozess, Employee-Self-Rechte und Datenbankausschluss für Klienten-/Familienportale real prüfen.',
    'Q-09': 'Zuschläge, Freigabe, Export und vollständige Mikrosekunden-Originalkette zu tatsächlicher Abrechnung nachweisen.',
    'Q-10': 'Tatsächliche Rückkehr, verantwortliche Einsatzfähigkeitsentscheidung, Widerruf und Planfolge qualifiziert prüfen.',
}
shared = (' Gemeinsamer Web/Desktop-Personalarbeitsplatz mit vollständiger Originalauswahl, aktuellem Rollen-/Sitzungscheck, '
          'profilgebundenem Entwurf, vor RPC gesicherter exakter Anfrage, lesender Wiederaufnahme, append-only Korrektur und vollständigem Reload. '
          '22/22 neue Q-Fälle, 98/98 verbundene P/Q-Fälle und 11410/11410 im vollständigen lokalen Lauf bestanden. '
          'SQL ist vorbereitet und nicht ausgeführt; SDK-/PostgreSQL-/RLS-/Browser- und qualifizierte Abnahmen bleiben offen.')
for task in c['tasks']:
    if task['id'] not in items:
        continue
    assert [task[k] for k in ['care', 'design', 'legal']] == ['Offen', 'Offen', 'Offen']
    task['implementation'] = 'Teilweise umgesetzt'
    task['function'] = 'Teilprüfung'
    task['evidence'] = 'CP191–200: Frühere Grenzbelege bleiben unverändert erhalten. CP326: ' + items[task['id']] + shared
    task['next'] = (remaining[task['id']] + ' Zwei reale Sitzungen, Rechteentzug, Parallelität, Rollback und vollständige Rücklesung prüfen. '
                    'Breite/schmale Browseransicht, vergrößerte Schrift, Tastatur/Screenreader sowie Pflege-, Design-, Datenschutz-, Rechts- und Betriebsabnahmen bleiben offen. '
                    'Nächster großer Block: Dienst- und Tourenplanung gemäß R-01–R-10.')
for packet in c['packets']:
    if not packet[0].startswith('Q-P'):
        continue
    packet[5] = 'Teilweise umgesetzt'
    packet[6] = ('CP191–200 bleiben im Originalverlauf erhalten. CP326 verbindet Q-01 bis Q-10 zu einem Personalworkflow: Beschäftigung/Qualifikation/Delegation, '
                 'Einweisung/Doppelbesetzung/Fortbildung, Vertretung/Arbeitsschutz/Lohnzeit sowie Abwesenheit/Rückkehr/Austritt und Berichtigung. '
                 '22/22 Q-Fälle, 98/98 P/Q-Fälle und 11410/11410 lokal bestanden. SQL, echte SDK-/PostgreSQL-/RLS-/Browserprüfungen und qualifizierte Abnahmen offen.')

c['version'] = CP
c['checkpointNodeLog'] = 'docs/audit/checks/ambulant-node-checkpoint326-2026-10-16-large-personnel.log'
c['checkpointSummary'] = ('CP326: Verbundener Web/Desktop-Personalablauf Q-01–Q-10 mit 13 getrennten Ereignisarten für Beschäftigung, Qualifikation, Delegation, '
                          'Einweisung, Doppelbesetzung, Fortbildung, Vertretung, Arbeitsschutz, Lohnzeit, Abwesenheit, Rückkehr, Austritt und append-only Berichtigung. '
                          'CP325 ist regulär integriert. Vollständige aktuelle Originalauswahl, profilgebundener Entwurf, vor RPC gesicherte Anfrage, lesende Wiederaufnahme, '
                          'aktuelle Rechte-/Sitzungsbindung und vollständiger Reload sind verbunden. 22/22 neue Q-Fälle, 98/98 verbundene P/Q-Fälle und 11410/11410 '
                          f'vollständige lokale Node-Fälle bestanden ({full["durationMs"]} ms), ohne Fehler, Abbruch, Skip oder Todo. Acht TS-/TSX-Dateien wurden geparst '
                          'und transformiert; tsc fehlt weiterhin (Exit127). SQL vorbereitet und nicht ausgeführt; echte SDK-/PostgreSQL-/RLS-/Browser- und Pflege-/Design-/Datenschutz-/Rechts-/Betriebsabnahmen offen. '
                          '260 Aufgaben begonnen, eine vollständig abgenommen, reached=false.')
atomic(catalog, json.dumps(c, ensure_ascii=False, indent=2) + '\n')
progress = subprocess.check_output(['node', 'scripts/checks/ambulant-milestone-progress.mjs'], cwd=ROOT, text=True)
atomic(checks / 'ambulant-50-prozent-2026-10-08.json', progress)
atomic(checks / 'ambulant-milestone-checkpoint326-2026-10-16.json', progress)
handoff = ROOT / 'docs/audit/ambulant-fortsetzung-2026-10-08.md'
atomic(handoff, handoff.read_text() + '\n\n## CP326 – verbundener Personal-, Qualifikations- und Rückkehrablauf\n\n' + c['checkpointSummary'] +
       '\n\nEinzelheiten: `docs/audit/ambulant-personal-delegation-gesamtweg-2026-10-16.md`. CP325 bleibt vollständig integriert. Keine Abnahmekriterien wurden geändert. '\
       'Nächster großer Block: R-01 bis R-10 als zusammenhängende Dienst-/Tourenplanung mit Planfassung, Freigabe, Rollen, Konflikten, Empfang, Wiederaufnahme und Korrektur. '\
       'Vor dem nächsten Speichern neuesten kanonischen Stand neu auflösen; keine ältere Fassung überschreiben.\n')
print(json.dumps({'checkpoint': CP, 'fullNode': full, 'targetedNode': targeted,
                  'accepted': json.loads(progress)['accepted'], 'reached': json.loads(progress)['reached']}))
