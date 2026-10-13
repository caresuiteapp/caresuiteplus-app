import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_STORE_NAMES,
} from '@/lib/offline/types';
import {
  clearOfflineDb,
  getOfflineDbHealth,
  getSyncMeta,
  openOfflineDb,
  putSyncMeta,
  resetOfflineDbCacheForTests,
} from '@/lib/offline/idb';

type StoreRecord = Record<string, unknown>;

class MemoryObjectStore {
  private data = new Map<string, StoreRecord>();

  constructor(private keyPath: string) {}

  put(value: StoreRecord): IDBRequest<StoreRecord> {
    const key = String(value[this.keyPath]);
    this.data.set(key, { ...value });
    return createRequest(this.data.get(key)!);
  }

  get(key: string): IDBRequest<StoreRecord | undefined> {
    return createRequest(this.data.get(key));
  }

  clear(): void {
    this.data.clear();
  }
}

class MemoryTransaction {
  done = false;
  error: DOMException | null = null;

  constructor(
    private db: MemoryDatabase,
    private storeNames: string[],
    public mode: IDBTransactionMode,
  ) {}

  objectStore(name: string): MemoryObjectStore {
    const store = this.db.getStore(name);
    if (!store) throw new DOMException('Store not found', 'NotFoundError');
    return store;
  }

  abort(): void {
    this.error = new DOMException('Transaction aborted', 'AbortError');
    this.done = true;
  }
}

class MemoryDatabase {
  closed = false;
  version = OFFLINE_DB_VERSION;
  private stores = new Map<string, MemoryObjectStore>();

  constructor() {
    for (const name of OFFLINE_STORE_NAMES) {
      this.stores.set(name, new MemoryObjectStore('key'));
    }
  }

  get objectStoreNames(): DOMStringList {
    const names = [...this.stores.keys()];
    return {
      length: names.length,
      contains: (name: string) => this.stores.has(name),
      item: (index: number) => names[index] ?? null,
      [Symbol.iterator]: () => names[Symbol.iterator](),
    } as DOMStringList;
  }

  getStore(name: string): MemoryObjectStore | undefined {
    return this.stores.get(name);
  }

  transaction(storeNames: string | string[], mode: IDBTransactionMode): MemoryTransaction {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    return new MemoryTransaction(this, names, mode);
  }

  close(): void {
    this.closed = true;
  }
}

function createRequest<T>(result: T): IDBRequest<T> {
  const request = {
    result,
    error: null as DOMException | null,
    onsuccess: null as ((event: Event) => void) | null,
    onerror: null as ((event: Event) => void) | null,
  } as IDBRequest<T>;

  queueMicrotask(() => {
    request.onsuccess?.({ target: request } as unknown as Event);
  });

  return request;
}

function installMemoryIndexedDb(): { databases: Map<string, MemoryDatabase> } {
  const databases = new Map<string, MemoryDatabase>();

  const indexedDBMock = {
    open(name: string, version?: number) {
      const request = {
        result: null as MemoryDatabase | null,
        error: null as DOMException | null,
        onsuccess: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onupgradeneeded: null as ((event: Event) => void) | null,
        onblocked: null as ((event: Event) => void) | null,
      };

      queueMicrotask(() => {
        let db = databases.get(name);
        const nextVersion = version ?? OFFLINE_DB_VERSION;
        if (!db || db.version < nextVersion) {
          db = new MemoryDatabase();
          db.version = nextVersion;
          databases.set(name, db);
          request.onupgradeneeded?.({
            target: { result: db, transaction: null },
          } as unknown as IDBVersionChangeEvent);
        }
        request.result = db;
        db.closed = false;
        request.onsuccess?.({ target: request } as unknown as Event);
      });

      return request as unknown as IDBOpenDBRequest;
    },
    deleteDatabase(name: string) {
      const request = {
        result: undefined,
        error: null as DOMException | null,
        onsuccess: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onblocked: null as ((event: Event) => void) | null,
      };

      queueMicrotask(() => {
        if (databases.get(name)?.closed === false) {
          request.onblocked?.({ target: request } as unknown as Event);
          return;
        }
        databases.delete(name);
        request.onsuccess?.({ target: request } as unknown as Event);
      });

      return request as unknown as IDBOpenDBRequest;
    },
  };

  vi.stubGlobal('indexedDB', indexedDBMock);
  return { databases };
}

