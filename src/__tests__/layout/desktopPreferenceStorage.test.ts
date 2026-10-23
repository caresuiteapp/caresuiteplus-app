import { describe, expect, it, vi } from 'vitest';
import { createDesktopPreferenceStorage, mergeDesktopWidgetPreferences, readDismissedDesktopSuggestionRoutes, readSavedDesktopWidgetIds } from '@/lib/preferences/desktopPreferenceStorage.web';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('Web desktop preference storage ordering', () => {
  it('does not allow an older delayed snapshot to overwrite a newer selection', async () => {
    const memory = new Map<string, string>();
    const first = deferred<void>();
    const storage = {
      getItem: vi.fn(async (key: string) => memory.get(key) ?? null),
      multiSet: vi.fn(async (entries: [string, string][]) => {
        if (entries[0][1] === 'old') await first.promise;
        entries.forEach(([key, value]) => memory.set(key, value));
      }),
    };
    const queue = createDesktopPreferenceStorage(storage);
    const oldWrite = queue.write([['desktop', 'old']]);
    const newWrite = queue.write([['desktop', 'new']]);
    await Promise.resolve();
    expect(storage.multiSet).toHaveBeenCalledTimes(1);
    first.resolve();
    await Promise.all([oldWrite, newWrite]);
    expect(memory.get('desktop')).toBe('new');
    expect(storage.multiSet).toHaveBeenCalledTimes(2);
  });

  it('reads the completed selection after a pending write when an area remounts', async () => {
    const first = deferred<void>();
    const memory = new Map<string, string>();
    const storage = {
      getItem: vi.fn(async (key: string) => memory.get(key) ?? null),
      multiSet: vi.fn(async (entries: [string, string][]) => { await first.promise; entries.forEach(([key, value]) => memory.set(key, value)); }),
    };
    const queue = createDesktopPreferenceStorage(storage);
    const writing = queue.write([['area-office', '["notes"]'], ['background', 'soft']]);
    const reading = queue.read(['area-office', 'background', 'area-assist']);
    await Promise.resolve();
    expect(storage.getItem).not.toHaveBeenCalled();
    first.resolve();
    await writing;
    expect(await reading).toEqual(['["notes"]', 'soft', null]);
  });

  it('propagates a failed write while allowing retry and later scopes to proceed', async () => {
    const storage = {
      getItem: vi.fn(async () => null),
      multiSet: vi.fn().mockRejectedValueOnce(new Error('Storage full')).mockResolvedValue(undefined),
    };
    const queue = createDesktopPreferenceStorage(storage);
    const failed = queue.write([['tenant-a.user-a.office', '[]']]);
    const retry = queue.write([['tenant-a.user-a.office', '[]']]);
    await expect(failed).rejects.toThrow('Storage full');
    await retry;
    await queue.write([['tenant-b.user-a.office', '["clients"]']]);
    expect(storage.multiSet).toHaveBeenLastCalledWith([['tenant-b.user-a.office', '["clients"]']]);
  });

  it('reports read errors without writing defaults or blocking the next read', async () => {
    const storage = {
      getItem: vi.fn().mockRejectedValueOnce(new Error('Storage unavailable')).mockResolvedValue('[]'),
      multiSet: vi.fn(async () => undefined),
    };
    const queue = createDesktopPreferenceStorage(storage);
    await expect(queue.read(['desktop'])).rejects.toThrow('Storage unavailable');
    expect(storage.multiSet).not.toHaveBeenCalled();
    expect(await queue.read(['desktop'])).toEqual(['[]']);
  });

  it('takes a copy of queued values and keeps an intentionally empty selection', async () => {
    const gate = deferred<void>();
    const storage = { getItem: vi.fn(async () => null), multiSet: vi.fn().mockImplementationOnce(() => gate.promise).mockResolvedValue(undefined) };
    const queue = createDesktopPreferenceStorage(storage);
    const first = queue.write([['background', 'original']]);
    const values: [string, string][] = [['desktop', '[]']];
    const second = queue.write(values);
    values[0][1] = '["unwanted"]';
    gate.resolve();
    await Promise.all([first, second]);
    expect(storage.multiSet).toHaveBeenLastCalledWith([['desktop', '[]']]);
  });

  it('finishes an ongoing read before starting a later write', async () => {
    const gate = deferred<string | null>();
    const storage = { getItem: vi.fn(() => gate.promise), multiSet: vi.fn(async () => undefined) };
    const queue = createDesktopPreferenceStorage(storage);
    const reading = queue.read(['desktop']);
    const writing = queue.write([['desktop', 'new']]);
    await Promise.resolve();
    expect(storage.multiSet).not.toHaveBeenCalled();
    gate.resolve('old');
    expect(await reading).toEqual(['old']);
    await writing;
    expect(storage.multiSet).toHaveBeenCalledWith([['desktop', 'new']]);
  });
});

