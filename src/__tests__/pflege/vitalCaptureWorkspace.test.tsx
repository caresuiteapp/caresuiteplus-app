// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VITAL_SIGN_CATALOG } from '@/lib/pflege/vitalCatalog';

const fixture = vi.hoisted(() => ({
  clientId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-000000000002',
  receiptId: '00000000-0000-4000-8000-000000000003',
  catalogVersion: '2026-10-01T10:00:00Z',
  people: [] as { id: string; name: string }[],
  active: ['blood_pressure', 'pulse', 'pain_score'],
  prepare: vi.fn(),
  record: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('@/components/layout', () => ({
  ScreenShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/components/ui', () => ({
  ErrorState: ({ message }: { message: string }) => <div role="alert">{message}</div>,
  LoadingState: ({ message }: { message: string }) => <div role="status">{message}</div>,
  InfoBanner: ({ message }: { message: string }) => <p>{message}</p>,
  PremiumInput: ({
    label, accessibilityLabel, placeholder, value, onChangeText, editable,
  }: {
    label?: string; accessibilityLabel?: string; placeholder?: string; value: string;
    onChangeText?(value: string): void; editable?: boolean;
  }) => <label>{label}<input aria-label={accessibilityLabel ?? label} placeholder={placeholder} value={value}
    disabled={editable === false} onInput={event => onChangeText?.(event.currentTarget.value)} onChange={() => {}} /></label>,
}));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/pflege/VitalMeasurementArtwork', () => ({
  VitalMeasurementArtwork: ({ kind }: { kind: string }) => <span data-artwork={kind} />,
}));
vi.mock('@/design/tokens/carelightadaptive', () => ({
  useCareLightPalette: () => ({ c: { text: '#132942', muted: '#4b6380', surface: '#fff', border: '#d5e0e9', surfaceAlt: '#f2f6fa' } }),
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { roleKey: 'nurse' } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => fixture.tenantId }));
vi.mock('@/hooks/pflege/useCareRuntimePermissions.web', () => ({
  useCareRuntimePermissions: () => ({ tenantId: fixture.tenantId, roleKey: 'nurse', permissions: Object.freeze([]), can: () => true }),
}));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: () => false }));
vi.mock('@/lib/permissions/carePermissionOwner.web', () => ({
  carePermissionOwner: () => ({ tenantId: fixture.tenantId, profileId: 'test-user', roleKey: 'nurse' }),
}));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: fixture.confirm }));
vi.mock('@/lib/pflege/vitalCreateOriginalRead.web', () => ({
  fetchVitalCreateClientsWeb: () => null, fetchVitalCreateChoicesWeb: () => null,
}));
vi.mock('@/hooks/core/useAsyncQuery', () => ({
  useAsyncQuery: (_fetch: unknown, _deps: unknown, options: { enabled: boolean; queryKey: string }) => ({
    data: options.enabled ? { view: options.queryKey.endsWith('vital-clients') ? fixture.people : fixture.active.map(key => ({
      key, enabled: true, catalogVersion: fixture.catalogVersion, configurationVersion: 'none',
    })) } : null,
    loading: false, refreshing: false, error: null, refreshError: null,
    cacheMeta: { fromCache: false }, refresh: () => Promise.resolve(true),
  }),
}));
vi.mock('@/lib/pflege/vitalCreateRuntime.web', () => ({
  VitalCreateRuntimeWeb: class {
    tenantId = fixture.tenantId;
    originalDraftVersion = 0;
    readScopeVersion = 1;
    receipt: string | null = null;
    listeners = new Set<() => void>();
    canRead = () => true;
    canManage = () => true;
    captureReadScope = () => ({});
    originalRequestState = () => ({ pending: false, busy: false, uncertain: false });
    subscribeOriginal = (callback: () => void) => { this.listeners.add(callback); return () => this.listeners.delete(callback); };
    setView = () => {};
    visible = (_kind: unknown, data: { view: unknown } | null) => data?.view ?? null;
    maySelect = (_kind: unknown, data: unknown) => !!data && !this.receipt;
    clearChoices = () => {};
    mount = () => {};
    dispose = () => {};
    prepare = fixture.prepare;
    confirmedReceipt = () => this.receipt;
    mayConfirm = (id: string) => this.receipt === id;
    captureOriginalRetry = () => null;
    captureNewDraft = () => this.receipt;
    startNewDraft = (token: unknown) => {
      if (token !== this.receipt || !this.receipt) return false;
      this.receipt = null;
      this.originalDraftVersion++;
      this.listeners.forEach(callback => callback());
      return true;
    };
  },
}));
vi.mock('@/hooks/useMedicationSubmission.web', async () => {
  const { useState } = await import('react');
  return { useMedicationSubmission: (_dirty: boolean, execute: (...args: unknown[]) => unknown) => {
    const [error, setError] = useState<string | null>(null);
    return { error, setError, busy: false, uncertain: false, locked: false, submit: (payload: unknown) => execute('request', payload, false) };
  } };
});
vi.mock('@/lib/pflege/vitalCreateNativeWrite.web', () => ({
  executeVitalCreateNativeWeb: async (runtime: { receipt: string; listeners: Set<() => void> }, _id: string, payload: unknown) => {
    fixture.record(payload);
    runtime.receipt = fixture.receiptId;
    runtime.listeners.forEach(callback => callback());
    return { ok: true, data: { id: fixture.receiptId } };
  },
}));

