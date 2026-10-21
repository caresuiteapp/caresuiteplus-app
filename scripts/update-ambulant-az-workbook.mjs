import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const sourceRoot=process.env.CARESUITE_SOURCE_ROOT;
const file=process.env.CARESUITE_AZ_FILE;
if(!sourceRoot||!file)throw Error('CARESUITE_SOURCE_ROOT und CARESUITE_AZ_FILE erforderlich');
const catalog=JSON.parse(await fs.readFile(sourceRoot+'/docs/audit/ambulant-az-katalog-2026-10-08.json','utf8'));
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(file));
const main=wb.worksheets.getItem('Aufgaben'),packets=wb.worksheets.getItem('Pakete');
const ids=main.getRange('A9:A270').values, packetIds=packets.getRange('A8:A104').values;
const selected=new Set(["D-06", "D-07", "E-08", "E-09"]);
const changed=catalog.tasks.filter(t=>selected.has(t.id));
const positions=changed.map(t=>({task:t,row:ids.findIndex(r=>r[0]===t.id)+9}));
if(positions.some(p=>p.row<9))throw Error('Aufgaben-ID fehlt');
const before=await wb.render({sheetName:'Aufgaben',range:`A${positions[0].row}:O${positions[0].row}`,scale:1,format:'png'});
await fs.writeFile(file+'.before.png',new Uint8Array(await before.arrayBuffer()));
// Separate invocation lets the existing view be inspected before editing.
if(process.env.CARESUITE_AZ_PREVIEW==='1')process.exit(0);
for(const {task:t,row} of positions){
 if(!['Bestand zu prüfen','Teilweise umgesetzt','Umgesetzt'].includes(t.implementation)||[t.function,t.care,t.design,t.legal].some(v=>!['Offen','Teilprüfung','Bestanden','Entfällt geprüft'].includes(v)))throw Error('Status passt nicht zu den bestehenden Auswahllisten');
 main.getRange(`H${row}:M${row}`).values=[[t.implementation,t.function,t.care,t.design,t.legal,t.evidence]];
 main.getRange(`O${row}`).values=[[t.next]];
 main.getRange(`A${row}:O${row}`).format.rowHeight=155;
}
for(const p of catalog.packets.filter(p=>catalog.tasks.some(t=>selected.has(t.id)&&t.packet===p[0]))){
 const row=packetIds.findIndex(r=>r[0]===p[0])+8;if(row<8)throw Error('Paket-ID fehlt');
 packets.getRange(`F${row}:G${row}`).values=[[p[5],p[6]]];
}
wb.recalculate();
for(const {task:t,row} of positions){const accepted=t.implementation==='Umgesetzt'&&t.function==='Bestanden'&&[t.care,t.design,t.legal].every(s=>['Bestanden','Entfällt geprüft'].includes(s))&&!!t.evidence.trim();if(main.getRange(`N${row}`).values[0][0]!== (accepted?'Abgenommen':'Offen'))throw Error('Abnahmestatus stimmt nicht mit vollständigen Kriterien überein');}
console.log((await wb.inspect({kind:'table',range:`A${positions[0].row}:O${positions[0].row}`,sheetId:main.sheetId,include:'values,formulas',tableMaxRows:1,tableMaxCols:8,maxChars:2000})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:300},maxChars:1500})).ndjson);
const after=await wb.render({sheetName:'Aufgaben',range:`A${positions[0].row}:O${positions[0].row}`,scale:1,format:'png'});
await fs.writeFile(file+'.after.png',new Uint8Array(await after.arrayBuffer()));
for(const {task:t,row} of positions){const view=await wb.render({sheetName:'Aufgaben',range:`A${row}:O${row}`,scale:1,format:'png'});await fs.writeFile(file+`.row-${t.id}.png`,new Uint8Array(await view.arrayBuffer()));}
await (await SpreadsheetFile.exportXlsx(wb)).save(file);
console.log(JSON.stringify({updatedTasks:changed.map(t=>t.id),accepted:main.getRange('B4').values[0][0]}));
