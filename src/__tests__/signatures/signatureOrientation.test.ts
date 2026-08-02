import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildSignatureProofImageStyle,
  detectSignatureInkBounds,
  needsSignatureOrientationCorrection,
  readPngDimensionsFromBytes,
  readPngDimensionsFromDataUrl,
  resolveSignatureImageDimensions,
  resolveCanonicalSignatureFrame,
  signatureProofImageStyleToCss,
  shouldRotateSignatureInk,
  resolveSignatureCaptureRotation,
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
    expect(style.maxWidth).toBe(320);
    expect(style.maxHeight).toBe(120);
    expect(style.transform).toBeUndefined();
    expect(signatureProofImageStyleToCss(style)).not.toContain('rotate');
  });

  it('never rotates portrait handwriting based on image dimensions', () => {
    const style = buildSignatureProofImageStyle(240, 480);
    expect(style.transform).toBeUndefined();
    expect(style.maxWidth).toBe(320);
    expect(style.maxHeight).toBe(120);
    expect(signatureProofImageStyleToCss(style)).not.toContain('rotate');
    expect(signatureProofImageStyleToCss(style)).toContain('object-fit:contain');
  });
});

describe('canonical landscape frame', () => {
  it('keeps wide handwriting horizontal and adds a clipping-safe margin', () => {
    const frame = resolveCanonicalSignatureFrame(480, 80, 12);
    expect(frame.width).toBeGreaterThan(frame.height);
    expect(frame.contentX).toBeGreaterThanOrEqual(12);
    expect(frame.contentY).toBeGreaterThanOrEqual(12);
  });

  it('places narrow upright handwriting into landscape without rotating it', () => {
    const frame = resolveCanonicalSignatureFrame(80, 220, 12);
    expect(frame.width).toBeGreaterThan(frame.height * 2);
    expect(frame.contentX).toBeGreaterThan(0);
    expect(frame.contentY).toBeGreaterThanOrEqual(12);
  });
});

describe('signature capture direction', () => {
  it('keeps a normal landscape canvas exactly as written', () => {
    expect(
      resolveSignatureCaptureRotation(1200, 600, {
        isLandscape: true,
        orientationType: 'landscape-primary',
        angle: 90,
      }),
    ).toBe(0);
  });

  it('uses the device side for a portrait backing buffer in landscape', () => {
    expect(
      resolveSignatureCaptureRotation(600, 1200, {
        isLandscape: true,
        orientationType: 'landscape-primary',
        angle: 90,
      }),
    ).toBe(90);
    expect(
      resolveSignatureCaptureRotation(600, 1200, {
        isLandscape: true,
        orientationType: 'landscape-secondary',
        angle: 270,
      }),
    ).toBe(-90);
  });

  it('does not guess a rotation from handwriting proportions in portrait', () => {
    expect(
      resolveSignatureCaptureRotation(600, 1200, {
        isLandscape: false,
        orientationType: 'portrait-primary',
        angle: 0,
      }),
    ).toBe(0);
  });
});

describe('signature ink orientation', () => {
  function signaturePixels(width: number, height: number, ink: { left: number; top: number; right: number; bottom: number }) {
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = ink.top; y <= ink.bottom; y += 1) {
      for (let x = ink.left; x <= ink.right; x += 1) {
        const offset = (y * width + x) * 4;
        pixels[offset] = 17;
        pixels[offset + 1] = 17;
        pixels[offset + 2] = 17;
        pixels[offset + 3] = 255;
      }
    }
    return pixels;
  }

  it('detects sideways ink even when the outer mobile buffer is landscape', () => {
    const bounds = detectSignatureInkBounds(
      signaturePixels(640, 320, { left: 300, top: 35, right: 322, bottom: 285 }),
      640,
      320,
    );
    expect(bounds).not.toBeNull();
    expect(bounds && shouldRotateSignatureInk(bounds)).toBe(true);
  });

  it('keeps normally written horizontal ink unchanged', () => {
    const bounds = detectSignatureInkBounds(
      signaturePixels(640, 320, { left: 80, top: 145, right: 560, bottom: 178 }),
      640,
      320,
    );
    expect(bounds).not.toBeNull();
    expect(bounds && shouldRotateSignatureInk(bounds)).toBe(false);
  });
});

describe('capture pipeline wiring', () => {
  it('exports normalized PNG from web canvas on confirm', () => {
    const source = readSrc('src/components/inputs/CareSignatureCanvas.tsx');
    const normalizer = readSrc('src/lib/signatures/normalizeSignatureCapture.ts');
    expect(source).toContain('exportSignatureCanvasPng');
    expect(source).not.toMatch(/onConfirm\(canvas\.toDataURL\('image\/png'\)\)/);
    expect(normalizer).toContain('detectSignatureInkBounds');
    expect(normalizer).toContain('resolveCanonicalSignatureFrame');
    expect(normalizer).not.toContain('ctx.rotate');
    expect(source).toContain('orientationType: orientation.orientationType');
    expect(source).toContain('angle: orientation.angle');
  });

  it('normalizes stored signature ink before Leistungsnachweis PDF rendering', () => {
    const service = readSrc('src/lib/assist/assistProofPdfService.ts');
    const payload = readSrc('src/lib/assist/assistProofPdfPayload.ts');
    const display = readSrc('src/components/signatures/SignatureDisplay.tsx');
    expect(service).toContain('normalizeSignatureImageForProof(signatureImageUrl)');
    expect(payload).toContain('proof-signature-image-frame');
    expect(display).toContain('normalizeSignatureImageForProof(imageUri)');
    expect(display).not.toContain("rotate: '90deg'");
  });
});
