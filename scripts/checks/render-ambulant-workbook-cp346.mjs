import fs from 'node:fs/promises';
const runtimeModules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;if(!runtimeModules)throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const{FileBlob,SpreadsheetFile}=await import(`file://${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const[file,output]=process.argv.slice(2);if(!file||!output)throw Error('usage: file output');await fs.mkdir(output,{recursive:true});
const workbook=await SpreadsheetFile.importXlsx(await FileBlob.load(file));
const views=[];
for(let row=77;row<=92;row++)views.push(['Aufgaben',`A${row}:O${row}`,`H-${String(row-76).padStart(2,'0')}.png`]);
for(let row=34;row<=39;row++)views.push(['Pakete',`A${row}:H${row}`,`H-P${String(row-33).padStart(2,'0')}.png`]);
for(const[sheetName,range,name]of views){const rendered=await workbook.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(`${output}/${name}`,new Uint8Array(await rendered.arrayBuffer()));}
const errors=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:300},maxChars:3000});if(!errors.ndjson.includes('matched 0 entries'))throw Error(errors.ndjson);
console.log(JSON.stringify({views:views.length,formulaErrors:0}));
