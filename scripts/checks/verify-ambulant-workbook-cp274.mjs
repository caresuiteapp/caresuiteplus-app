import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const runtimeModules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if(!runtimeModules)throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const{FileBlob,SpreadsheetFile}=await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const beforePath=process.env.CARESUITE_AZ_BEFORE,afterPath=process.env.CARESUITE_AZ_AFTER,outputPath=process.env.CARESUITE_AZ_AUDIT;
if(!beforePath||!afterPath||!outputPath)throw Error('CARESUITE_AZ_BEFORE, CARESUITE_AZ_AFTER und CARESUITE_AZ_AUDIT erforderlich');
const before=await SpreadsheetFile.importXlsx(await FileBlob.load(beforePath)),after=await SpreadsheetFile.importXlsx(await FileBlob.load(afterPath));
const ranges={Aufgaben:'A1:O270',Pakete:'A1:H104',Abnahme:'A1:Z100',Quellen:'A1:Z100'};
function columnName(index){let result='';for(let value=index+1;value>0;value=Math.floor((value-1)/26))result=String.fromCharCode(65+((value-1)%26))+result;return result;}
const changedCells=[];let formulasBefore=0,formulasAfter=0;
for(const[sheetName,range]of Object.entries(ranges)){const left=before.worksheets.getItem(sheetName).getRange(range),right=after.worksheets.getItem(sheetName).getRange(range),lv=left.values,rv=right.values,lf=left.formulas,rf=right.formulas;for(let row=0;row<lv.length;row+=1)for(let col=0;col<lv[row].length;col+=1){if(lf[row]?.[col])formulasBefore+=1;if(rf[row]?.[col])formulasAfter+=1;if(JSON.stringify(lv[row]?.[col])!==JSON.stringify(rv[row]?.[col])||(lf[row]?.[col]??'')!==(rf[row]?.[col]??''))changedCells.push(`${sheetName}!${columnName(col)}${row+1}`);}}
const expected=['Aufgaben!H257','Aufgaben!I257','Aufgaben!M257','Aufgaben!O257','Pakete!G100'];
if(JSON.stringify(changedCells)!==JSON.stringify(expected))throw Error(`Unerwartete Zelländerungen: ${JSON.stringify(changedCells)}`);
if(formulasBefore!==264||formulasAfter!==264)throw Error(`Formelbestand geändert: ${formulasBefore}/${formulasAfter}`);
function xml(path,name){return execFileSync('unzip',['-p',path,name],{maxBuffer:20_000_000});}
function list(path,prefix){return execFileSync('unzip',['-Z1',path],{encoding:'utf8'}).trim().split('\n').filter(name=>name.startsWith(prefix)).sort();}
const sheetNames=list(beforePath,'xl/worksheets/sheet').filter(name=>/sheet\d+\.xml$/.test(name));let logicalStylesCompared=0,styleAssignmentDifferences=0,rowHeightsCompared=0,rowHeightDifferences=0;
for(const sheetName of sheetNames){const left=xml(beforePath,sheetName).toString('utf8'),right=xml(afterPath,sheetName).toString('utf8');const styleMap=value=>new Map([...value.matchAll(/<(?:x:)?c\s+([^>]*\br="([A-Z]+\d+)"[^>]*)>/g)].map(match=>[match[2],/\bs="(\d+)"/.exec(match[1])?.[1]??'']));const rowMap=value=>new Map([...value.matchAll(/<(?:x:)?row\s+([^>]*\br="(\d+)"[^>]*)>/g)].map(match=>[match[2],/\bht="([^"]+)"/.exec(match[1])?.[1]??'']));const ls=styleMap(left),rs=styleMap(right);for(const key of new Set([...ls.keys(),...rs.keys()])){logicalStylesCompared+=1;if(ls.get(key)!==rs.get(key))styleAssignmentDifferences+=1;}const lh=rowMap(left),rh=rowMap(right);for(const key of new Set([...lh.keys(),...rh.keys()])){rowHeightsCompared+=1;if(lh.get(key)!==rh.get(key))rowHeightDifferences+=1;}}
if(styleAssignmentDifferences||rowHeightDifferences)throw Error(`Stil- oder Zeilenhöhenänderung: ${styleAssignmentDifferences}/${rowHeightDifferences}`);
if(!xml(beforePath,'xl/styles.xml').equals(xml(afterPath,'xl/styles.xml')))throw Error('styles.xml wurde verändert');
const beforeTables=list(beforePath,'xl/tables/'),afterTables=list(afterPath,'xl/tables/');if(JSON.stringify(beforeTables)!==JSON.stringify(afterTables)||beforeTables.some(name=>!xml(beforePath,name).equals(xml(afterPath,name))))throw Error('Tabellendefinitionen wurden verändert');
const acceptedTotal=after.worksheets.getItem('Aufgaben').getRange('N9:N270').values.flat().filter(value=>value==='Abgenommen').length;if(acceptedTotal!==1)throw Error(`Unerwartete Abnahmezahl: ${acceptedTotal}`);
const bytesBefore=await fs.readFile(beforePath),bytesAfter=await fs.readFile(afterPath),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const result={checkpoint:274,sourceVersion:227,sourceSize:bytesBefore.length,sourceSha256:sha(bytesBefore),resultSize:bytesAfter.length,resultSha256:sha(bytesAfter),changedCells,formulas:formulasAfter,logicalStylesCompared,styleAssignmentDifferences,rowHeightsCompared,rowHeightDifferences,acceptedTotal,stylesXmlIdentical:true,tablesIdentical:true,visualQa:{taskBeforeAndAfter:true,packetBeforeAndAfter:true,applicationDesignAcceptance:false}};
await fs.writeFile(outputPath,`${JSON.stringify(result,null,2)}\n`);console.log(JSON.stringify(result));
