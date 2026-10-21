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
const columnName=(index)=>{let result='';for(let value=index+1;value>0;value=Math.floor((value-1)/26))result=String.fromCharCode(65+((value-1)%26))+result;return result;};
const changedCells=[];let formulasBefore=0,formulasAfter=0;
for(const[sheetName,range]of Object.entries(ranges)){const left=before.worksheets.getItem(sheetName).getRange(range),right=after.worksheets.getItem(sheetName).getRange(range),lv=left.values,rv=right.values,lf=left.formulas,rf=right.formulas;for(let row=0;row<lv.length;row++)for(let column=0;column<lv[row].length;column++){if(lf[row]?.[column])formulasBefore++;if(rf[row]?.[column])formulasAfter++;if(JSON.stringify(lv[row]?.[column])!==JSON.stringify(rv[row]?.[column])||(lf[row]?.[column]??'')!==(rf[row]?.[column]??''))changedCells.push(`${sheetName}!${columnName(column)}${row+1}`);}}
const expected=['Aufgaben!M20','Aufgaben!O20','Pakete!G12'];
if(JSON.stringify(changedCells)!==JSON.stringify(expected))throw Error(`Unerwartete Zelländerungen: ${JSON.stringify(changedCells)}`);
if(formulasBefore!==264||formulasAfter!==264)throw Error(`Formelbestand geändert: ${formulasBefore}/${formulasAfter}`);
const xml=(path,name)=>execFileSync('unzip',['-p',path,name],{maxBuffer:20_000_000});
const list=(path,prefix='')=>execFileSync('unzip',['-Z1',path],{encoding:'utf8'}).trim().split('\n').filter((name)=>name.startsWith(prefix)).sort();
let logicalStylesCompared=0,styleAssignmentDifferences=0,rowHeightsCompared=0;const rowHeightDifferences=[];
for(const sheetName of list(beforePath,'xl/worksheets/sheet').filter((name)=>/sheet\d+\.xml$/.test(name))){const left=xml(beforePath,sheetName).toString(),right=xml(afterPath,sheetName).toString(),styleMap=(value)=>new Map([...value.matchAll(/<(?:x:)?c\s+([^>]*\br="([A-Z]+\d+)"[^>]*)>/g)].map((match)=>[match[2],/\bs="(\d+)"/.exec(match[1])?.[1]??''])),rowMap=(value)=>new Map([...value.matchAll(/<(?:x:)?row\s+([^>]*\br="(\d+)"[^>]*)>/g)].map((match)=>[match[2],/\bht="([^"]+)"/.exec(match[1])?.[1]??''])),leftStyles=styleMap(left),rightStyles=styleMap(right);for(const key of new Set([...leftStyles.keys(),...rightStyles.keys()])){logicalStylesCompared++;if(leftStyles.get(key)!==rightStyles.get(key))styleAssignmentDifferences++;}const leftRows=rowMap(left),rightRows=rowMap(right);for(const key of new Set([...leftRows.keys(),...rightRows.keys()])){rowHeightsCompared++;if(leftRows.get(key)!==rightRows.get(key))rowHeightDifferences.push(`${sheetName}!${key}`);}}
if(styleAssignmentDifferences)throw Error(`Zellstilzuordnungen verändert: ${styleAssignmentDifferences}`);
if(JSON.stringify(rowHeightDifferences)!==JSON.stringify(['xl/worksheets/sheet1.xml!20','xl/worksheets/sheet2.xml!12']))throw Error(`Unerwartete Zeilenhöhenänderungen: ${JSON.stringify(rowHeightDifferences)}`);
if(!xml(beforePath,'xl/styles.xml').equals(xml(afterPath,'xl/styles.xml')))throw Error('styles.xml verändert');
const beforeTables=list(beforePath,'xl/tables/'),afterTables=list(afterPath,'xl/tables/');if(JSON.stringify(beforeTables)!==JSON.stringify(afterTables)||beforeTables.some((name)=>!xml(beforePath,name).equals(xml(afterPath,name))))throw Error('Tabellen verändert');
const relationSemantics=(path,name)=>[...xml(path,name).toString().matchAll(/<Relationship\s+[^>]*Type="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g)].map((match)=>`${match[1]}|${match[2]}`).sort();
for(const name of ['_rels/.rels','xl/_rels/workbook.xml.rels','xl/worksheets/_rels/sheet1.xml.rels','xl/worksheets/_rels/sheet2.xml.rels','xl/worksheets/_rels/sheet3.xml.rels','xl/worksheets/_rels/sheet4.xml.rels'])if(JSON.stringify(relationSemantics(beforePath,name))!==JSON.stringify(relationSemantics(afterPath,name)))throw Error(`Beziehungsziele verändert: ${name}`);
const normalizeRelationshipIds=(value)=>value.toString().replace(/r:id="R[^"]+"/g,'r:id="REL"');
for(const name of ['xl/theme/theme1.xml','xl/worksheets/sheet3.xml','xl/worksheets/sheet4.xml','xl/tables/table1.xml','xl/tables/table2.xml','xl/tables/table3.xml','xl/tables/table4.xml'])if(normalizeRelationshipIds(xml(beforePath,name))!==normalizeRelationshipIds(xml(afterPath,name)))throw Error(`Unbeteiligter nativer Bestandteil verändert: ${name}`);
const acceptedTotal=after.worksheets.getItem('Aufgaben').getRange('N9:N270').values.flat().filter((value)=>value==='Abgenommen').length;if(acceptedTotal!==1)throw Error(`Abnahmen: ${acceptedTotal}`);
const beforeBytes=await fs.readFile(beforePath),afterBytes=await fs.readFile(afterPath),sha256=(value)=>crypto.createHash('sha256').update(value).digest('hex');
const result={checkpoint:295,sourceCheckpoint:294,sourceSize:beforeBytes.length,sourceSha256:sha256(beforeBytes),resultSize:afterBytes.length,resultSha256:sha256(afterBytes),changedCells,formulas:formulasAfter,logicalStylesCompared,styleAssignmentDifferences,rowHeightsCompared,rowHeightDifferences,acceptedTotal,stylesXmlIdentical:true,tablesIdentical:true,relationshipsSemanticIdentical:true,unrelatedNativePartsPreserved:true,visualQa:{taskBeforeAndAfter:true,packetBeforeAndAfter:true,applicationDesignAcceptance:false}};
await fs.writeFile(outputPath,`${JSON.stringify(result,null,2)}\n`);console.log(JSON.stringify(result));
