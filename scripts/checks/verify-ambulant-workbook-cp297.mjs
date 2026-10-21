import { readFileSync } from 'node:fs';

const templateUrl=new URL('./verify-ambulant-workbook-cp295.mjs',import.meta.url);
let source=readFileSync(templateUrl,'utf8');
const replacements=[
 ["await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`)","await import(`file://${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`)",1],
 ["const expected=['Aufgaben!M20','Aufgaben!O20','Pakete!G12'];","const expected=['Aufgaben!M23','Aufgaben!O23','Pakete!G13'];",1],
 ["['xl/worksheets/sheet1.xml!20','xl/worksheets/sheet2.xml!12']","['xl/worksheets/sheet1.xml!23','xl/worksheets/sheet2.xml!13']",1],
 ['checkpoint:295,sourceCheckpoint:294','checkpoint:297,sourceCheckpoint:296',1],
];
for(const[oldValue,newValue,expected]of replacements){const actual=source.split(oldValue).length-1;if(actual!==expected)throw Error(`CP295-Arbeitslistenprüfer geändert: ${oldValue} (${actual}/${expected})`);source=source.replace(oldValue,newValue);}
await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
