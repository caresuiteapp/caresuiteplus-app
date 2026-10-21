import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';

const source = process.env.CARESUITE_AZ_SOURCE;
const catalogPath = process.env.CARESUITE_AZ_CATALOG;
const output = process.env.CARESUITE_AZ_RESULT;
const preview = process.env.CARESUITE_AZ_PREVIEW_DIR;
const planPath = process.env.CARESUITE_AZ_PLAN;
if (!source || !catalogPath || !output || !preview || !planPath) throw new Error('Source, catalog, result, previews and plan are required.');

const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
if (catalog.version !== 324) throw new Error(`Katalog ${catalog.version} statt 324`);
const book = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const tasks = book.worksheets.getItem('Aufgaben');
const packets = book.worksheets.getItem('Pakete');
const taskRows = new Map(tasks.getRange('A9:A270').values.map((row, index) => [row[0], index + 9]));
const packetRows = new Map(packets.getRange('A8:A104').values.map((row, index) => [row[0], index + 8]));
const taskIds = Array.from({ length: 10 }, (_, index) => `P-${String(index + 1).padStart(2, '0')}`);
const packetIds = Array.from({ length: 4 }, (_, index) => `P-P0${index + 1}`);
const edits = [];

function plan(sheetName, address, value) {
  const cell = book.worksheets.getItem(sheetName).getRange(address);
  if (cell.formulas[0][0]) throw new Error(`Formelzelle ${sheetName}!${address}`);
  const before = cell.values[0][0];
  if (before !== value) edits.push({ sheet: sheetName, address, before, value });
}

for (const id of taskIds) {
  const row = taskRows.get(id);
  const task = catalog.tasks.find(item => item.id === id);
  if (!row || !task) throw new Error(`${id} fehlt`);
  for (const [column, field] of [['H', 'implementation'], ['I', 'function'], ['M', 'evidence'], ['O', 'next']]) {
    plan('Aufgaben', `${column}${row}`, task[field]);
  }
}
for (const id of packetIds) {
  const row = packetRows.get(id);
  const packet = catalog.packets.find(item => item[0] === id);
  if (!row || !packet) throw new Error(`${id} fehlt`);
  plan('Pakete', `F${row}`, packet[5]);
  plan('Pakete', `G${row}`, packet[6]);
}

await fs.mkdir(preview, { recursive: true });
const views = [
  ['Aufgaben', 'H159:O163', 'p-first'],
  ['Aufgaben', 'H164:O168', 'p-last'],
  ['Pakete', 'F64:H67', 'p-packets'],
];
if (process.env.CARESUITE_AZ_PREVIEW_ONLY === '1') {
  for (const [sheetName, range, name] of views) {
    const image = await book.render({ sheetName, range, scale: 1, format: 'png' });
    await fs.writeFile(`${preview}/before-${name}.png`, new Uint8Array(await image.arrayBuffer()));
  }
  console.log(JSON.stringify({ readOnly: true, plannedChangedCells: edits.length, views: views.length }));
  process.exit(0);
}

const allowedRowHeightChanges = {
  Aufgaben: taskIds.map(id => taskRows.get(id)),
  Pakete: packetIds.map(id => packetRows.get(id)),
};
await fs.writeFile(planPath, `${JSON.stringify({ checkpoint: 324, edits, allowedRowHeightChanges }, null, 2)}\n`);
for (const edit of edits) book.worksheets.getItem(edit.sheet).getRange(edit.address).values = [[edit.value]];
for (const [sheet, rows, lastColumn] of [[tasks, allowedRowHeightChanges.Aufgaben, 'O'], [packets, allowedRowHeightChanges.Pakete, 'H']]) {
  for (const row of rows) {
    const format = sheet.getRange(`A${row}:${lastColumn}${row}`).format;
    format.autofitRows();
    const fitted = format.rowHeight;
    if (typeof fitted !== 'number' || fitted + 4 > 409.5) throw new Error(`Nachweis für Zeile ${row} zu lang`);
    format.rowHeight = fitted + 4;
  }
}
book.recalculate();
const errors = await book.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',
  options: { useRegex: true, maxResults: 100 },
  summary: 'CP324 formula error scan',
});
if (!errors.ndjson.includes('matched 0 entries')) throw new Error(errors.ndjson);
if (tasks.getRange('N9:N270').values.flat().filter(value => value === 'Abgenommen').length !== 1) throw new Error('Abnahmen verändert');
await (await SpreadsheetFile.exportXlsx(book)).save(output);
const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
for (const [sheetName, range, name] of views) {
  const image = await saved.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(`${preview}/after-${name}.png`, new Uint8Array(await image.arrayBuffer()));
}
await fs.writeFile(`${output}.formula-errors.ndjson`, errors.ndjson);
console.log(JSON.stringify({ checkpoint: 324, changedCells: edits.length, taskRows: taskIds.length, packetRows: packetIds.length, formulaErrors: 0, accepted: 1, previews: views.length }));
