import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if (!runtimeModules) throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const { FileBlob, SpreadsheetFile } = await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);

const beforePath = process.env.CARESUITE_AZ_BEFORE;
const afterPath = process.env.CARESUITE_AZ_AFTER;
const outputPath = process.env.CARESUITE_AZ_AUDIT;
if (!beforePath || !afterPath || !outputPath) {
  throw Error('CARESUITE_AZ_BEFORE, CARESUITE_AZ_AFTER und CARESUITE_AZ_AUDIT erforderlich');
}

const before = await SpreadsheetFile.importXlsx(await FileBlob.load(beforePath));
const after = await SpreadsheetFile.importXlsx(await FileBlob.load(afterPath));
const ranges = { Aufgaben: 'A1:O270', Pakete: 'A1:H104', Abnahme: 'A1:Z100', Quellen: 'A1:Z100' };

const columnName = (index) => {
  let result = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
};

const changedCells = [];
let formulasBefore = 0;
let formulasAfter = 0;
for (const [sheetName, range] of Object.entries(ranges)) {
  const left = before.worksheets.getItem(sheetName).getRange(range);
  const right = after.worksheets.getItem(sheetName).getRange(range);
  const leftValues = left.values;
  const rightValues = right.values;
  const leftFormulas = left.formulas;
  const rightFormulas = right.formulas;
  for (let row = 0; row < leftValues.length; row += 1) {
    for (let column = 0; column < leftValues[row].length; column += 1) {
      if (leftFormulas[row]?.[column]) formulasBefore += 1;
      if (rightFormulas[row]?.[column]) formulasAfter += 1;
      if (
        JSON.stringify(leftValues[row]?.[column]) !== JSON.stringify(rightValues[row]?.[column])
        || (leftFormulas[row]?.[column] ?? '') !== (rightFormulas[row]?.[column] ?? '')
      ) {
        changedCells.push(`${sheetName}!${columnName(column)}${row + 1}`);
      }
    }
  }
}

const expectedChangedCells = [];
const previouslyStartedRows = new Set([66, 67, 70, 71, 72]);
for (let row = 65; row <= 76; row += 1) {
  if (!previouslyStartedRows.has(row)) expectedChangedCells.push(`Aufgaben!H${row}`, `Aufgaben!I${row}`);
  expectedChangedCells.push(`Aufgaben!M${row}`, `Aufgaben!O${row}`);
}
for (let row = 30; row <= 33; row += 1) expectedChangedCells.push(`Pakete!F${row}`, `Pakete!G${row}`);
if (JSON.stringify(changedCells) !== JSON.stringify(expectedChangedCells)) {
  throw Error(`Unerwartete Zelländerungen: ${JSON.stringify(changedCells)}`);
}
if (formulasBefore !== 264 || formulasAfter !== 264) {
  throw Error(`Formelbestand geändert: ${formulasBefore}/${formulasAfter}`);
}

const xml = (filePath, name) => execFileSync('unzip', ['-p', filePath, name], { maxBuffer: 30_000_000 });
const list = (filePath, prefix) => execFileSync('unzip', ['-Z1', filePath], { encoding: 'utf8' })
  .trim().split('\n').filter((name) => name.startsWith(prefix)).sort();
