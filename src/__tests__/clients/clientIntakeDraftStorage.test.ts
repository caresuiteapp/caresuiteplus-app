import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearClientIntakeDraft,
  hasIntakeDraftContent,
  loadClientIntakeDraft,
  mergeIntakeFormWithDefaults,
  saveClientIntakeDraft,
} from '@/lib/clients/clientIntakeDraftStorage';
import { createEmptyIntakeForm } from '@/lib/clients/clientIntakeService';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe('Client intake draft storage', () => {
  const userId = 'user-intake-1';
  const tenantId = 'tenant-intake-1';
  const storageKey = `caresuite:client-intake-draft:${tenantId}:${userId}`;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue();
    vi.mocked(AsyncStorage.removeItem).mockResolvedValue();
  });

  it('erkennt leere und befüllte Entwürfe', () => {
    const empty = createEmptyIntakeForm();
    expect(hasIntakeDraftContent({ form: empty, stepIndex: 0 })).toBe(false);
    expect(hasIntakeDraftContent({
      form: { ...empty, firstName: 'Anna' },
      stepIndex: 0,
    })).toBe(true);
    expect(hasIntakeDraftContent({ form: empty, stepIndex: 2 })).toBe(true);
  });

  it('speichert Entwurf mandanten- und benutzerbezogen', async () => {
    const form = { ...createEmptyIntakeForm(), firstName: 'Max', lastName: 'Muster' };

    await saveClientIntakeDraft(userId, tenantId, { form, stepIndex: 3 });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      storageKey,
      expect.stringContaining('"firstName":"Max"'),
    );
  });

  it('speichert Schrittindex und Einwilligungsfelder im Entwurf', async () => {
    const form = {
      ...createEmptyIntakeForm(),
      firstName: 'Lena',
      careContexts: ['ambulatory_care' as import('@/types/modules/client').ClientCareContext],
      consentDatenschutz: true,
      consentVertrag: true,
      consentTypes: ['datenschutz'],
    };

    await saveClientIntakeDraft(userId, tenantId, { form, stepIndex: 7 });

    const payload = vi.mocked(AsyncStorage.setItem).mock.calls[0]?.[1] as string;
    expect(payload).toContain('"stepIndex":7');
    expect(payload).toContain('"consentDatenschutz":true');
    expect(payload).toContain('"consentVertrag":true');
  });

  it('lädt und merged gespeicherten Entwurf mit Defaults', async () => {
    const stored = {
      form: { firstName: 'Erika', careContexts: ['ambulant'] },
      stepIndex: 4,
      updatedAt: '2026-06-16T10:00:00.000Z',
    };
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(stored));

    const draft = await loadClientIntakeDraft(userId, tenantId);

    expect(draft?.form.firstName).toBe('Erika');
    expect(draft?.form.careContexts).toEqual(['ambulant']);
    expect(draft?.form.assignedModules).toEqual(createEmptyIntakeForm().assignedModules);
    expect(draft?.stepIndex).toBe(4);
  });

  it('löscht Entwurf bei leerem Inhalt', async () => {
    const empty = createEmptyIntakeForm();
    await saveClientIntakeDraft(userId, tenantId, { form: empty, stepIndex: 0 });
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(storageKey);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('merged neue Formularfelder in ältere Entwürfe', () => {
    const merged = mergeIntakeFormWithDefaults({ firstName: 'Tom', billingTypes: ['pflegekasse'] });
    expect(merged.billingTypes).toEqual(['pflegekasse']);
    expect(merged.costBearerTypes).toEqual([]);
  });

  it('entfernt Entwurf explizit', async () => {
    await clearClientIntakeDraft(userId, tenantId);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(storageKey);
  });
});
