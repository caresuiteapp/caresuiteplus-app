import fs from 'node:fs/promises';

const base = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const final = JSON.parse(await fs.readFile(process.argv[3], 'utf8'));
const replacements = new Map(final.edits.map(edit => [`${edit.sheet}!${edit.address}`, edit.value]));
for (const edit of base.edits) {
  const value = replacements.get(`${edit.sheet}!${edit.address}`);
  if (value !== undefined) edit.value = value;
}
const missing = [...replacements.keys()].filter(key => !base.edits.some(edit => `${edit.sheet}!${edit.address}` === key));
if (missing.length) throw Error(`Final edits were not present in the combined plan: ${missing.join(', ')}`);
await fs.writeFile(process.argv[4], JSON.stringify(base, null, 2) + '\n');
console.log(JSON.stringify({ edits: base.edits.length, replacements: replacements.size }));
