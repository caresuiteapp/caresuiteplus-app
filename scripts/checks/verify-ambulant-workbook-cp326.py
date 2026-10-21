#!/usr/bin/env python3
from pathlib import Path
from copy import copy
from xml.etree import ElementTree as ET
import json, sys, zipfile
import openpyxl

before_path, after_path, plan_path, report_path = map(Path, sys.argv[1:5])
plan = json.loads(plan_path.read_text())
assert plan['checkpoint'] == 326
planned = {(e['sheet'], e['address']): e for e in plan['edits']}
allowed_rows = {k: set(v) for k, v in plan['allowedRowHeightChanges'].items()}
before = openpyxl.load_workbook(before_path, data_only=False)
after = openpyxl.load_workbook(after_path, data_only=False)
assert before.sheetnames == after.sheetnames

def cell_signature(c):
    return (c.value, c.data_type, c.style_id, c.number_format, str(c.alignment), str(c.border),
            str(c.fill), str(c.font), str(c.protection), c.hyperlink.target if c.hyperlink else None,
            c.comment.text if c.comment else None)

changed=[]
formula_count=0
for sheet_name in before.sheetnames:
    a,b=before[sheet_name],after[sheet_name]
    assert a.max_row==b.max_row and a.max_column==b.max_column, sheet_name
    for row in range(1,max(a.max_row,b.max_row)+1):
        for col in range(1,max(a.max_column,b.max_column)+1):
            ca,cb=a.cell(row,col),b.cell(row,col)
            if isinstance(cb.value,str) and cb.value.startswith('='): formula_count+=1
            if cell_signature(ca)!=cell_signature(cb):
                key=(sheet_name,cb.coordinate)
                assert key in planned, f'unplanned cell change {key}'
                assert ca.value==planned[key]['before'], key
                assert cb.value==planned[key]['value'], key
                assert cell_signature(ca)[1:]==cell_signature(cb)[1:], f'format changed {key}'
                changed.append(key)
    assert {str(r) for r in a.merged_cells.ranges}=={str(r) for r in b.merged_cells.ranges}
    assert str(a.freeze_panes)==str(b.freeze_panes)
    assert str(a.auto_filter.ref)==str(b.auto_filter.ref)
    assert sorted(a.tables.keys())==sorted(b.tables.keys())
    assert str(a.sheet_view)==str(b.sheet_view)
    assert str(a.sheet_properties)==str(b.sheet_properties)
    assert str(a.page_setup)==str(b.page_setup)
    assert str(a.sheet_format)==str(b.sheet_format)
    assert {k:str(v) for k,v in a.column_dimensions.items()}=={k:str(v) for k,v in b.column_dimensions.items()}
    all_rows=set(a.row_dimensions)|set(b.row_dimensions)
    for row in all_rows:
        if str(a.row_dimensions[row])!=str(b.row_dimensions[row]):
            assert row in allowed_rows.get(sheet_name,set()), f'unplanned row height {sheet_name} {row}'
            assert a.row_dimensions[row].hidden==b.row_dimensions[row].hidden
    assert ET.tostring(a.data_validations.to_tree())==ET.tostring(b.data_validations.to_tree()), f'data validations {sheet_name}'
    def cf_signature(sheet):
        return [(str(key.sqref), [ET.tostring(rule.to_tree()) for rule in rules])
                for key, rules in sheet.conditional_formatting._cf_rules.items()]
    assert cf_signature(a)==cf_signature(b), f'conditional formatting {sheet_name}'

assert set(changed)==set(planned), (len(changed),len(planned))
assert formula_count==264, formula_count
accepted=0
for row in range(9,271):
    values=[after['Aufgaben'][f'{col}{row}'].value for col in 'HIJKLM']
    if (values[0]=='Umgesetzt' and values[1]=='Bestanden' and
        values[2] in ('Bestanden','Entfällt geprüft') and values[3] in ('Bestanden','Entfällt geprüft') and
        values[4] in ('Bestanden','Entfällt geprüft') and values[5] not in (None,'')):
        accepted+=1
assert accepted==1
assert str(before.defined_names)==str(after.defined_names)
assert str(before.calculation)==str(after.calculation)
assert str(before.security)==str(after.security)

def relationships(path):
    out=[]
    with zipfile.ZipFile(path) as z:
        for name in sorted(n for n in z.namelist() if n.endswith('.rels')):
            root=ET.fromstring(z.read(name))
            for rel in root:
                out.append((name,rel.attrib.get('Type'),rel.attrib.get('Target'),rel.attrib.get('TargetMode')))
    return out
assert relationships(before_path)==relationships(after_path)

report={
  'checkpoint':326,'changedCells':len(changed),
  'changedCellAddresses':[[s,a] for s,a in sorted(changed)],
  'rowHeightChanges':sum(len(v) for v in allowed_rows.values()),
  'formulasPreserved':formula_count,'acceptanceUnchanged':True,
  'stylesViewsRulesTablesNamesSettings':'preserved outside planned edits',
  'relationships':'same semantic targets and types','errors':0
}
report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