describe('current area widget preferences with temporarily unavailable widgets', () => {
  it('retains hidden choices through edits and restores them when permissions return', () => {
    const saved = readSavedDesktopWidgetIds('["clients","restricted","messages","old-widget"]')!;
    const allowed = ['clients', 'messages', 'notes'];
    const visible = saved.filter(id => allowed.includes(id));
    expect(visible).toEqual(['clients', 'messages']);
    expect(mergeDesktopWidgetPreferences(visible, saved, allowed)).toEqual(saved);

    // Remove Clients and add Notes while Restricted is unavailable.
    const written = mergeDesktopWidgetPreferences(['messages', 'notes'], saved, allowed);
    expect(written).toEqual(['messages', 'restricted', 'notes', 'old-widget']);
    const restored = readSavedDesktopWidgetIds(JSON.stringify(written))!;
    const regained = [...allowed, 'restricted'];
    expect(restored.filter(id => regained.includes(id))).toEqual(['messages', 'restricted', 'notes']);
    expect(restored).not.toContain('clients');
    expect(restored).toContain('old-widget');
  });

  it('keeps hidden preferences when the visible desktop or available catalogue is empty', () => {
    expect(mergeDesktopWidgetPreferences([], ['clients', 'hidden'], ['clients'])).toEqual(['hidden']);
    expect(mergeDesktopWidgetPreferences([], ['clients', 'hidden'], [])).toEqual(['clients', 'hidden']);
    expect(mergeDesktopWidgetPreferences([], [], ['clients'])).toEqual([]);
    expect(mergeDesktopWidgetPreferences(['not-allowed'], [], ['clients'])).toEqual([]);
  });

  it('distinguishes missing and intentionally empty preferences and rejects corrupted records', () => {
    expect(readSavedDesktopWidgetIds(null)).toBeNull();
    expect(readSavedDesktopWidgetIds('[]')).toEqual([]);
    expect(readSavedDesktopWidgetIds('["hidden",7,"hidden",null,"clients"]')).toEqual(['hidden', 'clients']);
    for (const value of ['broken', '{}', 'null']) expect(() => readSavedDesktopWidgetIds(value)).toThrow();
  });
});

describe('dismissed desktop suggestion preferences', () => {
  it('treats absent or corrupt optional preferences as an empty dismissal list', () => {
    for (const value of [null, 'broken', '{}', 'null', '7', '"/office/notizen"']) {
      expect(readDismissedDesktopSuggestionRoutes(value)).toEqual([]);
    }
  });

  it('normalizes and deduplicates local routes while preserving separate services and unavailable pages', () => {
    const calendar = '/business/connect/google-workspace?service=calendar';
    const tasks = '/business/connect/google-workspace?service=tasks';
    expect(readDismissedDesktopSuggestionRoutes(JSON.stringify([
      ' /office/notizen ', '/office/notizen', calendar, tasks, '/currently-unavailable',
      7, null, {}, '', 'notes', 'https://example.com/notes', '//example.com/notes',
    ]))).toEqual(['/office/notizen', calendar, tasks, '/currently-unavailable']);
  });
});
