import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('Every catalogued measurement has a unique, transparent artwork bundled on both platforms', () => {
  const catalog = readFileSync(new URL('../../src/lib/pflege/vitalCatalog.ts', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../../src/components/pflege/VitalMeasurementArtwork.tsx', import.meta.url), 'utf8');
  const directory = new URL('../../assets/vital-measurement-artwork/', import.meta.url);
  const keys = [...catalog.matchAll(/\{ key: '([a-z0-9_]+)', category: /g)].map(match => match[1]);
  assert.ok(keys.length > 0);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(readdirSync(directory).filter(name => name.endsWith('.png')).sort(), keys.map(key => `${key}.png`).sort());
  const distinct = new Set();
  for (const key of keys) {
    assert.ok(component.includes(`${key}: require('../../../assets/vital-measurement-artwork/${key}.png')`), key);
    const image = readFileSync(new URL(`${key}.png`, directory));
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', key);
    assert.equal(image.subarray(12, 16).toString('ascii'), 'IHDR', key);
    const width = image.readUInt32BE(16);
    assert.ok(width >= 192 && width === image.readUInt32BE(20), key);
    assert.ok(image[25] === 6 || (image[25] === 3 && image.includes(Buffer.from('tRNS'))), key);
    distinct.add(createHash('sha256').update(image).digest('hex'));
  }
  assert.equal(distinct.size, keys.length);
});
