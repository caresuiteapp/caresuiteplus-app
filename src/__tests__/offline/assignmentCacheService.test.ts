import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_DB_VERSION, OFFLINE_STORE_NAMES } from '@/lib/offline/types';
import { resetOfflineDbCacheForTests } from '@/lib/offline/idb';
import {
  dedupeAssignmentItemsById,
  formatAssignmentCacheTimestamp,
  loadExecutionDetailWithCache,
  loadPortalAppointmentDetailWithCache,
  loadPortalAppointmentsWithCache,
  mergeAssignmentListCache,
  mergeAssignmentListsWithStalePreservation,
  readAssignmentListCache,
  readExecutionDetailCache,
  readPortalAppointmentDetailCache,
  sortCachedAssignments,
  writeAssignmentListCache,
  writeExecutionDetailCache,
  writePortalAppointmentDetailCache,
} from '@/lib/offline/assignmentCacheService';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import type { PortalAppointmentDetail } from '@/types/portal/employee';
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

function makeItem(
  id: string,
  title: string,
  startsAt: string,
  status: PortalAppointmentItem['status'] = 'aktiv',
  assignmentStatus?: EmployeePortalAssignmentDetail['status'],
): PortalAppointmentItem {
  return {
    id,
    title,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString(),
    status,
    location: 'Adresse',
    clientId: `client-${id}`,
    employeeId: 'emp-1',
    clientName: `Klient ${id}`,
    assignmentStatus,
  };
}

const threeSameDay: PortalAppointmentItem[] = [
  makeItem('asg-a', 'Nachmittag', '2026-07-04T14:00:00.000Z', 'aktiv', 'bestaetigt'),
  makeItem('asg-b', 'Morgen', '2026-07-04T08:00:00.000Z', 'aktiv', 'unterwegs'),
  makeItem('asg-c', 'Mittag', '2026-07-04T11:00:00.000Z', 'aktiv', 'geplant'),
];

const todayAndUpcoming: PortalAppointmentItem[] = [
  makeItem('asg-today', 'Heute', '2026-07-04T10:00:00.000Z'),
  makeItem('asg-tomorrow', 'Morgen', '2026-07-05T09:00:00.000Z'),
  makeItem('asg-later', 'Übermorgen', '2026-07-06T15:00:00.000Z'),
];

function makeExecutionDetail(
  assignmentId: string,
  title: string,
  status: EmployeePortalAssignmentDetail['status'] = 'bestaetigt',
): EmployeePortalAssignmentDetail {
  return {
    ...sampleDetail,
    assignmentId,
    title,
    status,
    clientName: `Klient ${assignmentId}`,
  };
}

