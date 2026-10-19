type PreferenceEntry = [string, string];

export type DesktopPreferenceStorage = {
  getItem(key: string): Promise<string | null>;
  multiSet(entries: PreferenceEntry[]): Promise<void>;
};

/** Keep current area preferences even when a widget is temporarily unavailable. */
export function readSavedDesktopWidgetIds(value: string | null): string[] | null {
  if (value === null) return null;
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('Invalid saved desktop widgets');
  return [...new Set(parsed.filter((id): id is string => typeof id === 'string'))];
}

/** Replace visible placements while retaining hidden saved IDs in their existing order. */
export function mergeDesktopWidgetPreferences(visibleIds: readonly string[], savedIds: readonly string[], availableIds: readonly string[]): string[] {
  const allowed = new Set(availableIds);
  const visible = [...new Set(visibleIds.filter(id => allowed.has(id)))];
  const merged: string[] = [];
  let nextVisible = 0;
  for (const id of new Set(savedIds)) {
    if (!allowed.has(id)) merged.push(id);
    else if (nextVisible < visible.length) merged.push(visible[nextVisible++]);
  }
  return [...merged, ...visible.slice(nextVisible)];
}

/** Orders writes and reads in this document, including when an area remounts. */
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
