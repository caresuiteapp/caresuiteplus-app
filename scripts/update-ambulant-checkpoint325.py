"""Reconcile the completed local P workflow; preserve acceptance and original evidence."""
from pathlib import Path
import json,os,re,shutil,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
PRIVATE=Path(sys.argv[1]).resolve()
CP=325
def atomic(path,text):
    temp=path.with_name(path.name+'.cp325.tmp');temp.write_text(text);os.replace(temp,path)
def summary(path):
    text=path.read_text();data={}
    for key in ['tests','pass','fail','cancelled','skipped','todo']:
        values=re.findall(r'^ℹ '+key+r' ([0-9]+)\s*$',text,re.M)
        if len(values)!=1:raise ValueError('Incomplete actual test log: '+str(path))
        data[key]=int(values[0])
    if data['tests']!=data['pass'] or any(data[k] for k in ['fail','cancelled','skipped','todo']):raise ValueError('The completed verification is not green.')
    data['durationMs']=re.findall(r'^ℹ duration_ms ([0-9.]+)\s*$',text,re.M)[-1]
    return data
full=summary(PRIVATE/'full-node-after-rollback.log');targeted=summary(PRIVATE/'p-targeted-after-rollback.log');risk=summary(PRIVATE/'risk-session-isolated.log')
assert (full['tests'],targeted['tests'],risk['tests'])==(11390,77,103)
catalog=ROOT/'docs/audit/ambulant-az-katalog-2026-10-08.json';c=json.loads(catalog.read_text());assert c['version']==325
items={
'P-01':'Einsatzzuordnung mit aktueller QM-Fassung, Tätigkeit, Einsatzstelle, Schutzmaßnahmen, aktivem Verantwortungsprofil und Gültigkeitsdaten. Neuere Zuordnungen und geänderte QM-Originale sperren die alte Auswahl.',
'P-02':'Verdacht, bestätigter Befund und Ausschluss werden mit Erregerangabe, ursprünglicher Befundzeit, Aktenbeleg, Schutzmaßnahmenbezug und ausdrücklich offenen Angaben getrennt erfasst.',
'P-03':'Eigene Artikelidentität, kleinste Mengeneinheit, Mindestbestand, fallgebundene Charge und append-only Verbrauch. Idempotente Originalanfrage und lesende Quittungswiederaufnahme schützen vor automatischer Doppelbuchung.',
'P-04':'Teilwareneingänge erhalten eigene Chargenidentitäten, tatsächliches Verfallsdatum und Falllagerort. Sperre, Freigabe, Verbrauch, Entsorgung und Berichtigung bleiben getrennte Originalereignisse.',
'P-05':'Aktuelle Prüfung, eigene Einweisung, Reinigung, Hygienezuordnung und eigene Geräteprüfung vor Nutzung werden getrennt benötigt. Fehlgeschlagene, überholte oder abgelaufene Nachweise sperren neue Nutzung.',
'P-06':'Reinigung und Desinfektion erhalten tatsächliche Zeit, Verfahren, Mittel, Ergebnis, Abweichung, eigene Urheberschaft und Aktenbezug. Eine tatsächliche Materialentsorgung bucht ihre Menge gesondert.',
'P-07':'Eigene Hauswirtschaftsereignisse mit Leistungsbereich, Tätigkeit, Ort, tatsächlichem Beginn/Ende, eigener Urheberschaft, durchgeführt/nicht durchgeführt und Abweichung. Keine Umdeutung in Pflege oder Behandlung.',
'P-08':'Schlüsselangebot, eigener Empfang, eigene Rückgabe/Verlustmeldung, dokumentierte Sperre und abgeschlossene Bearbeitung haben getrennte Ereignisse. Native Schlüsselidentität, aktive Verwahrung und nicht geheime Belegreferenz bleiben verbunden.',
'P-09':'Artikelbezogene Bestellung, tatsächliche Teilwareneingänge und chargenbezogene Mengenführung sind verbunden. Offene Bestellmengen bleiben sichtbar; Bestellung erzeugt keinen Bestand und Lieferung bestätigt keine Anwendung.',
'P-10':'Zählung bewahrt Sollmenge und genaue Chargenfassung, ohne Menge zu ändern. Eine andere Person prüft und bucht einmalig; zwischenzeitliche Bestandsänderung erfordert Neuzählung. Berichtigung bewahrt das Original.',
}
remaining={
'P-01':'Strukturierten Schutzbedarf, fachliche Einsetzbarkeit und qualifizierte Verantwortungszuordnung getrennt nachweisen.',
'P-02':'Labor-/Befunddatei, tatsächliche medizinische Anordnung, Befundgültigkeit und klinische Historie zusätzlich nachweisen.',
'P-03':'Eindeutige native Einsatz-/Durchführungsrelation und fachlichen Verbrauchsbezug ergänzen; ein Dokumentbezug ist kein klinischer Leistungsnachweis.',
'P-04':'Rückruf-/Sperrbeleg und tatsächliche Anwendungs-/Einsatzrelation am Original sowie physische Bestandsführung prüfen.',
'P-05':'Native Medizinprodukteklassifikation, alle gerätespezifisch erforderlichen Prüfarten, Qualifikation und fachliche Einsatzfreigabe separat nachweisen.',
'P-06':'Verfahren/Mittel, tatsächliche Hygiene- und Entsorgungsbelege sowie fachlich erforderliche hygienische Freigabe am Original prüfen.',
'P-07':'Native Assist-Tätigkeits-/Einsatzrelation und Originalleistungsbeleg ergänzen. Die Wortprüfung ersetzt keine fachliche Leistungsabgrenzung.',
'P-08':'Tatsächliche Zugangssperre, Widerruf oder Schlüsselersatz im zuständigen System und die physische Verwahrung prüfen; das Ereignis führt keine Tür-/Zugangssperre aus.',
'P-09':'Native Lieferanten-/Positions-/Lieferschein- und Rechnungsrelation sowie tatsächliche Warenannahme am Original nachweisen.',
'P-10':'Native Lagerplatzrelation, tatsächliche physische Zählung und Differenzfreigabe mit zwei berechtigten Personen prüfen.',
}
shared=' Gemeinsamer Web-Ablauf mit Originalauswahl, gesichertem Entwurf, exakter Anfrage, Wiederaufnahme und Berichtigung. 77/77 P-Fälle und 11390/11390 im vollständigen lokalen Lauf bestanden. SQL/SDK/Browser und qualifizierte Abnahmen offen.'
for t in c['tasks']:
    if t['id'] not in items:continue
    assert [t[k] for k in ['care','design','legal']]==['Offen','Offen','Offen']
    t['implementation']='Teilweise umgesetzt';t['function']='Teilprüfung'
    t['evidence']='CP181–190 und CP324: Frühere Grenzbelege und der erste Fallbuchkern bleiben im kumulativen Git-Verlauf erhalten. CP325: '+items[t['id']]+shared
    t['next']=remaining[t['id']]+' Vorhandene PostgreSQL-/SDK-/RLS-/Feldrechte und zwei Sitzungen tatsächlich prüfen. Breite/schmale Webansicht, vergrößerte Schrift, Tastatur und Screenreader sowie Pflege-, Design-, Datenschutz-, Rechts- und Betriebsabnahmen bleiben offen. Nächster großer Block: Personal/Qualifikation und Dienst-/Tourenplanung gemäß Q/R-Katalog.'
