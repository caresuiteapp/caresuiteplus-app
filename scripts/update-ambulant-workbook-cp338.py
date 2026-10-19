from __future__ import annotations

import json
import re
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

SOURCE = Path('/dev/shm/cp337-final/CareSuite_Ambulant_A-Z_Arbeitsliste_2026-10-08.xlsx')
OUTPUT = Path('/dev/shm/cp338-work/CareSuite_Ambulant_A-Z_Arbeitsliste_2026-10-08.xlsx')
CATALOG = Path('docs/audit/ambulant-az-katalog-2026-10-08.json')
TASK_IDS = tuple(f'A-{number:02d}' for number in range(1, 9))
PACKET_IDS = ('A-P01', 'A-P02', 'A-P03')


def replace_cell_value(sheet: bytes, reference: str, value: str) -> bytes:
    pattern = re.compile(
        rb'(<x:c\b[^>]*\br="' + re.escape(reference.encode()) + rb'"[^>]*>\s*<x:v>)(.*?)(</x:v>\s*</x:c>)'
    )
    encoded = escape(value).encode()
    sheet, count = pattern.subn(lambda match: match.group(1) + encoded + match.group(3), sheet, count=1)
    if count != 1:
        raise RuntimeError(f'Zelle {reference} wurde nicht eindeutig gefunden.')
    return sheet


def replace_row_height(sheet: bytes, row: int, height: str = '300') -> bytes:
    row_pattern = re.compile(rb'(<x:row\b[^>]*\br="' + str(row).encode() + rb'"[^>]*>)')
    match = row_pattern.search(sheet)
    if not match:
        raise RuntimeError(f'Zeile {row} wurde nicht gefunden.')
    tag = match.group(1)
    if b' ht="' in tag:
        replacement = re.sub(rb'\bht="[^"]*"', f'ht="{height}"'.encode(), tag, count=1)
    else:
        replacement = tag[:-1] + f' ht="{height}" customHeight="1">'.encode()
    if b'customHeight=' not in replacement:
        replacement = replacement[:-1] + b' customHeight="1">'
    return sheet[: match.start(1)] + replacement + sheet[match.end(1) :]


catalog = json.loads(CATALOG.read_text())
tasks = {row['id']: row for row in catalog['tasks'] if row['id'] in TASK_IDS}
packets = {row[0]: row for row in catalog['packets'] if row[0] in PACKET_IDS}
if set(tasks) != set(TASK_IDS) or set(packets) != set(PACKET_IDS):
    raise RuntimeError('A-Aufgaben oder A-Pakete fehlen im Katalog.')

cell_values: list[tuple[str, str, str]] = []
for offset, task_id in enumerate(TASK_IDS, start=9):
    cell_values.extend((('sheet1', f'M{offset}', tasks[task_id]['evidence']), ('sheet1', f'O{offset}', tasks[task_id]['next'])))
for offset, packet_id in enumerate(PACKET_IDS, start=8):
    packet = packets[packet_id]
    cell_values.extend((('sheet2', f'G{offset}', packet[6]), ('sheet2', f'H{offset}', packet[7])))

with ZipFile(SOURCE, 'r') as archive:
    infos = archive.infolist()
    members = {info.filename: archive.read(info.filename) for info in infos}

sheets = {
    'sheet1': members['xl/worksheets/sheet1.xml'],
    'sheet2': members['xl/worksheets/sheet2.xml'],
}
for sheet, reference, value in cell_values:
    sheets[sheet] = replace_cell_value(sheets[sheet], reference, value)
for row in range(9, 17):
    sheets['sheet1'] = replace_row_height(sheets['sheet1'], row)
for row in range(8, 11):
    sheets['sheet2'] = replace_row_height(sheets['sheet2'], row)
members['xl/worksheets/sheet1.xml'] = sheets['sheet1']
members['xl/worksheets/sheet2.xml'] = sheets['sheet2']

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(OUTPUT, 'w', compression=ZIP_DEFLATED, compresslevel=6) as archive:
    for info in infos:
        archive.writestr(info, members[info.filename])

print(json.dumps({'output': str(OUTPUT), 'changedCells': len(cell_values), 'changedRowHeights': 11}, ensure_ascii=False))
