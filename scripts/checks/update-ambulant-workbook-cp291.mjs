import fs from 'node:fs/promises';

const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if (!runtimeModules) throw Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES fehlt');
const { FileBlob, SpreadsheetFile } = await import(`${runtimeModules}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const [sourceRoot, sourceFile, outputFile, previewDir] = process.argv.slice(2);
if (!sourceRoot || !sourceFile || !outputFile || !previewDir) throw Error('usage: sourceRoot sourceFile outputFile previewDir');
await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(new URL('.', `file://${outputFile}`).pathname, { recursive: true });
const catalog = JSON.parse(await fs.readFile(`${sourceRoot}/docs/audit/ambulant-az-katalog-2026-10-08.json`, 'utf8'));
const task = catalog.tasks.find((entry) => entry.id === 'A-10');
const packet = catalog.packets.find((entry) => entry[0] === 'A-P04');
if (!task || !packet) throw Error('A-10 oder A-P04 fehlt');
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(sourceFile));
const main = workbook.worksheets.getItem('Aufgaben');
const packets = workbook.worksheets.getItem('Pakete');
const taskRow = main.getRange('A9:A270').values.findIndex((row) => row[0] === 'A-10') + 9;
const packetRow = packets.getRange('A8:A104').values.findIndex((row) => row[0] === 'A-P04') + 8;
if (taskRow !== 18 || packetRow !== 11) throw Error(`Unerwartete Zeilen: ${taskRow}/${packetRow}`);
if (task.implementation !== 'Teilweise umgesetzt' || task.function !== 'Teilprüfung' ||
    [task.care, task.design, task.legal].some((status) => status !== 'Offen') || packet[5] !== 'Teilweise umgesetzt') {
  throw Error('A-10- oder A-P04-Status ist nicht der freigegebene Teilstatus');
}
for (const [sheetName, range, name] of [
  ['Aufgaben', `A${taskRow}:O${taskRow}`, 'before-A-10.png'],
  ['Pakete', `A${packetRow}:H${packetRow}`, 'before-A-P04.png'],
]) {
  const rendered = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(`${previewDir}/${name}`, new Uint8Array(await rendered.arrayBuffer()));
}
main.getRange(`H${taskRow}:M${taskRow}`).values = [[task.implementation, task.function, task.care, task.design, task.legal, task.evidence]];
main.getRange(`O${taskRow}`).values = [[task.next]];
packets.getRange(`F${packetRow}:G${packetRow}`).values = [[packet[5], packet[6]]];
workbook.recalculate();
if (main.getRange(`N${taskRow}`).values[0][0] !== 'Offen') throw Error('A-10 darf nicht als abgenommen erscheinen');
const formulaCount = main.getRange('A1:O270').formulas.flat().filter(Boolean).length +
  packets.getRange('A1:H104').formulas.flat().filter(Boolean).length +
  workbook.worksheets.getItem('Abnahme').getRange('A1:Z100').formulas.flat().filter(Boolean).length +
  workbook.worksheets.getItem('Quellen').getRange('A1:Z100').formulas.flat().filter(Boolean).length;
if (formulaCount !== 264) throw Error(`Formelbestand geändert: ${formulaCount}`);
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 300 }, maxChars: 3000 });
if (!errors.ndjson.includes('matched 0 entries')) throw Error(`Arbeitsmappe enthält Fehlerwerte: ${errors.ndjson}`);
await fs.writeFile(`${previewDir}/formula-errors.ndjson`, errors.ndjson);
for (const [sheetName, range, name] of [
  ['Aufgaben', `A${taskRow}:O${taskRow}`, 'after-A-10.png'],
  ['Pakete', `A${packetRow}:H${packetRow}`, 'after-A-P04.png'],
]) {
  const rendered = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(`${previewDir}/${name}`, new Uint8Array(await rendered.arrayBuffer()));
}
await (await SpreadsheetFile.exportXlsx(workbook)).save(outputFile);
console.log(JSON.stringify({ taskRow, packetRow, formulaCount, taskStatus: main.getRange(`H${taskRow}:N${taskRow}`).values[0], packetStatus: packets.getRange(`F${packetRow}:G${packetRow}`).values[0] }));
