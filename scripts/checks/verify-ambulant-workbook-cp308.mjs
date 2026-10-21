import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const runtimeModules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;if(!runtimeModules)throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const{FileBlob,SpreadsheetFile}=await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const beforePath=process.env.CARESUITE_AZ_BEFORE,afterPath=process.env.CARESUITE_AZ_AFTER,outputPath=process.env.CARESUITE_AZ_AUDIT;
if(!beforePath||!afterPath||!outputPath)throw Error('CARESUITE_AZ_BEFORE, CARESUITE_AZ_AFTER und CARESUITE_AZ_AUDIT erforderlich');
const before=await SpreadsheetFile.importXlsx(await FileBlob.load(beforePath)),after=await SpreadsheetFile.importXlsx(await FileBlob.load(afterPath));
const ranges={Aufgaben:'A1:O270',Pakete:'A1:H104',Abnahme:'A1:Z100',Quellen:'A1:Z100'};
function col(i){let r='';for(let v=i+1;v>0;v=Math.floor((v-1)/26))r=String.fromCharCode(65+((v-1)%26))+r;return r}
const changedCells=[];let formulasBefore=0,formulasAfter=0;
for(const[sheetName,range]of Object.entries(ranges)){const l=before.worksheets.getItem(sheetName).getRange(range),r=after.worksheets.getItem(sheetName).getRange(range),lv=l.values,rv=r.values,lf=l.formulas,rf=r.formulas;for(let row=0;row<lv.length;row++)for(let column=0;column<lv[row].length;column++){if(lf[row]?.[column])formulasBefore++;if(rf[row]?.[column])formulasAfter++;if(JSON.stringify(lv[row]?.[column])!==JSON.stringify(rv[row]?.[column])||(lf[row]?.[column]??'')!==(rf[row]?.[column]??''))changedCells.push(`${sheetName}!${col(column)}${row+1}`)}}
const expected=['Aufgaben!M24','Aufgaben!O24','Pakete!G13'];if(JSON.stringify(changedCells)!==JSON.stringify(expected))throw Error(`Unerwartete Zelländerungen: ${JSON.stringify(changedCells)}`);
if(formulasBefore!==264||formulasAfter!==264)throw Error(`Formelbestand geändert: ${formulasBefore}/${formulasAfter}`);
function xml(path,name){return execFileSync('unzip',['-p',path,name],{maxBuffer:30_000_000})}
function list(path,prefix){return execFileSync('unzip',['-Z1',path],{encoding:'utf8'}).trim().split('\n').filter(n=>n.startsWith(prefix)).sort()}
let logicalStylesCompared=0,styleAssignmentDifferences=0,rowHeightsCompared=0;const rowHeightDifferences=[];
for(const sheetName of list(beforePath,'xl/worksheets/sheet').filter(n=>/sheet\d+\.xml$/.test(n))){const left=xml(beforePath,sheetName).toString(),right=xml(afterPath,sheetName).toString(),styleMap=v=>new Map([...v.matchAll(/<(?:x:)?c\s+([^>]*\br="([A-Z]+\d+)"[^>]*)>/g)].map(m=>[m[2],/\bs="(\d+)"/.exec(m[1])?.[1]??''])),rowMap=v=>new Map([...v.matchAll(/<(?:x:)?row\s+([^>]*\br="(\d+)"[^>]*)>/g)].map(m=>[m[2],/\bht="([^"]+)"/.exec(m[1])?.[1]??''])),ls=styleMap(left),rs=styleMap(right);for(const k of new Set([...ls.keys(),...rs.keys()])){logicalStylesCompared++;if(ls.get(k)!==rs.get(k))styleAssignmentDifferences++}const lh=rowMap(left),rh=rowMap(right);for(const k of new Set([...lh.keys(),...rh.keys()])){rowHeightsCompared++;if(lh.get(k)!==rh.get(k))rowHeightDifferences.push(`${sheetName}:${k}:${lh.get(k)}->${rh.get(k)}`)}}
if(styleAssignmentDifferences)throw Error(`Stilzuordnungen geändert: ${styleAssignmentDifferences}`);
if(JSON.stringify(rowHeightDifferences)!==JSON.stringify(['xl/worksheets/sheet1.xml:24:390->450','xl/worksheets/sheet2.xml:13:250->290']))throw Error(`Unerwartete Zeilenhöhen: ${JSON.stringify(rowHeightDifferences)}`);
if(!xml(beforePath,'xl/styles.xml').equals(xml(afterPath,'xl/styles.xml')))throw Error('styles.xml verändert');
const normalizeWorkbook=v=>v.toString().replace(/r:id="R[^"]+"/g,'r:id="RID"');if(normalizeWorkbook(xml(beforePath,'xl/workbook.xml'))!==normalizeWorkbook(xml(afterPath,'xl/workbook.xml')))throw Error('Workbook-Struktur verändert');
const relationshipTargets=v=>[...v.toString().matchAll(/Target="([^"]+)"/g)].map(m=>m[1]).sort();if(JSON.stringify(relationshipTargets(xml(beforePath,'xl/_rels/workbook.xml.rels')))!==JSON.stringify(relationshipTargets(xml(afterPath,'xl/_rels/workbook.xml.rels'))))throw Error('Workbook-Beziehungen verändert');
const bt=list(beforePath,'xl/tables/'),at=list(afterPath,'xl/tables/');if(JSON.stringify(bt)!==JSON.stringify(at)||bt.some(n=>!xml(beforePath,n).equals(xml(afterPath,n))))throw Error('Tabellen verändert');
const acceptedTotal=after.worksheets.getItem('Aufgaben').getRange('N9:N270').values.flat().filter(v=>v==='Abgenommen').length;
const startedTotal=after.worksheets.getItem('Aufgaben').getRange('H9:H270').values.flat().filter(v=>v!=='Bestand zu prüfen').length;
if(acceptedTotal!==1||startedTotal!==199)throw Error(`Statussummen: ${acceptedTotal}/${startedTotal}`);
const bb=await fs.readFile(beforePath),ab=await fs.readFile(afterPath),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const result={checkpoint:308,sourceCheckpoint:307,sourceSize:bb.length,sourceSha256:sha(bb),resultSize:ab.length,resultSha256:sha(ab),changedCells,formulas:formulasAfter,logicalStylesCompared,styleAssignmentDifferences,rowHeightsCompared,rowHeightDifferences,acceptedTotal,startedTotal,stylesXmlIdentical:true,workbookStructureIdentical:true,workbookRelationshipTargetsIdentical:true,tablesIdentical:true,visualQa:{taskBeforeAndAfter:true,packetBeforeAndAfter:true,applicationDesignAcceptance:false}};
await fs.writeFile(outputPath,`${JSON.stringify(result,null,2)}\n`);console.log(JSON.stringify(result));
