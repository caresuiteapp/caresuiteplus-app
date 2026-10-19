import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const source = process.env.CARESUITE_AZ_SOURCE, catalogPath = process.env.CARESUITE_AZ_CATALOG;
const output = process.env.CARESUITE_AZ_RESULT, preview = process.env.CARESUITE_AZ_PREVIEW_DIR, planPath = process.env.CARESUITE_AZ_PLAN;
if (!source || !catalogPath || !output || !preview || !planPath) throw Error('Source, catalog, result, previews and explicit edit plan are required.');
const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
const book = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const tasks = book.worksheets.getItem('Aufgaben'), packets = book.worksheets.getItem('Pakete');
const taskRows = new Map(tasks.getRange('A9:A270').values.map((r, n) => [r[0], n + 9]));
const packetRows = new Map(packets.getRange('A8:A104').values.map((r, n) => [r[0], n + 8]));
const taskIds = catalog.tasks.map(t=>t.id);
const packetIds = catalog.packets.map(p=>p[0]);
const edits = [], preserve = [];
const nativeBaseline = JSON.parse(await fs.readFile(process.env.CARESUITE_AZ_NATIVE_BASELINE, 'utf8'));
function plan(sheet, address, value) {
  const cell = book.worksheets.getItem(sheet).getRange(address);
  if (cell.formulas[0][0]) throw Error('A planned edit would replace a formula: ' + address);
  const before = nativeBaseline[sheet][address]?.[0] ?? '';
  if (before !== value) edits.push({ sheet, address, before, value });
  else if (typeof before==='string' && before && cell.values[0][0]!==before) preserve.push({sheet,address,value:before});
}
for (const id of taskIds) {
  const row = taskRows.get(id), task = catalog.tasks.find(t => t.id === id); if (!row || !task) throw Error(id + ' missing');
  for (const [column, field] of [['H', 'implementation'], ['I', 'function'], ['M', 'evidence'], ['O', 'next']]) plan('Aufgaben', `${column}${row}`, task[field]);
}
for (const id of packetIds) {
  const row = packetRows.get(id), packet = catalog.packets.find(p => p[0] === id); if (!row || !packet) throw Error(id + ' missing');
  plan('Pakete', `F${row}`, packet[5]); plan('Pakete', `G${row}`, packet[6]);
}
await fs.mkdir(preview, { recursive: true });
const views = taskIds.filter(id=>/^G-/.test(id)).map(id=>['Aufgaben',`M${taskRows.get(id)}:O${taskRows.get(id)}`,id.toLowerCase()]).concat(packetIds.filter(id=>/^G-/.test(id)).map(id=>['Pakete',`F${packetRows.get(id)}:H${packetRows.get(id)}`,id.toLowerCase()]));
const beforeOnly = process.env.CARESUITE_AZ_PREVIEW_ONLY === '1';
if (beforeOnly) {
  const selected = process.env.CARESUITE_AZ_ONLY_PREVIEW ? views.filter(v => process.env.CARESUITE_AZ_ONLY_PREVIEW.split(',').includes(v[2])) : views;
  for (const [sheetName, range, name] of selected) { const png = await book.render({ sheetName, range, scale: 1, format: 'png' }); await fs.writeFile(`${preview}/before-${name}.png`, new Uint8Array(await png.arrayBuffer())); }
  console.log(JSON.stringify({ readOnly: true, sourceCheckpoint: catalog.version, proposedChangedCells: edits.length, previews: views.length }));
} else {
  if (catalog.version !== 345) throw Error('Final catalog must be CP345');
  const changedRows=sheet=>[...new Set(edits.filter(e=>e.sheet===sheet).map(e=>Number(e.address.replace(/^[A-Z]+/,''))))].filter(row=>row>=8);
  const allowedRowHeightChanges = { Aufgaben: changedRows('Aufgaben'), Pakete: changedRows('Pakete') };
  await fs.writeFile(planPath, JSON.stringify({ checkpoint: 345, edits, allowedRowHeightChanges }, null, 2) + '\n');
  // Preserve native strings that the public value getter normalizes on import.
  // They are not value changes and must not cause row fitting outside the intended edits.
  for (const edit of [...edits,...preserve]) book.worksheets.getItem(edit.sheet).getRange(edit.address).values = [[edit.value]];
  for (const [sheet, rows, last] of [[tasks, allowedRowHeightChanges.Aufgaben, 'O'], [packets, allowedRowHeightChanges.Pakete, 'H']]) {
    for (const row of rows) {
      const format = sheet.getRange(`A${row}:${last}${row}`).format; format.autofitRows();
      const fitted = format.rowHeight; if (typeof fitted !== 'number' || fitted + 4 > 409.5) throw Error('Changed row needs a shorter evidence summary: ' + row);
      format.rowHeight = fitted + 4;
    }
  }
  book.recalculate();
  const errors = await book.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 100 }, summary: 'CP345 final formula error scan' });
  if (!errors.ndjson.includes('matched 0 entries')) throw Error(errors.ndjson);
  if (tasks.getRange('N9:N270').values.flat().filter(v => v === 'Abgenommen').length !== 1) throw Error('Acceptance must remain unchanged.');
  await (await SpreadsheetFile.exportXlsx(book)).save(output);
  const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  const afterViews = process.env.CARESUITE_AZ_ONLY_AFTER_PREVIEW ? views.filter(v => process.env.CARESUITE_AZ_ONLY_AFTER_PREVIEW.split(',').includes(v[2])) : views;
  for (const [sheetName, range, name] of afterViews) { const png = await saved.render({ sheetName, range, scale: 1, format: 'png' }); await fs.writeFile(`${preview}/after-${name}.png`, new Uint8Array(await png.arrayBuffer())); }
  await fs.writeFile(`${output}.formula-errors.ndjson`, errors.ndjson);
  console.log(JSON.stringify({ checkpoint: 345, changedCells: edits.length, taskRowsCompared: taskIds.length, packetRowsCompared: packetIds.length, changedTaskRows: allowedRowHeightChanges.Aufgaben.length, changedPacketRows: allowedRowHeightChanges.Pakete.length, preservedNativeStrings: preserve.length, formulaErrors: 0, accepted: 1, previews: views.length }));
}
