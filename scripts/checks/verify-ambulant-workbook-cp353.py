"""Verify CP353 workbook edits against the CP352 source workbook."""
from __future__ import annotations
import argparse,json,posixpath,re,xml.etree.ElementTree as ET,zipfile
from pathlib import Path

MAIN="http://schemas.openxmlformats.org/spreadsheetml/2006/main";DOCREL="http://schemas.openxmlformats.org/officeDocument/2006/relationships";NS={"m":MAIN}
TASK_ROWS=set(range(151,159));PACKET_ROWS=set(range(61,64))
ALLOWED={"Aufgaben":{*(f"M{row}" for row in TASK_ROWS),*(f"O{row}" for row in TASK_ROWS)},"Pakete":{f"G{row}" for row in PACKET_ROWS}}
def xml(archive,name):
 raw=archive.read(name)
 if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():raise ValueError(f"Unsafe XML declaration in {name}")
 return ET.fromstring(raw)
def relationships(archive,name):
 parent,leaf=posixpath.split(name);rel_name=posixpath.join(parent,"_rels",leaf+".rels")
 if rel_name not in archive.namelist():return {}
 result={}
 for rel in xml(archive,rel_name):
  identifier=rel.get("Id","");edge=(rel.get("Type",""),rel.get("Target",""),rel.get("TargetMode",""))
  if not identifier or identifier in result:raise ValueError(f"Invalid relationship in {rel_name}")
  result[identifier]=edge
 return result
def canonical(element,rels):
 attrs=[(key,rels[value]) if key.startswith("{"+DOCREL+"}") and value in rels else(key,value) for key,value in element.attrib.items()]
 return element.tag,tuple(sorted(attrs)),element.text or "",tuple(canonical(child,rels) for child in element)
def semantic(archive,name):
 root=xml(archive,name)
 if name.endswith(".rels"):return root.tag,tuple(sorted((rel.get("Type",""),rel.get("Target",""),rel.get("TargetMode","")) for rel in root))
 return canonical(root,relationships(archive,name))
def text_content(element):return "".join(node.text or "" for node in element.iter() if node.tag==f"{{{MAIN}}}t")
def model(path):
 archive=zipfile.ZipFile(path);names=archive.namelist()
 if len(names)!=len(set(names)) or archive.testzip() is not None:raise ValueError(f"Invalid ZIP container: {path}")
 shared=[] if "xl/sharedStrings.xml" not in names else[text_content(node) for node in xml(archive,"xl/sharedStrings.xml")]
 rels={rel.get("Id"):rel for rel in xml(archive,"xl/_rels/workbook.xml.rels")};sheets={};paths={}
 for sheet in xml(archive,"xl/workbook.xml").findall("m:sheets/m:sheet",NS):
  name=sheet.get("name");rel=rels.get(sheet.get(f"{{{DOCREL}}}id"))
  if not name or rel is None or rel.get("TargetMode")=="External":raise ValueError("Invalid worksheet relationship")
  target=rel.get("Target","");target=posixpath.normpath(target.lstrip("/") if target.startswith("/") else "xl/"+target);root=xml(archive,target);cells={};rows={}
  for row in root.findall("m:sheetData/m:row",NS):
   number=int(row.get("r","0"));rows[number]=dict(row.attrib)
   for cell in row.findall("m:c",NS):
    address=cell.get("r","")
    if not re.fullmatch(r"[A-Z]+[1-9][0-9]*",address) or address in cells:raise ValueError(f"Invalid cell {name}!{address}")
    kind=cell.get("t","n");value_node=cell.find("m:v",NS);value="" if value_node is None else value_node.text or ""
    if kind=="s":value=shared[int(value)]
    elif kind=="inlineStr":value=text_content(cell.find("m:is",NS))
    formula=cell.find("m:f",NS);cells[address]={"value":value,"formula":None if formula is None else formula.text or "","formulaAttrs":{} if formula is None else dict(formula.attrib),"style":cell.get("s"),"type":kind}
  sheet_data=root.find("m:sheetData",NS);sheets[name]={"cells":cells,"rows":rows,"structure":(root.tag,tuple(sorted(root.attrib.items())),root.text or "",tuple(canonical(child,relationships(archive,target)) for child in root if child is not sheet_data))};paths[name]=target
 return archive,set(names),sheets,paths
def normalized(attrs):return{key:value for key,value in attrs.items() if key not in{"ht","customHeight"} and not(key=="hidden" and value=="0")}
def main():
 parser=argparse.ArgumentParser();parser.add_argument("source",type=Path);parser.add_argument("candidate",type=Path);parser.add_argument("output",type=Path);args=parser.parse_args();sa,sn,s,sp=model(args.source);ca,cn,c,cp=model(args.candidate)
 try:
  if sn!=cn or sp!=cp or set(s)!=set(c):raise ValueError("Workbook structure changed")
  for name in sorted(sn-{"xl/sharedStrings.xml",*sp.values()}):
   same=semantic(sa,name)==semantic(ca,name) if name.endswith((".xml",".rels")) else sa.read(name)==ca.read(name)
   if not same:raise ValueError(f"Native part changed: {name}")
  changed=[];formula_count=0
  for sheet_name in s:
   before,after=s[sheet_name],c[sheet_name]
   if before["structure"]!=after["structure"] or set(before["cells"])!=set(after["cells"]):raise ValueError(f"Worksheet structure changed: {sheet_name}")
   for address,left in before["cells"].items():
    right=after["cells"][address];formula_count+=right["formula"] is not None
    if left!=right:
     if address not in ALLOWED.get(sheet_name,set()):raise ValueError(f"Unexpected cell change: {sheet_name}!{address}")
     if any(left[key]!=right[key] for key in("formula","formulaAttrs","style")):raise ValueError(f"Formula/style changed: {sheet_name}!{address}")
     changed.append(f"{sheet_name}!{address}")
   allowed=TASK_ROWS if sheet_name=="Aufgaben" else PACKET_ROWS if sheet_name=="Pakete" else set()
   if set(before["rows"])!=set(after["rows"]):raise ValueError(f"Row set changed: {sheet_name}")
   for row,left in before["rows"].items():
    right=after["rows"][row]
    if row in allowed:
     if normalized(left)!=normalized(right) or not(0<float(right.get("ht","0"))<=409.5) or right.get("customHeight")!="1":raise ValueError(f"Invalid row change: {sheet_name}!{row}")
    elif left!=right:raise ValueError(f"Unexpected row change: {sheet_name}!{row}")
  expected=sorted(f"{sheet}!{address}" for sheet,values in ALLOWED.items() for address in values)
  if sorted(changed)!=expected or formula_count!=264:raise ValueError(f"Expected {len(expected)} changes and 264 formulas, got {len(changed)} and {formula_count}")
  result={"changedCells":len(changed),"changedRows":len(TASK_ROWS)+len(PACKET_ROWS),"formulaCount":formula_count,"nativeParts":len(cn),"preservation":"matched"};args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n");print(json.dumps(result,ensure_ascii=False))
 finally:sa.close();ca.close()
if __name__=="__main__":main()

