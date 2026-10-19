"""Read-only source/workbook/progress/log consistency gate; no remote writes.

XLSX values and formulas are inspected, never authored. The milestone is
recomputed by the existing Node calculation before any output is created.
"""
import argparse
import hashlib
import json
import posixpath
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
DOCREL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKGREL = 'http://schemas.openxmlformats.org/package/2006/relationships'
NS = {'m': MAIN}
BOOK = 'CareSuite_Ambulant_A-Z_Arbeitsliste_2026-10-08.xlsx'


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key: ' + key)
        result[key] = value
    return result


def read_json(path):
    return json.loads(Path(path).read_text(), object_pairs_hook=unique_object)


def xml(archive, name):
    raw = archive.read(name)
    if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('Unexpected XML declaration: ' + name)
    return ET.fromstring(raw)


def text_content(element):
    return ''.join(t.text or '' for t in element.findall('m:t', NS)) + ''.join(
        t.text or '' for t in element.findall('m:r/m:t', NS))


def read_workbook(path):
    """Read native values and formulas through the actual sheet relationships."""
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError('Duplicate XLSX member')
        if archive.testzip() is not None:
            raise ValueError('XLSX CRC mismatch')
        shared = []
        if 'xl/sharedStrings.xml' in names:
            shared = [text_content(s) for s in xml(archive, 'xl/sharedStrings.xml')]
        relations = {}
        for item in xml(archive, 'xl/_rels/workbook.xml.rels'):
            if item.tag != '{' + PKGREL + '}Relationship' or item.get('Id') in relations:
                raise ValueError('Invalid workbook relationship')
            relations[item.get('Id')] = item
        result = {}
        for sheet in xml(archive, 'xl/workbook.xml').findall('m:sheets/m:sheet', NS):
            name = sheet.get('name')
            relation = relations.get(sheet.get('{' + DOCREL + '}id'))
            if name in result or relation is None or relation.get('TargetMode') == 'External' or relation.get('Type') != DOCREL + '/worksheet':
                raise ValueError('Invalid sheet relationship')
            target = relation.get('Target', '')
            if not target or '\\' in target or ':' in target:
                raise ValueError('Invalid worksheet target')
            target = posixpath.normpath(target.lstrip('/') if target.startswith('/') else 'xl/' + target)
            if not target.startswith('xl/') or target not in names:
                raise ValueError('Worksheet target outside workbook')
            cells = {}
            for row in xml(archive, target).findall('m:sheetData/m:row', NS):
                for cell in row.findall('m:c', NS):
                    address = cell.get('r', '')
                    if not re.fullmatch(r'[A-Z]+[1-9][0-9]*', address) or address in cells:
                        raise ValueError('Invalid or duplicate cell address')
                    value_element = cell.find('m:v', NS)
                    value = (value_element.text or '') if value_element is not None else ''
                    kind = cell.get('t', 'n')
                    if kind == 's':
                        if not re.fullmatch(r'[0-9]+', value) or int(value) >= len(shared):
                            raise ValueError('Invalid shared string index')
                        value = shared[int(value)]
                    elif kind == 'inlineStr':
                        inline = cell.find('m:is', NS)
                        if inline is None:
                            raise ValueError('Missing inline string')
                        value = text_content(inline)
                    elif kind == 'e':
                        raise ValueError('Workbook formula error at ' + name + '!' + address)
                    elif kind not in ('n', 'str', 'b', 'd'):
                        raise ValueError('Unknown native cell type')
                    formula = cell.find('m:f', NS)
                    cells[address] = (value, None if formula is None else formula.text or '')
            result[name] = cells
        if list(result) != ['Aufgaben', 'Pakete', 'Abnahme', 'Quellen']:
            raise ValueError('Unexpected workbook sheet structure')
        return result


def node_summary(text):
    text = re.sub(r'\x1b\[[0-9;]*m', '', text)
    summary = {}
    for key in ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'):
        matches = re.findall(r'^(?:ℹ|#) ' + key + r' ([0-9]+)\s*$', text, re.M)
        if len(matches) != 1:
            raise ValueError('Expected one complete Node summary: ' + key)
        summary[key] = int(matches[0])
    if summary['tests'] <= 0 or summary['pass'] != summary['tests'] or any(summary[k] for k in ('fail', 'cancelled', 'skipped', 'todo')):
        raise ValueError('Node run is incomplete, failing, skipped or cancelled')
    return summary


