#!/usr/bin/env python3
import json,re,sys,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
MAIN='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
if len(sys.argv)!=4: raise SystemExit('usage: verifier source candidate plan')
source,candidate,plan=map(Path,sys.argv[1:]);allowed=json.loads(plan.read_text());allowed_cells={(e['sheet'],e['address']) for e in allowed['edits']};allowed_rows={k:set(v) for k,v in allowed['allowedRowHeightChanges'].items()}
if allowed.get('checkpoint')!=360: raise ValueError('CP360 plan required')
def model(path):
 z=zipfile.ZipFile(path);assert z.testzip() is None
 ss=[]
 if 'xl/sharedStrings.xml' in z.namelist(): ss=[''.join(t.text or '' for t in x.iter(MAIN+'t')) for x in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(MAIN+'si')]
 wb=ET.fromstring(z.read('xl/workbook.xml'));rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'));relmap={x.attrib['Id']:x.attrib['Target'] for x in rels};out={}
 for s in wb.find(MAIN+'sheets'):
  name=s.attrib['name'];rid=s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'];target=relmap[rid];target=target.lstrip('/') if target.startswith('/') else 'xl/'+target.replace('../','');root=ET.fromstring(z.read(target));cells={};rows={}
  for row in root.findall('.//'+MAIN+'row'):
   n=int(row.attrib['r']);rows[n]=dict(row.attrib)
   for c in row.findall(MAIN+'c'):
    a=c.attrib['r'];v=c.find(MAIN+'v');raw='' if v is None else v.text or '';val=ss[int(raw)] if c.attrib.get('t')=='s' and raw else raw;f=c.find(MAIN+'f');cells[a]=(val,None if f is None else f.text or '',dict(c.attrib))
  out[name]=(cells,rows)
 return z,out
za,a=model(source);zb,b=model(candidate)
try:
 if set(za.namelist())!=set(zb.namelist()) or set(a)!=set(b): raise ValueError('Workbook parts changed')
 changed=[];formulas=0
 for sheet in a:
  ac,ar=a[sheet];bc,br=b[sheet]
  if set(ac)!=set(bc) or set(ar)!=set(br): raise ValueError('Sheet structure changed '+sheet)
  for address in ac:
   if bc[address][1] is not None: formulas+=1
   if ac[address]!=bc[address]:
    if (sheet,address) not in allowed_cells: raise ValueError(f'Unexpected cell change {sheet}!{address}')
    if ac[address][1:]!=bc[address][1:]: raise ValueError(f'Formula/style metadata changed {sheet}!{address}')
    changed.append((sheet,address))
  for row in ar:
   left={k:v for k,v in ar[row].items() if k not in('ht','customHeight') and not(k=='hidden' and v=='0')};right={k:v for k,v in br[row].items() if k not in('ht','customHeight') and not(k=='hidden' and v=='0')}
   if left!=right: raise ValueError(f'Row metadata changed {sheet}!{row}')
   if ar[row]!=br[row] and row not in allowed_rows.get(sheet,set()): raise ValueError(f'Unexpected row height change {sheet}!{row}')
 if set(changed)!=allowed_cells or formulas!=264: raise ValueError(f'Expected {len(allowed_cells)} edits/264 formulas, found {len(changed)}/{formulas}')
 print(json.dumps({'checkpoint':360,'changedCells':len(changed),'formulas':formulas,'preservation':'matched'}))
finally:za.close();zb.close()
