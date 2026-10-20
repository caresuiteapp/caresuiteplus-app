import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const source = process.env.CARESUITE_AZ_SOURCE;
const catalogPath = process.env.CARESUITE_AZ_CATALOG;
const output = process.env.CARESUITE_AZ_RESULT;
const preview = process.env.CARESUITE_AZ_PREVIEW_DIR;
const planPath = process.env.CARESUITE_AZ_PLAN;
if (!source || !catalogPath || !output || !preview || !planPath) throw new Error('Source, catalog, result, previews and edit plan are required.');

const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
if (catalog.version !== 333) throw new Error('Final catalog must be CP333');
const book = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const tasks = book.worksheets.getItem('Aufgaben');
const packets = book.worksheets.getItem('Pakete');
const taskRows = new Map(tasks.getRange('A9:A270').values.map((row, index) => [row[0], index + 9]));
const packetRows = new Map(packets.getRange('A8:A104').values.map((row, index) => [row[0], index + 8]));
const edits = [];

function plan(sheet, address, value) {
  const cell = book.worksheets.getItem(sheet).getRange(address);
  if (cell.formulas[0][0]) throw new Error(`Formula edit: ${sheet}!${address}`);
  const before = cell.values[0][0] ?? '';
  if (before !== value) edits.push({ sheet, address, before, value });
}

for (const task of catalog.tasks.filter(task => /^V-0[1-8]$/.test(task.id))) {
  const row = taskRows.get(task.id);
  if (!row) throw new Error(`${task.id} missing`);
  plan('Aufgaben', `M${row}`, task.evidence);
  plan('Aufgaben', `O${row}`, task.next);
}
for (const packet of catalog.packets.filter(packet => /^V-P0[1-3]$/.test(packet[0]))) {
  const row = packetRows.get(packet[0]);
  if (!row) throw new Error(`${packet[0]} missing`);
  plan('Pakete', `G${row}`, packet[6]);
  plan('Pakete', `H${row}`, packet[7]);
}

const taskChangedRows = [...new Set(edits.filter(edit => edit.sheet === 'Aufgaben').map(edit => Number(edit.address.replace(/^[A-Z]+/, ''))))];
const packetChangedRows = [...new Set(edits.filter(edit => edit.sheet === 'Pakete').map(edit => Number(edit.address.replace(/^[A-Z]+/, ''))))];
if (edits.length !== 22 || taskChangedRows.length !== 8 || packetChangedRows.length !== 3) throw new Error(`Unexpected edit plan: ${edits.length}/${taskChangedRows.length}/${packetChangedRows.length}`);

await fs.mkdir(preview, { recursive: true });
for (const [sheetName, range, name] of [['Aufgaben', 'M223:O230', 'v-tasks'], ['Pakete', 'F88:H90', 'v-packets']]) {
  const png = await book.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(`${preview}/before-${name}.png`, new Uint8Array(await png.arrayBuffer()));
}
await fs.writeFile(planPath, `${JSON.stringify({ checkpoint: 333, source, edits, allowedRowHeightChanges: { Aufgaben: taskChangedRows, Pakete: packetChangedRows } }, null, 2)}\n`);

for (const edit of edits) book.worksheets.getItem(edit.sheet).getRange(edit.address).values = [[edit.value]];
for (const [sheet, rows, last] of [[tasks, taskChangedRows, 'O'], [packets, packetChangedRows, 'H']]) {
  for (const row of rows) {
    const format = sheet.getRange(`A${row}:${last}${row}`).format;
    format.autofitRows();
    const fitted = format.rowHeight;
    if (typeof fitted !== 'number' || fitted + 4 > 409.5) throw new Error(`Changed row too tall: ${sheet.name}!${row}`);
    format.rowHeight = fitted + 4;
  }
}

book.recalculate();
const keyValues = await book.inspect({ kind: 'table', range: 'Aufgaben!A223:O230', include: 'values,formulas', tableMaxRows: 8, tableMaxCols: 15, maxChars: 12000 });
const packetValues = await book.inspect({ kind: 'table', range: 'Pakete!A88:H90', include: 'values,formulas', tableMaxRows: 3, tableMaxCols: 8, maxChars: 8000 });
const errors = await book.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 100 }, summary: 'CP333 formula scan' });
if (!errors.ndjson.includes('matched 0 entries')) throw new Error(errors.ndjson);
if (tasks.getRange('N9:N270').values.flat().filter(value => value === 'Abgenommen').length !== 1) throw new Error('Acceptance changed');

await (await SpreadsheetFile.exportXlsx(book)).save(output);
const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
for (const [sheetName, range, name] of [['Aufgaben', 'M223:O230', 'v-tasks'], ['Pakete', 'F88:H90', 'v-packets']]) {
  const png = await saved.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(`${preview}/after-${name}.png`, new Uint8Array(await png.arrayBuffer()));
}
await fs.writeFile(`${output}.formula-errors.ndjson`, errors.ndjson);
await fs.writeFile(`${output}.key-values.ndjson`, `${keyValues.ndjson}\n${packetValues.ndjson}\n`);
console.log(JSON.stringify({ checkpoint: 333, changedCells: edits.length, changedTaskRows: taskChangedRows.length, changedPacketRows: packetChangedRows.length, formulaErrors: 0, accepted: 1, previews: 4 }));
