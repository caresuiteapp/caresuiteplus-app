import fs from 'node:fs/promises';
const runtimeModules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;if(!runtimeModules)throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const {FileBlob,SpreadsheetFile}=await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const sourceFile=process.env.CARESUITE_AZ_SOURCE,catalogFile=process.env.CARESUITE_AZ_CATALOG,outputFile=process.env.CARESUITE_AZ_RESULT,previewDir=process.env.CARESUITE_AZ_PREVIEW_DIR;
if(!sourceFile||!catalogFile||!outputFile||!previewDir)throw Error('CARESUITE_AZ_SOURCE, CARESUITE_AZ_CATALOG, CARESUITE_AZ_RESULT und CARESUITE_AZ_PREVIEW_DIR erforderlich');
const catalog=JSON.parse(await fs.readFile(catalogFile,'utf8'));if(catalog.version!==320)throw Error(`Katalog ist nicht CP320: ${catalog.version}`);
const workbook=await SpreadsheetFile.importXlsx(await FileBlob.load(sourceFile)),tasks=workbook.worksheets.getItem('Aufgaben'),packets=workbook.worksheets.getItem('Pakete');
const taskRows=new Map(tasks.getRange('A9:A270').values.map((row,index)=>[row[0],index+9])),packetRows=new Map(packets.getRange('A8:A104').values.map((row,index)=>[row[0],index+8]));
const taskIds=Array.from({length:8},(_,index)=>`M-${String(index+1).padStart(2,'0')}`),packetIds=['M-P01','M-P02','M-P03'];
if(JSON.stringify(taskIds.map(id=>taskRows.get(id)))!==JSON.stringify([133,134,135,136,137,138,139,140]))throw Error('M-Aufgabenzeilen unerwartet');
if(JSON.stringify(packetIds.map(id=>packetRows.get(id)))!==JSON.stringify([54,55,56]))throw Error('M-Paketzeilen unerwartet');
await fs.mkdir(previewDir,{recursive:true});const views=[['Aufgaben','A133:O140','tasks-full'],['Aufgaben','H133:O140','tasks-status'],['Pakete','A54:H56','packets']];
for(const [sheetName,range,name] of views){const image=await workbook.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(`${previewDir}/before-${name}.png`,new Uint8Array(await image.arrayBuffer()));}
for(const id of taskIds){const task=catalog.tasks.find(entry=>entry.id===id),row=taskRows.get(id);if(!task||!row)throw Error(`${id} fehlt`);tasks.getRange(`H${row}:I${row}`).values=[[task.implementation,task.function]];tasks.getRange(`M${row}`).values=[[task.evidence]];tasks.getRange(`O${row}`).values=[[task.next]];tasks.getRange(`A${row}:O${row}`).format.rowHeight=470;}
for(const id of packetIds){const packet=catalog.packets.find(entry=>entry[0]===id),row=packetRows.get(id);if(!packet||!row)throw Error(`${id} fehlt`);packets.getRange(`F${row}:G${row}`).values=[[packet[5],packet[6]]];packets.getRange(`A${row}:H${row}`).format.rowHeight=420;}
workbook.recalculate();if(tasks.getRange('N133:N140').values.flat().some(value=>value!=='Offen'))throw Error('M-01–M-08 dürfen nicht als abgenommen erscheinen');
const formulaCount=['Aufgaben','Pakete','Abnahme','Quellen'].flatMap(name=>workbook.worksheets.getItem(name).getUsedRange().formulas.flat()).filter(Boolean).length;if(formulaCount!==264)throw Error(`Formelbestand ${formulaCount} statt 264`);
const errors=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:300},summary:'CP320 final formula error scan'});if(!errors.ndjson.includes('matched 0 entries'))throw Error(`Formelfehler: ${errors.ndjson}`);
await (await SpreadsheetFile.exportXlsx(workbook)).save(outputFile);const saved=await SpreadsheetFile.importXlsx(await FileBlob.load(outputFile));
for(const [sheetName,range,name] of views){const image=await saved.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(`${previewDir}/after-${name}.png`,new Uint8Array(await image.arrayBuffer()));}
await fs.writeFile(`${outputFile}.formula-errors.ndjson`,errors.ndjson);
const taskCheck=await saved.inspect({kind:'table',range:'Aufgaben!H133:O140',include:'values,formulas',tableMaxRows:8,tableMaxCols:8,maxChars:16000}),packetCheck=await saved.inspect({kind:'table',range:'Pakete!F54:H56',include:'values,formulas',tableMaxRows:3,tableMaxCols:3,maxChars:8000});
console.log(JSON.stringify({formulaCount,taskRows:Object.fromEntries(taskIds.map(id=>[id,taskRows.get(id)])),packetRows:Object.fromEntries(packetIds.map(id=>[id,packetRows.get(id)]))}));console.log(taskCheck.ndjson);console.log(packetCheck.ndjson);
