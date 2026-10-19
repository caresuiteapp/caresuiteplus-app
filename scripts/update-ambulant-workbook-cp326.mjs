import fs from 'node:fs/promises';
const { FileBlob, SpreadsheetFile }=await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@oai/artifact-tool/dist/artifact_tool.mjs');

const source=process.env.CARESUITE_AZ_SOURCE, catalogPath=process.env.CARESUITE_AZ_CATALOG;
const output=process.env.CARESUITE_AZ_RESULT, preview=process.env.CARESUITE_AZ_PREVIEW_DIR, planPath=process.env.CARESUITE_AZ_PLAN;
if(!source||!catalogPath||!output||!preview||!planPath)throw Error('Source, catalog, result, previews and edit plan are required.');
const catalog=JSON.parse(await fs.readFile(catalogPath,'utf8'));
if(catalog.version!==326)throw Error('Final catalog must be CP326');
const book=await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const tasks=book.worksheets.getItem('Aufgaben'),packets=book.worksheets.getItem('Pakete');
const taskRows=new Map(tasks.getRange('A9:A270').values.map((r,n)=>[r[0],n+9]));
const packetRows=new Map(packets.getRange('A8:A104').values.map((r,n)=>[r[0],n+8]));
const baseline=JSON.parse(await fs.readFile(process.env.CARESUITE_AZ_NATIVE_BASELINE,'utf8'));
const edits=[],preserve=[];
function plan(sheet,address,value){
  const cell=book.worksheets.getItem(sheet).getRange(address);
  if(cell.formulas[0][0])throw Error('Formula edit: '+address);
  const before=baseline[sheet][address]?.[0]??'';
  if(before!==value)edits.push({sheet,address,before,value});
  else if(typeof before==='string'&&before&&cell.values[0][0]!==before)preserve.push({sheet,address,value:before});
}
for(const task of catalog.tasks){
  const row=taskRows.get(task.id);if(!row)throw Error(task.id+' missing');
  for(const[column,field]of[['H','implementation'],['I','function'],['M','evidence'],['O','next']])plan('Aufgaben',`${column}${row}`,task[field]);
}
for(const packet of catalog.packets){
  const row=packetRows.get(packet[0]);if(!row)throw Error(packet[0]+' missing');
  plan('Pakete',`F${row}`,packet[5]);plan('Pakete',`G${row}`,packet[6]);
}
plan('Pakete','A2','Arbeitspakete');
plan('Pakete','A3','Zusammenhängende Abläufe gemeinsam umsetzen und prüfen. Fachaufgaben und Abnahmen bleiben einzeln nachvollziehbar.');
const changedRows=sheet=>[...new Set(edits.filter(e=>e.sheet===sheet).map(e=>Number(e.address.replace(/^[A-Z]+/,''))))].filter(r=>r>=8);
const allowedRowHeightChanges={Aufgaben:changedRows('Aufgaben'),Pakete:changedRows('Pakete')};
await fs.mkdir(preview,{recursive:true});
await fs.writeFile(planPath,JSON.stringify({checkpoint:326,edits,allowedRowHeightChanges},null,2)+'\n');
const views=Array.from({length:10},(_,n)=>['Aufgaben',`M${169+n}:O${169+n}`,`q-${String(n+1).padStart(2,'0')}`])
  .concat(Array.from({length:4},(_,n)=>['Pakete',`F${68+n}:H${68+n}`,`q-packet-${n+1}`]))
  .concat([['Pakete','A2:H3','guidance']]);
for(const[sheetName,range,name]of views){const png=await book.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(`${preview}/before-${name}.png`,new Uint8Array(await png.arrayBuffer()));}
for(const edit of[...edits,...preserve])book.worksheets.getItem(edit.sheet).getRange(edit.address).values=[[edit.value]];
for(const[sheet,rows,last]of[[tasks,allowedRowHeightChanges.Aufgaben,'O'],[packets,allowedRowHeightChanges.Pakete,'H']])for(const row of rows){
  const format=sheet.getRange(`A${row}:${last}${row}`).format;format.autofitRows();const fitted=format.rowHeight;
  if(typeof fitted!=='number'||fitted+4>409.5)throw Error('Changed row too tall: '+row);format.rowHeight=fitted+4;
}
book.recalculate();
const errors=await book.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},summary:'CP326 formula scan'});
if(!errors.ndjson.includes('matched 0 entries'))throw Error(errors.ndjson);
if(tasks.getRange('N9:N270').values.flat().filter(v=>v==='Abgenommen').length!==1)throw Error('Acceptance changed');
await(await SpreadsheetFile.exportXlsx(book)).save(output);
const saved=await SpreadsheetFile.importXlsx(await FileBlob.load(output));
for(const[sheetName,range,name]of views){const png=await saved.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(`${preview}/after-${name}.png`,new Uint8Array(await png.arrayBuffer()));}
await fs.writeFile(`${output}.formula-errors.ndjson`,errors.ndjson);
console.log(JSON.stringify({checkpoint:326,changedCells:edits.length,changedTaskRows:allowedRowHeightChanges.Aufgaben.length,changedPacketRows:allowedRowHeightChanges.Pakete.length,preservedNativeStrings:preserve.length,formulaErrors:0,accepted:1,previews:views.length}));
