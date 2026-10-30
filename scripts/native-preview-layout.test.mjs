import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nativePreviewLayout } from './native-preview-layout.mjs';
for (const width of [664.546875, 1135.59375]) {
  test(`keeps actual fractional border-box width ${width} when RN Web rounds upwards`, () => {
    const event = { timeStamp: 1, nativeEvent: { target: { getBoundingClientRect: () => ({ width, height: 140.25 }) }, layout: { x: 8, y: 12, width: Math.round(width), height: 140 } } };
    const actual = nativePreviewLayout(event);
    assert.equal(actual.nativeEvent.layout.width, width);
    assert.equal(actual.nativeEvent.layout.height, 140.25);
    assert.equal(actual.nativeEvent.layout.x, 8);
    assert.equal(actual.nativeEvent.layout.y, 12);
    assert.equal(event.nativeEvent.layout.width, Math.round(width));
  });
}
test('retains native events and hidden/unmeasured hosts unchanged', () => {
  for (const event of [{ nativeEvent: { layout: { width: 1135.5 } } }, { nativeEvent: { target: { getBoundingClientRect: () => ({ width: 0, height: 0 }) }, layout: { width: 665 } } }]) assert.equal(nativePreviewLayout(event), event);
});
