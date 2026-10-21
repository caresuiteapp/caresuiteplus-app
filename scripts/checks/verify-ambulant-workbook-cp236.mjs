import process from 'node:process';

const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const sourceFile = process.env.CARESUITE_AZ_SOURCE;
const resultFile = process.env.CARESUITE_AZ_RESULT;
if (!runtimeModules || !sourceFile || !resultFile) {
  throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES, CARESUITE_AZ_SOURCE und CARESUITE_AZ_RESULT erforderlich');
}

const { FileBlob, SpreadsheetFile } = await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const [before, after] = await Promise.all([
  SpreadsheetFile.importXlsx(await FileBlob.load(sourceFile)),
  SpreadsheetFile.importXlsx(await FileBlob.load(resultFile)),
]);

const ranges = [
  ['Aufgaben', 'A1:O270'],
  ['Pakete', 'A1:H104'],
  ['Abnahme', 'A1:Z100'],
  ['Quellen', 'A1:Z100'],
];
const expectedValueChanges = new Set([
  'Aufgaben!H214',
  'Aufgaben!I214',
  'Aufgaben!M214',
  'Aufgaben!O214',
  'Pakete!F85',
  'Pakete!G85',
]);

function columnName(index) {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

const changedValues = [];
const changedFormulas = [];
let formulaCountBefore = 0;
let formulaCountAfter = 0;
for (const [sheetName, range] of ranges) {
  const beforeSheet = before.worksheets.getItem(sheetName);
  const afterSheet = after.worksheets.getItem(sheetName);
  const beforeRange = beforeSheet.getRange(range);
  const afterRange = afterSheet.getRange(range);
  const beforeValues = beforeRange.values;
  const afterValues = afterRange.values;
  const beforeFormulas = beforeRange.formulas;
  const afterFormulas = afterRange.formulas;
  const start = range.split(':')[0].match(/^([A-Z]+)(\d+)$/);
  const startColumn = [...start[1]].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
  const startRow = Number(start[2]) - 1;
  for (let row = 0; row < beforeValues.length; row += 1) {
    for (let column = 0; column < beforeValues[row].length; column += 1) {
      const address = `${sheetName}!${columnName(startColumn + column)}${startRow + row + 1}`;
      if (JSON.stringify(beforeValues[row][column]) !== JSON.stringify(afterValues[row][column])) changedValues.push(address);
      if ((beforeFormulas[row]?.[column] ?? '') !== (afterFormulas[row]?.[column] ?? '')) changedFormulas.push(address);
      if (beforeFormulas[row]?.[column]) formulaCountBefore += 1;
      if (afterFormulas[row]?.[column]) formulaCountAfter += 1;
    }
  }
}

const unexpectedValueChanges = changedValues.filter((address) => !expectedValueChanges.has(address));
const missingValueChanges = [...expectedValueChanges].filter((address) => !changedValues.includes(address));
if (unexpectedValueChanges.length || missingValueChanges.length || changedFormulas.length || formulaCountBefore !== 264 || formulaCountAfter !== 264) {
  throw Error(JSON.stringify({ changedValues, unexpectedValueChanges, missingValueChanges, changedFormulas, formulaCountBefore, formulaCountAfter }));
}

const errors = await after.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',
  options: { useRegex: true, maxResults: 300 },
  maxChars: 3000,
});
if (!errors.ndjson.includes('matched 0 entries')) throw Error(`Arbeitsmappe enthält Fehlerwerte: ${errors.ndjson}`);

console.log(JSON.stringify({
  sheets: ranges.map(([sheet]) => sheet),
  changedValues,
  changedFormulas,
  formulaCountBefore,
  formulaCountAfter,
  errorValues: 0,
}));
