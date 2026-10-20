import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import draftStorage from '@/lib/clients/clientIntakeDraftStore.web';
import { clearClientIntakeDraft, loadClientIntakeDraft, saveClientIntakeDraft } from '@/lib/clients/clientIntakeDraftStorage';
import { createEmptyIntakeForm } from '@/lib/clients/clientIntakeService';
import { prepareIntakeDocumentPackage, signIntakeDocumentPackage } from '@/features/intakeDocuments/intakeDocumentPackage';
import { listApplicableIntakeTemplates } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { OPTIONAL_CONSENT_TEMPLATE_KEYS } from '@/features/intakeDocuments/intakeDocumentTypes';

vi.mock('@/lib/clients/clientIntakeDraftStore', async () => import('@/lib/clients/clientIntakeDraftStore.web'));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));

const user = 'test-user', tenant = 'test-tenant';
const clientA = '11111111-1111-4111-8111-111111111111';
const clientB = '22222222-2222-4222-8222-222222222222';
const key = `caresuite:client-intake-draft:${tenant}:${user}`;
const legacy = new Map<string, string>(), records = new Map<string, string>();
let failCommit = false;
let beforeCommit: (() => void) | undefined;

// Same in-memory IDB approach as the existing offline suites, with separate
// request success/transaction commit to exercise durable-write failures.
function installDatabase() {
  vi.stubGlobal('indexedDB', {
    open: vi.fn(() => {
      const database = {
        objectStoreNames: { contains: () => true }, close: vi.fn(),
        transaction: (_store: string, mode: string) => {
          const tx = { oncomplete: null, onabort: null, onerror: null } as unknown as IDBTransaction;
          const operation = (result: unknown, commit?: () => void) => {
            const request = { result } as IDBRequest;
            queueMicrotask(() => {
              request.onsuccess?.(new Event('success'));
              beforeCommit?.();
              if (mode === 'readwrite' && failCommit) tx.onabort?.(new Event('abort'));
              else { commit?.(); tx.oncomplete?.(new Event('complete')); }
            });
            return request;
          };
          tx.objectStore = () => ({
            get: (key: string) => operation(records.get(key)),
            put: (value: string, key: string) => operation(key, () => { records.set(key, value); }),
            delete: (key: string) => operation(undefined, () => { records.delete(key); }),
          } as unknown as IDBObjectStore);
          return tx;
        },
      };
      const request = { result: database } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => request.onsuccess?.(new Event('success')));
      return request;
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks(); legacy.clear(); records.clear(); failCommit = false; beforeCommit = undefined;
  vi.mocked(AsyncStorage.getItem).mockImplementation(async key => legacy.get(key) ?? null);
  vi.mocked(AsyncStorage.setItem).mockRejectedValue(new DOMException('Storage quota exceeded', 'QuotaExceededError'));
  vi.mocked(AsyncStorage.removeItem).mockImplementation(async key => { legacy.delete(key); });
  installDatabase();
});
afterEach(() => vi.unstubAllGlobals());

describe('web intake draft storage with a full localStorage', () => {
  it('round-trips a complete signed package, history and exact pending request beyond the localStorage quota', async () => {
    const form = { ...createEmptyIntakeForm(), firstName: 'Erika', lastName: 'Muster', dateOfBirth: '1950-01-01',
      street: 'Testweg', houseNumber: '4', zip: '10115', city: 'Berlin', phone: '030123456',
      emergencyContactName: 'Alex Muster', emergencyContactPhone: '0307654321', careContexts: ['daily_assistance' as const],
      intakeContractType: 'assist' as const, careLevel: 'pg2', serviceStart: '2026-11-01', costBearerTypes: ['pflegekasse'],
      careFundName: 'Test Pflegekasse', insuranceNumber: 'A123456789', intakeAssignmentEnabled: true,
      intakeOptionalConsents: [...OPTIONAL_CONSENT_TEMPLATE_KEYS] };
    const templates = listApplicableIntakeTemplates(form);
    const prepared = prepareIntakeDocumentPackage(form, templates);
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const signed = signIntakeDocumentPackage(prepared.form, templates, prepared.documents, {
      client: { role: 'client', dataUrl: png, signedAt: '2026-10-20T09:00:00Z' },
      employee: { role: 'employee', dataUrl: png, signedAt: '2026-10-20T09:00:00Z' },
    });
    expect(signed.ok).toBe(true); if (!signed.ok) return;
    const finalForm = { ...signed.form, intakeDocumentHistory: [signed.form.intakeDocuments[0]] };
    const draft = { form: finalForm, stepIndex: 7, clientId: clientA, serverRevision: 3,
      serverFormSnapshot: JSON.stringify(prepared.form), pendingSave: { operationId: clientB, expectedRevision: 3, form: finalForm } };
    expect(JSON.stringify(draft).length * 2).toBeGreaterThan(5 * 1024 * 1024);
    await saveClientIntakeDraft(user, tenant, draft);
    const restored = await loadClientIntakeDraft(user, tenant, clientA);
    expect(restored?.form).toEqual(finalForm);
    expect(JSON.stringify(restored?.pendingSave)).toBe(JSON.stringify(draft.pendingSave));
    expect(restored?.serverFormSnapshot).toBe(draft.serverFormSnapshot);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('migrates old drafts only after commit, retaining exact originals on an aborted write', async () => {
    const previous = JSON.stringify({ form: { ...createEmptyIntakeForm(), firstName: 'Alte Fassung' }, stepIndex: 1, schemaVersion: 2 });
    legacy.set(key, previous);
    expect((await loadClientIntakeDraft(user, tenant))?.form.firstName).toBe('Alte Fassung');
    beforeCommit = () => expect(legacy.get(key)).toBe(previous);
    failCommit = true;
    await expect(draftStorage.setItem(key, 'new exact original')).rejects.toThrow('Entwurfssicherung');
    expect(legacy.get(key)).toBe(previous); expect(records.has(key)).toBe(false);
    failCommit = false;
    await draftStorage.setItem(key, 'new exact original');
    beforeCommit = undefined;
    expect(legacy.has(key)).toBe(false);
    expect(await draftStorage.getItem(key)).toBe('new exact original');
  });

  it('keeps another client, tenant and account recoverable when clearing a completed draft', async () => {
    const form = { ...createEmptyIntakeForm(), firstName: 'A' };
    await saveClientIntakeDraft(user, tenant, { form, stepIndex: 1, clientId: clientA });
    await saveClientIntakeDraft(user, tenant, { form: { ...form, firstName: 'B' }, stepIndex: 1, clientId: clientB });
    await saveClientIntakeDraft('other-user', 'other-tenant', { form, stepIndex: 1, clientId: clientA });
    await clearClientIntakeDraft(user, tenant, clientA);
    expect(await loadClientIntakeDraft(user, tenant, clientA)).toBeNull();
    expect((await loadClientIntakeDraft(user, tenant))?.form.firstName).toBe('B');
    expect((await loadClientIntakeDraft('other-user', 'other-tenant', clientA))?.form.firstName).toBe('A');
  });

  it('prefers a durable new copy if legacy cleanup fails, and never reports a failed delete as success', async () => {
    legacy.set(key, 'old');
    vi.mocked(AsyncStorage.removeItem).mockRejectedValue(new Error('cleanup failed'));
    await draftStorage.setItem(key, 'new');
    expect(await draftStorage.getItem(key)).toBe('new');
    await expect(draftStorage.removeItem(key)).rejects.toThrow('cleanup failed');
    expect(records.get(key)).toBe('new');
  });

  it('allows a retry after blocked database access without deleting the old draft', async () => {
    legacy.set(key, 'old');
    vi.mocked(indexedDB.open).mockImplementationOnce(() => {
      const request = {} as IDBOpenDBRequest;
      queueMicrotask(() => request.onblocked?.(new Event('blocked') as IDBVersionChangeEvent));
      return request;
    });
    await expect(draftStorage.setItem(key, 'new')).rejects.toThrow('Entwurfssicherung');
    expect(legacy.get(key)).toBe('old');
    await draftStorage.setItem(key, 'new');
    expect(await draftStorage.getItem(key)).toBe('new');
  });

  it('uses the existing fallback only when IDB is unsupported and reports storage exhaustion clearly', async () => {
    vi.stubGlobal('indexedDB', undefined);
    legacy.set(key, 'old');
    expect(await draftStorage.getItem(key)).toBe('old');
    await expect(draftStorage.setItem(key, 'new')).rejects.toThrow('Bitte lassen Sie die Aufnahme geöffnet');
    expect(legacy.get(key)).toBe('old');
  });
});
