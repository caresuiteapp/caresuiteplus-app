#!/usr/bin/env python3
"""Record the exact CP346-CP358 recovery without changing acceptance."""
import json
from pathlib import Path

path = Path('docs/audit/ambulant-az-katalog-2026-10-08.json')
catalog = json.loads(path.read_text())
if catalog.get('version') != 359:
    raise SystemExit('CP359 catalog required')

old = ('CP359-Rekonstruktion: gemeinsamer H–T-Fachprüfvertrag mit 13 getrennten Bereichen, '
       'vollständigen Quellkollektionen, Vier-Augen-Ausschluss und fester Quittungswiederaufnahme; '
       '63/63 neue und 12192/12192 vollständige lokale Node-Fälle grün. Native Server-/UI-Bindung offen.')
new = ('CP359/CP360: gemeinsamer H–T-Fachprüfvertrag und die exakten privaten CP346–CP358-'
       'SQL-/Writer-/UI-Pfade samt historischen Belegen aus dem verifizierten Branch vollständig '
       'integriert; 12463/12463 vollständige lokale Node-Fälle grün. Reale Laufzeit- und '
       'qualifizierte Fachabnahmen bleiben offen.')

changed_tasks = changed_packets = 0
for task in catalog['tasks']:
    if task['id'][0] not in 'HIJKLMNOPQRST':
        continue
    if not task['evidence'].endswith(old):
        raise SystemExit(f"Unexpected CP359 task evidence: {task['id']}")
    task['evidence'] = task['evidence'][:-len(old)] + new
    changed_tasks += 1
for packet in catalog['packets']:
    if packet[0][0] not in 'HIJKLMNOPQRST':
        continue
    if not packet[6].endswith(old):
        raise SystemExit(f'Unexpected CP359 packet evidence: {packet[0]}')
    packet[6] = packet[6][:-len(old)] + new
    changed_packets += 1

if (changed_tasks, changed_packets) != (134, 50):
    raise SystemExit(f'Unexpected update counts: {changed_tasks}/{changed_packets}')
catalog['version'] = 360
catalog['checkpointSummary'] = (
    'CP360 integriert die exakten privaten CP346–CP358-H–T-Produktpfade und ihre historischen '
    'Nachweise aus dem verifizierten, alternates-freien Restore zusätzlich zum gemeinsamen '
    'CP359-Vertrag. Lokale Gesamtprüfung 12463/12463; reale Laufzeit- und Abnahmen offen.'
)
catalog['checkpointNodeLog'] = 'docs/audit/checks/ambulant-node-checkpoint360-2026-10-17-exact-recovery.log'
path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'checkpoint': 360, 'tasks': changed_tasks, 'packets': changed_packets}))
