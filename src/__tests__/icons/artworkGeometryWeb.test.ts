import { buildSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_ARTWORK_FILL, desktopArtworkFrame, desktopArtworkResolution, type DesktopArtworkGeometry,
} from '@/liquid-command/components/desktopArtworkGeometry.web';
import type { DesktopArtworkAsset } from '@/liquid-command/components/desktopArtworkAssets.web';
import { spaceGlyphGeometry } from '@/components/icons/space/spaceGlyphGeometry.web';

// Load actual measured assets without decoding PNGs or using Node's TS stripping.
// This works with the project's Node 20 release engine and existing esbuild.
const bundle = buildSync({
  entryPoints: ['src/liquid-command/components/desktopArtworkAssets.web.ts'],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['*.png'],
}).outputFiles[0].text;
const loaded = { exports: {} as { DESKTOP_ARTWORK_ASSETS: readonly DesktopArtworkAsset[] } };
new Function('require', 'module', 'exports', bundle)((id: string) => {
  if (id.endsWith('.png')) return { uri: id };
  throw new Error(`Unexpected artwork metadata dependency: ${id}`);
}, loaded, loaded.exports);

describe('Web artwork normalization', () => {
  it('centers every measured motif at one visible size despite different transparent margins', () => {
    expect(loaded.exports.DESKTOP_ARTWORK_ASSETS.length).toBeGreaterThan(80);
    for (const asset of loaded.exports.DESKTOP_ARTWORK_ASSETS) {
      const frame = desktopArtworkFrame(asset);
      expect(frame, asset.path).not.toBeNull();
      const [x, y, width, height] = asset.contentBounds;
      expect(desktopArtworkResolution(asset) / frame!.side, asset.path).toBeCloseTo(DESKTOP_ARTWORK_FILL, 8);
      expect((x + width / 2 - frame!.x) / frame!.side, asset.path).toBeCloseTo(0.5, 8);
      expect((y + height / 2 - frame!.y) / frame!.side, asset.path).toBeCloseTo(0.5, 8);
      const [paintX, paintY, paintWidth, paintHeight] = asset.paintBounds;
      expect(paintX, asset.path).toBeGreaterThanOrEqual(frame!.x);
      expect(paintY, asset.path).toBeGreaterThanOrEqual(frame!.y);
      expect(paintX + paintWidth, asset.path).toBeLessThanOrEqual(frame!.x + frame!.side);
      expect(paintY + paintHeight, asset.path).toBeLessThanOrEqual(frame!.y + frame!.side);
    }
  });

  it.each([[400, 178], [88, 156], [64, 64]])('fits wide and narrow %s × %s stages without changing proportions', (width, height) => {
    const asset = loaded.exports.DESKTOP_ARTWORK_ASSETS.find(item => item.path.endsWith('/medium/07-dokumente.png'))!;
    const frame = desktopArtworkFrame(asset)!;
    const scale = Math.min(width, height) / frame.side;
    expect(desktopArtworkResolution(asset) * scale).toBeCloseTo(Math.min(width, height) * DESKTOP_ARTWORK_FILL, 8);
    expect(frame.side * scale).toBeLessThanOrEqual(Math.min(width, height));
  });

  it('preserves a future wide shadow instead of clipping it to the normal fill ratio', () => {
    expect(desktopArtworkFrame({
      pixelSize: [100, 100], contentBounds: [30, 30, 40, 40], paintBounds: [10, 10, 80, 80],
    })).toEqual({ x: 10, y: 10, side: 80 });
  });

  it.each([
    { pixelSize: [0, 100], contentBounds: [30, 30, 40, 40], paintBounds: [10, 10, 80, 80] },
    { pixelSize: [100, 100], contentBounds: [0, 0, 101, 10], paintBounds: [10, 10, 80, 80] },
    { pixelSize: [100, 100], contentBounds: [Number.NaN, 0, 10, 10], paintBounds: [10, 10, 80, 80] },
    { pixelSize: [100, 100], contentBounds: [30, 30, 40, 40], paintBounds: [-1, 0, 80, 80] },
  ] satisfies DesktopArtworkGeometry[])('rejects malformed measurements safely: %j', geometry => {
    expect(desktopArtworkFrame(geometry)).toBeNull();
  });
});

describe('Web Space glyph geometry', () => {
  it.each([24, 28, 30, 32, 40, 48])('keeps the complete KPI drawing inside its %s px shell, including active effects', size => {
    const geometry = spaceGlyphGeometry(size);
    const paintedSize = 34 * geometry.scale;
    expect(geometry.drawingSize).toBe(40);
    expect(geometry.stageSize).toBeLessThanOrEqual(size - 2);
    expect(paintedSize / size).toBeCloseTo(0.731, 8);
    for (const activeScale of [1, 1.04, 1.08]) {
      expect(paintedSize * activeScale).toBeLessThan(size - 2);
    }
  });

  it.each([24, 28, 30, 32, 40, 48])('keeps both offset invoice pages inside the %s px circular rail', size => {
    const geometry = spaceGlyphGeometry(size, 'invoice');
    const angle = -8 * Math.PI / 180;
    for (const x of [-9, 9]) {
      for (const y of [-11, 11]) {
        for (const [pageX, pageY] of [
          [x, y],
          [8 + x * Math.cos(angle) - y * Math.sin(angle), 6 + x * Math.sin(angle) + y * Math.cos(angle)],
        ]) {
          const radius = Math.hypot(pageX + geometry.offsetX, pageY + geometry.offsetY) * geometry.scale;
          expect(radius).toBeLessThan(size / 2 - 1);
        }
      }
    }
    expect(spaceGlyphGeometry(size, 'mkpiOfficeInvoice')).toEqual(geometry);
  });
});
