"""Record the regularly merged private P/Q source and actual combined verification."""
from pathlib import Path
import importlib.util,json,os,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
PRIVATE=Path(sys.argv[1]).resolve()
spec=importlib.util.spec_from_file_location('gate',ROOT/'scripts/verify-ambulant-checkpoint-inputs.py')
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
full=gate.node_summary((PRIVATE/'combined-full-11412.log').read_text())
connected=gate.node_summary((PRIVATE/'combined-pq-229.log').read_text())
assert full['tests']==11412 and connected['tests']==229
def atomic(path,text):
    tmp=path.with_name(path.name+'.cp327.tmp');tmp.write_text(text);os.replace(tmp,path)
catalog=ROOT/'docs/audit/ambulant-az-katalog-2026-10-08.json'
c=json.loads(catalog.read_text());assert c['version']==326
for task in c['tasks']:
    if task['id'][0] not in ('P','Q'):continue
    assert all(task[k]=='Offen' for k in ('care','design','legal'))
    task['evidence']=task['evidence'].replace('CP325:','CP325/327:').replace('CP326:','CP326/327:').replace('11390/11390','11412/11412').replace('11410/11410','11412/11412').replace('98/98','99/99')
    task['next']=task['next'].replace('Nächster großer Block: Personal/Qualifikation und Dienst-/Tourenplanung gemäß Q/R-Katalog.','Nächster großer Block: Dienst-/Tourenplanung gemäß R-Katalog mit dem vorhandenen Personalablauf verbinden.')
for packet in c['packets']:
    if packet[0][0] not in ('P','Q'):continue
    packet[6]=packet[6].replace('CP325 verbindet','CP325/327 verbindet').replace('CP326 verbindet','CP326/327 verbindet').replace('11390/11390','11412/11412').replace('11410/11410','11412/11412').replace('98/98','99/99')
c['version']=327
c['checkpointNodeLog']='docs/audit/checks/ambulant-node-checkpoint327-2026-10-16-combined-pq.log'
c['checkpointSummary']='CP327: Die vollständigen privaten P-01–P-10- und Q-01–Q-10-Arbeitswege sind regulär zusammengeführt. 19 Material-/Hygiene-/Geräte-/Hauswirtschafts-/Schlüsselereignisse und 13 Personal-/Qualifikations-/Delegations-/Vertretungs-/Abwesenheits-/Rückkehrereignisse sind enthalten. CP324 0151d6b5, CP325 einschließlich a4be68d2/50cadb38 und CP326 192bb479 bleiben im Git-Verlauf erhalten. 11412/11412 im vollständigen gemeinsamen Node-Lauf sowie 229/229 verbundene Fälle bestanden; davon 77 P-, 22 Q-, 68 Fallübergabe-, 28 ältere Übergabe- und 34 Beratungsfälle. 17 betroffene TS-/TSX-Dateien wurden syntaktisch geprüft; keine semantische Typ- oder Browserprüfung. SQL vorbereitet und nicht ausgeführt. Tatsächliche SDK-/PostgreSQL-/RLS-/Browser- und qualifizierte Pflege-/Design-/Datenschutz-/Rechts-/Betriebsabnahmen bleiben offen. 260 Aufgaben begonnen, eine vollständig abgenommen, reached=false. Nächster großer Block: R-01–R-10 als verbundene Dienst-/Tourenplanung mit dem vorhandenen Personalablauf.'
atomic(catalog,json.dumps(c,ensure_ascii=False,indent=2)+'\n')
checks=ROOT/'docs/audit/checks'
for source,destination in [('combined-full-11412.log',Path(c['checkpointNodeLog']).name),('combined-pq-229.log','ambulant-connected-checkpoint327-2026-10-16.log'),('syntax-combined.json','ambulant-syntax-checkpoint327-2026-10-16.json')]:
    atomic(checks/destination,(PRIVATE/source).read_text())
progress=subprocess.check_output(['node','scripts/checks/ambulant-milestone-progress.mjs'],cwd=ROOT,text=True)
atomic(checks/'ambulant-50-prozent-2026-10-08.json',progress)
atomic(checks/'ambulant-milestone-checkpoint327-2026-10-16.json',progress)
handoff=ROOT/'docs/audit/ambulant-fortsetzung-2026-10-08.md'
atomic(handoff,handoff.read_text()+'\n\n## CP327 – gemeinsamer Material- und Personalstand\n\n'+c['checkpointSummary']+'\n\nDie vorherigen P-/Q-Rohprotokolle und Abnahmegrenzen bleiben erhalten. Der gemeinsame Testlauf prüft die zusammengeführten privaten Quellen; eine fachliche Relation zwischen Qualifikation und tatsächlich erlaubter Touren-/Pflegeausführung entsteht daraus nicht automatisch. Nichts wurde produktiv ausgeführt, veröffentlicht oder neu abgenommen. Vor jedem Speichern aktuellen kanonischen Stand und laufende Arbeit prüfen.\n')
print(json.dumps({'checkpoint':327,'fullNode':full,'connectedNode':connected,'accepted':json.loads(progress)['accepted'],'reached':json.loads(progress)['reached']}))