let logicalStylesCompared = 0;
let styleAssignmentDifferences = 0;
let rowHeightsCompared = 0;
const rowHeightDifferences = [];
for (const sheetName of list(beforePath, 'xl/worksheets/sheet').filter((name) => /sheet\d+\.xml$/.test(name))) {
  const left = xml(beforePath, sheetName).toString();
  const right = xml(afterPath, sheetName).toString();
  const styleMap = (value) => new Map([...value.matchAll(/<(?:x:)?c\s+([^>]*\br="([A-Z]+\d+)"[^>]*)>/g)]
    .map((match) => [match[2], /\bs="(\d+)"/.exec(match[1])?.[1] ?? '']));
  const rowMap = (value) => new Map([...value.matchAll(/<(?:x:)?row\s+([^>]*\br="(\d+)"[^>]*)>/g)]
    .map((match) => [match[2], /\bht="([^"]+)"/.exec(match[1])?.[1] ?? '']));
  const leftStyles = styleMap(left);
  const rightStyles = styleMap(right);
  for (const key of new Set([...leftStyles.keys(), ...rightStyles.keys()])) {
    logicalStylesCompared += 1;
    if (leftStyles.get(key) !== rightStyles.get(key)) styleAssignmentDifferences += 1;
  }
  const leftHeights = rowMap(left);
  const rightHeights = rowMap(right);
  for (const key of new Set([...leftHeights.keys(), ...rightHeights.keys()])) {
    rowHeightsCompared += 1;
    if (leftHeights.get(key) !== rightHeights.get(key)) {
      rowHeightDifferences.push(`${sheetName}:${key}:${leftHeights.get(key)}->${rightHeights.get(key)}`);
    }
  }
}
if (styleAssignmentDifferences) throw Error(`Stilzuordnungen geändert: ${styleAssignmentDifferences}`);
const expectedHeightRows = new Set([
  ...Array.from({ length: 12 }, (_, index) => `xl/worksheets/sheet1.xml:${65 + index}`),
  ...Array.from({ length: 4 }, (_, index) => `xl/worksheets/sheet2.xml:${30 + index}`),
]);
if (
  rowHeightDifferences.length !== expectedHeightRows.size
  || rowHeightDifferences.some((item) => !expectedHeightRows.has(item.split(':').slice(0, 2).join(':')))
) {
  throw Error(`Unerwartete Zeilenhöhen: ${JSON.stringify(rowHeightDifferences)}`);
}
if (!xml(beforePath, 'xl/styles.xml').equals(xml(afterPath, 'xl/styles.xml'))) throw Error('styles.xml verändert');

const normalizeWorkbook = (value) => value.toString().replace(/r:id="R[^"]+"/g, 'r:id="RID"');
if (normalizeWorkbook(xml(beforePath, 'xl/workbook.xml')) !== normalizeWorkbook(xml(afterPath, 'xl/workbook.xml'))) {
  throw Error('Workbook-Struktur verändert');
}
const relationshipTargets = (value) => [...value.toString().matchAll(/Target="([^"]+)"/g)]
  .map((match) => match[1]).sort();
if (
  JSON.stringify(relationshipTargets(xml(beforePath, 'xl/_rels/workbook.xml.rels')))
  !== JSON.stringify(relationshipTargets(xml(afterPath, 'xl/_rels/workbook.xml.rels')))
) {
  throw Error('Workbook-Beziehungen verändert');
}
const beforeTables = list(beforePath, 'xl/tables/');
const afterTables = list(afterPath, 'xl/tables/');
if (
  JSON.stringify(beforeTables) !== JSON.stringify(afterTables)
  || beforeTables.some((name) => !xml(beforePath, name).equals(xml(afterPath, name)))
) {
  throw Error('Tabellen verändert');
}

const acceptedTotal = after.worksheets.getItem('Aufgaben').getRange('N9:N270').values.flat()
  .filter((value) => value === 'Abgenommen').length;
const startedTotal = after.worksheets.getItem('Aufgaben').getRange('H9:H270').values.flat()
  .filter((value) => value !== 'Bestand zu prüfen').length;
if (acceptedTotal !== 1 || startedTotal !== 218) throw Error(`Statussummen: ${acceptedTotal}/${startedTotal}`);

const beforeBytes = await fs.readFile(beforePath);
const afterBytes = await fs.readFile(afterPath);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const result = {
  checkpoint: 314,
  sourceCheckpoint: 313,
  sourceSize: beforeBytes.length,
  sourceSha256: sha256(beforeBytes),
  resultSize: afterBytes.length,
  resultSha256: sha256(afterBytes),
  changedCells,
  formulas: formulasAfter,
  logicalStylesCompared,
  styleAssignmentDifferences,
  rowHeightsCompared,
  rowHeightDifferences,
  acceptedTotal,
  startedTotal,
  stylesXmlIdentical: true,
  workbookStructureIdentical: true,
  workbookRelationshipTargetsIdentical: true,
  tablesIdentical: true,
  visualQa: {
    tasksBeforeAndAfter: true,
    packetsBeforeAndAfter: true,
    applicationDesignAcceptance: false,
  },
};
await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
