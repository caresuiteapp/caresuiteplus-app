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
const taskIds = ['B-09', 'B-10', ...Array.from({ length: 10 }, (_, n) => `N-${String(n + 1).padStart(2, '0')}`), ...Array.from({ length: 8 }, (_, n) => `O-${String(n + 1).padStart(2, '0')}`), 'W-01', 'W-02', 'W-08'];
const packetIds = ['B-P03', 'B-P04', ...Array.from({ length: 4 }, (_, n) => `N-P0${n + 1}`), ...Array.from({ length: 3 }, (_, n) => `O-P0${n + 1}`), 'W-P01', 'W-P03'];
const edits = [];
function plan(sheet, address, value) {
  const cell = book.worksheets.getItem(sheet).getRange(address);
  if (cell.formulas[0][0]) throw Error('A planned edit would replace a formula: ' + address);
  const before = cell.values[0][0]; if (before !== value) edits.push({ sheet, address, before, value });
}
for (const id of taskIds) {
  const row = taskRows.get(id), task = catalog.tasks.find(t => t.id === id); if (!row || !task) throw Error(id + ' missing');
  for (const [column, field] of [['H', 'implementation'], ['I', 'function'], ['M', 'evidence'], ['O', 'next']]) plan('Aufgaben', `${column}${row}`, task[field]);
}
for (const id of packetIds) {
  const row = packetRows.get(id), packet = catalog.packets.find(p => p[0] === id); if (!row || !packet) throw Error(id + ' missing');
  plan('Pakete', `F${row}`, packet[5]); plan('Pakete', `G${row}`, packet[6]);
}
plan('Pakete', 'A2', 'Arbeitspakete');
plan('Pakete', 'A3', 'Zusammenhängende Abläufe gemeinsam umsetzen und prüfen. Fachaufgaben und Abnahmen bleiben einzeln nachvollziehbar.');
await fs.mkdir(preview, { recursive: true });
const views = [
  ['Aufgaben', 'H27:O28', 'b-status'], ['Aufgaben', 'M27:O28', 'b-evidence'],
  ['Aufgaben', 'M141:O143', 'n-first'], ['Aufgaben', 'M148:O150', 'n-last'],
  ['Aufgaben', 'M144:O147', 'n-middle'],
  ['Aufgaben', 'M151:O154', 'o-first'], ['Aufgaben', 'M155:O158', 'o-last'],
  ['Aufgaben', 'M231:O232', 'w-handover'], ['Aufgaben', 'M238:O238', 'w-followup'],
  ['Pakete', 'F14:H15', 'b-packets'], ['Pakete', 'F57:H60', 'n-packets'],
  ['Pakete', 'F61:H63', 'o-packets'], ['Pakete', 'F91:H93', 'w-packets'],
  ['Pakete', 'A2:H3', 'packet-guidance'],
];
const beforeOnly = process.env.CARESUITE_AZ_PREVIEW_ONLY === '1';
if (beforeOnly) {
  const selected = process.env.CARESUITE_AZ_ONLY_PREVIEW ? views.filter(v => process.env.CARESUITE_AZ_ONLY_PREVIEW.split(',').includes(v[2])) : views;
  for (const [sheetName, range, name] of selected) { const png = await book.render({ sheetName, range, scale: 1, format: 'png' }); await fs.writeFile(`${preview}/before-${name}.png`, new Uint8Array(await png.arrayBuffer())); }
  console.log(JSON.stringify({ readOnly: true, sourceCheckpoint: catalog.version, proposedChangedCells: edits.length, previews: views.length }));
} else {
  if (catalog.version !== 323) throw Error('Final catalog must be CP323');
  const allowedRowHeightChanges = { Aufgaben: taskIds.map(id => taskRows.get(id)), Pakete: packetIds.map(id => packetRows.get(id)) };
  await fs.writeFile(planPath, JSON.stringify({ checkpoint: 323, edits, allowedRowHeightChanges }, null, 2) + '\n');
  for (const edit of edits) book.worksheets.getItem(edit.sheet).getRange(edit.address).values = [[edit.value]];
  for (const [sheet, rows, last] of [[tasks, allowedRowHeightChanges.Aufgaben, 'O'], [packets, allowedRowHeightChanges.Pakete, 'H']]) {
    for (const row of rows) {
      const format = sheet.getRange(`A${row}:${last}${row}`).format; format.autofitRows();
      const fitted = format.rowHeight; if (typeof fitted !== 'number' || fitted + 4 > 409.5) throw Error('Changed row needs a shorter evidence summary: ' + row);
      format.rowHeight = fitted + 4;
    }
  }
  book.recalculate();
  const errors = await book.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 100 }, summary: 'CP323 final formula error scan' });
  if (!errors.ndjson.includes('matched 0 entries')) throw Error(errors.ndjson);
  if (tasks.getRange('N9:N270').values.flat().filter(v => v === 'Abgenommen').length !== 1) throw Error('Acceptance must remain unchanged.');
  await (await SpreadsheetFile.exportXlsx(book)).save(output);
  const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  const afterViews = process.env.CARESUITE_AZ_ONLY_AFTER_PREVIEW ? views.filter(v => process.env.CARESUITE_AZ_ONLY_AFTER_PREVIEW.split(',').includes(v[2])) : views;
  for (const [sheetName, range, name] of afterViews) { const png = await saved.render({ sheetName, range, scale: 1, format: 'png' }); await fs.writeFile(`${preview}/after-${name}.png`, new Uint8Array(await png.arrayBuffer())); }
  await fs.writeFile(`${output}.formula-errors.ndjson`, errors.ndjson);
  console.log(JSON.stringify({ checkpoint: 323, changedCells: edits.length, taskRows: taskIds.length, packetRows: packetIds.length, formulaErrors: 0, accepted: 1, previews: views.length }));
}