function makePortalDetail(id: string, title: string): PortalAppointmentDetail {
  return {
    id,
    assignmentId: id,
    title,
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
    executionRoute: `/portal/employee/execute/${id}`,
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

vi.mock('@/lib/portal/employeePortalExecutionService', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/portal/employeePortalExecutionService')>();
  return {
    ...actual,
    fetchEmployeePortalAssignmentDetail: vi.fn(),
  };
});

import { fetchPortalAppointments, fetchPortalAppointmentDetail } from '@/lib/portal/appointmentService';
import { fetchEmployeePortalAssignmentDetail } from '@/lib/portal/employeePortalExecutionService';

describe('assignmentCacheService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    resetOfflineDbCacheForTests();
    installMemoryIndexedDb();
    vi.mocked(fetchPortalAppointments).mockReset();
    vi.mocked(fetchPortalAppointmentDetail).mockReset();
    vi.mocked(fetchEmployeePortalAssignmentDetail).mockReset();
  });

  it('writes and reads assignment list cache', async () => {
    expect(await writeAssignmentListCache('tenant-1', 'emp-1', sampleItems)).toBe(true);
    const cached = await readAssignmentListCache('tenant-1', 'emp-1');
    expect(cached?.items).toHaveLength(1);
    expect(cached?.items[0]?.title).toBe('Morgeneinsatz');
  });

  it('caches one assignment online then serves it offline', async () => {
    vi.mocked(fetchPortalAppointments).mockResolvedValueOnce({ ok: true, data: sampleItems });

    const online = await loadPortalAppointmentsWithCache(
      'profile-1',
      'employee_portal',
      'tenant-1',
      'emp-1',
    );
    expect(online.ok).toBe(true);
    expect(online.fromCache).toBe(false);

    vi.mocked(fetchPortalAppointments).mockResolvedValueOnce({
      ok: false,
      error: 'Netzwerkfehler',
    });
    const offline = await loadPortalAppointmentsWithCache(
      'profile-1',
      'employee_portal',
      'tenant-1',
      'emp-1',
    );

    expect(offline.ok).toBe(true);
    expect(offline.fromCache).toBe(true);
    expect(offline.data).toHaveLength(1);
    expect(offline.data[0]?.id).toBe('asg-1');
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

  it('sorts three same-day assignments by start time offline', async () => {
    await writeAssignmentListCache('tenant-1', 'emp-1', threeSameDay);
    vi.mocked(fetchPortalAppointments).mockResolvedValue({
      ok: false,
      error: 'Offline',
    });

    const result = await loadPortalAppointmentsWithCache(
      'profile-1',
      'employee_portal',
      'tenant-1',
      'emp-1',
    );

    expect(result.ok).toBe(true);
    expect(result.fromCache).toBe(true);
    expect(result.data.map((item) => item.id)).toEqual(['asg-b', 'asg-c', 'asg-a']);
  });

  it('sorts today before upcoming assignments chronologically', () => {
    const sorted = sortCachedAssignments(todayAndUpcoming);
    expect(sorted.map((item) => item.id)).toEqual(['asg-today', 'asg-tomorrow', 'asg-later']);
  });

  it('loads execution details A/B/C from separate cache keys', async () => {
    const detailA = makeExecutionDetail('asg-a', 'Einsatz A', 'bestaetigt');
    const detailB = makeExecutionDetail('asg-b', 'Einsatz B', 'unterwegs');
    const detailC = makeExecutionDetail('asg-c', 'Einsatz C', 'geplant');

    await writeExecutionDetailCache('tenant-1', 'emp-1', detailA);
    await writeExecutionDetailCache('tenant-1', 'emp-1', detailB);
    await writeExecutionDetailCache('tenant-1', 'emp-1', detailC);

    vi.mocked(fetchEmployeePortalAssignmentDetail).mockResolvedValue({
      ok: false,
      error: 'Offline',
    });

    const [resultA, resultB, resultC] = await Promise.all([
      loadExecutionDetailWithCache('tenant-1', 'asg-a', 'emp-1', 'employee_portal'),
      loadExecutionDetailWithCache('tenant-1', 'asg-b', 'emp-1', 'employee_portal'),
      loadExecutionDetailWithCache('tenant-1', 'asg-c', 'emp-1', 'employee_portal'),
    ]);

    expect(resultA.data.title).toBe('Einsatz A');
    expect(resultB.data.title).toBe('Einsatz B');
    expect(resultC.data.title).toBe('Einsatz C');
    expect(resultA.data.assignmentId).toBe('asg-a');
    expect(resultB.data.assignmentId).toBe('asg-b');
    expect(resultC.data.assignmentId).toBe('asg-c');
  });

  it('preserves list items A and C when only execution detail B is updated', async () => {
    await writeAssignmentListCache('tenant-1', 'emp-1', threeSameDay);

    const updatedB = makeExecutionDetail('asg-b', 'Einsatz B aktualisiert', 'angekommen');
    await writeExecutionDetailCache('tenant-1', 'emp-1', updatedB);

    const list = await readAssignmentListCache('tenant-1', 'emp-1');
    expect(list?.items.map((item) => item.id)).toEqual(['asg-b', 'asg-c', 'asg-a']);

    const cachedB = await readExecutionDetailCache('tenant-1', 'emp-1', 'asg-b');
    expect(cachedB?.payload.title).toBe('Einsatz B aktualisiert');

    const cachedA = await readExecutionDetailCache('tenant-1', 'emp-1', 'asg-a');
    expect(cachedA).toBeNull();
  });

  it('returns multiple cached assignments when online fetch fails', async () => {
    await writeAssignmentListCache('tenant-1', 'emp-1', threeSameDay);
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
    expect(result.data).toHaveLength(3);
  });

  it('returns honest empty result when online fails and cache is empty', async () => {
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
    expect(result.error).toBe('Netzwerkfehler');
  });

  it('marks assignments missing from online refresh as stale instead of deleting', async () => {
    await writeAssignmentListCache('tenant-1', 'emp-1', threeSameDay);

    const merged = await mergeAssignmentListCache('tenant-1', 'emp-1', [
      makeItem('asg-b', 'Morgen live', '2026-07-04T08:00:00.000Z'),
    ]);

    expect(merged).toHaveLength(3);
    expect(merged.find((item) => item.id === 'asg-b')?.cacheStale).toBe(false);
    expect(merged.find((item) => item.id === 'asg-a')?.cacheStale).toBe(true);
    expect(merged.find((item) => item.id === 'asg-c')?.cacheStale).toBe(true);
  });

  it('dedupes duplicate ids and ignores entries without id', () => {
    const merged = mergeAssignmentListsWithStalePreservation(
      [makeItem('asg-a', 'Live A', '2026-07-04T08:00:00.000Z')],
      [
        { ...makeItem('asg-a', 'Stale A', '2026-07-04T08:00:00.000Z'), cacheStale: true },
        { ...makeItem('', 'Ohne ID', '2026-07-04T09:00:00.000Z') },
        makeItem('asg-b', 'Nur Cache', '2026-07-04T10:00:00.000Z'),
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged.find((item) => item.id === 'asg-a')?.title).toBe('Live A');
    expect(merged.find((item) => item.id === 'asg-b')?.cacheStale).toBe(true);

    const deduped = dedupeAssignmentItemsById([
      { ...makeItem('asg-a', 'Fresh', '2026-07-04T08:00:00.000Z'), cacheStale: false },
      { ...makeItem('asg-a', 'Stale', '2026-07-04T08:00:00.000Z'), cacheStale: true },
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.title).toBe('Fresh');
  });

  it('loads portal appointment details A/B/C from separate cache keys', async () => {
    await writePortalAppointmentDetailCache('tenant-1', 'emp-1', makePortalDetail('asg-a', 'Portal A'));
    await writePortalAppointmentDetailCache('tenant-1', 'emp-1', makePortalDetail('asg-b', 'Portal B'));
    await writePortalAppointmentDetailCache('tenant-1', 'emp-1', makePortalDetail('asg-c', 'Portal C'));

    vi.mocked(fetchPortalAppointmentDetail).mockResolvedValue({
      ok: false,
      error: 'Offline',
    });

    const [resultA, resultB, resultC] = await Promise.all([
      loadPortalAppointmentDetailWithCache('asg-a', 'profile-1', 'employee_portal', 'tenant-1', 'emp-1'),
      loadPortalAppointmentDetailWithCache('asg-b', 'profile-1', 'employee_portal', 'tenant-1', 'emp-1'),
      loadPortalAppointmentDetailWithCache('asg-c', 'profile-1', 'employee_portal', 'tenant-1', 'emp-1'),
    ]);

    expect(resultA.data.title).toBe('Portal A');
    expect(resultB.data.title).toBe('Portal B');
    expect(resultC.data.title).toBe('Portal C');
    expect(resultA.data.notes).toBe('Notiz asg-a');
    expect(resultB.data.notes).toBe('Notiz asg-b');
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