describe('offline IndexedDB foundation', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    resetOfflineDbCacheForTests();
    installMemoryIndexedDb();
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('opens CareSuiteOfflineDB with all v1 stores', async () => {
    const db = await openOfflineDb();
    expect(db).not.toBeNull();
    expect(OFFLINE_STORE_NAMES.every((name) => db!.objectStoreNames.contains(name))).toBe(true);
  });

  it('round-trips sync_meta via putSyncMeta/getSyncMeta', async () => {
    const record = {
      key: 'default',
      lastSyncAt: null,
      deviceId: 'device-test',
      schemaVersion: OFFLINE_DB_VERSION,
      tenantId: 'tenant-1',
      updatedAt: new Date().toISOString(),
    };

    expect(await putSyncMeta(record)).toBe(true);
    const loaded = await getSyncMeta('default');
    expect(loaded).toMatchObject(record);
  });

  it('reports available health when stores exist', async () => {
    await openOfflineDb();
    const health = await getOfflineDbHealth();
    expect(health.status).toBe('available');
    expect(health.storeCount).toBe(OFFLINE_STORE_NAMES.length);
    expect(health.error).toBeNull();
  });

  it('clearOfflineDb deletes the database', async () => {
    const db = await openOfflineDb();
    const close = vi.spyOn(db!, 'close');
    expect(await clearOfflineDb()).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    resetOfflineDbCacheForTests();
    const health = await getOfflineDbHealth();
    expect(health.status).toBe('available');
  });
  it('closes another tab connection on versionchange so logout can delete the cache', async () => {
    const db = await openOfflineDb();
    const close = vi.spyOn(db!, 'close');
    db!.onversionchange!.call(db!, {} as IDBVersionChangeEvent);
    expect(close).toHaveBeenCalledOnce();
    const reopened = await openOfflineDb();
    expect(reopened).not.toBeNull();
  });
  it('finishes a deletion blocked by an older tab instead of leaving sign-out pending forever', async () => {
    const request = {} as IDBOpenDBRequest;
    vi.spyOn(indexedDB, 'deleteDatabase').mockReturnValue(request);
    const pending = clearOfflineDb();
    await Promise.resolve();
    request.onblocked!.call(request, {} as IDBVersionChangeEvent);
    expect(await pending).toBe(false);
  });
  it('bounds a deletion that never receives an IndexedDB event', async () => {
    vi.useFakeTimers();
    vi.spyOn(indexedDB, 'deleteDatabase').mockReturnValue({} as IDBOpenDBRequest);
    const pending = clearOfflineDb();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await pending).toBe(false);
  });
  it('falls back from a blocked open and closes a late connection instead of leaking it', async () => {
    const db = { close: vi.fn() } as unknown as IDBDatabase;
    const request = { result: db } as IDBOpenDBRequest;
    vi.spyOn(indexedDB, 'open').mockReturnValue(request);
    const pending = openOfflineDb();
    request.onblocked!.call(request, {} as IDBVersionChangeEvent);
    expect(await pending).toBeNull();
    request.onsuccess!.call(request, {} as Event);
    expect(db.close).toHaveBeenCalledOnce();
  });
  it('bounds a stalled open so network-backed pages can continue without an offline cache', async () => {
    vi.useFakeTimers();
    vi.spyOn(indexedDB, 'open').mockReturnValue({} as IDBOpenDBRequest);
    const pending = openOfflineDb();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await pending).toBeNull();
  });

  it('returns unavailable health when indexedDB is missing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    resetOfflineDbCacheForTests();
    const health = await getOfflineDbHealth();
    expect(health.status).toBe('unavailable');
    expect(health.error).toBe('indexeddb_not_supported');
  });

  it('uses expected database name and version constants', () => {
    expect(OFFLINE_DB_NAME).toBe('CareSuiteOfflineDB');
    expect(OFFLINE_DB_VERSION).toBe(1);
  });
});
