import fs from 'node:fs/promises';
const runtimeModules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;if(!runtimeModules)throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const{FileBlob,SpreadsheetFile}=await import(`file://${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const[root,sourceFile,outputFile,previewDir]=process.argv.slice(2);if(!root||!sourceFile||!outputFile||!previewDir)throw Error('usage: root sourceFile outputFile previewDir');
await fs.mkdir(previewDir,{recursive:true});await fs.mkdir(new URL('.',`file://${outputFile}`).pathname,{recursive:true});
const catalog=JSON.parse(await fs.readFile(`${root}/docs/audit/ambulant-az-katalog-2026-10-08.json`,'utf8'));if(catalog.version!==351)throw Error('CP351-Katalog fehlt');
const taskIds=Array.from({length:8},(_,i)=>`M-${String(i+1).padStart(2,'0')}`),packetIds=Array.from({length:3},(_,i)=>`M-P${String(i+1).padStart(2,'0')}`);
const workbook=await SpreadsheetFile.importXlsx(await FileBlob.load(sourceFile)),tasks=workbook.worksheets.getItem('Aufgaben'),packets=workbook.worksheets.getItem('Pakete');
const taskRows=taskIds.map(id=>{const row=tasks.getRange('A9:A270').values.findIndex(value=>value[0]===id)+9;if(row<9)throw Error(`${id} fehlt`);return[id,row];});
const packetRows=packetIds.map(id=>{const row=packets.getRange('A8:A104').values.findIndex(value=>value[0]===id)+8;if(row<8)throw Error(`${id} fehlt`);return[id,row];});
if(taskRows[0][1]!==133||taskRows.at(-1)[1]!==140||packetRows[0][1]!==54||packetRows.at(-1)[1]!==56)throw Error('Unerwartete M-Zeilen');
for(const[id,row]of taskRows){const rendered=await workbook.render({sheetName:'Aufgaben',range:`A${row}:O${row}`,scale:1,format:'png'});await fs.writeFile(`${previewDir}/before-${id}.png`,new Uint8Array(await rendered.arrayBuffer()));}
for(const[id,row]of packetRows){const rendered=await workbook.render({sheetName:'Pakete',range:`A${row}:H${row}`,scale:1,format:'png'});await fs.writeFile(`${previewDir}/before-${id}.png`,new Uint8Array(await rendered.arrayBuffer()));}
for(const[id,row]of taskRows){const task=catalog.tasks.find(entry=>entry.id===id);if(!task||task.implementation!=='Teilweise umgesetzt'||task.function!=='Teilprüfung'||[task.care,task.design,task.legal].some(value=>value!=='Offen'))throw Error(`Status ${id} unzulässig`);tasks.getRange(`M${row}`).values=[[task.evidence]];tasks.getRange(`O${row}`).values=[[task.next]];tasks.getRange(`A${row}:O${row}`).format.rowHeight=409;}
for(const[id,row]of packetRows){const packet=catalog.packets.find(entry=>entry[0]===id);if(!packet||packet[5]!=='Teilweise umgesetzt')throw Error(`Paket ${id} unzulässig`);packets.getRange(`G${row}`).values=[[packet[6]]];packets.getRange(`A${row}:H${row}`).format.rowHeight=320;}
workbook.recalculate();if(tasks.getRange('B4').values[0][0]!==1)throw Error('Abnahmestand wurde verändert');
const formulaCount=tasks.getRange('A1:O270').formulas.flat().filter(Boolean).length+packets.getRange('A1:H104').formulas.flat().filter(Boolean).length+workbook.worksheets.getItem('Abnahme').getRange('A1:Z100').formulas.flat().filter(Boolean).length+workbook.worksheets.getItem('Quellen').getRange('A1:Z100').formulas.flat().filter(Boolean).length;if(formulaCount!==264)throw Error(`Formelbestand geändert: ${formulaCount}`);
const errors=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:300},maxChars:3000});if(!errors.ndjson.includes('matched 0 entries'))throw Error(`Arbeitsmappe enthält Fehlerwerte: ${errors.ndjson}`);await fs.writeFile(`${previewDir}/formula-errors.ndjson`,errors.ndjson);
for(const[id,row]of taskRows){const rendered=await workbook.render({sheetName:'Aufgaben',range:`A${row}:O${row}`,scale:1,format:'png'});await fs.writeFile(`${previewDir}/after-${id}.png`,new Uint8Array(await rendered.arrayBuffer()));}
for(const[id,row]of packetRows){const rendered=await workbook.render({sheetName:'Pakete',range:`A${row}:H${row}`,scale:1,format:'png'});await fs.writeFile(`${previewDir}/after-${id}.png`,new Uint8Array(await rendered.arrayBuffer()));}
await(await SpreadsheetFile.exportXlsx(workbook)).save(outputFile);
console.log(JSON.stringify({taskRows:taskRows.map(value=>value[1]),packetRows:packetRows.map(value=>value[1]),changedCells:19,changedRows:11,formulaCount,accepted:tasks.getRange('B4').values[0][0]}));
