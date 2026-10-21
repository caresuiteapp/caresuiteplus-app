#!/usr/bin/env python3
from pathlib import Path
from xml.etree import ElementTree as ET
import json, sys, zipfile
import openpyxl

before_path, after_path, plan_path, report_path = map(Path, sys.argv[1:5])
plan = json.loads(plan_path.read_text())
assert plan['checkpoint'] == 330
planned = {(entry['sheet'], entry['address']): entry for entry in plan['edits']}
allowed_rows = {sheet: set(rows) for sheet, rows in plan['allowedRowHeightChanges'].items()}
before = openpyxl.load_workbook(before_path, data_only=False)
after = openpyxl.load_workbook(after_path, data_only=False)
assert before.sheetnames == after.sheetnames

def cell_signature(cell):
    return (cell.value, cell.data_type, cell.style_id, cell.number_format, str(cell.alignment),
            str(cell.border), str(cell.fill), str(cell.font), str(cell.protection),
            cell.hyperlink.target if cell.hyperlink else None,
            cell.comment.text if cell.comment else None)

changed = []
formula_count = 0
for sheet_name in before.sheetnames:
    old, new = before[sheet_name], after[sheet_name]
    assert old.max_row == new.max_row and old.max_column == new.max_column, sheet_name
    for row in range(1, max(old.max_row, new.max_row) + 1):
        for column in range(1, max(old.max_column, new.max_column) + 1):
            old_cell, new_cell = old.cell(row, column), new.cell(row, column)
            if isinstance(new_cell.value, str) and new_cell.value.startswith('='):
                formula_count += 1
            if cell_signature(old_cell) != cell_signature(new_cell):
                key = (sheet_name, new_cell.coordinate)
                assert key in planned, f'unplanned cell change {key}'
                assert old_cell.value == planned[key]['before'], key
                assert new_cell.value == planned[key]['value'], key
                assert cell_signature(old_cell)[1:] == cell_signature(new_cell)[1:], f'format changed {key}'
                changed.append(key)
    assert {str(item) for item in old.merged_cells.ranges} == {str(item) for item in new.merged_cells.ranges}
    assert str(old.freeze_panes) == str(new.freeze_panes)
    assert str(old.auto_filter.ref) == str(new.auto_filter.ref)
    assert sorted(old.tables.keys()) == sorted(new.tables.keys())
    assert str(old.sheet_view) == str(new.sheet_view)
    assert str(old.sheet_properties) == str(new.sheet_properties)
    assert str(old.page_setup) == str(new.page_setup)
    assert str(old.sheet_format) == str(new.sheet_format)
    assert {key: str(value) for key, value in old.column_dimensions.items()} == {key: str(value) for key, value in new.column_dimensions.items()}
    for row in set(old.row_dimensions) | set(new.row_dimensions):
        if str(old.row_dimensions[row]) != str(new.row_dimensions[row]):
            assert row in allowed_rows.get(sheet_name, set()), f'unplanned row height {sheet_name} {row}'
            assert old.row_dimensions[row].hidden == new.row_dimensions[row].hidden
    assert ET.tostring(old.data_validations.to_tree()) == ET.tostring(new.data_validations.to_tree()), f'data validations {sheet_name}'
    def conditional_formatting_signature(sheet):
        return [(str(key.sqref), [ET.tostring(rule.to_tree()) for rule in rules]) for key, rules in sheet.conditional_formatting._cf_rules.items()]
    assert conditional_formatting_signature(old) == conditional_formatting_signature(new), f'conditional formatting {sheet_name}'

assert set(changed) == set(planned), (len(changed), len(planned))
assert formula_count == 264, formula_count
accepted = 0
for row in range(9, 271):
    values = [after['Aufgaben'][f'{column}{row}'].value for column in 'HIJKLM']
    if (values[0] == 'Umgesetzt' and values[1] == 'Bestanden' and
            values[2] in ('Bestanden', 'Entfällt geprüft') and
            values[3] in ('Bestanden', 'Entfällt geprüft') and
            values[4] in ('Bestanden', 'Entfällt geprüft') and values[5] not in (None, '')):
        accepted += 1
assert accepted == 1
assert str(before.defined_names) == str(after.defined_names)
assert str(before.calculation) == str(after.calculation)
assert str(before.security) == str(after.security)

def relationships(path):
    result = []
    with zipfile.ZipFile(path) as archive:
        for name in sorted(item for item in archive.namelist() if item.endswith('.rels')):
            for relation in ET.fromstring(archive.read(name)):
                result.append((name, relation.attrib.get('Type'), relation.attrib.get('Target'), relation.attrib.get('TargetMode')))
    return result

assert relationships(before_path) == relationships(after_path)
report = {
    'checkpoint': 330,
    'changedCells': len(changed),
    'changedCellAddresses': [[sheet, address] for sheet, address in sorted(changed)],
    'rowHeightChanges': sum(len(rows) for rows in allowed_rows.values()),
    'formulasPreserved': formula_count,
    'acceptanceUnchanged': True,
    'stylesViewsRulesTablesNamesSettings': 'preserved outside planned edits',
    'relationships': 'same semantic targets and types',
    'errors': 0,
}
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False))
