import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_DB_VERSION, OFFLINE_STORE_NAMES } from '@/lib/offline/types';
import { resetOfflineDbCacheForTests } from '@/lib/offline/idb';
import {
  MAX_PREFETCH_DETAILS,
  prefetchEmployeeAssignmentCache,
  readExecutionDetailCache,
  readPortalAppointmentDetailCache,
} from '@/lib/offline/assignmentCacheService';
import {
  classifyPrefetchApiNoise,
  prefetchAssignmentDetailCaches,
  resetAssignmentDetailPrefetchForTests,
  selectPrefetchAssignmentCandidates,
} from '@/lib/offline/assignmentDetailPrefetch';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';

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
  constructor(private db: MemoryDatabase, private storeNames: string[], public mode: IDBTransactionMode) {}
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

function makeItem(id: string, startsAt: string): PortalAppointmentItem {
  return {
    id,
    title: `Einsatz ${id}`,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString(),
    status: 'aktiv',
    location: 'Adresse',
    clientId: `client-${id}`,
    employeeId: 'emp-1',
    clientName: `Klient ${id}`,
  };
}

vi.mock('@/lib/portal/appointmentService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/portal/appointmentService')>();
  return {
    ...actual,
    fetchPortalAppointments: vi.fn(),
    fetchPortalAppointmentDetail: vi.fn(),
  };
});

vi.mock('@/lib/portal/employeePortalExecutionLiveService', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/portal/employeePortalExecutionLiveService')>();
  return {
    ...actual,
    fetchLiveEmployeePortalAssignmentDetail: vi.fn(),
  };
});

import { fetchPortalAppointments, fetchPortalAppointmentDetail } from '@/lib/portal/appointmentService';
import { fetchLiveEmployeePortalAssignmentDetail } from '@/lib/portal/employeePortalExecutionLiveService';

