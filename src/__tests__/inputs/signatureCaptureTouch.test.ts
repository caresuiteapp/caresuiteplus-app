import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('signatureCaptureScrollLock', () => {
  it('exports scroll-lock helpers for signature canvas exemption', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/lib/dom/signatureCaptureScrollLock.ts'),
      'utf8',
    );
    expect(source).toContain('data-signature-capture="true"');
    expect(source).toContain('isSignatureCaptureTouchTarget');
    expect(source).toContain('blockDocumentTouchScrollOutsideSignatureCapture');
  });
});

describe('signature canvas mobile touch wiring', () => {
  it('registers native touch listeners and marks canvas for scroll-lock exemption', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/inputs/CareSignatureCanvas.tsx'),
      'utf8',
    );
    expect(source).toContain("data-signature-capture=\"true\"");
    expect(source).toContain("addEventListener('touchstart'");
    expect(source).toContain("if ('PointerEvent' in window) return");
    expect(source).not.toContain("event.pointerType === 'touch'");
    expect(source).toContain('setPointerCapture');
    expect(source).toContain('requestAnimationFrame');
    expect(source).toContain('minHeight: 120');
  });

  it('uses scroll-lock helper in fullscreen overlay', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/ui/FullscreenOverlay.tsx'),
      'utf8',
    );
    expect(source).toContain('blockDocumentTouchScrollOutsideSignatureCapture');
    expect(source).not.toMatch(
      /const blockTouchMove = \(event: TouchEvent\) => \{\s*event\.preventDefault\(\);\s*\};/,
    );
  });
});
