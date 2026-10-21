import fs from 'node:fs/promises';

const runtimeModules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if(!runtimeModules)throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const {FileBlob,SpreadsheetFile}=await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const[sourceRoot,sourceFile,outputFile,previewDir]=process.argv.slice(2);
if(!sourceRoot||!sourceFile||!outputFile||!previewDir)throw Error('usage: sourceRoot sourceFile outputFile previewDir');
await fs.mkdir(previewDir,{recursive:true});
await fs.mkdir(new URL('.',`file://${outputFile}`).pathname,{recursive:true});
const catalog=JSON.parse(await fs.readFile(`${sourceRoot}/docs/audit/ambulant-az-katalog-2026-10-08.json`,'utf8'));
const task=catalog.tasks.find((entry)=>entry.id==='B-02'),packet=catalog.packets.find((entry)=>entry[0]==='B-P01');
if(!task||!packet)throw Error('B-02 oder B-P01 fehlt');
const workbook=await SpreadsheetFile.importXlsx(await FileBlob.load(sourceFile));
const main=workbook.worksheets.getItem('Aufgaben'),packets=workbook.worksheets.getItem('Pakete');
const taskRow=main.getRange('A9:A270').values.findIndex((row)=>row[0]==='B-02')+9;
const packetRow=packets.getRange('A8:A104').values.findIndex((row)=>row[0]==='B-P01')+8;
if(taskRow!==20||packetRow!==12)throw Error(`Unerwartete Zeilen: ${taskRow}/${packetRow}`);
if(task.implementation!=='Teilweise umgesetzt'||task.function!=='Teilprüfung'||[task.care,task.design,task.legal].some((status)=>status!=='Offen')||packet[5]!=='Teilweise umgesetzt')throw Error('B-02- oder B-P01-Status ist nicht der freigegebene Teilstatus');
for(const[sheetName,range,name]of[['Aufgaben',`A${taskRow}:O${taskRow}`,'before-B-02.png'],['Pakete',`A${packetRow}:H${packetRow}`,'before-B-P01.png']]){
 const rendered=await workbook.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(`${previewDir}/${name}`,new Uint8Array(await rendered.arrayBuffer()));
}
main.getRange(`H${taskRow}:M${taskRow}`).values=[[task.implementation,task.function,task.care,task.design,task.legal,task.evidence]];
main.getRange(`O${taskRow}`).values=[[task.next]];
packets.getRange(`G${packetRow}`).values=[[packet[6]]];
main.getRange(`A${taskRow}:O${taskRow}`).format.rowHeight=325;
packets.getRange(`A${packetRow}:H${packetRow}`).format.rowHeight=190;
workbook.recalculate();
if(main.getRange(`N${taskRow}`).values[0][0]!=='Offen'||main.getRange('B4').values[0][0]!==1)throw Error('B-02 oder Gesamtstand wurde unzulässig als abgenommen markiert');
const formulaCount=main.getRange('A1:O270').formulas.flat().filter(Boolean).length+packets.getRange('A1:H104').formulas.flat().filter(Boolean).length+workbook.worksheets.getItem('Abnahme').getRange('A1:Z100').formulas.flat().filter(Boolean).length+workbook.worksheets.getItem('Quellen').getRange('A1:Z100').formulas.flat().filter(Boolean).length;
if(formulaCount!==264)throw Error(`Formelbestand geändert: ${formulaCount}`);
const errors=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:300},maxChars:3000});
if(!errors.ndjson.includes('matched 0 entries'))throw Error(`Arbeitsmappe enthält Fehlerwerte: ${errors.ndjson}`);
await fs.writeFile(`${previewDir}/formula-errors.ndjson`,errors.ndjson);
for(const[sheetName,range,name]of[['Aufgaben',`A${taskRow}:O${taskRow}`,'after-B-02.png'],['Pakete',`A${packetRow}:H${packetRow}`,'after-B-P01.png']]){
 const rendered=await workbook.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(`${previewDir}/${name}`,new Uint8Array(await rendered.arrayBuffer()));
}
await(await SpreadsheetFile.exportXlsx(workbook)).save(outputFile);
console.log(JSON.stringify({taskRow,packetRow,formulaCount,taskStatus:main.getRange(`H${taskRow}:N${taskRow}`).values[0],packetStatus:packets.getRange(`F${packetRow}:G${packetRow}`).values[0]}));
