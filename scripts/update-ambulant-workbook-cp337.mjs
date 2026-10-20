import fs from 'node:fs/promises';
const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if (!runtimeModules) throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const { FileBlob, SpreadsheetFile } = await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const [sourceRoot, sourceFile, outputFile, previewDir] = process.argv.slice(2);
if (!sourceRoot || !sourceFile || !outputFile || !previewDir) throw Error('Vier Pfade erforderlich');
const catalog = JSON.parse(await fs.readFile(`${sourceRoot}/docs/audit/ambulant-az-katalog-2026-10-08.json`, 'utf8'));
if (catalog.version !== 337) throw Error(`Katalog ${catalog.version} statt 337`);
await fs.mkdir(new URL('.', `file://${outputFile}`).pathname, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(sourceFile));
const tasksSheet = wb.worksheets.getItem('Aufgaben');
const packetsSheet = wb.worksheets.getItem('Pakete');
const taskIds = Array.from({ length: 8 }, (_, index) => `Z-${String(index + 1).padStart(2, '0')}`);
const packetIds = ['Z-P01', 'Z-P02', 'Z-P03'];
const taskRows = new Map(tasksSheet.getRange('A9:A270').values.map((row, index) => [row[0], index + 9]));
const packetRows = new Map(packetsSheet.getRange('A8:A104').values.map((row, index) => [row[0], index + 8]));
if (taskIds.map(id => taskRows.get(id)).join(',') !== '263,264,265,266,267,268,269,270') throw Error('Z-Aufgabenzeilen unerwartet');
if (packetIds.map(id => packetRows.get(id)).join(',') !== '102,103,104') throw Error('Z-Paketzeilen unerwartet');
const render = async (sheetName, range, name) => {
  const image = await wb.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(`${previewDir}/${name}`, new Uint8Array(await image.arrayBuffer()));
};
await render('Aufgaben', 'A263:O270', 'before-Z-tasks.png');
await render('Pakete', 'A102:H104', 'before-Z-packets.png');
for (const id of taskIds) {
  const task = catalog.tasks.find(entry => entry.id === id);
  const row = taskRows.get(id);
  if (!task || !row) throw Error(`${id} fehlt`);
  tasksSheet.getRange(`M${row}`).values = [[task.evidence]];
  tasksSheet.getRange(`O${row}`).values = [[task.next]];
  tasksSheet.getRange(`${row}:${row}`).format.rowHeight = 300;
}
for (const id of packetIds) {
  const packet = catalog.packets.find(entry => entry[0] === id);
  const row = packetRows.get(id);
  if (!packet || !row) throw Error(`${id} fehlt`);
  packetsSheet.getRange(`G${row}:H${row}`).values = [[packet[6], packet[7]]];
  packetsSheet.getRange(`${row}:${row}`).format.rowHeight = 300;
}
wb.recalculate();
for (const id of taskIds) {
  const row = taskRows.get(id);
  const task = catalog.tasks.find(entry => entry.id === id);
  if (JSON.stringify(tasksSheet.getRange(`H${row}:I${row}`).values[0]) !== JSON.stringify([task.implementation, task.function]) || tasksSheet.getRange(`M${row}`).values[0][0] !== task.evidence || tasksSheet.getRange(`O${row}`).values[0][0] !== task.next || tasksSheet.getRange(`N${row}`).values[0][0] !== 'Offen') throw Error(`${id} stimmt nicht`);
}
for (const id of packetIds) {
  const row = packetRows.get(id);
  const packet = catalog.packets.find(entry => entry[0] === id);
  if (JSON.stringify(packetsSheet.getRange(`G${row}:H${row}`).values[0]) !== JSON.stringify([packet[6], packet[7]])) throw Error(`${id} stimmt nicht`);
}
const formulaCount = tasksSheet.getRange('A1:O270').formulas.flat().filter(Boolean).length + packetsSheet.getRange('A1:H104').formulas.flat().filter(Boolean).length + wb.worksheets.getItem('Abnahme').getRange('A1:Z100').formulas.flat().filter(Boolean).length + wb.worksheets.getItem('Quellen').getRange('A1:Z100').formulas.flat().filter(Boolean).length;
if (formulaCount !== 264) throw Error(`Formelbestand ${formulaCount}`);
const errors = await wb.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 300 }, maxChars: 3000 });
if (!errors.ndjson.includes('matched 0 entries')) throw Error(`Fehlerwerte: ${errors.ndjson}`);
await fs.writeFile(`${previewDir}/formula-errors.ndjson`, errors.ndjson);
await render('Aufgaben', 'A263:O270', 'after-Z-tasks.png');
await render('Pakete', 'A102:H104', 'after-Z-packets.png');
await (await SpreadsheetFile.exportXlsx(wb)).save(outputFile);
console.log(JSON.stringify({ taskRows: [...taskRows].filter(([id]) => taskIds.includes(id)), packetRows: [...packetRows].filter(([id]) => packetIds.includes(id)), changedCells: 22, rowHeights: 11, formulaCount }));
