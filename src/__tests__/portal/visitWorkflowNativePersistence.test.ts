import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativeStore = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => nativeStore.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      nativeStore.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      nativeStore.delete(key);
    }),
  },
}));

describe('native visit workflow persistence', () => {
  beforeEach(() => {
    nativeStore.clear();
    vi.stubGlobal('sessionStorage', undefined);
  });

  it('restores and clears an interrupted Android execution', async () => {
    const {
      clearVisitWorkflowSnapshotAsync,
      mergeVisitWorkflowSnapshotWithExisting,
      readVisitWorkflowSnapshotAsync,
      writeVisitWorkflowSnapshotAsync,
    } = await import('@/lib/portal/visitWorkflowPersistence');
    const snapshot = mergeVisitWorkflowSnapshotWithExisting(
      null,
      'assignment-1',
      '/portal/employee/assignments/assignment-1/execute',
      {
        step: 'signature',
        awaitingSignature: true,
        documentationSubmitted: true,
        attachmentReferences: ['tenant/visit/photo.jpg'],
      },
    );

    await writeVisitWorkflowSnapshotAsync(snapshot);
    expect(await readVisitWorkflowSnapshotAsync('assignment-1')).toMatchObject({
      step: 'signature',
      awaitingSignature: true,
      documentationSubmitted: true,
      attachmentReferences: ['tenant/visit/photo.jpg'],
    });

    await clearVisitWorkflowSnapshotAsync('assignment-1');
    expect(await readVisitWorkflowSnapshotAsync('assignment-1')).toBeNull();
  });
});
