import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildSignatureProofImageStyle,
  needsSignatureOrientationCorrection,
  readPngDimensionsFromBytes,
  readPngDimensionsFromDataUrl,
  resolveSignatureImageDimensions,
  signatureProofImageStyleToCss,
} from '@/lib/signatures/signatureOrientation';
import { pngBytes, pngDataUrl } from '@/__tests__/signatures/signatureTestFixtures';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('needsSignatureOrientationCorrection', () => {
  it('flags portrait buffers (height > width)', () => {
    expect(needsSignatureOrientationCorrection(320, 640)).toBe(true);
  });

  it('accepts landscape buffers and square images', () => {
    expect(needsSignatureOrientationCorrection(640, 320)).toBe(false);
    expect(needsSignatureOrientationCorrection(400, 400)).toBe(false);
  });
});

describe('PNG dimension probes', () => {
  it('reads IHDR dimensions from PNG bytes', () => {
    expect(readPngDimensionsFromBytes(pngBytes(640, 320))).toEqual({ width: 640, height: 320 });
    expect(readPngDimensionsFromBytes(pngBytes(200, 400))).toEqual({ width: 200, height: 400 });
  });

  it('reads dimensions from inline PNG data URLs', () => {
    expect(readPngDimensionsFromDataUrl(pngDataUrl(600, 320))).toEqual({
      width: 600,
      height: 320,
    });
  });

  it('resolves inline data URL dimensions for proof rendering', () => {
    const portrait = pngDataUrl(240, 480);
    expect(resolveSignatureImageDimensions(portrait)).toEqual({ width: 240, height: 480 });
    expect(resolveSignatureImageDimensions(portrait, 640, 320)).toEqual({ width: 640, height: 320 });
  });
});

describe('buildSignatureProofImageStyle', () => {
  it('keeps landscape signatures horizontal without transform', () => {
    const style = buildSignatureProofImageStyle(640, 320);
    expect(style.maxWidth).toBe(280);
    expect(style.maxHeight).toBe(120);
    expect(style.transform).toBeUndefined();
    expect(signatureProofImageStyleToCss(style)).not.toContain('rotate');
  });

  it('rotates portrait buffers for horizontal proof display', () => {
    const style = buildSignatureProofImageStyle(240, 480);
    expect(style.transform).toBe('rotate(-90deg)');
    expect(style.maxWidth).toBe(120);
    expect(style.maxHeight).toBe(280);
    expect(signatureProofImageStyleToCss(style)).toContain('rotate(-90deg)');
    expect(signatureProofImageStyleToCss(style)).toContain('object-fit:contain');
  });
});

describe('capture pipeline wiring', () => {
  it('exports normalized PNG from web canvas on confirm', () => {
    const source = readSrc('src/components/inputs/CareSignatureCanvas.tsx');
    expect(source).toContain('exportSignatureCanvasPng');
    expect(source).not.toMatch(/onConfirm\(canvas\.toDataURL\('image\/png'\)\)/);
  });
});
