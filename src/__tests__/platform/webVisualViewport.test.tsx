// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebVisualViewport } from '@/hooks/useWebVisualViewport.web';

let root: Root, host: HTMLDivElement;
let visual: EventTarget & { height: number; width: number; offsetTop: number; offsetLeft: number; scale: number };
let state: ReturnType<typeof useWebVisualViewport>;
function Probe() { state = useWebVisualViewport(); return <textarea aria-label="Nachricht" />; }
async function update(values: Partial<typeof visual> = {}, event = 'resize') {
  Object.assign(visual, values);
  await act(async () => { visual.dispatchEvent(new Event(event)); vi.advanceTimersByTime(20); });
}
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 740);
  visual = Object.assign(new EventTarget(), { height: 740, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1 });
  vi.stubGlobal('visualViewport', visual);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<Probe />)); await update();
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});
describe('portal visible viewport', () => {
  it('follows Safari keyboard height and the independently panned origin', async () => {
    host.querySelector('textarea')!.focus();
    await update({ height: 360, offsetTop: 245 });
    expect(state).toMatchObject({ height: 360, width: 390, offsetTop: 245, keyboardVisible: true });
    await update({ offsetTop: 130 }, 'scroll'); expect(state.offsetTop).toBe(130);
    await update({ height: 740, offsetTop: 0 }); expect(state.keyboardVisible).toBe(false);
  });
  it('does not restore the footer before the keyboard closing animation ends', async () => {
    host.querySelector('textarea')!.focus(); await update({ height: 350 });
    host.querySelector('textarea')!.blur(); await update();
    expect(state.keyboardVisible).toBe(true);
    await update({ height: 740 }); expect(state.keyboardVisible).toBe(false);
  });
  it('retains the original height when Android resizes the layout viewport too', async () => {
    host.querySelector('textarea')!.focus(); vi.stubGlobal('innerHeight', 350);
    await update({ height: 350 }); expect(state.keyboardVisible).toBe(true);
    host.querySelector('textarea')!.blur(); await update(); expect(state.keyboardVisible).toBe(true);
    vi.stubGlobal('innerHeight', 740); await update({ height: 740 }); expect(state.keyboardVisible).toBe(false);
  });
  it('leaves pinch zoom alone instead of shrinking the app a second time', async () => {
    const previous = state;
    await update({ scale: 2, width: 195, height: 370, offsetTop: 90 }); expect(state).toBe(previous);
    await update({ scale: 1, width: 390, height: 740, offsetTop: 0 }); expect(state.width).toBe(390);
  });
  it('adapts to rotation and cleans up listeners after unmount', async () => {
    vi.stubGlobal('innerHeight', 390); vi.stubGlobal('innerWidth', 740);
    Object.assign(visual, { height: 390, width: 740 });
    await act(async () => { window.dispatchEvent(new Event('orientationchange')); vi.advanceTimersByTime(20); });
    expect(state).toMatchObject({ height: 390, width: 740, keyboardVisible: false });
    await act(async () => root.render(<div />));
    const previous = state; await update({ height: 180 }); expect(state).toBe(previous);
  });
});
