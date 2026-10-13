// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blockDocumentTouchScrollOutsideSignatureCapture } from '@/lib/dom/signatureCaptureScrollLock';

function swipe(target: Element): boolean {
  const event = new Event('touchmove', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('signature touch lock after modal and route changes', () => {
  beforeEach(() => {
    document.addEventListener('touchmove', blockDocumentTouchScrollOutsideSignatureCapture);
  });
  afterEach(() => {
    document.removeEventListener('touchmove', blockDocumentTouchScrollOutsideSignatureCapture);
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('releases the next visit after routing removes the fullscreen host before effect cleanup', () => {
    const workspace = document.createElement('div');
    const host = document.createElement('div');
    host.setAttribute('data-caresuite-fullscreen-overlay', 'signature');
    document.body.append(workspace, host);
    expect(swipe(workspace)).toBe(true);
    host.remove();
    // The same document listener is still registered here.
    expect(swipe(workspace)).toBe(false);
  });

  it('allows long modal content to scroll while blocking the background', () => {
    const background = document.createElement('div');
    const host = document.createElement('div');
    const content = document.createElement('div');
    host.setAttribute('data-caresuite-fullscreen-overlay', 'signature');
    host.append(content);
    document.body.append(background, host);
    expect(swipe(content)).toBe(false);
    expect(swipe(background)).toBe(true);
  });

  it('preserves drawing on a signature canvas', () => {
    const host = document.createElement('div');
    const canvas = document.createElement('canvas');
    host.setAttribute('data-caresuite-fullscreen-overlay', 'signature');
    canvas.setAttribute('data-signature-capture', 'true');
    host.append(canvas);
    document.body.append(host);
    expect(swipe(canvas)).toBe(false);
  });

  it('keeps a visible nonfullscreen signature dialog locked only outside its content', () => {
    const background = document.createElement('div');
    const dialog = document.createElement('div');
    const canvas = document.createElement('canvas');
    const input = document.createElement('input');
    dialog.setAttribute('aria-modal', 'true');
    canvas.setAttribute('data-signature-capture', 'true');
    dialog.append(canvas, input);
    document.body.append(background, dialog);
    vi.spyOn(dialog, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
    expect(swipe(background)).toBe(true);
    expect(swipe(input)).toBe(false);
    dialog.remove();
    expect(swipe(background)).toBe(false);
  });

  it('ignores an already hidden signature dialog', () => {
    const workspace = document.createElement('div');
    const dialog = document.createElement('div');
    const canvas = document.createElement('canvas');
    dialog.setAttribute('aria-modal', 'true');
    canvas.setAttribute('data-signature-capture', 'true');
    dialog.append(canvas);
    document.body.append(workspace, dialog);
    vi.spyOn(dialog, 'getClientRects').mockReturnValue({ length: 0 } as DOMRectList);
    expect(swipe(workspace)).toBe(false);
  });
});
