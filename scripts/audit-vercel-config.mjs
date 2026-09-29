import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Command-field constraints from https://openapi.vercel.sh/vercel.json.
// Keep long build pipelines in package.json; Vercel rejects them before building.
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
for (const field of ['buildCommand', 'installCommand', 'devCommand', 'ignoreCommand']) {
  const value = config[field];
  if (value == null) continue;
  assert.equal(typeof value, 'string', `vercel.json: ${field} must be a string or null.`);
  assert.ok([...value].length <= 256, `vercel.json: ${field} has ${[...value].length} characters; Vercel permits at most 256. Move the command into an npm script.`);
}
console.log('Vercel command configuration audit passed (maximum 256 characters).');
