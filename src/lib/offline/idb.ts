import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_STORE_NAMES,
  type OfflineDbHealth,
  type OfflineStoreName,
  type SyncMetaRecord,
} from './types';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function isIndexedDbSupported(): boolean {
  if (typeof indexedDB === 'undefined') return false;
  try {
    return typeof indexedDB.open === 'function';
  } catch {
    return false;
  }
}

function mapOpenError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') return 'quota_exceeded';
    if (error.name === 'SecurityError') return 'security_error';
    return error.name;
  }
  if (error instanceof Error) return error.message;
  return 'unknown_error';
}

function openDbInternal(): Promise<IDBDatabase | null> {
  if (!isIndexedDbSupported()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    } catch (error) {
      console.warn('[CareSuite offline] IndexedDB open threw:', mapOpenError(error));
      resolve(null);
      return;
    }

    request.onerror = () => {
      console.warn('[CareSuite offline] IndexedDB open failed:', mapOpenError(request.error));
      resolve(null);
    };

    request.onblocked = () => {
      console.warn('[CareSuite offline] IndexedDB open blocked by another tab');
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      for (const storeName of OFFLINE_STORE_NAMES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'key' });
        }
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

/** Opens (or reuses) the offline database. Returns null when IDB is unavailable. */
export async function openOfflineDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = openDbInternal();
  }
  return dbPromise;
}

/** Resets the cached open promise — for tests and after deleteDatabase. */
export function resetOfflineDbCacheForTests(): void {
  dbPromise = null;
}

function runTransaction<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = operation(store);

    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'));
    };

    tx.onabort = () => {
      reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    };

    request.onsuccess = () => {
      resolve(request.result as T);
    };
  });
}

/** Health probe — does not throw; reports availability for UI/diagnostics. */
export async function getOfflineDbHealth(): Promise<OfflineDbHealth> {
  if (!isIndexedDbSupported()) {
    return {
      status: 'unavailable',
      schemaVersion: OFFLINE_DB_VERSION,
      storeCount: 0,
      error: 'indexeddb_not_supported',
    };
  }

  try {
    const db = await openOfflineDb();
    if (!db) {
      return {
        status: 'unavailable',
        schemaVersion: OFFLINE_DB_VERSION,
        storeCount: 0,
        error: 'open_failed',
      };
    }

    const storeCount = OFFLINE_STORE_NAMES.filter((name) =>
      db.objectStoreNames.contains(name),
    ).length;

    return {
      status: storeCount === OFFLINE_STORE_NAMES.length ? 'available' : 'degraded',
      schemaVersion: db.version,
      storeCount,
      error: storeCount === OFFLINE_STORE_NAMES.length ? null : 'missing_stores',
    };
  } catch (error) {
    return {
      status: 'unavailable',
      schemaVersion: OFFLINE_DB_VERSION,
      storeCount: 0,
      error: mapOpenError(error),
    };
  }
}

export async function putStoreRecord<T extends { key: string }>(
  storeName: OfflineStoreName,
  record: T,
): Promise<boolean> {
  const db = await openOfflineDb();
  if (!db) return false;

  try {
    await runTransaction(db, storeName, 'readwrite', (store) =>
      store.put({ ...record, key: record.key }),
    );
    return true;
  } catch (error) {
    console.warn(`[CareSuite offline] putStoreRecord(${storeName}) failed:`, mapOpenError(error));
    return false;
  }
}

export async function getStoreRecord<T extends { key: string }>(
  storeName: OfflineStoreName,
  key: string,
): Promise<T | null> {
  const db = await openOfflineDb();
  if (!db) return null;

  try {
    const result = await runTransaction<T | undefined>(db, storeName, 'readonly', (store) =>
      store.get(key),
    );
    return result ?? null;
  } catch (error) {
    console.warn(`[CareSuite offline] getStoreRecord(${storeName}) failed:`, mapOpenError(error));
    return null;
  }
}

export async function putSyncMeta(record: SyncMetaRecord): Promise<boolean> {
  const db = await openOfflineDb();
  if (!db) return false;

  try {
    await runTransaction(db, 'sync_meta', 'readwrite', (store) =>
      store.put({ ...record, key: record.key }),
    );
    return true;
  } catch (error) {
    console.warn('[CareSuite offline] putSyncMeta failed:', mapOpenError(error));
    return false;
  }
}

export async function getSyncMeta(key = 'default'): Promise<SyncMetaRecord | null> {
  const db = await openOfflineDb();
  if (!db) return null;

  try {
    const result = await runTransaction<SyncMetaRecord | undefined>(
      db,
      'sync_meta',
      'readonly',
      (store) => store.get(key),
    );
    return result ?? null;
  } catch (error) {
    console.warn('[CareSuite offline] getSyncMeta failed:', mapOpenError(error));
    return null;
  }
}

export async function clearOfflineDb(): Promise<boolean> {
  resetOfflineDbCacheForTests();

  if (!isIndexedDbSupported()) return false;

  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(OFFLINE_DB_NAME);
      request.onerror = () => {
        console.warn('[CareSuite offline] clearOfflineDb failed:', mapOpenError(request.error));
        resolve(false);
      };
      request.onblocked = () => {
        console.warn('[CareSuite offline] clearOfflineDb blocked');
      };
      request.onsuccess = () => {
        resolve(true);
      };
    } catch (error) {
      console.warn('[CareSuite offline] clearOfflineDb threw:', mapOpenError(error));
      resolve(false);
    }
  });
}
