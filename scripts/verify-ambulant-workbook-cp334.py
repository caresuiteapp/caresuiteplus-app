from __future__ import annotations
import json,re,sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

old_path,new_path=map(Path,sys.argv[1:3]);NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
def local(value:str)->str:return value.rsplit('}',1)[-1]
def signature(node:ET.Element):
    attrs=tuple(sorted((local(k),'REL'if k.startswith('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}')and local(k)=='id'else v)for k,v in node.attrib.items()))
    return(local(node.tag),attrs,(node.text or '').strip(),tuple(signature(child)for child in node))
def load(zip_file:ZipFile,name:str):return ET.fromstring(zip_file.read(name))
def cell_value(cell:ET.Element):
    formula=cell.find(f'{NS}f');value=cell.find(f'{NS}v');inline=cell.find(f'{NS}is')
    text=''.join(inline.itertext())if inline is not None else(value.text if value is not None else'')
    return(cell.attrib.get('s'),cell.attrib.get('t'),formula.text if formula is not None else None,text)
def row_map(root:ET.Element):return{int(row.attrib['r']):row for row in root.find(f'{NS}sheetData')}
def cells(row:ET.Element):return{cell.attrib['r']:cell_value(cell)for cell in row.findall(f'{NS}c')}
def without_sheet_data(root:ET.Element):return tuple(signature(child)for child in root if local(child.tag)!='sheetData')
def relationship_targets(root:ET.Element):return sorted(tuple(sorted((local(k),v)for k,v in child.attrib.items()if local(k)!='Id'))for child in root)
def workbook_targets(zip_file:ZipFile):
    rels=load(zip_file,'xl/_rels/workbook.xml.rels');by_id={child.attrib['Id']:child.attrib['Target']for child in rels}
    root=load(zip_file,'xl/workbook.xml');return[(sheet.attrib['name'],sheet.attrib['sheetId'],by_id[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']])for sheet in root.find(f'{NS}sheets')]
def compare_sheet(old_root:ET.Element,new_root:ET.Element,target_rows:set[int],allowed:set[str],height:float):
    if without_sheet_data(old_root)!=without_sheet_data(new_root):raise AssertionError('Arbeitsblattstruktur außerhalb der Zeilendaten geändert')
    old_rows,new_rows=row_map(old_root),row_map(new_root)
    if old_rows.keys()!=new_rows.keys():raise AssertionError('Zeilenbestand geändert')
    changed=[]
    for number in old_rows:
        old_row,new_row=old_rows[number],new_rows[number]
        old_attrs={local(k):v for k,v in old_row.attrib.items()};new_attrs={local(k):v for k,v in new_row.attrib.items()}
        if number in target_rows:
            for key in('ht','customHeight'):old_attrs.pop(key,None);new_attrs.pop(key,None)
            if old_attrs!=new_attrs:raise AssertionError(f'Zeilenattribute {number} unerwartet geändert')
            if float(new_row.attrib.get('ht','0'))!=height or new_row.attrib.get('customHeight')!='1':raise AssertionError(f'Zeilenhöhe {number} ist nicht {height}')
        elif old_attrs!=new_attrs:raise AssertionError(f'Unbeteiligte Zeile {number} geändert')
        old_cells,new_cells=cells(old_row),cells(new_row)
        if old_cells.keys()!=new_cells.keys():raise AssertionError(f'Zellbestand in Zeile {number} geändert')
        for ref in old_cells:
            if old_cells[ref]!=new_cells[ref]:
                if ref not in allowed:raise AssertionError(f'Unzulässige Zelländerung {ref}')
                changed.append(ref)
    return changed

with ZipFile(old_path)as old,ZipFile(new_path)as new:
    if set(old.namelist())!=set(new.namelist()):raise AssertionError('Paketbestand geändert')
    if workbook_targets(old)!=workbook_targets(new):raise AssertionError('Arbeitsblattbeziehungen geändert')
    for name in old.namelist():
        if name in('xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml'):continue
        if name in('xl/workbook.xml','xl/_rels/workbook.xml.rels'):continue
        if name.endswith('.rels'):
            if relationship_targets(load(old,name))!=relationship_targets(load(new,name)):raise AssertionError(f'Native Beziehung geändert: {name}')
        elif signature(load(old,name))!=signature(load(new,name)):raise AssertionError(f'Native Eigenschaft geändert: {name}')
    task_rows=set(range(231,243));packet_rows=set(range(91,95))
    task_allowed={f'{column}{row}'for row in task_rows for column in('M','O')};packet_allowed={f'{column}{row}'for row in packet_rows for column in('G','H')}
    task_changes=compare_sheet(load(old,'xl/worksheets/sheet1.xml'),load(new,'xl/worksheets/sheet1.xml'),task_rows,task_allowed,300.0)
    packet_changes=compare_sheet(load(old,'xl/worksheets/sheet2.xml'),load(new,'xl/worksheets/sheet2.xml'),packet_rows,packet_allowed,300.0)
    if set(task_changes)!=task_allowed or set(packet_changes)!=packet_allowed:raise AssertionError('Nicht genau die 32 vorgesehenen Zellen geändert')
    formulas=0
    for name in('xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml','xl/worksheets/sheet3.xml','xl/worksheets/sheet4.xml'):
        formulas+=sum(1 for cell in load(new,name).iter(f'{NS}c')if cell.find(f'{NS}f')is not None)
print(json.dumps({'parts':19,'changedCells':32,'taskRows':12,'packetRows':4,'rowHeights':16,'formulaCount':formulas,'otherCellsAndNativeProperties':'unchanged'},ensure_ascii=False))
