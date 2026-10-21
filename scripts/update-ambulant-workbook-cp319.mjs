import fs from 'node:fs/promises';

const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if (!runtimeModules) throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const { FileBlob, SpreadsheetFile } = await import(
  `${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`
);

const sourceFile = process.env.CARESUITE_AZ_SOURCE;
const catalogFile = process.env.CARESUITE_AZ_CATALOG;
const outputFile = process.env.CARESUITE_AZ_RESULT;
const previewDir = process.env.CARESUITE_AZ_PREVIEW_DIR;
if (!sourceFile || !catalogFile || !outputFile || !previewDir) {
  throw Error('CARESUITE_AZ_SOURCE, CARESUITE_AZ_CATALOG, CARESUITE_AZ_RESULT und CARESUITE_AZ_PREVIEW_DIR erforderlich');
}

const catalog = JSON.parse(await fs.readFile(catalogFile, 'utf8'));
if (catalog.version !== 319) throw Error(`Katalog ist nicht CP319: ${catalog.version}`);
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(sourceFile));
const tasks = workbook.worksheets.getItem('Aufgaben');
const packets = workbook.worksheets.getItem('Pakete');
const taskRows = new Map(tasks.getRange('A9:A270').values.map((row, index) => [row[0], index + 9]));
const packetRows = new Map(packets.getRange('A8:A104').values.map((row, index) => [row[0], index + 8]));
const taskIds = Array.from({ length: 8 }, (_, index) => `L-${String(index + 1).padStart(2, '0')}`);
const packetIds = ['L-P01', 'L-P02', 'L-P03'];
if (JSON.stringify(taskIds.map((id) => taskRows.get(id))) !== JSON.stringify([125, 126, 127, 128, 129, 130, 131, 132])) {
  throw Error('L-Aufgabenzeilen unerwartet');
}
if (JSON.stringify(packetIds.map((id) => packetRows.get(id))) !== JSON.stringify([51, 52, 53])) {
  throw Error('L-Paketzeilen unerwartet');
}

await fs.mkdir(previewDir, { recursive: true });
const views = [
  ['Aufgaben', 'A125:O132', 'tasks-full'],
  ['Aufgaben', 'H125:O132', 'tasks-status'],
  ['Pakete', 'A51:H53', 'packets'],
];
for (const [sheetName, range, name] of views) {
  const image = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(`${previewDir}/before-${name}.png`, new Uint8Array(await image.arrayBuffer()));
}

for (const id of taskIds) {
  const task = catalog.tasks.find((entry) => entry.id === id);
  const row = taskRows.get(id);
  if (!task || !row) throw Error(`${id} fehlt`);
  tasks.getRange(`H${row}:I${row}`).values = [[task.implementation, task.function]];
  tasks.getRange(`M${row}`).values = [[task.evidence]];
  tasks.getRange(`O${row}`).values = [[task.next]];
  tasks.getRange(`A${row}:O${row}`).format.rowHeight = 470;
}
for (const id of packetIds) {
  const packet = catalog.packets.find((entry) => entry[0] === id);
  const row = packetRows.get(id);
  if (!packet || !row) throw Error(`${id} fehlt`);
  packets.getRange(`F${row}:G${row}`).values = [[packet[5], packet[6]]];
  packets.getRange(`A${row}:H${row}`).format.rowHeight = 420;
}

workbook.recalculate();
if (tasks.getRange('N125:N132').values.flat().some((value) => value !== 'Offen')) {
  throw Error('L-01–L-08 dürfen nicht als abgenommen erscheinen');
}
const formulaCount = ['Aufgaben', 'Pakete', 'Abnahme', 'Quellen']
  .flatMap((name) => workbook.worksheets.getItem(name).getUsedRange().formulas.flat())
  .filter(Boolean).length;
if (formulaCount !== 264) throw Error(`Formelbestand ${formulaCount} statt 264`);
const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',
  options: { useRegex: true, maxResults: 300 },
  summary: 'CP319 final formula error scan',
});
if (!errors.ndjson.includes('matched 0 entries')) throw Error(`Formelfehler: ${errors.ndjson}`);

await (await SpreadsheetFile.exportXlsx(workbook)).save(outputFile);
const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(outputFile));
for (const [sheetName, range, name] of views) {
  const image = await saved.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(`${previewDir}/after-${name}.png`, new Uint8Array(await image.arrayBuffer()));
}
await fs.writeFile(`${outputFile}.formula-errors.ndjson`, errors.ndjson);
const taskCheck = await saved.inspect({
  kind: 'table', range: 'Aufgaben!H125:O132', include: 'values,formulas',
  tableMaxRows: 8, tableMaxCols: 8, maxChars: 16000,
});
const packetCheck = await saved.inspect({
  kind: 'table', range: 'Pakete!F51:H53', include: 'values,formulas',
  tableMaxRows: 3, tableMaxCols: 3, maxChars: 8000,
});
console.log(JSON.stringify({ formulaCount, taskRows: Object.fromEntries(taskIds.map((id) => [id, taskRows.get(id)])), packetRows: Object.fromEntries(packetIds.map((id) => [id, packetRows.get(id)])) }));
console.log(taskCheck.ndjson);
console.log(packetCheck.ndjson);
