import AsyncStorage from '@react-native-async-storage/async-storage';

// Full signed HTML, fonts, history and exact retry payloads do not fit in
// localStorage. Keep them losslessly in a dedicated database, outside caches
// that can be evicted by the app. Keys still include both tenant and account.
const DATABASE = 'caresuite-client-intake-drafts';
const STORE = 'drafts';
const STORAGE_ERROR = 'Die Entwurfssicherung auf diesem Gerät ist nicht verfügbar. Bitte lassen Sie die Aufnahme geöffnet und versuchen Sie die Sicherung erneut.';

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (database?: IDBDatabase) => {
      if (settled) { database?.close(); return; }
      settled = true;
      clearTimeout(timer);
      if (database) resolve(database);
      else reject(new Error(STORAGE_ERROR));
    };
    const timer = setTimeout(() => finish(), 3000);
    try {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        if (settled) { request.transaction?.abort(); return; }
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onerror = () => finish();
      request.onblocked = () => finish();
      request.onsuccess = () => finish(request.result);
    } catch { finish(); }
  });
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const database = await openDatabase();
  if (!database) return null;
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      let request: IDBRequest<T>;
      // Request success alone does not mean a write was committed.
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(new Error(STORAGE_ERROR));
      transaction.onerror = () => reject(new Error(STORAGE_ERROR));
      request = operation(transaction.objectStore(STORE));
    });
  } finally { database.close(); }
}

export default {
  async getItem(key: string): Promise<string | null> {
    const stored = await transact<string | undefined>('readonly', store => store.get(key));
    if (stored != null) return stored;
    // Read old drafts unchanged. Migration happens only after a new complete
    // copy is committed; a failed write must never destroy the old draft.
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      try { await AsyncStorage.setItem(key, value); }
      catch { throw new Error(STORAGE_ERROR); }
      return;
    }
    await transact('readwrite', store => store.put(value, key));
    // Release only this migrated entry after commit. Cleanup failure does not
    // invalidate a durable save; reads always prefer the committed IDB copy.
    try { await AsyncStorage.removeItem(key); } catch { /* Retain legacy copy. */ }
  },
  async removeItem(key: string): Promise<void> {
    // Clear the legacy copy first so a failed cleanup cannot resurrect it.
    // If deletion fails, the IDB original remains recoverable.
    await AsyncStorage.removeItem(key);
    await transact('readwrite', store => store.delete(key));
  },
};