import { VitalReadingCreateScreen } from '@/screens/pflege/VitalReadingCreateScreen.web';

const button = (host: HTMLElement, text: string) => [...host.querySelectorAll<HTMLElement>('[role="button"], button')]
  .find(item => item.getAttribute('aria-label') === text || item.textContent?.trim() === text);

describe('Vitalwerte erfassen', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    fixture.people = [];
    fixture.prepare.mockReset().mockReturnValue(true);
    fixture.record.mockClear();
    fixture.confirm.mockReset().mockResolvedValue(true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  async function click(label: string) {
    const element = button(host, label);
    expect(element, label).toBeTruthy();
    await act(async () => element!.click());
  }
  async function fill(label: string, value: string) {
    const input = [...host.querySelectorAll('input')].find(element => element.getAttribute('aria-label') === label);
    expect(input, label).toBeTruthy();
    await act(async () => { input!.value = value; input!.dispatchEvent(new Event('input', { bubbles: true })); });
  }

  it('keeps all 42 identifiable measurement types browsable without an active case', async () => {
    await act(async () => root.render(<VitalReadingCreateScreen />));
    await click('Messkatalog: Alle');
    for (const definition of VITAL_SIGN_CATALOG) expect(host.querySelector(`[data-artwork="${definition.key}"]`)).not.toBeNull();
    await click('Glasgow Coma Scale');
    expect(button(host, 'Augen öffnen · E (1–4) *: 4')?.getAttribute('aria-disabled')).toBe('true');
    expect(button(host, 'Messung speichern')?.getAttribute('aria-disabled')).toBe('true');
    expect(fixture.record).not.toHaveBeenCalled();
  });

  it('saves only the selected case measurement, requires both pressure readings and keeps the same person for the next measurement', async () => {
    fixture.people = [{ id: fixture.clientId, name: 'Test Pflegefall' }];
    await act(async () => root.render(<VitalReadingCreateScreen />));
    await click('Klient:in auswählen');
    await click('Test Pflegefall');
    await click('Nichtinvasiver Blutdruck');
    await fill('Systolisch · mmHg *', '136');
    await click('Messung speichern');
    expect(fixture.record).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Messkomponenten fehlen');
    await fill('Diastolisch · mmHg *', '81');
    await click('Messdetails und Notiz');
    await click('Körperlage: Sitzend');
    await click('Messung speichern');
    expect(fixture.record).toHaveBeenCalledWith(expect.objectContaining({
      clientId: fixture.clientId, type: 'blood_pressure',
      valuesJson: '{"systolic":136,"diastolic":81}', contextJson: '{"position":"Sitzend"}',
      catalogVersion: fixture.catalogVersion,
    }));
    await click('Weitere Messung für diese Person');
    await click('Puls / Herzfrequenz');
    expect(button(host, 'Klient:in wechseln. Test Pflegefall')).toBeTruthy();
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Frequenz · /min *"]')?.value).toBe('');
  });
});
