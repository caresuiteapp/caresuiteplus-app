import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sourceFile=process.env.CARESUITE_AZ_SOURCE;
const resultFile=process.env.CARESUITE_AZ_RESULT;
if(!sourceFile||!resultFile)throw Error('CARESUITE_AZ_SOURCE und CARESUITE_AZ_RESULT erforderlich');

const entries=(file)=>execFileSync('unzip',['-Z1',file],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const read=(file,entry)=>execFileSync('unzip',['-p',file,entry]);
const sha=(value)=>createHash('sha256').update(value).digest('hex');
const sourceEntries=entries(sourceFile);const resultEntries=entries(resultFile);
const sourceSheets=sourceEntries.filter((entry)=>/^xl\/worksheets\/sheet\d+\.xml$/.test(entry));
const resultSheets=resultEntries.filter((entry)=>/^xl\/worksheets\/sheet\d+\.xml$/.test(entry));
assert.deepEqual(resultSheets,sourceSheets,'Worksheet-XML-Bestand geändert');

function nativeAssignments(file,sheets){
  const styles=[];const heights=[];
  for(const sheet of sheets){
    const xml=read(file,sheet).toString('utf8');
    for(const cell of xml.matchAll(/<(?:\w+:)?c\b[^>]*>/g)){
      const address=cell[0].match(/\br="([^"]+)"/);const style=cell[0].match(/\bs="(\d+)"/);
      if(address&&style)styles.push(`${sheet}:${address[1]}=${style[1]}`);
    }
    for(const row of xml.matchAll(/<(?:\w+:)?row\b[^>]*>/g)){
      const address=row[0].match(/\br="([^"]+)"/);const height=row[0].match(/\bht="([^"]+)"/);
      if(address&&height)heights.push(`${sheet}:${address[1]}=${height[1]}`);
    }
  }
  return{styles,heights};
}

const before=nativeAssignments(sourceFile,sourceSheets);const after=nativeAssignments(resultFile,resultSheets);
assert.deepEqual(after.styles,before.styles,'Logische Zellstilzuordnungen geändert');
assert.deepEqual(after.heights,before.heights,'Zeilenhöhen geändert');
assert.equal(before.styles.length,5218,'Unerwartete Zahl logischer Zellstile im Ausgangsstand');
assert.equal(before.heights.length,430,'Unerwartete Zahl gesetzter Zeilenhöhen im Ausgangsstand');

const styleBefore=read(sourceFile,'xl/styles.xml');const styleAfter=read(resultFile,'xl/styles.xml');
assert.deepEqual(styleAfter,styleBefore,'styles.xml geändert');
const sourceTables=sourceEntries.filter((entry)=>/^xl\/tables\/table\d+\.xml$/.test(entry));
const resultTables=resultEntries.filter((entry)=>/^xl\/tables\/table\d+\.xml$/.test(entry));
assert.deepEqual(resultTables,sourceTables,'Tabellen-XML-Bestand geändert');
const tableHashes=[];
for(const table of sourceTables){
  const beforeTable=read(sourceFile,table);const afterTable=read(resultFile,table);
  assert.deepEqual(afterTable,beforeTable,`${table} geändert`);tableHashes.push(sha(beforeTable));
}

console.log(JSON.stringify({logicalStylesCompared:before.styles.length,styleAssignmentDifferences:0,rowHeightsCompared:before.heights.length,rowHeightDifferences:0,styleXmlSha256BeforeAndAfter:sha(styleBefore),tableXmlSha256BeforeAndAfter:tableHashes}));
