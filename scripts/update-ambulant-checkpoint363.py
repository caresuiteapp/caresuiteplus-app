#!/usr/bin/env python3
"""Record the connected V specialist review without changing acceptance."""
import json
from pathlib import Path

path=Path('docs/audit/ambulant-az-katalog-2026-10-08.json');catalog=json.loads(path.read_text())
if catalog.get('version')!=362:raise SystemExit('CP362 catalog required')
note=(' CP363: W-01 bis W-12 besitzen zusätzlich eine getrennte append-only '
      'Kommunikations- und Koordinationsfachprüfung. Anfrage, begründete Rückgabe und qualifizierte '
      'Annahme binden genau den vollständigen unveränderten Kommunikationskopf, seine Vorgangsart '
      'und SHA-256. Spätere Fassungen erben keine Annahme. Anfragende sowie am gebundenen '
      'Verlauf beteiligte Personen entscheiden nicht selbst; aktuelles Recht, Beschäftigung, '
      'Qualifikation, Dokument und der Prüfbereich communication_coordination_review sind erforderlich. '
      'Browser-Lock, CAS, festes Journal und nur lesende Quittungswiederaufnahme bleiben getrennt. '
      '13/13 neue, 333/333 verbundene und 12504/12504 vollständige lokale Node-Fälle grün. '
      'SQL nur vorbereitet; reale Laufzeit- und qualifizierte Abnahmen bleiben offen.')
tasks=packets=0
for task in catalog['tasks']:
 if task['id'].startswith('W-'):
  if 'CP363:' in task['evidence']:raise SystemExit(f'CP363 already recorded: {task["id"]}')
  task['evidence']=task['evidence'].rstrip()+note;tasks+=1
for packet in catalog['packets']:
 if packet[0].startswith('W-P'):
  if 'CP363:' in packet[6]:raise SystemExit(f'CP363 already recorded: {packet[0]}')
  packet[6]=packet[6].rstrip()+note;packets+=1
if(tasks,packets)!=(12,4):raise SystemExit(f'Unexpected update counts: {tasks}/{packets}')
catalog['version']=363;catalog['date']='2026-10-17';catalog['checkpointSummary']=('CP363 ergänzt W-01 bis W-12 um eine eigene kopf-, art- und SHA-gebundene Kommunikations- und Koordinationsfachprüfung mit aktuellen Beschäftigungs-, Qualifikations-, Dokument- und Prüfbereichsoriginalen, Vier-Augen-Trennung und fester Quittungswiederaufnahme. 13/13 neue, 333/333 verbundene und 12504/12504 vollständige lokale Node-Fälle bestanden; SQL nur vorbereitet, reale Laufzeit und Abnahmen offen.');catalog['checkpointNodeLog']='docs/audit/checks/ambulant-node-checkpoint363-2026-10-17.log';path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checkpoint':363,'tasks':tasks,'packets':packets}))