def verify_inputs(root, workbook, catalog_path=None, progress_path=None, log_path=None):
    root = Path(root).resolve()
    workbook = Path(workbook).resolve()
    catalog_path = Path(catalog_path or root / 'docs/audit/ambulant-az-katalog-2026-10-08.json').resolve()
    progress_path = Path(progress_path or root / 'docs/audit/checks/ambulant-50-prozent-2026-10-08.json').resolve()
    catalog = read_json(catalog_path)
    version = catalog.get('version')
    if type(version) is not int or version <= 0:
        raise ValueError('Invalid checkpoint version')
    if log_path is None:
        declared = catalog.get('checkpointNodeLog')
        if declared is not None:
            if not isinstance(declared, str) or not re.fullmatch(r'docs/audit/checks/ambulant-node-checkpoint' + str(version) + r'-[A-Za-z0-9_-]+\.log', declared):
                raise ValueError('Invalid declared checkpoint Node log')
            log_path = (root / declared).resolve()
            if log_path.parent != (root / 'docs/audit/checks').resolve():
                raise ValueError('Declared checkpoint log outside audit checks')
        else:
            logs = list((root / 'docs/audit/checks').glob(f'ambulant-node-checkpoint{version}-*.log'))
            if len(logs) != 1:
                raise ValueError('Expected one full Node log for this checkpoint')
            log_path = logs[0]
    summary = node_summary(Path(log_path).read_text())
    computed = subprocess.check_output([
        'node', str(root / 'scripts/checks/ambulant-milestone-progress.mjs'), str(catalog_path)
    ], cwd=root, text=True)
    progress = json.loads(computed)
    saved_progress = read_json(progress_path)
    canonical = lambda value: json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    if canonical(progress) != canonical(saved_progress):
        raise ValueError('Saved milestone does not match the current source catalog')
    sheets = read_workbook(workbook)
    mismatches = []

    def expect(sheet, address, expected, formula=None):
        actual, actual_formula = sheets[sheet].get(address, ('', None))
        if actual != str(expected) or actual_formula != formula:
            mismatches.append(sheet + '!' + address)

    def exact_ids(sheet, pattern, expected):
        actual = [value for address, (value, _) in sheets[sheet].items() if re.fullmatch(r'A[1-9][0-9]*', address) and re.fullmatch(pattern, value)]
        if len(expected) != len(set(expected)) or sorted(actual) != sorted(expected):
            raise ValueError('Missing, extra or duplicate identities in ' + sheet)

    tasks = catalog['tasks']
    exact_ids('Aufgaben', r'[A-Z]-[0-9]{2}', [t['id'] for t in tasks])
    for row, task in enumerate(tasks, 9):
        values = [task['id'], task['id'][0] + ' ' + task['area'], task['title'], task['data'], task['criterion'], task['packet'], task['depends'], task['implementation'], task['function'], task['care'], task['design'], task['legal'], task['evidence']]
        for column, value in zip('ABCDEFGHIJKLM', values):
            expect('Aufgaben', column + str(row), value)
        accepted = task['implementation'] == 'Umgesetzt' and task['function'] == 'Bestanden' and all(task[k] in ('Bestanden', 'Entfällt geprüft') for k in ('care', 'design', 'legal')) and bool(task['evidence'].strip())
        formula = f'IF(AND(H{row}="Umgesetzt",I{row}="Bestanden",OR(J{row}="Bestanden",J{row}="Entfällt geprüft"),OR(K{row}="Bestanden",K{row}="Entfällt geprüft"),OR(L{row}="Bestanden",L{row}="Entfällt geprüft"),M{row}<>""),"Abgenommen","Offen")'
        expect('Aufgaben', 'N' + str(row), 'Abgenommen' if accepted else 'Offen', formula)
        expect('Aufgaben', 'O' + str(row), task['next'])
    expect('Aufgaben', 'B4', progress['accepted'], 'COUNTIFS(N9:N270,"Abgenommen")')
    expect('Aufgaben', 'E4', progress['total'] - progress['accepted'], 'COUNTIFS(N9:N270,"Offen")')
    for sheet, key, pattern, first, columns in [
        ('Pakete', 'packets', r'[A-Z]-P[0-9]{2}', 8, 'ABCDEFGH'),
        ('Abnahme', 'gates', r'G[0-9]{2}', 7, 'ABCD'),
        ('Quellen', 'sources', r'Q[0-9]{2}', 6, 'ABCDEF'),
    ]:
        rows = catalog[key]
        exact_ids(sheet, pattern, [row[0] for row in rows])
        for number, values in enumerate(rows, first):
            if len(values) != len(columns):
                raise ValueError('Invalid catalog row in ' + key)
            for column, value in zip(columns, values):
                expect(sheet, column + str(number), value)
    if mismatches:
        raise ValueError(f'Workbook/source mismatch in {len(mismatches)} cells: ' + ', '.join(mismatches[:12]))
    return {
        'checkpoint': version, 'tasks': len(tasks), 'packets': len(catalog['packets']),
        'gates': len(catalog['gates']), 'sources': len(catalog['sources']),
        'accepted': progress['accepted'], 'goalReached': progress['reached'],
        'nodeTests': summary['pass'], 'catalogSha256': hashlib.sha256(catalog_path.read_bytes()).hexdigest(),
        'nodeLogSha256': hashlib.sha256(Path(log_path).read_bytes()).hexdigest(),
        'workbookSha256': hashlib.sha256(workbook.read_bytes()).hexdigest(),
        'consistency': 'matched', 'scope': 'local source/workbook/progress/log consistency; no clinical or live-system acceptance',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook', type=Path)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--catalog', type=Path)
    parser.add_argument('--progress', type=Path)
    parser.add_argument('--log', type=Path)
    args = parser.parse_args()
    try:
        result = verify_inputs(args.root, args.workbook, args.catalog, args.progress, args.log)
    except (ValueError, KeyError, TypeError, IndexError, OSError, zipfile.BadZipFile, ET.ParseError, subprocess.SubprocessError) as error:
        parser.exit(1, str(error) + '\n')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
