import fs from 'node:fs/promises';

const runtimeModules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if(!runtimeModules)throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const{FileBlob,SpreadsheetFile}=await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const sourceRoot=process.env.CARESUITE_SOURCE_ROOT,sourceFile=process.env.CARESUITE_AZ_SOURCE,outputFile=process.env.CARESUITE_AZ_OUTPUT;
if(!sourceRoot||!sourceFile||!outputFile)throw Error('CARESUITE_SOURCE_ROOT, CARESUITE_AZ_SOURCE und CARESUITE_AZ_OUTPUT erforderlich');
const catalog=JSON.parse(await fs.readFile(`${sourceRoot}/docs/audit/ambulant-az-katalog-2026-10-08.json`,'utf8'));
const task=catalog.tasks.find(entry=>entry.id==='B-06'),packet=catalog.packets.find(entry=>entry[0]==='B-P02');
if(!task||!packet)throw Error('B-06 oder B-P02 fehlt');
if(task.implementation!=='Teilweise umgesetzt'||task.function!=='Teilprüfung'||[task.care,task.design,task.legal].some(value=>value!=='Offen')||packet[5]!=='Teilweise umgesetzt')throw Error('Status ist nicht der ehrliche Teilstatus');
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(sourceFile));
const main=wb.worksheets.getItem('Aufgaben'),packets=wb.worksheets.getItem('Pakete');
const taskRow=main.getRange('A9:A270').values.findIndex(row=>row[0]==='B-06')+9;
const packetRow=packets.getRange('A8:A104').values.findIndex(row=>row[0]==='B-P02')+8;
if(taskRow!==24||packetRow!==13)throw Error(`Unerwartete Zeilen: ${taskRow}/${packetRow}`);
for(const[sheetName,range,name]of[['Aufgaben',`A${taskRow}:O${taskRow}`,'before-B06.png'],['Pakete',`A${packetRow}:H${packetRow}`,'before-B-P02.png']]){
  const image=await wb.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(`${outputFile}.${name}`,new Uint8Array(await image.arrayBuffer()));
}
main.getRange(`H${taskRow}:M${taskRow}`).values=[[task.implementation,task.function,task.care,task.design,task.legal,task.evidence]];
main.getRange(`O${taskRow}`).values=[[task.next]];
main.getRange(`A${taskRow}:O${taskRow}`).format.rowHeight=340;
packets.getRange(`F${packetRow}:G${packetRow}`).values=[[packet[5],packet[6]]];
packets.getRange(`A${packetRow}:H${packetRow}`).format.rowHeight=220;
wb.recalculate();
if(main.getRange(`N${taskRow}`).values[0][0]!=='Offen')throw Error('B-06 darf nicht als abgenommen erscheinen');
const formulaCount=main.getRange('A1:O270').formulas.flat().filter(Boolean).length+packets.getRange('A1:H104').formulas.flat().filter(Boolean).length+wb.worksheets.getItem('Abnahme').getRange('A1:Z100').formulas.flat().filter(Boolean).length+wb.worksheets.getItem('Quellen').getRange('A1:Z100').formulas.flat().filter(Boolean).length;
if(formulaCount!==264)throw Error(`Formelbestand geändert: ${formulaCount}`);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:300},maxChars:3000});
if(!errors.ndjson.includes('matched 0 entries'))throw Error(`Arbeitsmappe enthält Fehlerwerte: ${errors.ndjson}`);
await fs.writeFile(`${outputFile}.formula-errors.ndjson`,errors.ndjson);
for(const[sheetName,range,name]of[['Aufgaben',`A${taskRow}:O${taskRow}`,'after-B06.png'],['Pakete',`A${packetRow}:H${packetRow}`,'after-B-P02.png']]){
  const image=await wb.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(`${outputFile}.${name}`,new Uint8Array(await image.arrayBuffer()));
}
await(await SpreadsheetFile.exportXlsx(wb)).save(outputFile);
console.log(JSON.stringify({taskRow,packetRow,formulaCount,taskStatus:main.getRange(`H${taskRow}:N${taskRow}`).values[0],packetStatus:packets.getRange(`F${packetRow}:G${packetRow}`).values[0]}));
