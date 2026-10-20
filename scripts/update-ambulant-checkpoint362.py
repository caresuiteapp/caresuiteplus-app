#!/usr/bin/env python3
"""Record the connected V specialist review without changing acceptance."""
import json
from pathlib import Path

path=Path('docs/audit/ambulant-az-katalog-2026-10-08.json');catalog=json.loads(path.read_text())
if catalog.get('version')!=361:raise SystemExit('CP361 catalog required')
note=(' CP362: V-01 bis V-08 besitzen zusätzlich eine getrennte append-only '
      'Qualitätsmanagement-Fachprüfung. Anfrage, begründete Rückgabe und qualifizierte '
      'Annahme binden genau den vollständigen unveränderten Qualitätskopf, seine Vorgangsart '
      'und SHA-256. Spätere Fassungen erben keine Annahme. Anfragende sowie am gebundenen '
      'Verlauf beteiligte Personen entscheiden nicht selbst; aktuelles Recht, Beschäftigung, '
      'Qualifikation, Dokument und der Prüfbereich quality_management_review sind erforderlich. '
      'Browser-Lock, CAS, festes Journal und nur lesende Quittungswiederaufnahme bleiben getrennt. '
      '13/13 neue, 517/517 verbundene und 12491/12491 vollständige lokale Node-Fälle grün. '
      'SQL nur vorbereitet; reale Laufzeit- und qualifizierte Abnahmen bleiben offen.')
tasks=packets=0
for task in catalog['tasks']:
 if task['id'].startswith('V-'):
  if 'CP362:' in task['evidence']:raise SystemExit(f'CP362 already recorded: {task["id"]}')
  task['evidence']=task['evidence'].rstrip()+note;tasks+=1
for packet in catalog['packets']:
 if packet[0].startswith('V-P'):
  if 'CP362:' in packet[6]:raise SystemExit(f'CP362 already recorded: {packet[0]}')
  packet[6]=packet[6].rstrip()+note;packets+=1
if(tasks,packets)!=(8,3):raise SystemExit(f'Unexpected update counts: {tasks}/{packets}')
catalog['version']=362;catalog['date']='2026-10-17';catalog['checkpointSummary']=('CP362 ergänzt V-01 bis V-08 um eine eigene kopf-, art- und SHA-gebundene Qualitätsmanagement-Fachprüfung mit aktuellen Beschäftigungs-, Qualifikations-, Dokument- und Prüfbereichsoriginalen, Vier-Augen-Trennung und fester Quittungswiederaufnahme. 13/13 neue, 517/517 verbundene und 12491/12491 vollständige lokale Node-Fälle bestanden; SQL nur vorbereitet, reale Laufzeit und Abnahmen offen.');catalog['checkpointNodeLog']='docs/audit/checks/ambulant-node-checkpoint362-2026-10-17.log';path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checkpoint':362,'tasks':tasks,'packets':packets}))
