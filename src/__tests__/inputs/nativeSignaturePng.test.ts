import { afterEach, expect, it, vi } from 'vitest';
import { exportNativeSignaturePng } from '@/lib/signatures/nativeSignaturePng';
afterEach(() => vi.useRealTimers());
it('exports a PNG data URL with the current drawing dimensions', async () => {
  const toDataURL = vi.fn((callback: (value: string) => void, _options?: object) => callback('iVBORw0KGgoAAAA='));
  expect(await exportNativeSignaturePng({ toDataURL }, 600, 240)).toBe('data:image/png;base64,iVBORw0KGgoAAAA=');
  expect(toDataURL.mock.calls[0][1]).toEqual({ width: 600, height: 240 });
});
it('rejects a missing renderer or an incompatible SVG export', async () => {
  await expect(exportNativeSignaturePng(null, 600, 240)).rejects.toThrow('erneut bestätigen');
  await expect(exportNativeSignaturePng({ toDataURL: (callback) => callback('PHN2Zz4=') }, 600, 240)).rejects.toThrow('erneut bestätigen');
});
it('restores the retry path when the native renderer never responds', async () => {
  vi.useFakeTimers();
  const assertion = expect(exportNativeSignaturePng({ toDataURL: () => {} }, 600, 240)).rejects.toThrow('erneut bestätigen');
  await vi.advanceTimersByTimeAsync(8000);
  await assertion;
});
