import fs from 'node:fs/promises';
const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if (!runtimeModules) throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const { FileBlob, SpreadsheetFile } = await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const [sourceRoot, sourceFile, outputFile, previewDir] = process.argv.slice(2);
if (!sourceRoot || !sourceFile || !outputFile || !previewDir) throw Error('Vier Pfade erforderlich');
const catalog = JSON.parse(await fs.readFile(`${sourceRoot}/docs/audit/ambulant-az-katalog-2026-10-08.json`, 'utf8'));
if (catalog.version !== 336) throw Error(`Katalog ${catalog.version} statt 336`);
await fs.mkdir(new URL('.', `file://${outputFile}`).pathname, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(sourceFile));
const tasksSheet = wb.worksheets.getItem('Aufgaben');
const packetsSheet = wb.worksheets.getItem('Pakete');
const taskIds = Array.from({ length: 12 }, (_, index) => `Y-${String(index + 1).padStart(2, '0')}`);
const packetIds = ['Y-P01', 'Y-P02', 'Y-P03', 'Y-P04'];
const taskRows = new Map(tasksSheet.getRange('A9:A270').values.map((row, index) => [row[0], index + 9]));
const packetRows = new Map(packetsSheet.getRange('A8:A104').values.map((row, index) => [row[0], index + 8]));
if (taskIds.map(id => taskRows.get(id)).join(',') !== '251,252,253,254,255,256,257,258,259,260,261,262') throw Error('Y-Aufgabenzeilen unerwartet');
if (packetIds.map(id => packetRows.get(id)).join(',') !== '98,99,100,101') throw Error('Y-Paketzeilen unerwartet');
const render = async (sheetName, range, name) => {
  const image = await wb.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(`${previewDir}/${name}`, new Uint8Array(await image.arrayBuffer()));
};
await render('Aufgaben', 'A251:O262', 'before-Y-tasks.png');
await render('Pakete', 'A98:H101', 'before-Y-packets.png');
for (const id of taskIds) {
  const task = catalog.tasks.find(entry => entry.id === id);
  const row = taskRows.get(id);
  if (!task || !row) throw Error(`${id} fehlt`);
  if (id === 'Y-10' || id === 'Y-12') tasksSheet.getRange(`H${row}:I${row}`).values = [[task.implementation, task.function]];
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
await render('Aufgaben', 'A251:O262', 'after-Y-tasks.png');
await render('Pakete', 'A98:H101', 'after-Y-packets.png');
await (await SpreadsheetFile.exportXlsx(wb)).save(outputFile);
console.log(JSON.stringify({ taskRows: [...taskRows].filter(([id]) => taskIds.includes(id)), packetRows: [...packetRows].filter(([id]) => packetIds.includes(id)), changedCells: 36, rowHeights: 16, formulaCount }));