describe('OFFLINE.3 detail prefetch integration', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    resetOfflineDbCacheForTests();
    resetAssignmentDetailPrefetchForTests();
    installMemoryIndexedDb();
    vi.mocked(fetchPortalAppointments).mockReset();
    vi.mocked(fetchPortalAppointmentDetail).mockReset();
    vi.mocked(fetchLiveEmployeePortalAssignmentDetail).mockReset();
  });

  it('prefetches portal and execution detail caches for three assignments', async () => {
    const items = [
      makeItem('asg-a', '2026-07-04T08:00:00.000Z'),
      makeItem('asg-b', '2026-07-04T10:00:00.000Z'),
      makeItem('asg-c', '2026-07-04T12:00:00.000Z'),
    ];

    vi.mocked(fetchLiveEmployeePortalAssignmentDetail).mockImplementation(async (_t, id) => ({
      ok: true,
      data: {
        assignmentId: id,
        tenantId: 'tenant-1',
        title: `Exec ${id}`,
        clientId: `client-${id}`,
        clientName: `Klient ${id}`,
        locationAddress: 'Adresse',
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
        requiresDocumentation: false,
        requiresRoute: false,
        canStartExecution: true,
        canOpenRoute: true,
        canCaptureGps: true,
        allowedTransitions: [],
        isLocked: false,
        enabledModules: [],
      },
    }));

    vi.mocked(fetchPortalAppointmentDetail).mockImplementation(async (id) => ({
      ok: true,
      data: {
        id,
        assignmentId: id,
        title: `Portal ${id}`,
        startsAt: '2026-07-04T08:00:00.000Z',
        endsAt: '2026-07-04T09:00:00.000Z',
        status: 'aktiv',
        location: 'Adresse',
        clientId: `client-${id}`,
        clientName: `Klient ${id}`,
        clientPhone: null,
        notes: `Notiz ${id}`,
        tasks: [`Task ${id}`],
        canStartExecution: true,
        canOpenExecution: true,
        executionRoute: `/portal/employee/assignments/${id}/execute`,
      },
    }));

    const result = await prefetchAssignmentDetailCaches(
      'profile-1',
      'employee_portal',
      'tenant-1',
      'emp-1',
      items,
    );

    expect(result.attempted).toBe(3);
    expect(result.portalWritten).toBe(3);
    expect(result.executionWritten).toBe(3);

    const portalA = await readPortalAppointmentDetailCache('tenant-1', 'emp-1', 'asg-a');
    const portalB = await readPortalAppointmentDetailCache('tenant-1', 'emp-1', 'asg-b');
    const execC = await readExecutionDetailCache('tenant-1', 'emp-1', 'asg-c');
    expect(portalA?.payload.title).toBe('Portal asg-a');
    expect(portalB?.payload.notes).toBe('Notiz asg-b');
    expect(execC?.payload.title).toBe('Exec asg-c');
  });

  it('bounds prefetch to MAX_PREFETCH_DETAILS for 14 assignments', async () => {
    const items = Array.from({ length: 14 }, (_, index) =>
      makeItem(`asg-${index}`, new Date(Date.UTC(2026, 6, 4 + index, 8, 0, 0)).toISOString()),
    );

    const candidates = selectPrefetchAssignmentCandidates(items);
    expect(candidates.length).toBe(MAX_PREFETCH_DETAILS);

    vi.mocked(fetchLiveEmployeePortalAssignmentDetail).mockResolvedValue({
      ok: false,
      error: 'skip',
    });
    vi.mocked(fetchPortalAppointmentDetail).mockResolvedValue({
      ok: false,
      error: 'skip',
    });

    const result = await prefetchAssignmentDetailCaches(
      'profile-1',
      'employee_portal',
      'tenant-1',
      'emp-1',
      items,
    );
    expect(result.attempted).toBe(MAX_PREFETCH_DETAILS);
  });

  it('tolerates prefetch failure for B while A and C succeed', async () => {
    const items = [
      makeItem('asg-a', '2026-07-04T08:00:00.000Z'),
      makeItem('asg-b', '2026-07-04T10:00:00.000Z'),
      makeItem('asg-c', '2026-07-04T12:00:00.000Z'),
    ];

    vi.mocked(fetchPortalAppointmentDetail).mockImplementation(async (id) => {
      if (id === 'asg-b') return { ok: false, error: 'Detail B failed' };
      return {
        ok: true,
        data: {
          id,
          assignmentId: id,
          title: `Portal ${id}`,
          startsAt: '2026-07-04T08:00:00.000Z',
          endsAt: '2026-07-04T09:00:00.000Z',
          status: 'aktiv',
          location: null,
          clientId: `client-${id}`,
          clientName: `Klient ${id}`,
          clientPhone: null,
          notes: null,
          tasks: [],
          canStartExecution: false,
          canOpenExecution: false,
          executionRoute: null,
        },
      };
    });

    vi.mocked(fetchLiveEmployeePortalAssignmentDetail).mockResolvedValue({
      ok: false,
      error: 'exec skip',
    });

    const result = await prefetchAssignmentDetailCaches(
      'profile-1',
      'employee_portal',
      'tenant-1',
      'emp-1',
      items,
    );

    expect(result.portalWritten).toBe(2);
    expect(result.failures.some((f) => f.assignmentId === 'asg-b')).toBe(true);
    expect(await readPortalAppointmentDetailCache('tenant-1', 'emp-1', 'asg-a')).not.toBeNull();
    expect(await readPortalAppointmentDetailCache('tenant-1', 'emp-1', 'asg-b')).toBeNull();
    expect(await readPortalAppointmentDetailCache('tenant-1', 'emp-1', 'asg-c')).not.toBeNull();
  });

  it('prefetchEmployeeAssignmentCache writes list then schedules detail prefetch', async () => {
    const items = [makeItem('asg-1', '2026-07-04T08:00:00.000Z')];
    vi.mocked(fetchPortalAppointments).mockResolvedValue({ ok: true, data: items });
    vi.mocked(fetchPortalAppointmentDetail).mockResolvedValue({
      ok: true,
      data: {
        id: 'asg-1',
        assignmentId: 'asg-1',
        title: 'Portal 1',
        startsAt: items[0]!.startsAt,
        endsAt: items[0]!.endsAt,
        status: 'aktiv',
        location: null,
        clientId: 'client-asg-1',
        clientName: 'Klient asg-1',
        clientPhone: null,
        notes: null,
        tasks: [],
        canStartExecution: true,
        canOpenExecution: true,
        executionRoute: '/portal/employee/assignments/asg-1/execute',
      },
    });
    vi.mocked(fetchLiveEmployeePortalAssignmentDetail).mockResolvedValue({ ok: false, error: 'skip' });

    await prefetchEmployeeAssignmentCache('profile-1', 'employee_portal', 'tenant-1', 'emp-1');
    await vi.waitFor(async () => {
      const cached = await readPortalAppointmentDetailCache('tenant-1', 'emp-1', 'asg-1');
      expect(cached?.payload.title).toBe('Portal 1');
    });
  });
});

describe('CONSOLE.1 prefetch API noise classification', () => {
  it('marks RLS/access messages as expected_access', () => {
    expect(classifyPrefetchApiNoise('Keine Berechtigung für diesen Einsatz.')).toBe('expected_access');
  });

  it('marks not-found messages separately from unexpected failures', () => {
    expect(classifyPrefetchApiNoise('Einsatz nicht gefunden.')).toBe('not_found');
    expect(classifyPrefetchApiNoise('write_failed')).toBe('unexpected');
  });
});
