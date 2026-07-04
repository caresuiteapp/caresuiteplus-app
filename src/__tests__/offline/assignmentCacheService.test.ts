import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_DB_VERSION, OFFLINE_STORE_NAMES } from '@/lib/offline/types';
import { resetOfflineDbCacheForTests } from '@/lib/offline/idb';
import {
  formatAssignmentCacheTimestamp,
  loadExecutionDetailWithCache,
  loadPortalAppointmentsWithCache,
  readAssignmentListCache,
  writeAssignmentListCache,
  writeExecutionDetailCache,
} from '@/lib/offline/assignmentCacheService';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';

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
}

class MemoryTransaction {
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
}

class MemoryDatabase {
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
    /* no-op */
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

function installMemoryIndexedDb(): void {
  const databases = new Map<string, MemoryDatabase>();

  vi.stubGlobal('indexedDB', {
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
        databases.delete(name);
        request.onsuccess?.({ target: request } as unknown as Event);
      });

      return request as unknown as IDBOpenDBRequest;
    },
  });
}

const sampleItems: PortalAppointmentItem[] = [
  {
    id: 'asg-1',
    title: 'Morgeneinsatz',
    startsAt: '2026-07-04T08:00:00.000Z',
    endsAt: '2026-07-04T09:00:00.000Z',
    status: 'aktiv',
    location: 'Musterstraße 1',
    clientId: 'client-1',
    employeeId: 'emp-1',
    clientName: 'Max M.',
  },
];

const sampleDetail: EmployeePortalAssignmentDetail = {
  assignmentId: 'asg-1',
  tenantId: 'tenant-1',
  title: 'Morgeneinsatz',
  clientId: 'client-1',
  clientName: 'Max M.',
  locationAddress: 'Musterstraße 1',
  plannedStartAt: '2026-07-04T08:00:00.000Z',
  plannedEndAt: '2026-07-04T09:00:00.000Z',
  actualStartAt: null,
  actualEndAt: null,
  onTheWayAt: null,
  arrivedAt: null,
  status: 'bestaetigt',
  canonicalStatus: 'confirmed',
  notesForEmployee: '',
  accessHints: null,
  emergencyContact: null,
  tasks: [],
  statusHistory: [],
  pauseEvents: [],
  documentationStatus: 'none',
  signatureStatus: 'none',
  requiresSignature: false,
  requiresDocumentation: true,
  requiresRoute: true,
  canStartExecution: true,
  canOpenRoute: true,
  canCaptureGps: true,
  allowedTransitions: ['unterwegs'],
  isLocked: false,
  enabledModules: [],
};

vi.mock('@/lib/portal/appointmentService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/portal/appointmentService')>();
  return {
    ...actual,
    fetchPortalAppointments: vi.fn(),
  };
});

vi.mock('@/lib/portal/employeePortalExecutionService', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/portal/employeePortalExecutionService')>();
  return {
    ...actual,
    fetchEmployeePortalAssignmentDetail: vi.fn(),
  };
});

import { fetchPortalAppointments } from '@/lib/portal/appointmentService';
import { fetchEmployeePortalAssignmentDetail } from '@/lib/portal/employeePortalExecutionService';

describe('assignmentCacheService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    resetOfflineDbCacheForTests();
    installMemoryIndexedDb();
    vi.mocked(fetchPortalAppointments).mockReset();
    vi.mocked(fetchEmployeePortalAssignmentDetail).mockReset();
  });

  it('writes and reads assignment list cache', async () => {
    expect(await writeAssignmentListCache('tenant-1', 'emp-1', sampleItems)).toBe(true);
    const cached = await readAssignmentListCache('tenant-1', 'emp-1');
    expect(cached?.items).toHaveLength(1);
    expect(cached?.items[0]?.title).toBe('Morgeneinsatz');
  });

  it('returns live data and caches after successful online load', async () => {
    vi.mocked(fetchPortalAppointments).mockResolvedValue({ ok: true, data: sampleItems });

    const result = await loadPortalAppointmentsWithCache(
      'profile-1',
      'employee_portal',
      'tenant-1',
      'emp-1',
    );

    expect(result.ok).toBe(true);
    expect(result.fromCache).toBe(false);
    const cached = await readAssignmentListCache('tenant-1', 'emp-1');
    expect(cached?.items).toHaveLength(1);
  });

  it('falls back to cache when online load fails', async () => {
    await writeAssignmentListCache('tenant-1', 'emp-1', sampleItems);
    vi.mocked(fetchPortalAppointments).mockResolvedValue({
      ok: false,
      error: 'Netzwerkfehler',
    });

    const result = await loadPortalAppointmentsWithCache(
      'profile-1',
      'employee_portal',
      'tenant-1',
      'emp-1',
    );

    expect(result.ok).toBe(true);
    expect(result.fromCache).toBe(true);
    expect(result.cachedAt).toBeTruthy();
    expect(result.data[0]?.id).toBe('asg-1');
  });

  it('falls back to execution detail cache when online load fails', async () => {
    await writeExecutionDetailCache('tenant-1', 'emp-1', sampleDetail);
    vi.mocked(fetchEmployeePortalAssignmentDetail).mockResolvedValue({
      ok: false,
      error: 'Offline',
    });

    const result = await loadExecutionDetailWithCache(
      'tenant-1',
      'asg-1',
      'emp-1',
      'employee_portal',
    );

    expect(result.ok).toBe(true);
    expect(result.fromCache).toBe(true);
    expect(result.data.title).toBe('Morgeneinsatz');
  });

  it('degrades gracefully when indexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    resetOfflineDbCacheForTests();
    vi.mocked(fetchPortalAppointments).mockResolvedValue({
      ok: false,
      error: 'Netzwerkfehler',
    });

    const result = await loadPortalAppointmentsWithCache(
      'profile-1',
      'employee_portal',
      'tenant-1',
      'emp-1',
    );

    expect(result.ok).toBe(false);
    expect(result.fromCache).toBe(false);
  });

  it('formats cache timestamps for UI', () => {
    expect(formatAssignmentCacheTimestamp('2026-07-04T10:30:00.000Z')).toMatch(/04\.07\.2026/);
    expect(formatAssignmentCacheTimestamp(null)).toBe('unbekannt');
  });
});
