import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTypeScriptHeapMiB } from '../resolve-typescript-heap.mjs';
const gib = n => n * 1024 ** 3;
test('default compiler keeps the existing ceiling and detected reserve', () => {
  assert.equal(resolveTypeScriptHeapMiB(gib(16)), 8192);
  assert.equal(resolveTypeScriptHeapMiB(gib(16), gib(8)), 7168);
});
test('explicit local compiler budget lowers memory without exceeding the detected ceiling', () => {
  assert.equal(resolveTypeScriptHeapMiB(gib(16), gib(8), '4096'), 4096);
  assert.equal(resolveTypeScriptHeapMiB(gib(4), 0, '4096'), 3072);
  assert.equal(resolveTypeScriptHeapMiB(gib(32), 0, '16384'), 8192);
});
for (const value of ['', '4096\n', '4096.0', '-1', '511', '4e3', 'NaN', '9007199254740992']) {
  test('invalid explicit heap fails rather than silently altering release checks: ' + JSON.stringify(value), () => {
    assert.throws(() => resolveTypeScriptHeapMiB(gib(16), 0, value), /CARESUITE_TYPESCRIPT_HEAP_MIB/);
  });
}
