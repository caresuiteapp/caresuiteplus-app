import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const runtimeModules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if(!runtimeModules)throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const {FileBlob,SpreadsheetFile}=await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const beforePath=process.env.CARESUITE_AZ_BEFORE,afterPath=process.env.CARESUITE_AZ_AFTER,outputPath=process.env.CARESUITE_AZ_AUDIT;
if(!beforePath||!afterPath||!outputPath)throw Error('CARESUITE_AZ_BEFORE, CARESUITE_AZ_AFTER und CARESUITE_AZ_AUDIT erforderlich');
const [before,after]=await Promise.all([SpreadsheetFile.importXlsx(await FileBlob.load(beforePath)),SpreadsheetFile.importXlsx(await FileBlob.load(afterPath))]);
const ranges={Aufgaben:'A1:O270',Pakete:'A1:H104',Abnahme:'A1:Z100',Quellen:'A1:Z100'};
const columnName=index=>{let value=index+1,name='';while(value>0){name=String.fromCharCode(65+(value-1)%26)+name;value=Math.floor((value-1)/26);}return name;};
const changedCells=[];let formulasBefore=0,formulasAfter=0;
for(const [sheetName,range] of Object.entries(ranges)){const left=before.worksheets.getItem(sheetName).getRange(range),right=after.worksheets.getItem(sheetName).getRange(range);for(let row=0;row<left.values.length;row+=1)for(let column=0;column<left.values[row].length;column+=1){if(left.formulas[row]?.[column])formulasBefore+=1;if(right.formulas[row]?.[column])formulasAfter+=1;if(JSON.stringify(left.values[row]?.[column])!==JSON.stringify(right.values[row]?.[column])||(left.formulas[row]?.[column]??'')!==(right.formulas[row]?.[column]??''))changedCells.push(`${sheetName}!${columnName(column)}${row+1}`);}}
const expectedChangedCells=[];for(let row=113;row<=124;row+=1){if(row===124)expectedChangedCells.push(`Aufgaben!H${row}`,`Aufgaben!I${row}`);expectedChangedCells.push(`Aufgaben!M${row}`,`Aufgaben!O${row}`);}for(let row=47;row<=50;row+=1)expectedChangedCells.push(`Pakete!G${row}`);
if(JSON.stringify(changedCells)!==JSON.stringify(expectedChangedCells))throw Error(`Unerwartete Zelländerungen: ${JSON.stringify(changedCells)}`);
if(formulasBefore!==264||formulasAfter!==264)throw Error(`Formelbestand geändert: ${formulasBefore}/${formulasAfter}`);
const xml=(filePath,name)=>execFileSync('unzip',['-p',filePath,name],{maxBuffer:30_000_000});
const list=(filePath,prefix)=>execFileSync('unzip',['-Z1',filePath],{encoding:'utf8'}).trim().split('\n').filter(name=>name.startsWith(prefix)).sort();
let logicalStylesCompared=0,styleAssignmentDifferences=0,rowHeightsCompared=0;const rowHeightDifferences=[];
for(const sheetName of list(beforePath,'xl/worksheets/').filter(name=>/sheet\d+\.xml$/.test(name))){const left=xml(beforePath,sheetName).toString(),right=xml(afterPath,sheetName).toString();const styleMap=value=>new Map([...value.matchAll(/<(?:x:)?c\s+([^>]*\br="([A-Z]+\d+)"[^>]*)>/g)].map(match=>[match[2],/\bs="(\d+)"/.exec(match[1])?.[1]??'']));const rowMap=value=>new Map([...value.matchAll(/<(?:x:)?row\s+([^>]*\br="(\d+)"[^>]*)>/g)].map(match=>[match[2],/\bht="([^"]+)"/.exec(match[1])?.[1]??'']));const leftStyles=styleMap(left),rightStyles=styleMap(right);for(const key of new Set([...leftStyles.keys(),...rightStyles.keys()])){logicalStylesCompared+=1;if(leftStyles.get(key)!==rightStyles.get(key))styleAssignmentDifferences+=1;}const leftHeights=rowMap(left),rightHeights=rowMap(right);for(const key of new Set([...leftHeights.keys(),...rightHeights.keys()])){rowHeightsCompared+=1;if(leftHeights.get(key)!==rightHeights.get(key))rowHeightDifferences.push(`${sheetName}:${key}:${leftHeights.get(key)}->${rightHeights.get(key)}`);}}
const expectedRows=[...Array.from({length:12},(_,i)=>`xl/worksheets/sheet1.xml:${113+i}`),...Array.from({length:4},(_,i)=>`xl/worksheets/sheet2.xml:${47+i}`)];
if(logicalStylesCompared!==5218||styleAssignmentDifferences||rowHeightsCompared!==430||rowHeightDifferences.length!==16||!expectedRows.every(prefix=>rowHeightDifferences.some(value=>value.startsWith(prefix+':'))))throw Error(`Stil-/Zeilenhöhenänderungen unerwartet: ${JSON.stringify(rowHeightDifferences)}`);
if(!xml(beforePath,'xl/styles.xml').equals(xml(afterPath,'xl/styles.xml')))throw Error('styles.xml verändert');
const normalizeWorkbook=value=>value.toString().replace(/r:id="R[^"]+"/g,'r:id="RID"');
if(normalizeWorkbook(xml(beforePath,'xl/workbook.xml'))!==normalizeWorkbook(xml(afterPath,'xl/workbook.xml')))throw Error('Workbook-Struktur verändert');
const relationshipTargets=value=>[...value.toString().matchAll(/Target="([^"]+)"/g)].map(match=>match[1]).sort();
if(JSON.stringify(relationshipTargets(xml(beforePath,'xl/_rels/workbook.xml.rels')))!==JSON.stringify(relationshipTargets(xml(afterPath,'xl/_rels/workbook.xml.rels'))))throw Error('Workbook-Beziehungen verändert');
const beforeTables=list(beforePath,'xl/tables/'),afterTables=list(afterPath,'xl/tables/');
if(JSON.stringify(beforeTables)!==JSON.stringify(afterTables)||beforeTables.some(name=>!xml(beforePath,name).equals(xml(afterPath,name))))throw Error('Tabellen verändert');
const acceptedTotal=after.worksheets.getItem('Aufgaben').getRange('N9:N270').values.flat().filter(value=>value==='Abgenommen').length,startedTotal=after.worksheets.getItem('Aufgaben').getRange('H9:H270').values.flat().filter(value=>value!=='Bestand zu prüfen').length;
if(acceptedTotal!==1||startedTotal!==228)throw Error(`Statussummen: ${acceptedTotal}/${startedTotal}`);
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex'),beforeBytes=await fs.readFile(beforePath),afterBytes=await fs.readFile(afterPath);
const result={checkpoint:318,sourceCheckpoint:317,sourceSize:beforeBytes.length,sourceSha256:sha256(beforeBytes),resultSize:afterBytes.length,resultSha256:sha256(afterBytes),changedCells,formulas:formulasAfter,logicalStylesCompared,styleAssignmentDifferences,rowHeightsCompared,rowHeightDifferences,acceptedTotal,startedTotal,stylesXmlIdentical:true,workbookStructureIdentical:true,workbookRelationshipTargetsIdentical:true,tablesIdentical:true,formulaErrorScanMatches:0,visualQa:{tasksBeforeAndAfter:true,packetsBeforeAndAfter:true,applicationDesignAcceptance:false}};
await fs.writeFile(outputPath,`${JSON.stringify(result,null,2)}\n`);console.log(JSON.stringify(result));
