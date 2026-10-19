#!/usr/bin/env python3
"""Record the connected U specialist review without changing acceptance."""
import json
from pathlib import Path

path = Path('docs/audit/ambulant-az-katalog-2026-10-08.json')
catalog = json.loads(path.read_text())
if catalog.get('version') != 360:
    raise SystemExit('CP360 catalog required')

note = (
    ' CP361: U-01 bis U-12 besitzen zusätzlich eine getrennte append-only '
    'Abrechnungs-/Forderungsfachprüfung. Anfrage, begründete Rückgabe und qualifizierte '
    'Annahme binden genau den vollständigen unveränderten Abrechnungskopf, seine Vorgangsart '
    'und SHA-256. Spätere Fassungen erben keine Annahme. Anfragende sowie am gebundenen '
    'Verlauf beteiligte Personen entscheiden nicht selbst; aktuelles Recht, Beschäftigung, '
    'Qualifikation, Dokument und der Prüfbereich billing_accounting_review sind erforderlich. '
    'Browser-Lock, CAS, festes Journal und nur lesende Quittungswiederaufnahme bleiben getrennt. '
    '15/15 neue und 12478/12478 vollständige lokale Node-Fälle grün. SQL nur vorbereitet; '
    'reale Laufzeit- und qualifizierte Abnahmen bleiben offen.'
)

changed_tasks = changed_packets = 0
for task in catalog['tasks']:
    if task['id'].startswith('U-'):
        if 'CP361:' in task['evidence']:
            raise SystemExit(f'CP361 already recorded: {task["id"]}')
        task['evidence'] = task['evidence'].rstrip() + note
        changed_tasks += 1
for packet in catalog['packets']:
    if packet[0].startswith('U-P'):
        if 'CP361:' in packet[6]:
            raise SystemExit(f'CP361 already recorded: {packet[0]}')
        packet[6] = packet[6].rstrip() + note
        changed_packets += 1

if (changed_tasks, changed_packets) != (12, 4):
    raise SystemExit(f'Unexpected update counts: {changed_tasks}/{changed_packets}')
catalog['version'] = 361
catalog['date'] = '2026-10-17'
catalog['checkpointSummary'] = (
    'CP361 ergänzt U-01 bis U-12 um eine eigene kopf-, art- und SHA-gebundene '
    'Abrechnungs-/Forderungsfachprüfung mit aktuellen Beschäftigungs-, Qualifikations-, '
    'Dokument- und Prüfbereichsoriginalen, Vier-Augen-Trennung und fester '
    'Quittungswiederaufnahme. 15/15 neue und 12478/12478 vollständige lokale Node-Fälle '
    'bestanden; SQL nur vorbereitet, reale Laufzeit und Abnahmen offen.'
)
catalog['checkpointNodeLog'] = 'docs/audit/checks/ambulant-node-checkpoint361-2026-10-17.log'
path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'checkpoint': 361, 'tasks': changed_tasks, 'packets': changed_packets}))