for p in c['packets']:
    if not p[0].startswith('P-P'):continue
    p[5]='Teilweise umgesetzt';p[6]='CP183/186/189/190 und CP324 bleiben im kumulativen Originalverlauf erhalten. CP325 verbindet P-01 bis P-10 zu einem Web-Fallarbeitsplatz: Hygiene/Befund, Bestellung/Teilwareneingang, Charge/Verbrauch, Geräte/Reinigung, Hauswirtschaft/Schlüssel und Zählung/Berichtigung. 77/77 P-Fälle und 11390/11390 lokal bestanden. SQL, echte SDK-/Browserprüfungen und qualifizierte Abnahmen offen.'
c['version']=CP;c['checkpointNodeLog']='docs/audit/checks/ambulant-node-checkpoint325-2026-10-16-large-supply.log'
c['checkpointSummary']='CP325: Zusammengeführter großer Web/Desktop-Ablauf P-01–P-10 mit 19 getrennten Ereignisarten, tatsächlicher Originalauswahl, eigenen Mengen/Chargen, Teilbestellungen/-eingängen, Verbrauch, Sperre/Freigabe, Entsorgung, Zählung mit anderer Prüferperson, Berichtigung, Geräteprüfung/eigener Einweisung/Reinigung/Nutzung, Hauswirtschaft und Schlüsselverwahrung. CP324-Produkt- und Auditbelege sind regulär integriert. Eindeutiger SQL-Deadlock-Rollback wird bei der ersten Material- oder Übergabeanfrage als Abweisung behandelt; die lesende Wiederaufnahme darf weiterhin keinen ursprünglichen Schreibrollback ableiten. Neue Formulargruppen, vollständige Ereignisdetails, lokale Entwürfe, Anzeige-/Aktionssperre bei Rechteverlust und Zeitumstellungswahl sind enthalten. 77/77 gezielte P-Fälle und 11390/11390 im vollständigen lokalen Lauf mit acht parallelen Prüfdateien bestanden. Ein erster Lauf mit maximaler Parallelität scheiterte an einer vorhandenen Sitzungstestprüfung; 103/103 isolierte Sitzungsfälle und der Wiederholungslauf bestanden. Beide Rohprotokolle bleiben erhalten. Syntaxprüfung für neun betroffene TS-/TSX-Dateien bestanden; tsc fehlt weiterhin (Exit127). SQL vorbereitet und nicht ausgeführt; tatsächliche SDK-/PostgreSQL-/RLS-/Browser- und Pflege-/Design-/Datenschutz-/Rechts-/Betriebsabnahmen offen. 260 Aufgaben begonnen, eine vollständig abgenommen, reached=false.'
atomic(catalog,json.dumps(c,ensure_ascii=False,indent=2)+'\n')
checks=ROOT/'docs/audit/checks'
for source,name in [('full-node-concurrency8.log','ambulant-node-checkpoint325-pre-rollback-2026-10-16.log'),('connected-207.log','ambulant-connected-checkpoint325-after-rollback-2026-10-16.log'),('full-node-after-rollback.log',Path(c['checkpointNodeLog']).name),('full-node.log','ambulant-node-checkpoint325-initial-parallel-2026-10-16.log'),('p-targeted-after-rollback.log','ambulant-supply-checkpoint325-targeted-2026-10-16.log'),('risk-session-isolated.log','ambulant-risk-session-checkpoint325-isolated-2026-10-16.log'),('syntax-final.json','ambulant-syntax-checkpoint325-2026-10-16.json'),('typecheck-final.log','ambulant-typecheck-checkpoint325-2026-10-16.log')]:shutil.copyfile(PRIVATE/source,checks/name)
progress=subprocess.check_output(['node','scripts/checks/ambulant-milestone-progress.mjs'],cwd=ROOT,text=True)
atomic(checks/'ambulant-50-prozent-2026-10-08.json',progress);atomic(checks/'ambulant-milestone-checkpoint325-2026-10-16.json',progress)
handoff=ROOT/'docs/audit/ambulant-fortsetzung-2026-10-08.md'
old_handoff=handoff.read_text().split('\n\n## CP325 – gemeinsamer Hygiene-, Material- und Ausstattungsablauf')[0]
atomic(handoff,old_handoff+'\n\n## CP325 – gemeinsamer Hygiene-, Material- und Ausstattungsablauf\n\n'+c['checkpointSummary']+'\n\nEinzelheiten und verbleibende fachliche Grenzen: `docs/audit/ambulant-supply-workspace-cp325-2026-10-16.md`. Native CP324-Commits bdc71d07/59bea074 sind regulär integriert. Der erste fehlgeschlagene Gesamtlauf wird nicht als bestanden gezählt. Keine Abschwächung von Sitzungs-, Rechte- oder Abnahmekriterien.\n\nNächster großer Block: Personal, Qualifikation und Dienst-/Tourenplanung über die passenden Q/R-Aufgaben hinweg verbinden. Vor dem nächsten Eingriff neuesten kanonischen Stand und laufende private Zweige prüfen; keine ältere Fassung über neuere Inhalte speichern. Keine Installationen, produktiven Testdaten, Freigaben oder Veröffentlichung. Android bleibt unverändert.\n')
print(json.dumps({'checkpoint':CP,'fullNode':full,'targetedNode':targeted,'riskSession':risk,'accepted':json.loads(progress)['accepted'],'reached':json.loads(progress)['reached']}))
