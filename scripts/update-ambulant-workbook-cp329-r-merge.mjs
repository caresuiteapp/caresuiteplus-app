import fs from 'node:fs/promises';
const { FileBlob, SpreadsheetFile } = await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/@oai/artifact-tool/dist/artifact_tool.mjs');

const source = process.env.CARESUITE_AZ_SOURCE;
const catalogPath = process.env.CARESUITE_AZ_CATALOG;
const output = process.env.CARESUITE_AZ_RESULT;
const preview = process.env.CARESUITE_AZ_PREVIEW_DIR;
const planPath = process.env.CARESUITE_AZ_PLAN;
if (!source || !catalogPath || !output || !preview || !planPath) throw Error('Source, catalog, result, previews and edit plan are required.');
const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
if (catalog.version !== 329) throw Error('Final catalog must be CP329');
const book = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const tasks = book.worksheets.getItem('Aufgaben');
const packets = book.worksheets.getItem('Pakete');
const taskRows = new Map(tasks.getRange('A9:A270').values.map((row, index) => [row[0], index + 9]));
const packetRows = new Map(packets.getRange('A8:A104').values.map((row, index) => [row[0], index + 8]));
const edits = [];
function plan(sheet, address, value) {
  const cell = book.worksheets.getItem(sheet).getRange(address);
  if (cell.formulas[0][0]) throw Error('Formula edit: ' + address);
  const before = cell.values[0][0] ?? '';
  if (before !== value) edits.push({ sheet, address, before, value });
}
for (const task of catalog.tasks.filter(task => /^R-(0[1-9]|1[0-2])$/.test(task.id))) {
  const row = taskRows.get(task.id);
  if (!row) throw Error(task.id + ' missing');
  for (const [column, field] of [['H', 'implementation'], ['I', 'function'], ['M', 'evidence'], ['O', 'next']]) plan('Aufgaben', `${column}${row}`, task[field]);
}
for (const packet of catalog.packets.filter(packet => /^R-P0[1-4]$/.test(packet[0]))) {
  const row = packetRows.get(packet[0]);
  if (!row) throw Error(packet[0] + ' missing');
  plan('Pakete', `F${row}`, packet[5]);
  plan('Pakete', `G${row}`, packet[6]);
}
const changedRows = sheet => [...new Set(edits.filter(edit => edit.sheet === sheet).map(edit => Number(edit.address.replace(/^[A-Z]+/, ''))))].filter(row => row >= 8);
const allowedRowHeightChanges = { Aufgaben: changedRows('Aufgaben'), Pakete: changedRows('Pakete') };
const views = catalog.tasks.filter(task => /^R-(0[1-9]|1[0-2])$/.test(task.id)).map(task => ['Aufgaben', `M${taskRows.get(task.id)}:O${taskRows.get(task.id)}`, task.id.toLowerCase()])
  .concat(catalog.packets.filter(packet => /^R-P0[1-4]$/.test(packet[0])).map(packet => ['Pakete', `F${packetRows.get(packet[0])}:H${packetRows.get(packet[0])}`, packet[0].toLowerCase()]));
await fs.mkdir(preview, { recursive: true });
if (process.env.CARESUITE_AZ_PREVIEW_ONLY === '1') {
  for (const [sheetName, range, name] of views) {
    const png = await book.render({ sheetName, range, scale: 1, format: 'png' });
    await fs.writeFile(`${preview}/before-${name}.png`, new Uint8Array(await png.arrayBuffer()));
  }
  console.log(JSON.stringify({ readOnly: true, proposedChangedCells: edits.length, previews: views.length }));
  process.exit(0);
}
await fs.writeFile(planPath, JSON.stringify({ checkpoint: 329, edits, allowedRowHeightChanges }, null, 2) + '\n');
for (const edit of edits) book.worksheets.getItem(edit.sheet).getRange(edit.address).values = [[edit.value]];
for (const [sheet, rows, last] of [[tasks, allowedRowHeightChanges.Aufgaben, 'O'], [packets, allowedRowHeightChanges.Pakete, 'H']]) for (const row of rows) {
  const format = sheet.getRange(`A${row}:${last}${row}`).format;
  format.autofitRows();
  const fitted = format.rowHeight;
  if (typeof fitted !== 'number' || fitted + 4 > 409.5) throw Error('Changed row too tall: ' + row);
  format.rowHeight = fitted + 4;
}
book.recalculate();
const errors = await book.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 100 }, summary: 'CP329 merged formula scan' });
if (!errors.ndjson.includes('matched 0 entries')) throw Error(errors.ndjson);
if (tasks.getRange('N9:N270').values.flat().filter(value => value === 'Abgenommen').length !== 1) throw Error('Acceptance changed');
await (await SpreadsheetFile.exportXlsx(book)).save(output);
const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
for (const [sheetName, range, name] of views) {
  const png = await saved.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(`${preview}/after-${name}.png`, new Uint8Array(await png.arrayBuffer()));
}
await fs.writeFile(`${output}.formula-errors.ndjson`, errors.ndjson);
console.log(JSON.stringify({ checkpoint: 329, changedCells: edits.length, changedTaskRows: allowedRowHeightChanges.Aufgaben.length, changedPacketRows: allowedRowHeightChanges.Pakete.length, formulaErrors: 0, accepted: 1, previews: views.length }));
