#!/usr/bin/env python3
import json,re,sys,zipfile,xml.etree.ElementTree as ET
from pathlib import Path

if len(sys.argv)!=3: raise SystemExit('usage: update-ambulant-checkpoint359.py CP358.xlsx catalog.json')
workbook=Path(sys.argv[1]);catalog_path=Path(sys.argv[2]);ns='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
with zipfile.ZipFile(workbook) as archive:
    strings=[''.join(t.text or '' for t in item.iter(ns+'t')) for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall(ns+'si')]
    def sheet_rows(name):
        result={}
        root=ET.fromstring(archive.read('xl/worksheets/'+name))
        for row in root.iter(ns+'row'):
            values={}
            for cell in row.findall(ns+'c'):
                value=cell.find(ns+'v')
                if value is None: continue
                column=re.match(r'[A-Z]+',cell.attrib['r']).group();raw=value.text
                values[column]=strings[int(raw)] if cell.attrib.get('t')=='s' else raw
            if values.get('A'): result[values['A']]=values
        return result
    tasks=sheet_rows('sheet1.xml');packets=sheet_rows('sheet2.xml')

catalog=json.loads(catalog_path.read_text())
areas=set('HIJKLMNOPQRST')
note=('CP359-Rekonstruktion: gemeinsamer H–T-Fachprüfvertrag mit 13 getrennten Bereichen, '
      'vollständigen Quellkollektionen, Vier-Augen-Ausschluss und fester Quittungswiederaufnahme; '
      '63/63 neue und 12192/12192 vollständige lokale Node-Fälle grün. Native Server-/UI-Bindung offen.')
task_count=packet_count=0
for task in catalog['tasks']:
    if task['id'][0] not in areas: continue
    source=tasks.get(task['id'])
    if not source or not source.get('M') or not source.get('O'): raise SystemExit('Missing workbook task '+task['id'])
    task['evidence']=source['M'].rstrip()+' '+note
    task['next']=source['O']
    task['implementation']='Teilweise umgesetzt';task['function']='Teilprüfung';task['care']='Offen';task['design']='Offen';task['legal']='Offen';task_count+=1
for packet in catalog['packets']:
    if packet[0][0] not in areas: continue
    source=packets.get(packet[0])
    if not source or not source.get('G'): raise SystemExit('Missing workbook packet '+packet[0])
    packet[5]='Teilweise umgesetzt';packet[6]=source['G'].rstrip()+' '+note
    if source.get('H'): packet[7]=source['H']
    packet_count+=1
catalog['version']=359;catalog['date']='2026-10-17'
catalog['checkpointSummary']=('CP359 rekonstruiert nach Verlust der nur privaten CP346–CP358-Quellen einen gemeinsamen Web/Desktop-Fachprüfkern für H bis T. '
 '13 getrennte Fachbereiche binden genau einen unveränderten Kopf, vollständige benannte Quellkollektionen, eigene Anfrage/Rückgabe/Annahme, aktuelle Beschäftigungs-/Qualifikations-/Dokument-/Rechte-/Prüfbereichsoriginale und Vier-Augen-Ausschlüsse. Browser-Lock, festes Journal, CAS, bestätigter Abbruch, unbekannter Ausgang und nur lesende Quittungswiederaufnahme bleiben getrennt. 63/63 neue und 12192/12192 vollständige lokale Node-Fälle bestanden. Die domänenspezifische native Server-/SQL-/UI-Anbindung des rekonstruierten gemeinsamen Kerns, echte Laufzeit sowie qualifizierte Abnahmen fehlen. 1/262 vollständig abgenommen; reached=false.')
catalog['checkpointNodeLog']='docs/audit/checks/ambulant-node-checkpoint359-2026-10-17-connected-review-reconstruction.log'
catalog_path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'checkpoint':359,'tasks':task_count,'packets':packet_count,'accepted':catalog['milestone']['acceptedTasks']}))
