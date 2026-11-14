type PreferenceEntry = [string, string];

export type DesktopPreferenceStorage = {
  getItem(key: string): Promise<string | null>;
  multiSet(entries: PreferenceEntry[]): Promise<void>;
};

/** Optional recommendation preferences must not block restoration of the desktop. */
export function readDismissedDesktopSuggestionRoutes(value: string | null): string[] {
  if (value === null) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed
      .filter((route): route is string => typeof route === 'string')
      .map(route => route.trim())
      .filter(route => route.startsWith('/') && !route.startsWith('//')))];
  } catch {
    return [];
  }
}

/** Orders writes and reads across area remounts in the current application. */
export function createDesktopPreferenceStorage(storage: DesktopPreferenceStorage) {
  let pending: Promise<void> = Promise.resolve();

  return {
    read(keys: readonly string[]): Promise<(string | null)[]> {
      const read = pending.then(() => Promise.all(keys.map(key => storage.getItem(key))));
      pending = read.then(() => undefined, () => undefined);
      return read;
    },
    write(entries: readonly PreferenceEntry[]): Promise<void> {
      // Keep the queued snapshot independent from any caller's later mutations.
      const snapshot: PreferenceEntry[] = entries.map(([key, value]) => [key, value]);
      const write = pending.then(() => storage.multiSet(snapshot));
      pending = write.catch(() => undefined);
      return write;
    },
  };
}
