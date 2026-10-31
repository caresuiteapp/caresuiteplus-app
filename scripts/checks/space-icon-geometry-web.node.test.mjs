import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  SPACE_GLYPH_DRAWING_SIZE,
  spaceGlyphGeometry,
} from '../../src/components/icons/space/spaceGlyphGeometry.web.ts';

const sizes = [24, 28, 30, 32, 40, 48];
const source = (name) => readFileSync(new URL(`../../src/components/icons/space/${name}`, import.meta.url), 'utf8');

for (const size of sizes) {
  test(`${size}px frame scales the complete 34px KPI drawing without rectangular clipping`, () => {
    const geometry = spaceGlyphGeometry(size);
    const paintedSize = 34 * geometry.scale;
    assert.ok(paintedSize < size - 2, 'leave room for the existing 1px shell border');
    assert.ok(geometry.stageSize <= size - 2, 'the complete plane fits the shell');
    assert.equal(geometry.drawingSize, SPACE_GLYPH_DRAWING_SIZE);
    assert.ok(Math.abs(paintedSize / size - 0.731) < 1e-10);
    // The active rail/card transform must not make the drawing exceed a fixed
    // parent badge, such as the 30px bubble in PremiumKpiCard.
    for (const activeScale of [1, 1.04, 1.08]) {
      assert.ok(paintedSize * activeScale < size - 2);
    }
  });

  test(`${size}px invoice stack keeps both pages inside the circular rail`, () => {
    const geometry = spaceGlyphGeometry(size, 'invoice');
    const angle = -8 * Math.PI / 180;
    const points = [];
    for (const x of [-9, 9]) {
      for (const y of [-11, 11]) {
        points.push([x, y]);
        points.push([8 + x * Math.cos(angle) - y * Math.sin(angle), 6 + x * Math.sin(angle) + y * Math.cos(angle)]);
      }
    }
    for (const [x, y] of points) {
      const radius = Math.hypot(x + geometry.offsetX, y + geometry.offsetY) * geometry.scale;
      assert.ok(radius < size / 2 - 1, 'both rotated page outlines stay within the rail border');
    }
    assert.deepEqual(spaceGlyphGeometry(size, 'mkpiOfficeInvoice'), geometry);
  });
}

test('fixed and size-relative motifs use one canonical plane in both Web entry points', () => {
  for (const file of ['SpaceKpiIcon.web.tsx', 'SpaceModuleIcon.web.tsx']) {
    const text = source(file);
    assert.match(text, /<SpaceGlyphStage size=\{size\}/);
    assert.match(text, /size=\{SPACE_GLYPH_DRAWING_SIZE\}/);
    assert.match(text, /active=\{active\}/);
    assert.match(text, /frame=\{frame\}/);
  }
  const stage = source('SpaceGlyphStage.web.tsx');
  assert.match(stage, /flexShrink: 0/);
  assert.match(stage, /pointerEvents: 'none'/);
  assert.match(stage, /aria-hidden="true"/);
  assert.match(stage, /transform: `scale\(\$\{geometry.scale\}\)`/);
});

test('the Web module mapping preserves all eight existing module motifs', () => {
  const mapping = (text) => text.match(/const MODULE_GLYPH[^=]+?= (\{[\s\S]*?\n\});/)[1];
  assert.equal(mapping(source('SpaceModuleIcon.web.tsx')), mapping(source('SpaceModuleIcon.tsx')));
});

test('native entry points keep their original unscaled rendering path', () => {
  for (const file of ['SpaceKpiIcon.tsx', 'SpaceModuleIcon.tsx', 'SpaceIconShell.tsx']) {
    assert.doesNotMatch(source(file), /SpaceGlyphStage|spaceGlyphGeometry|SPACE_GLYPH_DRAWING_SIZE/);
  }
  assert.match(source('SpaceIconShell.tsx'), /width: size \* 0\.86/);
  assert.match(source('SpaceIconShell.tsx'), /height: size \* 0\.86/);
});
