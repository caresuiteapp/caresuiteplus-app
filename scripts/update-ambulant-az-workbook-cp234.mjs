import fs from 'node:fs/promises';
const runtimeModules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if(!runtimeModules)throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const {FileBlob,SpreadsheetFile}=await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);

const sourceRoot=process.env.CARESUITE_SOURCE_ROOT;
const file=process.env.CARESUITE_AZ_FILE;
if(!sourceRoot||!file)throw Error('CARESUITE_SOURCE_ROOT und CARESUITE_AZ_FILE erforderlich');
const catalog=JSON.parse(await fs.readFile(sourceRoot+'/docs/audit/ambulant-az-katalog-2026-10-08.json','utf8'));
const task=catalog.tasks.find((entry)=>entry.id==='U-02');
const packet=catalog.packets.find((entry)=>entry[0]==='U-P01');
if(!task||!packet)throw Error('U-02 oder U-P01 fehlt');

const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(file));
const main=wb.worksheets.getItem('Aufgaben');
const packets=wb.worksheets.getItem('Pakete');
const taskIds=main.getRange('A9:A270').values;
const packetIds=packets.getRange('A8:A104').values;
const taskRow=taskIds.findIndex((row)=>row[0]==='U-02')+9;
const packetRow=packetIds.findIndex((row)=>row[0]==='U-P01')+8;
if(taskRow<9||packetRow<8)throw Error('Arbeitslisten-ID fehlt');

const before=await wb.render({sheetName:'Aufgaben',range:`A${taskRow}:O${taskRow}`,scale:1,format:'png'});
await fs.writeFile(file+'.before-U-02.png',new Uint8Array(await before.arrayBuffer()));
const beforePacket=await wb.render({sheetName:'Pakete',range:`A${packetRow}:H${packetRow}`,scale:1,format:'png'});
await fs.writeFile(file+'.before-U-P01.png',new Uint8Array(await beforePacket.arrayBuffer()));
if(process.env.CARESUITE_AZ_PREVIEW==='1')process.exit(0);

if(!['Teilweise umgesetzt'].includes(task.implementation)||task.function!=='Teilprüfung'||[task.care,task.design,task.legal].some((value)=>value!=='Offen'))throw Error('U-02-Status ist nicht der freigegebene Teilstatus');
main.getRange(`H${taskRow}:M${taskRow}`).values=[[task.implementation,task.function,task.care,task.design,task.legal,task.evidence]];
main.getRange(`O${taskRow}`).values=[[task.next]];
packets.getRange(`F${packetRow}:G${packetRow}`).values=[[packet[5],packet[6]]];
wb.recalculate();
if(main.getRange(`N${taskRow}`).values[0][0]!=='Offen')throw Error('U-02 darf nicht als abgenommen erscheinen');
const formulaCount=main.getRange('A1:O270').formulas.flat().filter(Boolean).length+packets.getRange('A1:H104').formulas.flat().filter(Boolean).length+wb.worksheets.getItem('Abnahme').getRange('A1:Z100').formulas.flat().filter(Boolean).length+wb.worksheets.getItem('Quellen').getRange('A1:Z100').formulas.flat().filter(Boolean).length;
if(formulaCount!==264)throw Error(`Formelbestand geändert: ${formulaCount}`);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:300},maxChars:3000});
if(!errors.ndjson.includes('matched 0 entries'))throw Error(`Arbeitsmappe enthält Fehlerwerte: ${errors.ndjson}`);
const after=await wb.render({sheetName:'Aufgaben',range:`A${taskRow}:O${taskRow}`,scale:1,format:'png'});
await fs.writeFile(file+'.after-U-02.png',new Uint8Array(await after.arrayBuffer()));
const afterPacket=await wb.render({sheetName:'Pakete',range:`A${packetRow}:H${packetRow}`,scale:1,format:'png'});
await fs.writeFile(file+'.after-U-P01.png',new Uint8Array(await afterPacket.arrayBuffer()));
await (await SpreadsheetFile.exportXlsx(wb)).save(file);
console.log(JSON.stringify({taskRow,packetRow,formulaCount,taskStatus:main.getRange(`H${taskRow}:N${taskRow}`).values[0],packetStatus:packets.getRange(`F${packetRow}:G${packetRow}`).values[0]}));
